// Prop generators. Each takes a ChunkCtx (see chunk.js) and writes geometry
// into its builders, sprites into its sprite batch and collision boxes into
// its obstacle list. All placement is in road space (s, x).

import * as THREE from 'three';
import { STEP } from './track.js';

const UP = [0, 1, 0];

// Ribbon along the road between s0..s1 built from two edge functions.
// edgeA/edgeB: (s) => [x, h, groundFlag]. Normal is auto-oriented to `facing` (world dir or fn).
export function ribbon(ctx, B, s0, s1, edgeA, edgeB, region, color, opts = {}) {
  const ds = opts.ds || STEP * 2;
  const tileS = opts.tileS || 4;
  const tileU = opts.tileU || 1;
  const n = Math.max(1, Math.ceil((s1 - s0) / ds));
  let prevA = null, prevB = null, prevS = 0;
  const facing = opts.facing || UP;
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n;
    const ea = edgeA(s), eb = edgeB(s);
    const a = ctx.P(s, ea[0], ea[1], ea[2]);
    const b = ctx.P(s, eb[0], eb[1], eb[2]);
    if (prevA) {
      const v0 = prevS / tileS, v1 = s / tileS;
      // quad: prevA, prevB, b, a  (u across, v along)
      let q = [prevA, prevB, b, a];
      const ux = q[1][0] - q[0][0], uy = q[1][1] - q[0][1], uz = q[1][2] - q[0][2];
      const vx = q[3][0] - q[0][0], vy = q[3][1] - q[0][1], vz = q[3][2] - q[0][2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const f = typeof facing === 'function' ? facing(s) : facing;
      if (nx * f[0] + ny * f[1] + nz * f[2] < 0) {
        B.quad(q[1], q[0], q[3], q[2], [tileU, v0, 0, v1], color, region);
      } else {
        B.quad(q[0], q[1], q[2], q[3], [0, v0, tileU, v1], color, region);
      }
    }
    prevA = a; prevB = b; prevS = s;
  }
}

// lateral direction (world) at s for side
export function sideDir(ctx, s, side) {
  const yaw = ctx.track.yawAt(s);
  return [Math.cos(yaw) * side, 0, Math.sin(yaw) * side];
}

// ---------------------------------------------------------------- curbs, sidewalks, medians

export function curb(ctx, s0, s1, side, xIn, width = 0.3, h = 0.18, region = 'curb') {
  const M = ctx.M;
  const reg = ctx.misc.get(region);
  const hw = (s) => ctx.track.halfWAt(s);
  // vertical face toward road
  ribbon(ctx, ctx.B.misc, s0, s1,
    (s) => [side * xIn(s), -0.05], (s) => [side * xIn(s), h],
    reg, [1, 1, 1], { facing: (s) => sideDir(ctx, s, -side), tileS: 2 });
  ribbon(ctx, ctx.B.misc, s0, s1,
    (s) => [side * xIn(s), h], (s) => [side * (xIn(s) + width), h],
    reg, [0.9, 0.9, 0.9], { tileS: 2 });
}

export function sidewalk(ctx, s0, s1, side, xIn, width, h = 0.18) {
  const reg = ctx.misc.get('sidewalk');
  ribbon(ctx, ctx.B.misc, s0, s1,
    (s) => [side * xIn(s), h], (s) => [side * (xIn(s) + width), h],
    reg, ctx.stage.sidewalkTint || [0.95, 0.92, 0.9], { tileS: 3, tileU: width / 3 });
  // outer drop
  ribbon(ctx, ctx.B.misc, s0, s1,
    (s) => [side * (xIn(s) + width), h], (s) => [side * (xIn(s) + width), -0.4],
    ctx.misc.get('concrete'), [0.7, 0.7, 0.7], { facing: (s) => sideDir(ctx, s, side), tileS: 4 });
}

export function median(ctx, s0, s1, xIn, width) {
  // raised median: curbs both sides + soil top with hedges
  curb(ctx, s0, s1, 1, xIn, 0.25, 0.22);
  const reg = ctx.misc.get('curb');
  ribbon(ctx, ctx.B.misc, s0, s1,
    (s) => [xIn(s) + width, -0.05], (s) => [xIn(s) + width, 0.22],
    reg, [1, 1, 1], { facing: (s) => sideDir(ctx, s, 1), tileS: 2 });
  ribbon(ctx, ctx.B.misc, s0, s1,
    (s) => [xIn(s) + width - 0.25, 0.22], (s) => [xIn(s) + width, 0.22],
    reg, [0.9, 0.9, 0.9], { tileS: 2 });
  // soil
  ribbon(ctx, ctx.B.misc, s0, s1,
    (s) => [xIn(s) + 0.25, 0.26], (s) => [xIn(s) + width - 0.25, 0.26],
    ctx.misc.get('concrete'), [0.36, 0.32, 0.24], { tileS: 3 });
}

