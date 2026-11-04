// Rivals driven by a trained network instead of the scripted driver (race.js driveRivals). Used by the game and by the
// headless sim (sim/env.mjs), so what is measured there is what runs here.
//
// Each learned rival is a real Player, the same driving model you have, held to the pace its scripted self would run
// (so it is as beatable) and with no nitro. Its rival entry in Race stays the truth the rest of the race reads (contact,
// standings, passes, knockouts, the other rivals): the car takes its place from the entry before each step and writes
// it back after. It decides 15 times a second and holds the decision between, whatever the frame rate.
//
//   new LearnedRivals(race, brain, { count: 5 }).attach()

import { Player, NITRO_MAX } from './player.js';
import { contraAt } from '../world/contra.js';
import { RUN_FIELD } from '../world/stages.js';
import { clamp, damp } from '../core/util.js';

// the sports coupe; every car drives the same (src/game/cars.js), only size and sound differ
export const CAR = { id: 'supra', top: 275, accel: 1.0, grip: 0.92, width: 1.81, length: 4.52 };
// how far ahead the driver reads the road, in metres
export const LOOK = [10, 25, 45, 70, 100, 140, 190, 250];
// how many rivals the driver sees: the nearest ones ahead, and behind
export const SEE_AHEAD = 4, SEE_BEHIND = 2;
const SEE_AHEAD_M = 150, SEE_BEHIND_M = 40;
export const OBS_SIZE = 12 + LOOK.length * 3 + (SEE_AHEAD + SEE_BEHIND) * 4 + 4 + 4;

const ROLL_V = 22; // the rolling start (race.js)
const DECIDE = 1 / 15; // seconds between decisions
const LANE_SHIFT = 0.5; // how much of a scripted rival's lane bias the learned ones keep

