// Every car on the road, drawn: one instanced mesh per model (body plus tail,
// head, hazard and beacon lights), filled each frame from a list of cars in
// road space. A car here is { model, md, track, s, x, yaw, roll, pitch, lift,
// color, brake, beacon, wreck } (see race.js for the field, traffic.js for the rest).

import * as THREE from 'three';
import { buildFxModels } from './carmodels.js';
import { buildTrafficModels } from './vehicles.js';
import { shared } from '../world/materials.js';

const MAX_PER_MODEL = 24;

// Cars are drawn with their own copy of the world's materials, with a night lift: a glow in the car's own colour
// plus a little cold light, so a dark car in a dark street is still a car and not a hole in the road. Only dark
// paints get the colour glow: on white, yellow or pastel cars it pushed them past the bloom threshold and they shone.
function carMaterial(src, lift) {
  const m = src.clone();
  m.onBeforeCompile = (shader) => {
    src.onBeforeCompile(shader);
    shader.uniforms.uCarLift = lift;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', ['#include <common>', 'uniform float uCarLift;'].join('\n'))
      .replace(/vec3 outgoingLight = /, ['float carLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));', 'reflectedLight.indirectDiffuse += (diffuseColor.rgb * 0.8 * (1.0 - smoothstep(0.12, 0.45, carLum)) + vec3(0.05, 0.055, 0.07)) * uCarLift;', '\tvec3 outgoingLight = '].join('\n'));
  };
  m.customProgramCacheKey = () => 'car' + (src.customProgramCacheKey ? src.customProgramCacheKey() : '');
  return m;
}

export class Fleet {
  constructor(scene, assets, world) {
    this.models = { ...buildTrafficModels(assets.misc), ...buildFxModels(assets.fx) };
    this.meshes = {};
    this.lift = { value: 0 };
    const carMats = { fx: carMaterial(world.mats.fx, this.lift), misc: carMaterial(world.mats.misc, this.lift) };
    this.tailMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.headMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.amberMat = new THREE.MeshBasicMaterial({ vertexColors: true });
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
      this.meshes[key] = {
        body: mk(m.body, m.atlas === 'fx' ? carMats.fx : carMats.misc),
        tail: mk(m.tail, this.tailMat),
        head: mk(m.head, this.headMat),
        amber: mk(m.amber, this.amberMat),
        beacon: mk(m.beacon, this.amberMat),
      };
    }
    this.time = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this._c = new THREE.Color();
  }

  md(model) { return this.models[model]; }

  render(dt, cars, player, night, camS, camX) {
    this.time += dt;
    const counts = {};
    for (const key in this.meshes) counts[key] = 0;
    const m = this._m, q = this._q, e = this._e, p = this._p, c = this._c;
    const tailK = 0.35 + night * 0.65;
    // kept under the bloom threshold: from beside or behind, headlights should read as lamps, not flares
    const headK = 0.35 + night * 0.4;
    // body brightness at night: lifted enough to read, but capped so pale cars and the plain-bodied models do not blow
    // out into flat blobs, and with a floor so dark paint is a deep colour rather than a hole in the road
    this.lift.value = night * 1.0;
    const bodyK = 1 + night * 0.8;
    const floor = 0.1 * night;
    const CAP = 1.6;
    const shade = (col, k) => {
      c.copy(col).multiplyScalar(k);
      const top = Math.max(c.r, c.g, c.b);
      if (top > CAP) c.multiplyScalar(CAP / top);
      c.r = Math.max(c.r, floor * 0.9); c.g = Math.max(c.g, floor * 0.9); c.b = Math.max(c.b, floor * 1.3);
      return c;
    };
    const white1 = this._w || (this._w = new THREE.Color(1, 1, 1));
    const flash = Math.sin(this.time * 14) > 0;
    const lights = [];
    for (const v of cars) {
      const M = this.meshes[v.model];
      if (!M || !v.track) continue;
      // never let a car swallow the chase camera
      if (v.track === player.track && v.s > camS - v.md.len / 2 - 1.5 && v.s < player.s - player.halfL && Math.abs(v.x - camX) < v.md.wid / 2 + 1.3) continue;
      const i = counts[v.model];
      if (i >= MAX_PER_MODEL) continue;
      counts[v.model]++;
      v.track.point(v.s, v.x, v.lift || 0, p);
      e.set(v.pitch || 0, -(v.track.yawAt(v.s) + (v.yaw || 0)), v.roll || 0, 'YXZ');
      q.setFromEuler(e);
      m.compose(p, q, this._s);
      const wreck = !!v.wreck;
      M.body.setMatrixAt(i, m);
      // racers glow a little brighter than the traffic around them
      const k = (wreck ? 0.45 : 1) * bodyK * (v.rival ? 1.25 : 1);
      M.body.setColorAt(i, shade(v.md.colorFixed ? white1 : v.color, k));
      if (M.tail) { M.tail.setMatrixAt(i, m); M.tail.setColorAt(i, c.setScalar(wreck ? 0.05 : v.brake ? 2.2 : tailK * (v.rival ? 1.4 : 1))); }
      if (M.head) { M.head.setMatrixAt(i, m); M.head.setColorAt(i, c.setScalar(wreck ? 0 : headK)); }
      if (M.amber) { M.amber.setMatrixAt(i, m); M.amber.setColorAt(i, c.setScalar(wreck ? (flash ? 1 : 0) : 0.25 + night * 0.6)); }
      if (M.beacon) {
        M.beacon.setMatrixAt(i, m);
        M.beacon.setColorAt(i, wreck ? c.setScalar(0.05) : flash === (v.s % 2 > 1) ? c.setRGB(0.1, 0.2, 1.6) : c.setRGB(1.6, 0.1, 0.1));
      }
      if (v.track === player.track && !wreck) {
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
