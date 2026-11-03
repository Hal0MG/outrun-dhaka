// A district circuit raced with no renderer: the game's own track builder (World.makeTrack), driving model
// (Player) and race (Race: the rivals, contact, nitro rows and nitro for passes), stepped by a driver that is
// not a person. For training and measuring AI drivers. No traffic or pedestrians yet.

import { World } from '../src/world/world.js';
import { ROUTE, circuitStage } from '../src/world/stages.js';
import { contraAt } from '../src/world/contra.js';
import { Player, NITRO_MAX, SPEED_K } from '../src/game/player.js';
import { Race } from '../src/game/race.js';
import { RNG, clamp, mulberry32 } from '../src/core/util.js';

export { ROUTE as DISTRICTS };

// the sports coupe; every car drives the same (src/game/cars.js), only size and sound differ
export const CAR = { id: 'supra', top: 275, accel: 1.0, grip: 0.92, width: 1.81, length: 4.52 };
export const DT = 1 / 60;
// how far ahead the driver reads the road, in metres
export const LOOK = [10, 25, 45, 70, 100, 140, 190, 250];
// how many rivals the driver sees: the nearest ones ahead, and behind
export const SEE_AHEAD = 4, SEE_BEHIND = 2;
const SEE_AHEAD_M = 150, SEE_BEHIND_M = 40;
// the rolling start (src/game/race.js ROLL_V)
const ROLL_V = 22;
// rival car sizes, as src/game/carmodels.js fits them (the meshes themselves need a browser)
const SIZES = { skyline: [4.6, 1.8], supra: [4.5, 1.82], celica: [4.4, 1.78], chaser: [4.75, 1.77], miata: [3.95, 1.75], premio: [4.6, 1.76], prado: [4.8, 1.9] };
const MD = Object.fromEntries(Object.entries(SIZES).map(([k, [len, wid]]) => [k, { len, wid, hgt: 1.4 }]));

// building a track is the slow part (a few ms), and it is the same every time: keep them
const world = Object.create(World.prototype);
world.tracks = new Map();
const built = new Map();
function trackFor(district) {
  if (!built.has(district)) {
    if (!ROUTE.includes(district)) throw new Error(`unknown district ${district}; one of ${ROUTE.join(', ')}`);
    built.set(district, world.makeTrack(circuitStage(district).id, null, 0));
  }
  return built.get(district);
}

// gold, silver and bronze times, as the game sets them (src/game/race.js)
export function parTimes(district) {
  const tr = trackFor(district);
  const nom = (tr.goalS - tr.gateS) / ((CAR.top / 3.6) * SPEED_K);
  return { gold: nom * 1.12, silver: nom * 1.19, bronze: nom * 1.28 };
}

export const OBS_SIZE = 12 + LOOK.length * 3 + (SEE_AHEAD + SEE_BEHIND) * 4;
export const ACT_SIZE = 3;

export class RaceEnv {
  // opts.rivals: race the field (default) or alone
  // opts.repeat: physics frames per decision (4 = 15 decisions a second)
  // opts.randomStart: move the whole grid to a random point on the first lap, so training sees every corner early
  // opts.laps: race this many laps from the start (default: the whole race)
  // opts.openOpposite: let the driver use the opposite carriageway anywhere, as the game does. Off by default: in the
  //   game it is full of oncoming traffic, which is not simulated yet, so here it would be an empty road that pays
  //   nitro. Closed, it costs reward and pays no nitro, except through ROAD WORKS, where the game sends you across.
  constructor(opts = {}) {
    this.rivals = opts.rivals ?? true;
    this.openOpposite = !!opts.openOpposite;
    this.repeat = opts.repeat ?? 4;
    this.randomStart = !!opts.randomStart;
    this.laps = opts.laps ?? null;
    this.maxTime = opts.maxTime ?? 400;
    this.rng = new RNG(opts.seed ?? 1);
    this.player = new Player(CAR);
    // the race only asks the game for these
    this.game = {
      player: this.player, world, state: 'race',
      fleet: { md: (m) => MD[m] },
      stalls: { stock() {} }, // roadside stalls go flying and cost nothing
      scene: { add() {} },
      onPass: (n) => { this.passed += n; },
    };
    this.race = new Race(this.game);
    if (!this.openOpposite) {
      const pay = this.race.wrongWayReward;
      this.race.wrongWayReward = (dt) => { if (contraAt(this.track, this.player.s)) pay.call(this.race, dt); };
    }
  }

  reset(opts = {}) {
    if (opts.seed != null) this.rng = new RNG(opts.seed);
    // the rivals' mistakes come from Math.random: seed it too, so a race replays exactly
    Math.random = mulberry32((this.rng.next() * 2 ** 32) >>> 0);
    this.district = opts.district ?? this.rng.pick(ROUTE);
    const tr = (this.track = trackFor(this.district));
    const P = this.player, R = this.race;
    P.reset(tr);
    R.start('circuit');
    if (!this.rivals) R.rivals = [];
    if (this.randomStart) {
      // the grid as it is, further round the lap
      const d = this.rng.range(0, tr.lapLen);
      P.s += d;
      for (const r of R.rivals) r.G += d;
      P.nitro = this.rng.int(0, NITRO_MAX);
    }
    this.startS = P.s;
    this.goalS = this.laps ? Math.min(tr.goalS, P.s + this.laps * tr.lapLen) : tr.goalS;
    this.time = 0;
    this.lapTimes = [];
    this.lapsDone = Math.max(0, Math.floor((P.s - tr.gateS) / tr.lapLen));
    this.lapStart = 0;
    this.offroadTime = 0;
    this.scrapeTime = 0;
    this.nitroUsed = 0;
    this.passed = 0;
    this.hits = 0;
    this.wrongTime = 0;
    this.stillTime = 0;
    R.standings();
    this.lastPos = R.position;
    return { obs: this.observe(), info: this.info() };
  }

