// Lofted car bodies: a smooth skin built from cross-sections along the car,
// shaped by a side silhouette (top line, beltline, ground line with real
// wheel-arch cut-outs) and a plan-view width curve. Shaded smooth, coloured
// per panel (paint, glass, blacked-out pillars, plastic trim).
// Model space: forward = -Z, right = +X, up = +Y, origin at ground centre.

import * as THREE from 'three';

export const C = {
  paint: [1, 1, 1],
  glass: [0.07, 0.09, 0.12],
  trim: [0.07, 0.07, 0.075],
  dark: [0.025, 0.025, 0.03],
  chrome: [0.85, 0.86, 0.88],
  cabin: [0.06, 0.05, 0.05],
};

// Catmull-Rom through [[u, v], ...] keyframes (u ascending)
function curve(keys) {
  return (u) => {
    if (u <= keys[0][0]) return keys[0][1];
    const n = keys.length;
    if (u >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (i < n - 2 && u > keys[i + 1][0]) i++;
    const p0 = keys[Math.max(0, i - 1)][1], p1 = keys[i][1], p2 = keys[i + 1][1], p3 = keys[Math.min(n - 1, i + 2)][1];
    const t = (u - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  };
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const inR = (u, r) => r && u >= r[0] && u <= r[1];

/**
 * spec: {
 *   L, W, r (wheel radius), wheels: [uFront, uRear], clear (ground clearance),
 *   top: [[u,y]] silhouette, belt: [[u,y]] glass line, plan: [[u, frac]] half-width as fraction of W/2,
 *   tumble (roof width / body width), glass: [u0,u1] side windows, windscreen: [u0,u1], rearWindow: [u0,u1],
 *   pillars: [u,...], open: bool (no roof: cockpit [u0,u1] shown dark), cockpit: [u0,u1], roofColor, crown
 * }
 */
export function loftCar(spec) {
  const L = spec.L, hw = spec.W / 2;
  const top = curve(spec.top), belt = curve(spec.belt || spec.top), plan = curve(spec.plan);
  const R = spec.r + 0.055;
  const wz = spec.wheels.map((u) => -L / 2 + u * L);
  const clear = spec.clear ?? 0.17;
  const tumble = spec.tumble ?? 0.78;
  const N = spec.stations || 64;
  const rows = [];
  for (let i = 0; i <= N; i++) {
    // denser near the nose and tail so the ends round off cleanly
    const t = i / N;
    const u = 0.5 - 0.5 * Math.cos(Math.PI * t);
    const z = -L / 2 + u * L;
    let y0 = clear;
    for (const c of wz) {
      const dz = z - c;
      if (Math.abs(dz) < R) y0 = Math.max(y0, spec.r + Math.sqrt(R * R - dz * dz) * 0.98);
    }
    const w = hw * plan(u);
    let yt = top(u), yb = Math.min(belt(u), yt);
    const cab = spec.open ? 0 : sstep(0.03, 0.14, yt - yb);
    if (spec.open) yb = yt;
    const ylo = Math.min(y0 + 0.1, yb - 0.03);
    const wr = w * tumble;
    const crown = spec.crown ?? 0.025;
    // right half, bottom centre -> top centre (16 points)
    const deck = [[w * 0.92, yt - 0.012], [w * 0.86, yt], [w * 0.74, yt + crown * 0.4], [w * 0.6, yt + crown * 0.65], [w * 0.42, yt + crown * 0.85], [w * 0.22, yt + crown * 0.97], [w * 0.08, yt + crown], [0, yt + crown]];
    const cabin = [[w * 0.93, yb + 0.012], [lerp(w * 0.93, wr, 0.3), lerp(yb, yt, 0.3)], [lerp(w * 0.93, wr, 0.62), lerp(yb, yt, 0.62)], [wr, yt - 0.06], [wr * 0.86, yt - 0.024], [wr * 0.6, yt - 0.006], [wr * 0.3, yt], [0, yt]];
    const pts = [
      [0, y0], [w * 0.8, y0], [w * 0.95, y0 + 0.03], [w * 0.995, ylo],
      [w, lerp(ylo, yb, 0.3)], [w * 0.995, lerp(ylo, yb, 0.6)], [w * 0.975, lerp(ylo, yb, 0.86)], [w * 0.95, yb],
    ];
    for (let k = 0; k < 8; k++) pts.push([lerp(deck[k][0], cabin[k][0], cab), lerp(deck[k][1], cabin[k][1], cab)]);
    rows.push({ u, z, pts, cab });
  }
  return { spec, rows, L, hw };
}

// colour of the panel between profile points j and j+1 at station u
function panelColor(spec, u, j, cab) {
  const bumper = u < 0.06 || u > 0.94;
  if (j <= 1) return C.dark;
  if (j === 2) return bumper || spec.sills ? C.trim : C.paint;
  if (j <= 7) {
    if (j === 3 && bumper) return C.trim;
    return C.paint;
  }
  if (spec.open) {
    if (inR(u, spec.cockpit) && j >= 9) return C.cabin;
    return C.paint;
  }
  // glasshouse
  const pillar = (spec.pillars || []).some((p) => Math.abs(u - p) < 0.014);
  if (j <= 11) {
    if (cab > 0.5 && inR(u, spec.glass)) return pillar ? C.dark : C.glass;
    if (cab > 0.5 && (inR(u, spec.windscreen) || inR(u, spec.rearWindow))) return C.glass;
    return C.paint;
  }
  if (inR(u, spec.windscreen) || inR(u, spec.rearWindow)) return C.glass;
  return spec.roofColor || C.paint;
}

// smooth normals from the grid
function normalsOf(body) {
  const { rows } = body;
  const M = rows[0].pts.length;
  const P = (i, j, s) => { const p = rows[i].pts[j]; return [s * p[0], p[1], rows[i].z]; };
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const row = [];
    for (let j = 0; j < M; j++) {
      const a = P(Math.max(0, i - 1), j, 1), b = P(Math.min(rows.length - 1, i + 1), j, 1);
      const c = P(i, Math.max(0, j - 1), 1), d = P(i, Math.min(M - 1, j + 1), 1);
      const tz = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const tp = [d[0] - c[0], d[1] - c[1], d[2] - c[2]];
      let n = [tp[1] * tz[2] - tp[2] * tz[1], tp[2] * tz[0] - tp[0] * tz[2], tp[0] * tz[1] - tp[1] * tz[0]];
      // point outward from the car's spine
      const p = P(i, j, 1);
      const out0 = [p[0], p[1] - 0.7, 0];
      if (n[0] * out0[0] + n[1] * out0[1] < 0) n = [-n[0], -n[1], -n[2]];
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      row.push([n[0] / l, n[1] / l, n[2] / l]);
    }
    out.push(row);
  }
  return out;
}

// emit the body: quad(a,b,c,d, na,nb,nc,nd, color) in outward winding, then nose/tail caps
function emit(body, quad, capTri) {
  const { rows, spec } = body;
  const M = rows[0].pts.length;
  const nrm = normalsOf(body);
  for (const s of [1, -1]) {
    for (let i = 0; i < rows.length - 1; i++) {
      for (let j = 0; j < M - 1; j++) {
        const A = rows[i].pts[j], B = rows[i].pts[j + 1], Cc = rows[i + 1].pts[j + 1], D = rows[i + 1].pts[j];
        const za = rows[i].z, zb = rows[i + 1].z;
        const p = [[s * A[0], A[1], za], [s * B[0], B[1], za], [s * Cc[0], Cc[1], zb], [s * D[0], D[1], zb]];
        const fl = (n) => [s * n[0], n[1], n[2]];
        const n = [fl(nrm[i][j]), fl(nrm[i][j + 1]), fl(nrm[i + 1][j + 1]), fl(nrm[i + 1][j])];
        const col = panelColor(spec, (rows[i].u + rows[i + 1].u) / 2, j, (rows[i].cab + rows[i + 1].cab) / 2);
        // winding: right side (s=1) as built faces outward when going a->b->c->d ... verify with normal
        const ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1], uz = p[1][2] - p[0][2];
        const vx = p[3][0] - p[0][0], vy = p[3][1] - p[0][1], vz = p[3][2] - p[0][2];
        const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
        const avg = [n[0][0] + n[2][0], n[0][1] + n[2][1], n[0][2] + n[2][2]];
        if (fx * avg[0] + fy * avg[1] + fz * avg[2] >= 0) quad(p[0], p[1], p[2], p[3], n[0], n[1], n[2], n[3], col);
        else quad(p[1], p[0], p[3], p[2], n[1], n[0], n[3], n[2], col);
      }
    }
  }
  // caps: the nose and tail faces
  for (const [i, dir] of [[0, -1], [rows.length - 1, 1]]) {
    const r = rows[i];
    const cy = r.pts.reduce((a, p) => a + p[1], 0) / M;
    const c = [0, cy, r.z];
    for (const s of [1, -1]) {
      for (let j = 0; j < M - 1; j++) {
        const a = [s * r.pts[j][0], r.pts[j][1], r.z], b = [s * r.pts[j + 1][0], r.pts[j + 1][1], r.z];
        const col = j <= 3 ? C.trim : C.paint;
        // facing dir along z
        const ux = a[0] - c[0], uy = a[1] - c[1], vx = b[0] - c[0], vy = b[1] - c[1];
        const fz = ux * vy - uy * vx;
        if (fz * dir >= 0) capTri(c, a, b, [0, 0, dir], col);
        else capTri(c, b, a, [0, 0, dir], col);
      }
    }
  }
}

// into a MeshBuilder (instanced traffic / rivals; atlas region for the flat white texel)
export function loftToBuilder(B, body, region, tint = C.paint) {
  const mul = (c) => (c === C.paint ? tint : c);
  emit(body,
    (a, b, c, d, na, nb, nc, nd, col) => {
      const k = mul(col);
      const i0 = B.vert(a[0], a[1], a[2], na[0], na[1], na[2], 0, 0, k, region);
      const i1 = B.vert(b[0], b[1], b[2], nb[0], nb[1], nb[2], 1, 0, k, region);
      const i2 = B.vert(c[0], c[1], c[2], nc[0], nc[1], nc[2], 1, 1, k, region);
      const i3 = B.vert(d[0], d[1], d[2], nd[0], nd[1], nd[2], 0, 1, k, region);
      B.idx.push(i0, i1, i2, i0, i2, i3);
    },
    (a, b, c, n, col) => {
      const k = mul(col);
      const i0 = B.vert(a[0], a[1], a[2], n[0], n[1], n[2], 0.5, 0.5, k, region);
      const i1 = B.vert(b[0], b[1], b[2], n[0], n[1], n[2], 0, 0, k, region);
      const i2 = B.vert(c[0], c[1], c[2], n[0], n[1], n[2], 1, 0, k, region);
      B.idx.push(i0, i1, i2);
    });
}

// into a standalone BufferGeometry with vertex colours (the player's car)
export function loftToGeometry(body) {
  const pos = [], nor = [], col = [];
  const v = (p, n, c) => { pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); col.push(c[0], c[1], c[2]); };
  emit(body,
    (a, b, c, d, na, nb, nc, nd, k) => { v(a, na, k); v(b, nb, k); v(c, nc, k); v(a, na, k); v(c, nc, k); v(d, nd, k); },
    (a, b, c, n, k) => { v(a, n, k); v(b, n, k); v(c, n, k); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// sample the skin: [x, y, z] of profile point j at station u on side s (for placing lights, mirrors...)
export function surfaceAt(body, u, j, s = 1) {
  const { rows } = body;
  let i = 0;
  while (i < rows.length - 2 && rows[i + 1].u < u) i++;
  const a = rows[i], b = rows[i + 1];
  const t = Math.min(1, Math.max(0, (u - a.u) / ((b.u - a.u) || 1)));
  const pa = a.pts[j], pb = b.pts[j];
  return [s * lerp(pa[0], pb[0], t), lerp(pa[1], pb[1], t), lerp(a.z, b.z, t)];
}

// ------------------------------------------------------------ the cars
// u: 0 = nose, 1 = tail. Heights in metres.
export const BODIES = {
  // Toyota Supra MK4: long low nose, bubble cabin set back, rounded tail
  supra: {
    L: 4.52, W: 1.81, r: 0.33, wheels: [0.17, 0.81], clear: 0.14, tumble: 0.74,
    top: [[0, 0.5], [0.03, 0.62], [0.1, 0.7], [0.3, 0.8], [0.36, 0.84], [0.47, 1.2], [0.6, 1.26], [0.7, 1.2], [0.8, 0.95], [0.9, 0.9], [0.97, 0.84], [1, 0.62]],
    belt: [[0, 0.5], [0.36, 0.84], [0.5, 0.88], [0.75, 0.9], [1, 0.84]],
    plan: [[0, 0.62], [0.03, 0.85], [0.1, 0.96], [0.2, 1], [0.5, 0.98], [0.8, 1], [0.95, 0.94], [1, 0.72]],
    glass: [0.48, 0.74], windscreen: [0.37, 0.48], rearWindow: [0.72, 0.8], pillars: [0.6],
  },
  // Nissan Skyline R34 GT-R: boxy, upright, square shoulders
  skyline: {
    L: 4.6, W: 1.79, r: 0.34, wheels: [0.18, 0.81], clear: 0.15, tumble: 0.82, crown: 0.012,
    top: [[0, 0.62], [0.03, 0.82], [0.08, 0.9], [0.3, 0.96], [0.33, 0.98], [0.44, 1.32], [0.68, 1.36], [0.79, 1.06], [0.85, 0.98], [0.97, 0.94], [1, 0.72]],
    belt: [[0, 0.62], [0.33, 0.98], [0.6, 1.0], [0.85, 0.98], [1, 0.94]],
    plan: [[0, 0.8], [0.02, 0.92], [0.08, 0.99], [0.2, 1], [0.8, 1], [0.97, 0.97], [1, 0.84]],
    glass: [0.45, 0.78], windscreen: [0.34, 0.45], rearWindow: [0.77, 0.86], pillars: [0.62],
  },
  // Toyota Celica T230: pointed wedge, high tail
  celica: {
    L: 4.34, W: 1.74, r: 0.31, wheels: [0.18, 0.82], clear: 0.14, tumble: 0.74,
    top: [[0, 0.48], [0.04, 0.62], [0.2, 0.76], [0.34, 0.86], [0.48, 1.24], [0.62, 1.28], [0.82, 1.06], [0.95, 0.98], [1, 0.8]],
    belt: [[0, 0.48], [0.34, 0.86], [0.7, 0.92], [1, 0.98]],
    plan: [[0, 0.55], [0.04, 0.82], [0.12, 0.96], [0.3, 1], [0.8, 1], [0.96, 0.92], [1, 0.75]],
    glass: [0.49, 0.8], windscreen: [0.35, 0.49], rearWindow: [0.78, 0.9], pillars: [0.64],
  },
  // Toyota Chaser JZX100: long low four-door saloon
  chaser: {
    L: 4.72, W: 1.76, r: 0.32, wheels: [0.18, 0.8], clear: 0.13, tumble: 0.84, crown: 0.015,
    top: [[0, 0.6], [0.03, 0.8], [0.08, 0.86], [0.28, 0.92], [0.31, 0.94], [0.42, 1.36], [0.68, 1.38], [0.79, 0.98], [0.84, 0.94], [0.97, 0.9], [1, 0.7]],
    belt: [[0, 0.6], [0.31, 0.94], [0.6, 0.96], [0.84, 0.94], [1, 0.9]],
    plan: [[0, 0.8], [0.02, 0.93], [0.08, 0.99], [0.2, 1], [0.85, 1], [0.97, 0.96], [1, 0.84]],
    glass: [0.43, 0.77], windscreen: [0.32, 0.43], rearWindow: [0.76, 0.84], pillars: [0.55, 0.66],
  },
  // Mazda MX-5 ND: short, curvy roadster with the roof down
  miata: {
    L: 3.92, W: 1.73, r: 0.3, wheels: [0.18, 0.8], clear: 0.13, open: true, cockpit: [0.42, 0.7],
    top: [[0, 0.5], [0.03, 0.64], [0.12, 0.74], [0.38, 0.84], [0.5, 0.84], [0.72, 0.84], [0.85, 0.82], [0.96, 0.78], [1, 0.6]],
    plan: [[0, 0.6], [0.04, 0.86], [0.15, 1], [0.45, 0.94], [0.8, 1], [0.95, 0.94], [1, 0.74]],
  },
  // the Premio/Allion family saloon
  premio: {
    L: 4.6, W: 1.74, r: 0.32, wheels: [0.17, 0.8], clear: 0.16, tumble: 0.84, crown: 0.015,
    top: [[0, 0.62], [0.03, 0.8], [0.1, 0.86], [0.3, 0.9], [0.33, 0.92], [0.44, 1.4], [0.68, 1.42], [0.78, 1.0], [0.82, 0.96], [0.97, 0.94], [1, 0.72]],
    belt: [[0, 0.62], [0.33, 0.92], [0.6, 0.95], [0.82, 0.96], [1, 0.94]],
    plan: [[0, 0.8], [0.02, 0.93], [0.08, 0.99], [0.2, 1], [0.85, 1], [0.97, 0.96], [1, 0.84]],
    glass: [0.45, 0.76], windscreen: [0.34, 0.45], rearWindow: [0.75, 0.82], pillars: [0.57, 0.66],
  },
  // ROSSO 86: the flat-12 wedge, open top
  rosso: {
    L: 4.5, W: 1.98, r: 0.37, wheels: [0.18, 0.81], clear: 0.13, open: true, cockpit: [0.38, 0.6],
    top: [[0, 0.44], [0.03, 0.56], [0.12, 0.64], [0.3, 0.76], [0.38, 0.8], [0.6, 0.86], [0.75, 0.98], [0.9, 1.0], [0.97, 0.98], [1, 0.74]],
    plan: [[0, 0.7], [0.04, 0.88], [0.15, 0.96], [0.35, 0.95], [0.6, 1], [0.92, 1], [1, 0.9]],
  },
};