export function railing(ctx, s0, s1, side, x, h = 1.0, opts = {}) {
  const B = ctx.B.misc;
  const reg = ctx.misc.get('metal');
  const col = opts.color || [0.75, 0.78, 0.8];
  const step = opts.post || 3;
  for (let s = Math.ceil(s0 / step) * step; s < s1; s += step) {
    const p = ctx.P(s, side * x, opts.h0 || 0.18, opts.ground);
    B.box(p[0], p[1], p[2], 0.08, h, 0.08, 0, { color: col, region: reg });
  }
  for (const hh of [h * 0.45, h]) {
    ribbon(ctx, B, s0, s1,
      (s) => [side * x, (opts.h0 || 0.18) + hh - 0.05, opts.ground], (s) => [side * x, (opts.h0 || 0.18) + hh + 0.03, opts.ground],
      reg, col, { facing: (s) => sideDir(ctx, s, -side), tileS: 2, ds: 6 });
    ribbon(ctx, B, s0, s1,
      (s) => [side * x, (opts.h0 || 0.18) + hh - 0.05, opts.ground], (s) => [side * x, (opts.h0 || 0.18) + hh + 0.03, opts.ground],
      reg, col, { facing: (s) => sideDir(ctx, s, side), tileS: 2, ds: 6 });
  }
}

export function parapet(ctx, s0, s1, side, x, h = 1.1) {
  const reg = ctx.misc.get('concrete');
  ribbon(ctx, ctx.B.misc, s0, s1, (s) => [side * x, 0], (s) => [side * x, h], reg, [0.85, 0.84, 0.82], { facing: (s) => sideDir(ctx, s, -side), tileS: 3 });
  ribbon(ctx, ctx.B.misc, s0, s1, (s) => [side * x, h], (s) => [side * (x + 0.35), h], reg, [0.9, 0.9, 0.88], { tileS: 3 });
  ribbon(ctx, ctx.B.misc, s0, s1, (s) => [side * (x + 0.35), h], (s) => [side * (x + 0.35), -1.4], reg, [0.7, 0.7, 0.68], { facing: (s) => sideDir(ctx, s, side), tileS: 3 });
  // reflectors on the parapet
  for (let s = Math.ceil(s0 / 12) * 12; s < s1; s += 12) {
    const p = ctx.P(s, side * (x - 0.02), 0.7);
    ctx.B.always.box(p[0], p[1], p[2], 0.12, 0.12, 0.05, ctx.track.yawAt(s), { color: [1.6, 1.0, 0.2] });
  }
}

export function boundaryWall(ctx, s0, s1, side, x, h = 2.4) {
  const reg = ctx.facade.get('wall_poster');
  ribbon(ctx, ctx.B.world, s0, s1, (s) => [side * x, 0, true], (s) => [side * x, h, true], reg, [1, 1, 1], { facing: (s) => sideDir(ctx, s, -side), tileS: 12, ds: 6 });
  ribbon(ctx, ctx.B.misc, s0, s1, (s) => [side * x, h, true], (s) => [side * (x + 0.3), h, true], ctx.misc.get('concrete'), [0.8, 0.78, 0.74], { tileS: 3, ds: 6 });
}

// ---------------------------------------------------------------- lamps

export function lampPost(ctx, s, side, x, opts = {}) {
  const yaw = ctx.track.yawAt(s);
  const h = opts.h || 9;
  const base = ctx.P(s, side * x, opts.h0 ?? 0.18, opts.ground);
  const B = ctx.B.misc;
  const metal = ctx.misc.get('metal');
  const col = opts.color || [0.55, 0.58, 0.6];
  B.cylinder(base[0], base[1], base[2], 0.13, 0.09, h, 6, col, metal);
  const arms = opts.double ? [-1, 1] : [-side];
  for (const a of arms) {
    // arm reaches over the road
    const reach = opts.reach || 2.0;
    const tip = ctx.P(s, side * x + a * reach, (opts.h0 ?? 0.18) + h + 0.3, opts.ground);
    B.tube([base[0], base[1] + h - 0.2, base[2]], tip, 0.06, 0.05, 5, col, metal);
    // head
    const hy = tip[1] - 0.15;
    B.box(tip[0], hy, tip[2], 0.9, 0.22, 0.38, yaw, { color: [0.3, 0.3, 0.32], region: metal });
    ctx.B.lamp.box(tip[0], hy - 0.04, tip[2], 0.8, 0.06, 0.3, yaw, { color: ctx.lampRGB });
  }
  ctx.obstacle(s, side * x, 0.25, 0.25, 'solid');
}

