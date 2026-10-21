// Dhaka's real car scene, built from extruded side profiles.
// Model space: forward = -Z, right = +X, up = +Y, origin at ground centre,
// +Z is the REAR. Every builder returns { body, tail, head, amber?, beacon?,
// len, wid, hgt } geometries; bodies use the fx atlas (see world/fxatlas.js).

import * as THREE from 'three';
import { MeshBuilder } from '../world/builder.js';
import { loftCar, loftToBuilder, surfaceAt, BODIES } from './carbody.js';
import { emitTraffic } from './carassets.js';

const PAINT = [1, 1, 1];
const DARK = [0.09, 0.09, 0.1];
const TRIM = [0.16, 0.16, 0.17];
const CHROME = [0.85, 0.86, 0.88];

function lights() {
  return { tail: new MeshBuilder(false), head: new MeshBuilder(false), amber: new MeshBuilder(false), beacon: new MeshBuilder(false) };
}

// Extrude a closed side profile [[z, y], ...] across the width.
// hw(z, y) gives the half width at a profile point (tumblehome / taper).
export function extrude(B, pts, hw, region, color, opts = {}) {
  const n = pts.length;
  let zmin = Infinity, zmax = -Infinity, ymin = Infinity, ymax = -Infinity, cz = 0, cy = 0;
  for (const [z, y] of pts) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); cz += z; cy += y; }
  cz /= n; cy /= n;
  const W = (i) => (typeof hw === 'function' ? hw(pts[i][0], pts[i][1]) : hw);
  const uvAt = (z, y) => [(zmax - z) / (zmax - zmin || 1), (y - ymin) / (ymax - ymin || 1)];
  const sideReg = opts.sideRegion || region;
  if (opts.sides !== false) {
    const contour = pts.map(([z, y]) => new THREE.Vector2(z, y));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const side of [1, -1]) {
      for (const [a, b, c] of tris) {
        const P = (i) => [side * W(i), pts[i][1], pts[i][0]];
        let pa = P(a), pb = P(b), pc = P(c);
        let ua = uvAt(pts[a][0], pts[a][1]), ub = uvAt(pts[b][0], pts[b][1]), uc = uvAt(pts[c][0], pts[c][1]);
        // make the face point outward (+x on the right, -x on the left)
        const ux = pb[0] - pa[0], uy = pb[1] - pa[1], uz = pb[2] - pa[2];
        const vx = pc[0] - pa[0], vy = pc[1] - pa[1], vz = pc[2] - pa[2];
        const nx = uy * vz - uz * vy;
        if (nx * side < 0) { [pb, pc] = [pc, pb]; [ub, uc] = [uc, ub]; }
        if (side < 0) { ua = [1 - ua[0], ua[1]]; ub = [1 - ub[0], ub[1]]; uc = [1 - uc[0], uc[1]]; }
        B.tri(pa, pb, pc, opts.sideColor || color, sideReg, [ua, ub, uc]);
      }
    }
  }
  // the skin around the perimeter
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (opts.skipEdge && opts.skipEdge(pts[i], pts[j])) continue;
    const [z0, y0] = pts[i], [z1, y1] = pts[j];
    const a = [-W(i), y0, z0], b = [W(i), y0, z0], c = [W(j), y1, z1], d = [-W(j), y1, z1];
    // outward test against the profile centroid
    const mz = (z0 + z1) / 2 - cz, my = (y0 + y1) / 2 - cy;
    const ez = z1 - z0, ey = y1 - y0;
    // normal of the edge in the z-y plane
    let nz = ey, ny = -ez;
    const edgeReg = opts.edgeRegion ? opts.edgeRegion(pts[i], pts[j]) : region;
    const edgeCol = opts.edgeColor ? opts.edgeColor(pts[i], pts[j]) : color;
    const len = Math.hypot(ez, ey);
    const uv = [0, 0, 1, opts.edgeTile ? Math.max(1, len / opts.edgeTile) : 1];
    if (nz * mz + ny * my >= 0) B.quad(a, b, c, d, uv, edgeCol, edgeReg);
    else B.quad(b, a, d, c, uv, edgeCol, edgeReg);
  }
}

// flat disc facing +z (dir=1) or -z (dir=-1)
export function discZ(B, x, y, z, r, seg, color, dir = 1, region) {
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const p0 = [x + Math.cos(a0) * r, y + Math.sin(a0) * r, z], p1 = [x + Math.cos(a1) * r, y + Math.sin(a1) * r, z];
    if (dir > 0) B.tri([x, y, z], p0, p1, color, region);
    else B.tri([x, y, z], p1, p0, color, region);
  }
}

function wheels(B, A, W, z0, z1, r, w = 0.24) {
  for (const z of [z0, z1]) {
    for (const x of [-W / 2 + w / 2 + 0.03, W / 2 - w / 2 - 0.03]) B.wheel(x, r, z, r, w, 20, [1, 1, 1], A.get('tyre'), A.get('rim'));
  }
}

function plate(B, A, z, y, back = true) {
  const hw = 0.26, hh = 0.07;
  const zz = z + (back ? 0.012 : -0.012);
  if (back) B.quad([-hw, y - hh, zz], [hw, y - hh, zz], [hw, y + hh, zz], [-hw, y + hh, zz], [0, 0, 1, 1], [1, 1, 1], A.get('plate'));
  else B.quad([hw, y - hh, zz], [-hw, y - hh, zz], [-hw, y + hh, zz], [hw, y + hh, zz], [0, 0, 1, 1], [1, 1, 1], A.get('plate'));
}

