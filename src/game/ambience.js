// Life in the sky and on the rails, per district: the metro train on the
// viaduct, planes over the airport, flocks of birds, Bengali kites, fireworks
// and fire-breathers. All of it is scenery: nothing here touches a racer.

import * as THREE from 'three';
import { MeshBuilder } from '../world/builder.js';
import { medianW } from '../world/chunk.js';
import { audio } from '../audio/audio.js';
import { RNG, clamp } from '../core/util.js';

// what each district has: birds [kind, how many flocks], kites (in the air at once), fireworks (bursts a second
// multiplier), flames (fire-breathers on the street), planes. The metro train comes with the stage's viaduct.
const AMBIENT = {
  dhanmondi: { birds: ['egret', 2], kites: 8 },
  shahbag: { birds: ['crow', 2], kites: 16, fireworks: 0.6 },
  manikmia: { birds: ['crow', 2], kites: 6 },
  oldDhaka: { birds: ['pigeon', 3], kites: 28, fireworks: 1, flames: true },
  kawranBazar: { birds: ['crow', 2] },
  hatirjheel: { birds: ['egret', 3], fireworks: 0.7 },
  gulshan: { birds: ['crow', 2], kites: 4 },
  sadarghat: { birds: ['gull', 3], kites: 10 },
  motijheel: { birds: ['pigeon', 2], fireworks: 0.6 },
  mirpur: { birds: ['crow', 2], fireworks: 1 },
  airport: { birds: ['gull', 2], planes: true },
  purbachal: { birds: ['egret', 2], kites: 16 },
  highway: { birds: ['crow', 2], kites: 6 },
  savar: { birds: ['egret', 3], kites: 8 },
  padma: { birds: ['gull', 3], fireworks: 0.5 },
};
const BIRD_COLORS = { crow: [0.1, 0.1, 0.12], pigeon: [0.62, 0.64, 0.68], egret: [0.97, 0.97, 0.94], gull: [0.92, 0.94, 0.96] };
const KITE_COLORS = ['#e4252b', '#ffb000', '#1d5fa8', '#19a84a', '#ff2e88', '#7b2f9e', '#22d3ee', '#ffe14a'];

// one metro car (the train is six of them, each placed on the viaduct on its own so the train follows its bends)
export const METRO_CAR = { cars: 6, L: 22, gap: 0.6 };
export function buildMetroTrain(misc, mats) {
  const B = new MeshBuilder(true);
  const G = new MeshBuilder(false);
  const side = misc.get('mrt_side');
  const { L } = METRO_CAR, W = 2.9, H = 3.3;
  B.box(0, 0.6, 0, W, H, L, 0, { regions: { side, front: misc.get('white'), back: misc.get('white'), top: misc.get('metal') }, color: [1, 1, 1] });
  G.box(0, 2.1, 0, W + 0.04, 0.9, L - 3, 0, { color: [1.6, 1.8, 1.9] });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(B.build(), mats.misc));
  g.add(new THREE.Mesh(G.build(), new THREE.MeshBasicMaterial({ vertexColors: true })));
  return g;
}

// the two lamps on the nose of the leading car
function buildMetroNose() {
  const G = new MeshBuilder(false);
  const { L } = METRO_CAR;
  G.box(-0.8, 1.2, -L / 2 - 0.05, 0.4, 0.2, 0.05, 0, { color: [3, 3, 2.6] });
  G.box(0.8, 1.2, -L / 2 - 0.05, 0.4, 0.2, 0.05, 0, { color: [3, 3, 2.6] });
  return new THREE.Mesh(G.build(), new THREE.MeshBasicMaterial({ vertexColors: true }));
}

