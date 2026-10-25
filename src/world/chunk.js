// Builds one CHUNK-metre slice of a track: road surfaces, curbs, ground,
// water, buildings, props, sprites, landmarks, collision boxes.

import * as THREE from 'three';
import { MeshBuilder, LineBuilder } from './builder.js';
import { SpriteBatch } from './sprites.js';
import { buildRoadStrip } from './road.js';
import { LANE_W, STEP } from './track.js';
import { RNG, hashStr } from '../core/util.js';
import * as PR from './props.js';
import { FLAT } from './paint.js';

export const CHUNK = 100;

// Districts blend into each other: across the ~600 m either side of a boundary,
// each chunk borrows the look (buildings, trees, street life) of the neighbouring
// district with a probability that ramps, so the city changes gradually.
const STYLE_KEYS = ['facades', 'shops', 'heights', 'backHeights', 'trees', 'lakeTrees', 'streetTrees', 'parkTrees', 'life', 'medianPlants', 'billboards', 'fairyP', 'lifeDensity', 'wallLife', 'groundTint', 'palette'];
const BLEND = 600;
const palCache = new Map();
// palette hex -> rgb scaled so the brightest channel is 1 (hue and saturation only; the facade keeps its value)
const PALETTE_RGB = (hex) => {
  let v = palCache.get(hex);
  if (!v) {
    const c = new THREE.Color(hex), m = Math.max(c.r, c.g, c.b) || 1;
    palCache.set(hex, (v = [c.r / m, c.g / m, c.b / m]));
  }
  return v;
};
function blendedStage(world, track, ci) {
  const st = track.stage;
  const mid = ci * CHUNK + CHUNK / 2;
  let other = null, p = 0;
  if (track.parent && mid < BLEND) { other = track.parent.stage; p = 0.5 * (1 - mid / BLEND); }
  else if (!track.isFinal && track.length - mid < BLEND && track.children) { other = track.children[0].stage; p = 0.5 * (1 - (track.length - mid) / BLEND); }
  if (!other) return st;
  const r = new RNG(hashStr(track.id) + ci * 131).next();
  if (r >= p) return st;
  const mix = Object.create(st);
  for (const k of STYLE_KEYS) if (other[k] !== undefined) mix[k] = other[k];
  return mix;
}

export class ChunkCtx {
  constructor(world, track, ci) {
    this.world = world;
    this.track = track;
    this.stage = blendedStage(world, track, ci);
    this.ci = ci;
    this.s0 = ci * CHUNK;
    this.s1 = Math.min((ci + 1) * CHUNK, track.length + (track.isFinal ? 600 : 0));
    this.rng = new RNG(hashStr(track.id) + ci * 7919);
    this.facade = world.assets.facade;
    this.misc = world.assets.misc;
    this.fx = world.assets.fx;
    this.signs = world.assets.signs;
    this.B = {
      world: new MeshBuilder(true),
      misc: new MeshBuilder(true),
      sign: new MeshBuilder(true),
      lamp: new MeshBuilder(false),
      neon: new MeshBuilder(false),
      always: new MeshBuilder(false),
      ground: new MeshBuilder(false),
      fx: new MeshBuilder(true),
      fx2: new MeshBuilder(true),
    };
    this.sprites = new SpriteBatch(world.assets.sprites);
    this.W = new LineBuilder();
    this.water = [];
    this.extra = [];
    this.obstacles = [];
    this.tmp = new THREE.Vector3();
    const lc = new THREE.Color(this.stage.lampColor || '#ffb04a');
    this.lampRGB = [lc.r * 3, lc.g * 3, lc.b * 3];
  }

  P(s, x, h = 0, ground = false) {
    const v = this.track.point(s, x, h, this.tmp, ground);
    return [v.x, v.y, v.z];
  }

  // building colour: one of the district's palette hues over the (muted) facade texture, so a street reads as one
  // colour family instead of a random pastel each
  tint() {
    const r = this.rng;
    const b = r.range(0.88, 1.03);
    const pal = this.stage.palette;
    if (!pal) return [b * r.range(0.95, 1.05), b * r.range(0.95, 1.03), b * r.range(0.93, 1.02)];
    const c = PALETTE_RGB(r.pick(pal)), k = r.range(0.4, 0.6);
    return [b * (1 - k + c[0] * k), b * (1 - k + c[1] * k), b * (1 - k + c[2] * k)];
  }

  obstacle(s, x, hw, hl, kind = 'solid', extra = null) {
    const o = { s, x, hw, hl, kind, ...(extra || {}) };
    this.obstacles.push(o);
    return o;
  }

  // landmark breathing room: nothing is placed between the road and just behind the landmark; the city carries on beyond
  // it, so the place stands in its street and not alone in an empty lot
  isClear(s, side, ax = 99) {
    for (const z of this.track.clear || []) {
      if (s >= z.s0 && s <= z.s1 && z.side === side && ax > this.track.halfWAt(s) + 3.5 && ax < (z.x1 ?? 1e9)) return true;
    }
    return false;
  }

  sideType(s, side) {
    const sec = this.track.sectionAt(s);
    if (side < 0) return sec.L || this.stage.L || 'city';
    return sec.R || this.stage.R || 'city';
  }
}

// ----------------------------------------------------------------- lateral layout helpers

export function medianW(stage) { return stage.medianW || 2.6; }
export function oppHalf(stage) { return (stage.lanes * LANE_W) / 2; }

// where the "right side" scenery starts for a median road
function farX(ctx, s) {
  return ctx.track.halfWAt(s) + medianW(ctx.stage) + oppHalf(ctx.stage) * 2;
}