// the small stuff that makes a box read as a car: arches, skirts, seams,
// mirrors, handles, lips, diffuser, exhaust tips, window trim
function detailBody(B, A, sp, bodyCol) {
  const white = A.get('white');
  const W = sp.W, hw = W / 2, L2 = sp.L / 2;
  const [wz0, wz1] = sp.wheelZ;
  const r = sp.r;
  for (const s of [-1, 1]) {
    // wheel-arch lips: dark half-rings standing proud of the body
    for (const wz of [wz0, wz1]) {
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a0 = Math.PI * (i / n), a1 = Math.PI * ((i + 1) / n);
        const R = r + 0.06;
        const z0 = wz + Math.cos(a0) * R, y0 = r + Math.sin(a0) * R;
        const z1 = wz + Math.cos(a1) * R, y1 = r + Math.sin(a1) * R;
        const x = s * (hw + 0.012);
        const t = 0.05;
        const p = (z, y, k) => [x, y + Math.sin(Math.atan2(y - r, z - wz)) * k, z + Math.cos(Math.atan2(y - r, z - wz)) * k];
        const q = [p(z0, y0, 0), p(z1, y1, 0), p(z1, y1, t), p(z0, y0, t)];
        if (s > 0) B.quad(q[0], q[1], q[2], q[3], [0, 0, 1, 1], TRIM, white);
        else B.quad(q[1], q[0], q[3], q[2], [0, 0, 1, 1], TRIM, white);
      }
    }
    // side skirt between the wheels
    const sk0 = wz0 + r + 0.08, sk1 = wz1 - r - 0.08;
    if (sk1 > sk0) B.box(s * (hw - 0.02), 0.2, (sk0 + sk1) / 2, 0.08, 0.1, sk1 - sk0, 0, { color: TRIM, region: white });
    // door seams and handles
    const doorFront = wz0 + r + 0.2, doorRear = sp.pillars && sp.pillars.length > 1 ? Math.max(...sp.pillars) + 0.05 : (wz1 - r - 0.25);
    for (const z of [doorFront, doorRear]) if (z > wz0 && z < wz1) B.box(s * (hw + 0.004), sp.bumperH + 0.05, z, 0.008, sp.belt - sp.bumperH - 0.08, 0.012, 0, { color: DARK, region: white });
    if (sp.pillars && sp.pillars.length > 1) {
      const mid = Math.min(...sp.pillars);
      B.box(s * (hw + 0.004), sp.bumperH + 0.05, mid, 0.008, sp.belt - sp.bumperH - 0.08, 0.012, 0, { color: DARK, region: white });
    }
    B.box(s * (hw + 0.012), sp.belt - 0.13, doorFront + 0.55, 0.02, 0.03, 0.14, 0, { color: CHROME, region: white });
    // body crease catching the light
    B.box(s * (hw + 0.006), sp.belt - 0.2, (wz0 + wz1) / 2, 0.01, 0.018, (wz1 - wz0) + 0.6, 0, { color: [Math.min(1.25, bodyCol[0] * 1.2 + 0.08), Math.min(1.25, bodyCol[1] * 1.2 + 0.08), Math.min(1.25, bodyCol[2] * 1.2 + 0.08)], region: white });
    // mirrors on stalks
    if (sp.cabin) {
      const mz = sp.cabin[0][0] - 0.12;
      B.box(s * (hw + 0.05), sp.belt + 0.02, mz, 0.06, 0.04, 0.06, 0, { color: DARK, region: white });
      B.box(s * (hw + 0.13), sp.belt + 0.04, mz, 0.15, 0.1, 0.07, 0, { color: bodyCol, region: white });
      B.box(s * (hw + 0.13), sp.belt + 0.05, mz + 0.037, 0.12, 0.07, 0.006, 0, { color: [0.55, 0.62, 0.7], region: white });
    }
  }
  // front lip and rear diffuser
  B.box(0, 0.12, -L2 + 0.08, W - 0.3, 0.05, 0.2, 0, { color: DARK, region: white });
  B.box(0, 0.14, L2 - 0.12, W - 0.5, 0.08, 0.24, 0, { color: DARK, region: white });
  for (const x of [-0.3, -0.1, 0.1, 0.3]) B.box(x, 0.12, L2 - 0.04, 0.02, 0.12, 0.2, 0, { color: TRIM, region: white });
  // exhaust tips
  for (const x of sp.exhausts || [-hw + 0.38, hw - 0.38]) discZ(B, x, 0.24, L2 + 0.03, 0.05, 10, CHROME, 1, white);
  for (const x of sp.exhausts || [-hw + 0.38, hw - 0.38]) discZ(B, x, 0.24, L2 + 0.035, 0.035, 10, [0.03, 0.03, 0.03], 1, white);
  // window trim along the roofline
  if (sp.cabin) {
    const tw = (sp.cabinW || hw - 0.1);
    const zA = sp.cabin[1][0], zB = sp.cabin[2][0];
    for (const s of [-1, 1]) B.box(s * (tw - (sp.roofY - sp.belt) * (sp.tumble ?? 0.18) + 0.01), sp.roofY - 0.03, (zA + zB) / 2, 0.02, 0.03, Math.abs(zB - zA), 0, { color: DARK, region: white });
  }
}

