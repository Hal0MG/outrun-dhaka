// Races. Two kinds share one engine:
//  - circuit: one district, three laps, sixty cars on a rolling start, you start last
//  - run:     the whole city end to end, seventy-two cars; at each knockout
//             gate everyone below the cut-off is out, the last four race
//             across the Padma for the win
// Every car's progress is a distance G along the whole route (track.base + s),
// so the field can spread over several district tracks at once. Rivals are
// real cars for the whole race; contact and grass only ever cost speed. Coins,
// fuel cans and nitro lie on the road.

import * as THREE from 'three';
import { LANE_W } from '../world/track.js';
import { KNOCKOUTS, RUN_FIELD, ROUTE } from '../world/stages.js';
import { CORNER_K, NITRO_MAX } from './player.js';
import { contraAt } from '../world/contra.js';
import { oppLayout } from '../world/zones.js';
import { clamp, damp, RNG } from '../core/util.js';

// the field: the named front-runners first (RAJA, the champion, leads), then as many more as a race needs
const NAMES = ['RAJA', 'NAWAB', 'TURBO SHUMON', 'DJ PIASH', 'CAPTAIN RUBEL', 'RUMANA', 'ZIKO', 'CHAIRMAN’S SON', 'TONY OF UTTARA', 'NIPA',
  'POLASH', 'MOTU BHAI', 'FARHAN', 'JOLLY', 'KHOKON', 'BABLU', 'SHAKIL', 'PINKY', 'RONY', 'MITHU', 'SHUVO', 'ANIK', 'UNCLE FAISAL',
  'TANVIR', 'SHEFA', 'RAFI', 'MOUSUMI', 'JIBON', 'LIPI', 'TONMOY', 'BULBUL', 'HASAN', 'RIMA', 'SAJIB', 'NUSRAT', 'KAMAL', 'SOHEL', 'MAYA',
  'ARIF', 'DOLLY', 'ROKON', 'TUHIN', 'SHILPI', 'BAPPY', 'MARUF', 'JUI', 'SAGOR', 'TITLY', 'MILON', 'RUPA', 'IMRAN', 'SUMI', 'KALAM', 'NASIR',
  'TANIA', 'BADAL', 'SHAMIM', 'LUCKY', 'FAHIM', 'ROZINA', 'OPU', 'DIPA', 'HRIDOY', 'SABBIR', 'MOON', 'JAHID', 'PRITHU', 'RIPON', 'SATHI',
  'MASUD', 'NAYEEM', 'KONA', 'DULAL', 'SABINA', 'TAPOS'];
const MODELS = ['skyline', 'supra', 'celica', 'chaser', 'miata', 'premio', 'prado'];
const COLORS = ['#0b0b0f', '#e8e4da', '#ff6a00', '#ff2e88', '#1d4fd8', '#c8102e', '#6b6f78', '#111214', '#ffd200', '#22d3ee', '#2f8f4e', '#f2f2ee',
  '#7b2f9e', '#ffb000', '#b9bcc0', '#e4252b', '#0e7c86', '#ff7eb6', '#c0c4cc', '#7a1d22', '#3a7bd5', '#9acd32'];
export const RIVALS = Array.from({ length: 79 }, (_, i) => ({
  name: NAMES[i] || 'DRIVER ' + (i + 1),
  model: i === 0 ? 'skyline' : MODELS[(i * 3 + 1) % MODELS.length],
  color: COLORS[(i * 7 + (i > 22 ? 5 : 0)) % COLORS.length],
}));
// the leader's car is the black Skyline; the rest follow the order above
RIVALS[0].color = '#0b0b0f';

export const CIRCUIT_FIELD = 60;

// fuel: metres a full tank lasts, and how much a can puts back
// (a circuit tank lasts about a lap; passing cars is how you keep the tank topped up)
const TANK_RUN = 9000;
const CAN_FUEL = 0.25;
const PASS_FUEL = 0.05; // per car passed
const PASS_NITRO = 5; // cars passed per free nitro charge
const ROLL_V = 22; // the rolling start: everyone rolls at this speed until GO
const ROW_GAP = 11; // metres between grid rows
const GRID_AHEAD = 60; // the front row starts this far behind the line
const VIEW = 420;

