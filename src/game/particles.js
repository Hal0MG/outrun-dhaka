// CPU particle systems rendered as Points. Two pools: additive (sparks,
// flames, fireworks) and soft alpha (smoke, dust, spray, petals, confetti).

import * as THREE from 'three';
import { fx } from '../core/util.js';
import { shared } from '../world/materials.js';

class Pool {
  constructor(scene, max, additive) {
    this.max = max;
    this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.kind = new Uint8Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('color', this.aCol);
    g.setAttribute('size', this.aSize);
    g.setAttribute('alpha', this.aAlpha);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 }, uFogColor: shared.uFogColor, uFogDensity: shared.uFogDensity, uLight: shared.uSpriteLight },
      vertexShader: /* glsl */ `
        attribute float size; attribute float alpha; attribute vec3 color;
        uniform float uScale;
        varying vec3 vCol; varying float vA; varying float vFog;
        void main(){
          vCol = color; vA = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vFog = -mv.z;
          gl_PointSize = size * uScale / max(1.0, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: additive ? /* glsl */ `
        uniform float uFogDensity;
        varying vec3 vCol; varying float vA; varying float vFog;
        void main(){
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float d = dot(p, p);
          if (d > 1.0) discard;
          float a = (1.0 - d) * (1.0 - d) * vA;
          float f = exp(-uFogDensity * uFogDensity * vFog * vFog * 0.6);
          gl_FragColor = vec4(vCol * a * f, 1.0);
        }` : /* glsl */ `
        uniform vec3 uFogColor; uniform float uFogDensity; uniform vec3 uLight;
        varying vec3 vCol; varying float vA; varying float vFog;
        void main(){
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float d = dot(p, p);
          if (d > 1.0) discard;
          float a = (1.0 - d) * vA;
          float f = 1.0 - exp(-uFogDensity * uFogDensity * vFog * vFog);
          vec3 c = mix(vCol * (0.1 + 0.9 * min(uLight, vec3(1.2))), uFogColor, f);
          gl_FragColor = vec4(c, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 8 : 7;
    scene.add(this.points);
    this.mat = mat;
  }

  add(x, y, z, vx, vy, vz, r, g, b, size, life, opts = {}) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.size[i] = size;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.grav[i] = opts.grav ?? 0;
    this.drag[i] = opts.drag ?? 0.5;
    this.grow[i] = opts.grow ?? 0;
    this.a0[i] = opts.alpha ?? 1;
    this.alpha[i] = opts.alpha ?? 1;
    this.kind[i] = opts.kind ?? 0;
  }

  update(dt, onDie) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        if (onDie && this.kind[i]) onDie(this, i);
        // swap with last
        const j = --this.n;
        if (i !== j) {
          for (let k = 0; k < 3; k++) {
            this.pos[i * 3 + k] = this.pos[j * 3 + k];
            this.vel[i * 3 + k] = this.vel[j * 3 + k];
            this.col[i * 3 + k] = this.col[j * 3 + k];
          }
          this.size[i] = this.size[j]; this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j];
          this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j]; this.grow[i] = this.grow[j];
          this.a0[i] = this.a0[j]; this.alpha[i] = this.alpha[j]; this.kind[i] = this.kind[j];
        }
        continue;
      }
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= dr; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt; this.vel[i * 3 + 2] *= dr;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = this.a0[i] * Math.min(1, t * 2.5) * (this.kind[i] === 3 ? 1 : 1);
      i++;
    }
    this.points.geometry.setDrawRange(0, this.n);
    this.aPos.needsUpdate = true;
    this.aCol.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
  }
}

const FW_COLORS = [[3, 0.4, 0.3], [3, 2.2, 0.4], [0.4, 3, 0.8], [0.5, 1.2, 3], [3, 0.4, 2.4], [3, 3, 3], [0.2, 2.6, 0.6]];

export class Particles {
  constructor(scene) {
    this.add = new Pool(scene, 5000, true);
    this.soft = new Pool(scene, 3000, false);
    this.time = 0;
  }

  setScale(h, fov) {
    const s = h / (2 * Math.tan((fov * Math.PI) / 360));
    this.add.mat.uniforms.uScale.value = s;
    this.soft.mat.uniforms.uScale.value = s;
  }

  smoke(p, v, amt = 1, col = [0.82, 0.82, 0.84]) {
    this.soft.add(p.x + (fx.next() - 0.5) * 0.4, p.y + 0.2, p.z + (fx.next() - 0.5) * 0.4,
      v.x * 0.3 + (fx.next() - 0.5) * 1.5, 0.6 + fx.next() * 1.2, v.z * 0.3 + (fx.next() - 0.5) * 1.5,
      col[0], col[1], col[2], 0.8 + fx.next() * 0.6, 1.2 + fx.next() * 0.8, { grow: 2.4, drag: 1.4, alpha: 0.45 * amt });
  }

  dust(p, v) {
    this.soft.add(p.x + (fx.next() - 0.5) * 0.6, p.y + 0.15, p.z + (fx.next() - 0.5) * 0.6,
      v.x * 0.4 + (fx.next() - 0.5) * 2, 0.8 + fx.next() * 1.5, v.z * 0.4 + (fx.next() - 0.5) * 2,
      0.55, 0.45, 0.32, 0.7, 1.0 + fx.next() * 0.6, { grow: 2.6, drag: 1.2, alpha: 0.5 });
  }

