// Rain streaks around the camera (GPU animated) + lightning.

import * as THREE from 'three';
import { fx, damp } from '../core/util.js';
import { shared } from '../world/materials.js';

export class Weather {
  constructor(scene) {
    const N = 7000;
    const pos = new Float32Array(N * 2 * 3);
    const seed = new Float32Array(N * 2);
    const end = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const x = (fx.next() - 0.5) * 60, y = fx.next() * 30, z = (fx.next() - 0.5) * 60;
      for (let k = 0; k < 2; k++) {
        pos.set([x, y, z], (i * 2 + k) * 3);
        seed[i * 2 + k] = fx.next();
        end[i * 2 + k] = k;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('isEnd', new THREE.BufferAttribute(end, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.uniforms = {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uVel: { value: new THREE.Vector3() },
      uAmount: { value: 0 },
      uLight: shared.uSpriteLight,
      uLampAdd: shared.uLampAdd,
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        attribute float seed; attribute float isEnd;
        uniform float uTime, uAmount; uniform vec3 uCam, uVel;
        varying float vA;
        void main(){
          vec3 p = position;
          float fall = 22.0 + seed * 8.0;
          p.y = mod(p.y - uTime * fall, 30.0) - 8.0;
          // wrap around the camera
          p.x = mod(p.x - uCam.x + 30.0, 60.0) - 30.0 + uCam.x;
          p.z = mod(p.z - uCam.z + 30.0, 60.0) - 30.0 + uCam.z;
          p.y += uCam.y;
          // streak along apparent velocity (fall + our motion)
          vec3 dir = normalize(vec3(-uVel.x * 0.04, -1.0, -uVel.z * 0.04));
          p += dir * isEnd * (0.7 + seed * 0.5);
          // half the streaks of before (art direction: rain as a few graphic lines, not a grey sheet)
          vA = step(seed, uAmount * 0.5) * 0.5;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uLight, uLampAdd;
        varying float vA;
        void main(){
          if (vA <= 0.0) discard;
          gl_FragColor = vec4((uLight * 0.6 + uLampAdd * 0.4 + 0.08) * vA, vA);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.lines = new THREE.LineSegments(g, mat);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 9;
    scene.add(this.lines);
    this.rain = 0;
    this.flash = 0;
    this.nextBolt = 6;
    this.storm = false;
    this.bolts = [];
  }

  update(dt, camera, vel, rainTarget, storm) {
    this.rain = damp(this.rain, rainTarget, 0.8, dt);
    this.storm = storm;
    this.uniforms.uTime.value += dt;
    this.uniforms.uCam.value.copy(camera.position);
    this.uniforms.uVel.value.copy(vel);
    this.uniforms.uAmount.value = this.rain;
    this.lines.visible = this.rain > 0.02;
    this.flash = Math.max(0, this.flash - dt * 3.2);
    let thunder = null;
    if (storm && this.rain > 0.3) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = 5 + fx.next() * 9;
        this.flash = 0.9;
        thunder = 0.6 + fx.next() * 1.5; // delay in seconds
        // double flicker
        setTimeout(() => { this.flash = Math.max(this.flash, 0.6); }, 120);
      }
    }
    return thunder;
  }
}
