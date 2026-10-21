// Things you can drive through: street stalls, saree racks, mannequins,
// ticket gates, cinema seats, shop windows... and whatever a fleeing
// politician throws out of a helicopter. Simulated in road space (s, x, h)
// and drawn with one InstancedMesh per kind.

import * as THREE from 'three';
import { MeshBuilder } from '../world/builder.js';
import { discZ } from './carmodels.js';
import { clamp, fx } from '../core/util.js';

const MAX = 96;

function geoms(A, M) {
  const G = {};
  const W = A.get('white');
  const mk = (fn) => { const B = new MeshBuilder(true); fn(B); return B.build(); };
  // MRT ticket gate: a waist-high box with a glass flap
  G.gate = mk((B) => {
    B.box(0, 0, 0, 0.3, 1.0, 1.4, 0, { regions: { side: A.get('mrt_gate'), top: W, front: W, back: W }, color: [0.92, 0.94, 0.96] });
    B.box(0.32, 0.55, 0.2, 0.34, 0.4, 0.04, 0, { color: [0.6, 0.85, 1], region: A.get('glasspane') });
  });
  G.glass = mk((B) => {
    B.box(0, 0, 0, 1.4, 4.6, 0.06, 0, { color: [0.75, 0.9, 1], region: A.get('glasspane') });
    B.box(0, 0, 0, 1.42, 0.08, 0.1, 0, { color: [0.3, 0.3, 0.32], region: W });
  });
  const rack = (B, reg, folded = false) => {
    B.box(-0.95, 0, 0, 0.05, 1.8, 0.05, 0, { color: [0.75, 0.75, 0.78], region: W });
    B.box(0.95, 0, 0, 0.05, 1.8, 0.05, 0, { color: [0.75, 0.75, 0.78], region: W });
    B.box(0, 1.75, 0, 1.95, 0.05, 0.05, 0, { color: [0.75, 0.75, 0.78], region: W });
    B.box(0, 0, 0, 2.0, 0.06, 0.5, 0, { color: [0.3, 0.3, 0.32], region: W });
    for (let i = 0; i < 7; i++) {
      const x = -0.8 + i * 0.27;
      B.box(x, 0.55, 0, 0.04, 1.18, 0.42, 0.15 * Math.sin(i * 2), { regions: { side: reg, front: reg, back: reg, top: reg }, color: [1, 1, 1] });
    }
  };
  for (let v = 0; v < 6; v++) G['rack_saree' + v] = mk((B) => rack(B, A.get('saree' + v)));
  G.rack_panjabi = mk((B) => rack(B, A.get('panjabi')));
  G.mannequin = mk((B) => {
    const m = A.get('mannequin');
    B.box(0, 0, 0, 0.5, 0.05, 0.5, 0, { color: [0.2, 0.2, 0.2], region: W });
    B.box(0, 0.05, 0, 0.05, 0.8, 0.05, 0, { color: [0.7, 0.7, 0.7], region: W });
    B.box(0, 0.8, 0, 0.42, 0.75, 0.24, 0, { regions: { side: A.get('saree1'), front: A.get('saree1'), back: A.get('saree1'), top: m }, color: [1, 1, 1] });
    B.box(0, 0.25, 0, 0.5, 0.6, 0.3, 0, { regions: { side: A.get('saree1'), front: A.get('saree1'), back: A.get('saree1'), top: m }, color: [1, 1, 1] });
    B.box(0, 1.55, 0, 0.1, 0.1, 0.1, 0, { color: [1, 1, 1], region: m });
    B.box(0, 1.65, 0, 0.22, 0.26, 0.22, 0, { color: [1, 1, 1], region: m });
  });
  G.table = mk((B) => {
    B.box(0, 0.7, 0, 1.8, 0.08, 0.9, 0, { color: [0.55, 0.36, 0.2], region: W });
    for (const [x, z] of [[-0.8, -0.38], [0.8, -0.38], [-0.8, 0.38], [0.8, 0.38]]) B.box(x, 0, z, 0.07, 0.7, 0.07, 0, { color: [0.4, 0.26, 0.14], region: W });
    B.box(0, 0.78, 0, 1.5, 0.35, 0.7, 0, { regions: { side: A.get('folded'), front: A.get('folded'), back: A.get('folded'), top: A.get('folded') }, color: [1, 1, 1] });
  });
  G.kiosk = mk((B) => {
    B.box(0, 0, 0, 1.6, 1.1, 1.0, 0, { regions: { side: A.get('stall_fuchka'), front: A.get('stall_fuchka'), back: W, top: W }, color: [1, 1, 1] });
    B.box(0, 1.1, 0, 1.7, 0.08, 1.1, 0, { color: [1, 1, 1], region: A.get('awning') });
  });
  G.popcorn = mk((B) => {
    B.box(0, 0, 0, 0.9, 0.9, 0.7, 0, { color: [0.8, 0.1, 0.12], region: W });
    B.box(0, 0.9, 0, 0.85, 0.6, 0.65, 0, { color: [1, 0.95, 0.75], region: A.get('glasspane') });
    for (let i = 0; i < 3; i++) B.box(-0.25 + i * 0.25, 1.5, 0, 0.18, 0.28, 0.18, 0, { color: [1, 1, 1], region: A.get('popcorn') });
  });
  G.rope = mk((B) => {
    for (const x of [-0.9, 0.9]) { B.box(x, 0, 0, 0.3, 0.05, 0.3, 0, { color: [0.85, 0.7, 0.3], region: W }); B.box(x, 0, 0, 0.06, 1.0, 0.06, 0, { color: [0.95, 0.8, 0.35], region: W }); }
    B.box(0, 0.85, 0, 1.8, 0.07, 0.07, 0, { color: [0.6, 0.05, 0.1], region: W });
  });
  G.seatrow = mk((B) => {
    for (let i = 0; i < 4; i++) {
      const x = -0.9 + i * 0.6;
      B.box(x, 0, 0, 0.55, 0.45, 0.5, 0, { regions: { side: A.get('cinema_seat'), front: A.get('cinema_seat'), back: A.get('cinema_seat'), top: A.get('cinema_seat') }, color: [1, 1, 1] });
      B.box(x, 0.45, 0.22, 0.55, 0.55, 0.1, 0, { regions: { side: A.get('cinema_seat'), front: A.get('cinema_seat'), back: A.get('cinema_seat'), top: A.get('cinema_seat') }, color: [1, 1, 1] });
    }
  });
  G.screen = mk((B) => {
    B.box(0, 0.4, 0, 15, 7.4, 0.08, 0, { regions: { front: A.get('cinema_screen'), back: A.get('cinema_screen'), side: W, top: W }, color: [1.25, 1.25, 1.25] });
  });
  G.stall_tea = mk((B) => {
    B.box(0, 0, 0, 1.7, 1.0, 1.0, 0, { regions: { side: A.get('stall_tea'), front: A.get('stall_tea'), back: A.get('stall_tea'), top: W }, color: [1, 1, 1] });
    for (const x of [-0.8, 0.8]) B.box(x, 1.0, -0.45, 0.05, 1.2, 0.05, 0, { color: [0.5, 0.35, 0.2], region: W });
    B.box(0, 2.2, -0.2, 2.0, 0.06, 1.5, 0, { color: [1, 1, 1], region: A.get('awning') });
    B.box(0.4, 1.0, 0.1, 0.25, 0.3, 0.25, 0, { color: [0.75, 0.75, 0.78], region: W }); // kettle
    for (let i = 0; i < 5; i++) B.box(-0.6 + i * 0.22, 1.0, 0.3, 0.1, 0.12, 0.1, 0, { color: [1, 1, 0.95], region: W }); // cups
  });
  G.stall_fuchka = mk((B) => {
    B.box(0, 0.35, 0, 1.4, 0.8, 0.8, 0, { regions: { side: A.get('stall_fuchka'), front: A.get('stall_fuchka'), back: A.get('stall_fuchka'), top: A.get('glasspane') }, color: [1, 1, 1] });
    B.wheel(-0.55, 0.3, 0, 0.3, 0.06, 10, [1, 1, 1], A.get('tyre'), A.get('rim'));
    B.wheel(0.55, 0.3, 0, 0.3, 0.06, 10, [1, 1, 1], A.get('tyre'), A.get('rim'));
  });
  G.stall_fruit = mk((B) => {
    B.box(0, 0.5, 0, 1.8, 0.1, 1.0, 0, { color: [0.45, 0.3, 0.18], region: W });
    B.box(0, 0.6, 0, 1.7, 0.45, 0.9, 0, { regions: { top: A.get('fruit'), side: A.get('fruit'), front: A.get('fruit'), back: A.get('fruit') }, color: [1, 1, 1] });
    B.wheel(-0.7, 0.28, 0, 0.28, 0.06, 10, [1, 1, 1], A.get('tyre'), A.get('rim'));
    B.wheel(0.7, 0.28, 0, 0.28, 0.06, 10, [1, 1, 1], A.get('tyre'), A.get('rim'));
  });
  G.crate = mk((B) => { B.box(0, 0, 0, 0.8, 0.6, 0.6, 0, { color: [1, 1, 1], region: A.get('crate') }); B.box(0.05, 0.6, 0, 0.7, 0.5, 0.55, 0.3, { color: [1, 1, 1], region: A.get('crate') }); });
  G.cone = mk((B) => { B.cylinder(0, 0, 0, 0.28, 0.04, 0.8, 8, [1, 0.45, 0.05], W); B.cylinder(0, 0.35, 0, 0.17, 0.12, 0.12, 8, [1.4, 1.4, 1.4], W); });
  G.barrier = mk((B) => { B.box(0, 0, 0, 2.4, 0.9, 0.5, 0, { color: [1, 1, 1], region: A.get('chevron') }); });
  // the helicopter's luggage
  G.suitcase = mk((B) => { B.box(0, 0, 0, 0.8, 0.55, 0.3, 0, { color: [1, 1, 1], region: A.get('suitcase') }); B.box(0, 0.55, 0, 0.25, 0.08, 0.05, 0, { color: [0.8, 0.6, 0.2], region: W }); });
  G.goldcase = mk((B) => { B.box(0, 0, 0, 0.9, 0.6, 0.35, 0, { color: [2.2, 1.6, 0.4], region: A.get('suitcase') }); });
  G.tv = mk((B) => { B.box(0, 0, 0, 1.3, 0.8, 0.12, 0, { regions: { front: A.get('tv'), back: W, side: W, top: W }, color: [1, 1, 1] }); B.box(0, -0.1, 0, 0.4, 0.1, 0.25, 0, { color: [0.1, 0.1, 0.1], region: W }); });
  G.sofa = mk((B) => {
    const v = A.get('velvet');
    B.box(0, 0, 0, 2.1, 0.45, 0.9, 0, { color: [1, 1, 1], region: v });
    B.box(0, 0.45, 0.35, 2.1, 0.6, 0.22, 0, { color: [1, 1, 1], region: v });
    for (const x of [-0.98, 0.98]) B.box(x, 0.45, 0, 0.18, 0.3, 0.9, 0, { color: [1, 1, 1], region: v });
  });
  G.saree = mk((B) => { B.box(0, 0, 0, 2.2, 0.02, 1.1, 0, { color: [1, 1, 1], region: A.get('saree0') }); });
  G.duck = mk((B) => {
    B.box(0, 0.1, 0, 0.3, 0.25, 0.45, 0, { color: [0.98, 0.98, 0.95], region: W });
    B.box(0, 0.3, -0.18, 0.16, 0.2, 0.16, 0, { color: [0.98, 0.98, 0.95], region: W });
    B.box(0, 0.36, -0.3, 0.08, 0.05, 0.12, 0, { color: [1, 0.6, 0.1], region: W });
  });
  G.cat = mk((B) => {
    B.box(0, 0.1, 0, 0.22, 0.24, 0.5, 0, { color: [0.95, 0.65, 0.3], region: W });
    B.box(0, 0.26, -0.28, 0.2, 0.18, 0.18, 0, { color: [0.95, 0.65, 0.3], region: W });
    for (const x of [-0.06, 0.06]) B.box(x, 0.44, -0.3, 0.05, 0.07, 0.04, 0, { color: [0.95, 0.65, 0.3], region: W });
    B.box(0, 0.3, 0.28, 0.05, 0.05, 0.3, -0.5, { color: [0.95, 0.65, 0.3], region: W });
  });
  G.fish = mk((B) => { B.box(0, 0.05, 0, 0.18, 0.22, 0.75, 0, { color: [0.7, 0.75, 0.8], region: W }); B.box(0, 0.05, 0.42, 0.04, 0.3, 0.12, 0, { color: [0.6, 0.6, 0.65], region: W }); });
  G.chandelier = mk((B) => {
    B.cylinder(0, 0, 0, 0.7, 0.2, 0.9, 10, [1.6, 1.3, 0.6], W);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; B.box(Math.cos(a) * 0.65, -0.3, Math.sin(a) * 0.65, 0.06, 0.3, 0.06, 0, { color: [1.8, 1.8, 1.6], region: A.get('glasspane') }); }
  });
  G.mango = mk((B) => { B.box(0, 0, 0, 0.7, 0.45, 0.5, 0, { color: [1, 1, 1], region: A.get('crate') }); B.box(0, 0.45, 0, 0.65, 0.12, 0.45, 0, { color: [1.2, 0.9, 0.2], region: A.get('fruit') }); });
  return G;
}