// ---------------------------------------------------------------- electric poles + wire spaghetti

export function elecPole(ctx, s, x, nextS, nextX, density = 1) {
  const B = ctx.B.misc;
  const conc = ctx.misc.get('concrete');
  const h = 10;
  const base = ctx.P(s, x, 0.18);
  B.box(base[0], base[1], base[2], 0.3, h, 0.3, ctx.track.yawAt(s), { color: [0.75, 0.73, 0.7], region: conc });
  const yaw = ctx.track.yawAt(s);
  // crossarm (perpendicular to road)
  const arm1 = ctx.P(s, x - 1.1, h - 0.5), arm2 = ctx.P(s, x + 1.1, h - 0.5);
  B.tube(arm1, arm2, 0.06, 0.06, 4, [0.3, 0.3, 0.3], ctx.misc.get('metal'));
  // transformer box on some
  if (ctx.rng.chance(0.25)) {
    const tp = ctx.P(s, x + 0.35 * Math.sign(-x || 1), h - 3.2);
    B.box(tp[0], tp[1], tp[2], 0.7, 1.0, 0.6, yaw, { color: [0.45, 0.5, 0.48], region: ctx.misc.get('metal') });
    for (let k = 0; k < 3; k++) {
      const ip = ctx.P(s, x - 0.6 + k * 0.6, h - 0.35);
      B.cylinder(ip[0], ip[1], ip[2], 0.05, 0.03, 0.35, 4, [0.6, 0.35, 0.2], ctx.misc.get('metal'));
    }
  }
  // cable bundles (the spaghetti) on some poles
  if (ctx.rng.chance(0.35 * density)) {
    const bp = ctx.P(s, x, h - 2.2);
    for (let k = 0; k < 4; k++) {
      ctx.W.sag([bp[0] + ctx.rng.range(-0.3, 0.3), bp[1] + ctx.rng.range(-0.5, 0.5), bp[2] + ctx.rng.range(-0.3, 0.3)],
        [bp[0] + ctx.rng.range(-0.4, 0.4), bp[1] - ctx.rng.range(0.5, 1.6), bp[2] + ctx.rng.range(-0.4, 0.4)], 0.6, 6);
    }
    B.cylinder(bp[0], bp[1] - 0.4, bp[2], 0.35, 0.3, 0.6, 6, [0.08, 0.08, 0.08], ctx.misc.get('tyre'));
  }
  // wires to next pole
  const nWires = Math.round(4 + density * 5);
  for (let k = 0; k < nWires; k++) {
    const off = -1.0 + (k / Math.max(1, nWires - 1)) * 2.0;
    const hOff = -0.5 - (k % 3) * 0.35 - ctx.rng.next() * 0.6;
    const a = ctx.P(s, x + off * 0.9, h + hOff);
    const b = ctx.track.point(Math.min(nextS, ctx.track.length + 300), nextX + off * 0.9, h + hOff + ctx.rng.range(-0.2, 0.2), ctx.tmp);
    ctx.W.sag(a, [b.x, b.y, b.z], 0.5 + ctx.rng.next() * 1.2 * density, 8);
  }
  // some wires cross the road (Old Dhaka style)
  if (density > 1.2 && ctx.rng.chance(0.6)) {
    for (let k = 0; k < 3 + density * 2; k++) {
      const a = ctx.P(s, x, h - 0.5 - ctx.rng.next() * 2);
      const b = ctx.P(s + ctx.rng.range(-10, 10), -x + ctx.rng.range(-2, 2), h - 1 - ctx.rng.next() * 2.5);
      ctx.W.sag(a, b, 0.8 + ctx.rng.next() * 1.5, 10);
    }
  }
  ctx.obstacle(s, x, 0.3, 0.3, 'solid');
}

// ---------------------------------------------------------------- buildings