// a generic car: lower body + glasshouse + roof, from a compact spec
function carFromSpec(A, sp) {
  const B = new MeshBuilder(true);
  const Lt = lights();
  const W = sp.W, hw = W / 2;
  const white = A.get('white'), glass = A.get('glass');
  const bodyCol = sp.color || PAINT;
  // lower body (painted), with a slightly narrower top edge
  const belt = sp.belt;
  extrude(B, sp.body, (z, y) => (y > belt - 0.02 ? hw - 0.05 : hw), white, bodyCol, {
    edgeColor: ([z0, y0], [z1, y1]) => (Math.max(y0, y1) < sp.bumperH ? TRIM : bodyCol),
    sideRegion: sp.sideRegion ? A.get(sp.sideRegion) : white,
    sideColor: sp.sideColor,
  });
  // glasshouse
  if (sp.cabin) {
    const tw = sp.cabinW || hw - 0.1;
    extrude(B, sp.cabin, (z, y) => tw - (y - belt) * (sp.tumble ?? 0.18), glass, [1, 1, 1], {
      edgeRegion: ([z0, y0], [z1, y1]) => (Math.abs(y0 - y1) < 0.04 && Math.min(y0, y1) > belt + 0.2 ? white : glass),
      edgeColor: ([z0, y0], [z1, y1]) => (Math.abs(y0 - y1) < 0.04 && Math.min(y0, y1) > belt + 0.2 ? (sp.roofColor || bodyCol) : [1, 1, 1]),
    });
    // pillars so the glass reads as windows
    for (const pz of sp.pillars || []) {
      const top = sp.roofY;
      for (const x of [-1, 1]) {
        const xx = x * (tw - (top - belt) * (sp.tumble ?? 0.18) * 0.5 + 0.012);
        B.box(xx, belt, pz, 0.03, top - belt, 0.09, 0, { color: sp.pillarColor || DARK, region: white });
      }
    }
  }
  wheels(B, A, W, sp.wheelZ[0], sp.wheelZ[1], sp.r, sp.tyreW || 0.24);
  detailBody(B, A, sp, bodyCol);
  // bumpers/grille
  const L2 = sp.L / 2;
  if (sp.grille !== false) B.quad([hw - 0.25, sp.grilleY - 0.09, -L2 - 0.02], [-hw + 0.25, sp.grilleY - 0.09, -L2 - 0.02], [-hw + 0.25, sp.grilleY + 0.09, -L2 - 0.02], [hw - 0.25, sp.grilleY + 0.09, -L2 - 0.02], [0, 0, 1, 1], [1, 1, 1], A.get('grille'));
  if (sp.plates !== false) { plate(B, A, sp.rearZ ?? L2 + 0.02, sp.plateY ?? 0.5, true); plate(B, A, -(sp.frontZ ?? L2 + 0.02), sp.grilleY - 0.18, false); }
  // lights
  const tz = (sp.rearZ ?? L2) + 0.015;
  const fz = -(sp.frontZ ?? L2) - 0.015;
  for (const s of [-1, 1]) {
    if (sp.roundTails) {
      for (const k of sp.roundTails) discZ(Lt.tail, s * k, sp.tailY, tz, 0.085, 10, [2.6, 0.08, 0.05], 1);
    } else {
      Lt.tail.box(s * (hw - sp.tailW / 2 - 0.06), sp.tailY - sp.tailH / 2, tz, sp.tailW, sp.tailH, 0.03, 0, { color: [2.5, 0.08, 0.04] });
    }
    Lt.head.box(s * (hw - sp.headW / 2 - 0.08), sp.headY - sp.headH / 2, fz, sp.headW, sp.headH, 0.03, 0, { color: [2.7, 2.6, 2.3] });
    Lt.amber.box(s * (hw - 0.1), sp.headY - sp.headH / 2 - 0.12, fz, 0.12, 0.06, 0.03, 0, { color: [2.5, 1.3, 0.2] });
  }
  if (sp.tailBar) Lt.tail.box(0, sp.tailY - 0.05, tz, W - 0.5, 0.05, 0.03, 0, { color: [1.6, 0.05, 0.03] });
  const out = { B, Lt, W, L: sp.L };
  return out;
}

function finish(m, len, wid, hgt, extra = {}) {
  return {
    body: m.B.build(), tail: m.Lt.tail.empty ? null : m.Lt.tail.build(), head: m.Lt.head.empty ? null : m.Lt.head.build(),
    amber: m.Lt.amber.empty ? null : m.Lt.amber.build(), beacon: m.Lt.beacon.empty ? null : m.Lt.beacon.build(),
    len, wid, hgt, atlas: 'fx', ...extra,
  };
}

// ------------------------------------------------------------ the uncles' sedans






export function policePickup(A) {
  // Bangladesh Police double-cab: blue, white stripe, light bar, open bed
  const L = 5.3, r = L / 2;
  const B = new MeshBuilder(true);
  const Lt = lights();
  const W = 1.86, hw = W / 2;
  const white = A.get('white');
  const blue = [0.12, 0.2, 0.5];
  // cab
  extrude(B, [[0.1, 0.42], [0.1, 1.1], [-r + 1.3, 1.12], [-r + 0.25, 1.0], [-r - 0.03, 0.88], [-r - 0.05, 0.5], [-r + 0.1, 0.42]], hw, white, blue, { sideRegion: A.get('police_side'), sideColor: [1, 1, 1] });
  extrude(B, [[0.08, 1.1], [0.0, 1.78], [-r + 1.95, 1.8], [-r + 1.3, 1.12]], (z, y) => hw - 0.08 - (y - 1.1) * 0.1, A.get('glass'), [1, 1, 1], {
    edgeRegion: ([z0, y0], [z1, y1]) => (Math.abs(y0 - y1) < 0.04 && y0 > 1.5 ? white : A.get('glass')),
    edgeColor: ([z0, y0], [z1, y1]) => (Math.abs(y0 - y1) < 0.04 && y0 > 1.5 ? [0.95, 0.95, 0.95] : [1, 1, 1]),
  });
  for (const pz of [-r + 1.7, -0.8]) for (const x of [-1, 1]) B.box(x * (hw - 0.1), 1.1, pz, 0.03, 0.68, 0.09, 0, { color: DARK, region: white });
  // bed
  B.box(0, 0.42, 1.3, W, 0.12, 2.3, 0, { color: TRIM, region: white });
  for (const x of [-1, 1]) B.box(x * (hw - 0.04), 0.54, 1.3, 0.08, 0.5, 2.3, 0, { color: blue, region: white });
  B.box(0, 0.54, r - 0.03, W, 0.5, 0.06, 0, { color: blue, region: A.get('police_back') });
  // roll bar + officers in the bed
  B.box(0, 1.04, 0.35, W - 0.1, 0.08, 0.08, 0, { color: TRIM, region: white });
  for (const x of [-0.55, 0.55]) B.box(x, 0.54, 0.35, 0.07, 0.55, 0.07, 0, { color: TRIM, region: white });
  for (const [x, z] of [[-0.45, 1.0], [0.45, 1.6], [-0.4, 2.0]]) {
    B.box(x, 0.54, z, 0.42, 0.62, 0.3, 0, { color: [0.85, 0.82, 0.75], region: white });
    B.box(x, 1.16, z, 0.24, 0.26, 0.24, 0, { color: [0.55, 0.36, 0.24], region: white });
    B.box(x, 1.36, z, 0.3, 0.1, 0.3, 0, { color: [0.12, 0.2, 0.45], region: white });
  }
  wheels(B, A, W, -r + 0.95, r - 1.1, 0.38, 0.28);
  B.quad([hw - 0.25, 0.7, -r - 0.07], [-hw + 0.25, 0.7, -r - 0.07], [-hw + 0.25, 0.9, -r - 0.07], [hw - 0.25, 0.9, -r - 0.07], [0, 0, 1, 1], [1, 1, 1], A.get('grille'));
  Lt.beacon.box(-0.4, 1.8, -0.9, 0.62, 0.13, 0.26, 0, { color: [0.2, 0.4, 3] });
  Lt.beacon.box(0.4, 1.8, -0.9, 0.62, 0.13, 0.26, 0, { color: [3, 0.1, 0.1] });
  for (const s of [-1, 1]) {
    Lt.tail.box(s * (hw - 0.1), 0.65, r + 0.01, 0.14, 0.3, 0.03, 0, { color: [2.5, 0.08, 0.04] });
    Lt.head.box(s * (hw - 0.3), 0.85, -r - 0.06, 0.42, 0.14, 0.03, 0, { color: [2.7, 2.6, 2.3] });
  }
  return { body: B.build(), tail: Lt.tail.build(), head: Lt.head.build(), beacon: Lt.beacon.build(), len: L, wid: W, hgt: 1.85, atlas: 'fx', colorFixed: true };
}

