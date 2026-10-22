// Road surface: one shader does asphalt, faded markings, zebra crossings,
// Pohela Boishakh alpana, chequered lines, street-lamp pools, the player's
// headlight beam, taillight glow and wet-road light streaks. Everything is
// evaluated in road space (uv.x = lateral metres, uv.y = s metres).

import * as THREE from 'three';
import { shared } from './materials.js';
import { STEP, LANE_W } from './track.js';

const ROAD_VS = /* glsl */ `
  attribute float aHalfW;
  attribute float aLanes;
  attribute float aLocal;
  varying vec2 vRoad;
  varying float vHalfW;
  varying float vLanes;
  varying float vLocal;
  varying vec3 vWorld;
  varying float vFogDepth;
  void main() {
    vRoad = uv;
    vHalfW = aHalfW;
    vLanes = aLanes;
    vLocal = aLocal;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mv = viewMatrix * wp;
    vFogDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const ROAD_FS = /* glsl */ `
  uniform float uTime;
  uniform vec3 uAmb;
  uniform vec3 uSun;
  uniform vec3 uLampCol;
  uniform float uLamps;
  uniform float uLampSpacing;
  uniform float uLampOffset;
  uniform vec2 uLampX;
  uniform vec2 uLampOn;
  uniform float uHead;
  uniform float uPlayerS;
  uniform float uPlayerX;
  uniform float uCamS;
  uniform float uCamX;
  uniform float uCamH;
  uniform float uWet;
  uniform vec3 uSkyRefl;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform sampler2D uFeat;
  uniform float uFeatLen;
  uniform float uMarkFade;
  uniform vec4 uCars[8];
  uniform float uTwoWay;
  uniform float uFlash;
  uniform float uRain;
  uniform vec3 uTint;
  uniform float uSpill;
  uniform float uGlow;
  varying vec2 vRoad;
  varying float vHalfW;
  varying float vLanes;
  varying float vLocal;
  varying vec3 vWorld;
  varying float vFogDepth;

  float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
    return mix(mix(h12(i),h12(i+vec2(1,0)),u.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x), u.y); }

  // Pohela Boishakh alpana: lotus medallions, dotted rings, vines
  vec4 alpana(vec2 p) {
    vec2 cellSize = vec2(7.0, 7.0);
    vec2 id = floor(p / cellSize);
    vec2 q = mod(p, cellSize) - cellSize * 0.5;
    float r = length(q);
    float a = atan(q.y, q.x + 1e-5);
    float k = h12(id);
    float np = k > 0.5 ? 8.0 : 6.0;
    float petals = pow(max(abs(cos(a * np * 0.5)), 1e-4), 0.6);
    float petal = 1.0 - smoothstep(-0.03, 0.03, r - (1.0 + 1.5 * petals));
    float petalIn = 1.0 - smoothstep(-0.03, 0.03, r - (0.7 + 1.0 * petals));
    float ring = 1.0 - smoothstep(0.06, 0.12, abs(r - 2.9));
    float dots = (1.0 - smoothstep(0.1, 0.17, length(vec2(mod(a * 2.9 * 3.0, 1.0) - 0.5, (r - 3.25) * 1.2)))) ;
    float core = 1.0 - smoothstep(-0.03, 0.03, r - 0.45);
    vec3 c1, c2, c3;
    if (k < 0.33) { c1 = vec3(0.92, 0.12, 0.10); c2 = vec3(1.0, 0.72, 0.05); c3 = vec3(0.98, 0.96, 0.92); }
    else if (k < 0.66) { c1 = vec3(0.10, 0.42, 0.86); c2 = vec3(1.0, 0.25, 0.55); c3 = vec3(0.98, 0.96, 0.92); }
    else { c1 = vec3(0.08, 0.62, 0.30); c2 = vec3(1.0, 0.55, 0.05); c3 = vec3(0.98, 0.96, 0.92); }
    vec3 col = vec3(0.0);
    float m = 0.0;
    if (petal > 0.0) { col = c1; m = petal; }
    if (petalIn > 0.0) { col = mix(col, c2, petalIn); m = max(m, petalIn); }
    if (core > 0.0) { col = mix(col, c3, core); m = max(m, core); }
    float rr = max(ring, dots * step(2.6, r));
    if (rr > 0.0) { col = mix(col, c3, rr); m = max(m, rr); }
    // white vine linking medallions along lane centres
    float vine = 1.0 - smoothstep(0.05, 0.1, abs(q.x - sin(p.y * 0.9) * 0.5) ) ;
    vine *= step(3.3, r);
    col = mix(col, c3, vine * 0.9); m = max(m, vine * 0.9);
    return vec4(col, m);
  }

  float lampStreak(float d, float x, float sL, float xL, float hL) {
    float D = sL - uCamS;
    if (D < 8.0) return 0.0;
    float t = uCamH / (uCamH + hL);
    float dm = D * t;
    float xLine = uCamX + (xL - uCamX) * clamp(d / D, 0.0, 1.0);
    float aq = (d - dm) / (0.8 + dm * 0.7);
    float along = exp(-aq * aq);
    float cq = (x - xLine) / (0.22 + d * 0.008);
    float across = exp(-cq * cq);
    return along * across * (1.0 - smoothstep(60.0, 220.0, D));
  }

  void main() {
    float x = vRoad.x;
    float s = vRoad.y;
    float lx = vLocal;
    float hw = vHalfW;
    float alx = abs(lx);
    vec4 feat = texture2D(uFeat, vec2((s / ${STEP.toFixed(1)} + 0.5) / uFeatLen, 0.5));

    // --- asphalt
    float n1 = vn(vec2(lx * 1.7, s * 1.7));
    float n2 = vn(vec2(lx * 0.21 + 5.0, s * 0.09));
    float n3 = h12(floor(vec2(lx, s) * 18.0));
    vec3 col = vec3(0.080, 0.082, 0.090) * (0.8 + 0.32 * n1) * (0.82 + 0.36 * n2) * (0.9 + 0.22 * n3);
    float pn = vn(vec2(lx * 0.35 + 17.0, s * 0.06));
    col = mix(col, col * 0.78, smoothstep(0.68, 0.74, pn));
    float pn2 = vn(vec2(lx * 0.5 - 3.0, s * 0.11 + 9.0));
    col = mix(col, vec3(0.13, 0.125, 0.12), smoothstep(0.76, 0.8, pn2) * 0.35);
    // cracks
    float cr = (1.0 - smoothstep(0.0, 0.012, abs(vn(vec2(lx * 1.6, s * 1.6)) - 0.5))) * smoothstep(0.72, 0.86, vn(vec2(lx * 0.1, s * 0.05 + 40.0)));
    col *= 1.0 - cr * 0.28;

    float laneW = ${LANE_W.toFixed(2)};
    float lanes = max(1.0, floor(vLanes + 0.5));
    float u = (lx + hw) / laneW;
    float lf = fract(u);
    float ta = (lf - 0.27) * 9.0, tb = (lf - 0.73) * 9.0;
    float tyre = exp(-ta * ta) + exp(-tb * tb);
    col *= 1.0 - tyre * 0.14;
    float gutter = smoothstep(hw - 0.05, hw + 0.15, alx);
    col = mix(col, vec3(0.055, 0.05, 0.045), gutter * 0.75);

    // --- markings
    float fade = mix(1.0, 0.3 + 0.7 * smoothstep(0.25, 0.75, vn(vec2(lx * 2.0, s * 0.35))), uMarkFade);
    // Dhaka's roads carry no lane dashes, edge lines or zebra crossings: bare asphalt. Only the chequered
    // start/finish lines (below) are painted.
    if (feat.b > 0.02) {
      vec4 al = alpana(vec2(lx, s));
      col = mix(col, al.rgb * 0.75, al.a * feat.b * (1.0 - gutter));
    }
    if (feat.a > 0.5) {
      float ch = mod(floor(lx / 0.9) + floor(s / 0.9), 2.0);
      col = mix(col, vec3(ch * 0.85 + 0.04), 0.95 * (1.0 - gutter));
    }

    // --- wetness
    float pud = feat.g * smoothstep(0.52, 0.58, vn(vec2(lx * 0.25 + 3.0, s * 0.15)));
    float wet = clamp(uWet + pud, 0.0, 1.0);
    col *= mix(1.0, 0.42, wet);

    // --- lighting
    vec3 light = uAmb + uSun;
    float ls = mod(s - uLampOffset + uLampSpacing * 0.5, uLampSpacing) - uLampSpacing * 0.5;
    float dxl = x - uLampX.x, dxr = x - uLampX.y;
    float lampL = exp(-(ls * ls) / 80.0 - dxl * dxl / 30.0) * uLampOn.x;
    float lampR = exp(-(ls * ls) / 80.0 - dxr * dxr / 30.0) * uLampOn.y;
    light += uLampCol * (lampL + lampR) * uLamps * 2.3;
    // player headlights: two overlapping lobes
    float ds = s - uPlayerS;
    float dx = x - uPlayerX;
    float spread = 0.8 + ds * 0.2;
    float beam = smoothstep(1.0, 6.0, ds) * (1.0 - smoothstep(18.0, 70.0, ds));
    float hq = (ds - 14.0) / 6.0;
    beam *= exp(-(dx * dx) / (spread * spread)) * (1.0 + 0.6 * exp(-hq * hq));
    light += vec3(1.0, 0.9, 0.72) * beam * uHead * 3.3;
    // warm light spilling from shopfronts onto the road edges at night
    float spill = smoothstep(hw - 7.0, hw + 0.5, alx) * (0.7 + 0.3 * vn(vec2(s * 0.15, lx)));
    light += vec3(1.0, 0.78, 0.55) * spill * uSpill * uGlow * 0.55;
    vec3 tl = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      vec4 c = uCars[i];
      if (c.z <= 0.0) continue;
      float cs = s - c.x;
      float cx = x - c.y;
      vec3 lc = c.w > 0.5 ? vec3(1.0, 0.88, 0.7) : vec3(1.0, 0.07, 0.03);
      float cq2 = cs + 2.2;
      float g = exp(-cx * cx / 1.4) * exp(-cq2 * cq2 / 5.0);
      tl += lc * g * c.z * 1.4;
      if (wet > 0.05) {
        float d = s - uCamS;
        tl += lc * lampStreak(d, x, c.x, c.y, 0.9) * c.z * wet * 1.0 * smoothstep(14.0, 30.0, c.x - uCamS);
      }
    }
    light += tl;
    vec3 c = col * light * uTint;

    // --- reflections
    vec3 V = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
    c += uSkyRefl * wet * (0.06 + 0.5 * fres) * 0.35;
    if (wet > 0.05) {
      float d = s - uCamS;
      float k0 = floor(((uCamS + d / (uCamH / (uCamH + 8.5))) - uLampOffset) / uLampSpacing + 0.5);
      float st = 0.0;
      for (int j = -1; j <= 1; j++) {
        float sL = (k0 + float(j)) * uLampSpacing + uLampOffset;
        st += lampStreak(d, x, sL, uLampX.x, 8.5) * uLampOn.x;
        st += lampStreak(d, x, sL, uLampX.y, 8.5) * uLampOn.y;
      }
      c += uLampCol * min(st, 0.7) * uLamps * wet * 0.32;
      // rain ripples sparkle
      float rp = step(0.995, h12(floor(vec2(lx, s) * 6.0) + floor(uTime * 12.0)));
      c += vec3(0.6) * rp * uRain * 0.4;
    }
    c += vec3(0.6, 0.65, 0.8) * uFlash * 0.25;

    float f = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
    gl_FragColor = vec4(mix(c, uFogColor, f), 1.0);
  }
