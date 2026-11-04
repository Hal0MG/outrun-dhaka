// A district circuit, or The Run, raced with no renderer: the game's own track builder (World.makeTrack), driving
// model (Player) and race (Race: the rivals, contact, nitro rows, nitro for passes and the knockout gates), stepped by
// a driver that is not a person. For training and measuring AI drivers, and for trying trained ones as rivals. No
// traffic, pedestrians or stalls: in the game they cost a racer nothing, so they are left out.

import { World } from '../src/world/world.js';
import { ROUTE, KNOCKOUTS, RUN_FIELD, circuitStage } from '../src/world/stages.js';
import { contraAt } from '../src/world/contra.js';
import { Player, NITRO_MAX, SPEED_K } from '../src/game/player.js';
import { Race } from '../src/game/race.js';
import { RNG, clamp, mulberry32 } from '../src/core/util.js';
import { Brain } from './brain.mjs';

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

// The Run: every district's road laid end to end, each the child of the one before, as the game builds them while the
// player nears each fork (without the gantry sign, which needs a canvas). Built once; what a race leaves on the tracks
// (the gates passed, the nitro laid, the road taken) is cleared on every reset.
let chain = null;
function runChain() {
  if (!chain) {
    chain = [];
    for (const id of ROUTE) {
      const prev = chain[chain.length - 1] ?? null;
      const tr = world.makeTrack(id, prev, 0);
      if (prev) prev.children = [tr, tr];
      chain.push(tr);
    }
  }
  for (const tr of chain) { tr.koDone = false; tr.stocked = false; tr.chosen = null; }
  return chain;
}

// gold, silver and bronze times, as the game sets them (src/game/race.js)
export function parTimes(district) {
  const tr = trackFor(district);
  const nom = (tr.goalS - tr.gateS) / ((CAR.top / 3.6) * SPEED_K);
  return { gold: nom * 1.12, silver: nom * 1.19, bronze: nom * 1.28 };
}

// a rival's own shove against another car: the same as the one in Race.driveRivals, which only covers the scripted ones
function shove(a, b) {
  const ds = b.G - a.G, dx = b.x - a.x;
  const wl = a.l + b.l, ww = a.w + b.w;
  if (Math.abs(ds) > wl || Math.abs(dx) > ww) return;
  const ox = ww - Math.abs(dx), os = wl - Math.abs(ds);
  if (os < ox) {
    const [back, front] = ds > 0 ? [a, b] : [b, a];
    back.G = front.G - wl - 0.05;
    back.v = Math.min(back.v, front.v);
  } else {
    const p = Math.sign(dx || 1) * ox * 0.5;
    a.x -= p; b.x += p;
  }
}

// a learned rival is a real Player; its rival entry stays the truth the rest of the race reads and shoves, so the car
// takes its place from the entry before each step and writes it back after
// (on The Run it is also on whichever district's road its place along the route puts it)
function take(r, tr, tracks) {
  const P = r.brain.P;
  if (tracks) {
    // the road it is on: the last district that has begun (the gap to the next is the fork, so it stays on the one before)
    tr = tracks[0];
    for (const t of tracks) if (t.base <= r.G) tr = t;
  }
  P.track = tr;
  P.s = r.G - tr.base; P.x = r.x; P.v = r.v; P.vx = r.vx;
  return tr;
}

export const OBS_SIZE = 12 + LOOK.length * 3 + (SEE_AHEAD + SEE_BEHIND) * 4 + 4 + 4;
export const ACT_SIZE = 3;
const LANE_SHIFT = 0.5; // how much of a scripted rival's lane bias the learned ones keep