// ------------------------------------------------------------ the rivals





// ------------------------------------------------------------ the rival racers: lofted, smooth-shaded bodies
function rowNear(body, u) {
  let best = body.rows[0];
  for (const r of body.rows) if (Math.abs(r.u - u) < Math.abs(best.u - u)) best = r;
  return best;
}

// small helpers for flat decals on the nose / tail / flanks
const DARKC = [0.02, 0.02, 0.025];
function frontQuad(Bx, x0, x1, y0, y1, z, color, region) {
  Bx.quad([x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z], [0, 0, 1, 1], color, region);
}
function rearQuad(Bx, x0, x1, y0, y1, z, color, region) {
  Bx.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, 1, 1], color, region);
}
// a slanted lamp: inner edge x0 (higher), outer edge x1; on the nose (dir -1) or tail (dir +1)
function lampShape(Bx, dir, x0, x1, yb, yt0, yt1, z, color, region) {
  const q = dir < 0
    ? [[x1, yb, z], [x0, yb, z], [x0, yt0, z], [x1, yt1, z]]
    : [[x0, yb, z], [x1, yb, z], [x1, yt1, z], [x0, yt0, z]];
  if (x1 < x0) Bx.quad(q[1], q[0], q[3], q[2], [0, 0, 1, 1], color, region);
  else Bx.quad(q[0], q[1], q[2], q[3], [0, 0, 1, 1], color, region);
}
// a thin line hugging the skin between two surface samples (double sided)
function skinLine(Bx, p0, p1, w, color, region, lift = 0.004) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
  const out = [Math.sign(p0[0]) * 0.2, 1, 0];
  let nx = -dz * out[1], ny = dz * out[0], nz = dx * out[1] - dy * out[0];
  const l = Math.hypot(nx, ny, nz) || 1;
  nx = (nx / l) * w; ny = (ny / l) * w; nz = (nz / l) * w;
  const e = [p0[0] === 0 ? 0 : Math.sign(p0[0]) * lift, p0[0] === 0 ? lift : 0, 0];
  const A1 = [p0[0] + nx + e[0], p0[1] + ny + e[1], p0[2] + nz], B1 = [p0[0] - nx + e[0], p0[1] - ny + e[1], p0[2] - nz];
  const C1 = [p1[0] - nx + e[0], p1[1] - ny + e[1], p1[2] - nz], D1 = [p1[0] + nx + e[0], p1[1] + ny + e[1], p1[2] + nz];
  Bx.quad(A1, B1, C1, D1, [0, 0, 1, 1], color, region);
  Bx.quad(D1, C1, B1, A1, [0, 0, 1, 1], color, region);
}