// s: start along road, w: width along road, d: depth, h: height, xNear: lateral distance of facade from centre
export function building(ctx, s, side, xNear, w, d, h, style, opts = {}) {
  const sc = s + w / 2;
  const yaw = ctx.track.yawAt(sc);
  const xc = side * (xNear + d / 2);
  const p = ctx.P(sc, xc, 0, true);
  const boxYaw = side < 0 ? yaw - Math.PI / 2 : yaw + Math.PI / 2;
  const F = ctx.facade;
  const fac = F.get(style.facade);
  const sideFac = F.get(opts.sideFacade || (ctx.rng.chance(0.5) ? style.facade : 'side_plain'));
  const shop = style.shop ? F.get(style.shop) : null;
  const tint = opts.tint || ctx.tint();
  const uo = [Math.floor(ctx.rng.next() * 4) * 0.25, 0];
  const B = ctx.B.world;
  const gf = shop ? 3.75 : 0;
  const below = 3; // sink into ground for hills
  if (shop) {
    B.box(p[0], p[1] - below, p[2], w, gf + below, d, boxYaw, {
      regions: { front: shop, back: F.get('side_plain'), side: F.get('side_plain'), top: F.get('roof') },
      tile: [12, 3.75], uvOff: [uo[0], -below / 3.75], color: tint, skip: { top: true },
    });
    // shop sign band on the front
    if (ctx.rng.chance(opts.signP ?? 0.75)) shopSign(ctx, sc, side, xNear - 0.12, Math.min(w * 0.9, 9), gf + 0.2, yaw);
  }
  const upper = h - gf;
  if (upper > 0.5) {
    const setback = opts.setback || 0;
    B.box(p[0], p[1] + gf, p[2], w, upper, d, boxYaw, {
      regions: { front: fac, back: F.get('side_plain'), left: sideFac, right: sideFac, top: F.get('roof') },
      tile: [12, 12], uvOff: [uo[0], 0], color: tint, topTile: 6,
    });
    // cornice / parapet
    B.box(p[0], p[1] + h, p[2], w + 0.3, 0.5, d + 0.3, boxYaw, { color: [tint[0] * 0.9, tint[1] * 0.9, tint[2] * 0.9], region: F.get('concrete'), tile: [3, 3] });
    if (!opts.noRoof) rooftop(ctx, p, w, d, h, boxYaw, style);
  }
  // collision: the whole footprint
  ctx.obstacle(sc, side * (xNear + d / 2), d / 2, w / 2, 'solid');
  return p;
}

export function rooftop(ctx, p, w, d, h, yaw, style) {
  const B = ctx.B.misc;
  const rng = ctx.rng;
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  const L = (lx, lz) => [p[0] + lx * cs - lz * sn, p[1] + h + 0.5, p[2] + lx * sn + lz * cs];
  // stair room
  if (rng.chance(0.7)) {
    const q = L(rng.range(-w * 0.3, w * 0.3), rng.range(-d * 0.3, d * 0.2));
    ctx.B.world.box(q[0], q[1], q[2], 3, 2.6, 3, yaw, { color: ctx.tint(), region: ctx.facade.get('side_plain'), tile: [3, 3] });
  }
  // black water tanks (Gazi tanks)
  const nt = rng.int(0, 3);
  for (let i = 0; i < nt; i++) {
    const q = L(rng.range(-w * 0.4, w * 0.4), rng.range(-d * 0.4, d * 0.4));
    B.cylinder(q[0], q[1] + 0.4, q[2], 0.8, 0.8, 1.6, 8, [1, 1, 1], ctx.misc.get('water_tank'), { cap: true, capColor: [0.12, 0.12, 0.12] });
    B.box(q[0], q[1], q[2], 1.6, 0.4, 1.6, yaw, { color: [0.5, 0.5, 0.5], region: ctx.misc.get('metal') });
  }
  // satellite dish / antenna
  if (rng.chance(0.4)) {
    const q = L(rng.range(-w * 0.4, w * 0.4), rng.range(-d * 0.4, d * 0.4));
    B.tube(q, [q[0], q[1] + 3.5, q[2]], 0.03, 0.02, 3, [0.4, 0.4, 0.4], ctx.misc.get('metal'));
    B.cylinder(q[0], q[1] + 1.2, q[2], 0.5, 0.1, 0.2, 8, [0.85, 0.85, 0.85], ctx.misc.get('metal'));
  }
  // telecom tower occasionally
  if (rng.chance(0.06)) {
    const q = L(0, 0);
    B.cylinder(q[0], q[1], q[2], 0.9, 0.12, 18, 4, [0.75, 0.3, 0.25], ctx.misc.get('metal'));
    ctx.B.always.box(q[0], q[1] + 18, q[2], 0.35, 0.35, 0.35, 0, { color: [3, 0.1, 0.1] });
  }
  // rooftop garden pots
  if (rng.chance(0.3)) {
    for (let i = 0; i < 4; i++) {
      const q = L(rng.range(-w * 0.45, w * 0.45), rng.range(-d * 0.45, d * 0.45));
      ctx.sprites.add(rng.pick(['bush0', 'bougain0', 'banana0']), q[0], q[1], q[2], rng.range(0.5, 0.9));
    }
  }
  // fairy lights strung across roofs (weddings!)
  if (rng.chance(ctx.stage.fairyP ?? 0.12)) {
    const a = L(-w / 2, d / 2), b = L(w / 2, d / 2);
    const cols = [[3, 0.6, 0.2], [0.4, 3, 0.6], [0.4, 0.8, 3], [3, 2.4, 0.4], [3, 0.4, 2.4]];
    for (let k = 0; k < 4; k++) {
      const yy = -k * 2.5;
      for (let t = 0; t <= 1; t += 0.08) {
        const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t;
        ctx.B.neon.box(x, a[1] + yy - Math.sin(t * Math.PI) * 0.4, z, 0.12, 0.12, 0.12, 0, { color: cols[(t * 12 | 0) % cols.length] });
      }
    }
  }
}

