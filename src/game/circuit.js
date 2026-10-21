// THE CIRCUIT: a Horizon Chase-style lap race. Nineteen rivals on the road at
// once, you start last, three laps. Coins and fuel cans lie on the racing line,
// nitro pickups refill a charge, and contact only ever costs speed.
// Rivals are real cars for the whole race (drawn through traffic.js's instanced
// meshes, driven here); there is no other traffic.

import * as THREE from 'three';
import { LANE_W } from '../world/track.js';
import { RIVALS } from './race.js';
import { CORNER_K, NITRO_MAX } from './hctplayer.js';
import { clamp, damp, RNG } from '../core/util.js';

export const CIRCUIT_FIELD = 20;
const RIVAL_T = { models: ['supra'], speed: [0, 0], lanes: 'any', weave: 0, honkDodge: 0 };
// fuel: a full tank lasts this many laps; cans put back this much
const TANK_LAPS = 2;
const CAN_FUEL = 0.36;
const VIEW = 420;

export class Circuit {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.rivals = [];
    this.pickups = [];
    this.buildMeshes(game.scene);
  }

  // ------------------------------------------------------------ setup
  start() {
    const g = this.game;
    const P = g.player;
    const tr = P.track;
    this.track = tr;
    this.active = true;
    this.time = 0;
    this.lap = 1;
    this.lapT = 0;
    this.lapTimes = [];
    this.coins = 0;
    this.finished = null;
    this.finishOrder = [];
    g.traffic.clear();
    // two-wide grid behind the line, pole at the front; the last slot is yours
    const slotS = (slot) => tr.gateS - 6 - Math.floor(slot / 2) * 9;
    const slotX = (slot) => (slot % 2 ? 1 : -1) * LANE_W * 0.7;
    P.s = slotS(CIRCUIT_FIELD - 1) - 2.5; // a nose behind your row-mate: you start last
    P.x = slotX(CIRCUIT_FIELD - 1);
    P.v = 0;
    P.vx = 0;
    const field = RIVALS.slice(0, CIRCUIT_FIELD - 1);
    this.rivals = field.map((d, i) => {
      const r = {
        ...d, i, s: slotS(i), x: slotX(i), v: 0, vx: 0,
        skill: 1.0 - i * 0.0085, bias: ((i * 7) % 5 - 2) * 0.32, dodge: 0, dodgeT: 0, done: false,
      };
      const veh = g.traffic.spawn(tr, r.s, { T: RIVAL_T, type: 'rival', model: d.model, lane: 0, x: r.x, speed: 0, force: true, anyLane: true, color: new THREE.Color(d.color) });
      r.veh = veh;
      if (veh) veh.rival = r;
      return r;
    });
    this.position = CIRCUIT_FIELD;
    this.layPickups(tr);
  }

  stop() {
    this.active = false;
    this.rivals = [];
    this.pickups = [];
    this.game.traffic.clear();
    for (const m of Object.values(this.meshes)) m.count = 0;
  }

  // coin trails, two fuel cans and a nitro per lap, the same on every lap
  layPickups(tr) {
    const rng = new RNG(4242);
    const lapLen = tr.lapLen;
    const pattern = [];
    const lx = (l) => -tr.halfWAt(0) + LANE_W * (l + 0.5);
    const special = [[0.3, 'fuel'], [0.52, 'nitro'], [0.78, 'fuel']];
    for (let u = 70; u < lapLen - 60; u += rng.range(95, 150)) {
      if (special.some(([f]) => Math.abs(u - f * lapLen) < 60)) continue;
      if (!rng.chance(0.62)) continue;
      // a trail of coins drifting across a lane or two
      const a = rng.int(0, 2), b = clamp(a + rng.int(-1, 1), 0, 2);
      for (let k = 0; k < 7; k++) pattern.push({ u: u + k * 5.5, x: lx(a) + (lx(b) - lx(a)) * (k / 6), kind: 'coin' });
    }
    for (const [f, kind] of special) pattern.push({ u: f * lapLen, x: lx(rng.int(0, 2)), kind });
    this.pickups = [];
    for (let i = 0; i < tr.laps; i++) {
      for (const p of pattern) this.pickups.push({ s: tr.lapS(i) + p.u, x: p.x, kind: p.kind, taken: false });
    }
    this.pickups.sort((a, b) => a.s - b.s);
  }

  buildMeshes(scene) {
    const mk = (geo, color, n) => {
      const mat = new THREE.MeshBasicMaterial({ color, fog: true });
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.count = 0;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
      return m;
    };
    const coin = new THREE.CylinderGeometry(0.55, 0.55, 0.14, 20).rotateX(Math.PI / 2);
    const can = new THREE.BoxGeometry(0.9, 1.1, 0.5);
    const cap = new THREE.CylinderGeometry(0.12, 0.12, 0.25, 8).translate(0.28, 0.66, 0);
    const gem = new THREE.OctahedronGeometry(0.75);
    this.meshes = {
      coin: mk(coin, new THREE.Color(2.2, 1.5, 0.25), 200),
      fuel: mk(can, new THREE.Color(1.9, 0.18, 0.12), 16),
      cap: mk(cap, new THREE.Color(2.2, 1.9, 0.3), 16),
      nitro: mk(gem, new THREE.Color(0.35, 1.6, 2.4), 16),
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
    const tr = this.track;
    const racing = g.state === 'race';
    if (racing) {
      this.time += dt;
      this.lapT += dt;
      P.fuel = Math.max(0, P.fuel - (P.v * dt) / (tr.lapLen * TANK_LAPS));
    }
    this.driveRivals(dt, racing || g.state === 'goal' || g.state === 'gameover');
    this.contact(dt);
    this.collect();
    this.standings();
    // laps
    if (racing && !this.finished) {
      const lapNow = clamp(Math.floor((P.s - tr.gateS) / tr.lapLen) + 1, 1, tr.laps + 1);
      if (lapNow > this.lap) {
        this.lapTimes.push(this.lapT);
        this.lapT = 0;
        this.lap = lapNow;
        if (lapNow <= tr.laps) g.onCircuitLap?.(lapNow, tr.laps);
      }
      if (P.s >= tr.goalS) {
        this.finished = { pos: this.position, time: this.time, laps: this.lapTimes.slice(), coins: this.coins, out: false };
        g.onCircuitFinish?.(this.finished);
      } else if (P.fuel <= 0 && P.v < 1.5) {
        this.finished = { pos: this.position, time: this.time, laps: this.lapTimes.slice(), coins: this.coins, out: true };
        g.onCircuitFinish?.(this.finished);
      }
    }
  }

  // racing-line AI: chase a pace set off your top speed, take the inside of
  // the next bend, go round slower cars, ease off when far ahead of you
  driveRivals(dt, go) {
    const g = this.game;
    const P = g.player;
    const tr = this.track;
    const all = this.rivals;
    const vRef = P.vmax;
    for (const r of all) {
      const sNow = clamp(r.s, 0, tr.length);
      const hw = tr.halfWAt(sNow);
      // pace
      let vT = vRef * r.skill;
      const kA = Math.max(Math.abs(tr.kAt(Math.min(r.s + 30, tr.length))), Math.abs(tr.kAt(Math.min(r.s + 70, tr.length))));
      if (kA > 1e-4) vT = Math.min(vT, Math.sqrt((15 * 0.97) / (kA * CORNER_K)));
      // keep the pack in reach (gently)
      const gap = r.s - P.s;
      if (gap > 450) vT *= Math.max(0.93, 1 - (gap - 450) / 4000);
      else if (gap < -300) vT *= Math.min(1.07, 1 + (-gap - 300) / 3000);
      if (r.done) vT = Math.min(vT, 26);
      if (!go) vT = 0;
      // the inside of the next bend, else the rival's own lane
      const kIn = tr.kAt(Math.min(r.s + 55, tr.length));
      const inside = -Math.sign(kIn) * clamp(Math.abs(kIn) / 0.009, 0, 1) * (hw - 2.4);
      let xT = inside + r.bias * hw * (1 - clamp(Math.abs(kIn) / 0.009, 0, 1));
      // traffic in front: go round it or sit behind it
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
      xT = clamp(xT, -hw + 1.1, hw - 1.1);
      // move
      const t = r.v / Math.max(1, vRef);
      const acc = vT > r.v ? (24 * (1 - t) + 5) * 0.95 : -18;
      r.v = clamp(r.v + clamp(vT - r.v, -18 * dt, acc * dt), 0, vRef * 1.1);
      r.vx = damp(r.vx, clamp((xT - r.x) * 1.4, -9, 9), 5, dt);
      r.x += r.vx * dt;
      r.s += r.v * dt;
      if (!r.done && r.s >= tr.goalS) { r.done = true; this.finishOrder.push(r); }
      // the roll-out after the flag ends at the end of the road
      if (r.s > tr.length - 20) { r.s = tr.length - 20; r.v = 0; }
      const veh = r.veh;
      if (veh) {
        veh.s = r.s; veh.x = r.x; veh.v = r.v;
        veh.yaw = -r.vx * 0.03;
        veh.roll = damp(veh.roll || 0, -r.vx * 0.01, 4, dt);
        // brake lights only on a real stop-down, not every little lift in the pack
        veh.brake = vT < r.v - 8 ? 1 : 0;
      }
    }
    // nobody drives through anybody: overlapping rivals push apart
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        const ds = b.s - a.s, dx = b.x - a.x;
        const wl = (a.veh?.l || 2.2) + (b.veh?.l || 2.2), ww = (a.veh?.w || 0.9) + (b.veh?.w || 0.9);
        if (Math.abs(ds) > wl || Math.abs(dx) > ww) continue;
        const ox = ww - Math.abs(dx), os = wl - Math.abs(ds);
        if (os < ox) {
          const [back, front] = ds > 0 ? [a, b] : [b, a];
          back.s = front.s - wl - 0.05;
          back.v = Math.min(back.v, front.v);
        } else {
          const p = Math.sign(dx || 1) * ox * 0.5;
          a.x -= p; b.x += p;
        }
      }
    }
  }

  // the nearest car (rival or you) in this rival's path
  blockerAhead(r, range) {
    const P = this.game.player;
    let best = null;
    const test = (s, x, v) => {
      const d = s - r.s;
      if (d <= 0 || d > range + 6) return;
      if (Math.abs(x - r.x) > 2.4) return;
      if (!best || d < best.d) best = { d, x, v };
    };
    for (const o of this.rivals) if (o !== r) test(o.s, o.x, o.v);
    test(P.s, P.x, P.v);
    return best;
  }

  // you against a rival: bumps and shoves, never a wreck
  contact() {
    const g = this.game;
    const P = g.player;
    const pw = P.halfW * 0.92, pl = P.halfL * 0.92;
    for (const r of this.rivals) {
      const w = r.veh?.w || 0.9, l = r.veh?.l || 2.2;
      const ds = r.s - P.s, dx = r.x - P.x;
      const os = l + pl - Math.abs(ds), ox = w + pw - Math.abs(dx);
      if (os <= 0 || ox <= 0) continue;
      if (os < ox) {
        if (ds > 0) {
          // into the back of them: you lose the speed difference and then some
          const rel = P.v - r.v;
          P.v = Math.max(0, r.v - Math.min(8, Math.max(0, rel) * 0.2));
          P.s = r.s - l - pl - 0.05;
          r.v += Math.max(0, rel) * 0.25;
          if (rel > 3) P.emit('hit', { type: 'rival', hard: rel > 14 });
        } else {
          // they ran into you
          const rel = r.v - P.v;
          r.v = P.v * 0.92;
          r.s = P.s - pl - l - 0.05;
          P.v += Math.max(0, rel) * 0.15;
          if (rel > 3) P.emit('hit', { type: 'rival' });
        }
      } else {
        const push = Math.sign(dx || 1);
        P.x -= push * ox * 0.6;
        r.x += push * ox * 0.4;
        P.vx = -push * 4;
        r.vx = push * 3;
        P.v *= 0.985;
        P.emit('hit', { type: 'rival', side: true });
      }
    }
  }

  collect() {
    const g = this.game;
    const P = g.player;
    const rs = P.halfL + 0.7, rx = P.halfW + 0.6;
    for (const p of this.pickups) {
      if (p.s < P.s - 8) continue;
      if (p.s > P.s + 8) break;
      if (p.taken || Math.abs(p.s - P.s) > rs || Math.abs(p.x - P.x) > rx) continue;
      p.taken = true;
      if (p.kind === 'coin') this.coins++;
      else if (p.kind === 'fuel') P.fuel = Math.min(1, P.fuel + CAN_FUEL);
      else if (p.kind === 'nitro') P.nitro = Math.min(NITRO_MAX, P.nitro + 1);
      g.onCircuitPickup?.(p);
    }
  }

  standings() {
    const P = this.game.player;
    let ahead = 0;
    for (const r of this.rivals) if (r.s > P.s) ahead++;
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
    let a = null, b = null;
    for (const r of this.rivals) {
      const d = r.s - P.s;
      if (d > 0 && (!a || d < a.d)) a = { r, d };
      if (d <= 0 && (!b || d > b.d)) b = { r, d };
    }
    const v = Math.max(20, P.v);
    return { ahead: a && { name: a.r.name, t: a.d / v }, behind: b && { name: b.r.name, t: -b.d / v } };
  }

  nearest() {
    const P = this.game.player;
    let best = null;
    for (const r of this.rivals) {
      const d = Math.hypot(r.s - P.s, r.x - P.x);
      if (d < 45 && (!best || d < best.d)) best = { d, v: r.v, pan: (r.x - P.x) / 8 };
    }
    return best;
  }

  // name tags over the next few cars ahead
  tags(cam) {
    const P = this.game.player;
    const tr = this.track;
    const list = [];
    const W = window.innerWidth, H = window.innerHeight;
    const v = this._tagV || (this._tagV = new THREE.Vector3());
    const order = this.rivals.slice().sort((a, b) => b.s - a.s);
    for (const r of order) {
      const rel = r.s - P.s;
      if (rel < 4 || rel > 160) continue;
      tr.point(r.s, r.x, (r.veh?.md?.hgt || 1.4) + 0.5, v);
      v.project(cam);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) continue;
      list.push({ x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, name: r.name, pos: order.indexOf(r) + 1 + (P.s > r.s ? 1 : 0), boss: r.i === 0, a: rel < 120 ? 1 : (160 - rel) / 40 });
    }
    return list.sort((a, b) => a.pos - b.pos).slice(-2);
  }

  // ------------------------------------------------------------ drawing
  render(time) {
    const P = this.game.player;
    const tr = this.track;
    const M = this.meshes;
    const counts = { coin: 0, fuel: 0, cap: 0, nitro: 0 };
    if (this.active) {
      const m = this._m, q = this._q, e = this._e, p = this._p;
      for (const pk of this.pickups) {
        if (pk.s < P.s - 6) continue;
        if (pk.s > P.s + VIEW) break;
        if (pk.taken) continue;
        const bob = Math.sin(time * 3 + pk.s * 0.2) * 0.12;
        tr.point(pk.s, pk.x, (pk.kind === 'coin' ? 1.0 : 0.85) + bob, p);
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