function carDetail(A, body, sp, B, Lt, opts) {
  const white = A.get('white');
  const hw = sp.W / 2, lo = sp.clear;
  const nose = body.rows[0], tail = body.rows[body.rows.length - 1];
  const nw = nose.pts[7][0], tw = tail.pts[7][0];
  const nTop = nose.pts[15][1], tTop = tail.pts[15][1];
  const tall = nTop > 0.95;
  const fz = nose.z - 0.007, rz = tail.z + 0.007;
  // ---- front fascia: low intake, grille, corner vents, lamps, fog lights
  const iy1 = Math.min(nTop - 0.2, lo + 0.2);
  frontQuad(B, -nw * 0.8, nw * 0.8, lo + 0.04, iy1, fz, DARKC, white);
  const gy0 = iy1 + 0.02, gy1 = Math.max(gy0 + 0.1, nTop - (tall ? 0.18 : 0.08));
  frontQuad(B, -nw * 0.46, nw * 0.46, gy0, Math.min(gy1, gy0 + (tall ? 0.34 : 0.14)), fz - 0.002, [1, 1, 1], A.get('grille'));
  for (const sd of [-1, 1]) {
    const hb = nTop - (tall ? 0.34 : 0.19), ht = nTop - (tall ? 0.1 : 0.05);
    lampShape(B, -1, sd * nw * 0.5, sd * nw * 0.96, hb - 0.015, ht + 0.01, ht + 0.03, fz - 0.002, [0.03, 0.03, 0.035], white);
    lampShape(Lt.head, -1, sd * nw * 0.54, sd * nw * 0.92, hb + 0.01, ht - 0.01, ht + 0.012, fz - 0.006, [2.6, 2.5, 2.2]);
    lampShape(Lt.amber, -1, sd * nw * 0.8, sd * nw * 0.96, hb - 0.075, hb - 0.01, hb - 0.01, fz - 0.005, [2.5, 1.3, 0.2]);
    discZ(Lt.head, sd * nw * 0.66, lo + 0.125, fz - 0.004, 0.04, 10, [1.9, 1.9, 1.6], -1);
    frontQuad(B, Math.min(sd * nw * 0.8, sd * nw * 0.95), Math.max(sd * nw * 0.8, sd * nw * 0.95), lo + 0.06, lo + 0.2, fz - 0.003, DARKC, white);
  }
  plate(B, A, fz - 0.002, lo + 0.1 + 0.07, false);
  // ---- rear: tail lamps, reverse lamps, diffuser panel, plate, pipes
  for (const sd of [-1, 1]) {
    const yb = tTop - 0.2, yt = tTop - 0.05;
    if (opts.roundTails) {
      for (const k of opts.roundTails) discZ(Lt.tail, sd * tw * k, tTop - 0.12, rz + 0.004, 0.075, 12, [2.6, 0.08, 0.05], 1);
    } else {
      lampShape(Lt.tail, 1, sd * tw * 0.52, sd * tw * 0.97, yb, yt + 0.01, yt - 0.01, rz + 0.005, [2.5, 0.08, 0.04]);
    }
    discZ(Lt.head, sd * tw * 0.3, lo + 0.24, rz + 0.004, 0.03, 8, [1.6, 1.6, 1.5], 1);
  }
  if (opts.tailBar) rearQuad(Lt.tail, -tw * 0.5, tw * 0.5, tTop - 0.15, tTop - 0.11, rz + 0.005, [1.6, 0.05, 0.03]);
  rearQuad(B, -tw * 0.82, tw * 0.82, lo + 0.04, lo + 0.18, rz, DARKC, white);
  plate(B, A, rz + 0.002, lo + 0.32, true);
  for (const x of opts.pipes || [-hw * 0.55, hw * 0.55]) {
    discZ(B, x, lo + 0.08, rz + 0.025, 0.045, 12, [0.85, 0.86, 0.88], 1, white);
    discZ(B, x, lo + 0.08, rz + 0.03, 0.03, 12, [0.03, 0.03, 0.03], 1, white);
  }
  // ---- flanks: door shut lines, handles, chrome belt on saloons
  const seams = sp.seams || (sp.open ? [0.42] : sp.pillars) || [];
  for (const sd of [-1, 1]) {
    for (const u of seams) {
      for (let j = 3; j < 6; j++) skinLine(B, surfaceAt(body, u, j, sd), surfaceAt(body, u, j + 1, sd), 0.0035, [0.04, 0.04, 0.045], white);
    }
    if (!sp.open) {
      for (const u of seams) {
        const h = surfaceAt(body, u + 0.035, 5, sd);
        B.box(h[0] + sd * 0.004, h[1] - 0.04, h[2], 0.012, 0.03, 0.13, 0, { color: [0.7, 0.72, 0.74], region: white });
      }
    }
    const hu = sp.windscreen ? sp.windscreen[0] - 0.045 : 0.28;
    for (let j = 8; j < 15; j++) skinLine(B, surfaceAt(body, hu, j, sd), surfaceAt(body, hu, j + 1, sd), 0.0035, [0.04, 0.04, 0.045], white, 0.003);
    if (opts.chrome && sp.glass) {
      const n = 10;
      for (let k = 0; k < n; k++) {
        const u0 = sp.glass[0] + ((sp.glass[1] - sp.glass[0]) * k) / n, u1 = sp.glass[0] + ((sp.glass[1] - sp.glass[0]) * (k + 1)) / n;
        skinLine(B, surfaceAt(body, u0, 7, sd), surfaceAt(body, u1, 7, sd), 0.008, [0.78, 0.8, 0.82], white, 0.005);
      }
    }
  }
  // ---- mirrors on stalks at the foot of the A-pillar
  if (sp.windscreen) {
    const m = surfaceAt(body, sp.windscreen[1] - 0.025, 7, 1);
    for (const sd of [-1, 1]) {
      B.box(sd * (m[0] + 0.04), m[1], m[2] + 0.02, 0.07, 0.035, 0.05, 0, { color: [0.05, 0.05, 0.05], region: white });
      B.box(sd * (m[0] + 0.12), m[1] + 0.02, m[2] + 0.02, 0.15, 0.1, 0.08, 0, { color: PAINT, region: white });
      B.box(sd * (m[0] + 0.12), m[1] + 0.03, m[2] + 0.062, 0.12, 0.075, 0.004, 0, { color: [0.35, 0.42, 0.5], region: white });
    }
  }
}

export function sportsCar(A, key, opts = {}) {
  const sp = { ...BODIES[key], ...(opts.spec || {}) };
  const body = loftCar(sp);
  const B = new MeshBuilder(true);
  const Lt = lights();
  const white = A.get('white');
  if (!opts.noBody) loftToBuilder(B, body, white, opts.tint || PAINT);
  const L = sp.L, hw = sp.W / 2;
  if (!opts.noWheels) {
    const tw = opts.tyreW || 0.25;
    for (const u of sp.wheels) {
      const z = -L / 2 + u * L;
      for (const x of [-hw + tw / 2 + 0.05, hw - tw / 2 - 0.05]) B.wheel(x, sp.r, z, sp.r, tw, 24, [1, 1, 1], A.get('tyre'), A.get('rim'), [1.9, 1.9, 2.0]);
    }
  }
  carDetail(A, body, sp, B, Lt, opts);
  opts.extra?.(B, body, white, Lt);
  return finish({ B, Lt }, L, sp.W, Math.max(...sp.top.map((k) => k[1])) + 0.02, opts.finish);
}

// side livery decal: a quad hugging each flank, UVs matching the old side-panel mapping
function sideDecal(B, region, hw, z0, z1, y0, y1) {
  B.quad([hw + 0.006, y0, z1], [hw + 0.006, y0, z0], [hw + 0.006, y1, z0], [hw + 0.006, y1, z1], [0, 0, 1, 1], [1, 1, 1], region);
  B.quad([-hw - 0.006, y0, z0], [-hw - 0.006, y0, z1], [-hw - 0.006, y1, z1], [-hw - 0.006, y1, z0], [0, 0, 1, 1], [1, 1, 1], region);
}