export function shopSign(ctx, s, side, x, w, y, yaw) {
  const A = ctx.signs;
  const latin = ctx.stage.latinSigns && ctx.rng.chance(ctx.stage.latinSigns);
  const name = latin ? 'shopen' + ctx.rng.int(0, A.shopEnCount - 1) : 'shop' + ctx.rng.int(0, A.shopCount - 1);
  const reg = A.get(name);
  const h = Math.min(1.4, w / 4);
  const p = ctx.P(s, side * x, y, true);
  const pyaw = side < 0 ? yaw - Math.PI / 2 : yaw + Math.PI / 2;
  ctx.B.sign.panel(p[0], p[1], p[2], w, h, pyaw, [1, 1, 1], reg);
  // a protruding (perpendicular) sign, readable as you approach
  if (ctx.rng.chance(0.4)) {
    const name2 = 'shop' + ctx.rng.int(0, A.shopCount - 1);
    const pp = ctx.P(s + ctx.rng.range(-2, 2), side * (x - 0.9), y + ctx.rng.range(0.6, 2.2), true);
    ctx.B.sign.panel(pp[0], pp[1], pp[2], 1.8, 0.6, yaw, [1, 1, 1], A.get(name2), [0, 0, 1, 1], true);
  }
}

export function billboard(ctx, s, side, x, y, id, opts = {}) {
  const A = ctx.signs;
  const reg = A.get('bb_' + id);
  const yaw = ctx.track.yawAt(s);
  const w = opts.w || 11, h = w / 2;
  // angle the board toward oncoming drivers
  const ang = yaw + side * (opts.angle ?? 0.45);
  const p = ctx.P(s, side * x, y, opts.ground ?? true);
  const B = ctx.B.misc;
  const metal = ctx.misc.get('rust');
  // legs / scaffold
  const cs = Math.cos(ang), sn = Math.sin(ang);
  for (const lx of [-w * 0.35, w * 0.35]) {
    const bx = p[0] + cs * lx, bz = p[2] + sn * lx;
    B.box(bx, p[1] - (opts.legs ?? y), bz, 0.3, (opts.legs ?? y) + h * 0.5, 0.3, ang, { color: [0.5, 0.45, 0.4], region: metal });
  }
  B.box(p[0], p[1] - 0.2, p[2], w + 0.6, 0.25, 1.2, ang, { color: [0.4, 0.4, 0.4], region: metal });
  B.box(p[0] + (-sn) * -0.08, p[1], p[2] + cs * -0.08, w + 0.4, h + 0.4, 0.15, ang, { color: [0.15, 0.15, 0.15], region: metal });
  ctx.B.sign.panel(p[0] + (-sn) * 0.02, p[1] + 0.2, p[2] + cs * 0.02, w, h, ang, [1, 1, 1], reg);
  // floodlights on the bottom bar
  for (let k = -2; k <= 2; k++) {
    const lx = (k / 2) * w * 0.4;
    ctx.B.lamp.box(p[0] + cs * lx + (-sn) * 0.7, p[1] - 0.05, p[2] + sn * lx + cs * 0.7, 0.35, 0.18, 0.2, ang, { color: [1, 0.95, 0.8] });
  }
  if (!opts.ground && opts.obstacle !== false) ctx.obstacle(s, side * x, 0.5, w * 0.4, 'solid');
}

