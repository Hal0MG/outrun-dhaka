// Hand-modelled (well, hand-coded) Dhaka landmarks. Each builder receives the
// chunk context, an s position, a side (-1 left / 1 right) and a lateral
// distance from the road centre.

import * as THREE from 'three';
import * as P from './paint.js';
import { grain } from './atlas.js';
import { RNG } from '../core/util.js';
import { makeBannerTexture } from './signs.js';

const texCache = {};
function canvasTex(key, w, h, draw, opts = {}) {
  if (texCache[key]) return texCache[key];
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  texCache[key] = t;
  return t;
}

const matCache = {};
function lambert(key, make) {
  if (!matCache[key]) matCache[key] = make();
  return matCache[key];
}

// local frame: lx forward along road, ly up, lz lateral (right)
function frame(ctx, s, x, ground = true, h = 0) {
  const p = ctx.P(s, x, h, ground);
  const yaw = ctx.track.yawAt(s);
  const fx = Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = Math.sin(yaw);
  return {
    p, yaw,
    L: (lx, ly, lz) => [p[0] + fx * lx + rx * lz, p[1] + ly, p[2] + fz * lx + rz * lz],
  };
}

// box in local frame: w lateral, d along road
function lbox(B, F, lx, ly, lz, w, h, d, opts = {}, yawOff = 0) {
  const c = F.L(lx, ly, lz);
  B.box(c[0], c[1], c[2], w, h, d, F.yaw + yawOff, opts);
}

function meshAt(geo, mat, pos, yaw, extra) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.y = -yaw;
  if (extra) extra(m);
  return m;
}

