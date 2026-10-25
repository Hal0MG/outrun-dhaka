// Car models: "Free Low Poly Vehicles Pack" by Rgsdev (CC0, see src/assets/cars/LICENSE.txt).
// The FBX files are loaded once at startup, then refitted to real-world dimensions, recoloured
// per material (paint / glass / trim / lamps), and emitted either into a MeshBuilder for the
// instanced traffic cars or into plain geometries for the player's animated car.

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const FILES = import.meta.glob('../assets/cars/*.fbx', { query: '?url', import: 'default', eager: true });
export const RAW = {};

export async function loadCarAssets() {
  const loader = new FBXLoader();
  await Promise.all(Object.entries(FILES).map(async ([path, url]) => {
    const name = path.split('/').pop().replace('.fbx', '');
    const buf = await (await fetch(url)).arrayBuffer();
    RAW[name] = loader.parse(buf, '');
  }));
}

function kindOf(matName) {
  const n = (matName || '').toLowerCase();
  if (n.startsWith('tire')) return 'tyre';
  if (n.startsWith('wheel')) return 'rim';
  if (n.startsWith('window')) return 'glass';
  if (n.startsWith('headlight')) return 'head';
  if (n.startsWith('rear light')) return 'tail';
  if (n.includes('siren red')) return 'sirenR';
  if (n.includes('siren blue')) return 'sirenB';
  if (n.includes('black')) return 'black';
  if (n.includes('white')) return 'white';
  if (n.startsWith('body')) return 'paint';
  return 'black';
}

const CACHE = {};