// ---------------------------------------------------------------- road furniture

export function footbridge(ctx, s, hwL, hwR, opts = {}) {
  // pedestrian overpass spanning the whole road, ads on both faces
  const yaw = ctx.track.yawAt(s);
  const B = ctx.B.misc;
  const conc = ctx.misc.get('concrete');
  const xa = -(hwL + 2.5), xb = hwR + 2.5;
  const H = 5.6;
  const mid = (xa + xb) / 2;
  const span = xb - xa;
  const p = ctx.P(s, mid, H);
  B.box(p[0], p[1], p[2], span, 0.7, 2.6, yaw, { color: [0.78, 0.76, 0.72], region: conc, tile: [4, 4] });
  // railings / mesh walls
  for (const zz of [-1.25, 1.25]) {
    const q = ctx.P(s + zz, mid, H + 0.7);
    B.box(q[0], q[1], q[2], span, 1.2, 0.08, yaw, { color: [0.35, 0.55, 0.45], region: ctx.misc.get('metal') });
  }
  // roof (many Dhaka footbridges have tin roofs)
  const r = ctx.P(s, mid, H + 3.0);
  B.box(r[0], r[1], r[2], span, 0.12, 3.2, yaw, { color: [0.4, 0.5, 0.65], region: ctx.misc.get('metal') });
  for (const lx of [xa + 1, mid, xb - 1]) {
    for (const zz of [-1.2, 1.2]) {
      const q = ctx.P(s + zz, lx, H + 0.7);
      B.box(q[0], q[1], q[2], 0.1, 2.3, 0.1, yaw, { color: [0.3, 0.3, 0.3], region: ctx.misc.get('metal') });
    }
  }
  // pillars + stairs at both ends
  for (const ex of [xa, xb]) {
    const q = ctx.P(s, ex, 0.18);
    B.box(q[0], q[1], q[2], 0.7, H, 0.7, yaw, { color: [0.7, 0.68, 0.64], region: conc });
    const st0 = ctx.P(s - 6, ex - Math.sign(ex) * 0.8, 0.2);
    const st1 = ctx.P(s, ex - Math.sign(ex) * 0.8, H);
    B.tube(st0, st1, 0.8, 0.8, 4, [0.72, 0.7, 0.66], conc);
    ctx.obstacle(s, ex, 0.5, 0.5, 'solid');
    ctx.obstacle(s - 3, ex - Math.sign(ex) * 0.8, 0.9, 3, 'solid');
  }
  // ad banners on the face toward traffic
  const ids = opts.ads || ['gfun', 'tea', 'pathaw'];
  const nb = Math.max(1, Math.floor(span / 9));
  for (let i = 0; i < nb; i++) {
    const lx = xa + span * ((i + 0.5) / nb);
    const q = ctx.P(s + 1.32, lx, H - 0.25);
    ctx.B.sign.panel(q[0], q[1], q[2], span / nb - 0.4, 1.7, yaw, [1, 1, 1], ctx.signs.get('bb_' + ids[i % ids.length]));
  }
  // people crossing on top (sprites)
  for (let i = 0; i < 4; i++) {
    const q = ctx.P(s + ctx.rng.range(-0.8, 0.8), xa + ctx.rng.next() * span, H + 0.35);
    ctx.sprites.add(ctx.rng.pick(['p_lungi', 'p_saree', 'p_shirt', 'p_kameez']), q[0], q[1], q[2], 1);
  }
}

export function gantrySign(ctx, s, hwL, hwR, material, opts = {}) {
  const yaw = ctx.track.yawAt(s);
  const B = ctx.B.misc;
  const metal = ctx.misc.get('metal');
  const xa = -(hwL + 1.4), xb = hwR + 1.4;
  const H = 6.4;
  for (const ex of [xa, xb]) {
    const q = ctx.P(s + 0.7, ex, 0.0);
    B.box(q[0], q[1], q[2], 0.4, H + 4.2, 0.4, yaw, { color: [0.6, 0.62, 0.64], region: metal });
    ctx.obstacle(s, ex, 0.4, 0.4, 'solid');
  }
  const w = opts.w || Math.min(16, xb - xa - 1);
  const ph = w / 4;
  // truss beam behind the sign face
  const p = ctx.P(s + 0.7, (xa + xb) / 2, H + ph * 0.5);
  B.box(p[0], p[1], p[2], xb - xa, 0.35, 0.35, yaw, { color: [0.6, 0.62, 0.64], region: metal });
  const p2 = ctx.P(s + 0.7, (xa + xb) / 2, H + ph + 0.1);
  B.box(p2[0], p2[1], p2[2], xb - xa, 0.25, 0.25, yaw, { color: [0.6, 0.62, 0.64], region: metal });
  const c = ctx.P(s + 0.25, opts.x ?? (xa + xb) / 2, H);
  const geo = new THREE.PlaneGeometry(w, ph);
  const m = new THREE.Mesh(geo, material);
  m.position.set(c[0], c[1] + ph / 2, c[2]);
  m.rotation.y = -yaw;
  ctx.extra.push(m);
  const back = ctx.P(s + 0.3, opts.x ?? (xa + xb) / 2, H);
  B.box(back[0], back[1], back[2], w + 0.2, ph + 0.2, 0.08, yaw, { color: [0.4, 0.4, 0.4], region: metal });
}