// edge limits for physics, by side type
export function sideLimits(type, stage, sec) {
  if (sec && sec.wallX != null) return { soft: sec.wallX - 0.2, wall: sec.wallX };
  switch (type) {
    case 'none': return { soft: 0.2, wall: 0.4 };
    case 'interior': return { soft: 0.3, wall: 0.55 };
    case 'gapCity': return { soft: 0.3, wall: 2 };
    case 'median': return { soft: 0.1, wall: 0.2 };
    case 'elevated': case 'bridge': return { soft: 0.2, wall: 0.35 };
    case 'lake': case 'river': return { soft: 0.3, wall: 1.9 }; // the promenade rail, not the walkway behind it
    case 'field': case 'kash': return { soft: 0.4, wall: 60 };
    case 'park': return { soft: 0.3, wall: 9 };
    case 'wall': return { soft: 0.3, wall: 3.0 };
    case 'cityLow': return { soft: 0.3, wall: 2.4 };
    case 'gore': return { soft: 0.3, wall: 40 };
    case 'open': return { soft: 0.5, wall: 80 };
    default: return { soft: 0.3, wall: 4.0 };
  }
}

// ground colours per side type: [near, mid, far]
const GROUND = {
  city: ['#4a463f', '#56514a', '#5c574c'],
  cityLow: ['#4a443c', '#524a40', '#5a5246'],
  park: ['#3f5a2c', '#4a6a32', '#56703a'],
  field: ['#6e5a40', '#5d7f38', '#6a8e3e'],
  kash: ['#6e5a40', '#7a8a52', '#8a9a62'],
  lake: ['#4a5236', '#3a3a2a', '#2a2a22'],
  river: ['#5a5238', '#3a3a2a', '#2a2a22'],
  wall: ['#4a463f', '#4a6030', '#56703a'],
  elevated: ['#4a463f', '#56514a', '#5c574c'],
  bridge: ['#2a3a3a', '#2a3a3a', '#2a3a3a'],
  gore: ['#5b7a36', '#5e8038', '#56703a'],
  stadium: ['#4a463f', '#3d6a2c', '#56514a'],
  open: ['#6a5a42', '#7a6a4a', '#7a6c52'],
};

function groundProfile(ctx, type, xIn) {
  const g = GROUND[type] || GROUND.city;
  const c = g.map((h) => new THREE.Color(h));
  const tint = ctx.stage.groundTint ? new THREE.Color(ctx.stage.groundTint) : null;
  if (tint) c.forEach((cc) => cc.lerp(tint, 0.4));
  const col = (i) => [c[i].r, c[i].g, c[i].b];
  if (type === 'lake' || type === 'river' || type === 'bridge') {
    const lw = type === 'lake' ? (ctx.stage.lakeW || 130) : 2000;
    const prof = [
      [xIn, -0.03, col(0)],
      [xIn + 4.2, -0.08, col(0)],
      [xIn + 7, -2.6, col(1)],
      [xIn + 12, -3.6, col(2)],
    ];
    if (type === 'bridge') { prof.length = 0; prof.push([xIn, -6, col(1)], [xIn + 30, -6, col(2)]); }
    if (lw < 600) {
      prof.push([xIn + lw - 8, -3.6, col(2)], [xIn + lw, -0.1, col(0)], [xIn + lw + 40, 0, col(1)], [460, 0, col(2)]);
    } else {
      prof.push([460, -3.6, col(2)]);
    }
    return prof;
  }
  if (type === 'field' || type === 'kash' || type === 'open') {
    return [[xIn, -0.06, col(0)], [xIn + 3.5, -0.12, col(0)], [xIn + 9, -0.25, col(1)], [90, -0.3, col(2)], [200, -0.35, col(1)], [460, -0.4, col(2)]];
  }
  return [[xIn, -0.02, col(0)], [xIn + 10, -0.02, col(1)], [70, 0, col(1)], [200, 0, col(2)], [460, 0, col(2)]];
}