// what flies out when something breaks: [pool, colours, count, size]
const DEBRIS = {
  gate: ['spark', [[0.8, 0.85, 0.9], [0.2, 0.9, 0.4]], 10],
  glass: ['glass', [[0.8, 0.95, 1.2], [1.4, 1.5, 1.6]], 22],
  rack: ['cloth', null, 24],
  mannequin: ['cloth', null, 14],
  table: ['cloth', null, 18],
  kiosk: ['wood', [[0.6, 0.4, 0.2], [1, 0.8, 0.3]], 16],
  popcorn: ['pop', [[1, 0.95, 0.7], [1, 1, 0.85]], 30],
  rope: ['wood', [[0.95, 0.8, 0.35], [0.6, 0.05, 0.1]], 6],
  seatrow: ['wood', [[0.6, 0.06, 0.1], [0.9, 0.85, 0.7]], 12],
  screen: ['cloth', [[1, 0.5, 0.2], [1, 0.9, 0.3], [1, 1, 1]], 70],
  stall: ['fruit', null, 26],
  crate: ['wood', [[0.66, 0.46, 0.24]], 12],
  cone: ['wood', [[1, 0.45, 0.05]], 4],
  barrier: ['wood', [[1, 0.85, 0.1], [0.1, 0.1, 0.1]], 8],
  suitcase: ['cloth', null, 26],
  goldcase: ['money', null, 40],
  tv: ['glass', [[0.4, 0.6, 1.4], [1, 1, 1]], 14],
  sofa: ['wood', [[0.7, 0.1, 0.15], [1, 0.85, 0.2]], 16],
  saree: ['cloth', null, 8],
  chandelier: ['glass', [[1.6, 1.4, 0.8], [1.6, 1.6, 1.6]], 28],
  mango: ['fruit', null, 20],
  duck: ['feather', [[1, 1, 1]], 16],
  fish: ['spark', [[0.7, 0.8, 0.9]], 6],
  cat: [null, null, 0],
};