// everything a car sees, scaled to roughly -1..1: P is its Player, self its rival entry (the human player has none, and
// the rivals see the player as one more car). The same numbers the network trained on (ml/outrun_env.py).
export function observe(race, world, P, self) {
  const tr = P.track, R = race, human = R.game.player;
  const s = Math.min(P.s, tr.length - 1);
  const hw = tr.halfWAt(s);
  const lim = world.limits(tr, s, P.x);
  const field = Math.max(1, R.rivals.length);
  const PG = tr.base + P.s;
  const others = R.rivals.filter((r) => !r.out && r !== self);
  if (self) others.push({ G: human.track.base + human.s, x: human.x, v: human.v });
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
  // (above 0 is out), and that this is The Run. All zeros on a circuit, and for the rivals.
  const ko = R.kind === 'run' && !self ? R.nextKnockout() : null;
  obs.push(ko ? (ko.d == null ? 1 : clamp(ko.d / 3000, 0, 1)) : 0, ko ? ko.cut / RUN_FIELD : 0, ko ? (place - ko.cut) / RUN_FIELD : 0, R.kind === 'run' && !self ? 1 : 0);
  return obs;
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

export class LearnedRivals {
  // opts.count: how many of the front-running rivals (the leader first) are learned
  // opts.pace: their pace against the scripted skill it is copied from (default: 1 on a circuit, 0.97 in The Run). A
  //   whole field of learned cars is tougher than the scripted one (no leash, bends at the grip limit); a little under
  //   gives The Run the same gate margins.
  constructor(race, brain, opts = {}) {
    this.race = race;
    this.brain = brain;
    this.count = opts.count ?? 5;
    this.pace = opts.pace ?? null;
  }

  get world() { return this.race.game.world; }

  // take over the race's rival driving: the scripted driver moves the rest and sees the learned ones
  attach() {
    const R = this.race;
    const scripted = R.driveRivals.bind(R);
    const start = R.start.bind(R);
    R.start = (kind) => { start(kind); this.begin(); };
    R.driveRivals = (dt, go) => {
      const all = R.rivals;
      R.rivals = all.filter((r) => !r.brain);
      R._all = all;
      scripted(dt, go);
      R.rivals = all;
      for (const r of all) if (r.brain && !r.out) this.drive(r, dt, go);
      for (let i = 0; i < all.length; i++) {
        const a = all[i];
        if (!a.brain || a.out) continue;
        for (let j = 0; j < all.length; j++) {
          const b = all[j];
          if (b !== a && !b.out && !(b.brain && j < i)) shove(a, b);
        }
      }
      for (const r of all) if (r.brain && !r.out) this.show(r, dt);
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
    if (R.active) this.begin();
    return this;
  }

  // a new race: the front-runners get cars
  begin() {
    const R = this.race, tr = R.game.player.track;
    this.p = this.pace ?? (R.kind === 'run' ? 0.97 : 1);
    R.rivals.forEach((r, i) => {
      if (i >= this.count) { r.brain = null; return; }
      const P = new Player({ ...CAR, width: r.w * 2, length: r.l * 2 });
      P.reset(tr);
      P.nitro = 0;
      // (staggered, so the decisions do not all land on one frame)
      r.brain = { P, act: [0, 0, 0], off: 0, scrape: 0, still: 0, rescue: 0, t: (i % 4) / 60 };
    });
  }

  // the network steers for the middle of what it sees, so each rival is shown a road shifted sideways by where it means
  // to run: its own lane across the straights and, when it makes a mistake, wide of the bend (as race.js's xT)
  shifted(obs, r, P) {
    const tr = P.track;
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

  // one step of one learned rival
  drive(r, dt, go) {
    const R = this.race, b = r.brain, P = b.P;
    const vmax = P.vmax;
    // the rolling start: hold the formation until GO, as the scripted rivals do
    if (!go) {
      r.v = ROLL_V; r.vx = 0; r.x = r.gx; r.G += ROLL_V * dt;
      return;
    }
    const end = R.endG();
    const L = R.locate(r.G);
    // the road is not loaded this far from the player (the leaders of The Run): they carry on at their pace
    let vT = r.done ? 26 : r.skill * vmax * this.p;
    if (!L) {
      r.v = clamp(r.v + clamp(vT - r.v, -18 * dt, 8 * dt), 0, vmax);
      r.G += r.v * dt;
      return;
    }
    // what a scripted rival does too (race.js driveRivals): a car right behind the player pushes to hold it off, and
    // now and then a driver runs wide in a bend and lifts for a second
    const gap = r.G - R.playerG();
    if (gap < 0 && gap > -200) vT *= 1 + 0.04 * (1 + gap / 200);
    r.mistakeT -= dt;
    r.slipT = Math.max(0, r.slipT - dt);
    if (r.mistakeT <= 0) {
      r.mistakeT = 5 + Math.random() * 9;
      const kA = Math.max(Math.abs(R.kAt(r.G + 30)), Math.abs(R.kAt(r.G + 70)));
      if (kA > 0.004 && Math.random() < 0.5) r.slipT = 1.1;
    }
    if (r.slipT > 0) vT *= 0.84;
    // the car takes its place from the entry
    const tr = L.tr;
    P.track = tr; P.s = L.s; P.x = r.x; P.v = r.v; P.vx = r.vx;
    b.t -= dt;
    if (b.t <= 1e-9) {
      b.act = this.brain.act(this.shifted(observe(R, this.world, P, r), r, P));
      b.t += DECIDE;
    }
    let [steer, pedal] = b.act;
    // a car pinned to a rail can stand there braking for ever (the network has never been at rest on the road to
    // learn otherwise): after a second stopped, drive it for four seconds, floored and steering for the middle
    b.still = P.v < 3 && !r.done ? b.still + dt : 0;
    if (b.still > 1) { b.rescue = 4; b.still = 0; }
    if (b.rescue > 0) {
      b.rescue -= dt;
      pedal = 1;
      steer = clamp(-P.x / tr.halfWAt(Math.min(P.s, tr.length - 1)), -1, 1);
    }
    const throttle = Math.min(Math.max(0, pedal), clamp((vT - P.v) * 0.5, 0, 1));
    const brake = Math.max(0, -pedal, r.done && P.v > 28 ? 0.6 : 0);
    P.update(dt, { steer, throttle, brake, boostHeld: false }, this.world);
    P.events.length = 0;
    b.off += P.offroad * dt;
    b.scrape += P.scrape * dt;
    r.G = tr.base + P.s; r.x = P.x; r.v = P.v; r.vx = P.vx;
    b.brake = brake > 0.5;
    if (!r.done && r.G >= end) r.done = true;
    // the roll-out after the flag ends at the end of the road
    if (r.G > end + 560) { r.G = end + 560; r.v = 0; }
  }

  // the rival's car on the road, for drawing
  show(r, dt) {
    const R = this.race;
    const L = R.locate(r.G);
    if (!L) return;
    const c = r.car;
    c.track = L.tr; c.s = r.G - L.tr.base; c.x = r.x;
    c.yaw = -r.vx * 0.03;
    c.roll = damp(c.roll, -r.vx * 0.01, 4, dt);
    c.brake = !!r.brain.brake;
    R.cars.push(c);
  }
}