  spray(p, v, amt = 1) {
    for (let i = 0; i < 1; i++) {
      this.soft.add(p.x + (fx.next() - 0.5) * 0.5, p.y + 0.1, p.z + (fx.next() - 0.5) * 0.5,
        v.x * 0.5 + (fx.next() - 0.5) * 3, 1 + fx.next() * 2.5, v.z * 0.5 + (fx.next() - 0.5) * 3,
        0.75, 0.8, 0.88, 0.16 + fx.next() * 0.2, 0.35 + fx.next() * 0.3, { grow: 0.9, drag: 1.4, grav: 7, alpha: 0.16 * amt });
    }
  }

  sparks(p, dir) {
    for (let i = 0; i < 4; i++) {
      this.add.add(p.x, p.y + 0.3, p.z,
        dir.x * 6 + (fx.next() - 0.5) * 6, 2 + fx.next() * 4, dir.z * 6 + (fx.next() - 0.5) * 6,
        3, 1.6, 0.4, 0.09 + fx.next() * 0.06, 0.25 + fx.next() * 0.3, { grav: 14, drag: 0.6 });
    }
  }

  backfire(p, back) {
    for (let i = 0; i < 14; i++) {
      const hot = fx.next();
      this.add.add(p.x, p.y, p.z,
        back.x * (4 + fx.next() * 6) + (fx.next() - 0.5) * 1.5, (fx.next() - 0.3) * 1.5, back.z * (4 + fx.next() * 6) + (fx.next() - 0.5) * 1.5,
        3, 1.2 + hot, 0.3 + hot * 1.5, 0.22 + fx.next() * 0.2, 0.12 + fx.next() * 0.12, { drag: 3 });
    }
  }

  jet(p, back, k = 1) {
    this.add.add(p.x + (fx.next() - 0.5) * 0.1, p.y + (fx.next() - 0.5) * 0.1, p.z + (fx.next() - 0.5) * 0.1,
      back.x * 14 * k, 0, back.z * 14 * k, 0.6, 1.6, 3, 0.35, 0.12, { drag: 2 });
    this.add.add(p.x, p.y, p.z, back.x * 9 * k, 0, back.z * 9 * k, 3, 1.4, 0.4, 0.25, 0.1, { drag: 2 });
  }

  firework(x, y, z) {
    // rocket that bursts when it dies (kind=1)
    const c = FW_COLORS[(fx.next() * FW_COLORS.length) | 0];
    this.add.add(x, y, z, (fx.next() - 0.5) * 4, 38 + fx.next() * 18, (fx.next() - 0.5) * 4, 3, 2, 1, 0.5, 1.2 + fx.next() * 0.6, { grav: 18, drag: 0.1, kind: 1 });
    this._nextColor = c;
  }

  burst(x, y, z, c) {
    const n = 90;
    for (let i = 0; i < n; i++) {
      const u = fx.next() * 2 - 1, th = fx.next() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const sp = 16 + fx.next() * 6;
      this.add.add(x, y, z, Math.cos(th) * r * sp, u * sp, Math.sin(th) * r * sp, c[0], c[1], c[2], 1.0, 1.4 + fx.next() * 0.8, { grav: 6, drag: 1.4 });
    }
    // glitter
    for (let i = 0; i < 24; i++) {
      this.add.add(x, y, z, (fx.next() - 0.5) * 30, (fx.next() - 0.5) * 30, (fx.next() - 0.5) * 30, 3, 3, 2.4, 0.4, 2.0 + fx.next(), { grav: 4, drag: 1.8 });
    }
  }

  flame(x, y, z) {
    // Shakrain fire-breather
    for (let i = 0; i < 26; i++) {
      this.add.add(x, y, z, (fx.next() - 0.5) * 3, 6 + fx.next() * 7, (fx.next() - 0.5) * 3, 3, 1.1 + fx.next() * 0.8, 0.2, 0.9 + fx.next() * 0.8, 0.5 + fx.next() * 0.4, { grav: -2, drag: 1.5, grow: 1.5 });
    }
  }

  confetti(x, y, z) {
    const cols = [[0.9, 0.1, 0.2], [1, 0.7, 0.05], [0.1, 0.65, 0.3], [1, 0.3, 0.6], [0.2, 0.5, 0.95], [1, 1, 1]];
    for (let i = 0; i < 120; i++) {
      const c = cols[(fx.next() * cols.length) | 0];
      this.soft.add(x + (fx.next() - 0.5) * 16, y + fx.next() * 3, z + (fx.next() - 0.5) * 4, (fx.next() - 0.5) * 6, fx.next() * 6, (fx.next() - 0.5) * 6, c[0], c[1], c[2], 0.16, 2.5 + fx.next() * 1.5, { grav: 3, drag: 1.2, alpha: 1 });
    }
  }

  petals(x, y, z, wind) {
    this.soft.add(x, y, z, wind.x + (fx.next() - 0.5) * 2, -0.6 - fx.next(), wind.z + (fx.next() - 0.5) * 2, 0.95, 0.15, 0.08, 0.14, 4 + fx.next() * 2, { drag: 0.3, alpha: 1 });
  }

  kilnSmoke(x, y, z) {
    this.soft.add(x + (fx.next() - 0.5), y, z + (fx.next() - 0.5), 1.5 + fx.next(), 2 + fx.next() * 1.5, 0.5, 0.32, 0.3, 0.3, 3, 9, { grow: 4, drag: 0.15, alpha: 0.35 });
  }

  update(dt) {
    this.time += dt;
    this.add.update(dt, (pool, i) => {
      if (pool.kind[i] === 1) this.burst(pool.pos[i * 3], pool.pos[i * 3 + 1], pool.pos[i * 3 + 2], FW_COLORS[(fx.next() * FW_COLORS.length) | 0]);
    });
    this.soft.update(dt);
  }
}
