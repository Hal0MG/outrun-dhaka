// Rain beading on the player's car: a scatter of tiny bright droplets sitting on the real surface of the body
// (found once, by casting rays down onto it), which come and go, more of them the harder it rains.

import * as THREE from 'three';
import { fx } from '../core/util.js';

const POOL = 360; // places on the body a drop can sit
const DROPS = 90; // drops shown at most

export class CarDrops {
  constructor(car) {
    this.car = car;
    this.spots = this.findSpots(car);
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(DROPS * 3);
    this.life = new Float32Array(DROPS);
    this.size = new Float32Array(DROPS);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    const mat = new THREE.PointsMaterial({ color: 0xcfeaff, size: 0.04, sizeAttenuation: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    car.group.add(this.points);
    for (let i = 0; i < DROPS; i++) this.respawn(i, true);
  }

  // cast rays down onto the body, in the car's own frame, to find real places for drops
  findSpots(car) {
    const grp = car.group;
    const keep = { p: grp.position.clone(), q: grp.quaternion.clone(), s: grp.scale.clone() };
    grp.position.set(0, 0, 0); grp.quaternion.identity(); grp.scale.set(1, 1, 1);
    grp.updateMatrixWorld(true);
    const { len, wid, hgt } = car.dims;
    const ray = new THREE.Raycaster();
    const spots = [];
    const down = new THREE.Vector3(0, -1, 0);
    for (let i = 0; i < POOL * 3 && spots.length < POOL; i++) {
      const x = (fx.next() - 0.5) * wid * 0.92, z = (fx.next() - 0.5) * len * 0.96;
      ray.set(new THREE.Vector3(x, hgt + 1.5, z), down);
      const hit = ray.intersectObject(grp, true).find((h) => h.object.isMesh && !h.object.userData.noDrops && h.point.y > hgt * 0.25);
      if (hit) spots.push(new THREE.Vector3(hit.point.x, hit.point.y + 0.012, hit.point.z));
    }
    grp.position.copy(keep.p); grp.quaternion.copy(keep.q); grp.scale.copy(keep.s);
    grp.updateMatrixWorld(true);
    return spots;
  }

  respawn(i, scatter) {
    if (!this.spots.length) return;
    const sp = this.spots[(fx.next() * this.spots.length) | 0];
    this.pos[i * 3] = sp.x; this.pos[i * 3 + 1] = sp.y; this.pos[i * 3 + 2] = sp.z;
    this.life[i] = scatter ? fx.next() * 3 : 1.5 + fx.next() * 3.5;
  }

  update(dt, rain) {
    const n = this.spots.length ? Math.round(DROPS * Math.min(1, rain * 1.3)) : 0;
    this.points.visible = n > 0;
    if (!n) return;
    for (let i = 0; i < DROPS; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) this.respawn(i, false);
    }
    this.points.geometry.setDrawRange(0, n);
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