export class RaceEnv {
  // opts.mode: 'circuit' (a district, three laps; the default) or 'run' (The Run: 48 cars, all fifteen districts, the
  //   knockout gates; the player is out below the cut and the episode ends there). Learned rivals work there too.
  // opts.rivals: race the field (default) or alone
  // opts.repeat: physics frames per decision (4 = 15 decisions a second)
  // opts.randomStart: move the whole grid to a random point on the first lap, so training sees every corner early
  // opts.laps: race this many laps from the start (default: the whole race)
  // opts.openOpposite: let the driver use the opposite carriageway anywhere, as the game does. Off by default: in the
  //   game it pays wrong-way nitro, but the scripted rivals never use it, so a learned rival must not either, and
  //   on the empty road it would pay nitro all lap. Closed, it costs reward and pays no nitro, except through ROAD WORKS, where the game sends you across.
  // opts.learned and opts.brain: how many of the front-running rivals (the leader first) are driven by a trained
  //   network (brain: its brain.json from ml/export.py) instead of the scripted driver. Each is a real Player, held
  //   to the pace its scripted self would run so it is as beatable, and it has no nitro.
  // opts.detail: say how every rival is doing in info.rivals
  constructor(opts = {}) {
    this.mode = opts.mode ?? 'circuit';
    this.rivals = opts.rivals ?? true;
    this.openOpposite = !!opts.openOpposite;
    this.detail = !!opts.detail;
    this.repeat = opts.repeat ?? 4;
    this.randomStart = !!opts.randomStart;
    this.laps = opts.laps ?? null;
    this.maxTime = opts.maxTime ?? (this.mode === 'run' ? 900 : 400);
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
      this.race.wrongWayReward = (dt) => { if (contraAt(this.player.track, this.player.s)) pay.call(this.race, dt); };
    }
    // a whole field of learned cars is tougher than the scripted one (no leash, grip-limit bends): a little under the
    // scripted skill gives The Run the same gate margins (median finish 7th for the simple driver, as scripted)
    this.pace = opts.learnedPace ?? (this.mode === 'run' ? 0.97 : 1);
    this.learnedCount = opts.brain ? (opts.learned ?? 0) : 0;
    this.brain = this.learnedCount ? Brain.load(opts.brain) : null;
    if (this.brain) this.hookLearned();
  }

  // the scripted driver moves every rival; leave the learned ones to the network, but let the scripted ones see them
  hookLearned() {
    const R = this.race;
    const scripted = R.driveRivals.bind(R);
    R.driveRivals = (dt, go) => {
      this.go = go;
      const all = R.rivals;
      R.rivals = all.filter((r) => !r.brain);
      R._all = all;
      scripted(dt, go);
      R.rivals = all;
      for (let i = 0; i < all.length; i++) {
        const a = all[i];
        if (!a.brain || a.out) continue;
        for (let j = 0; j < all.length; j++) {
          const b = all[j];
          if (b !== a && !b.out && !(b.brain && j < i)) shove(a, b);
        }
      }
    };
    // as Race.blockerAhead, but every car counts
    R.blockerAhead = function (r, range) {
      let best = null;
      const test = (G, x, v) => {
        const d = G - r.G;
        if (d <= 0 || d > range + 6 || Math.abs(x - r.x) > 2.4) return;
        if (!best || d < best.d) best = { d, x, v };
      };
      for (const o of this._all || this.rivals) if (o !== r && !o.out) test(o.G, o.x, o.v);
      test(this.playerG(), this.game.player.x, this.game.player.v);
      return best;
    };
  }

  // the network steers for the middle of what it sees, so each rival is shown a road shifted sideways by where it means to
  // run: its own lane across the straights and, when it makes a mistake, wide of the bend (as race.js's xT)
  shifted(obs, r) {
    const P = r.brain.P, tr = P.track;
    const hw = tr.halfWAt(Math.min(P.s, tr.length - 1));
    const kIn = this.race.kAt(r.G + 55);
    const bend = clamp(Math.abs(kIn) / 0.009, 0, 1);
    const dx = LANE_SHIFT * r.bias * hw * (1 - bend) + (r.slipT > 0 ? Math.sign(kIn || 1) * hw * 0.3 : 0);
    if (!dx) return obs;
    obs[1] -= dx / hw;
    obs[7] -= dx / 10; obs[8] += dx / 10;
    for (let i = 0; i < LOOK.length; i++) { obs[12 + 3 * i + 1] -= dx / 10; obs[12 + 3 * i + 2] += dx / 10; }
    return obs;
  }

  driveLearned(dt) {
    const end = this.endG, tracks = this.mode === 'run' ? chain : null;
    for (const r of this.race.rivals) {
      const b = r.brain;
      if (!b || r.out) continue;
      const P = b.P;
      const tr = take(r, this.track, tracks);
      // the network drives flat out: hold it to the pace its scripted self runs (race.js skill), and after the flag
      // roll out at the same 26 m/s they do
      let vT = r.done ? 26 : r.skill * P.vmax * this.pace;
      // what a scripted rival does too (race.js driveRivals): a car right behind the player pushes to hold it off, and
      // now and then a driver runs wide in a bend and lifts for a second
      const gap = r.G - this.race.playerG();
      if (this.go && gap < 0 && gap > -200) vT *= 1 + 0.04 * (1 + gap / 200);
      r.mistakeT -= dt;
      r.slipT = Math.max(0, r.slipT - dt);
      if (this.go && r.mistakeT <= 0) {
        r.mistakeT = 5 + Math.random() * 9;
        const kA = Math.max(Math.abs(this.race.kAt(r.G + 30)), Math.abs(this.race.kAt(r.G + 70)));
        if (kA > 0.004 && Math.random() < 0.5) r.slipT = 1.1;
      }
      if (r.slipT > 0) vT *= 0.84;
      let [steer, pedal] = b.act;
      // a car pinned to a rail can stand there braking for ever (the network has never been at rest on the road to
      // learn otherwise): after a second stopped, drive it for four seconds, floored and steering for the middle
      b.still = P.v < 3 && !r.done ? b.still + dt : 0;
      if (b.still > 1) { b.rescue = 4; b.still = 0; }
      if (b.rescue > 0) {
        b.rescue -= dt;
        pedal = 1;
        steer = clamp(-P.x / P.track.halfWAt(Math.min(P.s, P.track.length - 1)), -1, 1);
      }
      const throttle = Math.min(Math.max(0, pedal), clamp((vT - P.v) * 0.5, 0, 1));
      const brake = Math.max(0, -pedal, r.done && P.v > 28 ? 0.6 : 0);
      P.update(dt, { steer, throttle, brake, boostHeld: false }, world);
      P.events.length = 0;
      b.off += P.offroad * dt;
      b.scrape += P.scrape * dt;
      r.G = P.track.base + P.s; r.x = P.x; r.v = P.v; r.vx = P.vx;
      if (!r.done && r.G >= end) r.done = true;
      if (r.G > end + 300) { r.G = end + 300; r.v = 0; }
    }
  }

  reset(opts = {}) {
    if (opts.seed != null) this.rng = new RNG(opts.seed);
    // the rivals' mistakes come from Math.random: seed it too, so a race replays exactly
    Math.random = mulberry32((this.rng.next() * 2 ** 32) >>> 0);
    const run = this.mode === 'run';
    this.district = run ? 'run' : opts.district ?? this.rng.pick(ROUTE);
    const tr = (this.track = run ? runChain()[0] : trackFor(this.district));
    const P = this.player, R = this.race;
    P.reset(tr);
    R.start(run ? 'run' : 'circuit');
    if (!this.rivals) R.rivals = [];
    if (this.randomStart && !run) {
      // the grid as it is, further round the lap
      const d = this.rng.range(0, tr.lapLen);
      P.s += d;
      for (const r of R.rivals) r.G += d;
      P.nitro = this.rng.int(0, NITRO_MAX);
    }
    this.startS = P.s;
    this.goalS = this.laps && !run ? Math.min(tr.goalS, P.s + this.laps * tr.lapLen) : tr.goalS;
    // where it all ends, as distance along the route (a circuit is one track, so this is its own s)
    const last = run ? chain[chain.length - 1] : tr;
    this.goalG = last.base + (this.laps && !run ? this.goalS : last.goalS);
    this.startG = tr.base + P.s;
    this.endG = last.base + last.goalS;
    this.fieldStart = R.field;
    this.gates = [];
    this.time = 0;
    this.lapTimes = [];
    this.lapsDone = run ? 0 : Math.max(0, Math.floor((P.s - tr.gateS) / tr.lapLen));
    this.lapStart = 0;
    this.offroadTime = 0;
    this.scrapeTime = 0;
    this.nitroUsed = 0;
    this.passed = 0;
    this.hits = 0;
    this.wrongTime = 0;
    this.conedTime = 0;
    this.stillTime = 0;
    for (const r of R.rivals) r.finishT = null;
    if (this.brain) {
      for (const r of R.rivals.slice(0, this.learnedCount)) {
        const P = new Player({ ...CAR, width: r.w * 2, length: r.l * 2 });
        P.reset(tr);

        P.nitro = 0;
        r.brain = { P, act: [0, 0, 0], off: 0, scrape: 0, still: 0, rescue: 0 };
      }
    }
    R.standings();
    this.lastPos = R.position;
    return { obs: this.observe(), info: this.info() };
  }

  // action: [steer -1..1, pedal -1..1 (positive is throttle, negative is brake), nitro (> 0 fires a charge)]
  step(action) {
    const P = this.player, R = this.race;
    const steer = clamp(+action[0] || 0, -1, 1);
    const pedal = clamp(+action[1] || 0, -1, 1);
    const input = { steer, throttle: Math.max(0, pedal), brake: Math.max(0, -pedal), boostHeld: (+action[2] || 0) > 0 };
    const G0 = P.track.base + P.s;
    let off = 0, scrape = 0, wrong = 0, coned = 0;
    if (this.brain) {
      const tr = this.track, tracks = this.mode === 'run' ? chain : null;
      for (const r of R.rivals) {
        if (!r.brain || r.out) continue;
        take(r, tr, tracks);
        r.brain.act = this.brain.act(this.shifted(this.observation(r.brain.P, r), r));
      }
    }
    for (let i = 0; i < this.repeat; i++) {
      P.update(DT, input, world);
      if (this.mode === 'run') this.fork();
      if (this.brain) this.driveLearned(DT);
      R.update(DT);
      if (this.mode === 'run') this.logGate();
      for (const e of P.events) { if (e.type === 'hit') this.hits++; else if (e.type === 'nitro') this.nitroUsed++; }
      P.events.length = 0;
      this.time += DT;
      for (const r of R.rivals) if (r.done && r.finishT == null) r.finishT = this.time;
      off += P.offroad;
      scrape += P.scrape;
      if (P.wrongWay && !this.openOpposite && !contraAt(P.track, P.s)) wrong++;
      if (P.inWorks) coned++;
      const tr = this.track;
      if (this.mode === 'circuit' && P.s >= tr.gateS + (this.lapsDone + 1) * tr.lapLen && this.lapsDone < tr.laps) {
        this.lapsDone++;
        this.lapTimes.push(this.time - this.lapStart);
        this.lapStart = this.time;
      }
      if (R.finished || P.track.base + P.s >= this.goalG) break;
    }
    this.offroadTime += off * DT;
    this.scrapeTime += scrape * DT;
    this.wrongTime += wrong * DT;
    this.conedTime += coned * DT;
    this.stillTime = P.v < 2 ? this.stillTime + DT * this.repeat : 0;
    // reward is progress down the road (1 per decision at top speed) less a cost for the time taken, so standing still
    // never pays and a faster race scores more; off the road and against the wall are slow anyway, their small extra
    // cost just teaches it sooner
    const progress = (P.track.base + P.s - G0) / (P.vmax * DT * this.repeat);
    const n = this.repeat;
    // the coned-off lane in ROAD WORKS is rough, and the way out is across the kerb onto the opposite carriageway, which
    // takes starting early: say so, the slow speed it costs only shows up a second or two after the mistake
    let reward = progress - 0.3 - 0.05 * (off / n) - 0.25 * (scrape / n) - 0.5 * (wrong / n) - 0.4 * (coned / n);
    // a circuit ends at the flag; The Run also ends where the player is knocked out
    const terminated = this.mode === 'run' ? !!R.finished : P.s >= this.goalS;
    // stopped for five seconds: the race is lost, stop wasting the run on it
    const truncated = !terminated && (this.time >= this.maxTime || this.stillTime > 5);
    // and the places made as they are made (lost ones cost the same): 20 points for coming from last to first
    if (R.rivals.length) reward += (20 * (this.lastPos - R.position)) / (this.fieldStart - 1);
    this.lastPos = R.position;
    return { obs: this.observe(), reward, terminated, truncated, info: this.info() };
  }

  // the road runs on into the next district, as Game.handleFork does
  fork() {
    const P = this.player, tr = P.track;
    if (tr.isFinal || P.s <= tr.length) return;
    const child = tr.children[0];
    tr.chosen = child;
    P.track = child;
    P.s -= tr.length;
    this.track = child;
  }

  // note each knockout gate as it is met: where the player stood, against the cut
  logGate() {
    const R = this.race, tr = this.player.track;
    if (!tr.koDone || this.gates.some((g) => g.stage === tr.stageId)) return;
    this.gates.push({ stage: tr.stageId, cut: KNOCKOUTS[tr.stageId], position: R.finished?.pos ?? R.position, out: !!R.finished?.out });
  }

  // everything the driver sees, scaled to roughly -1..1
  observe() { return this.observation(this.player, null); }

  // what a car sees: P is its Player, self its rival entry (the player has none, and the rivals see the player as
  // one more car)
  observation(P, self) {
    const tr = P.track, R = this.race;
    const s = Math.min(P.s, tr.length - 1);
    const hw = tr.halfWAt(s);
    const lim = world.limits(tr, s, P.x);
    const field = Math.max(1, R.rivals.length);
    const PG = P.track.base + P.s;
    const others = R.rivals.filter((r) => !r.out && r !== self);
    if (self) others.push({ G: this.player.track.base + this.player.s, x: this.player.x, v: this.player.v });
    let place = 1;
    for (const o of others) if (o.G > PG) place++;
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
      R.rivals.length ? (place - 1) / field : 0,
      self ? 0 : (R.passNitro || 0) / 8,
    ];
    // the road ahead: how hard it bends, and how much room the car will have either side if it keeps its line
    for (const d of LOOK) {
      // the road carries on into the next district at the end of this one
      let t = tr, sa = s + d;
      if (sa > tr.length - 1 && tr.children) { t = tr.children[0]; sa -= tr.length; }
      sa = Math.min(sa, t.length - 1);
      const la = world.limits(t, sa, P.x);
      obs.push(t.kAt(sa) * 150, (P.x - la.lSoft) / 10, (la.rSoft - P.x) / 10);
    }
    // the nearest rivals: there or not, how far along, how far across, how much faster (an empty slot is all zeros)
    const ahead = [], behind = [];
    for (const r of others) {
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
    // road works: how far to the start (0 when none ahead), whether inside, how far to the end, and where the opposite
    // carriageway starts across the kerb, which is the way out of the coned-off lane
    const z = contraAt(tr, s, 300);
    obs.push(z && s < z.s0 ? (z.s0 - s) / 300 : 0, z && s >= z.s0 ? 1 : 0, z && s >= z.s0 ? (z.s1 - s) / 300 : 0, lim.near ? (lim.near - P.x) / 10 : 0);
    // the next knockout gate on The Run: how far off (1 when out of sight), its cut, how far past the cut this car is
    // (above 0 is out), and that this is The Run. All zeros on a circuit.
    const ko = R.kind === 'run' && !self ? R.nextKnockout() : null;
    obs.push(ko ? (ko.d == null ? 1 : clamp(ko.d / 3000, 0, 1)) : 0, ko ? ko.cut / RUN_FIELD : 0, ko ? (place - ko.cut) / RUN_FIELD : 0, R.kind === 'run' && !self ? 1 : 0);
    return obs;
  }

  info() {
    const P = this.player, tr = P.track, R = this.race;
    return {
      ...(this.detail && {
        rivals: R.rivals.map((r) => ({ name: r.name, learned: !!r.brain, finish: r.finishT, offroad: r.brain?.off, scrape: r.brain?.scrape, G: r.G })),
      }),
      district: this.district,
      stage: tr.stageId,
      time: this.time,
      progress: clamp((tr.base + P.s - this.startG) / (this.goalG - this.startG), 0, 1),
      ...(this.mode === 'run' && { out: R.finished?.out || false, gates: this.gates.map((g) => ({ ...g })) }),
      laps: this.lapTimes.slice(),
      position: R.rivals.length ? R.position : 1,
      field: R.rivals.length ? R.field : 1,
      passed: this.passed,
      hits: this.hits,
      offroad: this.offroadTime,
      wrong_way: this.wrongTime,
      coned: this.conedTime,
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
