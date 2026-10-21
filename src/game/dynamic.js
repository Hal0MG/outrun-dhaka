// Moving set pieces: metro trains on the viaduct, intercity trains, landing
// planes, Shakrain kites.

import * as THREE from 'three';
import { MeshBuilder } from '../world/builder.js';
import { SpriteBatch } from '../world/sprites.js';
import { medianW } from '../world/chunk.js';
import { fx, RNG } from '../core/util.js';

export function buildMetroTrain(misc, mats) {
  const B = new MeshBuilder(true);
  const G = new MeshBuilder(false);
  const side = misc.get('mrt_side');
  const cars = 6, L = 22, W = 2.9, H = 3.3;
  for (let i = 0; i < cars; i++) {
    const z = i * (L + 0.6);
    B.box(0, 0.6, z, W, H, L, 0, { regions: { side, front: misc.get('white'), back: misc.get('white'), top: misc.get('metal') }, color: [1, 1, 1] });
    G.box(0, 2.1, z, W + 0.04, 0.9, L - 3, 0, { color: [1.6, 1.8, 1.9] });
  }
  // nose lights
  G.box(-0.8, 1.2, -L / 2 - 0.05, 0.4, 0.2, 0.05, 0, { color: [3, 3, 2.6] });
  G.box(0.8, 1.2, -L / 2 - 0.05, 0.4, 0.2, 0.05, 0, { color: [3, 3, 2.6] });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(B.build(), mats.misc));
  const win = new THREE.Mesh(G.build(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  g.add(win);
  g.userData.length = cars * (L + 0.6);
  return g;
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

export class SetPieces {
  constructor(scene, assets, mats) {
    this.scene = scene;
    this.assets = assets;
    this.mats = mats;
    this.trains = [];
    this.planes = [];
    this.kites = null;
    this.trainProto = buildMetroTrain(assets.misc, mats);
    this.trainWin = this.trainProto.children[1].material;
    this.planeProto = buildPlane(assets.misc, mats);
    this.nextTrain = 4;
    this.nextPlane = 3;
    this.rng = new RNG(99);
    this.rides = [];
  }

  // a metro train running toward you on the rails you are driving on
  railTrain(track, s, x, v) {
    // keep it on the rails: find the stretch of track bed around s
    let r0 = Infinity, r1 = -Infinity;
    for (const sec of track.sections) if (sec.surface === 'rail') { r0 = Math.min(r0, sec.s0); r1 = Math.max(r1, sec.s1); }
    if (r0 === Infinity) return;
    const obj = this.trainProto.clone();
    this.scene.add(obj);
    this.trains.push({ obj, track, s: Math.min(s, r1 - 12), dir: -1, v, x, onTrack: true, len: this.trainProto.userData.length || 135, minS: r0 + 12 });
  }

  // which rail is clear for the next few hundred metres
  safeRail(track, P) {
    let best = null;
    for (const t of this.trains) {
      if (!t.onTrack || t.track !== track || t.s - 11 < P.s - 4 || t.s > P.s + 700) continue;
      if (!best || t.s < best.s) best = t;
    }
    return best ? -best.x : null;
  }

  // fairground rides announced by chunks (see world/envs.js)
  addRides(ch) {
    for (const r of ch.rides || []) {
      const g = new THREE.Group();
      g.position.set(r.pos[0], r.pos[1], r.pos[2]);
      const metal = new THREE.MeshStandardMaterial({ color: '#d8dade', metalness: 0.6, roughness: 0.4 });
      const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.6, 2.0) });
      const spin = new THREE.Group();
      g.add(spin);
      if (r.type === 'wheel') {
        g.rotation.y = -r.yaw + Math.PI / 2;
        const R = r.R;
        spin.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.35, 6, 48), metal));
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(R * 0.98, 0.12, 4, 48), glow);
        ring2.position.z = 0.6;
        spin.add(ring2);
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const sp = new THREE.Mesh(new THREE.BoxGeometry(0.15, R, 0.15), metal);
          sp.position.set(Math.cos(a) * R / 2, Math.sin(a) * R / 2, 0);
          sp.rotation.z = a - Math.PI / 2;
          spin.add(sp);
          const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 1.6), new THREE.MeshStandardMaterial({ color: ['#e4252b', '#ffb000', '#19a84a', '#22d3ee'][i % 4], roughness: 0.6 }));
          cab.position.set(Math.cos(a) * R, Math.sin(a) * R - 1.2, 0);
          cab.userData.cab = true;
          spin.add(cab);
        }
      } else if (r.type === 'carousel') {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const horse = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 1.4), new THREE.MeshStandardMaterial({ color: ['#f2f2ee', '#ffb000', '#ff2e88'][i % 3], roughness: 0.5 }));
          horse.position.set(Math.cos(a) * 7.5, 1.6, Math.sin(a) * 7.5);
          horse.rotation.y = -a;
          horse.userData.bob = i;
          spin.add(horse);
        }
      } else if (r.type === 'ship') {
        g.rotation.y = -r.yaw;
        const boat = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 12), new THREE.MeshStandardMaterial({ color: '#8a3a1a', roughness: 0.6 }));
        boat.position.y = -13;
        spin.add(boat);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 13, 0.4), metal);
        arm.position.y = -6.5;
        spin.add(arm);
      }
      this.scene.add(g);
      this.rides.push({ g, spin, ch, type: r.type, t: this.rng.next() * 10 });
    }
  }

  clear() {
    for (const r of this.rides) this.scene.remove(r.g);
    this.rides = [];
    for (const t of this.trains) this.scene.remove(t.obj);
    for (const p of this.planes) this.scene.remove(p.obj);
    this.trains = [];
    this.planes = [];
    this.clearKites();
  }

  clearKites() {
    if (this.kites) {
      this.scene.remove(this.kites);
      this.kites.geometry.dispose();
      this.kites = null;
    }
  }

  spawnKites(track, s0, s1, spriteMat) {
    this.clearKites();
    const sb = new SpriteBatch(this.assets.sprites);
    const tmp = new THREE.Vector3();
    for (let i = 0; i < 70; i++) {
      const s = this.rng.range(s0, s1);
      const x = this.rng.sign() * this.rng.range(12, 140);
      track.point(s, x, this.rng.range(28, 90), tmp, true);
      sb.add('kite' + this.rng.int(0, 3), tmp.x, tmp.y, tmp.z, this.rng.range(1.2, 2.2), { glow: 0 });
    }
    this.kites = sb.build(spriteMat);
    if (this.kites) this.scene.add(this.kites);
  }

  update(dt, player, glow, opts) {
    const tr = player.track;
    const st = tr.stage;
    // metro trains on the viaduct
    if (st.metro) {
      this.nextTrain -= dt;
      if (this.nextTrain <= 0 && this.trains.length < 2) {
        this.nextTrain = 9 + this.rng.next() * 10;
        const dir = this.rng.chance(0.5) ? 1 : -1;
        const obj = this.trainProto.clone();
        this.scene.add(obj);
        this.trains.push({ obj, track: tr, s: dir > 0 ? player.s - 150 : player.s + 700, dir, v: dir > 0 ? 27 : 22, lane: dir > 0 ? -1.9 : 1.9 });
      }
    }
    for (let i = this.rides.length - 1; i >= 0; i--) {
      const r = this.rides[i];
      if (!r.ch.group.parent) { this.scene.remove(r.g); this.rides.splice(i, 1); continue; }
      r.t += dt;
      if (r.type === 'wheel') {
        r.spin.rotation.z = r.t * 0.12;
        for (const c of r.spin.children) if (c.userData.cab) c.rotation.z = -r.spin.rotation.z;
      } else if (r.type === 'carousel') {
        r.spin.rotation.y = r.t * 0.6;
        for (const c of r.spin.children) if (c.userData.bob != null) c.position.y = 1.6 + Math.sin(r.t * 3 + c.userData.bob) * 0.4;
      } else if (r.type === 'ship') r.spin.rotation.x = Math.sin(r.t * 0.9) * 1.0;
    }
    for (let i = this.trains.length - 1; i >= 0; i--) {
      const t = this.trains[i];
      if (t.onTrack) {
        t.s -= t.v * dt;
        if (t.track !== tr || t.s < player.s - 400 || t.s < t.minS) { this.scene.remove(t.obj); this.trains.splice(i, 1); continue; }
        t.track.point(Math.max(0, t.s), t.x, 0.15, t.obj.position);
        t.obj.rotation.set(0, -(t.track.yawAt(Math.max(0, t.s)) + Math.PI), 0);
        this.trainWin.color.setScalar(0.5 + glow * 0.8);
        continue;
      }
      t.s += t.v * t.dir * dt;
      if (t.track !== tr || t.s < player.s - 300 || t.s > player.s + 1200 || t.s > tr.length - 100) {
        this.scene.remove(t.obj);
        this.trains.splice(i, 1);
        continue;
      }
      const x = tr.halfWAt(Math.max(0, t.s)) + medianW(st) / 2 + t.lane;
      const p = tr.point(Math.max(0, t.s), x, 13.6, t.obj.position);
      const yaw = tr.yawAt(Math.max(0, t.s)) + (t.dir < 0 ? Math.PI : 0);
      t.obj.rotation.set(0, -yaw, 0);
      this.trainWin.color.setScalar(0.4 + glow * 0.8);
    }
    // planes landing over the road (airport stage)
    if (opts.planes) {
      this.nextPlane -= dt;
      if (this.nextPlane <= 0) {
        this.nextPlane = 9 + this.rng.next() * 7;
        const obj = this.planeProto.clone();
        this.scene.add(obj);
        const s = player.s + 260 + this.rng.next() * 120;
        this.planes.push({ obj, s, t: 0, track: tr });
        opts.onPlane?.();
      }
    }
    for (let i = this.planes.length - 1; i >= 0; i--) {
      const p = this.planes[i];
      p.t += dt;
      if (p.t > 14 || p.track !== tr) { this.scene.remove(p.obj); this.planes.splice(i, 1); continue; }
      // flies from the left across the road toward the runway on the right, descending
      const lat = -420 + p.t * 70;
      const h = 85 - p.t * 4.2;
      tr.point(Math.min(p.s, tr.length), lat, 0, p.obj.position, true);
      p.obj.position.y += h;
      const yaw = tr.yawAt(Math.min(p.s, tr.length)) + Math.PI / 2;
      p.obj.rotation.set(0.06, -yaw, 0.04);
    }
  }
}