`;

// Per-track road material: shares the global uniforms by reference, owns its
// feature texture and the player's position mapped into this track's space.
export function makeRoadMaterial(track, featTex, stage) {
  const u = {
    uTime: shared.uTime,
    uAmb: shared.uAmb,
    uSun: shared.uSun,
    uLampCol: shared.uLampCol,
    uLamps: shared.uLamps,
    uHead: shared.uHead,
    uWet: shared.uWet,
    uSkyRefl: shared.uSkyRefl,
    uFogColor: shared.uFogColor,
    uFogDensity: shared.uFogDensity,
    uMarkFade: shared.uMarkFade,
    uCars: shared.uCars,
    uFlash: shared.uFlash,
    uRain: shared.uRain,
    uCamH: shared.uCamH,
    uLampSpacing: { value: stage.lampSpacing || 34 },
    uLampOffset: { value: 7 },
    uLampX: { value: new THREE.Vector2(-(stage.lanes * LANE_W * 0.5 - 0.9), stage.lanes * LANE_W * 0.5 - 0.9) },
    uLampOn: { value: new THREE.Vector2(stage.lampL === false ? 0 : 1, stage.lampR === false ? 0 : 1) },
    uPlayerS: { value: -1000 },
    uPlayerX: { value: 0 },
    uCamS: { value: -1000 },
    uCamX: { value: 0 },
    uFeat: { value: featTex },
    uFeatLen: { value: track.n },
    uTwoWay: { value: stage.twoWay ? 1 : 0 },
    uTint: { value: new THREE.Color(stage.roadTint || '#ffffff') },
    uSpill: { value: stage.spill ?? (['city', 'cityLow'].includes(stage.L) ? 1 : 0.35) },
    uGlow: shared.uGlow,
  };
  const m = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: ROAD_VS,
    fragmentShader: ROAD_FS,
  });
  return m;
}

// features: callback(s) -> [zebra, puddle, alpana, chequer] in 0..1
export function buildFeatureTexture(track, featFn) {
  const n = track.n;
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const f = featFn(i * STEP);
    data[i * 4] = Math.round(f[0] * 255);
    data[i * 4 + 1] = Math.round(f[1] * 255);
    data[i * 4 + 2] = Math.round(f[2] * 255);
    data[i * 4 + 3] = Math.round(f[3] * 255);
  }
  const t = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

const tmpV = new THREE.Vector3();

// Strip geometry for a carriageway between s0..s1. xa/xb: lateral extents (functions of s),
// centre(s): lateral centre of this carriageway; halfW(s), lanes(s).
export function buildRoadStrip(track, s0, s1, xa, xb, centre, halfW, lanes, yOff = 0) {
  const pos = [], uv = [], aH = [], aL = [], aLoc = [], idx = [];
  const i0 = Math.floor(s0 / STEP), i1 = Math.ceil(s1 / STEP);
  let v = 0;
  for (let i = i0; i <= i1; i++) {
    const s = Math.min(i * STEP, track.length + 400);
    const a = xa(s), b = xb(s), c = centre(s), hw = halfW(s), ln = lanes(s);
    track.point(s, a, yOff, tmpV);
    pos.push(tmpV.x, tmpV.y, tmpV.z);
    track.point(s, b, yOff, tmpV);
    pos.push(tmpV.x, tmpV.y, tmpV.z);
    uv.push(a, s, b, s);
    aH.push(hw, hw);
    aL.push(ln, ln);
    aLoc.push(a - c, b - c);
    if (i > i0) {
      const p = v - 2;
      idx.push(p, p + 1, v, p + 1, v + 1, v);
    }
    v += 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aHalfW', new THREE.Float32BufferAttribute(aH, 1));
  g.setAttribute('aLanes', new THREE.Float32BufferAttribute(aL, 1));
  g.setAttribute('aLocal', new THREE.Float32BufferAttribute(aLoc, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