export function debrisOf(kind) {
  if (kind.startsWith('rack')) return DEBRIS.rack;
  if (kind.startsWith('stall')) return DEBRIS.stall;
  return DEBRIS[kind] || DEBRIS.crate;
}

export class Breakables {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    const A = world.assets.fx;
    this.geo = geoms(A, world.mats);
    this.meshes = {};
    for (const k in this.geo) {
      const mat = k === 'screen' || k === 'glass' || k === 'saree' ? world.mats.fxDouble : world.mats.fx;
      const im = new THREE.InstancedMesh(this.geo[k], mat, MAX);
      im.count = 0;
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(im);
      this.meshes[k] = im;
    }
    this.dyn = []; // spawned at runtime (projectiles, debris that outlived its chunk)
    this.events = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this.time = 0;
  }

  clear() { this.dyn.length = 0; }

  meshKind(b) {
    if (b.kind === 'rack_saree') return 'rack_saree' + ((b.tint | 0) % 6);
    return b.kind;
  }

  // a thrown object: road-space position and velocity
  spawn(kind, track, s, x, h, vs, vx, vh, opts = {}) {
    const b = { kind, track, s, x, h, yaw: opts.yaw ?? fx.next() * 6.28, scale: opts.scale ?? 1, hw: opts.hw ?? 0.7, hl: opts.hl ?? 0.6, ht: opts.ht ?? 1.2, mass: opts.mass ?? 0.06, score: opts.score ?? 0, hazard: opts.hazard ?? true, pickup: !!opts.pickup, dynamic: true };
    b.flying = { vs, vx, vh, rx: 0, ry: 0, rz: 0, wx: (fx.next() - 0.5) * 8, wy: (fx.next() - 0.5) * 6, wz: (fx.next() - 0.5) * 8, t: 0, thrown: true };
    b.alive = true;
    this.dyn.push(b);
    return b;
  }

  all() {
    return this.world.breakables.concat(this.dyn);
  }

  smash(b, player, how = 'player') {
    if (b.smashed) return;
    b.smashed = true;
    const pv = player ? player.v : 10;
    const dx = player ? b.x - player.x : 0;
    // up and out to the side; it falls behind you instead of riding along
    const side = Math.sign(dx || fx.next() - 0.5);
    b.flying = {
      vs: pv * (0.25 + fx.next() * 0.25) + 2, vx: side * (2 + fx.next() * 5) + dx * 0.8, vh: 4 + fx.next() * 4 + pv * 0.06, drag: 1.2,
      rx: 0, ry: 0, rz: 0, wx: (fx.next() - 0.5) * 12, wy: (fx.next() - 0.5) * 8, wz: (fx.next() - 0.5) * 12, t: 0,
    };
    if (b.kind === 'glass' || b.kind === 'screen' || b.kind === 'saree') b.gone = true;
    this.events.push({ type: 'smash', b, how });
  }

  update(dt, player, camS) {
    this.time += dt;
    const P = player;
    const pw = P.halfW * 0.9, pl = P.halfL * 0.85;
    const lift = P.air ? P.air.h0 * (1 - P.airU()) + P.air.h * 4 * P.airU() * (1 - P.airU()) : 0;
    const list = this.all();
    for (const b of list) {
      if (b.gone && b.flying && b.flying.t > 0.05) continue;
      // collisions with the car (static and landed items)
      if (b.track === P.track && !b.smashed && !P.crash && (!b.flying || b.flying.thrown)) {
        const ds = b.s - P.s, dx = b.x - P.x;
        if (Math.abs(ds) < b.hl + pl && Math.abs(dx) < b.hw + pw && lift < b.h + b.ht + 0.3 && lift + 1.3 > b.h) {
          if (b.kind === 'cat') { this.events.push({ type: 'cat', b }); b.smashed = true; b.flying = { vs: 2, vx: Math.sign(dx || 1) * 9, vh: 6, rx: 0, ry: 0, rz: 0, wx: 0, wy: 8, wz: 0, t: 0 }; continue; }
          if (b.pickup) { b.smashed = true; b.gone = true; this.events.push({ type: 'pickup', b }); continue; }
          this.smash(b, P);
          if (b.hazard && !P.boosting) this.events.push({ type: 'hazard', b });
          else P.v *= 1 - (b.mass || 0.03) * (P.boosting ? 0.3 : 1);
        }
      }
      const f = b.flying;
      if (!f) continue;
      f.t += dt;
      if (f.drag) f.vs *= Math.exp(-f.drag * dt);
      b.s += f.vs * dt;
      b.x += f.vx * dt;
      b.h += f.vh * dt;
      f.vh -= (b.kind === 'saree' && f.thrown ? 5 : 20) * dt;
      f.rx += f.wx * dt; f.ry += f.wy * dt; f.rz += f.wz * dt;
      if (b.h < 0) {
        b.h = 0;
        if (f.thrown && !b.smashed) {
          // a thrown object hits the road and stays there as an obstacle
          this.events.push({ type: 'land', b });
          b.flying = null;
          if (b.kind === 'cat') { b.flying = { vs: 0, vx: (b.x > 0 ? 1 : -1) * 6, vh: 2.5, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, t: 0 }; b.smashed = true; }
          continue;
        }
        f.vh = Math.abs(f.vh) > 2 ? -f.vh * 0.3 : 0;
        f.vs *= 0.55; f.vx *= 0.55; f.wx *= 0.5; f.wy *= 0.5; f.wz *= 0.5;
      }
      if (f.t > 6) b.gone = true;
    }
    // forget dynamic items far behind
    this.dyn = this.dyn.filter((b) => !(b.gone && b.flying && b.flying.t > 6) && b.track && Math.abs(b.s - P.s) < 900 && !(b.track !== P.track && b.track !== P.track.parent));
    this.render(camS, P);
  }

  render(camS, P) {
    const counts = {};
    for (const k in this.meshes) counts[k] = 0;
    const m = this._m, q = this._q, e = this._e, p = this._p, sc = this._s;
    for (const b of this.all()) {
      if (b.gone && b.flying && b.flying.t > 0.05) continue;
      if (!b.track) continue;
      if (b.track === P.track && (b.s < camS - 40 || b.s > camS + 500)) continue;
      const k = this.meshKind(b);
      const im = this.meshes[k];
      if (!im) continue;
      const i = counts[k];
      if (i >= MAX) continue;
      counts[k]++;
      b.track.point(b.s, b.x, b.h, p);
      const f = b.flying;
      const ry = b.track.yawAt(Math.min(b.s, b.track.length)) + b.yaw;
      e.set(f ? f.rx : 0, -ry + (f ? f.ry : 0), f ? f.rz : 0, 'YXZ');
      q.setFromEuler(e);
      const s = (b.scale || 1) * (f && b.dynamic === undefined && f.t > 4 ? Math.max(0, 1 - (f.t - 4) / 2) : 1);
      sc.set(s, s, s);
      m.compose(p, q, sc);
      im.setMatrixAt(i, m);
    }
    for (const k in this.meshes) {
      const im = this.meshes[k];
      im.count = counts[k];
      im.instanceMatrix.needsUpdate = true;
    }
  }
}