// ------------------------------------------------------------ the uncles' sedans and everyone's vans
export function sedan(A, kind = 'premio') {
  const L = kind === 'axio' ? 4.4 : kind === 'corolla' ? 4.3 : 4.6;
  return sportsCar(A, 'premio', {
    spec: { L },
    tyreW: 0.22, chrome: kind !== 'corolla', tailBar: kind === 'allion',
    extra: (B, body, white) => {
      if (kind === 'corolla') B.box(0, 1.4, 0.1, 0.6, 0.14, 0.22, 0, { color: [1, 1, 1], region: A.get('taxi_sign') });
    },
  });
}

export function noah(A) {
  return sportsCar(A, 'noah', { tyreW: 0.22, chrome: true, pipes: [0.5] });
}

export function hiace(A) {
  return sportsCar(A, 'hiace', { tyreW: 0.22, pipes: [0.5] });
}

function pradoLike(A, extraOpts = {}) {
  return sportsCar(A, 'prado', {
    tyreW: 0.28, tailW: 0.24, headW: 0.46,
    ...extraOpts,
    extra: (B, body, white, Lt) => {
      const r = 4.8 / 2;
      B.wheel(0, 0.98, r + 0.18, 0.36, 0.22, 16, [1, 1, 1], A.get('tyre'), A.get('rim'));
      for (const x of [-0.72, 0.72]) B.box(x, 1.86, 0.1, 0.05, 0.06, 2.1, 0, { color: TRIM, region: white });
      for (const x of [-0.99, 0.99]) B.box(x, 0.38, 0, 0.1, 0.05, 2.4, 0, { color: TRIM, region: white });
      extraOpts.more?.(B, body, white, Lt);
    },
  });
}

export function pradoModel(A) {
  return pradoLike(A);
}

export function rabSUV(A) {
  // black Land Cruiser in RAB livery with a light bar
  return pradoLike(A, {
    tint: [0.07, 0.07, 0.08],
    finish: { colorFixed: true },
    more: (B, body, white, Lt) => {
      const L = 4.8;
      sideDecal(B, A.get('rab_side'), 0.95, -L * 0.34, L * 0.3, 0.62, 1.16);
      Lt.beacon.box(-0.35, 1.86, 0.1, 0.55, 0.12, 0.26, 0, { color: [0.2, 0.4, 3] });
      Lt.beacon.box(0.35, 1.86, 0.1, 0.55, 0.12, 0.26, 0, { color: [3, 0.1, 0.1] });
      B.quad([-0.6, 0.9, L / 2 + 0.25], [0.6, 0.9, L / 2 + 0.25], [0.6, 1.12, L / 2 + 0.25], [-0.6, 1.12, L / 2 + 0.25], [0, 0, 1, 1], [1, 1, 1], A.get('rab_back'));
    },
  });
}

export function supra(A) {
  return sportsCar(A, 'supra', {
    roundTails: [0.62, 0.36], tyreW: 0.27, headW: 0.42,
    extra: (B, body, white) => {
      // the hoop wing
      const L = 4.52, r = 4.52 / 2;
      for (const x of [-0.68, 0.68]) B.box(x, 0.9, r - 0.24, 0.06, 0.22, 0.14, 0, { color: PAINT, region: white });
      B.box(0, 1.1, r - 0.26, 1.62, 0.045, 0.32, 0, { color: PAINT, region: white });
      for (const x of [-0.82, 0.82]) B.box(x, 1.02, r - 0.26, 0.03, 0.16, 0.36, 0, { color: PAINT, region: white });
    },
  });
}

export function skyline(A) {
  return sportsCar(A, 'skyline', {
    roundTails: [0.66, 0.38], tyreW: 0.28,
    extra: (B, body, white) => {
      const r = 4.6 / 2;
      for (const x of [-0.6, 0.6]) B.box(x, 0.98, r - 0.3, 0.05, 0.18, 0.12, 0, { color: PAINT, region: white });
      B.box(0, 1.15, r - 0.3, 1.5, 0.05, 0.28, 0, { color: PAINT, region: white });
      B.box(0, 0.11, -r + 0.06, 1.66, 0.04, 0.28, 0, { color: TRIM, region: white }); // front splitter
    },
  });
}

export function celica(A) {
  return sportsCar(A, 'celica', {
    tailW: 0.46, headW: 0.46,
    extra: (B, body, white) => B.box(0, 1.0, 4.34 / 2 - 0.12, 1.44, 0.04, 0.2, 0, { color: PAINT, region: white }),
  });
}

export function chaser(A) {
  return sportsCar(A, 'chaser', {
    tailW: 0.6, tailBar: true, headW: 0.46,
    extra: (B, body, white) => B.box(0, 0.93, 4.72 / 2 - 0.22, 1.36, 0.03, 0.16, 0, { color: PAINT, region: white }),
  });
}

export function miata(A) {
  return sportsCar(A, 'miata', {
    tailW: 0.3, headW: 0.38,
    extra: (B, body, white) => {
      const r = 3.92 / 2;
      // windscreen frame + glass, roll hoops and the two heads
      B.quad([0.7, 0.84, -r + 1.6], [-0.7, 0.84, -r + 1.6], [-0.64, 1.16, -r + 1.86], [0.64, 1.16, -r + 1.86], [0, 0, 1, 1], [1, 1, 1], A.get('glass'));
      B.box(0, 1.15, -r + 1.86, 1.32, 0.04, 0.05, 0, { color: [0.05, 0.05, 0.05], region: white });
      for (const x of [-0.38, 0.38]) {
        B.box(x, 0.84, 0.62, 0.3, 0.28, 0.06, 0, { color: [0.05, 0.05, 0.05], region: white });
        B.box(x, 0.86, 0.25, 0.34, 0.36, 0.28, 0, { color: [0.85, 0.85, 0.82], region: white });
        B.box(x, 1.22, 0.25, 0.2, 0.22, 0.2, 0, { color: [0.55, 0.36, 0.24], region: white });
        B.box(x, 1.4, 0.27, 0.21, 0.07, 0.21, 0, { color: [0.08, 0.06, 0.05], region: white });
      }
    },
  });
}

