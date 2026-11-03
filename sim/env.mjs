// A district circuit raced with no renderer: the game's own track builder (World.makeTrack) and driving
// model (Player), stepped by a driver that is not a person. For training and measuring AI drivers.
// Racing alone: no rivals, traffic or pickups yet.

import { World } from '../src/world/world.js';
import { ROUTE, circuitStage } from '../src/world/stages.js';
import { contraAt } from '../src/world/contra.js';
import { Player, NITRO_MAX, SPEED_K } from '../src/game/player.js';
import { RNG, clamp } from '../src/core/util.js';

export { ROUTE as DISTRICTS };

// the sports coupe; every car drives the same (src/game/cars.js), only size and sound differ
export const CAR = { id: 'supra', top: 275, accel: 1.0, grip: 0.92, width: 1.81, length: 4.52 };
export const DT = 1 / 60;
// how far ahead the driver reads the road, in metres
export const LOOK = [10, 25, 45, 70, 100, 140, 190, 250];
// the rolling start (src/game/race.js ROLL_V)
const ROLL_V = 22;

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

export const OBS_SIZE = 10 + LOOK.length * 3;
export const ACT_SIZE = 3;

export class RaceEnv {
  // opts.repeat: physics frames per decision (4 = 15 decisions a second)
  // opts.randomStart: start anywhere on the first lap at a random speed and line, so training sees every corner early
  // opts.laps: race this many laps from the start (default: the whole race)
  constructor(opts = {}) {
    this.repeat = opts.repeat ?? 4;
    this.randomStart = !!opts.randomStart;
    this.laps = opts.laps ?? null;
    this.maxTime = opts.maxTime ?? 400;
    this.rng = new RNG(opts.seed ?? 1);
    this.player = new Player(CAR);
  }

  reset(opts = {}) {
    if (opts.seed != null) this.rng = new RNG(opts.seed);
    this.district = opts.district ?? this.rng.pick(ROUTE);
    const tr = (this.track = trackFor(this.district));
    const P = this.player;
    P.reset(tr);
    P.s = tr.gateS - 20;
    P.x = 0;
    P.v = ROLL_V;
    if (this.randomStart) {
      P.s = tr.gateS + this.rng.range(0, tr.lapLen);
      P.v = P.vmax * this.rng.range(0.2, 0.95);
      P.x = this.rng.range(-0.6, 0.6) * tr.halfWAt(P.s);
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
    return { obs: this.observe(), info: this.info() };
  }

  // action: [steer -1..1, pedal -1..1 (positive is throttle, negative is brake), nitro (> 0 fires a charge)]
  step(action) {
    const P = this.player, tr = this.track;
    const steer = clamp(+action[0] || 0, -1, 1);
    const pedal = clamp(+action[1] || 0, -1, 1);
    const input = { steer, throttle: Math.max(0, pedal), brake: Math.max(0, -pedal), boostHeld: (+action[2] || 0) > 0 };
    const s0 = P.s;
    let off = 0, scrape = 0;
    const charges = P.nitro;
    for (let i = 0; i < this.repeat; i++) {
      P.update(DT, input, world);
      P.events.length = 0;
      this.time += DT;
      off += P.offroad;
      scrape += P.scrape;
      if (P.s >= tr.gateS + (this.lapsDone + 1) * tr.lapLen && this.lapsDone < tr.laps) {
        this.lapsDone++;
        this.lapTimes.push(this.time - this.lapStart);
        this.lapStart = this.time;
      }
      if (P.s >= this.goalS) break;
    }
    if (P.nitro < charges) this.nitroUsed++;
    this.offroadTime += off * DT;
    this.scrapeTime += scrape * DT;
    // reward is progress down the road, one point per second spent at top speed, so a faster lap is a bigger total;
    // off the road and against the wall are slow anyway, the small extra cost just teaches it sooner
    const progress = (P.s - s0) / (P.vmax * DT * this.repeat);
    const reward = progress - 0.1 * (off / this.repeat) - 0.2 * (scrape / this.repeat);
    const terminated = P.s >= this.goalS;
    const truncated = !terminated && this.time >= this.maxTime;
    return { obs: this.observe(), reward, terminated, truncated, info: this.info() };
  }

  // everything the driver sees, scaled to roughly -1..1
  observe() {
    const P = this.player, tr = this.track;
    const s = Math.min(P.s, tr.length - 1);
    const hw = tr.halfWAt(s);
    const lim = world.limits(tr, s, P.x);
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
    ];
    // the road ahead: how hard it bends, and how much room the car will have either side if it keeps its line
    for (const d of LOOK) {
      const sa = Math.min(s + d, tr.length - 1);
      const la = world.limits(tr, sa, P.x);
      obs.push(tr.kAt(sa) * 150, (P.x - la.lSoft) / 10, (la.rSoft - P.x) / 10);
    }
    return obs;
  }

  info() {
    const P = this.player, tr = this.track;
    return {
      district: this.district,
      time: this.time,
      progress: clamp((P.s - this.startS) / (this.goalS - this.startS), 0, 1),
      laps: this.lapTimes.slice(),
      offroad: this.offroadTime,
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
