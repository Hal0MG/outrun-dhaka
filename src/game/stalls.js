// Street stalls (tea, fruit, fuchka, crates, kiosks) parked on the edge of the
// road. A racer that runs into one sends it flying; it costs the racer nothing.
// Simulated in road space (s, x, h) and drawn with one InstancedMesh per kind.

import * as THREE from 'three';
import { MeshBuilder } from '../world/builder.js';
import { RNG } from '../core/util.js';

const MAX = 48;

function geoms(A) {
  const G = {};
  const W = A.get('white');
  const mk = (fn) => { const B = new MeshBuilder(true); fn(B); return B.build(); };
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
  G.kiosk = mk((B) => {
    B.box(0, 0, 0, 1.6, 1.1, 1.0, 0, { regions: { side: A.get('stall_fuchka'), front: A.get('stall_fuchka'), back: W, top: W }, color: [1, 1, 1] });
    B.box(0, 1.1, 0, 1.7, 0.08, 1.1, 0, { color: [1, 1, 1], region: A.get('awning') });
  });
  return G;
}

// what flies out of each kind: [colours, how many bits]
export const DEBRIS = {
  stall_tea: [[[0.6, 0.4, 0.2], [1, 1, 0.95], [0.75, 0.75, 0.78]], 16],
  stall_fuchka: [[[0.9, 0.7, 0.3], [0.7, 0.45, 0.2]], 14],
  stall_fruit: [[[1, 0.55, 0.1], [1, 0.85, 0.2], [0.2, 0.65, 0.2], [0.9, 0.15, 0.1]], 26],
  crate: [[[0.66, 0.46, 0.24]], 12],
  kiosk: [[[0.6, 0.4, 0.2], [1, 0.8, 0.3]], 16],
};
const KINDS = { stall_tea: 3, stall_fruit: 2.5, stall_fuchka: 2, crate: 1.2, kiosk: 0.8 };

export class Stalls {
  constructor(scene, world) {
    this.world = world;
    this.geo = geoms(world.assets.fx);
    this.meshes = {};
    for (const k in this.geo) {
      const im = new THREE.InstancedMesh(this.geo[k], world.mats.fx, MAX);
      im.count = 0;
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(im);
      this.meshes[k] = im;
    }
    this.list = [];
    this.events = [];
    this.rng = new RNG(31337);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._one = new THREE.Vector3(1, 1, 1);
  }

  clear() { this.list.length = 0; this.events.length = 0; }

  // lay stalls along a track: a small cluster on the outer edge of the road every few hundred metres
  stock(tr) {
    const rng = new RNG((tr.base | 0) + 99);
    const s0 = (tr.isFirst ? tr.gateS : 0) + 160;
    const s1 = (tr.isFinal ? tr.goalS : tr.length) - 120;
    for (let s = s0; s < s1; s += rng.range(260, 520)) {
      if (tr.lapS) { let near = false; for (let i = 0; i <= tr.laps; i++) if (Math.abs(s - tr.lapS(i)) < 50) near = true; if (near) continue; }
      if (tr.elevAt(s) > 1.2) continue;
      const side = rng.sign();
      const n = rng.int(1, 3);
      let at = s;
      for (let k = 0; k < n; k++) {
        at += rng.range(6, 10);
        const hw = tr.halfWAt(Math.min(at, tr.length));
        const kind = rng.weighted(KINDS);
        this.list.push({ tr, s: at, G: tr.base + at, x: side * (hw - 0.55 + rng.range(-0.3, 0.3)), kind, yaw: side < 0 ? 0 : Math.PI, hw: kind === 'crate' ? 0.5 : 0.95, hl: 0.6, f: null });
      }
    }
    this.list.sort((a, b) => a.G - b.G);
  }

  // movers: [{G, x, v, hl, hw, player}]
  update(dt, PG, movers) {
    const tracks = this.world.tracks;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      if (b.G < PG - 200 || (b.f && b.f.t > 5)) { this.list.splice(i, 1); continue; }
      if (!tracks.has(b.tr.id)) continue;
      if (!b.f) {
        if (b.G > PG + 80) continue;
        for (const m of movers) {
          if (Math.abs(b.G - m.G) < b.hl + m.hl && Math.abs(b.x - m.x) < b.hw + m.hw) {
            const side = Math.sign(b.x - m.x) || 1;
            b.f = {
              vs: m.v * (0.25 + this.rng.next() * 0.25) + 2, vx: side * (2 + this.rng.next() * 5), vh: 4 + this.rng.next() * 4 + m.v * 0.06,
              rx: 0, ry: 0, rz: 0, wx: (this.rng.next() - 0.5) * 12, wy: (this.rng.next() - 0.5) * 8, wz: (this.rng.next() - 0.5) * 12, t: 0, h: 0,
            };
            this.events.push({ type: 'smash', b, by: m.player ? 'player' : 'rival' });
            break;
          }
        }
      } else {
        const f = b.f;
        f.t += dt;
        f.vs *= Math.exp(-1.2 * dt);
        b.s += f.vs * dt; b.G += f.vs * dt;
        b.x += f.vx * dt;
        f.h += f.vh * dt;
        f.vh -= 20 * dt;
        f.rx += f.wx * dt; f.ry += f.wy * dt; f.rz += f.wz * dt;
        if (f.h < 0) { f.h = 0; f.vh = Math.abs(f.vh) > 2 ? -f.vh * 0.3 : 0; f.vs *= 0.55; f.vx *= 0.55; f.wx *= 0.5; f.wy *= 0.5; f.wz *= 0.5; }
      }
    }
    this.render(PG);
  }

  render(PG) {
    const counts = {};
    for (const k in this.meshes) counts[k] = 0;
    const m = this._m, q = this._q, e = this._e, p = this._p;
    const tracks = this.world.tracks;
    for (const b of this.list) {
      if (b.G < PG - 40 || b.G > PG + 520 || !tracks.has(b.tr.id)) continue;
      if (b.f && b.f.t > 4) continue;
      const im = this.meshes[b.kind];
      const i = counts[b.kind];
      if (i >= MAX) continue;
      counts[b.kind]++;
      const f = b.f;
      b.tr.point(b.s, b.x, f ? f.h : 0, p);
      e.set(f ? f.rx : 0, -(b.tr.yawAt(Math.min(b.s, b.tr.length)) + b.yaw) + (f ? f.ry : 0), f ? f.rz : 0, 'YXZ');
      q.setFromEuler(e);
      m.compose(p, q, this._one);
      im.setMatrixAt(i, m);
    }
    for (const k in this.meshes) {
      const im = this.meshes[k];
      im.count = counts[k];
      im.instanceMatrix.needsUpdate = true;
    }
  }
}