  // action: [steer -1..1, pedal -1..1 (positive is throttle, negative is brake), nitro (> 0 fires a charge)]
  step(action) {
    const P = this.player, tr = this.track, R = this.race;
    const steer = clamp(+action[0] || 0, -1, 1);
    const pedal = clamp(+action[1] || 0, -1, 1);
    const input = { steer, throttle: Math.max(0, pedal), brake: Math.max(0, -pedal), boostHeld: (+action[2] || 0) > 0 };
    const s0 = P.s;
    let off = 0, scrape = 0, wrong = 0;
    for (let i = 0; i < this.repeat; i++) {
      P.update(DT, input, world);
      R.update(DT);
      for (const e of P.events) { if (e.type === 'hit') this.hits++; else if (e.type === 'nitro') this.nitroUsed++; }
      P.events.length = 0;
      this.time += DT;
      off += P.offroad;
      scrape += P.scrape;
      if (P.wrongWay && !this.openOpposite && !contraAt(tr, P.s)) wrong++;
      if (P.s >= tr.gateS + (this.lapsDone + 1) * tr.lapLen && this.lapsDone < tr.laps) {
        this.lapsDone++;
        this.lapTimes.push(this.time - this.lapStart);
        this.lapStart = this.time;
      }
      if (P.s >= this.goalS) break;
    }
    this.offroadTime += off * DT;
    this.scrapeTime += scrape * DT;
    this.wrongTime += wrong * DT;
    this.stillTime = P.v < 2 ? this.stillTime + DT * this.repeat : 0;
    // reward is progress down the road (1 per decision at top speed) less a cost for the time taken, so standing still
    // never pays and a faster race scores more; off the road and against the wall are slow anyway, their small extra
    // cost just teaches it sooner
    const progress = (P.s - s0) / (P.vmax * DT * this.repeat);
    const n = this.repeat;
    let reward = progress - 0.3 - 0.05 * (off / n) - 0.1 * (scrape / n) - 0.5 * (wrong / n);
    const terminated = P.s >= this.goalS;
    // stopped for five seconds: the race is lost, stop wasting the run on it
    const truncated = !terminated && (this.time >= this.maxTime || this.stillTime > 5);
    // and the places made as they are made (lost ones cost the same): 20 points for coming from last to first
    if (R.rivals.length) reward += (20 * (this.lastPos - R.position)) / (R.field - 1);
    this.lastPos = R.position;
    return { obs: this.observe(), reward, terminated, truncated, info: this.info() };
  }

  // everything the driver sees, scaled to roughly -1..1
  observe() {
    const P = this.player, tr = this.track, R = this.race;
    const s = Math.min(P.s, tr.length - 1);
    const hw = tr.halfWAt(s);
    const lim = world.limits(tr, s, P.x);
    const field = Math.max(1, R.rivals.length);
    const obs = [
      P.v / P.vmax,
      P.x / hw,
      P.vx / P.steerGrip,
      P.offroad,
      P.scrape,
      P.nitro / NITRO_MAX,
      P.boosting ? P.nitroT / 2.6 : 0,
      (P.x - lim.lSoft) / 10,
      (lim.rSoft - P.x) / 10,
      contraAt(tr, s, 150) ? 1 : 0,
      R.rivals.length ? (R.position - 1) / field : 0,
      (R.passNitro || 0) / 8,
    ];
    // the road ahead: how hard it bends, and how much room the car will have either side if it keeps its line
    for (const d of LOOK) {
      const sa = Math.min(s + d, tr.length - 1);
      const la = world.limits(tr, sa, P.x);
      obs.push(tr.kAt(sa) * 150, (P.x - la.lSoft) / 10, (la.rSoft - P.x) / 10);
    }
    // the nearest rivals: there or not, how far along, how far across, how much faster (an empty slot is all zeros)
    const PG = P.track.base + P.s;
    const ahead = [], behind = [];
    for (const r of R.rivals) {
      if (r.out) continue;
      const d = r.G - PG;
      if (d >= 0 && d < SEE_AHEAD_M) ahead.push([d, r]);
      else if (d < 0 && d > -SEE_BEHIND_M) behind.push([-d, r]);
    }
    for (const [list, n, range, sign] of [[ahead, SEE_AHEAD, SEE_AHEAD_M, 1], [behind, SEE_BEHIND, SEE_BEHIND_M, -1]]) {
      list.sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < n; i++) {
        const e = list[i];
        if (e) obs.push(1, (sign * e[0]) / range, (e[1].x - P.x) / 10, (e[1].v - P.v) / 20);
        else obs.push(0, 0, 0, 0);
      }
    }
    return obs;
  }

  info() {
    const P = this.player, tr = this.track, R = this.race;
    return {
      district: this.district,
      time: this.time,
      progress: clamp((P.s - this.startS) / (this.goalS - this.startS), 0, 1),
      laps: this.lapTimes.slice(),
      position: R.rivals.length ? R.position : 1,
      field: R.rivals.length ? R.field : 1,
      passed: this.passed,
      hits: this.hits,
      offroad: this.offroadTime,
      wrong_way: this.wrongTime,
      scrape: this.scrapeTime,
      nitro: this.nitroUsed,
      s: P.s,
      x: P.x,
      kmh: P.kmh,
      halfW: tr.halfWAt(Math.min(P.s, tr.length - 1)),
      k: tr.kAt(Math.min(P.s, tr.length - 1)),
    };
  }
}