// Additive vertical light beam (concerts, stadiums, festivals)
let beamMat = null;
export function beamMaterial(shared) {
  if (beamMat) return beamMat;
  beamMat = new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime, uFogDensity: shared.uFogDensity, uGlow: shared.uGlow },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      varying float vH; varying vec3 vCol; varying float vFog; varying vec3 vN; varying vec3 vV;
      void main(){ vH = uv.y; vCol = color;
        vec4 wp = modelMatrix * vec4(position,1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        vec4 mv = viewMatrix * wp; vFog = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFogDensity, uGlow;
      varying float vH; varying vec3 vCol; varying float vFog; varying vec3 vN; varying vec3 vV;
      void main(){
        float edge = pow(clamp(1.0 - abs(dot(vN, vV)), 0.0, 1.0), 1.5);
        float a = (1.0 - vH) * (1.0 - vH) * (1.0 - edge * 0.9) * 0.16;
        float f = exp(-uFogDensity * uFogDensity * vFog * vFog * 0.5);
        gl_FragColor = vec4(vCol * a * f * uGlow, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  return beamMat;
}

function beam(ctx, pos, dir, len, r, col) {
  const geo = new THREE.CylinderGeometry(r, 0.2, len, 12, 1, true);
  geo.translate(0, -len / 2, 0);
  // uv.y: 1 at the light (top) -> we want 0 at source
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  const c = new Float32Array(geo.getAttribute('position').count * 3);
  for (let i = 0; i < c.length; i += 3) { c[i] = col[0]; c[i + 1] = col[1]; c[i + 2] = col[2]; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const m = new THREE.Mesh(geo, beamMaterial(ctx.world.shared));
  m.position.set(pos[0], pos[1], pos[2]);
  // orient: geometry points down (-y) from origin; aim along dir
  const d = new THREE.Vector3(...dir).normalize();
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d);
  m.renderOrder = 5;
  ctx.extra.push(m);
  return m;
}

// Sangsad facade: concrete with Kahn's giant circles & triangles cut out
function sangsadTex() {
  return canvasTex('sangsad_cut', 512, 512, (ctx, w, h) => {
    const rng = new RNG('sangsadcut');
    P.noiseFill(ctx, 0, 0, w, h, '#8e8880', rng, 0.05, 4);
    grain(ctx, 0, 0, w, h, 0.25);
    ctx.fillStyle = '#ebe7de';
    for (let y = 0; y < h; y += 64) ctx.fillRect(0, y, w, 5);
    P.streaks(ctx, 0, 0, w, h, rng, 26, 0.14);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(w / 2, h * 0.45, w * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.95); ctx.lineTo(w * 0.28, h * 0.78); ctx.lineTo(w * 0.46, h * 0.95); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w * 0.54, h * 0.95); ctx.lineTo(w * 0.72, h * 0.78); ctx.lineTo(w * 0.9, h * 0.95); ctx.fill();
  });
}
function sangsadTex2() {
  return canvasTex('sangsad_cut2', 512, 512, (ctx, w, h) => {
    const rng = new RNG('sangsadcut2');
    P.noiseFill(ctx, 0, 0, w, h, '#8a847c', rng, 0.05, 4);
    grain(ctx, 0, 0, w, h, 0.25);
    ctx.fillStyle = '#ebe7de';
    for (let y = 0; y < h; y += 64) ctx.fillRect(0, y, w, 5);
    P.streaks(ctx, 0, 0, w, h, rng, 26, 0.14);
    ctx.globalCompositeOperation = 'destination-out';
    for (const cx of [0.25, 0.75]) {
      ctx.beginPath(); ctx.moveTo(w * (cx - 0.18), h * 0.8); ctx.lineTo(w * cx, h * 0.18); ctx.lineTo(w * (cx + 0.18), h * 0.8); ctx.fill();
    }
    ctx.fillRect(w * 0.47, h * 0.3, w * 0.06, h * 0.6);
  });
}

export const LANDMARKS = {
  // ------------------------------------------------------------ DHANMONDI
  satmasjid(ctx, s, side, dist) {
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    const white = ctx.misc.get('marble');
    const w = 12, d = 32, h = 8;
    lbox(B, F, 0, -1, 0, w, h + 1, d, { color: [0.96, 0.95, 0.9], region: white, tile: [4, 4] });
    // three domes on the hall
    for (const lx of [-9, 0, 9]) {
      const c = F.L(lx, h, 0);
      B.cylinder(c[0], c[1], c[2], 3.4, 3.4, 1.2, 12, [0.95, 0.95, 0.9], white);
      B.dome(c[0], c[1] + 1.2, c[2], 3.4, 1.15, 12, 5, [0.97, 0.97, 0.94], white);
      B.cylinder(c[0], c[1] + 5.0, c[2], 0.08, 0.02, 1.4, 4, [0.85, 0.7, 0.2], ctx.misc.get('metal'));
    }
    // four octagonal corner towers, each domed (seven domes)
    for (const lx of [-d / 2, d / 2]) for (const lz of [-w / 2, w / 2]) {
      const c = F.L(lx, 0, lz);
      B.cylinder(c[0], c[1] - 1, c[2], 1.6, 1.4, h + 4, 8, [0.95, 0.94, 0.9], white);
      B.dome(c[0], c[1] + h + 3, c[2], 1.6, 1.3, 8, 4, [0.97, 0.97, 0.94], white);
      ctx.B.neon.cylinder(c[0], c[1] + h + 1, c[2], 1.65, 1.65, 0.15, 8, [0.3, 2.2, 0.6]);
    }
    // arches facing the road (dark recesses)
    for (let i = -2; i <= 2; i++) {
      const c = F.L(i * 5, 0.3, -side * (w / 2 + 0.05));
      B.box(c[0], c[1], c[2], 0.1, 4.5, 2.6, F.yaw, { color: [0.2, 0.18, 0.16], region: white });
      if (ctx.rng.chance(0.8)) {
        const e = F.L(i * 5, 0.5, -side * (w / 2 + 0.1));
        ctx.B.neon.box(e[0], e[1], e[2], 0.05, 3.6, 2.0, F.yaw, { color: [1.6, 1.3, 0.8] });
      }
    }
    ctx.obstacle(s, side * dist, w / 2 + 4, d / 2 + 4, 'solid');
  },

  sarobar(ctx, s, side, dist) {
    // Rabindra Sarobar: open-air stage by the lake, tiered seats, concert lights
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    const conc = ctx.misc.get('concrete');
    // stage platform near water
    lbox(B, F, 0, -0.5, side * 14, 10, 1.7, 18, { color: [0.75, 0.72, 0.68], region: conc, tile: [3, 3] });
    // stage roof on pillars
    for (const lx of [-8, 8]) for (const lz of [10, 18]) lbox(B, F, lx, 1, side * lz, 0.5, 6, 0.5, { color: [0.3, 0.3, 0.32], region: ctx.misc.get('metal') });
    lbox(B, F, 0, 7, side * 14, 10, 0.4, 19, { color: [0.15, 0.15, 0.17], region: ctx.misc.get('metal') });
    // tiered seating (arc of steps)
    for (let t = 0; t < 5; t++) {
      const r = 6 + t * 1.6;
      for (let i = -5; i <= 5; i++) {
        const a = (i / 5) * 1.1;
        const lx = Math.sin(a) * (r + 6);
        const lz = side * (14 - Math.cos(a) * (r + 2));
        lbox(B, F, lx, 0, lz, 1.6, 0.5 + t * 0.5, 3.6, { color: [0.8, 0.77, 0.72], region: conc, tile: [2, 2] }, -side * a);
        if (ctx.rng.chance(0.6)) {
          const q = F.L(lx, 0.5 + t * 0.5, lz);
          ctx.sprites.add(ctx.rng.pick(['crowd0', 'crowd1', 'crowd2']), q[0], q[1], q[2], 0.9, { lamp: 0.6 });
        }
      }
    }
    // concert light beams sweeping the sky (static angles, bloom does the rest)
    const cols = [[1.6, 0.2, 0.8], [0.2, 1.2, 1.8], [1.8, 1.2, 0.2], [1.6, 0.2, 0.8]];
    for (let i = 0; i < 4; i++) {
      const q = F.L(-6 + i * 4, 7, side * 9);
      beam(ctx, q, [Math.sin(i * 1.7) * 0.5, 1, -side * 0.3 + Math.cos(i) * 0.3], 70, 5, cols[i]);
    }
    // stage glow
    const g = F.L(0, 1.3, side * 15);
    ctx.B.neon.box(g[0], g[1], g[2], 0.4, 0.2, 16, F.yaw, { color: [2.5, 0.6, 1.8] });
    ctx.obstacle(s, side * (dist + 12), 14, 18, 'solid');
  },

  floodlights(ctx, s, side, dist, opts = {}) {
    // sports field with four floodlight masts (Abahani, Dhanmondi)
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    const metal = ctx.misc.get('metal');
    const W = opts.w || 70, D = opts.d || 100, H = opts.h || 32;
    const c0 = F.L(0, 0.05, side * W / 2);
    // field (green slab)
    lbox(B, F, 0, -0.1, side * W / 2, W, 0.18, D, { color: [0.22, 0.42, 0.18], region: ctx.misc.get('white') });
    for (const lx of [-D / 2, D / 2]) for (const lz of [2, W - 2]) {
      const q = F.L(lx, 0, side * lz);
      B.cylinder(q[0], q[1], q[2], 0.5, 0.3, H, 6, [0.6, 0.6, 0.62], metal);
      B.box(q[0], q[1] + H, q[2], 5, 3, 0.6, F.yaw + 0.5, { color: [0.3, 0.3, 0.3], region: metal });
      ctx.B.lamp.box(q[0], q[1] + H + 0.2, q[2], 4.6, 2.6, 0.7, F.yaw + 0.5, { color: [3.2, 3.1, 2.9] });
      beam(ctx, [q[0], q[1] + H, q[2]], [(c0[0] - q[0]) * 0.02, -1, (c0[2] - q[2]) * 0.02], H + 4, 9, [0.6, 0.6, 0.55]);
    }
    // goal posts
    for (const lx of [-D / 2 + 4, D / 2 - 4]) {
      const q = F.L(lx, 0, side * W / 2);
      B.box(q[0], q[1], q[2], 7.3, 2.44, 0.12, F.yaw, { color: [1, 1, 1], region: ctx.misc.get('white'), skip: { top: false } });
    }
  },

  // ------------------------------------------------------------ SHAHBAG / DU
  shaheedMinar(ctx, s, side, dist) {
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    const white = ctx.misc.get('marble');
    // tiered plinth
    for (let t = 0; t < 3; t++) lbox(B, F, 0, t * 0.6 - 0.4, side * 12, 30 - t * 4, 1.0, 50 - t * 6, { color: [0.85, 0.84, 0.8], region: white, tile: [3, 3] });
    const base = 1.4;
    const frameAt = (lx, lz, w, H, lean, scale) => {
      // a frame: two/four tall columns with a forward-bent crown
      const cols = scale > 0.9 ? [-1.5, -0.5, 0.5, 1.5] : [-1, 0, 1];
      const bend = H * 0.72;
      for (const c of cols) {
        const a = F.L(lx + c * w * 0.25, base, lz);
        const b = F.L(lx + c * w * 0.25, base + bend, lz);
        B.tube(a, b, 0.32 * scale, 0.32 * scale, 4, [0.97, 0.97, 0.95], white);
        const tip = F.L(lx + c * w * 0.25, base + bend + (H - bend) * Math.cos(lean), lz - side * (H - bend) * Math.sin(lean));
        B.tube(b, tip, 0.32 * scale, 0.32 * scale, 4, [0.97, 0.97, 0.95], white);
      }
      // crossbars
      for (const hh of [0.25, 0.5, bend / H]) {
        const a = F.L(lx - w * 0.38, base + H * hh, lz), b = F.L(lx + w * 0.38, base + H * hh, lz);
        B.tube(a, b, 0.22 * scale, 0.22 * scale, 4, [0.95, 0.95, 0.93], white);
      }
      const ta = F.L(lx - w * 0.38, base + bend + (H - bend) * Math.cos(lean), lz - side * (H - bend) * Math.sin(lean));
      const tb = F.L(lx + w * 0.38, base + bend + (H - bend) * Math.cos(lean), lz - side * (H - bend) * Math.sin(lean));
      B.tube(ta, tb, 0.3 * scale, 0.3 * scale, 4, [0.97, 0.97, 0.95], white);
    };
    // red sun disc behind (the blood of the martyrs)
    const discMat = lambert('minar_red', () => new THREE.MeshLambertMaterial({ color: new THREE.Color('#c8102e'), emissive: new THREE.Color('#5a0410'), side: THREE.DoubleSide }));
    const dc = F.L(0, base + 7.5, side * 16);
    ctx.extra.push(meshAt(new THREE.CircleGeometry(6.2, 40), discMat, dc, F.yaw + (side < 0 ? -Math.PI / 2 : Math.PI / 2)));
    frameAt(0, side * 14, 6, 15, 0.45, 1);
    frameAt(-6.5, side * 13, 4, 10, 0.25, 0.8);
    frameAt(6.5, side * 13, 4, 10, 0.25, 0.8);
    frameAt(-11.5, side * 12, 3.6, 8.5, 0.2, 0.7);
    frameAt(11.5, side * 12, 3.6, 8.5, 0.2, 0.7);
    // floodlights at the base
    for (const lx of [-12, -4, 4, 12]) {
      const q = F.L(lx, 1.6, side * 6);
      ctx.B.lamp.box(q[0], q[1], q[2], 0.4, 0.3, 0.4, F.yaw, { color: [2.6, 2.5, 2.3] });
    }
    // flowers at the base (people leave wreaths)
    for (let i = 0; i < 10; i++) {
      const q = F.L(ctx.rng.range(-8, 8), 1.4, side * ctx.rng.range(10, 12));
      ctx.sprites.add(ctx.rng.pick(['bougain0', 'bush0']), q[0], q[1], q[2], 0.4);
    }
    ctx.obstacle(s, side * (dist + 12), 16, 26, 'solid');
  },

  curzonHall(ctx, s, side, dist) {
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.world;
    const brick = ctx.facade.get('brick');
    lbox(B, F, 0, -1, side * 8, 16, 14, 60, { regions: { front: brick, back: brick, side: brick, top: ctx.facade.get('roof') }, tile: [12, 12], color: [1, 1, 1] });
    // central portal block, taller
    lbox(B, F, 0, -1, side * 6, 14, 19, 16, { regions: { front: brick, back: brick, side: brick, top: ctx.facade.get('roof') }, tile: [12, 12], color: [1, 0.96, 0.94] });
    const M = ctx.B.misc;
    const white = ctx.misc.get('marble');
    // chhatris & domes on the roofline
    for (const lx of [-28, -14, 14, 28]) {
      const q = F.L(lx, 13, side * 1);
      M.cylinder(q[0], q[1], q[2], 1.1, 1.1, 2.2, 8, [0.95, 0.92, 0.85], white);
      M.dome(q[0], q[1] + 2.2, q[2], 1.3, 1.2, 8, 4, [0.95, 0.92, 0.85], white);
    }
    const q = F.L(0, 18, side * 0);
    M.cylinder(q[0], q[1], q[2], 3.6, 3.6, 2.5, 12, [0.95, 0.92, 0.85], white);
    M.dome(q[0], q[1] + 2.5, q[2], 3.8, 1.3, 12, 5, [0.95, 0.92, 0.85], white);
    ctx.obstacle(s, side * (dist + 8), 9, 31, 'solid');
  },

  // ------------------------------------------------------------ MANIK MIA / SANGSAD
  sangsad(ctx, s, side, dist) {
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    const outerMat = lambert('sangsad_outer', () => new THREE.MeshLambertMaterial({ map: sangsadTex(), alphaTest: 0.5, side: THREE.DoubleSide, emissive: new THREE.Color('#3a2418'), emissiveMap: sangsadTex() }));
    const outerMat2 = lambert('sangsad_outer2', () => new THREE.MeshLambertMaterial({ map: sangsadTex2(), alphaTest: 0.5, side: THREE.DoubleSide, emissive: new THREE.Color('#3a2418'), emissiveMap: sangsadTex2() }));
    const conc = ctx.misc.get('sangsad');
    const N = 8;
    const R = 46;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const lx = Math.cos(a) * R, lz = Math.sin(a) * R;
      const H = i % 2 ? 34 : 40;
      const W = i % 2 ? 26 : 34;
      const c = F.L(lx * 0.62, 0, lz * 0.62);
      // a low inner block, so the cut-outs frame sky and shadow rather than a wall
      const yawB = F.yaw + a + Math.PI / 2;
      B.box(c[0], c[1] - 1, c[2], W * 0.42, H * 0.5, 7, yawB, { color: [0.62, 0.6, 0.57], region: conc, tile: [8, 8] });
      // outer pierced wall: a plane facing out, offset outward
      const o = F.L(lx * 1.16, 0, lz * 1.16);
      const geo = new THREE.PlaneGeometry(W, H);
      geo.translate(0, H / 2 - 1, 0);
      const m = new THREE.Mesh(geo, i % 2 ? outerMat2 : outerMat);
      m.position.set(o[0], o[1], o[2]);
      // plane normal must point radially outward from centre
      const ox = o[0] - F.p[0], oz = o[2] - F.p[2];
      m.rotation.y = Math.atan2(ox, oz);
      ctx.extra.push(m);
      // a few warm windows deep inside
      const g = F.L(lx * 0.62 * 1.08, H * 0.3, lz * 0.62 * 1.08);
      ctx.B.neon.box(g[0], g[1], g[2], W * 0.25, 1.2, 0.3, yawB, { color: [1.2, 0.8, 0.45] });
    }
    // central assembly chamber: tall octagon
    const cc = F.L(0, 0, 0);
    B.cylinder(cc[0], cc[1] - 1, cc[2], 19, 19, 47, 8, [0.66, 0.64, 0.6], conc, { cap: true, capColor: [0.5, 0.48, 0.45], uRep: 5, tileV: 8 });
    // lake around it
    const water = new THREE.Mesh(new THREE.CircleGeometry(140, 48), ctx.track.waterMat || ctx.world.mats.water);
    water.rotation.x = -Math.PI / 2;
    water.position.set(F.p[0], F.p[1] + 0.08, F.p[2]);
    ctx.extra.push(water);
    // floodlights ring
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const q = F.L(Math.cos(a) * 80, 0.2, Math.sin(a) * 80);
      ctx.B.lamp.box(q[0], q[1], q[2], 0.6, 0.4, 0.6, 0, { color: [2.5, 2.2, 1.6] });
    }
    ctx.obstacle(s, side * dist, 80, 80, 'solid');
  },

  novoTheatre(ctx, s, side, dist) {
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    const white = ctx.misc.get('concrete_smooth');
    const c = F.L(0, 0, 0);
    B.cylinder(c[0], c[1] - 1, c[2], 20, 20, 8, 24, [0.92, 0.92, 0.9], white);
    B.dome(c[0], c[1] + 7, c[2], 19, 0.9, 24, 8, [0.97, 0.97, 0.96], white);
    ctx.B.neon.cylinder(c[0], c[1] + 7, c[2], 20.2, 20.2, 0.4, 24, [0.4, 1.6, 2.6]);
    // fighter jet on a pedestal, nose up (Bijoy Sarani)
    const j = F.L(-40, 0, -side * 22);
    B.box(j[0], j[1], j[2], 2.5, 5, 2.5, F.yaw, { color: [0.8, 0.8, 0.78], region: white });
    const jy = j[1] + 6;
    const nose = F.L(-40 + 6, 9.5, -side * 22), tail = F.L(-40 - 6, 4.5, -side * 22);
    B.tube([tail[0], tail[1] + 1.5, tail[2]], [nose[0], nose[1] + 1.5, nose[2]], 0.75, 0.25, 8, [0.55, 0.6, 0.55], ctx.misc.get('metal'));
    const wingL = F.L(-41, jy + 0.5, -side * 22 - 4.5), wingR = F.L(-41, jy + 0.5, -side * 22 + 4.5), wc = F.L(-38, jy + 1.8, -side * 22);
    B.tri(wingL, wc, wingR, [0.5, 0.55, 0.5], ctx.misc.get('metal'));
    B.tri(wingR, wc, wingL, [0.5, 0.55, 0.5], ctx.misc.get('metal'));
    const fin = F.L(-45, jy + 4.5, -side * 22), fb = F.L(-44, jy + 0.6, -side * 22), fa = F.L(-47, jy - 0.4, -side * 22);
    B.tri(fa, fb, fin, [0.5, 0.55, 0.5], ctx.misc.get('metal'));
    B.tri(fb, fa, fin, [0.5, 0.55, 0.5], ctx.misc.get('metal'));
    ctx.obstacle(s, side * dist, 21, 21, 'solid');
  },

  // ------------------------------------------------------------ OLD DHAKA
  starMosque(ctx, s, side, dist) {
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    const star = ctx.misc.get('star_tiles');
    lbox(B, F, 0, -1, side * 6, 10, 8, 22, { color: [1, 1, 1], region: star, tile: [3, 3] });
    for (const lx of [-7, 0, 7]) {
      const q = F.L(lx, 7, side * 6);
      B.cylinder(q[0], q[1], q[2], lx === 0 ? 3.2 : 2.6, lx === 0 ? 3.2 : 2.6, 1, 12, [1, 1, 1], star);
      B.dome(q[0], q[1] + 1, q[2], lx === 0 ? 3.2 : 2.6, 1.25, 12, 5, [1, 1, 1], star);
      B.cylinder(q[0], q[1] + (lx === 0 ? 5 : 4.2), q[2], 0.07, 0.02, 1.4, 4, [0.9, 0.8, 0.3], ctx.misc.get('metal'));
    }
    // crenellations
    for (let i = -10; i <= 10; i += 2) {
      const q = F.L(i, 7, side * 1.2);
      B.box(q[0], q[1], q[2], 0.5, 0.8, 0.6, F.yaw, { color: [1, 1, 1], region: star });
    }
    // little corner minarets
    for (const lx of [-11, 11]) {
      const q = F.L(lx, 0, side * 1.2);
      B.cylinder(q[0], q[1] - 1, q[2], 0.6, 0.5, 11, 8, [1, 1, 1], star);
      ctx.B.neon.cylinder(q[0], q[1] + 9, q[2], 0.62, 0.62, 0.15, 8, [0.2, 2.6, 0.6]);
    }
    // arches glow
    for (let i = -2; i <= 2; i++) {
      const q = F.L(i * 4, 0.4, side * 0.95);
      ctx.B.neon.box(q[0], q[1], q[2], 0.05, 3.4, 2.2, F.yaw, { color: [1.8, 1.5, 0.9] });
    }
    ctx.obstacle(s, side * (dist + 6), 6, 12, 'solid');
  },

  ahsanManzil(ctx, s, side, dist) {
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    const pink = ctx.misc.get('ahsan');
    lbox(B, F, 0, -1, 0, 22, 16, 80, { color: [1, 1, 1], region: pink, tile: [16, 8] });
    lbox(B, F, 0, -1, -side * 4, 18, 22, 24, { color: [1, 0.96, 0.97], region: pink, tile: [16, 8] });
    const c = F.L(0, 21, -side * 4);
    B.cylinder(c[0], c[1], c[2], 7.5, 7.5, 6, 16, [0.92, 0.5, 0.58], pink);
    B.dome(c[0], c[1] + 6, c[2], 8.2, 1.25, 16, 6, [0.88, 0.45, 0.55], ctx.misc.get('concrete_smooth'));
    B.cylinder(c[0], c[1] + 16, c[2], 0.5, 0.05, 3.5, 6, [0.95, 0.85, 0.4], ctx.misc.get('metal'));
    // grand staircase toward the river
    for (let t = 0; t < 8; t++) lbox(B, F, 0, -1 + t * 0.6, side * (-14 - t * 1.3), 16 - t * 0.6, 0.6, 22 - t, { color: [0.95, 0.8, 0.82], region: ctx.misc.get('concrete_smooth') });
    // floodlit at night
    for (const lx of [-30, -15, 0, 15, 30]) {
      const q = F.L(lx, 0.5, -side * 16);
      ctx.B.lamp.box(q[0], q[1], q[2], 0.5, 0.4, 0.5, F.yaw, { color: [3, 2, 2.2] });
      beam(ctx, q, [0, 1, side * 0.35], 22, 4, [0.6, 0.35, 0.4]);
    }
    ctx.obstacle(s, side * dist, 12, 40, 'solid');
  },

  // ------------------------------------------------------------ KAWRAN BAZAR / FARMGATE
  tower(ctx, s, side, dist, opts = {}) {
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.world;
    const fac = ctx.facade.get(opts.facade || 'glass_blue');
    const H = opts.h || 90, W = opts.w || 26, D = opts.d || 26;
    lbox(B, F, 0, -1, 0, W, H, D, { regions: { front: fac, back: fac, side: fac, top: ctx.facade.get('roof') }, tile: [12, 12], color: opts.tint || [1, 1, 1] });
    if (opts.podium) lbox(B, F, 0, -1, 0, W * 1.8, 14, D * 2.2, { regions: { front: ctx.facade.get('shop_mall'), back: fac, side: ctx.facade.get('shop_mall'), top: ctx.facade.get('roof') }, tile: [12, 3.75], color: [1, 1, 1] });
    // crown light
    const top = F.L(0, H - 1, 0);
    ctx.B.neon.box(top[0], top[1] + 1.5, top[2], W + 0.4, 0.5, D + 0.4, F.yaw, { color: opts.crown || [0.3, 1.8, 2.6] });
    ctx.B.always.box(top[0], top[1] + 6, top[2], 0.6, 0.6, 0.6, 0, { color: [3, 0.1, 0.1] });
    ctx.B.misc.cylinder(top[0], top[1], top[2], 0.2, 0.1, 6, 4, [0.5, 0.5, 0.5], ctx.misc.get('metal'));
    if (opts.sign) {
      const tex = canvasTex('tsign_' + opts.sign, 1024, 192, (c, w, h) => {
        c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
        P.signText(c, opts.sign, w / 2, h / 2, { font: `700 ${opts.signFont || 110}px ${opts.signLatin ? P.FONT_SIGN : P.FONT_BN}`, fill: opts.signColor || '#ffffff', stroke: null, lw: 0, maxW: w - 40 });
      });
      const mat = lambert('tsignm_' + opts.sign, () => new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(2.2, 2.2, 2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      const fz = -side * (W / 2 + 0.3);
      const q = F.L(0, H - 8, fz);
      const m = meshAt(new THREE.PlaneGeometry(W * 0.95, W * 0.95 * 0.19), mat, q, F.yaw + (side < 0 ? -Math.PI / 2 : Math.PI / 2));
      ctx.extra.push(m);
    }
    ctx.obstacle(s, side * dist, W / 2 + 1, D / 2 + 1, 'solid');
  },

  cinemaHall(ctx, s, side, dist) {
    // Ananda/Balaka style single-screen hall with a giant hand-painted poster
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.world;
    const fac = ctx.facade.get('apt_tile2');
    lbox(B, F, 0, -1, side * 8, 16, 18, 34, { regions: { front: fac, back: fac, side: fac, top: ctx.facade.get('roof') }, tile: [12, 12], color: [0.9, 0.85, 0.85] });
    const q = F.L(0, 7, side * 0.4 - side * 0.3);
    const reg = ctx.signs.get(ctx.rng.pick(['bb_ononto', 'bb_mastan', 'bb_kolija', 'bb_taj']));
    ctx.B.sign.panel(q[0], q[1], q[2], 24, 12, F.yaw + (side < 0 ? -Math.PI / 2 : Math.PI / 2), [1, 1, 1], reg);
    // marquee bulbs
    for (let i = 0; i <= 30; i++) {
      for (const hh of [6.6, 19.2]) {
        const p = F.L(-12 + i * 0.8, hh, side * 0.2);
        ctx.B.neon.box(p[0], p[1], p[2], 0.15, 0.15, 0.15, 0, { color: i % 2 ? [3, 2.2, 0.4] : [3, 0.4, 0.3] });
      }
    }
    const t = canvasTex('cinema_name', 512, 128, (c, w, h) => {
      c.fillStyle = '#120808'; c.fillRect(0, 0, w, h);
      P.signText(c, 'আনন্দ সিনেমা হল', w / 2, h / 2, { font: `700 64px ${P.FONT_BN}`, fill: '#ff3b6a', stroke: null, lw: 0, maxW: w - 20 });
    });
    const mat = lambert('cinema_name', () => new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(2.5, 2.5, 2.5) }));
    const nq = F.L(0, 20.5, side * 0.2);
    ctx.extra.push(meshAt(new THREE.PlaneGeometry(14, 3.5), mat, nq, F.yaw + (side < 0 ? -Math.PI / 2 : Math.PI / 2)));
    ctx.obstacle(s, side * (dist + 8), 8, 17, 'solid');
  },

  newspaper(ctx, s, side, dist) {
    LANDMARKS.tower(ctx, s, side, dist, { facade: 'office', h: 42, w: 30, d: 24, sign: 'প্রথম আলু', crown: [2.4, 2.0, 0.6] });
  },

  marketTrucks(ctx, s, side, dist) {
    // Kawran Bazar kitchen market at night: parked trucks + porters + veg piles
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    for (let i = 0; i < 4; i++) {
      const lx = -24 + i * 12 + ctx.rng.range(-2, 2);
      lbox(B, F, lx, 0.6, 0, 2.5, 2.8, 6.5, { regions: { side: ctx.misc.get('truck_side' + (i % 2)), front: ctx.misc.get('truck_back'), back: ctx.misc.get('truck_cab'), top: ctx.misc.get('tarp') }, color: [1, 1, 1] });
      lbox(B, F, lx + 4.2, 0.6, 0, 2.4, 2.4, 2.2, { color: [1, 1, 1], region: ctx.misc.get('truck_cab') });
      for (let k = 0; k < 3; k++) {
        const q = F.L(lx + ctx.rng.range(-3, 3), 0, ctx.rng.range(-3, 3) * side + side * 2);
        ctx.sprites.add(ctx.rng.pick(['p_vendor', 'p_lungi', 'fruitvan']), q[0], q[1], q[2], 1, { lamp: 0.8 });
      }
      ctx.obstacle(s + lx, side * dist, 1.6, 4.5, 'solid');
    }
    // hanging bare bulbs over the market
    for (let i = 0; i < 12; i++) {
      const q = F.L(-28 + i * 5, 4.5, side * ctx.rng.range(-1, 4));
      ctx.B.neon.box(q[0], q[1], q[2], 0.2, 0.25, 0.2, 0, { color: [3, 2.6, 1.6] });
    }
  },

  // ------------------------------------------------------------ HATIRJHEEL
  ledArch(ctx, s, hwTotal, opts = {}) {
    // big curved LED bridge arching over the road; uses the animated rainbow material
    const F = frame(ctx, s, 0, false);
    const span = hwTotal * 2 + 40;
    const H = opts.h || 18;
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const lz = -span / 2 + span * t;
      const ly = Math.sin(t * Math.PI) * H;
      pts.push(new THREE.Vector3(...F.L(Math.sin(t * Math.PI * 2) * 6, ly, lz)));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 80, 0.55, 8, false);
    const m = new THREE.Mesh(geo, ctx.world.mats.rainbow);
    ctx.extra.push(m);
    const geo2 = new THREE.TubeGeometry(curve, 80, 1.2, 8, false);
    const shell = new THREE.Mesh(geo2, lambert('archshell', () => new THREE.MeshLambertMaterial({ color: '#d8dade', transparent: true, opacity: 0.25, depthWrite: false })));
    ctx.extra.push(shell);
    // a second, lower ribbon
    const pts2 = pts.map((p, i) => {
      const t = i / 24;
      return new THREE.Vector3(...F.L(-Math.sin(t * Math.PI * 2) * 6 + 10, Math.sin(t * Math.PI) * H * 0.62, -span / 2 + span * t));
    });
    ctx.extra.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts2), 80, 0.4, 6, false), ctx.world.mats.rainbow));
    // feet
    for (const side of [-1, 1]) {
      ctx.obstacle(s, side * (span / 2), 2, 2, 'solid');
    }
  },

  fountain(ctx, s, side, dist) {
    const F = frame(ctx, s, side * dist);
    const geo = new THREE.CylinderGeometry(0.2, 0.9, 1, 8, 6, true);
    geo.translate(0, 0.5, 0);
    for (let i = 0; i < 9; i++) {
      const lx = (i - 4) * 4;
      const q = F.L(lx, -1, 0);
      const m = new THREE.Mesh(geo, ctx.world.mats.fountain);
      m.position.set(q[0], q[1], q[2]);
      m.userData.phase = i * 0.7;
      m.userData.fountain = true;
      m.scale.set(1, 10, 1);
      ctx.extra.push(m);
      ctx.dynamic = ctx.dynamic || [];
      ctx.dynamic.push(m);
    }
  },

  // ------------------------------------------------------------ RIVERS
  launch(ctx, s, side, dist) {
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    const L = ctx.misc.get('launch_side');
    const len = ctx.rng.range(50, 72), w = 12;
    // hull
    lbox(B, F, 0, -1.4, 0, w, 3.2, len, { color: [0.2, 0.25, 0.3], region: ctx.misc.get('metal') });
    const bow1 = F.L(len / 2 + 9, 1.8, 0), bl = F.L(len / 2, -1.4, -w / 2), br = F.L(len / 2, -1.4, w / 2), tl = F.L(len / 2, 1.8, -w / 2), tr = F.L(len / 2, 1.8, w / 2);
    B.tri(bl, tl, bow1, [0.2, 0.25, 0.3], ctx.misc.get('metal'));
    B.tri(tr, br, bow1, [0.2, 0.25, 0.3], ctx.misc.get('metal'));
    B.tri(tl, tr, bow1, [0.8, 0.8, 0.78], ctx.misc.get('metal'));
    // decks with the painted/emissive side texture
    lbox(B, F, -2, 1.8, 0, w - 0.6, 10.5, len - 8, { regions: { side: L, front: L, back: L, top: ctx.misc.get('concrete_smooth') }, color: [1, 1, 1] });
    // funnel / bridge
    lbox(B, F, len * 0.18, 12.3, 0, 6, 3, 8, { color: [0.95, 0.95, 0.92], region: ctx.misc.get('concrete_smooth') });
    const fq = F.L(-len * 0.1, 12.3, 0);
    B.cylinder(fq[0], fq[1], fq[2], 1.3, 1.2, 4.5, 10, [0.8, 0.15, 0.12], ctx.misc.get('metal'));
    // searchlight
    const sl = F.L(len * 0.2, 15.6, 0);
    ctx.B.always.box(sl[0], sl[1], sl[2], 0.8, 0.8, 0.8, F.yaw, { color: [3, 3, 2.5] });
  },

  boat(ctx, s, side, dist, kind = 'nouka') {
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    const wood = ctx.misc.get('wood');
    const yawOff = ctx.rng.range(-0.6, 0.6);
    if (kind === 'swan') {
      lbox(B, F, 0, -1.2, 0, 1.8, 0.9, 2.6, { color: [0.95, 0.95, 0.95], region: ctx.misc.get('white') }, yawOff);
      const h = F.L(1.3, -0.3, 0);
      B.tube([h[0], h[1], h[2]], [h[0], h[1] + 1.4, h[2]], 0.18, 0.12, 6, [0.97, 0.97, 0.97], ctx.misc.get('white'));
      ctx.B.always.box(h[0], h[1] + 1.4, h[2], 0.2, 0.15, 0.3, F.yaw, { color: [1.4, 0.4, 0.1] });
      return;
    }
    if (kind === 'taxi') {
      lbox(B, F, 0, -1.3, 0, 2.6, 1.0, 9, { color: [0.95, 0.95, 0.95], region: ctx.misc.get('white') }, yawOff);
      lbox(B, F, 0, -0.3, 0, 2.3, 1.6, 6, { color: [0.15, 0.4, 0.8], region: ctx.misc.get('glass_dark') }, yawOff);
      const q = F.L(0, 1.4, 0);
      ctx.B.neon.box(q[0], q[1], q[2], 2.4, 0.08, 6.2, F.yaw + yawOff, { color: [0.3, 1.8, 2.8] });
      return;
    }
    // country boat with a lantern
    const len = kind === 'fishing' ? 10 : 7;
    lbox(B, F, 0, -1.25, 0, 1.6, 0.7, len, { color: [0.55, 0.36, 0.22], region: wood }, yawOff);
    const e1 = F.L(len / 2, -0.6, 0), e2 = F.L(-len / 2, -0.6, 0);
    B.box(e1[0], e1[1], e1[2], 0.4, 0.9, 0.6, F.yaw + yawOff, { color: [0.5, 0.32, 0.2], region: wood });
    B.box(e2[0], e2[1], e2[2], 0.4, 0.9, 0.6, F.yaw + yawOff, { color: [0.5, 0.32, 0.2], region: wood });
    // bamboo hood (chhoi)
    lbox(B, F, -0.5, -0.55, 0, 1.5, 1.0, 2.4, { color: [0.75, 0.6, 0.35], region: ctx.misc.get('bamboo') }, yawOff);
    const lp = F.L(len * 0.35, 0.3, 0);
    ctx.B.neon.box(lp[0], lp[1], lp[2], 0.18, 0.25, 0.18, 0, { color: [3, 1.8, 0.6] });
    const bm = F.L(-len * 0.3, -0.55, 0);
    ctx.sprites.add('p_lungi', bm[0], bm[1], bm[2], 0.95, { lamp: 0.4 });
    if (kind === 'fishing') {
      const n0 = F.L(len * 0.5, -0.4, 0);
      ctx.W.sag(n0, F.L(len * 0.5 + 6, -1.0, 3), 0.5, 6);
      ctx.W.sag(n0, F.L(len * 0.5 + 6, -1.0, -3), 0.5, 6);
    }
  },

  cableBridge(ctx, s, side) {
    // Babubazar-style bridge crossing over the road and out over the river
    // `side` is the river side. The deck starts inland, crosses over us, runs out over the water.
    const F = frame(ctx, s, 0, true);
    const B = ctx.B.misc;
    const conc = ctx.misc.get('concrete_smooth');
    const H = 12;
    const zIn = -side * 45, zOut = side * 520;
    const len = Math.abs(zOut - zIn);
    const mid = F.L(0, H, (zIn + zOut) / 2);
    B.box(mid[0], mid[1], mid[2], len, 1.6, 14, F.yaw, { color: [0.82, 0.8, 0.77], region: conc, tile: [4, 4] });
    for (const lz of [-side * 30, side * 40, side * 120, side * 220, side * 320, side * 420]) {
      const q = F.L(0, 0, lz);
      B.box(q[0], q[1] - 4, q[2], 3, H + 3, 3, F.yaw, { color: [0.78, 0.76, 0.72], region: conc });
      if (Math.abs(lz) < 60) ctx.obstacle(s, lz, 2, 2, 'solid');
    }
    const x1 = zOut;
    // pylons and cables
    for (const lz of [side * 140, side * 330]) {
      const q = F.L(0, H, lz);
      B.tube([q[0], q[1], q[2]], [q[0], q[1] + 38, q[2]], 1.4, 0.9, 6, [0.85, 0.83, 0.8], conc);
      for (let k = -6; k <= 6; k++) {
        if (!k) continue;
        const d = F.L(0, H + 0.6, lz + k * 14);
        ctx.W.seg([q[0], q[1] + 36, q[2]], d, [0.7, 0.72, 0.75]);
      }
      ctx.B.always.box(q[0], q[1] + 38.5, q[2], 0.8, 0.8, 0.8, 0, { color: [3, 0.1, 0.1] });
    }
    // deck lights
    for (let lz = -side * 50; Math.abs(lz) < Math.abs(x1); lz += side * 20) {
      for (const lx of [-6.5, 6.5]) {
        const q = F.L(lx, H + 0.9, lz);
        ctx.B.lamp.box(q[0], q[1], q[2], 0.25, 0.3, 0.25, 0, { color: [3, 2.2, 1] });
      }
    }
  },

  // ------------------------------------------------------------ MOTIJHEEL
  shaplaChattar(ctx, s, side, dist) {
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    const white = ctx.misc.get('marble');
    const c = F.L(0, 0, 0);
    B.cylinder(c[0], c[1], c[2], 11, 11, 0.9, 32, [0.85, 0.85, 0.82], white);
    const water = new THREE.Mesh(new THREE.CircleGeometry(10.5, 32), ctx.world.mats.water);
    water.rotation.x = -Math.PI / 2;
    water.position.set(c[0], c[1] + 0.85, c[2]);
    ctx.extra.push(water);
    B.cylinder(c[0], c[1], c[2], 2.2, 1.6, 4, 12, [0.9, 0.9, 0.88], white);
    // the water lily: two rings of curved petals
    for (const [n, r, h, lean, off] of [[8, 5.5, 6, 0.9, 0], [8, 3.8, 7, 0.55, 0.4]]) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + off;
        const base = [c[0] + Math.cos(a) * 0.8, c[1] + 4, c[2] + Math.sin(a) * 0.8];
        const tip = [c[0] + Math.cos(a) * r, c[1] + 4 + h * Math.cos(lean * 0.5), c[2] + Math.sin(a) * r];
        const perp = [-Math.sin(a), 0, Math.cos(a)];
        const wdt = 1.6;
        const m1 = [base[0] + (tip[0] - base[0]) * 0.5 + perp[0] * wdt, base[1] + (tip[1] - base[1]) * 0.45, base[2] + (tip[2] - base[2]) * 0.5 + perp[2] * wdt];
        const m2 = [base[0] + (tip[0] - base[0]) * 0.5 - perp[0] * wdt, base[1] + (tip[1] - base[1]) * 0.45, base[2] + (tip[2] - base[2]) * 0.5 - perp[2] * wdt];
        B.tri(base, m1, tip, [0.98, 0.97, 0.95], white);
        B.tri(base, tip, m2, [0.98, 0.97, 0.95], white);
        B.tri(base, tip, m1, [0.93, 0.92, 0.9], white);
        B.tri(base, m2, tip, [0.93, 0.92, 0.9], white);
        ctx.B.neon.box(tip[0], tip[1], tip[2], 0.2, 0.2, 0.2, 0, { color: [2.6, 2.6, 2.4] });
      }
    }
    // jets around
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const q = [c[0] + Math.cos(a) * 8, c[1] + 0.9, c[2] + Math.sin(a) * 8];
      ctx.B.lamp.box(q[0], q[1], q[2], 0.3, 0.2, 0.3, 0, { color: [1.6, 2.2, 3] });
    }
    ctx.obstacle(s, side * dist, 12, 12, 'solid');
  },

  kamalapur(ctx, s, side, dist) {
    // Kamalapur station: a row of concrete umbrella shells on columns
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    const conc = ctx.misc.get('concrete_smooth');
    const n = 9, u = 14;
    for (let i = 0; i < n; i++) {
      const lx = (i - (n - 1) / 2) * u;
      const col = F.L(lx, 0, 0);
      B.cylinder(col[0], col[1], col[2], 0.7, 0.5, 9, 8, [0.85, 0.84, 0.8], conc);
      // shell: centre low, four corners rising (inverted umbrella)
      const cH = 9.2, eH = 13;
      const c = F.L(lx, cH, 0);
      const k = [F.L(lx - u / 2, eH, -u / 2), F.L(lx + u / 2, eH, -u / 2), F.L(lx + u / 2, eH, u / 2), F.L(lx - u / 2, eH, u / 2)];
      const mids = [F.L(lx, eH - 2.4, -u / 2), F.L(lx + u / 2, eH - 2.4, 0), F.L(lx, eH - 2.4, u / 2), F.L(lx - u / 2, eH - 2.4, 0)];
      for (let j = 0; j < 4; j++) {
        const a = k[j], b = mids[j], d = k[(j + 1) % 4];
        B.tri(c, a, b, [0.9, 0.89, 0.85], conc); B.tri(c, b, a, [0.75, 0.74, 0.7], conc);
        B.tri(c, b, d, [0.9, 0.89, 0.85], conc); B.tri(c, d, b, [0.75, 0.74, 0.7], conc);
      }
      ctx.B.lamp.box(c[0], c[1] - 0.6, c[2], 1.2, 0.2, 1.2, F.yaw, { color: [2.8, 2.7, 2.4] });
    }
    // platforms with waiting passengers
    lbox(B, F, 0, 0, 0, 20, 0.9, n * u, { color: [0.6, 0.58, 0.55], region: conc, tile: [3, 3] });
    for (let i = 0; i < 18; i++) {
      const q = F.L(ctx.rng.range(-n * u / 2, n * u / 2), 0.9, ctx.rng.range(-8, 8));
      ctx.sprites.add(ctx.rng.pick(['crowd0', 'crowd1', 'p_lungi', 'p_saree', 'p_vendor']), q[0], q[1], q[2], 1, { lamp: 0.9 });
    }
    const t = canvasTex('kamalapur_sign', 768, 128, (c, w, h) => {
      c.fillStyle = '#0d6b3d'; c.fillRect(0, 0, w, h);
      P.signText(c, 'কমলাপুর রেলওয়ে স্টেশন', w / 2, h / 2, { font: `700 60px ${P.FONT_BN_SANS}`, fill: '#ffffff', stroke: null, lw: 0, maxW: w - 30 });
    });
    const mat = lambert('kamalapur_sign', () => new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.6, 1.6, 1.6) }));
    const q = F.L(0, 14.5, -side * 10);
    ctx.extra.push(meshAt(new THREE.PlaneGeometry(24, 4), mat, q, F.yaw + (side < 0 ? -Math.PI / 2 : Math.PI / 2)));
    ctx.obstacle(s, side * dist, 12, n * u / 2, 'solid');
  },

  baitulMukarram(ctx, s, side, dist) {
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    const white = ctx.misc.get('marble');
    lbox(B, F, 0, -1, 0, 42, 30, 42, { color: [0.96, 0.96, 0.94], region: white, tile: [6, 6] });
    for (let k = 0; k < 4; k++) lbox(B, F, 0, 5 + k * 6, 0, 42.4, 1.2, 42.4, { color: [0.3, 0.32, 0.3], region: white });
    lbox(B, F, 0, -1, -side * 26, 40, 1.4, 50, { color: [0.85, 0.84, 0.8], region: white, tile: [4, 4] });
    for (let k = 0; k < 4; k++) {
      const q = F.L(-15 + k * 10, 0.5, -side * 22);
      ctx.B.lamp.box(q[0], q[1], q[2], 0.5, 0.4, 0.5, 0, { color: [2.5, 2.5, 2.4] });
    }
    ctx.obstacle(s, side * dist, 22, 22, 'solid');
  },

  // ------------------------------------------------------------ GULSHAN
  embassy(ctx, s, side, dist) {
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    const white = ctx.misc.get('concrete_smooth');
    lbox(B, F, 0, 0, -side * 2, 0.5, 3, 60, { color: [0.95, 0.95, 0.93], region: white });
    // barbed wire
    for (let i = -30; i < 30; i += 0.8) {
      const q = F.L(i, 3.3, -side * 2);
      ctx.W.seg(q, F.L(i + 0.8, 3.15 + Math.random() * 0.3, -side * 2));
    }
    lbox(ctx.B.world, F, 0, -1, side * 10, 18, 14, 34, { regions: { front: ctx.facade.get('apt_white'), back: ctx.facade.get('apt_white'), side: ctx.facade.get('apt_white'), top: ctx.facade.get('roof') }, tile: [12, 12], color: [1, 1, 1] });
    for (const lx of [-8, 0, 8]) {
      const q = F.L(lx, 3, -side * 1.5);
      ctx.sprites.add('flag', q[0], q[1], q[2], 1.2, { tint: [ctx.rng.range(0.6, 1.2), ctx.rng.range(0.6, 1.2), ctx.rng.range(0.6, 1.2)] });
    }
    const g = F.L(20, 0, -side * 2.5);
    ctx.sprites.add('police', g[0], g[1], g[2], 1, { lamp: 1 });
    ctx.obstacle(s, side * dist, 12, 30, 'solid');
  },

  // ------------------------------------------------------------ MIRPUR
  stadium(ctx, s, side, dist) {
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    const conc = ctx.misc.get('concrete');
    const crowd = ctx.misc.get('stadium_crowd');
    const A = 95, Bm = 78, H = 24, n = 36;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const p0 = [Math.cos(a0) * A, Math.sin(a0) * Bm], p1 = [Math.cos(a1) * A, Math.sin(a1) * Bm];
      const q0 = [Math.cos(a0) * (A - 30), Math.sin(a0) * (Bm - 30)], q1 = [Math.cos(a1) * (A - 30), Math.sin(a1) * (Bm - 30)];
      // outer wall
      const o0 = F.L(p0[0], -1, p0[1]), o1 = F.L(p1[0], -1, p1[1]), o2 = F.L(p1[0], H, p1[1]), o3 = F.L(p0[0], H, p0[1]);
      B.quad(o1, o0, o3, o2, [0, 0, 4, 4], [0.82, 0.8, 0.76], conc);
      // sloped stands (inner) with crowd texture
      const i0 = F.L(q0[0], 2, q0[1]), i1 = F.L(q1[0], 2, q1[1]);
      B.quad(i0, i1, o2, o3, [0, 0, 1, 1], [1, 1, 1], crowd);
    }
    // LED ring around the bowl in the national colours
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const r0 = F.L(Math.cos(a0) * (A + 0.3), H - 3, Math.sin(a0) * (Bm + 0.3)), r1 = F.L(Math.cos(a1) * (A + 0.3), H - 3, Math.sin(a1) * (Bm + 0.3));
      const col = i % 2 ? [0.1, 2.2, 0.6] : [2.6, 0.2, 0.2];
      ctx.B.neon.quad([r1[0], r1[1], r1[2]], [r0[0], r0[1], r0[2]], [r0[0], r0[1] + 1.2, r0[2]], [r1[0], r1[1] + 1.2, r1[2]], [0, 0, 1, 1], col);
      ctx.B.neon.quad([r0[0], r0[1], r0[2]], [r1[0], r1[1], r1[2]], [r1[0], r1[1] + 1.2, r1[2]], [r0[0], r0[1] + 1.2, r0[2]], [0, 0, 1, 1], col);
    }
    // victory board facing the road
    const vt = canvasTex('bdwins', 1024, 256, (c, w, h) => {
      c.fillStyle = '#04301a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#c8102e'; c.beginPath(); c.arc(130, h / 2, 90, 0, Math.PI * 2); c.fill();
      P.signText(c, 'বাংলাদেশ জিতেছে!', 600, 100, { font: `700 92px ${P.FONT_BN}`, fill: '#ffe14a', stroke: '#000', lw: 6, maxW: 760 });
      P.signText(c, 'BANGLADESH WIN BY 3 WICKETS', 600, 200, { font: `400 46px ${P.FONT_SIGN}`, fill: '#ffffff', stroke: null, lw: 0, maxW: 760 });
    });
    const vm = lambert('bdwins', () => new THREE.MeshBasicMaterial({ map: vt, color: new THREE.Color(1.5, 1.5, 1.5) }));
    const vq = F.L(-20, H + 6, -side * (Bm - 6));
    ctx.extra.push(meshAt(new THREE.PlaneGeometry(36, 9), vm, vq, F.yaw + (side < 0 ? -Math.PI / 2 : Math.PI / 2)));
    const fc = F.L(0, 0.2, 0);
    const field = new THREE.Mesh(new THREE.CircleGeometry(1, 40), lambert('pitch', () => new THREE.MeshLambertMaterial({ color: '#2f6a2a', emissive: '#0c2a0c' })));
    field.rotation.x = -Math.PI / 2;
    field.scale.set(A - 28, Bm - 28, 1);
    field.position.set(fc[0], fc[1], fc[2]);
    field.rotation.z = F.yaw;
    ctx.extra.push(field);
    // four floodlight towers
    for (const [ax, az] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const q = F.L(ax * A * 0.78, 0, az * Bm * 0.78);
      B.cylinder(q[0], q[1], q[2], 1.4, 0.7, 52, 6, [0.7, 0.7, 0.72], ctx.misc.get('metal'));
      B.box(q[0], q[1] + 52, q[2], 9, 6, 1, F.yaw + Math.atan2(az, ax) + Math.PI / 2, { color: [0.3, 0.3, 0.3], region: ctx.misc.get('metal') });
      ctx.B.lamp.box(q[0], q[1] + 52.2, q[2], 8.6, 5.4, 1.2, F.yaw + Math.atan2(az, ax) + Math.PI / 2, { color: [3.4, 3.3, 3.0] });
      beam(ctx, [q[0], q[1] + 52, q[2]], [(fc[0] - q[0]) * 0.012, -1, (fc[2] - q[2]) * 0.012], 58, 18, [0.55, 0.55, 0.5]);
    }
    ctx.obstacle(s, side * dist, Bm + 2, A + 2, 'solid');
  },

  metroStation(ctx, s, hwL, hwR) {
    const F = frame(ctx, s, (hwR - hwL) / 2, false);
    const B = ctx.B.misc;
    const conc = ctx.misc.get('concrete_smooth');
    const span = hwL + hwR + 16;
    lbox(B, F, 0, 9.5, 0, span, 1.6, 140, { color: [0.86, 0.85, 0.82], region: conc, tile: [4, 4] });
    lbox(B, F, 0, 11.1, 0, span - 2, 6.5, 140, { color: [0.75, 0.82, 0.85], region: ctx.misc.get('glass_dark') });
    // curved roof as a series of slanted slabs
    for (let k = 0; k < 6; k++) {
      const a = (k / 5 - 0.5) * 1.6;
      lbox(B, F, 0, 17.6 + Math.cos(a) * 2.5, Math.sin(a) * span * 0.45, span * 0.22, 0.4, 144, { color: [0.92, 0.92, 0.9], region: conc }, 0);
    }
    for (let i = -6; i <= 6; i++) {
      const q = F.L(i * 10, 12.5, -span / 2 - 0.05);
      ctx.B.neon.box(q[0], q[1], q[2], 0.1, 2.2, 6, F.yaw, { color: [2.4, 2.6, 2.6] });
      const q2 = F.L(i * 10, 12.5, span / 2 + 0.05);
      ctx.B.neon.box(q2[0], q2[1], q2[2], 0.1, 2.2, 6, F.yaw, { color: [2.4, 2.6, 2.6] });
    }
    // pillars on both sides of the road
    for (let i = -3; i <= 3; i++) {
      for (const lz of [-hwL - 4, hwR + 4]) {
        const q = F.L(i * 20, -0.1, lz);
        B.box(q[0], q[1], q[2], 1.6, 9.6, 1.6, F.yaw, { color: [0.85, 0.84, 0.8], region: conc });
        ctx.obstacle(s + i * 20, lz + (hwR - hwL) / 2, 1, 1, 'solid');
      }
    }
  },

  // ------------------------------------------------------------ EXITS
  tollPlaza(ctx, s, hw, lanes) {
    const F = frame(ctx, s, 0, false);
    const B = ctx.B.misc;
    const toll = ctx.misc.get('toll');
    const W = hw * 2 + 6;
    lbox(B, F, 0, 6.2, 0, W, 1.4, 14, { regions: { front: toll, back: toll, side: toll, top: ctx.misc.get('metal') }, color: [1, 1, 1] });
    // booths between every lane
    for (let i = 0; i <= lanes; i++) {
      const lz = -hw + i * (hw * 2) / lanes;
      lbox(B, F, 0, 0, lz, 1.4, 3, 6, { color: [0.9, 0.9, 0.88], region: toll });
      lbox(B, F, 0, 3, lz, 1.6, 3.2, 1.0, { color: [0.6, 0.62, 0.64], region: ctx.misc.get('metal') });
      // barrels of the island
      for (const lx of [-5, 5]) {
        const q = F.L(lx, 0, lz);
        B.cylinder(q[0], q[1], q[2], 0.45, 0.45, 1.0, 8, [1, 0.55, 0.05], ctx.misc.get('white'));
      }
      ctx.obstacle(s, lz, 0.9, 5.6, 'solid');
      const g = F.L(4, 5.4, lz + hw / lanes);
      if (i < lanes) ctx.B.always.box(g[0], g[1], g[2], 0.5, 0.5, 0.08, F.yaw, { color: [0.2, 3, 0.4] });
    }
  },

  smritiSoudho(ctx, s, side, dist) {
    // seven nested triangular walls rising to a sharp peak
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    const conc = ctx.misc.get('concrete_smooth');
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const H = 15 + t * 32;
      const W = 10 + (1 - t) * 24;
      const D = 3 + (1 - t) * 8;
      const lx = 22 - t * 18;
      const peak = F.L(lx - D * 0.3, H, 0);
      const fl = F.L(lx, 0, -W / 2), fr = F.L(lx, 0, W / 2);
      const bl = F.L(lx - D, 0, -W / 2), br = F.L(lx - D, 0, W / 2);
      const c = [0.9 - t * 0.05, 0.88 - t * 0.05, 0.84 - t * 0.06];
      B.tri(fl, fr, peak, c, conc); B.tri(fr, fl, peak, c, conc);
      B.tri(br, bl, peak, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8], conc); B.tri(bl, br, peak, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8], conc);
      B.tri(fl, bl, peak, [c[0] * 0.7, c[1] * 0.7, c[2] * 0.7], conc); B.tri(br, fr, peak, [c[0] * 0.7, c[1] * 0.7, c[2] * 0.7], conc);
    }
    // red brick terraces
    for (let k = 0; k < 4; k++) lbox(B, F, -6 + k * 9, -0.6 + k * 0.4, 0, 60 - k * 6, 1.2, 12, { color: [0.85, 0.42, 0.28], region: ctx.misc.get('terracotta'), tile: [4, 4] });
    // reflecting pool in front
    const water = new THREE.Mesh(new THREE.PlaneGeometry(18, 120), ctx.world.mats.water);
    water.rotation.x = -Math.PI / 2;
    water.rotation.z = F.yaw;
    const wq = F.L(-80, 0.15, 0);
    water.position.set(wq[0], wq[1], wq[2]);
    ctx.extra.push(water);
    ctx.obstacle(s, side * dist, 32, 32, 'solid');
  },

  kiln(ctx, s, side, dist) {
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    const brick = ctx.misc.get('kiln_brick');
    lbox(B, F, 0, -0.5, 0, 26, 3, 40, { color: [0.9, 0.6, 0.45], region: brick, tile: [3, 3] });
    const c = F.L(0, 2, 0);
    B.cylinder(c[0], c[1], c[2], 2.4, 1.3, 34, 10, [0.85, 0.5, 0.38], brick);
    ctx.emitters = ctx.emitters || [];
    ctx.emitters.push({ type: 'kilnSmoke', pos: [c[0], c[1] + 34, c[2]] });
  },

  airport(ctx, s, side, dist) {
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    const glassF = ctx.facade.get('glass_green');
    lbox(ctx.B.world, F, 0, -1, 0, 50, 16, 260, { regions: { front: glassF, back: glassF, side: glassF, top: ctx.facade.get('roof') }, tile: [12, 12], color: [0.9, 1, 1] });
    // wavy roof
    for (let i = 0; i < 10; i++) {
      lbox(B, F, -117 + i * 26, 15 + (i % 2) * 2, 0, 58, 0.6, 26.5, { color: [0.92, 0.92, 0.9], region: ctx.misc.get('metal') }, 0);
    }
    // control tower
    const tq = F.L(150, 0, side * 40);
    B.cylinder(tq[0], tq[1], tq[2], 3, 2.4, 46, 10, [0.9, 0.9, 0.88], ctx.misc.get('concrete_smooth'));
    B.cylinder(tq[0], tq[1] + 46, tq[2], 6, 7, 5, 10, [0.3, 0.6, 0.7], ctx.misc.get('glass_dark'));
    ctx.B.always.box(tq[0], tq[1] + 53, tq[2], 0.8, 0.8, 0.8, 0, { color: [3, 0.1, 0.1] });
    // runway approach lights in a long row away from the road
    for (let k = 0; k < 40; k++) {
      const q = F.L(-200 + k * 12, 0.3, side * 140);
      ctx.B.always.box(q[0], q[1], q[2], 0.5, 0.3, 0.5, 0, { color: k % 5 === 0 ? [3, 0.4, 0.2] : [3, 2.8, 2.2] });
      const q2 = F.L(-200 + k * 12, 0.3, side * 200);
      ctx.B.always.box(q2[0], q2[1], q2[2], 0.5, 0.3, 0.5, 0, { color: [0.3, 1.2, 3] });
    }
    const t = canvasTex('airport_sign', 1024, 160, (c, w, h) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
      P.signText(c, 'হযরত শাহজালাল আন্তর্জাতিক বিমানবন্দর', w / 2, h / 2, { font: `700 64px ${P.FONT_BN_SANS}`, fill: '#ffffff', stroke: null, lw: 0, maxW: w - 30 });
    });
    const mat = lambert('airport_sign', () => new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(2.2, 2.2, 2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const q = F.L(0, 18, -side * 25.4);
    ctx.extra.push(meshAt(new THREE.PlaneGeometry(60, 9.4), mat, q, F.yaw + (side < 0 ? -Math.PI / 2 : Math.PI / 2)));
    ctx.obstacle(s, side * dist, 26, 130, 'solid');
  },

  highwayHotel(ctx, s, side, dist) {
    const F = frame(ctx, s, side * dist);
    lbox(ctx.B.world, F, 0, -1, 0, 16, 8, 30, { regions: { front: ctx.facade.get('shop_b'), back: ctx.facade.get('side_plain'), side: ctx.facade.get('side_plain'), top: ctx.facade.get('roof') }, tile: [12, 3.75], color: [1, 1, 1] });
    const t = canvasTex('hwhotel', 1024, 200, (c, w, h) => {
      c.fillStyle = '#100'; c.fillRect(0, 0, w, h);
      P.signText(c, 'হোটেল হাইওয়ে ইন • রসমালাই', w / 2, h / 2, { font: `700 84px ${P.FONT_BN}`, fill: '#ff4a8a', stroke: '#ffd23a', lw: 3, maxW: w - 30 });
    });
    const mat = lambert('hwhotel', () => new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(2.4, 2.4, 2.4) }));
    const q = F.L(0, 8.6, -side * 8.2);
    ctx.extra.push(meshAt(new THREE.PlaneGeometry(26, 5), mat, q, F.yaw + (side < 0 ? -Math.PI / 2 : Math.PI / 2)));
    for (let i = 0; i < 3; i++) {
      const lx = -30 - i * 11;
      lbox(ctx.B.misc, F, lx, 0.6, -side * 14, 2.5, 2.8, 6.5, { regions: { side: ctx.misc.get('truck_side' + (i % 2)), front: ctx.misc.get('truck_back'), back: ctx.misc.get('truck_cab'), top: ctx.misc.get('tarp') }, color: [1, 1, 1] });
    }
    for (let i = 0; i < 6; i++) {
      const q2 = F.L(ctx.rng.range(-12, 12), 0, -side * ctx.rng.range(9, 12));
      ctx.sprites.add(ctx.rng.pick(['p_lungi', 'p_shirt', 'teastall', 'crowd0']), q2[0], q2[1], q2[2], 1, { lamp: 1 });
    }
    ctx.obstacle(s, side * dist, 9, 16, 'solid');
  },

  kurilLoops(ctx, s, side, dist) {
    // decorative looping flyover ramps
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    const conc = ctx.misc.get('concrete_smooth');
    for (let k = 0; k < 2; k++) {
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const r = 45 + k * 22;
        pts.push(F.L(Math.cos(a) * r + k * 40, 8 + Math.sin(a * 0.5) * 6 + k * 4, Math.sin(a) * r * 0.8 + side * 30));
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        B.tube(a, b, 4.2, 4.2, 4, [0.82, 0.81, 0.78], conc);
        if (i % 4 === 0) {
          B.box(a[0], F.p[1] - 1, a[2], 2, a[1] - F.p[1] - 3, 2, 0, { color: [0.8, 0.79, 0.76], region: conc });
          ctx.B.lamp.box(a[0], a[1] + 4.6, a[2], 0.3, 0.3, 0.3, 0, { color: ctx.lampRGB });
        }
      }
    }
  },

  gabtoli(ctx, s, side, dist) {
    // bus terminal: rows of parked inter-district buses
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 7; i++) {
        const k = (i + r) % 5;
        lbox(B, F, -36 + i * 12, 0.5, side * (r * 5), 2.5, 3.0, 10, { regions: { side: ctx.misc.get('bus_side' + k), front: ctx.misc.get('bus_back' + k), back: ctx.misc.get('bus_back' + k), top: ctx.misc.get('metal') }, color: [1, 1, 1] });
      }
    }
    for (let i = 0; i < 14; i++) {
      const q = F.L(ctx.rng.range(-40, 40), 0, side * ctx.rng.range(-4, 2));
      ctx.sprites.add(ctx.rng.pick(['crowd0', 'crowd1', 'p_vendor', 'p_lungi', 'teastall']), q[0], q[1], q[2], 1, { lamp: 0.8 });
    }
    ctx.obstacle(s, side * (dist + 5), 9, 44, 'solid');
  },

  ganabhaban(ctx, s, side, dist) {
    // the official residence: white columns, a lawn, a pond with ducks, and a helipad
    const F = frame(ctx, s, side * dist);
    const B = ctx.B.misc;
    const white = ctx.misc.get('white');
    const marble = ctx.misc.get('marble');
    lbox(B, F, 0, -0.02, 0, 110, 0.1, 150, { color: [0.32, 0.55, 0.22], region: white });
    // main block with a colonnade facing the road
    lbox(B, F, 15, 0, side * 22, 46, 13, 28, { color: [0.96, 0.95, 0.92], region: marble, tile: [6, 6] });
    lbox(B, F, 15, 13, side * 22, 48, 1.2, 30, { color: [0.85, 0.84, 0.8], region: marble });
    for (let i = 0; i < 10; i++) {
      const c = F.L(15 - 18 + i * 4, 0, side * 22 - side * 15.5);
      B.cylinder(c[0], c[1], c[2], 0.55, 0.5, 10, 10, [0.98, 0.97, 0.94], marble);
    }
    lbox(B, F, 15, 10, side * 22 - side * 15.5, 42, 1.4, 2.5, { color: [0.95, 0.94, 0.9], region: marble });
    // the pond, and the ducks that became famous
    const pond = F.L(-30, 0.05, side * 18);
    B.cylinder(pond[0], pond[1], pond[2], 12, 12, 0.05, 20, [0.2, 0.35, 0.45], white, { cap: true, capColor: [0.18, 0.32, 0.42] });
    for (let i = 0; i < 7; i++) {
      const d = F.L(-30 + Math.cos(i * 2.1) * 7, 0.1, side * 18 + Math.sin(i * 2.1) * 7);
      B.box(d[0], d[1], d[2], 0.35, 0.3, 0.5, F.yaw + i, { color: [1, 1, 0.97], region: white });
    }
    // helipad near the road
    const hp = F.L(-8, 0.06, -side * 12);
    B.cylinder(hp[0], hp[1], hp[2], 9, 9, 0.06, 28, [0.25, 0.25, 0.27], white, { cap: true, capColor: [0.22, 0.22, 0.24] });
    lbox(B, F, -8 - 3, 0.14, -side * 12, 0.9, 0.04, 6, { color: [1.4, 1.4, 1.3], region: white });
    lbox(B, F, -8 + 3, 0.14, -side * 12, 0.9, 0.04, 6, { color: [1.4, 1.4, 1.3], region: white });
    lbox(B, F, -8, 0.14, -side * 12, 0.9, 0.04, 6, { color: [1.4, 1.4, 1.3], region: white }, Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const q = F.L(-8 + Math.cos(a) * 8.6, 0.1, -side * 12 + Math.sin(a) * 8.6);
      ctx.B.always.box(q[0], q[1], q[2], 0.3, 0.12, 0.3, 0, { color: [3, 2.4, 0.6] });
    }
    // a huge crowd storming the compound: packed along the fence, fists up, flags, burning barricades
    {
      const rng = ctx.rng;
      const names = ['crowd0', 'crowd1', 'crowd2', 'p_lungi', 'p_shirt', 'p_panjabi', 'p_kameez', 'p_vendor'];
      for (let i = 0; i < 260; i++) {
        const along = rng.range(-70, 55);
        // thicker toward the gate (the fence line), thinner toward the road
        const lat = -side * (6 + Math.pow(rng.next(), 0.8) * (dist - 22));
        const p = F.L(along, 0.2, lat);
        ctx.sprites.add(rng.pick(names), p[0], p[1], p[2], rng.range(0.95, 1.2), { flip: rng.chance(0.5), lamp: 1, glow: 1 });
      }
      for (let i = 0; i < 26; i++) {
        const p = F.L(rng.range(-60, 50), 0, -side * rng.range(10, dist - 24));
        ctx.sprites.add('flag', p[0], p[1] + 3.2, p[2], rng.range(0.7, 1), { glow: 0 });
      }
      for (let i = 0; i < 7; i++) {
        const along = -55 + i * 18;
        const c = F.L(along, 0, -side * (dist - 18));
        ctx.B.always.box(c[0], c[1] + 0.3, c[2], 2.4, 0.5, 1.2, F.yaw, { color: [3, 1.1, 0.2] });
        (ctx.emitters = ctx.emitters || []).push({ type: 'kilnSmoke', pos: [c[0], c[1] + 2, c[2]] });
      }
    }
    // gate lamps and a flag
    const fp = F.L(-30, 0, -side * 30);
    B.cylinder(fp[0], fp[1], fp[2], 0.1, 0.08, 14, 6, [0.85, 0.85, 0.85], ctx.misc.get('metal'));
    ctx.sprites.add('flag', fp[0], fp[1] + 10, fp[2], 1.2, { glow: 0 });
  },

  jfp(ctx, s, side, dist) {
    LANDMARKS.tower(ctx, s, side, dist, { facade: 'glass_green', h: 34, w: 60, d: 120, sign: 'যমুনা ফিউচার পার্ক', crown: [2.6, 0.4, 1.6], signFont: 96 });
  },
};

export function bannerMaterial(lines, opts) {
  const key = 'banner_' + lines.join('|') + (opts?.c1 || '');
  return lambert(key, () => {
    const t = new THREE.CanvasTexture(makeBannerTexture(lines, opts));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return new THREE.MeshLambertMaterial({ map: t, emissive: new THREE.Color(0.35, 0.3, 0.25), emissiveMap: t, side: THREE.DoubleSide });
  });
}

export function gantryMaterial(tex) {
  return new THREE.MeshLambertMaterial({ map: tex, emissive: new THREE.Color(0.25, 0.25, 0.25), emissiveMap: tex });
}