function groundSpan(ctx, s0, s1, side, x0, x1, y, hex) {
  const c = new THREE.Color(hex);
  const col = [c.r, c.g, c.b];
  const B = ctx.B.ground;
  const ds = 10;
  const n = Math.max(1, Math.ceil((s1 - s0) / ds));
  for (let i = 0; i < n; i++) {
    const sa = s0 + ((s1 - s0) * i) / n, sb = s0 + ((s1 - s0) * (i + 1)) / n;
    const a0 = ctx.P(sa, side * x0, y, true), a1 = ctx.P(sb, side * x0, y, true);
    const b0 = ctx.P(sa, side * x1, y, true), b1 = ctx.P(sb, side * x1, y, true);
    const base = B.v;
    B.pos.push(...a0, ...b0, ...b1, ...a1);
    B.nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    B.uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    B.col.push(...col, ...col, ...col, ...col);
    B.v += 4;
    if (side < 0) B.idx.push(base, base + 3, base + 2, base, base + 2, base + 1);
    else B.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

function buildGround(ctx, s0, s1, side, type, xIn) {
  const prof = groundProfile(ctx, type, xIn);
  const B = ctx.B.ground;
  const ds = 10;
  const n = Math.max(1, Math.ceil((s1 - s0) / ds));
  for (let i = 0; i < n; i++) {
    const sa = s0 + ((s1 - s0) * i) / n, sb = s0 + ((s1 - s0) * (i + 1)) / n;
    for (let j = 0; j < prof.length - 1; j++) {
      const [xa, ya, ca] = prof[j], [xb, yb, cb] = prof[j + 1];
      const a0 = ctx.P(sa, side * xa, ya, true), a1 = ctx.P(sb, side * xa, ya, true);
      const b0 = ctx.P(sa, side * xb, yb, true), b1 = ctx.P(sb, side * xb, yb, true);
      // vertex colours per column
      const base = B.v;
      B.pos.push(...a0, ...b0, ...b1, ...a1);
      B.nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
      B.uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      B.col.push(...ca, ...cb, ...cb, ...ca);
      B.v += 4;
      // winding so normal faces up
      if (side < 0) B.idx.push(base, base + 3, base + 2, base, base + 2, base + 1);
      else B.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  if (type === 'lake' || type === 'river' || type === 'bridge') {
    const lw = type === 'lake' ? (ctx.stage.lakeW || 130) : 460;
    const xa = type === 'bridge' ? 0.2 : xIn + 5.5;
    const xb = type === 'lake' ? xIn + lw - 3 : 460;
    ctx.water.push({ s0, s1, side, xa, xb, y: -1.0 });
  }
}

// ----------------------------------------------------------------- side generators

// side streets: every block or so the buildings part for an inner road, so the avenue never reads as a corridor
const BLOCK = 92, STREET_W = 10;
function streetsIn(ctx, side, a, b) {
  const out = [];
  for (let k = Math.floor(a / BLOCK) - 1; k <= Math.ceil(b / BLOCK) + 1; k++) {
    const h = hashStr(ctx.track.id + ':' + side + ':' + k);
    if (h % 100 >= 72) continue;
    const s0 = k * BLOCK + 12 + (h % 38);
    if (s0 + STREET_W < a || s0 > b) continue;
    out.push([s0, s0 + STREET_W]);
  }
  return out;
}
function hitStreet(ctx, side, s0, s1) {
  for (const [a, b] of streetsIn(ctx, side, s0 - 4, s1 + 4)) if (s1 > a - 1 && s0 < b + 1) return [a, b];
  return null;
}

function placeBuildingsRow(ctx, a, b, side, xIn, opts) {
  const st = ctx.stage;
  const rng = ctx.rng;
  let s = a + rng.range(0, 3);
  const [hmin, hmax] = opts.heights || st.heights || [10, 28];
  while (s < b - 4) {
    let w = rng.range(opts.wmin || 7, opts.wmax || 16);
    if (s + w > b) w = b - s;
    if (w < 4) break;
    const d = rng.range(opts.dmin || 10, opts.dmax || 16);
    let h = rng.range(hmin, hmax);
    if (rng.chance(opts.towerP || st.towerP || 0.05)) h *= rng.range(1.6, 2.6);
    h = Math.round(h / 3) * 3 + 0.6;
    const style = {
      facade: rng.pick(opts.facades || st.facades || ['apt_cream']),
      shop: opts.shops === false ? null : rng.pick(opts.shops || st.shops || ['shop_a']),
    };
    const setback = rng.range(0, opts.setback ?? 0.5);
    if (ctx.isClear(s, side, xIn + 5) || ctx.isClear(s + w, side, xIn + 5)) { s += w + 2; continue; }
    if (!opts.noStreets) { const hit = hitStreet(ctx, side, s, s + w); if (hit) { s = Math.max(s + 1, hit[1] + 0.5); continue; } }
    PR.building(ctx, s, side, xIn + setback, w, d, h, style, { signP: opts.signP });
    if (style.shop && opts.balconies !== false && rng.chance(0.7)) PR.balconies(ctx, s, side, xIn + setback, w, h, 3.75);
    // rooftop billboard
    if (opts.billboards && rng.chance((opts.bbP || 0.06) * (FLAT ? 0.25 : 1)) && h < 40) {
      PR.billboard(ctx, s + w / 2, side, xIn + setback + d * 0.4, h + 5, rng.pick(opts.billboards), { legs: 5, ground: true, obstacle: false });
    }
    s += w + rng.range(0, opts.gap ?? 2.2);
  }
}

function sidewalkLife(ctx, a, b, side, xIn, width, opts = {}) {
  const st = ctx.stage;
  const rng = ctx.rng;
  const life = opts.life || st.life || { p_lungi: 2, p_shirt: 2, p_saree: 1, p_kameez: 1 };
  const dens = (opts.density ?? st.lifeDensity ?? 0.08) * 1.4; // busier pavements
  const n = Math.floor((b - a) * dens);
  for (let i = 0; i < n; i++) {
    const s = rng.range(a, b);
    const x = side * (xIn + rng.range(0.6, width - 0.4));
    const name = rng.weighted(life);
    const p = ctx.P(s, x, 0.18);
    const big = name === 'teastall' || name === 'fuchka' || name === 'flowerstall' || name === 'bookstall' || name === 'sareeshop' || name === 'fruitvan';
    ctx.sprites.add(name, p[0], p[1], p[2], rng.range(0.92, 1.08), { flip: rng.chance(0.5), lamp: 1, glow: 1 });
    ctx.obstacle(s, x, big ? 1.4 : 0.35, big ? 1.4 : 0.3, big ? 'solid' : 'soft');
  }
}

function trees(ctx, a, b, side, x0, x1, density, set) {
  const rng = ctx.rng;
  const n = Math.floor((b - a) * density);
  for (let i = 0; i < n; i++) {
    const s = rng.range(a, b);
    const xx = rng.range(x0, x1);
    const name = rng.weighted(set || ctx.stage.trees || { mango0: 1 });
    if (ctx.isClear(s, side, xx)) continue;
    const p = ctx.P(s, side * xx, 0, true);
    ctx.sprites.add(name, p[0], p[1], p[2], rng.range(0.8, 1.2), { flip: rng.chance(0.5), lamp: xx < 14 ? 0.7 : 0.15 });
    ctx.obstacle(s, side * xx, 0.5, 0.5, 'solid');
  }
}

function lampsAlong(ctx, a, b, side, x, opts = {}) {
  const sp = ctx.stage.lampSpacing || 34;
  const off = 7;
  for (let k = Math.ceil((a - off) / sp); k * sp + off < b; k++) {
    const s = k * sp + off;
    if (s < a) continue;
    PR.lampPost(ctx, s, side, x(s), opts);
  }
}

function polesAlong(ctx, a, b, side, x, density) {
  const sp = ctx.stage.poleSpacing || 38;
  const off = 19;
  for (let k = Math.ceil((a - off) / sp); k * sp + off < b; k++) {
    const s = k * sp + off;
    if (s < a) continue;
    PR.elecPole(ctx, s, side * x(s), s + sp, side * x(s + sp), density);
  }
}

function medianPiece(ctx, a, b, xIn, mw, st) {
  PR.median(ctx, a, b, xIn, mw);
  // median planting
  const rng = ctx.rng;
  const plant = st.medianPlants || { bush0: 3, bougain0: 2 };
  for (let s = a + rng.range(0, 3); s < b; s += rng.range(2.5, 5)) {
    const x = xIn(s) + mw / 2;
    const p = ctx.P(s, x, 0.15);
    ctx.sprites.add(rng.weighted(plant), p[0], p[1], p[2], rng.range(0.5, 0.8), { lamp: 0.8 });
  }
  if (st.medianPalms) {
    for (let s = Math.ceil(a / st.medianPalms) * st.medianPalms + 3; s < b; s += st.medianPalms) {
      const p = ctx.P(s, xIn(s) + mw / 2, 0.15);
      ctx.sprites.add(rng.pick(['palm0', 'palm1', 'palm2']), p[0], p[1], p[2], rng.range(0.9, 1.1), { lamp: 0.6 });
    }
  }
  // double-arm lamps in the median
  if (st.lampR !== false) lampsAlong(ctx, a, b, 1, (s) => xIn(s) + mw / 2, { double: true, reach: mw / 2 + 1.4, h0: 0.22 });
}

// split [s0, s1) by track section
// the sections a [s0, s1] range crosses, clipped to it. Uses the sections' own bounds: the track's
// sampled lookup is two metres coarse and returns the previous section for a boundary on an odd metre.
export function sectionRuns(track, s0, s1) {
  const out = [];
  const secs = track.sections;
  let a = s0;
  for (const sec of secs) {
    if (a >= s1 - 0.01) break;
    if (sec.s1 <= a + 0.01) continue;
    const b = Math.min(s1, sec.s1);
    out.push([a, b, sec]);
    a = b;
  }
  // the run-out past the end of the road belongs to the last section
  if (a < s1 - 0.01) out.push([a, s1, secs[secs.length - 1]]);
  return out;
}

// open country is never bare: hamlets of tin huts among trees, tree belts, and a far row of low buildings, so the land
// reads as lived-in out to the horizon
function countryside(ctx, a, b, side, xm, opts = {}) {
  const rng = ctx.rng;
  const st = ctx.stage;
  const hamlets = Math.floor((b - a) / (opts.every || 55) + rng.next());
  for (let i = 0; i < hamlets; i++) {
    const s0 = rng.range(a, Math.max(a + 1, b - 22));
    const x0 = xm + rng.range(16, 110);
    const huts = 2 + Math.floor(rng.next() * 3);
    for (let k = 0; k < huts; k++) {
      const s = s0 + k * rng.range(7, 12);
      if (s > b - 8 || ctx.isClear(s, side, x0)) continue;
      PR.building(ctx, s, side, x0 + rng.range(-5, 5), rng.range(5, 8), rng.range(4, 6), rng.range(3.2, 4.4), { facade: 'tin', shop: null }, { noRoof: true });
    }
    trees(ctx, s0 - 6, Math.min(b, s0 + 40), side, x0 - 8, x0 + 14, 0.12, st.trees);
  }
  trees(ctx, a, b, side, xm + 110, xm + 270, opts.belt ?? 0.09, st.trees);
  placeBuildingsRow(ctx, a, b, side, xm + (opts.farX || 150), { shops: false, facades: opts.facades || ['apt_raw', 'tin', 'apt_cream'], heights: opts.heights || [6, 14], wmin: 8, wmax: 15, gap: opts.gap || 28, noStreets: true, balconies: false, towerP: 0 });
}

const SIDES = {
  city(ctx, a, b, side, xIn, far = false) {
    const st = ctx.stage;
    const sw = st.sidewalk ?? 2.4;
    PR.curb(ctx, a, b, side, xIn);
    PR.sidewalk(ctx, a, b, side, (s) => xIn(s) + 0.3, sw);
    const xm = xIn((a + b) / 2);
    const front = xm + 0.3 + sw;
    for (const [s0, s1] of streetsIn(ctx, side, a, b)) {
      const x0 = front - sw - 0.1, x1 = front + 70;
      const pa = ctx.P(Math.max(a, s0), side * x0, 0.03, true), pb = ctx.P(Math.max(a, s0), side * x1, 0.03, true);
      const pc = ctx.P(Math.min(b, s1), side * x1, 0.03, true), pd = ctx.P(Math.min(b, s1), side * x0, 0.03, true);
      if (side > 0) ctx.B.misc.quad(pa, pb, pc, pd, [0, 0, 1, 4], [0.2, 0.2, 0.21], ctx.misc.get('concrete'));
      else ctx.B.misc.quad(pd, pc, pb, pa, [0, 0, 1, 4], [0.2, 0.2, 0.21], ctx.misc.get('concrete'));
    }
    placeBuildingsRow(ctx, a, b, side, front, { billboards: st.billboards, bbP: st.bbP ?? 0.06 });
    // back rows: taller, sparser, no shops
    placeBuildingsRow(ctx, a, b, side, front + 11 + ctx.rng.range(0, 4), { shops: false, heights: st.backHeights || [18, 45], wmin: 10, wmax: 22, gap: 6, towerP: st.towerP ?? 0.12 });
    if (ctx.rng.chance(0.7)) placeBuildingsRow(ctx, a, b, side, front + 32 + ctx.rng.range(0, 14), { shops: false, heights: st.farHeights || [24, 70], wmin: 14, wmax: 26, gap: 14, towerP: 0.2 });
    if (!far) {
      if (st.lampL !== false || side > 0) lampsAlong(ctx, a, b, side, (s) => xIn(s) + 0.9);
      if (st.poles !== false && side < 0) polesAlong(ctx, a, b, side, (s) => xIn(s) + 2.6, st.wireDensity ?? 0.5);
      sidewalkLife(ctx, a, b, side, xm + 0.3, sw);
      if (st.streetTrees) trees(ctx, a, b, side, xm + 1.4, xm + sw - 0.3, st.streetTrees, st.trees);
    } else {
      sidewalkLife(ctx, a, b, side, xm + 0.3, sw, { density: 0.03 });
    }
  },
  cityLow(ctx, a, b, side, xIn) {
    // Old Dhaka: narrow footpath, buildings hard against it, wires everywhere
    const st = ctx.stage;
    const sw = 1.6;
    PR.curb(ctx, a, b, side, xIn, 0.2, 0.14);
    PR.sidewalk(ctx, a, b, side, (s) => xIn(s) + 0.2, sw, 0.14);
    const xm = xIn((a + b) / 2);
    placeBuildingsRow(ctx, a, b, side, xm + 0.2 + sw, { gap: 0.3, setback: 0.2, heights: st.heights, wmin: 5, wmax: 10, signP: 0.6, billboards: st.billboards, bbP: 0.03 });
    placeBuildingsRow(ctx, a, b, side, xm + sw + 9, { shops: false, gap: 0.5, heights: [12, 24], wmin: 6, wmax: 12 });
    placeBuildingsRow(ctx, a, b, side, xm + sw + 22, { shops: false, gap: 2, heights: [15, 30], wmin: 8, wmax: 16 });
    polesAlong(ctx, a, b, side, (s) => xIn(s) + 0.9, st.wireDensity ?? 1.0);
    sidewalkLife(ctx, a, b, side, xm + 0.2, sw, { density: 0.12 });
  },
  park(ctx, a, b, side, xIn) {
    const st = ctx.stage;
    PR.curb(ctx, a, b, side, xIn);
    PR.sidewalk(ctx, a, b, side, (s) => xIn(s) + 0.3, 2.4);
    const xm = xIn((a + b) / 2);
    PR.railing(ctx, a, b, side, xm + 2.9, 0.9, { color: [0.2, 0.45, 0.3] });
    trees(ctx, a, b, side, xm + 3, xm + 22, (st.parkTrees ?? 0.12) * 1.4, st.trees);
    trees(ctx, a, b, side, xm + 22, xm + 70, 0.05, st.trees);
    lampsAlong(ctx, a, b, side, (s) => xIn(s) + 0.9);
    sidewalkLife(ctx, a, b, side, xm + 0.3, 2.4, { density: 0.04 });
    placeBuildingsRow(ctx, a, b, side, xm + 30 + ctx.rng.range(0, 10), { shops: false, heights: [18, 40], wmin: 10, wmax: 20, gap: 8 });
  },
  lake(ctx, a, b, side, xIn) {
    const st = ctx.stage;
    PR.curb(ctx, a, b, side, xIn);
    PR.sidewalk(ctx, a, b, side, (s) => xIn(s) + 0.3, 3.2);
    const xm = xIn((a + b) / 2);
    PR.railing(ctx, a, b, side, xm + 3.4, 1.0, { color: st.railColor || [0.85, 0.85, 0.82] });
    lampsAlong(ctx, a, b, side, (s) => xIn(s) + 0.9, { color: [0.2, 0.25, 0.22] });
    trees(ctx, a, b, side, xm + 1.2, xm + 3.0, 0.035, st.lakeTrees || st.trees);
    sidewalkLife(ctx, a, b, side, xm + 0.3, 3.0, { density: 0.05, life: st.lakeLife || { p_kameez: 2, p_saree: 1, p_lungi: 1, p_shirt: 2, fuchka: 0.5 } });
    // far shore
    const lw = st.lakeW || 130;
    placeBuildingsRow(ctx, a, b, side, xm + lw + 6, { shops: false, heights: st.backHeights || [18, 42], wmin: 10, wmax: 20, gap: 3, towerP: st.towerP ?? 0.1 });
    trees(ctx, a, b, side, xm + lw - 2, xm + lw + 5, 0.06, st.trees);
    // boats on the water
    if (st.boats && ctx.rng.chance(0.5)) ctx.world.landmarks.boat(ctx, ctx.rng.range(a, b), side, xm + ctx.rng.range(18, lw - 20), st.boats);
  },
  river(ctx, a, b, side, xIn) {
    const st = ctx.stage;
    PR.curb(ctx, a, b, side, xIn);
    PR.sidewalk(ctx, a, b, side, (s) => xIn(s) + 0.3, 3.0);
    const xm = xIn((a + b) / 2);
    PR.railing(ctx, a, b, side, xm + 3.2, 1.0, { color: [0.3, 0.32, 0.34] });
    lampsAlong(ctx, a, b, side, (s) => xIn(s) + 0.9);
    sidewalkLife(ctx, a, b, side, xm + 0.3, 3.0, { density: 0.06, life: st.riverLife || { p_lungi: 3, p_vendor: 1, crowd0: 0.5, p_shirt: 1 } });
    if (st.launches) {
      if (ctx.rng.chance(0.75)) ctx.world.landmarks.launch(ctx, ctx.rng.range(a, b), side, xm + ctx.rng.range(28, 60));
      if (ctx.rng.chance(0.5)) ctx.world.landmarks.launch(ctx, ctx.rng.range(a, b), side, xm + ctx.rng.range(90, 180));
    }
    if (st.boats) for (let i = 0; i < 3; i++) if (ctx.rng.chance(0.6)) ctx.world.landmarks.boat(ctx, ctx.rng.range(a, b), side, xm + ctx.rng.range(12, 220), st.boats);
  },
  field(ctx, a, b, side, xIn) {
    const st = ctx.stage;
    const xm = xIn((a + b) / 2);
    trees(ctx, a, b, side, xm + 3, xm + 16, (st.fieldTrees ?? 0.06) * 1.4, st.trees);
    trees(ctx, a, b, side, xm + 16, xm + 110, 0.05, st.trees);
    if (st.kilns && ctx.rng.chance(0.3)) ctx.world.landmarks.kiln(ctx, ctx.rng.range(a, b), side, xm + ctx.rng.range(80, 220));
    if (ctx.rng.chance(st.hutP ?? 0.25)) {
      const s = ctx.rng.range(a, b - 10);
      PR.building(ctx, s, side, xm + ctx.rng.range(10, 30), ctx.rng.range(5, 8), 5, 3.6, { facade: 'tin', shop: null }, { noRoof: true });
    }
    countryside(ctx, a, b, side, xm);
    if (st.fieldLife) sidewalkLife(ctx, a, b, side, xm + 1.5, 3, { density: 0.03, life: st.fieldLife });
    if (st.lampL !== false && st.fieldLamps) lampsAlong(ctx, a, b, side, (s) => xIn(s) + 1.5, { h0: 0 });
  },
  kash(ctx, a, b, side, xIn) {
    const st = ctx.stage;
    const xm = xIn((a + b) / 2);
    const rng = ctx.rng;
    const n = Math.floor((b - a) * 0.6);
    for (let i = 0; i < n; i++) {
      const s = rng.range(a, b);
      const xx = xm + 4 + Math.pow(rng.next(), 1.6) * 140;
      const p = ctx.P(s, side * xx, -0.2, true);
      ctx.sprites.add(rng.pick(['kash0', 'kash1']), p[0], p[1], p[2], rng.range(0.8, 1.3), { flip: rng.chance(0.5) });
      if (xx < 12) ctx.obstacle(s, side * xx, 0.6, 0.6, 'soft');
    }
    trees(ctx, a, b, side, xm + 14, xm + 120, 0.04, st.trees);
    // the new town: blocks of flats standing apart across the plain
    countryside(ctx, a, b, side, xm, { every: 90, farX: 70, heights: [15, 36], gap: 34, facades: ['apt_cream', 'apt_raw'] });
    if (st.fieldLamps) lampsAlong(ctx, a, b, side, (s) => xIn(s) + 1.5, { h0: 0 });
  },
  wall(ctx, a, b, side, xIn) {
    const st = ctx.stage;
    PR.curb(ctx, a, b, side, xIn);
    PR.sidewalk(ctx, a, b, side, (s) => xIn(s) + 0.3, 2.6);
    const xm = xIn((a + b) / 2);
    PR.boundaryWall(ctx, a, b, side, xm + 2.9);
    trees(ctx, a, b, side, xm + 3, xm + 14, (st.wallTrees ?? 0.1) * 1.3, st.trees);
    lampsAlong(ctx, a, b, side, (s) => xIn(s) + 0.9);
    sidewalkLife(ctx, a, b, side, xm + 0.3, 2.4, { density: st.wallLife ?? 0.05 });
    placeBuildingsRow(ctx, a, b, side, xm + 20 + ctx.rng.range(0, 8), { shops: false, heights: st.backHeights || [12, 30], wmin: 12, wmax: 24, gap: 10, facades: st.wallFacades || st.facades });
  },
  elevated(ctx, a, b, side, xIn) {
    const st = ctx.stage;
    PR.parapet(ctx, a, b, side, xIn((a + b) / 2) + 0.05);
    lampsAlong(ctx, a, b, side, (s) => xIn(s) + 0.25, { h0: 1.1, h: 8 });
    // the city below
    const xm = xIn((a + b) / 2);
    placeBuildingsRow(ctx, a, b, side, xm + 5, { heights: st.heights, billboards: st.billboards, bbP: 0.08 });
    placeBuildingsRow(ctx, a, b, side, xm + 20, { shops: false, heights: st.backHeights || [18, 45], wmin: 10, wmax: 22, gap: 6 });
  },
  bridge(ctx, a, b, side, xIn) {
    const st = ctx.stage;
    const xm = xIn((a + b) / 2);
    PR.parapet(ctx, a, b, side, xm + 0.05, 0.9);
    PR.railing(ctx, a, b, side, xm + 0.25, 1.4, { h0: 0.9, color: st.railColor || [0.75, 0.75, 0.72], post: 2 });
    lampsAlong(ctx, a, b, side, (s) => xIn(s) + 0.3, { h0: 0.9, h: 9, color: [0.7, 0.72, 0.74] });
    if (st.boats) for (let i = 0; i < 2; i++) if (ctx.rng.chance(0.5)) ctx.world.landmarks.boat(ctx, ctx.rng.range(a, b), side, xm + ctx.rng.range(20, 260), st.boats);
  },
  gore(ctx, a, b, side, xIn) {
    // the grassy wedge between the two branches of a fork
    const st = ctx.stage;
    const rng = ctx.rng;
    const tr = ctx.track;
    for (let s = Math.max(a, 50); s < b; s += rng.range(3, 7)) {
      // how wide the wedge is here: the branches separate roughly with k*s^2
      const wedge = Math.min(60, 0.0033 * s * s);
      if (wedge < 3) continue;
      const xx = tr.halfWAt(s) + 1.5 + rng.next() * (wedge - 1.5);
      const p = ctx.P(s, side * xx, 0, true);
      const name = rng.weighted({ bush0: 4, bougain0: 2, kash0: 1, palm0: wedge > 14 ? 0.6 : 0, krishnachura0: wedge > 20 ? 0.4 : 0 });
      ctx.sprites.add(name, p[0], p[1], p[2], rng.range(0.7, 1.1), { lamp: 0.5, flip: rng.chance(0.5) });
      ctx.obstacle(s, side * xx, 0.5, 0.5, name.startsWith('palm') || name.startsWith('krish') ? 'solid' : 'soft');
    }
  },
  median(ctx, a, b, side, xIn) {
    const st = ctx.stage;
    const mw = medianW(st);
    // gaps in the divider where a wrong-side run lets you back in
    // the divider is a low kerb with hedges you can cross anywhere (no gaps needed, no lamps on it)
    const gaps = [];
    const pieces = [[a, b]];
    for (const [g0, g1] of gaps) {
      for (let i = pieces.length - 1; i >= 0; i--) {
        const [p0, p1] = pieces[i];
        if (g1 <= p0 || g0 >= p1) continue;
        pieces.splice(i, 1);
        if (g0 > p0) pieces.push([p0, g0]);
        if (g1 < p1) pieces.push([g1, p1]);
      }
      // asphalt across the median + chevron boards at both ends
      const ga = Math.max(a, g0), gb = Math.min(b, g1);
      if (gb > ga) ctx.roadGeos.push(buildRoadStrip(ctx.track, ga, gb, (s) => xIn(s) - 0.3, (s) => xIn(s) + mw + 0.3, (s) => xIn(s) + mw / 2, () => mw / 2, () => 1));
      for (const gs of []) {
        if (gs < a || gs >= b) continue;
        const p = ctx.P(gs, xIn(gs) + mw / 2, 0.2);
        ctx.B.fx.box(p[0], p[1], p[2], 0.25, 1.1, mw - 0.4, ctx.track.yawAt(gs), { color: [1, 1, 1], region: ctx.fx.get('chevron') });
      }
    }
    for (const [pa, pb] of pieces) medianPiece(ctx, pa, pb, xIn, mw, st);
    // opposite carriageway road surface
    const oh = oppHalf(st);
    const geo = buildRoadStrip(ctx.track, a, b, (s) => xIn(s) + mw - 0.3, (s) => xIn(s) + mw + oh * 2 + 0.3,
      (s) => xIn(s) + mw + oh, () => oh, () => st.lanes);
    ctx.roadGeos.push(geo);
    if (st.metro) PR.metroViaduct(ctx, a, b, xIn((a + b) / 2) + mw / 2);
    // the far side
    const farType = ctx.track.sectionAt((a + b) / 2).far || st.far || 'city';
    const fx = (s) => xIn(s) + mw + oh * 2;
    if (SIDES[farType]) SIDES[farType](ctx, a, b, 1, fx, true);
    ctx.farType = farType;
    ctx.farX = fx((a + b) / 2);
  },
  stadium(ctx, a, b, side, xIn) {
    SIDES.city(ctx, a, b, side, xIn);
  },
  gapCity(ctx, a, b, side, xIn) {
    // under a jump: the city, at street level
    const st = ctx.stage;
    const xm = xIn((a + b) / 2);
    placeBuildingsRow(ctx, a, b, side, xm + 6, { heights: st.heights, billboards: st.billboards, bbP: 0.1 });
    placeBuildingsRow(ctx, a, b, side, xm + 36, { shops: false, heights: st.backHeights || [18, 45], wmin: 10, wmax: 22, gap: 6 });
  },
  interior(ctx, a, b, side, xIn) {
    // inside a building: the env builder handles everything
  },
  open(ctx, a, b, side, xIn) {
    const xm = xIn((a + b) / 2);
    trees(ctx, a, b, side, xm + 10, xm + 100, 0.02, ctx.stage.trees);
  },
};

// ----------------------------------------------------------------- the chunk

export function buildChunk(world, track, ci) {
  const ctx = new ChunkCtx(world, track, ci);
  ctx.roadGeos = [];
  const { s0, s1 } = ctx;
  if (s1 <= s0) return null;
  const st = ctx.stage;

  // main road surface
  const secRuns = sectionRuns(track, s0, s1);
  for (const [a, b] of secRuns) {
    ctx.roadGeos.push(buildRoadStrip(track, a, b,
      (s) => -track.halfWAt(s) - 0.35, (s) => track.halfWAt(s) + 0.35,
      () => 0, (s) => track.halfWAt(s), (s) => track.lanesAt(s)));
  }

  // split range into runs of constant side types
  const runs = [];
  let a = s0;
  let curL = ctx.sideType(s0 + 0.01, -1), curR = ctx.sideType(s0 + 0.01, 1);
  for (let s = s0 + STEP; s <= s1; s += STEP) {
    const L = ctx.sideType(Math.min(s, s1 - 0.01), -1), R = ctx.sideType(Math.min(s, s1 - 0.01), 1);
    if (L !== curL || R !== curR || s >= s1) {
      runs.push([a, Math.min(s, s1), curL, curR]);
      a = s;
      curL = L; curR = R;
    }
  }
  if (a < s1 - 0.5) runs.push([a, s1, curL, curR]);

  for (const [ra, rb, L, R] of runs) {
    const xL = (s) => track.halfWAt(s);
    if (SIDES[L]) SIDES[L](ctx, ra, rb, -1, xL);
    if (SIDES[R]) SIDES[R](ctx, ra, rb, 1, xL);
    if (track.sectionAt((ra + rb) / 2).noGround) continue;
    buildGround(ctx, ra, rb, -1, L, track.halfWAt((ra + rb) / 2) + 0.2);
    if (R === 'median') {
      const fx = farX(ctx, (ra + rb) / 2);
      const farType = track.sectionAt((ra + rb) / 2).far || st.far || 'city';
      // ground under median + opposite road, then the far side's own profile
      groundSpan(ctx, ra, rb, 1, track.halfWAt((ra + rb) / 2) - 0.5, fx + 0.4, -0.03, GROUND.city[0]);
      buildGround(ctx, ra, rb, 1, farType, fx + 0.4);
    } else {
      buildGround(ctx, ra, rb, 1, R, track.halfWAt((ra + rb) / 2) + 0.2);
    }
  }

  // elevated deck structure
  for (const [a, b, sec] of secRuns) {
    if (sec.noDeck) continue;
    const eMid = track.elevAt((a + b) / 2);
    if (eMid > 0.8 || track.elevAt(a) > 0.8 || track.elevAt(b) > 0.8) buildDeck(ctx, a, b);
  }

  // stage features & landmarks within this chunk
  world.populateChunk(ctx);

  return finalize(world, ctx);
}

function buildDeck(ctx, s0, s1) {
  const track = ctx.track;
  const conc = ctx.misc.get('concrete_smooth');
  const B = ctx.B.misc;
  const st = ctx.stage;
  const hasMedian = (s) => ctx.sideType(s, 1) === 'median';
  const right = (s) => (hasMedian(s) ? farX(ctx, s) : track.halfWAt(s)) + 0.4;
  const left = (s) => -track.halfWAt(s) - 0.4;
  PR.ribbon(ctx, B, s0, s1, (s) => [left(s), -0.05], (s) => [left(s), -1.6], conc, [0.8, 0.79, 0.76], { facing: (s) => PR.sideDir(ctx, s, -1), tileS: 4 });
  PR.ribbon(ctx, B, s0, s1, (s) => [right(s), -0.05], (s) => [right(s), -1.6], conc, [0.8, 0.79, 0.76], { facing: (s) => PR.sideDir(ctx, s, 1), tileS: 4 });
  PR.ribbon(ctx, B, s0, s1, (s) => [left(s), -1.6], (s) => [right(s), -1.6], conc, [0.55, 0.54, 0.52], { facing: [0, -1, 0], tileS: 4 });
  const sp = st.pillarSpacing || 32;
  for (let s = Math.ceil(s0 / sp) * sp; s < s1; s += sp) {
    const el = track.elevAt(s);
    if (el < 2) continue;
    const yaw = track.yawAt(s);
    const xs = hasMedian(s) ? [0, farX(ctx, s) - oppHalf(st)] : [0];
    for (const x of xs) {
      const p = ctx.P(s, x, 0, true);
      B.box(p[0], p[1] - 1, p[2], 2.2, el - 0.6, 2.2, yaw, { color: [0.82, 0.81, 0.78], region: conc, tile: [3, 3] });
      const cap = ctx.P(s, x, -2.6);
      B.box(cap[0], cap[1], cap[2], Math.min(14, track.halfWAt(s) * 2), 1.2, 2.6, yaw, { color: [0.8, 0.79, 0.76], region: conc, tile: [3, 3] });
    }
    if (st.bridgeTruss) {
      // steel truss under the deck (Padma style)
      for (const side of [-1, 1]) {
        const x = side * (track.halfWAt(s) + 0.2);
        const a1 = ctx.P(s, x, -1.6), b1 = ctx.P(s + sp * 0.5, x, -7.5), c1 = ctx.P(s + sp, x, -1.6);
        B.tube(a1, b1, 0.25, 0.25, 4, [0.55, 0.42, 0.3], ctx.misc.get('rust'));
        B.tube(b1, c1, 0.25, 0.25, 4, [0.55, 0.42, 0.3], ctx.misc.get('rust'));
        const d1 = ctx.P(s, x, -7.5), e1 = ctx.P(s + sp, x, -7.5);
        B.tube(d1, e1, 0.25, 0.25, 4, [0.55, 0.42, 0.3], ctx.misc.get('rust'));
      }
    }
  }
}

function finalize(world, ctx) {
  const M = world.mats;
  const group = new THREE.Group();
  const track = ctx.track;
  const addB = (B, mat) => {
    if (B.empty) return null;
    const m = new THREE.Mesh(B.build(), mat);
    group.add(m);
    return m;
  };
  for (const g of ctx.roadGeos) group.add(new THREE.Mesh(g, track.roadMat));
  addB(ctx.B.ground, M.ground);
  addB(ctx.B.world, M.facade);
  addB(ctx.B.misc, M.misc);
  addB(ctx.B.sign, M.sign);
  addB(ctx.B.lamp, M.lamp);
  addB(ctx.B.neon, M.neon);
  addB(ctx.B.always, M.always);
  addB(ctx.B.fx, M.fx);
  addB(ctx.B.fx2, M.fxDouble);
  if (!ctx.W.empty) group.add(new THREE.LineSegments(ctx.W.build(), M.wire));
  const sp = ctx.sprites.build(M.sprite);
  if (sp) group.add(sp);
  for (const w of ctx.water) {
    const geo = waterStrip(ctx, w);
    if (geo) group.add(new THREE.Mesh(geo, track.waterMat || M.water));
  }
  for (const e of ctx.extra) group.add(e);
  return { group, obstacles: ctx.obstacles, s0: ctx.s0, s1: ctx.s1, dynamic: ctx.dynamic || [], emitters: ctx.emitters || [] };
}

function waterStrip(ctx, w) {
  const pos = [], idx = [];
  const ds = 10;
  const n = Math.max(1, Math.ceil((w.s1 - w.s0) / ds));
  for (let i = 0; i <= n; i++) {
    const s = w.s0 + ((w.s1 - w.s0) * i) / n;
    const a = ctx.P(s, w.side * w.xa, w.y, true);
    const b = ctx.P(s, w.side * w.xb, w.y, true);
    pos.push(...a, ...b);
    if (i > 0) {
      const p = (i - 1) * 2, v = i * 2;
      if (w.side < 0) idx.push(p, v, p + 1, p + 1, v, v + 1);
      else idx.push(p, p + 1, v, p + 1, v + 1, v);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
