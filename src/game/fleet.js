// The field, drawn: one instanced mesh per car model (body, tail and head
// lights), filled each frame from a list of cars in road space.
// A car here is { model, md, track, s, x, yaw, roll, color, brake }.

import * as THREE from 'three';
import { buildRacerModels } from './carmodels.js';
import { shared } from '../world/materials.js';

const MAX_PER_MODEL = 24;

export class Fleet {
  constructor(scene, assets, world) {
    this.models = buildRacerModels(assets.fx);
    this.meshes = {};
    this.tailMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.headMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const white = new THREE.Color(1, 1, 1);
    const mk = (geo, mat) => {
      if (!geo) return null;
      const im = new THREE.InstancedMesh(geo, mat, MAX_PER_MODEL);
      im.count = 0;
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < MAX_PER_MODEL; i++) im.setColorAt(i, white);
      im.instanceColor.setUsage(THREE.DynamicDrawUsage);
      scene.add(im);
      return im;
    };
    for (const key in this.models) {
      const m = this.models[key];
      this.meshes[key] = { body: mk(m.body, world.mats.fx), tail: mk(m.tail, this.tailMat), head: mk(m.head, this.headMat) };
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this._c = new THREE.Color();
  }

  md(model) { return this.models[model]; }

  render(cars, player, night, camS, camX) {
    const counts = {};
    for (const key in this.meshes) counts[key] = 0;
    const m = this._m, q = this._q, e = this._e, p = this._p, c = this._c;
    const tailK = 0.35 + night * 0.65;
    // kept under the bloom threshold: from beside or behind, headlights should read as lamps, not flares
    const headK = 0.35 + night * 0.4;
    const bodyK = 1 + night * 1.6;
    const lights = [];
    for (const v of cars) {
      const M = this.meshes[v.model];
      if (!M || !v.track) continue;
      // never let a car swallow the chase camera
      if (v.track === player.track && v.s > camS - v.md.len / 2 - 1.5 && v.s < player.s - player.halfL && Math.abs(v.x - camX) < v.md.wid / 2 + 1.3) continue;
      const i = counts[v.model];
      if (i >= MAX_PER_MODEL) continue;
      counts[v.model]++;
      v.track.point(v.s, v.x, 0, p);
      e.set(0, -(v.track.yawAt(v.s) + (v.yaw || 0)), v.roll || 0, 'YXZ');
      q.setFromEuler(e);
      m.compose(p, q, this._s);
      M.body.setMatrixAt(i, m);
      M.body.setColorAt(i, c.copy(v.color).multiplyScalar(bodyK));
      if (M.tail) { M.tail.setMatrixAt(i, m); M.tail.setColorAt(i, c.setScalar(v.brake ? 2.2 : tailK)); }
      if (M.head) { M.head.setMatrixAt(i, m); M.head.setColorAt(i, c.setScalar(headK)); }
      if (v.track === player.track) {
        const d = v.s - player.s;
        if (d > -2 && d < 140) lights.push({ d, s: v.s, x: v.x, k: v.brake ? 1.4 : tailK * 0.7 });
      }
    }
    for (const key in this.meshes) {
      for (const im of Object.values(this.meshes[key])) {
        if (!im) continue;
        im.count = counts[key];
        im.instanceMatrix.needsUpdate = true;
        im.instanceColor.needsUpdate = true;
      }
    }
    // the nearest tail lights glow on the road at night
    lights.sort((a, b) => a.d - b.d);
    const U = shared.uCars.value;
    for (let i = 0; i < 8; i++) {
      const l = lights[i];
      if (l && night > 0.05) U[i].set(l.s, l.x, l.k * night, 0);
      else U[i].set(0, 0, 0, 0);
    }
  }
}