// ------------------------------------------------------------ battery rickshaw ("Tesla")
export function tesla(A, variant = 0) {
  const B = new MeshBuilder(true);
  const Lt = lights();
  const white = A.get('white');
  const L = 2.9, W = 1.18;
  const bodyCol = [[0.1, 0.5, 0.3], [0.15, 0.35, 0.7], [0.75, 0.15, 0.2], [0.9, 0.7, 0.1]][variant % 4];
  // wheels: two rear, one front
  B.wheel(-0.52, 0.27, 0.82, 0.27, 0.12, 10, [1, 1, 1], A.get('tyre'), A.get('rim'));
  B.wheel(0.52, 0.27, 0.82, 0.27, 0.12, 10, [1, 1, 1], A.get('tyre'), A.get('rim'));
  B.wheel(0, 0.27, -1.05, 0.27, 0.12, 10, [1, 1, 1], A.get('tyre'), A.get('rim'));
  // floor pan + rear body (sheet metal sides with a painted panel)
  B.box(0, 0.36, 0.35, W, 0.1, 1.9, 0, { color: TRIM, region: white });
  B.box(0, 0.46, 0.65, W, 0.42, 1.2, 0, { regions: { side: A.get('tesla_side'), front: A.get('tesla_back'), back: white, top: white }, color: bodyCol });
  // front nose + windscreen + driver
  B.box(0, 0.36, -0.75, 0.82, 0.62, 0.55, 0, { color: bodyCol, region: white });
  B.quad([0.38, 0.98, -0.85], [-0.38, 0.98, -0.85], [-0.4, 1.55, -0.7], [0.4, 1.55, -0.7], [0, 0, 1, 1], [1, 1, 1], A.get('glass'));
  // roof canopy on thin posts
  B.box(0, 1.78, 0.05, W + 0.08, 0.06, 2.3, 0, { color: [0.95, 0.95, 0.92], region: white });
  for (const [x, z] of [[-0.55, -0.75], [0.55, -0.75], [-0.55, 1.15], [0.55, 1.15]]) B.box(x, 0.4, z, 0.04, 1.4, 0.04, 0, { color: TRIM, region: white });
  // benches + people (back-to-back seating, of course)
  B.box(0, 0.9, 0.3, 1.0, 0.1, 0.4, 0, { color: [0.6, 0.15, 0.15], region: white });
  B.box(0, 0.9, 0.95, 1.0, 0.1, 0.4, 0, { color: [0.6, 0.15, 0.15], region: white });
  const people = [[-0.25, 0.3, [0.9, 0.3, 0.5]], [0.25, 0.3, [0.95, 0.9, 0.85]], [-0.25, 0.98, [0.2, 0.4, 0.8]], [0.22, 0.98, [0.95, 0.7, 0.2]], [0, -0.55, [0.92, 0.92, 0.88]]];
  for (const [x, z, c] of people.slice(0, 3 + (variant % 3))) {
    B.box(x, 0.98, z, 0.34, 0.46, 0.24, 0, { color: c, region: white });
    B.box(x, 1.44, z, 0.2, 0.22, 0.2, 0, { color: [0.55, 0.36, 0.24], region: white });
    B.box(x, 1.62, z, 0.21, 0.07, 0.21, 0, { color: [0.08, 0.06, 0.05], region: white });
  }
  // a handlebar, a mirror, a sound system that is louder than the motor
  B.box(0, 1.0, -0.65, 0.6, 0.03, 0.03, 0, { color: CHROME, region: white });
  Lt.tail.box(-0.45, 0.62, 1.26, 0.12, 0.08, 0.02, 0, { color: [2.2, 0.1, 0.05] });
  Lt.tail.box(0.45, 0.62, 1.26, 0.12, 0.08, 0.02, 0, { color: [2.2, 0.1, 0.05] });
  Lt.head.box(0, 0.8, -1.04, 0.16, 0.12, 0.02, 0, { color: [2.6, 2.5, 2.2] });
  // the LED strip under the roof (every Tesla in Dhaka has one)
  const ledC = [[0.3, 2.6, 0.6], [2.6, 0.3, 2.0], [0.4, 1.2, 3], [3, 1.8, 0.2]][variant % 4];
  Lt.amber.box(0, 1.75, 0.05, W, 0.03, 2.2, 0, { color: ledC });
  return { body: B.build(), tail: Lt.tail.build(), head: Lt.head.build(), amber: Lt.amber.build(), len: L, wid: W, hgt: 1.85, atlas: 'fx', colorFixed: true };
}