export function buildPlane(misc, mats) {
  const B = new MeshBuilder(true);
  const G = new MeshBuilder(false);
  const livery = misc.get('plane');
  const white = misc.get('white');
  // fuselage along z (nose at -z)
  B.tube([0, 0, 20], [0, 0, -20], 2.2, 2.2, 12, [1, 1, 1], livery);
  B.tube([0, 0, -20], [0, -0.3, -25], 2.2, 0.4, 12, [1, 1, 1], white);
  B.tube([0, 0, 20], [0, 0.8, 27], 2.2, 0.5, 10, [1, 1, 1], white);
  // wings
  B.quad([-1, -0.6, -4], [-19, -0.2, 4], [-19, 0, 7], [-1, -0.4, 4], [0, 0, 1, 1], [0.92, 0.92, 0.95], white);
  B.quad([1, -0.4, 4], [19, 0, 7], [19, -0.2, 4], [1, -0.6, -4], [0, 0, 1, 1], [0.92, 0.92, 0.95], white);
  B.quad([-1, -0.4, 4], [-19, 0, 7], [-19, -0.2, 4], [-1, -0.6, -4], [0, 0, 1, 1], [0.8, 0.8, 0.82], white);
  B.quad([1, -0.6, -4], [19, -0.2, 4], [19, 0, 7], [1, -0.4, 4], [0, 0, 1, 1], [0.8, 0.8, 0.82], white);
  // engines
  for (const x of [-7, 7]) B.tube([x, -1.6, -3], [x, -1.6, 2], 1.0, 1.0, 10, [0.75, 0.75, 0.78], misc.get('metal'));
  // tail fin (green + red disc nod)
  B.quad([0, 1.5, 19], [0, 1.5, 26], [0, 8, 27], [0, 8, 23], [0, 0, 1, 1], [0.06, 0.48, 0.26], white);
  B.quad([0, 1.5, 26], [0, 1.5, 19], [0, 8, 23], [0, 8, 27], [0, 0, 1, 1], [0.06, 0.48, 0.26], white);
  // landing lights + strobes
  G.box(0, -1.4, -14, 0.8, 0.4, 0.4, 0, { color: [4, 4, 3.6] });
  G.box(-19, 0, 6, 0.4, 0.4, 0.4, 0, { color: [3, 0.1, 0.1] });
  G.box(19, 0, 6, 0.4, 0.4, 0.4, 0, { color: [0.1, 3, 0.3] });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(B.build(), mats.misc));
  g.add(new THREE.Mesh(G.build(), new THREE.MeshBasicMaterial({ vertexColors: true })));
  const beam = new THREE.Mesh(new THREE.ConeGeometry(14, 90, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.24, 0.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.rotation.x = -Math.PI / 2 - 0.35;
  beam.position.set(0, -10, -55);
  g.add(beam);
  return g;
}

const MAX_BIRDS = 120, MAX_KITES = 40;

export class Ambience {
  constructor(game) {
    this.game = game;
    const scene = game.scene;
    const A = game.world.assets, mats = game.world.mats;
    this.rng = new RNG(2024);
    this.trainProto = buildMetroTrain(A.misc, mats);
    this.trainNose = buildMetroNose();
    this.trainWin = this.trainProto.children[1].material;
    this.planeProto = buildPlane(A.misc, mats);
    this.trains = [];
    this.planes = [];
    this.flocks = [];
    this.kites = [];
    this.nextTrain = 4;
    this.nextPlane = 3;
    this.fwT = 1;
    this.fbT = 2;
    this.birdT = 1;
    this.kiteT = 0;
    this.time = 0;
    // a bird is a flat V of two wing triangles; a flap squashes it
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.35, -1.1, 0.25, -0.1, 0, 0, -0.3, 0, 0, 0.35, 0, 0, -0.3, 1.1, 0.25, -0.1], 3));
    wing.computeVertexNormals();
    // a kite: a diamond, two-tone, and a ragged tail
    const kite = new THREE.BufferGeometry();
    kite.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.1, 0, -0.75, 0, 0, 0, 0, 0, 0, 1.1, 0, 0, 0, 0, 0.75, 0, 0, 0, 0, 0, -0.75, 0, 0, 0, -0.9, 0, 0, 0, 0, 0, -0.9, 0, 0.75, 0, 0], 3));
    kite.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65], 3));
    const tail = new THREE.BufferGeometry();
    tail.setAttribute('position', new THREE.Float32BufferAttribute([-0.06, 0, 0, 0.06, 0, 0, 0, -2.6, 0], 3));
    const mk = (geo, mat, n) => {
      const im = new THREE.InstancedMesh(geo, mat, n);
      im.count = 0;
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const white = new THREE.Color(1, 1, 1);
      for (let i = 0; i < n; i++) im.setColorAt(i, white);
      scene.add(im);
      return im;
    };
    this.birdMesh = mk(wing, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: true }), MAX_BIRDS);
    this.kiteMesh = mk(kite, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: true, fog: true }), MAX_KITES);
    this.tailMesh = mk(tail, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: true }), MAX_KITES);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
  }

  clear() {
    for (const t of this.trains) for (const o of t.cars) o.removeFromParent();
    for (const p of this.planes) p.obj.removeFromParent();
    this.trains = [];
    this.planes = [];
    this.flocks.length = 0;
    this.kites.length = 0;
    this.birdMesh.count = this.kiteMesh.count = this.tailMesh.count = 0;
  }

  // everything is placed ahead of the player on the player's track: road-space s, lateral x, height h
  update(dt, P, night, glow) {
    this.time += dt;
    const tr = P.track;
    const st = tr.stage;
    const cfg = AMBIENT[st.district || st.id] || {};
    const scene = this.game.scene;
    const P3 = this._p;
    const day = clamp(1 - night * 1.15, 0, 1);

    // ---- the metro train on the viaduct
    if (st.metro) {
      this.nextTrain -= dt;
      if (this.nextTrain <= 0 && this.trains.length < 3) {
        this.nextTrain = 4 + this.rng.next() * 5;
        const dir = this.rng.chance(0.5) ? 1 : -1;
        const cars = [];
        for (let k = 0; k < METRO_CAR.cars; k++) {
          const obj = this.trainProto.clone();
          if (k === 0) obj.add(this.trainNose.clone());
          scene.add(obj);
          cars.push(obj);
        }
        this.trains.push({ cars, track: tr, s: dir > 0 ? P.s - 150 : P.s + 700, dir, v: dir > 0 ? 27 : 22, lane: dir > 0 ? -1.9 : 1.9 });
      }
    }
    for (let i = this.trains.length - 1; i >= 0; i--) {
      const t = this.trains[i];
      t.s += t.v * t.dir * dt;
      if (t.track !== tr || t.s < P.s - 300 || t.s > P.s + 1200 || t.s > tr.length - 100) { for (const o of t.cars) o.removeFromParent(); this.trains.splice(i, 1); continue; }
      // every car sits on the viaduct at its own place along the road, so the train bends with it
      t.cars.forEach((obj, k) => {
        const sk = clamp(t.s - t.dir * k * (METRO_CAR.L + METRO_CAR.gap), 0, tr.length);
        tr.point(sk, tr.halfWAt(sk) + medianW(st) / 2 + t.lane, 12.7, obj.position);
        obj.rotation.set(0, -(tr.yawAt(sk) + (t.dir < 0 ? Math.PI : 0)), 0);
      });
      this.trainWin.color.setScalar(0.4 + glow * 0.8);
    }

    // ---- planes coming in over the road
    if (cfg.planes) {
      this.nextPlane -= dt;
      if (this.nextPlane <= 0) {
        this.nextPlane = 9 + this.rng.next() * 7;
        const obj = this.planeProto.clone();
        scene.add(obj);
        this.planes.push({ obj, s: P.s + 260 + this.rng.next() * 120, t: 0, track: tr });
        audio.plane();
      }
    }
    for (let i = this.planes.length - 1; i >= 0; i--) {
      const p = this.planes[i];
      p.t += dt;
      if (p.t > 14 || p.track !== tr) { p.obj.removeFromParent(); this.planes.splice(i, 1); continue; }
      // flies from the left across the road toward the runway on the right, descending
      tr.point(Math.min(p.s, tr.length), -420 + p.t * 70, 0, p.obj.position, true);
      p.obj.position.y += 85 - p.t * 4.2;
      p.obj.rotation.set(0.06, -(tr.yawAt(Math.min(p.s, tr.length)) + Math.PI / 2), 0.04);
    }

    // ---- fireworks over the district, and fire-breathers on the street
    if (cfg.fireworks && night > 0.15) {
      this.fwT -= dt;
      if (this.fwT <= 0) {
        this.fwT = (0.5 + this.rng.next() * 1.2) / cfg.fireworks;
        const p = tr.point(Math.min(P.s + 80 + this.rng.next() * 220, tr.length), this.rng.sign() * (25 + this.rng.next() * 130), 0, P3, true);
        this.game.particles.firework(p.x, p.y + 15, p.z);
        audio.firework();
      }
    }
    if (cfg.flames) {
      this.fbT -= dt;
      if (this.fbT <= 0) {
        this.fbT = 1.5 + this.rng.next() * 2.5;
        const p = tr.point(Math.min(P.s + 60 + this.rng.next() * 120, tr.length), this.rng.sign() * (tr.halfWAt(P.s) + 8 + this.rng.next() * 6), 18 + this.rng.next() * 6, P3, true);
        this.game.particles.flame(p.x, p.y, p.z);
        audio.noiseHit(0.6, 0.12, 'lowpass', 900, 0.8, { to: 200 });
      }
    }

    // ---- birds: flocks drifting along the road, wheeling
    if (cfg.birds) {
      this.birdT -= dt;
      if (this.birdT <= 0 && this.flocks.length < cfg.birds[1] * 2) {
        this.birdT = 1.2 + this.rng.next() * 2.5;
        const n = this.rng.int(6, 16);
        const birds = [];
        for (let i = 0; i < n; i++) birds.push({ dx: (this.rng.next() - 0.5) * 16, dy: (this.rng.next() - 0.5) * 6, dz: (this.rng.next() - 0.5) * 22, ph: this.rng.next() * 6.28 });
        this.flocks.push({ track: tr, s: P.s + 200 + this.rng.next() * 420, x: this.rng.sign() * (6 + this.rng.next() * 40), h: 12 + this.rng.next() * 24, vs: this.rng.range(7, 14) * (this.rng.chance(0.4) ? -1 : 1), kind: cfg.birds[0], birds, ph: this.rng.next() * 6.28 });
      }
    }
    for (let i = this.flocks.length - 1; i >= 0; i--) {
      const f = this.flocks[i];
      f.s += f.vs * dt;
      if (f.track !== tr || f.s < P.s - 90 || f.s > P.s + 950) this.flocks.splice(i, 1);
    }

    // ---- kites: held aloft above the rooftops
    const wantKites = cfg.kites || 0; // flown after dark too: Shakrain kites carry lights
    this.kiteT -= dt;
    if (this.kites.length < wantKites && this.kiteT <= 0) {
      this.kiteT = 0.15;
      this.kites.push({ track: tr, s: P.s + 110 + this.rng.next() * 560, x: this.rng.sign() * (8 + this.rng.next() * 55), h: 24 + this.rng.next() * 34, ph: this.rng.next() * 6.28, col: new THREE.Color(this.rng.pick(KITE_COLORS)), size: 2.4 + this.rng.next() * 2.4 });
    }
    for (let i = this.kites.length - 1; i >= 0; i--) {
      const k = this.kites[i];
      if (k.track !== tr || k.s < P.s - 80 || k.s > P.s + 950 || !wantKites) this.kites.splice(i, 1);
    }
    this.render(tr, day);
  }

  render(tr, day) {
    const m = this._m, q = this._q, e = this._e, p = this._p, sc = this._s, c = this._c;
    let nb = 0;
    for (const f of this.flocks) {
      const base = BIRD_COLORS[f.kind];
      const yaw = tr.yawAt(Math.min(f.s, tr.length)) + (f.vs < 0 ? Math.PI : 0);
      const fx0 = f.x + Math.sin(this.time * 0.35 + f.ph) * 9;
      const fh = f.h + Math.sin(this.time * 0.5 + f.ph * 2) * 3;
      for (const b of f.birds) {
        if (nb >= MAX_BIRDS) break;
        tr.point(Math.min(Math.max(f.s + b.dz, 0), tr.length), fx0 + b.dx, fh + b.dy + Math.sin(this.time * 2 + b.ph) * 0.6, p, true);
        const flap = Math.sin(this.time * 9 + b.ph);
        e.set(0, -yaw, 0, 'YXZ');
        q.setFromEuler(e);
        sc.set(1, 0.25 + 0.75 * Math.abs(flap), 1).multiplyScalar(1.15);
        m.compose(p, q, sc);
        this.birdMesh.setMatrixAt(nb, m);
        const lit = (f.kind === 'crow' ? 0.3 : 0.55) + day * 0.6;
        this.birdMesh.setColorAt(nb, c.setRGB(base[0] * lit, base[1] * lit, base[2] * lit));
        nb++;
      }
    }
    this.birdMesh.count = nb;
    this.birdMesh.instanceMatrix.needsUpdate = true;
    if (this.birdMesh.instanceColor) this.birdMesh.instanceColor.needsUpdate = true;
    let nk = 0;
    for (const k of this.kites) {
      if (nk >= MAX_KITES) break;
      tr.point(Math.min(k.s, tr.length), k.x + Math.sin(this.time * 0.5 + k.ph) * 4, k.h + Math.sin(this.time * 0.8 + k.ph * 2) * 2.5, p, true);
      const yaw = tr.yawAt(Math.min(k.s, tr.length));
      // a kite faces the road and rocks on its string
      e.set(0.35, -yaw - Math.PI / 2, Math.sin(this.time * 1.3 + k.ph) * 0.3, 'YXZ');
      q.setFromEuler(e);
      sc.setScalar(k.size);
      m.compose(p, q, sc);
      this.kiteMesh.setMatrixAt(nk, m);
      this.kiteMesh.setColorAt(nk, c.copy(k.col).multiplyScalar(0.8 + day * 0.5));
      this.tailMesh.setMatrixAt(nk, m);
      this.tailMesh.setColorAt(nk, c.copy(k.col).multiplyScalar(0.7 + day * 0.5));
      nk++;
    }
    this.kiteMesh.count = this.tailMesh.count = nk;
    for (const im of [this.kiteMesh, this.tailMesh]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }
}