// the pack ships flat-shaded; weld vertices and average face normals within a crease angle so panels read as smooth surfaces
function smoothNormals(tris, crease = 0.72) {
  const map = new Map();
  const key = (x, y, z) => Math.round(x * 400) + ',' + Math.round(y * 400) + ',' + Math.round(z * 400);
  const faces = tris.map((t) => {
    const ax = t.p[3] - t.p[0], ay = t.p[4] - t.p[1], az = t.p[5] - t.p[2];
    const bx = t.p[6] - t.p[0], by = t.p[7] - t.p[1], bz = t.p[8] - t.p[2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz) || 1;
    // keep the file's facing (the pack's winding is consistent, but be safe)
    if (nx * t.n[0] + ny * t.n[1] + nz * t.n[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
    return [nx / l, ny / l, nz / l];
  });
  tris.forEach((t, i) => {
    for (let k = 0; k < 3; k++) {
      const kk = key(t.p[k * 3], t.p[k * 3 + 1], t.p[k * 3 + 2]) + t.k;
      let arr = map.get(kk);
      if (!arr) map.set(kk, (arr = []));
      arr.push(i);
    }
  });
  const out = tris.map((t) => t.n.slice());
  tris.forEach((t, i) => {
    for (let k = 0; k < 3; k++) {
      const arr = map.get(key(t.p[k * 3], t.p[k * 3 + 1], t.p[k * 3 + 2]) + t.k);
      let sx = 0, sy = 0, sz = 0;
      for (const j of arr) {
        const d = faces[i][0] * faces[j][0] + faces[i][1] * faces[j][1] + faces[i][2] * faces[j][2];
        if (d > crease) { sx += faces[j][0]; sy += faces[j][1]; sz += faces[j][2]; }
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      out[i][k * 3] = sx / l; out[i][k * 3 + 1] = sy / l; out[i][k * 3 + 2] = sz / l;
    }
  });
  tris.forEach((t, i) => { t.n = out[i]; });
}

// Fit a model to {L, W, H} metres (forward = -Z, ground = y 0, centred on x/z).
// Returns { tris: [{k, p:[9], n:[9]}], wheels: [{cx, cy, cz, r, front, tris}], dims }.
export function fitCar(name, fit) {
  const key = name + JSON.stringify(fit);
  if (CACHE[key]) return CACHE[key];
  const raw = RAW[name];
  if (!raw) throw new Error('missing car model ' + name);
  raw.updateMatrixWorld(true);
  const v = new THREE.Vector3(), nv = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  const meshes = [];
  raw.traverse((o) => { if (o.isMesh) meshes.push(o); });
  // pass 1: bounds in "front = -Z" space (rotate the pack's +Z-front models half a turn)
  let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  const wheelBounds = [];
  for (const o of meshes) {
    const pos = o.geometry.attributes.position;
    const isWheel = /wheel/i.test(o.name);
    const wb = { mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9], name: o.name };
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const p = [-v.x, v.y, -v.z];
      for (let a = 0; a < 3; a++) {
        min[a] = Math.min(min[a], p[a]); max[a] = Math.max(max[a], p[a]);
        if (isWheel) { wb.mn[a] = Math.min(wb.mn[a], p[a]); wb.mx[a] = Math.max(wb.mx[a], p[a]); }
      }
    }
    if (isWheel) wheelBounds.push(wb);
  }
  const rawL = max[2] - min[2], rawW = max[0] - min[0], rawH = max[1] - min[1];
  const s = fit.L / rawL;
  const sx = fit.W / rawW;
  const sy = fit.H ? fit.H / rawH : s;
  const wr = wheelBounds.length ? (wheelBounds[0].mx[1] - wheelBounds[0].mn[1]) / 2 : 40;
  const wcy = wheelBounds.length ? (wheelBounds[0].mx[1] + wheelBounds[0].mn[1]) / 2 : wr;
  const rW = wr * s;
  const dy = rW - wcy * sy;
  const cxm = (min[0] + max[0]) / 2, czm = (min[2] + max[2]) / 2;
  const tris = [];
  const wheels = [];
  for (const o of meshes) {
    const geo = o.geometry;
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const isWheel = /wheel/i.test(o.name);
    nm.getNormalMatrix(o.matrixWorld);
    let wc = null, wTris = null;
    if (isWheel) {
      const wb = wheelBounds.find((w) => w.name === o.name);
      wc = [(wb.mn[0] + wb.mx[0]) / 2, (wb.mn[1] + wb.mx[1]) / 2, (wb.mn[2] + wb.mx[2]) / 2];
      wTris = [];
      wheels.push({ cx: (wc[0] - cxm) * sx, cy: rW, cz: (wc[2] - czm) * s, r: rW, front: wc[2] < czm, tris: wTris });
    }
    const groups = geo.groups.length ? geo.groups : [{ start: 0, count: pos.count, materialIndex: 0 }];
    for (const gr of groups) {
      const kind = kindOf(mats[gr.materialIndex] ? mats[gr.materialIndex].name : '');
      for (let i = gr.start; i + 2 < gr.start + gr.count; i += 3) {
        const P = [], N = [];
        for (let k = 0; k < 3; k++) {
          v.fromBufferAttribute(pos, i + k).applyMatrix4(o.matrixWorld);
          let x = -v.x, y = v.y, z = -v.z;
          if (nor) { nv.fromBufferAttribute(nor, i + k).applyMatrix3(nm).normalize(); } else nv.set(0, 1, 0);
          let nx = -nv.x, ny = nv.y, nz = -nv.z;
          if (isWheel) {
            // keep tyres round: scale about the wheel centre uniformly, squash only the width
            x = (x - wc[0]) * sx; y = (y - wc[1]) * s; z = (z - wc[2]) * s;
            nx /= sx; ny /= s; nz /= s;
          } else {
            x = (x - cxm) * sx; y = y * sy + dy; z = (z - czm) * s;
            nx /= sx; ny /= sy; nz /= s;
          }
          const l = Math.hypot(nx, ny, nz) || 1;
          P.push(x, y, z); N.push(nx / l, ny / l, nz / l);
        }
        const t = { k: kind, p: P, n: N };
        if (isWheel) wTris.push(t); else tris.push(t);
      }
    }
  }
  // the pack ships an underbody floor and skirt slabs that show as black boards around the car: drop everything low and flat
  for (let i = tris.length - 1; i >= 0; i--) {
    const t = tris[i];
    if (Math.max(t.p[1], t.p[4], t.p[7]) < 0.34) tris.splice(i, 1);
  }
  // low black bumpers, skirts and diffusers read as ugly frames: paint them body colour
  for (const t of tris) if (t.k === 'black' && (t.p[1] + t.p[4] + t.p[7]) / 3 < 0.5) t.k = 'paint';
  // where the number plates go: the rear and front faces at bumper height
  let fz = 1e9, rz = -1e9;
  for (const t of tris) {
    if (t.k !== 'paint' && t.k !== 'black') continue;
    const cy = (t.p[1] + t.p[4] + t.p[7]) / 3;
    if (cy < 0.3 || cy > 0.7) continue;
    for (let k = 0; k < 3; k++) { fz = Math.min(fz, t.p[k * 3 + 2]); rz = Math.max(rz, t.p[k * 3 + 2]); }
  }
  smoothNormals(tris);
  for (const w of wheels) smoothNormals(w.tris);
  // wheels as part of the static mesh too (for instanced traffic): moved back to their places
  const out = { tris, wheels, dims: { len: fit.L, wid: fit.W, hgt: fit.H || rawH * s }, rW, plates: { fz, rz, y: 0.46 } };
  CACHE[key] = out;
  return out;
}

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// colour of a vertex by material kind; paint takes `tint` (white on instanced traffic)
export function kindColor(kind, y, tint) {
  switch (kind) {
    case 'paint': { const k = 0.62 + 0.38 * sm(0.15, 0.8, y); return [tint[0] * k, tint[1] * k, tint[2] * k]; }
    case 'white': return [0.9, 0.9, 0.92];
    case 'black': return [0.035, 0.035, 0.04];
    case 'tyre': return [0.03, 0.03, 0.035];
    case 'rim': return [0.62, 0.64, 0.68];
    case 'glass': return mix([0.05, 0.07, 0.1], [0.3, 0.38, 0.5], sm(0.8, 1.5, y) * 0.8);
    case 'sirenR': return [3, 0.1, 0.1];
    case 'sirenB': return [0.2, 0.4, 3];
    default: return [0.5, 0.5, 0.5];
  }
}

// ---- traffic: emit into a MeshBuilder (+ lamp builders); wheels are baked in at rest
export function emitTraffic(B, Lt, name, fit, region, tint = [1, 1, 1], opts = {}) {
  const car = fitCar(name, fit);
  const add = (t, dx = 0, dy = 0, dz = 0) => {
    const tgt = t.k === 'head' ? Lt.head : t.k === 'tail' ? Lt.tail : B;
    const col = t.k === 'head' ? [2.6, 2.5, 2.2] : t.k === 'tail' ? [2.5, 0.08, 0.04] : kindColor(t.k, t.p[1] + dy, opts.paintFixed || tint);
    const i = [];
    for (let k = 0; k < 3; k++) i.push(tgt.vert(t.p[k * 3] + dx, t.p[k * 3 + 1] + dy, t.p[k * 3 + 2] + dz, t.n[k * 3], t.n[k * 3 + 1], t.n[k * 3 + 2], 0.5, 0.5, col, tgt.withRegion ? region : undefined));
    tgt.idx.push(i[0], i[1], i[2]);
  };
  for (const t of car.tris) add(t);
  if (opts.plateRegion) {
    const { fz, rz, y } = car.plates;
    const hw = 0.26, hh = 0.07;
    B.quad([-hw, y - hh, rz + 0.012], [hw, y - hh, rz + 0.012], [hw, y + hh, rz + 0.012], [-hw, y + hh, rz + 0.012], [0, 0, 1, 1], [1, 1, 1], opts.plateRegion);
    B.quad([hw, y - hh, fz - 0.012], [-hw, y - hh, fz - 0.012], [-hw, y + hh, fz - 0.012], [hw, y + hh, fz - 0.012], [0, 0, 1, 1], [1, 1, 1], opts.plateRegion);
  }
  for (const w of car.wheels) for (const t of w.tris) add(t, w.cx, w.cy, w.cz);
  return car.dims;
}

// ---- player: plain geometries
function geoFrom(tris, pick, tint, dx = 0, dy = 0, dz = 0, colored = true) {
  const pos = [], nor = [], col = [];
  for (const t of tris) {
    if (!pick(t.k)) continue;
    for (let k = 0; k < 3; k++) {
      pos.push(t.p[k * 3] + dx, t.p[k * 3 + 1] + dy, t.p[k * 3 + 2] + dz);
      nor.push(t.n[k * 3], t.n[k * 3 + 1], t.n[k * 3 + 2]);
      if (colored) col.push(...kindColor(t.k, t.p[1] + dy, tint));
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (colored) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

export function playerParts(name, fit) {
  const car = fitCar(name, fit);
  const W = [1, 1, 1];
  const parts = {
    paint: geoFrom(car.tris, (k) => k === 'paint', W, 0, 0, 0, true),
    rest: geoFrom(car.tris, (k) => k !== 'paint' && k !== 'head' && k !== 'tail', W),
    head: geoFrom(car.tris, (k) => k === 'head', W, 0, 0, 0, false),
    tail: geoFrom(car.tris, (k) => k === 'tail', W, 0, 0, 0, false),
    plates: car.plates,
    wheels: car.wheels.map((w) => ({ cx: w.cx, cy: w.cy, cz: w.cz, r: w.r, front: w.front, geo: geoFrom(w.tris, () => true, W) })),
    dims: car.dims,
  };
  // the pack's cars are left-hand drive; Bangladesh drives on the left, so the player's car is mirrored into a
  // right-hand-drive one and the steering wheel sits in front of the driver (the plates are separate meshes)
  for (const k of ['paint', 'rest', 'head', 'tail']) if (parts[k]) mirrorX(parts[k]);
  for (const w of parts.wheels) { w.cx = -w.cx; mirrorX(w.geo); }
  return parts;
}

// mirror a geometry across x and flip its triangle winding so the faces still point outward
function mirrorX(g) {
  g.scale(-1, 1, 1);
  if (g.index) {
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    g.index.needsUpdate = true;
    return;
  }
  for (const a of Object.values(g.attributes)) {
    const n = a.itemSize, arr = a.array;
    for (let i = 0; i < a.count; i += 3) {
      for (let c = 0; c < n; c++) { const t = arr[(i + 1) * n + c]; arr[(i + 1) * n + c] = arr[(i + 2) * n + c]; arr[(i + 2) * n + c] = t; }
    }
    a.needsUpdate = true;
  }
}