export class Race {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.rivals = [];
    this.pickups = [];
    this.cars = [];
    this.buildMeshes(game.scene);
  }

  // ------------------------------------------------------------ setup
  start(kind) {
    const g = this.game;
    const P = g.player;
    const tr = P.track;
    this.kind = kind;
    this.first = tr;
    this.active = true;
    this.time = 0;
    this.lap = 1;
    this.lapT = 0;
    this.lapTimes = [];
    this.coins = 0;
    this.finished = null;
    this.field = kind === 'run' ? RUN_FIELD : CIRCUIT_FIELD;
    this.tank = kind === 'run' ? TANK_RUN : tr.lapLen * 1.1;
    this.passes = 0;
    this.passNitro = 0;
    this.wrongAcc = 0;
    // medal times for a circuit: a little over the time a perfect run at top speed would take
    if (kind === 'circuit') { const nom = (tr.goalS - tr.gateS) / P.vmax; this.par = [nom * 1.07, nom * 1.13, nom * 1.22]; } else this.par = null;
    // a rolling start: staggered rows across the road behind the line, everyone already moving; the last slot is yours
    const n = this.field - 1;
    const lanes = Math.max(2, Math.min(5, Math.round(tr.lanesAt(tr.gateS))));
    const hwG = tr.halfWAt(tr.gateS);
    const slotS = (slot) => tr.gateS - GRID_AHEAD - Math.floor(slot / lanes) * ROW_GAP;
    const slotX = (slot) => {
      const row = Math.floor(slot / lanes), lane = (slot + (row % 2)) % lanes;
      return -hwG + LANE_W * (lane + 0.5) + (row % 2 ? 0.5 : -0.5);
    };
    P.s = slotS(n);
    P.x = slotX(n);
    P.v = ROLL_V;
    P.vx = 0;
    this.rivals = RIVALS.slice(0, n).map((d, i) => {
      const md = g.fleet.md(d.model);
      return {
        ...d, i, G: slotS(i), x: slotX(i), gx: slotX(i), v: ROLL_V, vx: 0, out: false, done: false, ready: true,
        // the front-runners match your top speed (nitro and clean lines to catch them); the field thins
        // toward the back of the grid, where the cars are easy: a challenge the whole way, not a rush then a wall
        skill: (kind === 'run' ? 1.005 : 0.995) - 0.17 * Math.pow(i / n, 1.6), bias: ((i * 7) % 5 - 2) * 0.32, dodge: null, dodgeT: 0,
        w: md.wid / 2, l: md.len / 2,
        car: { model: d.model, md, track: null, s: 0, x: 0, yaw: 0, roll: 0, color: new THREE.Color(d.color), brake: false },
      };
    });
    this.position = this.field;
    this.pickups = [];
    if (kind === 'circuit') { this.layCircuit(tr); g.stalls.stock(tr); }
  }

  stop() {
    this.active = false;
    this.rivals = [];
    this.pickups = [];
    this.cars = [];
    for (const m of Object.values(this.meshes)) m.count = 0;
  }

  // ------------------------------------------------------------ where things are
  playerG() { const P = this.game.player; return P.track.base + P.s; }

  // the loaded track holding route distance G, and s on it
  locate(G) {
    const P = this.game.player;
    const cur = P.track;
    const next = cur.chosen || (cur.children && cur.children[0]);
    for (const tr of [cur, next, cur.parent]) {
      if (!tr) continue;
      const s = G - tr.base;
      if (s >= 0 && (s < tr.length || (tr.isFinal && s < tr.length + 600))) return this._loc = { tr, s };
    }
    return null;
  }

  kAt(G) {
    const L = this.locate(G);
    return L ? L.tr.kAt(Math.min(L.s, L.tr.length)) : 0;
  }

  // ------------------------------------------------------------ pickups
  // coin trails, fuel cans and nitro; on a circuit every lap gets the same pattern
  layCircuit(tr) {
    const rng = new RNG(4242);
    const lapLen = tr.lapLen;
    const pattern = [];
    // fuel and nitro come in rows across the whole road (a fuel row and two nitro rows a lap; passing cars earns the rest),
    // so you never have to hug a side to catch them
    const special = [[0.25, 'nitro'], [0.5, 'fuel'], [0.75, 'nitro']];
    for (let u = 70; u < lapLen - 60; u += rng.range(95, 150)) {
      if (special.some(([f]) => Math.abs(u - f * lapLen) < 60)) continue;
      if (rng.chance(0.62)) pattern.push({ u, kind: 'trail', a: rng.next(), b: rng.next() });
    }
    for (const [f, kind] of special) pattern.push({ u: f * lapLen, kind, a: rng.next() });
    for (let i = 0; i < tr.laps; i++) for (const p of pattern) this.place(tr, tr.lapS(i) + p.u, p.kind, p.a, p.b);
    this.pickups.sort((a, b) => a.G - b.G);
  }

  // on the Run, each district's road is stocked when it first loads
  layTrack(tr) {
    tr.stocked = true;
    this.game.stalls.stock(tr);
    const rng = new RNG(tr.base | 0);
    const s0 = tr.isFirst ? tr.gateS + 60 : 60;
    const s1 = (tr.isFinal ? tr.goalS : tr.length) - 40;
    for (let s = s0; s < s1; s += rng.range(95, 150)) {
      const G = tr.base + s;
      const fuel = Math.floor(G / 3500) !== Math.floor((G - 200) / 3500);
      const nitro = Math.floor((G + 400) / 2200) !== Math.floor((G + 200) / 2200);
      if (fuel) this.place(tr, s, 'fuel', rng.next());
      else if (nitro) this.place(tr, s, 'nitro', rng.next());
      else if (rng.chance(0.62)) this.place(tr, s, 'trail', rng.next(), rng.next());
    }
    this.pickups.sort((a, b) => a.G - b.G);
  }

  place(tr, s, kind, a, b) {
    const lanes = Math.max(1, Math.round(tr.lanesAt(s)));
    const hw = tr.halfWAt(s);
    const lx = (f) => -hw + LANE_W * (Math.min(lanes - 1, Math.floor(f * lanes)) + 0.5);
    if (kind !== 'trail') {
      for (let l = 0; l < lanes; l++) this.pickups.push({ tr, s, G: tr.base + s, x: -hw + LANE_W * (l + 0.5), kind, taken: false });
      return;
    }
    // a trail of coins drifting across a lane or two
    const xa = lx(a), xb = clamp(xa + (b < 0.33 ? -LANE_W : b > 0.66 ? LANE_W : 0), -hw + LANE_W / 2, hw - LANE_W / 2);
    for (let k = 0; k < 7; k++) this.pickups.push({ tr, s: s + k * 5.5, G: tr.base + s + k * 5.5, x: xa + (xb - xa) * (k / 6), kind: 'coin', taken: false });
  }

  buildMeshes(scene) {
    const mk = (geo, color, n) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color, fog: true }), n);
      m.count = 0;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
      return m;
    };
    this.meshes = {
      coin: mk(new THREE.CylinderGeometry(0.55, 0.55, 0.14, 20).rotateX(Math.PI / 2), new THREE.Color(2.2, 1.5, 0.25), 200),
      fuel: mk(new THREE.BoxGeometry(0.9, 1.1, 0.5), new THREE.Color(1.9, 0.18, 0.12), 64),
      cap: mk(new THREE.CylinderGeometry(0.12, 0.12, 0.25, 8).translate(0.28, 0.66, 0), new THREE.Color(2.2, 1.9, 0.3), 64),
      nitro: mk(new THREE.OctahedronGeometry(0.75), new THREE.Color(0.35, 1.6, 2.4), 64),
    };
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._one = new THREE.Vector3(1, 1, 1);
  }

  // ------------------------------------------------------------ per frame
  update(dt) {
    if (!this.active) return;
    const g = this.game;
    const P = g.player;
    const racing = g.state === 'race';
    if (this.kind === 'run') {
      for (const tr of [P.track, P.track.chosen || P.track.children?.[0]]) if (tr && !tr.stocked) this.layTrack(tr);
    }
    if (racing) {
      this.time += dt;
      this.lapT += dt;
      P.fuel = Math.max(0, P.fuel - (P.v * dt) / this.tank);
    }
    this.driveRivals(dt, racing || g.state === 'goal' || g.state === 'gameover');
    this.contact();
    this.collect();
    if (racing) { this.awardPasses(); this.wrongWayReward(dt); }
    this.standings();
    if (racing && !this.finished) this.rules();
  }

  rules() {
    const g = this.game;
    const P = g.player;
    const tr = P.track;
    const result = (extra) => ({ kind: this.kind, pos: this.position, field: this.field, time: this.time, par: this.par, laps: this.lapTimes.slice(), coins: this.coins, reached: tr.stage, ...extra });
    if (this.kind === 'circuit') {
      const lapNow = clamp(Math.floor((P.s - tr.gateS) / tr.lapLen) + 1, 1, tr.laps + 1);
      if (lapNow > this.lap) {
        this.lapTimes.push(this.lapT);
        this.lapT = 0;
        this.lap = lapNow;
        if (lapNow <= tr.laps) g.onLap?.(lapNow, tr.laps);
      }
    } else if (!tr.isFirst && !tr.koDone && P.s >= tr.gateS && KNOCKOUTS[tr.stageId]) {
      // a knockout gate: below the cut-off you are out, and so is everyone else down there
      tr.koDone = true;
      const cut = KNOCKOUTS[tr.stageId];
      if (this.position > cut) {
        this.finished = result({ out: 'knockout', cut });
        g.onFinish?.(this.finished);
        return;
      }
      const alive = this.rivals.filter((r) => !r.out).sort((a, b) => b.G - a.G);
      let knocked = 0;
      alive.forEach((r, i) => { const rank = i + 1 + (this.playerG() > r.G ? 1 : 0); if (rank > cut) { r.out = true; knocked++; } });
      this.field = cut;
      g.onKnockout?.(cut, knocked);
    }
    if (tr.isFinal && P.s >= tr.goalS) {
      this.finished = result({ out: false });
      g.onFinish?.(this.finished);
    } else if (P.fuel <= 0 && P.v < 1.5) {
      this.finished = result({ out: 'fuel' });
      g.onFinish?.(this.finished);
    }
  }

  // racing-line AI: chase a pace set off your top speed, take the inside of
  // the next bend, go round slower cars, ease off when far ahead of you
  driveRivals(dt, go) {
    const P = this.game.player;
    const PG = this.playerG();
    const vRef = P.vmax;
    const end = this.endG();
    this.cars.length = 0;
    for (const r of this.rivals) {
      if (r.out) continue;
      const L = this.locate(r.G);
      const tr = L && L.tr;
      const hw = tr ? tr.halfWAt(Math.min(L.s, tr.length)) : 6;
      // pace
      let vT = vRef * r.skill;
      const kA = Math.max(Math.abs(this.kAt(r.G + 30)), Math.abs(this.kAt(r.G + 70)));
      // take bends at a little under what the car's own grip can hold (the same grip you have)
      if (kA > 1e-4) vT = Math.min(vT, Math.sqrt((P.steerGrip * 0.93) / (kA * CORNER_K)));
      // keep the pack in reach (gently)
      const gap = r.G - PG;
      if (gap > 300) vT *= Math.max(0.86, 1 - (gap - 300) / 2500);
      else if (gap < -300) vT *= Math.min(1.07, 1 + (-gap - 300) / 3000);
      if (r.done) vT = Math.min(vT, 26);
      if (!go) vT = ROLL_V; // the rolling start: hold formation until GO
      // the inside of the next bend, else the rival's own lane
      const kIn = this.kAt(r.G + 55);
      const bend = clamp(Math.abs(kIn) / 0.009, 0, 1);
      let xT = -Math.sign(kIn) * bend * (hw - 2.4) + r.bias * hw * (1 - bend);
      // a car in front: go round it or sit behind it
      r.dodgeT -= dt;
      const ahead = this.blockerAhead(r, 4 + Math.max(0, r.v - 20) * 0.35);
      if (ahead) {
        if (r.v > ahead.v + 1 && r.dodgeT <= 0) {
          const left = ahead.x - 3.3, right = ahead.x + 3.3;
          const okL = left > -hw + 1.2, okR = right < hw - 1.2;
          r.dodge = okL && okR ? (Math.abs(left - r.x) < Math.abs(right - r.x) ? left : right) : okL ? left : okR ? right : null;
          r.dodgeT = 1.2;
        }
        if (r.dodge == null || Math.abs(r.x - ahead.x) < 1.9) vT = Math.min(vT, ahead.v + (ahead.d > 9 ? 2 : -1));
      }
      if (r.dodgeT > 0 && r.dodge != null) xT = r.dodge;
      // road works on our side: the field takes the opposite carriageway; on a divided road the rival can use all of it
      let reach = hw;
      if (tr && this.game.world.sideTypeAt(tr, Math.min(L.s, tr.length), 1) === 'median') {
        const o = oppLayout(tr, Math.min(L.s, tr.length), tr.stage);
        reach = o.far;
        if (go && (contraAt(tr, L.s, 170))) {
          const lanes = Math.max(1, tr.stage.lanes);
          xT = o.near + LANE_W * ((r.i % lanes) + 0.5);
          r.dodge = null;
        }
      }
      xT = clamp(xT, -hw + 1.1, reach - 1.1);
      if (!go) xT = r.gx;
      // move
      const t = r.v / Math.max(1, vRef);
      const acc = vT > r.v ? 26 * (1 - t) + 5 : -18; // the same launch as your car
      r.v = clamp(r.v + clamp(vT - r.v, -18 * dt, acc * dt), 0, vRef * 1.1);
      r.vx = damp(r.vx, clamp((xT - r.x) * 1.4, -9, 9), 5, dt);
      r.x += r.vx * dt;
      r.G += r.v * dt;
      if (!r.done && r.G >= end) r.done = true;
      // the roll-out after the flag ends at the end of the road
      if (r.G > end + 560) { r.G = end + 560; r.v = 0; }
      if (tr) {
        const c = r.car;
        c.track = tr; c.s = r.G - tr.base; c.x = r.x;
        c.yaw = -r.vx * 0.03;
        c.roll = damp(c.roll, -r.vx * 0.01, 4, dt);
        // brake lights only on a real stop-down, not every little lift in the pack
        c.brake = vT < r.v - 8;
        this.cars.push(c);
      }
    }
    // nobody drives through anybody: overlapping rivals push apart
    const all = this.rivals;
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      if (a.out) continue;
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j];
        if (b.out) continue;
        const ds = b.G - a.G, dx = b.x - a.x;
        const wl = a.l + b.l, ww = a.w + b.w;
        if (Math.abs(ds) > wl || Math.abs(dx) > ww) continue;
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
    }
  }

  // where the race ends, as route distance
  endG() {
    if (this.kind === 'circuit') return this.first.goalS;
    const P = this.game.player;
    return P.track.isFinal ? P.track.base + P.track.goalS : Infinity;
  }

  // the nearest car (rival or you) in this rival's path
  blockerAhead(r, range) {
    const P = this.game.player;
    let best = null;
    const test = (G, x, v) => {
      const d = G - r.G;
      if (d <= 0 || d > range + 6 || Math.abs(x - r.x) > 2.4) return;
      if (!best || d < best.d) best = { d, x, v };
    };
    for (const o of this.rivals) if (o !== r && !o.out) test(o.G, o.x, o.v);
    test(this.playerG(), P.x, P.v);
    return best;
  }

  // you against a rival: bumps and shoves, never a wreck
  contact() {
    const P = this.game.player;
    const PG = this.playerG();
    const pw = P.halfW * 0.92, pl = P.halfL * 0.92;
    for (const r of this.rivals) {
      if (r.out) continue;
      const ds = r.G - PG, dx = r.x - P.x;
      const os = r.l + pl - Math.abs(ds), ox = r.w + pw - Math.abs(dx);
      if (os <= 0 || ox <= 0) continue;
      if (os < ox) {
        if (ds > 0) {
          // into the back of them: you lose the speed difference and then some
          const rel = P.v - r.v;
          P.v = Math.max(0, r.v - Math.min(8, Math.max(0, rel) * 0.2));
          P.s = r.G - P.track.base - r.l - pl - 0.05;
          r.v += Math.max(0, rel) * 0.25;
          if (rel > 3) P.emit('hit', { hard: rel > 14 });
        } else {
          // they ran into you
          const rel = r.v - P.v;
          r.v = P.v * 0.92;
          r.G = PG - pl - r.l - 0.05;
          P.v += Math.max(0, rel) * 0.15;
          if (rel > 3) P.emit('hit', {});
        }
      } else {
        const push = Math.sign(dx || 1);
        P.x -= push * ox * 0.6;
        r.x += push * ox * 0.4;
        P.vx = -push * 4;
        r.vx = push * 3;
        P.v *= 0.985;
        P.emit('hit', { side: true });
      }
    }
  }

  collect() {
    const g = this.game;
    const P = g.player;
    const PG = this.playerG();
    const rs = P.halfL + 0.7, rx = P.halfW + 0.6;
    for (const p of this.pickups) {
      if (p.G < PG - 8) continue;
      if (p.G > PG + 8) break;
      if (p.taken || Math.abs(p.G - PG) > rs || Math.abs(p.x - P.x) > rx) continue;
      p.taken = true;
      if (p.kind === 'coin') this.coins++;
      else if (p.kind === 'fuel') P.fuel = Math.min(1, P.fuel + CAN_FUEL);
      else if (p.kind === 'nitro') P.nitro = Math.min(NITRO_MAX, P.nitro + 1);
      g.onPickup?.(p);
    }
  }

  // driving the opposite carriageway pays: fuel as you go and a nitro charge every few seconds
  wrongWayReward(dt) {
    const g = this.game;
    const P = g.player;
    if (!P.wrongWay || P.v < 25) return;
    P.fuel = Math.min(1, P.fuel + 0.02 * dt);
    this.wrongAcc = (this.wrongAcc || 0) + dt;
    if (this.wrongAcc >= 2.2) {
      this.wrongAcc -= 2.2;
      const got = P.nitro < NITRO_MAX;
      if (got) P.nitro += 1;
      g.onWrongWay?.(got);
    }
  }

  // every car you pass tops up the tank, and every few passes earn a nitro charge. A rival counts again
  // only once they have pulled well clear of you, so swapping places with the same car is no way to farm fuel.
  awardPasses() {
    const g = this.game;
    const P = g.player;
    const PG = this.playerG();
    let n = 0;
    for (const r of this.rivals) {
      if (r.out) continue;
      const d = r.G - PG;
      if (d > 70) r.ready = true;
      else if (d < -10 && r.ready) { r.ready = false; n++; }
    }
    if (!n) return;
    this.passes += n;
    P.fuel = Math.min(1, P.fuel + PASS_FUEL * n);
    this.passNitro = (this.passNitro || 0) + n;
    let nitro = 0;
    while (this.passNitro >= PASS_NITRO) { this.passNitro -= PASS_NITRO; if (P.nitro < NITRO_MAX) { P.nitro += 1; nitro++; } }
    g.onPass?.(n, nitro);
  }

  standings() {
    const PG = this.playerG();
    let ahead = 0;
    for (const r of this.rivals) if (!r.out && r.G > PG) ahead++;
    const pos = ahead + 1;
    if (pos !== this.position) {
      const prev = this.position;
      this.position = pos;
      if (this.game.state === 'race') this.game.onPosition?.(pos, prev);
    }
  }

  // the rival directly ahead of / behind you, with the gap in seconds
  neighbours() {
    const P = this.game.player;
    const PG = this.playerG();
    let a = null, b = null;
    for (const r of this.rivals) {
      if (r.out) continue;
      const d = r.G - PG;
      if (d > 0 && (!a || d < a.d)) a = { r, d };
      if (d <= 0 && (!b || d > b.d)) b = { r, d };
    }
    const v = Math.max(20, P.v);
    return { ahead: a && { name: a.r.name, t: a.d / v }, behind: b && { name: b.r.name, t: -b.d / v } };
  }

  nearest() {
    const P = this.game.player;
    const PG = this.playerG();
    let best = null;
    for (const r of this.rivals) {
      if (r.out) continue;
      const d = Math.hypot(r.G - PG, r.x - P.x);
      if (d < 45 && (!best || d < best.d)) best = { d, v: r.v, pan: (r.x - P.x) / 8 };
    }
    return best;
  }

  // the next knockout gate on the Run: its district, cut-off, and distance once its road is loaded
  nextKnockout() {
    if (this.kind !== 'run') return null;
    const P = this.game.player;
    const here = ROUTE.indexOf(P.track.stageId);
    for (let i = here; i < ROUTE.length; i++) {
      const id = ROUTE[i];
      if (!KNOCKOUTS[id] || i === 0 || (i === here && P.track.koDone)) continue;
      const next = P.track.chosen || P.track.children?.[0];
      const tr = i === here ? P.track : next && next.stageId === id ? next : null;
      return { cut: KNOCKOUTS[id], at: id, d: tr ? tr.base + tr.gateS - this.playerG() : null };
    }
    return null;
  }

  // name tags over the next couple of cars ahead
  tags(cam) {
    const PG = this.playerG();
    const W = window.innerWidth, H = window.innerHeight;
    const v = this._tagV || (this._tagV = new THREE.Vector3());
    const order = this.rivals.filter((r) => !r.out).sort((a, b) => b.G - a.G);
    const list = [];
    order.forEach((r, i) => {
      const rel = r.G - PG;
      if (rel < 4 || rel > 160 || !r.car.track) return;
      r.car.track.point(r.car.s, r.x, r.car.md.hgt + 0.5, v);
      v.project(cam);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) return;
      list.push({ x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, name: r.name, pos: i + 1, boss: r.i === 0, a: rel < 120 ? 1 : (160 - rel) / 40 });
    });
    return list.slice(-2);
  }

  // ------------------------------------------------------------ drawing
  render(time) {
    const counts = { coin: 0, fuel: 0, cap: 0, nitro: 0 };
    const M = this.meshes;
    if (this.active) {
      const PG = this.playerG();
      const tracks = this.game.world.tracks;
      const m = this._m, q = this._q, e = this._e, p = this._p;
      for (const pk of this.pickups) {
        if (pk.G < PG - 6) continue;
        if (pk.G > PG + VIEW) break;
        if (pk.taken || !tracks.has(pk.tr.id)) continue;
        const tr = pk.tr;
        tr.point(pk.s, pk.x, (pk.kind === 'coin' ? 1.0 : 0.85) + Math.sin(time * 3 + pk.s * 0.2) * 0.12, p);
        const spin = pk.kind === 'fuel' ? Math.sin(time * 2 + pk.s) * 0.5 : time * 3.2 + pk.s * 0.3;
        e.set(0, -tr.yawAt(pk.s) + spin, 0, 'YXZ');
        q.setFromEuler(e);
        m.compose(p, q, this._one);
        const put = (key) => { if (counts[key] < M[key].instanceMatrix.count) M[key].setMatrixAt(counts[key]++, m); };
        put(pk.kind);
        if (pk.kind === 'fuel') put('cap');
      }
    }
    for (const key in M) {
      M[key].count = counts[key];
      M[key].instanceMatrix.needsUpdate = true;
    }
  }
}