export function roadSign(ctx, s, side, x, kind) {
  const p = ctx.P(s, side * x, 0.18);
  const yaw = ctx.track.yawAt(s);
  ctx.B.misc.box(p[0], p[1], p[2], 0.08, 2.4, 0.08, yaw, { color: [0.6, 0.6, 0.6], region: ctx.misc.get('metal') });
  const q = ctx.P(s + 0.05, side * x, 2.0);
  ctx.B.sign.panel(q[0], q[1], q[2], 0.9, 0.9, yaw, [1, 1, 1], ctx.signs.get('rs_' + kind));
  ctx.obstacle(s, side * x, 0.2, 0.2, 'solid');
}

// Big decorated wedding-style gate (checkpoint / start / goal)
export function festiveGate(ctx, s, hwL, hwR, bannerMat, opts = {}) {
  const yaw = ctx.track.yawAt(s);
  const B = ctx.B.misc;
  const cloth = ctx.misc.get('gate_cloth');
  const bamboo = ctx.misc.get('bamboo');
  const xa = -(hwL + 1.0), xb = hwR + 1.0;
  const H = 7.5;
  for (const ex of [xa, xb]) {
    const q = ctx.P(s, ex, 0);
    B.box(q[0], q[1], q[2], 1.4, H, 1.4, yaw, { color: [1, 1, 1], region: cloth, tile: [2, 2] });
    // marigold-ball tops
    ctx.B.misc.dome(q[0], q[1] + H, q[2], 1.0, 1.4, 8, 4, [1, 0.6, 0.1], ctx.misc.get('gate_cloth'));
    ctx.obstacle(s, ex, 0.9, 0.9, 'solid');
  }
  // arch made of bamboo with cloth
  const span = xb - xa;
  const segs = 12;
  let prev = null;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = xa + span * t;
    const yy = H + Math.sin(t * Math.PI) * 2.6;
    const q = ctx.P(s, x, yy);
    if (prev) B.tube(prev, q, 0.35, 0.35, 6, [1, 1, 1], cloth);
    prev = q;
  }
  // banner
  const c = ctx.P(s - 0.3, (xa + xb) / 2, H - 2.6);
  const bw = Math.min(span - 2, 18);
  const geo = new THREE.PlaneGeometry(bw, bw / (opts.aspect || 5.33));
  const m = new THREE.Mesh(geo, bannerMat);
  m.position.set(c[0], c[1] + 1.2, c[2]);
  m.rotation.y = -yaw;
  ctx.extra.push(m);
  // fairy lights cascading down the gate (glow)
  const cols = [[3, 0.5, 0.2], [3, 2.2, 0.3], [0.4, 2.6, 0.6], [3, 0.4, 2], [0.6, 1.2, 3]];
  for (const ex of [xa, xb]) {
    for (let k = 0; k < 6; k++) {
      for (let yy = 0.5; yy < H; yy += 0.45) {
        const q = ctx.P(s - 0.75 + k * 0.3, ex + (k % 2 ? 0.75 : -0.75), yy);
        ctx.B.neon.box(q[0], q[1], q[2], 0.1, 0.1, 0.1, 0, { color: cols[(k + (yy * 2 | 0)) % cols.length] });
      }
    }
  }
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const q = ctx.P(s - 0.45, xa + span * t, H + Math.sin(t * Math.PI) * 2.6 - 0.45);
    ctx.B.neon.box(q[0], q[1], q[2], 0.14, 0.14, 0.14, 0, { color: cols[i % cols.length] });
  }
}

