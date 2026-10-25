// Shared uniforms + material factories. Atmosphere writes into `shared` every
// frame and every material reads from it by reference.

import * as THREE from 'three';

export const shared = {
  uTime: { value: 0 },
  uFogColor: { value: new THREE.Color('#e8cfa6') },
  uFogDensity: { value: 0.0012 },
  uCamRight: { value: new THREE.Vector3(1, 0, 0) },
  uSpriteLight: { value: new THREE.Color(1, 1, 1) },
  uLampAdd: { value: new THREE.Color(0, 0, 0) },
  uGlow: { value: 0 },
  uSignGlow: { value: 0 },
  uWind: { value: 1 },
  // road
  uAmb: { value: new THREE.Color(0.5, 0.5, 0.6) },
  uSun: { value: new THREE.Color(1, 0.9, 0.8) },
  uLampCol: { value: new THREE.Color('#ffb347') },
  uLamps: { value: 0 },
  uHead: { value: 0 },
  uWet: { value: 0 },
  uStreak: { value: 0 }, // real wetness only (rain, puddles): what makes lamp reflections streak down the road
  uSkyRefl: { value: new THREE.Color(0.5, 0.4, 0.5) },
  uMarkFade: { value: 0.6 },
  uFlash: { value: 0 },
  uCamS: { value: 0 },
  uCamX: { value: 0 },
  uCamH: { value: 1.6 },
  uCars: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 0, 0)) },
  uRain: { value: 0 },
  // water
  uZenith: { value: new THREE.Color('#3b6fb6') },
  uHorizon: { value: new THREE.Color('#f7c27a') },
  uSunDir: { value: new THREE.Vector3(0, 0.1, -1).normalize() },
  uSunColor: { value: new THREE.Color('#ffd59a') },
  uMoonDir: { value: new THREE.Vector3(0.3, 0.4, -1).normalize() },
};

// two flat light bands instead of a smooth falloff: lit and shade, close together (art direction: toon)
let toonRamp = null;
export function toonGradient() {
  if (!toonRamp) {
    toonRamp = new THREE.DataTexture(new Uint8Array([200, 200, 200, 255, 255, 255, 255, 255]), 2, 1);
    toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter;
    toonRamp.needsUpdate = true;
  }
  return toonRamp;
}

