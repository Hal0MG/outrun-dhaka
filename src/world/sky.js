// Sky dome (gradient, banded OutRun sun, painterly cloud streaks, smoggy
// stars, moon, city glow) and the distant Dhaka skyline ring.

import * as THREE from 'three';
import { buildSkyline } from './textures.js';

export class Sky {
  constructor(scene) {
    this.uniforms = {
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uGround: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 0.1, -1) },
      uSunTop: { value: new THREE.Color() },
      uSunBot: { value: new THREE.Color() },
      uSunGlow: { value: new THREE.Color() },
      uSunVis: { value: 1 },
      uSunSize: { value: 0.06 },
      uMoonDir: { value: new THREE.Vector3(0.3, 0.4, -1) },
      uMoonVis: { value: 0 },
      uStars: { value: 0 },
      uCloud: { value: new THREE.Color() },
      uCloudAmt: { value: 0.6 },
      uCity: { value: new THREE.Color() },
      uTime: { value: 0 },
      uFlash: { value: 0 },
      uRain: { value: 0 },
    };
    const geo = new THREE.SphereGeometry(4000, 48, 24);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main(){
          vDir = position;
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenith, uHorizon, uGround, uSunDir, uSunTop, uSunBot, uSunGlow, uMoonDir, uCloud, uCity;
        uniform float uSunVis, uSunSize, uMoonVis, uStars, uCloudAmt, uTime, uFlash, uRain;
        varying vec3 vDir;
        float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
          return mix(mix(h12(i),h12(i+vec2(1,0)),u.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x), u.y); }
        float fbm(vec2 p){ float s=0., a=0.5; for(int i=0;i<5;i++){ s+=a*vn(p); p*=2.03; a*=0.5; } return s; }
        void main(){
          vec3 d = normalize(vDir);
          float e = d.y;
          float t = clamp(e, 0.0, 1.0);
          vec3 col = mix(uHorizon, uZenith, pow(max(smoothstep(0.0, 0.62, t), 1e-4), 0.55));
          // warm band hugging the horizon
          col = mix(col, uHorizon * 1.08, exp(-max(e, 0.0) * 22.0) * 0.5);
          // sun-side horizon glow
          vec2 dz = normalize(d.xz + 1e-5);
          vec2 sz = normalize(uSunDir.xz + 1e-5);
          float az = max(0.0, dot(dz, sz));
          col += uSunGlow * pow(clamp(az, 0.0, 1.0), 5.0) * exp(-max(e - uSunDir.y, 0.0) * 6.0) * 0.55 * (0.35 + 0.65 * uSunVis);
          // city light pollution glow
          col += uCity * exp(-abs(e) * 9.0) * 1.3;
          if (e < 0.0) col = mix(col, uGround, smoothstep(0.0, 0.12, -e));

          // clouds: long painted streaks near the horizon + some higher puffs
          float azAng = atan(d.x, d.z + 1e-6);
          vec2 cp = vec2(azAng * 3.2, e * 26.0);
          float c1 = fbm(cp * vec2(1.0, 1.0) + vec2(uTime * 0.004, 0.0));
          float band = smoothstep(0.015, 0.06, e) * (1.0 - smoothstep(0.16, 0.34, e));
          float cl = smoothstep(0.52, 0.75, c1) * band * uCloudAmt;
          vec2 cp2 = d.xz / max(e, 0.05) * 0.35;
          float c2 = smoothstep(0.58, 0.82, fbm(cp2 + vec2(uTime * 0.003, 3.0))) * smoothstep(0.08, 0.3, e) * uCloudAmt * 0.7;
          cl = max(cl, c2) + uRain * 0.6 * smoothstep(0.0, 0.3, e) * fbm(cp2 * 1.5);
          float lit = az * az;
          vec3 ccol = mix(uCloud * 0.55, uCloud * 1.25 + uSunGlow * 0.25, lit);
          col = mix(col, ccol, clamp(cl, 0.0, 1.0));

          // stars (few: Dhaka smog)
          if (uStars > 0.01 && e > 0.02) {
            vec2 sp = vec2(azAng * 180.0, asin(e) * 180.0);
            vec2 cell = floor(sp);
            float r = h12(cell);
            if (r > 0.985) {
              vec2 f = fract(sp) - 0.5;
              float tw = 0.6 + 0.4 * sin(uTime * (2.0 + r * 5.0) + r * 40.0);
              col += vec3(1.0, 0.95, 0.85) * smoothstep(0.18, 0.0, length(f)) * uStars * tw * (1.0 - cl) * smoothstep(0.02, 0.2, e);
            }
          }

          // moon
          float md = acos(clamp(dot(d, normalize(uMoonDir)), -1.0, 1.0));
          float mdisc = 1.0 - smoothstep(0.024, 0.027, md);
          vec2 mp = vec2(dot(d, normalize(cross(uMoonDir, vec3(0.,1.,0.)))), d.y - uMoonDir.y) * 60.0;
          float crater = 0.85 + 0.15 * fbm(mp * 2.0);
          col = mix(col, vec3(1.0, 0.97, 0.88) * crater * 1.6, mdisc * uMoonVis * (1.0 - cl * 0.8));
          col += vec3(0.6, 0.65, 0.8) * exp(-md * 18.0) * 0.18 * uMoonVis;

          // the sun: big disc, horizontal cut bands in the lower half (OutRun)
          vec3 sd = normalize(uSunDir);
          float sang = acos(clamp(dot(d, sd), -1.0, 1.0));
          float v = (e - sd.y) / uSunSize;
          float disc = 1.0 - smoothstep(uSunSize - 0.0015, uSunSize + 0.0005, sang);
          float gap = clamp((0.25 - v) * 0.42, 0.0, 0.55);
          float stripes = step(gap, fract(v * 5.5 + uTime * 0.04));
          disc *= mix(1.0, stripes, step(v, 0.25));
          vec3 sunCol = mix(uSunBot, uSunTop, smoothstep(-1.0, 0.9, v));
          float visible = smoothstep(-0.006, 0.004, e);
          col = mix(col, sunCol * 2.6, disc * uSunVis * visible * (1.0 - cl * 0.85));
          col += uSunGlow * exp(-sang * 9.0) * 0.45 * uSunVis;
          col += uSunGlow * exp(-sang * 40.0) * 0.6 * uSunVis;

          col += vec3(0.75, 0.8, 1.0) * uFlash;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    // skyline ring
    this.skylineCache = {};
    this.ringU = {
      uTexA: { value: null },
      uTexB: { value: null },
      uMix: { value: 0 },
      uNear: { value: new THREE.Color() },
      uFar: { value: new THREE.Color() },
      uWin: { value: new THREE.Color('#ffc27a') },
      uGlow: { value: 0 },
      uFog: { value: new THREE.Color() },
      uFlash: { value: 0 },
    };
    const ringGeo = new THREE.CylinderGeometry(2600, 2600, 420, 96, 1, true);
    ringGeo.translate(0, 210 - 40, 0);
    const ringMat = new THREE.ShaderMaterial({
      uniforms: this.ringU,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTexA, uTexB;
        uniform float uMix, uGlow, uFlash;
        uniform vec3 uNear, uFar, uWin, uFog;
        varying vec2 vUv;
        void main(){
          vec2 uv = vec2(vUv.x * 2.0, vUv.y * 1.65);
          if (uv.y > 1.0) discard;
          vec4 a = texture2D(uTexA, uv);
          vec4 b = texture2D(uTexB, uv);
          vec4 s = mix(a, b, uMix);
          float near = s.r, far = s.g, win = s.b;
          float al = max(near, far * 0.85);
          if (al < 0.02) discard;
          vec3 col = mix(uFar, uNear, near);
          col += uWin * win * uGlow * 1.4 * near;
          col += uFlash * 0.2;
          gl_FragColor = vec4(col, al);
        }`,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.renderOrder = -9;
    this.ring.frustumCulled = false;
    scene.add(this.ring);
    this.currentSkyline = null;
  }

  skylineTex(type) {
    if (!this.skylineCache[type]) {
      const cv = buildSkyline(type, 3);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.NoColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.anisotropy = 4;
      this.skylineCache[type] = t;
    }
    return this.skylineCache[type];
  }

  setSkyline(type, instant = false) {
    if (this.currentSkyline === type) return;
    const tex = this.skylineTex(type);
    if (instant || !this.ringU.uTexA.value) {
      this.ringU.uTexA.value = tex;
      this.ringU.uTexB.value = tex;
      this.ringU.uMix.value = 0;
    } else {
      // start a crossfade from whatever is showing
      if (this.ringU.uMix.value > 0.5) this.ringU.uTexA.value = this.ringU.uTexB.value;
      this.ringU.uTexB.value = tex;
      this.ringU.uMix.value = 0;
      this.fading = true;
    }
    this.currentSkyline = type;
  }

  update(dt, camera, S, time, flash, rain) {
    const u = this.uniforms;
    u.uZenith.value.copy(S.zen);
    u.uHorizon.value.copy(S.hor);
    u.uGround.value.copy(S.fog).multiplyScalar(0.8);
    u.uSunDir.value.copy(S.sunDir);
    u.uSunTop.value.copy(S.sunTop);
    u.uSunBot.value.copy(S.sunBot);
    u.uSunGlow.value.copy(S.sun).multiplyScalar(0.9);
    u.uSunVis.value = S.sunVis;
    u.uSunSize.value = S.sunSize;
    u.uMoonDir.value.copy(S.moonDir);
    u.uMoonVis.value = S.moonVis;
    u.uStars.value = S.stars;
    u.uCloud.value.copy(S.cloud);
    u.uCity.value.copy(S.city);
    u.uTime.value = time;
    u.uFlash.value = flash;
    u.uRain.value = rain;
    this.mesh.position.copy(camera.position);

    const r = this.ringU;
    this.ring.position.set(camera.position.x, camera.position.y - 6, camera.position.z);
    // silhouettes: darker than the horizon, far layer hazier
    r.uFar.value.copy(S.hor).lerp(S.fog, 0.4).multiplyScalar(0.78);
    r.uNear.value.copy(S.hor).lerp(S.zen, 0.35).multiplyScalar(0.42);
    r.uFog.value.copy(S.fog);
    r.uGlow.value = S.glow;
    r.uFlash.value = flash;
    if (this.fading) {
      r.uMix.value = Math.min(1, r.uMix.value + dt * 0.4);
      if (r.uMix.value >= 1) {
        r.uTexA.value = r.uTexB.value;
        r.uMix.value = 0;
        this.fading = false;
      }
    }
  }
}