// Metro rail viaduct segment above the median (Dhaka MRT Line 6)
export function metroViaduct(ctx, s0, s1, x) {
  const B = ctx.B.misc;
  const conc = ctx.misc.get('concrete_smooth');
  const H = 13;
  const step = 30;
  for (let s = Math.ceil(s0 / step) * step; s < s1; s += step) {
    const yaw = ctx.track.yawAt(s);
    const p = ctx.P(s, x, 0.2);
    B.box(p[0], p[1], p[2], 1.8, H - 1.8, 2.2, yaw, { color: [0.86, 0.85, 0.82], region: conc, tile: [3, 3] });
    // T cap
    B.box(p[0], p[1] + H - 2.2, p[2], 9.5, 1.2, 2.4, yaw, { color: [0.86, 0.85, 0.82], region: conc, tile: [3, 3] });
    ctx.obstacle(s, x, 1.0, 1.2, 'solid');
  }
  // deck: box beam along the route
  const half = 4.6;
  ribbon(ctx, B, s0, s1, (s) => [x - half, H - 1.0], (s) => [x + half, H - 1.0], conc, [0.7, 0.7, 0.68], { facing: [0, -1, 0], tileS: 6 });
  ribbon(ctx, B, s0, s1, (s) => [x - half, H - 1.0], (s) => [x - half, H + 1.1], conc, [0.88, 0.87, 0.84], { facing: (s) => sideDir(ctx, s, -1), tileS: 6 });
  ribbon(ctx, B, s0, s1, (s) => [x + half, H - 1.0], (s) => [x + half, H + 1.1], conc, [0.88, 0.87, 0.84], { facing: (s) => sideDir(ctx, s, 1), tileS: 6 });
  ribbon(ctx, B, s0, s1, (s) => [x - half, H + 0.2], (s) => [x + half, H + 0.2], conc, [0.6, 0.6, 0.58], { tileS: 6 });
  // green & red stripe along the parapet (MRT brand)
  ribbon(ctx, ctx.B.always, s0, s1, (s) => [x - half - 0.02, H + 0.5], (s) => [x - half - 0.02, H + 0.62], null, [0.05, 0.4, 0.2], { facing: (s) => sideDir(ctx, s, -1), ds: 10 });
}

// Mosque: neighbourhood mosque with minaret(s) and green neon
export function mosque(ctx, s, side, x, scale = 1, opts = {}) {
  const yaw = ctx.track.yawAt(s);
  const p = ctx.P(s, side * x, 0, true);
  const B = ctx.B.misc;
  const white = ctx.misc.get('marble');
  const w = 14 * scale, d = 14 * scale, h = 8 * scale;
  B.box(p[0], p[1] - 2, p[2], w, h + 2, d, yaw, { color: opts.color || [0.95, 0.95, 0.92], region: white, tile: [4, 4] });
  B.dome(p[0], p[1] + h, p[2], w * 0.32, 1.1, 12, 5, opts.domeColor || [0.92, 0.92, 0.9], white);
  B.cylinder(p[0], p[1] + h + w * 0.34, p[2], 0.05, 0.02, 1.5, 4, [0.9, 0.8, 0.3], ctx.misc.get('metal'));
  const mx = [[-w / 2 - 1.2, -d / 2], [w / 2 + 1.2, -d / 2]];
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  for (const [lx, lz] of (opts.minarets === 1 ? [mx[0]] : mx)) {
    const q = [p[0] + lx * cs - lz * sn, p[1], p[2] + lx * sn + lz * cs];
    const mh = h * 2.4;
    B.cylinder(q[0], q[1], q[2], 1.0 * scale, 0.8 * scale, mh, 8, [0.95, 0.95, 0.92], white);
    B.cylinder(q[0], q[1] + mh, q[2], 1.3 * scale, 1.3 * scale, 0.6, 8, [0.9, 0.9, 0.88], white);
    B.cylinder(q[0], q[1] + mh + 0.6, q[2], 0.8 * scale, 0.1, 3 * scale, 8, [0.85, 0.85, 0.82], white);
    // green neon rings
    ctx.B.neon.cylinder(q[0], q[1] + mh * 0.6, q[2], 1.05 * scale, 1.05 * scale, 0.2, 10, [0.2, 2.6, 0.6]);
    ctx.B.neon.cylinder(q[0], q[1] + mh + 0.65, q[2], 1.35 * scale, 1.35 * scale, 0.15, 10, [0.2, 2.6, 0.6]);
  }
  ctx.obstacle(s, side * x, d / 2 + 2, w / 2 + 2, 'solid');
}