// Toon material that samples a tile inside an atlas region (aRegion attribute).
export function makeAtlasMaterial(atlas, opts = {}) {
  const m = new THREE.MeshToonMaterial({
    gradientMap: toonGradient(),
    map: atlas.map,
    emissiveMap: atlas.emap || null,
    emissive: atlas.emap ? new THREE.Color(1, 1, 1) : new THREE.Color(0, 0, 0),
    vertexColors: true,
    side: opts.side || THREE.FrontSide,
  });
  const glowU = opts.glowUniform || shared.uGlow;
  const hasE = !!atlas.emap;
  const selfE = opts.selfEmissive || 0; // signs: emissive = diffuse * uniform
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uGlowF = glowU;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aRegion;\nvarying vec4 vRegion;\nvarying vec2 vTileUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvRegion = aRegion;\nvTileUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec4 vRegion;
        varying vec2 vTileUv;
        uniform float uGlowF;
        vec4 atlasSample(sampler2D t) {
          vec2 g = vTileUv;
          vec2 uvA = vRegion.xy + fract(g) * vRegion.zw;
          return textureGrad(t, uvA, dFdx(g) * vRegion.zw, dFdy(g) * vRegion.zw);
        }`)
      .replace('#include <map_fragment>', 'vec4 sampledDiffuseColor = atlasSample(map); diffuseColor *= sampledDiffuseColor;')
      .replace('#include <emissivemap_fragment>', hasE
        ? 'vec4 emissiveColor = atlasSample(emissiveMap); totalEmissiveRadiance *= emissiveColor.rgb * uGlowF * 0.62;'
        : (selfE ? `totalEmissiveRadiance = sampledDiffuseColor.rgb * uGlowF * ${selfE.toFixed(2)};` : ''));
  };
  m.customProgramCacheKey = () => 'atlas' + (hasE ? 'E' : '') + (selfE ? 'S' : '');
  return m;
}

// Unlit emissive geometry (lamp heads, neon tubes, LED bridges). Brightness via material.color.
export function makeGlowMaterial(intensity = 1, opts = {}) {
  const m = new THREE.MeshBasicMaterial({
    vertexColors: true,
    color: new THREE.Color(intensity, intensity, intensity),
    fog: opts.fog !== false,
    side: opts.side || THREE.FrontSide,
    transparent: !!opts.transparent,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: opts.depthWrite !== false,
    toneMapped: true,
  });
  m.userData.base = intensity;
  return m;
}

// Water: fresnel sky reflection, ripples, sun/moon glint, shimmering light columns.
export function makeWaterMaterial(opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uZenith: shared.uZenith,
      uHorizon: shared.uHorizon,
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
      uMoonDir: shared.uMoonDir,
      uFogColor: shared.uFogColor,
      uFogDensity: shared.uFogDensity,
      uGlow: shared.uGlow,
      uRain: shared.uRain,
      uDeep: { value: new THREE.Color(opts.deep || '#0c2a33') },
      uLightsCol: { value: new THREE.Color(opts.lights || '#ffb060') },
      uMurk: { value: opts.murk ?? 0.4 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying float vFog;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vFog = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFogDensity, uGlow, uRain, uMurk;
      uniform vec3 uZenith, uHorizon, uSunDir, uSunColor, uMoonDir, uFogColor, uDeep, uLightsCol;
      varying vec3 vWorld;
      varying float vFog;
      float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
        return mix(mix(h12(i),h12(i+vec2(1,0)),u.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x), u.y); }
      void main(){
        vec2 p = vWorld.xz;
        float t = uTime;
        float e = 0.08;
        vec2 q = p * 0.35 + vec2(t * 0.25, t * 0.11);
        float a = vn(q) + 0.5 * vn(q * 2.3 - t * 0.3);
        float bx = vn(q + vec2(e, 0.)) + 0.5 * vn((q + vec2(e,0.)) * 2.3 - t * 0.3);
        float by = vn(q + vec2(0., e)) + 0.5 * vn((q + vec2(0.,e)) * 2.3 - t * 0.3);
        vec3 n = normalize(vec3((a - bx) * 2.2, 1.0, (a - by) * 2.2));
        // rain rings
        if (uRain > 0.01) {
          vec2 cell = floor(p * 0.9);
          vec2 f = fract(p * 0.9) - 0.5;
          float ph = fract(t * 0.9 + h12(cell) * 7.0);
          float r = length(f) - ph * 0.5;
          n.xz += f * 2.0 * exp(-r * r * 200.0) * (1.0 - ph) * uRain;
          n = normalize(n);
        }
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 R = reflect(-V, n);
        float fres = 0.04 + 0.96 * pow(clamp(1.0 - dot(n, V), 0.0, 1.0), 5.0);
        float re = clamp(R.y, 0.0, 1.0);
        vec3 sky = mix(uHorizon, uZenith, pow(max(smoothstep(0.0, 0.6, re), 1e-4), 0.6));
        vec3 col = mix(uDeep, sky, clamp(fres * 1.2, 0.0, 1.0));
        col = mix(col, uDeep * 0.6 + uHorizon * 0.15, uMurk * 0.35);
        float rs = clamp(dot(R, uSunDir), 0.0, 1.0);
        float glint = pow(rs, 220.0) * 6.0 + pow(rs, 18.0) * 0.35;
        col += uSunColor * glint * step(-0.05, uSunDir.y);
        float mg = pow(clamp(dot(R, uMoonDir), 0.0, 1.0), 300.0) * 2.0;
        col += vec3(0.8, 0.85, 1.0) * mg * (1.0 - step(0.0, uSunDir.y)) ;
        // city light columns shimmering on the surface (at night)
        float lane = vn(vec2(p.x * 0.06 + p.y * 0.06, 0.0) * 6.0);
        float shimmer = smoothstep(0.62, 0.9, vn(vec2((p.x + p.y) * 0.5, t * 0.6)) * a);
        col += uLightsCol * shimmer * uGlow * 0.55 * lane;
        float fg = 1.0 - exp(-uFogDensity * uFogDensity * vFog * vFog);
        gl_FragColor = vec4(mix(col, uFogColor, fg), 1.0);
      }`,
  });
}