// the boss buses: a double-decker-ish local bus with a parody company livery
export function bossBus(A, variant = 0) {
  const B = new MeshBuilder(true);
  const Lt = lights();
  const white = A.get('white');
  const L = 11, W = 2.55, H = 3.25;
  for (const z of [-L / 2 + 2.3, L / 2 - 2.1]) for (const x of [-W / 2 + 0.2, W / 2 - 0.2]) B.wheel(x, 0.52, z, 0.52, 0.34, 12, [1, 1, 1], A.get('tyre'), A.get('rim'));
  B.box(0, 0.38, 0, W, H - 0.38, L, 0, { regions: { side: A.get('bossbus_side' + variant), front: A.get('bossbus_back' + variant), back: A.get('bossbus_front'), top: white }, color: [1, 1, 1] });
  B.box(0, H, 0, W - 0.2, 0.15, L - 1, 0, { color: [0.4, 0.4, 0.42], region: white });
  // dents & a roof full of luggage and passengers
  for (let i = 0; i < 5; i++) B.box(-0.6 + (i % 3) * 0.6, H + 0.15, -3 + i * 1.4, 0.6, 0.4, 0.8, 0.3 * i, { color: [[0.7, 0.2, 0.2], [0.2, 0.4, 0.7], [0.8, 0.7, 0.3]][i % 3], region: white });
  for (const [x, z] of [[-0.6, 1.5], [0.5, 2.4], [0, 3.6], [0.7, -1]]) {
    B.box(x, H + 0.15, z, 0.4, 0.55, 0.3, 0, { color: [0.92, 0.9, 0.85], region: white });
    B.box(x, H + 0.7, z, 0.22, 0.24, 0.22, 0, { color: [0.55, 0.36, 0.24], region: white });
  }
  // the driver with a bottle (visible through the windscreen)
  B.box(W / 2 - 0.6, 1.2, -L / 2 + 0.7, 0.45, 0.6, 0.3, 0, { color: [0.95, 0.95, 0.9], region: white });
  B.box(W / 2 - 0.6, 1.8, -L / 2 + 0.7, 0.26, 0.28, 0.26, 0, { color: [0.55, 0.36, 0.24], region: white });
  B.box(W / 2 - 0.3, 1.7, -L / 2 + 0.6, 0.08, 0.3, 0.08, 0, { color: [0.1, 0.5, 0.2], region: white });
  for (const s of [-1, 1]) {
    Lt.tail.box(s * (W / 2 - 0.25), 0.9, L / 2 + 0.01, 0.3, 0.3, 0.02, 0, { color: [2.4, 0.1, 0.05] });
    Lt.head.box(s * (W / 2 - 0.3), 0.85, -L / 2 - 0.01, 0.35, 0.22, 0.02, 0, { color: [2.6, 2.5, 2.2] });
  }
  // disco lights inside (the music never stops)
  const cols = [[2.6, 0.2, 1.8], [0.3, 2.4, 0.5], [0.3, 0.8, 3], [3, 1.6, 0.2]];
  for (let i = 0; i < 8; i++) Lt.amber.box(0, 1.55, -L / 2 + 1.2 + i * 1.15, W + 0.04, 0.55, 0.95, 0, { color: cols[(i + variant) % 4].map((c) => c * 0.6) });
  // a lit route board and marker lights so you can see it coming at night
  Lt.head.box(0, H - 0.5, -L / 2 - 0.03, W - 0.4, 0.3, 0.02, 0, { color: [2.4, 0.9, 0.3] });
  for (let i = 0; i < 6; i++) Lt.tail.box(-W / 2 + 0.2 + i * (W - 0.4) / 5, H + 0.05, L / 2 + 0.02, 0.1, 0.1, 0.02, 0, { color: [2.6, 1.2, 0.2] });
  return { body: B.build(), tail: Lt.tail.build(), head: Lt.head.build(), amber: Lt.amber.build(), len: L, wid: W, hgt: H + 0.8, atlas: 'fx', colorFixed: true };
}

// ------------------------------------------------------------ real car meshes (CC0 pack), refitted
function fromPack(A, name, fit, opts = {}) {
  const B = new MeshBuilder(true);
  const Lt = lights();
  const dims = emitTraffic(B, Lt, name, fit, A.get('white'), opts.tint || [1, 1, 1], opts);
  opts.extra?.(B, Lt, A, dims);
  return finish({ B, Lt }, dims.len, dims.wid, dims.hgt, opts.finish);
}

export function buildFxModels(A) {
  const T = {};
  T.axio = fromPack(A, 'hatchback', { L: 4.2, W: 1.74, H: 1.45 });
  T.premio = fromPack(A, 'sedan', { L: 4.6, W: 1.76, H: 1.45 });
  T.allion = fromPack(A, 'sedan', { L: 4.65, W: 1.76, H: 1.47 });
  T.corolla = fromPack(A, 'taxi', { L: 4.35, W: 1.74, H: 1.5 }, { paintFixed: [1, 0.78, 0.1], finish: { colorFixed: true } });
  T.noah = fromPack(A, 'van', { L: 4.6, W: 1.75, H: 1.85 });
  T.hiace = fromPack(A, 'van', { L: 4.9, W: 1.8, H: 2.05 });
  T.prado = fromPack(A, 'suv', { L: 4.8, W: 1.9, H: 1.85 });
  T.rab = fromPack(A, 'suv', { L: 4.8, W: 1.9, H: 1.85 }, {
    paintFixed: [0.07, 0.07, 0.08], finish: { colorFixed: true },
    extra: (B, Lt, A2, d) => {
      sideDecal(B, A2.get('rab_side'), d.wid / 2 + 0.01, -d.len * 0.34, d.len * 0.3, 0.62, 1.16);
      Lt.beacon.box(-0.35, d.hgt, 0.1, 0.55, 0.12, 0.26, 0, { color: [0.2, 0.4, 3] });
      Lt.beacon.box(0.35, d.hgt, 0.1, 0.55, 0.12, 0.26, 0, { color: [3, 0.1, 0.1] });
      B.quad([-0.6, 0.9, d.len / 2 + 0.02], [0.6, 0.9, d.len / 2 + 0.02], [0.6, 1.12, d.len / 2 + 0.02], [-0.6, 1.12, d.len / 2 + 0.02], [0, 0, 1, 1], [1, 1, 1], A2.get('rab_back'));
    },
  });
  T.policeHilux = policePickup(A);
  T.supra = fromPack(A, 'sports', { L: 4.5, W: 1.82, H: 1.3 });
  T.skyline = fromPack(A, 'muscle_2', { L: 4.6, W: 1.8, H: 1.36 });
  T.celica = fromPack(A, 'muscle', { L: 4.4, W: 1.78, H: 1.32 });
  T.chaser = fromPack(A, 'sedan', { L: 4.75, W: 1.77, H: 1.4 });
  T.miata = fromPack(A, 'roadster', { L: 3.95, W: 1.75, H: 1.25 });
  for (let v = 0; v < 4; v++) T['tesla' + v] = tesla(A, v);
  T.bossbus0 = bossBus(A, 0);
  T.bossbus1 = bossBus(A, 1);
  return T;
}
