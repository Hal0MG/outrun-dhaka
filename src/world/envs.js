// Set-piece environments. A track section can carry `env` (what gets built
// around the road) and `surface` (what you drive on). Builders are called per
// chunk for the part of the section inside that chunk, in road space.
//
//   METRO DASH   closure -> station stairs -> concourse -> platform -> rails ->
//                unfinished extension -> jump -> AARAAM clothing store -> jump
//   MALL CRAWL   mall front -> atrium -> spiral ramp -> cinema lobby -> cinema ->
//                through the screen -> flyover
//   FUTURE PARK  park gate -> rides -> roller coaster -> back onto 300 Feet

import { ribbon, sideDir } from './props.js';
import * as PR from './props.js';
import { LANE_W } from './track.js';
import { buildRoadStrip } from './road.js';

// ------------------------------------------------------------------ helpers
const hwAt = (ctx) => (s) => ctx.track.halfWAt(s);

function wall(ctx, B, a, b, side, x, h0, h1, region, color, opts = {}) {
  ribbon(ctx, B, a, b, (s) => [side * x(s), h0, opts.ground], (s) => [side * x(s), h1, opts.ground], region, color,
    { facing: (s) => sideDir(ctx, s, opts.out ? side : -side), tileS: opts.tileS || 6, tileU: opts.tileU || 1, ds: opts.ds || 4 });
}

function slab(ctx, B, a, b, x0, x1, h, region, color, opts = {}) {
  ribbon(ctx, B, a, b, (s) => [x0(s), h, opts.ground], (s) => [x1(s), h, opts.ground], region, color,
    { facing: opts.down ? [0, -1, 0] : [0, 1, 0], tileS: opts.tileS || 4, tileU: opts.tileU || 1, ds: opts.ds || 4 });
}

// a box standing on the road at (s, x), yawed with the road
function rbox(ctx, B, s, x, h, w, ht, d, opts) {
  const p = ctx.P(s, x, h, opts.ground);
  B.box(p[0], p[1], p[2], w, ht, d, ctx.track.yawAt(s) + (opts.yaw || 0), opts);
}

function lightStrip(ctx, a, b, x, h, col, B) {
  // tube lights: dimmed so bloom does not turn them into searchlights
  const c = col.map((v) => Math.min(0.3, v * 0.12));
  ribbon(ctx, B || ctx.B.always, a, b, (s) => [x - 0.12, h], (s) => [x + 0.12, h], null, c, { facing: [0, -1, 0], ds: 6 });
}

function crowd(ctx, a, b, x0, x1, n, names, h = 0) {
  for (let i = 0; i < n; i++) {
    const s = ctx.rng.range(a, b);
    const x = ctx.rng.range(x0, x1);
    const p = ctx.P(s, x, h + 0.02);
    ctx.sprites.add(ctx.rng.pick(names), p[0], p[1], p[2], ctx.rng.range(0.92, 1.06), { lamp: 1, flip: ctx.rng.chance(0.5) });
  }
}

// people standing in the road who will bounce if you hit them
function pedSpot(ctx, s, x, kind = 'commuter', opts = {}) {
  ctx.peds = ctx.peds || [];
  ctx.peds.push({ s, x, kind, h: opts.h ?? 0, cross: opts.cross ?? 0, face: opts.face ?? 0 });
}

const inSec = (sec, a, b, s) => s >= Math.max(a, sec.s0) && s < Math.min(b, sec.s1);

// ------------------------------------------------------------------ surfaces
export const SURFACES = {
  none() {},
  stairs(ctx, a, b) {
    const hw = hwAt(ctx);
    slab(ctx, ctx.B.fx, a, b, (s) => -hw(s) - 0.3, (s) => hw(s) + 0.3, 0, ctx.fx.get('stairs'), [1, 1, 1], { tileS: 1.4, tileU: 1 });
  },
  tiles(ctx, a, b) {
    const hw = hwAt(ctx);
    slab(ctx, ctx.B.fx, a, b, (s) => -hw(s) - 0.3, (s) => hw(s) + 0.3, 0, ctx.fx.get('mrt_floor'), [1, 1, 1], { tileS: 4, tileU: 4 });
  },
  store(ctx, a, b) {
    const hw = hwAt(ctx);
    slab(ctx, ctx.B.fx, a, b, (s) => -hw(s) - 0.6, (s) => hw(s) + 0.6, 0, ctx.fx.get('store_floor'), [1, 1, 1], { tileS: 3, tileU: 4 });
  },
  mall(ctx, a, b) {
    const hw = hwAt(ctx);
    slab(ctx, ctx.B.fx, a, b, (s) => -hw(s) - 0.4, (s) => hw(s) + 0.4, 0, ctx.fx.get('mall_floor'), [1, 1, 1], { tileS: 4, tileU: 3 });
  },
  carpet(ctx, a, b) {
    const hw = hwAt(ctx);
    slab(ctx, ctx.B.fx, a, b, (s) => -hw(s) - 0.4, (s) => hw(s) + 0.4, 0, ctx.fx.get('carpet'), [1, 1, 1], { tileS: 2, tileU: 5 });
  },
  plaza(ctx, a, b) {
    const hw = hwAt(ctx);
    slab(ctx, ctx.B.misc, a, b, (s) => -hw(s) - 0.4, (s) => hw(s) + 0.4, 0, ctx.misc.get('sidewalk'), [0.95, 0.9, 0.85], { tileS: 3, tileU: 5 });
  },
  rail(ctx, a, b) {
    // concrete track bed, two tracks, sleepers in the texture, steel rails on top
    const hw = hwAt(ctx);
    slab(ctx, ctx.B.fx, a, b, (s) => -hw(s) - 0.3, (s) => hw(s) + 0.3, 0, ctx.fx.get('railbed'), [1, 1, 1], { tileS: 4, tileU: 2 });
    const metal = ctx.misc.get('metal');
    for (const c of [-LANE_W / 2, LANE_W / 2]) {
      for (const r of [-0.72, 0.72]) {
        const x = c + r;
        ribbon(ctx, ctx.B.misc, a, b, () => [x - 0.04, 0.16], () => [x + 0.04, 0.16], metal, [0.85, 0.86, 0.88], { ds: 4 });
        ribbon(ctx, ctx.B.misc, a, b, () => [x - 0.04, 0.0], () => [x - 0.04, 0.16], metal, [0.4, 0.4, 0.42], { facing: (s) => sideDir(ctx, s, -1), ds: 4 });
      }
    }
  },
  coaster(ctx, a, b) {
    const hw = hwAt(ctx);
    slab(ctx, ctx.B.fx, a, b, (s) => -hw(s) - 0.1, (s) => hw(s) + 0.1, 0, ctx.fx.get('coaster'), [1, 1, 1], { tileS: 1.2, tileU: 1, ds: 3 });
    // the slab's underside so it reads from below
    slab(ctx, ctx.B.misc, a, b, (s) => -hw(s) - 0.1, (s) => hw(s) + 0.1, -0.5, ctx.misc.get('metal'), [0.5, 0.15, 0.15], { down: true, ds: 3 });
    for (const side of [-1, 1]) {
      ribbon(ctx, ctx.B.fx, a, b, (s) => [side * (hw(s) + 0.1), -0.5], (s) => [side * (hw(s) + 0.1), 0.35], ctx.fx.get('white'), [0.9, 0.12, 0.14], { facing: (s) => sideDir(ctx, s, side), ds: 3 });
    }
  },
};

// ------------------------------------------------------------------ METRO DASH
export const ENVS = {
  closure(ctx, a, b, sec) {
    // the road narrows into the station stairs; barriers either side
    const hw = hwAt(ctx);
    for (const side of [-1, 1]) {
      wall(ctx, ctx.B.fx, a, b, side, (s) => hw(s) + 0.25, 0, 1.2, ctx.fx.get('roadclosed'), [1, 1, 1], { tileS: 5.2 });
      for (let s = Math.ceil(a / 7) * 7; s < b; s += 7) {
        const p = ctx.P(s, side * (hw(s) + 0.5), 0);
        ctx.B.misc.cylinder(p[0], p[1], p[2], 0.25, 0.05, 0.9, 8, [1, 0.45, 0.05], ctx.misc.get('white'));
      }
    }
    if (inSec(sec, a, b, sec.s0 + 6)) {
      // big signs either side
      for (const side of [-1, 1]) {
        const s = sec.s0 + 6;
        rbox(ctx, ctx.B.fx, s, side * (ctx.track.halfWAt(s) + 3), 0, 0.2, 2.2, 5, { region: ctx.fx.get('roadclosed'), color: [1, 1, 1], yaw: Math.PI / 2 });
      }
    }
    if (inSec(sec, a, b, sec.s1 - 2)) stationShell(ctx, sec.s1);
  },

  station(ctx, a, b, sec) {
    const hw = hwAt(ctx);
    const H = sec.ceiling ?? 5.2;
    const wallReg = ctx.fx.get('mrt_wall');
    for (const side of [-1, 1]) {
      wall(ctx, ctx.B.fx, a, b, side, (s) => hw(s) + 0.4, -0.2, H, wallReg, [1, 1, 1], { tileS: 10 });
      // handrails
      ribbon(ctx, ctx.B.misc, a, b, (s) => [side * (hw(s) + 0.2), 0.95], (s) => [side * (hw(s) + 0.2), 1.02], ctx.misc.get('metal'), [0.8, 0.82, 0.85], { facing: (s) => sideDir(ctx, s, -side), ds: 4 });
      // the outer shell of the building
      wall(ctx, ctx.B.misc, a, b, side, (s) => hw(s) + 7, 0, 16, ctx.misc.get('concrete_smooth'), [0.88, 0.88, 0.86], { ground: true, out: true, tileS: 8 });
      slab(ctx, ctx.B.misc, a, b, side < 0 ? (s) => -hw(s) - 7 : (s) => hw(s) + 0.4, side < 0 ? (s) => -hw(s) - 0.4 : (s) => hw(s) + 7, H, ctx.misc.get('concrete_smooth'), [0.7, 0.7, 0.68]);
    }
    slab(ctx, ctx.B.misc, a, b, (s) => -hw(s) - 0.4, (s) => hw(s) + 0.4, H, ctx.misc.get('concrete_smooth'), [0.75, 0.75, 0.74], { down: true });
    slab(ctx, ctx.B.misc, a, b, (s) => -hw(s) - 7, (s) => hw(s) + 7, 16 - ctx.track.elevAt((a + b) / 2), ctx.misc.get('concrete_smooth'), [0.66, 0.66, 0.64], { tileS: 8 });
    for (const x of [-2.4, 2.4]) lightStrip(ctx, a, b, x, H - 0.05, [2.2, 2.3, 2.4]);
    const rng = ctx.rng;
    if (sec.surface === 'tiles') {
      // the ticket gates: a row across the hall, every gate a breakable
      const gs = sec.s0 + (sec.gateAt ?? 34);
      if (gs >= a && gs < b) {
        const w = ctx.track.halfWAt(gs);
        for (let x = -w + 0.6; x <= w - 0.4; x += 1.25) ctx.breakable('gate', gs, x, { hw: 0.25, hl: 0.7, ht: 1.1, mass: 0.03, score: 150 });
        rbox(ctx, ctx.B.fx, gs - 6, -w - 0.2, 2.6, 0.1, 0.8, 3.0, { region: ctx.fx.get('mrt_gate'), color: [1, 1, 1], yaw: Math.PI / 2 });
      }
      // commuters, ticket machines, a kiosk
      for (let s = Math.max(a, sec.s0 + 8); s < Math.min(b, sec.s1 - 6); s += rng.range(6, 11)) {
        const w = ctx.track.halfWAt(s);
        pedSpot(ctx, s, rng.range(-w + 1, w - 1), 'commuter', { cross: rng.chance(0.5) ? rng.sign() * 1.2 : 0 });
        if (rng.chance(0.4)) pedSpot(ctx, s + 2, rng.range(-w + 1, w - 1), 'commuter');
      }
      for (let s = Math.ceil(a / 15) * 15; s < b; s += 15) {
        for (const side of [-1, 1]) rbox(ctx, ctx.B.fx, s, side * (ctx.track.halfWAt(s) - 0.2), 0, 0.8, 1.7, 0.6, { region: ctx.fx.get('mrt_gate'), color: [0.9, 0.95, 1] });
      }
    } else {
      // stairs: people running both ways
      for (let s = a + rng.range(2, 8); s < b; s += rng.range(7, 12)) pedSpot(ctx, s, rng.range(-ctx.track.halfWAt(s) + 0.8, ctx.track.halfWAt(s) - 0.8), 'commuter');
    }
  },

  platform(ctx, a, b, sec) {
    const hw = hwAt(ctx);
    const rng = ctx.rng;
    // canopy on columns
    for (let s = Math.ceil(a / 12) * 12; s < b; s += 12) {
      for (const side of [-1, 1]) {
        const p = ctx.P(s, side * (hw(s) + 0.5), 0);
        ctx.B.misc.box(p[0], p[1], p[2], 0.35, 6.2, 0.35, ctx.track.yawAt(s), { color: [0.9, 0.9, 0.92], region: ctx.misc.get('metal') });
      }
    }
    slab(ctx, ctx.B.misc, a, b, (s) => -hw(s) - 4, (s) => hw(s) + 4, 6.2, ctx.misc.get('metal'), [0.85, 0.86, 0.9], { down: true, tileS: 6 });
    slab(ctx, ctx.B.misc, a, b, (s) => -hw(s) - 4, (s) => hw(s) + 4, 6.3, ctx.misc.get('metal'), [0.7, 0.72, 0.76], { tileS: 6 });
    for (const x of [-2.6, 2.6]) lightStrip(ctx, a, b, x, 6.15, [2.4, 2.4, 2.3]);
    // yellow tactile strips on both edges, low platform walls
    for (const side of [-1, 1]) {
      slab(ctx, ctx.B.fx, a, b, side < 0 ? (s) => -hw(s) - 0.3 : (s) => hw(s) - 0.5, side < 0 ? (s) => -hw(s) + 0.5 : (s) => hw(s) + 0.3, 0.01, ctx.fx.get('platform_edge'), [1, 1, 1], { tileS: 1 });
      wall(ctx, ctx.B.misc, a, b, side, (s) => hw(s) + 0.3, -1.2, 0.0, ctx.misc.get('concrete_smooth'), [0.8, 0.8, 0.78], { tileS: 4 });
    }
    // the train waiting on the other track (you are not getting on it)
    const tx = -(ctx.track.halfWAt((a + b) / 2) + 2.2);
    const mrt = ctx.misc.get('mrt_side');
    ribbon(ctx, ctx.B.misc, a, b, () => [tx + 1.45, -1.0], () => [tx + 1.45, 2.9], mrt, [1, 1, 1], { facing: (s) => sideDir(ctx, s, 1), tileS: 20, ds: 4 });
    slab(ctx, ctx.B.misc, a, b, () => tx - 1.45, () => tx + 1.45, 2.9, ctx.misc.get('metal'), [0.9, 0.9, 0.9]);
    // commuters waiting
    for (let s = a + rng.range(2, 6); s < b - 4; s += rng.range(5, 9)) {
      const w = ctx.track.halfWAt(s);
      pedSpot(ctx, s, rng.range(-w + 0.7, w - 0.7), 'commuter', { cross: rng.chance(0.3) ? rng.sign() * 1.4 : 0 });
    }
    crowd(ctx, a, b, -ctx.track.halfWAt(a) - 1.2, -ctx.track.halfWAt(a) - 0.5, Math.floor((b - a) / 10), ['p_shirt', 'p_kameez', 'p_saree', 'p_panjabi']);
  },

  viaduct(ctx, a, b, sec) {
    // overhead line portals every 40 m
    const hw = hwAt(ctx);
    for (let s = Math.ceil(a / 40) * 40; s < b; s += 40) {
      for (const side of [-1, 1]) {
        const p = ctx.P(s, side * (hw(s) + 0.6), 0);
        ctx.B.misc.box(p[0], p[1], p[2], 0.3, 6.4, 0.3, ctx.track.yawAt(s), { color: [0.8, 0.8, 0.82], region: ctx.misc.get('metal') });
      }
      const q = ctx.P(s, 0, 6.2);
      ctx.B.misc.box(q[0], q[1], q[2], hw(s) * 2 + 1.5, 0.25, 0.3, ctx.track.yawAt(s), { color: [0.8, 0.8, 0.82], region: ctx.misc.get('metal') });
    }
    for (const x of [-LANE_W / 2, LANE_W / 2]) {
      ctx.W.seg(ctx.P(a, x, 5.6), ctx.P(b, x, 5.6), [0.15, 0.15, 0.15]);
    }
  },

  construction(ctx, a, b, sec) {
    // the extension that was supposed to open in 2019
    const hw = hwAt(ctx);
    const bamboo = ctx.misc.get('bamboo');
    for (let s = Math.ceil(a / 4) * 4; s < b; s += 4) {
      for (const side of [-1, 1]) {
        for (let k = 0; k < 2; k++) {
          const p = ctx.P(s, side * (hw(s) + 0.6 + k * 1.2), -12, true);
          ctx.B.misc.cylinder(p[0], ctx.track.groundAt(s), p[2], 0.07, 0.06, ctx.track.elevAt(s) + 8, 5, [0.85, 0.75, 0.45], bamboo);
        }
      }
    }
    for (const side of [-1, 1]) {
      for (const h of [2, 4.5, 7]) ribbon(ctx, ctx.B.misc, a, b, (s) => [side * (hw(s) + 0.6), h], (s) => [side * (hw(s) + 0.6), h + 0.12], bamboo, [0.85, 0.75, 0.45], { facing: (s) => sideDir(ctx, s, -side), ds: 4 });
    }
    // crane
    if (inSec(sec, a, b, sec.s0 + 10)) {
      const s = sec.s0 + 10;
      const base = ctx.P(s, 18, 0, true);
      ctx.B.misc.box(base[0], base[1], base[2], 1.6, 52, 1.6, ctx.track.yawAt(s), { color: [1, 0.75, 0.1], region: ctx.misc.get('metal') });
      const arm = ctx.P(s + 10, 4, 0, true);
      ctx.B.misc.box(arm[0], base[1] + 50, arm[2], 1.2, 1.2, 46, ctx.track.yawAt(s) + 0.6, { color: [1, 0.75, 0.1], region: ctx.misc.get('metal') });
      ctx.B.always.box(base[0], base[1] + 53, base[2], 0.5, 0.5, 0.5, 0, { color: [3, 0.2, 0.1] });
      rbox(ctx, ctx.B.fx, s, -(ctx.track.halfWAt(s) + 1.6), 1.2, 0.15, 2.2, 6, { region: ctx.fx.get('roadclosed'), color: [1, 1, 1], yaw: Math.PI / 2 });
    }
    // the ramp: planks propped on oil drums, full width
    const rs = sec.s1 - 9;
    if (rs >= a && rs < b) rampAt(ctx, rs, 0, ctx.track.halfWAt(rs) * 2 - 0.4, 8, 1.3, sec.jump);
  },

  gap(ctx, a, b, sec) {
    // nothing to drive on: just the street far below
    ctx.roadGeos.push(groundRoad(ctx, a, b));
  },

  store(ctx, a, b, sec) {
    const hw = hwAt(ctx);
    const H = 4.8;
    const rng = ctx.rng;
    const wx = (s) => hw(s) + 0.6;
    for (const side of [-1, 1]) {
      wall(ctx, ctx.B.fx, a, b, side, wx, 0, H, ctx.fx.get('store_wall'), [1, 1, 1], { tileS: 8 });
      // outer glass skin of the building
      wall(ctx, ctx.B.world, a, b, side, (s) => hw(s) + 2.5, 0, 26, ctx.facade.get('glass_blue'), [1, 1, 1], { ground: true, out: true, tileS: 12, tileU: 2 });
      slab(ctx, ctx.B.misc, a, b, side < 0 ? (s) => -hw(s) - 2.5 : wx, side < 0 ? (s) => -wx(s) : (s) => hw(s) + 2.5, -0.05, ctx.misc.get('concrete_smooth'), [0.6, 0.6, 0.58]);
    }
    slab(ctx, ctx.B.misc, a, b, (s) => -wx(s), wx, H, ctx.misc.get('concrete_smooth'), [0.92, 0.88, 0.8], { down: true });
    slab(ctx, ctx.B.misc, a, b, (s) => -hw(s) - 2.5, (s) => hw(s) + 2.5, 26 - ctx.track.elevAt((a + b) / 2) + (ctx.track.groundAt((a + b) / 2) - ctx.track.groundAt(a)), ctx.misc.get('concrete_smooth'), [0.5, 0.5, 0.5]);
    // warm light panels
    for (let s = Math.ceil(a / 6) * 6; s < b; s += 6) {
      for (const x of [-3, 0, 3]) {
        const p = ctx.P(s, x, H - 0.06);
        ctx.B.lamp.box(p[0], p[1], p[2], 1.0, 0.04, 1.0, ctx.track.yawAt(s), { color: [1.3, 1.15, 0.9] });
      }
    }
    // the faces of the building, with a car-shaped hole at each end
    for (const [fs, dir] of [[sec.s0, -1], [sec.s1, 1]]) if (fs >= a && fs < b + (dir > 0 ? 0.01 : 0)) holeFace(ctx, fs, hw(fs) + 2.5, hw(fs) + 0.6, H, 26, ctx.facade.get('glass_blue'), ctx.B.world);
    // glass at the way in and the way out
    for (const gs of [sec.s0 + 1.5, sec.s1 - 2.5]) {
      if (gs < a || gs >= b) continue;
      const w = ctx.track.halfWAt(gs) + 0.6;
      for (let x = -w + 0.7; x < w; x += 1.4) ctx.breakable('glass', gs, x, { hw: 0.7, hl: 0.4, ht: H, mass: 0.01, score: 100 });
      // the store sign above the entrance (seen from the rail line)
      if (gs < sec.s0 + 5) {
        rbox(ctx, ctx.B.fx, gs - 0.5, 0, H + 1, w * 2 + 3, 3.6, 0.3, { region: ctx.fx.get('store_sign'), color: [1, 1, 1] });
        rbox(ctx, ctx.B.fx, gs - 0.5, 0, H + 6.5, w * 2 - 2, 2.2, 0.25, { region: ctx.fx.get('eid_sale'), color: [1, 1, 1] });

      }
    }
    // racks, mannequins, tables, a cash counter: all of it is getting smashed
    for (let s = Math.max(a, sec.s0 + 9); s < Math.min(b, sec.s1 - 8); s += rng.range(4.5, 7)) {
      const w = ctx.track.halfWAt(s);
      const n = rng.int(2, 4);
      for (let i = 0; i < n; i++) {
        const x = rng.range(-w + 1, w - 1);
        const k = rng.weighted({ rack_saree: 4, rack_panjabi: 2.5, mannequin: 2, table: 2 });
        ctx.breakable(k, s + rng.range(-1, 1), x, { hw: k === 'mannequin' ? 0.35 : 1.0, hl: 0.4, ht: 1.9, mass: k === 'table' ? 0.05 : 0.025, score: 200, tint: k === 'rack_saree' ? rng.int(0, 5) : 0 });
      }
      if (rng.chance(0.45)) pedSpot(ctx, s + 2, rng.range(-w + 1, w - 1), 'shopper');
      if (rng.chance(0.35)) {
        // hanging EID SALE banners (double-sided)
        const p = ctx.P(s, rng.range(-2, 2), H - 1.2);
        ctx.B.fx2.box(p[0], p[1], p[2], 3.2, 0.8, 0.02, ctx.track.yawAt(s), { region: ctx.fx.get('eid_sale'), color: [1, 1, 1] });
      }
    }
    // ramp-less exit: the floor just ends at the far window
    const xs = sec.s1 - 1.2;
    if (xs >= a && xs < b) ctx.obstacle(xs, 0, ctx.track.halfWAt(xs) + 1, 1.2, 'ramp', { jump: sec.jump });
  },

  // ------------------------------------------------------------------ MALL CRAWL
  mallFront(ctx, a, b, sec) {
    const hw = hwAt(ctx);
    for (const side of [-1, 1]) {
      wall(ctx, ctx.B.fx, a, b, side, (s) => hw(s) + 0.25, 0, 1.0, ctx.fx.get('chevron'), [1, 1, 1], { tileS: 4 });
      PR.sidewalk(ctx, a, b, side, (s) => hw(s) + 0.3, 6);
    }
    if (inSec(sec, a, b, sec.s1 - 1)) mallShell(ctx, sec.s1);
    const rng = ctx.rng;
    for (let s = a + 3; s < b; s += rng.range(8, 14)) pedSpot(ctx, s, rng.range(-ctx.track.halfWAt(s) + 1, ctx.track.halfWAt(s) - 1), 'shopper', { cross: rng.sign() * 1.3 });
  },

  mallFloor(ctx, a, b, sec) {
    const hw = hwAt(ctx);
    const H = 6;
    const rng = ctx.rng;
    for (const side of [-1, 1]) wall(ctx, ctx.B.fx, a, b, side, (s) => hw(s) + 0.6, 0, H, ctx.fx.get('mall_shops'), [1, 1, 1], { tileS: 30 });
    slab(ctx, ctx.B.misc, a, b, (s) => -hw(s) - 0.6, (s) => hw(s) + 0.6, H, ctx.misc.get('concrete_smooth'), [0.92, 0.92, 0.9], { down: true });
    for (const x of [-3, 3]) lightStrip(ctx, a, b, x, H - 0.05, [2.4, 2.4, 2.3]);
    // entrance glass
    const gs = sec.s0 + 1.5;
    if (gs >= a && gs < b) { const w = ctx.track.halfWAt(gs) + 0.6; for (let x = -w + 0.7; x < w; x += 1.4) ctx.breakable('glass', gs, x, { hw: 0.7, hl: 0.4, ht: H, mass: 0.01, score: 100 }); }
    for (let s = Math.max(a, sec.s0 + 8); s < b - 3; s += rng.range(6, 10)) {
      const w = ctx.track.halfWAt(s);
      ctx.breakable(rng.pick(['kiosk', 'kiosk', 'table', 'popcorn']), s, rng.range(-w + 1.2, w - 1.2), { hw: 0.9, hl: 0.6, ht: 1.4, mass: 0.04, score: 250 });
      pedSpot(ctx, s + 3, rng.range(-w + 1, w - 1), 'shopper', { cross: rng.chance(0.5) ? rng.sign() * 1.2 : 0 });
    }
  },

  spiral(ctx, a, b, sec) {
    // the ramp spirals around the atrium; shops on the outside, a drop on the inside
    const hw = hwAt(ctx);
    const inner = Math.sign(sec.k || 1); // curvature > 0 turns right: the centre is to the right
    const outer = -inner;
    // ramp underside + edges
    slab(ctx, ctx.B.misc, a, b, (s) => -hw(s) - 0.6, (s) => hw(s) + 0.6, -0.6, ctx.misc.get('concrete_smooth'), [0.8, 0.8, 0.78], { down: true, ds: 2 });
    wall(ctx, ctx.B.misc, a, b, inner, (s) => hw(s) + 0.6, -0.6, 0, ctx.misc.get('concrete_smooth'), [0.85, 0.85, 0.83], { out: true, ds: 2 });
    // glass balustrade on the inner edge, brass rail
    wall(ctx, ctx.B.fx2, a, b, inner, (s) => hw(s) + 0.4, 0, 1.1, ctx.fx.get('glasspane'), [0.8, 0.9, 1], { ds: 2, tileS: 3 });
    ribbon(ctx, ctx.B.misc, a, b, (s) => [inner * (hw(s) + 0.4), 1.1], (s) => [inner * (hw(s) + 0.4), 1.18], ctx.misc.get('metal'), [1, 0.8, 0.4], { facing: (s) => sideDir(ctx, s, -inner), ds: 2 });
    // shopfronts on the outer wall, two storeys tall so the levels blur together
    wall(ctx, ctx.B.fx, a, b, outer, (s) => hw(s) + 0.8, -0.6, 7, ctx.fx.get('mall_shops'), [1, 1, 1], { tileS: 26, ds: 2 });
    for (let s = Math.ceil(a / 8) * 8; s < b; s += 8) {
      const p = ctx.P(s, outer * (hw(s) + 0.5), 5.8);
      ctx.B.lamp.box(p[0], p[1], p[2], 0.5, 0.08, 2.0, ctx.track.yawAt(s), { color: [1.3, 1.2, 1.0] });
    }
    const rng = ctx.rng;
    for (let s = a + rng.range(4, 10); s < b; s += rng.range(14, 22)) {
      const w = ctx.track.halfWAt(s);
      if (rng.chance(0.6)) pedSpot(ctx, s, rng.range(-w + 1, w - 1), 'shopper', { cross: rng.sign() * 1.0 });
      else ctx.breakable(rng.pick(['kiosk', 'popcorn', 'table']), s, rng.range(-w + 1.2, w - 1.2), { hw: 0.8, hl: 0.6, ht: 1.4, mass: 0.04, score: 250 });
    }
    // the atrium itself is built once, around the helix centre
    if (inSec(sec, a, b, sec.s0 + 0.5)) atrium(ctx, sec);
  },

  cinemaLobby(ctx, a, b, sec) {
    const hw = hwAt(ctx);
    const H = 6.5;
    for (const side of [-1, 1]) wall(ctx, ctx.B.fx, a, b, side, (s) => hw(s) + 0.6, 0, H, ctx.fx.get('velvet'), [0.9, 0.8, 0.8], { tileS: 3, tileU: 3 });
    slab(ctx, ctx.B.misc, a, b, (s) => -hw(s) - 0.6, (s) => hw(s) + 0.6, H, ctx.misc.get('concrete_smooth'), [0.3, 0.12, 0.14], { down: true });
    for (const x of [-2.8, 0, 2.8]) lightStrip(ctx, a, b, x, H - 0.05, [2.8, 2.0, 1.2], ctx.B.always);
    if (inSec(sec, a, b, sec.s0 + 4)) rbox(ctx, ctx.B.fx, sec.s0 + 4, 0, H - 2.2, ctx.track.halfWAt(sec.s0 + 4) * 2, 1.8, 0.3, { region: ctx.fx.get('marquee'), color: [1, 1, 1] });
    const rng = ctx.rng;
    for (let s = Math.max(a, sec.s0 + 10); s < b - 4; s += rng.range(5, 8)) {
      const w = ctx.track.halfWAt(s);
      ctx.breakable(rng.pick(['popcorn', 'popcorn', 'rope', 'rope']), s, rng.range(-w + 1, w - 1), { hw: 0.6, hl: 0.4, ht: 1.3, mass: 0.02, score: 150 });
      if (rng.chance(0.6)) pedSpot(ctx, s + 2, rng.range(-w + 1, w - 1), 'shopper');
    }
  },

  cinema(ctx, a, b, sec) {
    const hw = hwAt(ctx);
    const H = 9;
    for (const side of [-1, 1]) {
      wall(ctx, ctx.B.fx, a, b, side, (s) => hw(s) + 4, -3, H, ctx.fx.get('velvet'), [0.5, 0.25, 0.28], { tileS: 3, tileU: 4 });
      // the audience in the side blocks, mid-climax
      crowd(ctx, a, b, side * (hw((a + b) / 2) + 0.8), side * (hw((a + b) / 2) + 3.6), Math.floor((b - a) * 0.5), ['crowd0', 'crowd1', 'crowd2']);
    }
    slab(ctx, ctx.B.misc, a, b, (s) => -hw(s) - 4, (s) => hw(s) + 4, H, ctx.misc.get('concrete_smooth'), [0.12, 0.06, 0.08], { down: true });
    // rows of seats across your path
    for (let s = Math.ceil((a - sec.s0) / 4) * 4 + sec.s0 + 6; s < Math.min(b, sec.s1 - 14); s += 4) {
      const w = ctx.track.halfWAt(s);
      for (let x = -w + 1.2; x < w - 0.6; x += 2.4) ctx.breakable('seatrow', s, x, { hw: 1.2, hl: 0.4, ht: 1.0, mass: 0.02, score: 120 });
    }
    // the back wall of the building, with your exit in it
    if (sec.s1 - 0.5 >= a && sec.s1 - 0.5 < b) holeFace(ctx, sec.s1 - 0.5, hw(sec.s1) + 30, hw(sec.s1) + 1.5, 7, 40, ctx.facade.get('glass_green'), ctx.B.world);
    // the screen: smash straight through it
    const ss = sec.s1 - 3;
    if (ss >= a && ss < b) {
      ctx.breakable('screen', ss, 0, { hw: hw(ss) + 4, hl: 0.5, ht: 8, mass: 0.0, score: 2000 });
      ctx.obstacle(ss - 4, 0, hw(ss), 1.5, 'ramp', { jump: sec.jump });
      rbox(ctx, ctx.B.misc, ss - 6, 0, 0, hw(ss) * 2, 1.0, 4, { region: ctx.misc.get('wood'), color: [0.5, 0.2, 0.15] });
    }
  },

  // ------------------------------------------------------------------ FUTURE PARK
  parkGate(ctx, a, b, sec) {
    const hw = hwAt(ctx);
    for (const side of [-1, 1]) wall(ctx, ctx.B.misc, a, b, side, (s) => hw(s) + 0.4, 0, 2.6, ctx.misc.get('metal'), [0.4, 0.3, 0.7], { tileS: 3 });
    const gs = sec.s1 - 8;
    if (gs >= a && gs < b) {
      const w = ctx.track.halfWAt(gs);
      for (const side of [-1, 1]) rbox(ctx, ctx.B.misc, gs, side * (w + 1.2), 0, 1.6, 12, 1.6, { region: ctx.misc.get('metal'), color: [0.2, 0.6, 0.9] });
      rbox(ctx, ctx.B.fx, gs, 0, 10, w * 2 + 4, 3, 0.4, { region: ctx.fx.get('jfp_sign'), color: [1, 1, 1] });
      for (let x = -w + 0.8; x < w; x += 1.6) ctx.breakable('gate', gs + 4, x, { hw: 0.3, hl: 0.6, ht: 1.1, mass: 0.02, score: 150 });
    }
    const rng = ctx.rng;
    for (let s = a + 3; s < b; s += rng.range(8, 12)) pedSpot(ctx, s, rng.range(-ctx.track.halfWAt(s) + 1, ctx.track.halfWAt(s) - 1), 'park', { cross: rng.sign() * 1.4 });
  },

  park(ctx, a, b, sec) {
    const hw = hwAt(ctx);
    const rng = ctx.rng;
    // bulb strings along both sides
    for (const side of [-1, 1]) {
      for (let s = Math.ceil(a / 10) * 10; s < b; s += 10) {
        const p = ctx.P(s, side * (hw(s) + 1), 0);
        ctx.B.misc.box(p[0], p[1], p[2], 0.15, 4.5, 0.15, ctx.track.yawAt(s), { color: [0.9, 0.9, 0.9], region: ctx.misc.get('metal') });
      }
      ribbon(ctx, ctx.B.fx, a, b, (s) => [side * (hw(s) + 1), 4.0], (s) => [side * (hw(s) + 1), 4.3], ctx.fx.get('bulbs'), [1, 1, 1], { facing: (s) => sideDir(ctx, s, -side), tileS: 2, ds: 5 });
    }
    // food stalls and balloon sellers in the way
    for (let s = Math.max(a, sec.s0 + 10); s < b; s += rng.range(9, 15)) {
      const w = ctx.track.halfWAt(s);
      if (rng.chance(0.6)) ctx.breakable(rng.pick(['stall_fuchka', 'popcorn', 'kiosk']), s, rng.range(-w + 1.5, w - 1.5), { hw: 0.9, hl: 0.6, ht: 1.6, mass: 0.04, score: 250 });
      pedSpot(ctx, s + 4, rng.range(-w + 1, w - 1), 'park', { cross: rng.chance(0.6) ? rng.sign() * 1.3 : 0 });
    }
    crowd(ctx, a, b, -hw(a) - 8, -hw(a) - 2, Math.floor((b - a) * 0.15), ['crowd0', 'crowd1', 'crowd2', 'p_kameez', 'p_saree']);
    crowd(ctx, a, b, hw(a) + 2, hw(a) + 8, Math.floor((b - a) * 0.15), ['crowd0', 'crowd1', 'p_shirt', 'p_panjabi']);
    // the rides
    for (const r of sec.rides || []) {
      const s = sec.s0 + r.s;
      if (s >= a && s < b) ride(ctx, s, r);
    }
  },

  coaster(ctx, a, b, sec) {
    // red lattice supports down to the ground
    const hw = hwAt(ctx);
    for (let s = Math.ceil(a / 8) * 8; s < b; s += 8) {
      const el = ctx.track.elevAt(s);
      if (el < 1) continue;
      for (const side of [-1, 1]) {
        const p = ctx.P(s, side * (hw(s) - 0.3), 0, true);
        ctx.B.misc.box(p[0], p[1], p[2], 0.35, el - 0.4, 0.35, ctx.track.yawAt(s), { color: [0.85, 0.12, 0.14], region: ctx.misc.get('metal') });
      }
      if (el > 6) {
        const p = ctx.P(s, 0, -el * 0.5);
        ctx.B.misc.box(p[0], p[1], p[2], hw(s) * 2, 0.2, 0.2, ctx.track.yawAt(s), { color: [0.85, 0.12, 0.14], region: ctx.misc.get('metal') });
      }
    }
    // chain-lift lights
    if (sec.lift) for (let s = Math.ceil(a / 3) * 3; s < b; s += 3) { const p = ctx.P(s, 0, 0.06); ctx.B.always.box(p[0], p[1], p[2], 0.25, 0.04, 0.6, ctx.track.yawAt(s), { color: [3, 2.2, 0.4] }); }
    // crest ramps (air time)
    for (const c of sec.crests || []) {
      const s = sec.s0 + c.s;
      if (s >= a && s < b) ctx.obstacle(s, 0, hw(s) + 0.2, 1.4, 'ramp', { jump: c.jump });
    }
    if (sec.endRamp) { const s = sec.s1 - 3; if (s >= a && s < b) ctx.obstacle(s, 0, hw(s) + 0.2, 1.4, 'ramp', { jump: sec.endRamp }); }
  },
};

// ------------------------------------------------------------------ shells and big pieces

function stationShell(ctx, s) {
  // the front face of the station building with the stairs opening
  const T = ctx.track;
  const hw = T.halfWAt(s);
  const conc = ctx.misc.get('concrete_smooth');
  for (const side of [-1, 1]) rbox(ctx, ctx.B.misc, s, side * (hw + 4), 0, 7.6, 16, 0.8, { region: conc, color: [0.9, 0.9, 0.88], ground: true });
  rbox(ctx, ctx.B.misc, s, 0, 5.4, hw * 2 + 1, 10.6, 0.8, { region: conc, color: [0.9, 0.9, 0.88] });
  rbox(ctx, ctx.B.fx, s - 0.5, 0, 6.2, hw * 2 + 6, 2.0, 0.2, { region: ctx.fx.get('mrt_wall'), color: [1, 1, 1] });
  // a green stripe and the M sign
  rbox(ctx, ctx.B.always, s - 0.6, 0, 9, hw * 2 + 14, 0.4, 0.1, { color: [0.1, 1.2, 0.5] });
}

function mallShell(ctx, s) {
  const T = ctx.track;
  const hw = T.halfWAt(s);
  // a 20-storey glass box, the sign and a hole where the doors used to be
  for (const side of [-1, 1]) rbox(ctx, ctx.B.world, s, side * (hw + 20), 0, 38, 70, 1, { region: ctx.facade.get('glass_green'), color: [1, 1, 1], ground: true });
  rbox(ctx, ctx.B.world, s, 0, 6, hw * 2 + 2, 64, 1, { region: ctx.facade.get('glass_green'), color: [1, 1, 1] });
  rbox(ctx, ctx.B.fx, s - 0.6, 0, 7.2, hw * 2 + 12, 3, 0.3, { region: ctx.fx.get('mall_sign'), color: [1, 1, 1] });
  rbox(ctx, ctx.B.fx, s - 0.6, 0, 40, 34, 8, 0.3, { region: ctx.fx.get('mall_sign'), color: [1, 1, 1] });
}

function atrium(ctx, sec) {
  // a cylinder of shopfronts around the helix, a glass dome on top
  const T = ctx.track;
  const R = 1 / Math.abs(sec.k);
  const s0 = sec.s0 + 0.5;
  const c = ctx.P(s0, Math.sign(sec.k) * R, 0);
  const g = T.groundAt(s0);
  const H = (sec.elev || 20) + 12;
  const Rw = R + T.halfWAt(s0) + 1.2;
  const n = 48;
  const shops = ctx.fx.get('mall_shops');
  const B = ctx.B.fx;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const p0 = [c[0] + Math.cos(a0) * Rw, g, c[2] + Math.sin(a0) * Rw], p1 = [c[0] + Math.cos(a1) * Rw, g, c[2] + Math.sin(a1) * Rw];
    for (let lv = 0; lv < Math.ceil(H / 7); lv++) {
      const y0 = g + lv * 7, y1 = Math.min(g + H, y0 + 7);
      B.quad([p1[0], y0, p1[2]], [p0[0], y0, p0[2]], [p0[0], y1, p0[2]], [p1[0], y1, p1[2]], [((i % 6) + 1) / 6, 0, (i % 6) / 6, 1], [1, 1, 1], shops);
    }
  }
  // dome: spokes of glass with a lit ring
  const domeY = g + H;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    ctx.B.fx2.tri([c[0], domeY + 8, c[2]], [c[0] + Math.cos(a0) * Rw, domeY, c[2] + Math.sin(a0) * Rw], [c[0] + Math.cos(a1) * Rw, domeY, c[2] + Math.sin(a1) * Rw], [0.7, 0.85, 1], ctx.fx.get('glasspane'));
  }
  ctx.B.always.cylinder(c[0], domeY - 0.3, c[2], Rw - 0.3, Rw - 0.3, 0.3, 48, [1.6, 1.5, 1.2]);
  // the void: a fountain column and hanging banners
  ctx.B.misc.cylinder(c[0], g, c[2], 1.4, 1.4, H - 2, 16, [0.9, 0.9, 0.92], ctx.misc.get('marble'));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = R * 0.45;
    ctx.B.fx2.box(c[0] + Math.cos(a) * r, g + H - 9, c[2] + Math.sin(a) * r, 2.6, 6, 0.02, a + Math.PI / 2, { region: ctx.fx.get('eid_sale'), color: [1, 1, 1] });
  }
  // the floor of the atrium
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    ctx.B.fx.tri([c[0], g + 0.02, c[2]], [c[0] + Math.cos(a1) * Rw, g + 0.02, c[2] + Math.sin(a1) * Rw], [c[0] + Math.cos(a0) * Rw, g + 0.02, c[2] + Math.sin(a0) * Rw], [1, 1, 1], ctx.fx.get('mall_floor'), [[0.5, 0.5], [0.5 + Math.cos(a1) * 4, 0.5 + Math.sin(a1) * 4], [0.5 + Math.cos(a0) * 4, 0.5 + Math.sin(a0) * 4]]);
  }
}

function ride(ctx, s, r) {
  const B = ctx.B.misc;
  const metal = ctx.misc.get('metal');
  const p = ctx.P(s, r.side * r.dist, 0, true);
  const yaw = ctx.track.yawAt(s);
  if (r.type === 'wheel') {
    // Ferris wheel: two A-frames, the wheel spins (see world.dynamic)
    const R = r.r || 22;
    for (const dz of [-2, 2]) {
      const cx = p[0] + Math.sin(yaw) * dz, cz = p[2] - Math.cos(yaw) * dz;
      B.tube([cx - Math.cos(yaw) * 10, p[1], cz - Math.sin(yaw) * 10], [cx, p[1] + R + 2, cz], 0.5, 0.4, 6, [0.85, 0.85, 0.9], metal);
      B.tube([cx + Math.cos(yaw) * 10, p[1], cz + Math.sin(yaw) * 10], [cx, p[1] + R + 2, cz], 0.5, 0.4, 6, [0.85, 0.85, 0.9], metal);
    }
    ctx.dynamic = ctx.dynamic || [];
    ctx.rides = ctx.rides || [];
    ctx.rides.push({ type: 'wheel', pos: [p[0], p[1] + R + 2, p[2]], yaw, R });
  } else if (r.type === 'carousel') {
    B.cylinder(p[0], p[1], p[2], 9, 9, 0.6, 24, [0.9, 0.85, 0.6], ctx.misc.get('marble'));
    B.cylinder(p[0], p[1] + 5.5, p[2], 9.6, 0.4, 3.2, 24, [0.9, 0.2, 0.4], ctx.misc.get('white'));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      B.cylinder(p[0] + Math.cos(a) * 7.5, p[1] + 0.6, p[2] + Math.sin(a) * 7.5, 0.08, 0.08, 4.9, 5, [1, 0.85, 0.3], metal);
      ctx.B.always.box(p[0] + Math.cos(a) * 9.4, p[1] + 5.4, p[2] + Math.sin(a) * 9.4, 0.3, 0.3, 0.3, 0, { color: [3, 2.4, 0.6] });
    }
    ctx.rides = ctx.rides || [];
    ctx.rides.push({ type: 'carousel', pos: [p[0], p[1], p[2]] });
  } else if (r.type === 'ship') {
    B.tube([p[0] - Math.cos(yaw) * 6, p[1], p[2] - Math.sin(yaw) * 6], [p[0], p[1] + 16, p[2]], 0.4, 0.3, 6, [0.3, 0.5, 0.9], metal);
    B.tube([p[0] + Math.cos(yaw) * 6, p[1], p[2] + Math.sin(yaw) * 6], [p[0], p[1] + 16, p[2]], 0.4, 0.3, 6, [0.3, 0.5, 0.9], metal);
    ctx.rides = ctx.rides || [];
    ctx.rides.push({ type: 'ship', pos: [p[0], p[1] + 16, p[2]], yaw });
  } else if (r.type === 'tower') {
    B.box(p[0], p[1], p[2], 2.4, 48, 2.4, yaw, { color: [0.85, 0.85, 0.9], region: metal });
    for (let h = 4; h < 48; h += 4) ctx.B.always.box(p[0], p[1] + h, p[2], 2.5, 0.2, 2.5, yaw, { color: h % 8 ? [3, 0.4, 2] : [0.4, 2.4, 3] });
  }
}

// a building face across the road with a hole for the road at floor level
function holeFace(ctx, s, wOut, wHole, hHole, top, region, B) {
  const el = ctx.track.elevAt(s);
  // the two sides of the hole (full height from the ground)
  for (const side of [-1, 1]) {
    const w = wOut - wHole;
    rbox(ctx, B, s, side * (wHole + w / 2), -el, w, top, 0.5, { region, color: [1, 1, 1], tile: [8, 8] });
  }
  // below and above the hole
  if (el > 0.5) rbox(ctx, B, s, 0, -el, wHole * 2, el, 0.5, { region, color: [0.8, 0.8, 0.8], tile: [8, 8] });
  rbox(ctx, B, s, 0, hHole, wHole * 2, top - el - hHole, 0.5, { region, color: [1, 1, 1], tile: [8, 8] });
}

// a wooden ramp on oil drums; jump defines where you land
export function rampAt(ctx, s, x, w, len, h, jump) {
  const T = ctx.track;
  const B = ctx.B.fx;
  const reg = ctx.fx.get('ramp');
  const yaw = T.yawAt(s);
  const a0 = ctx.P(s - len / 2, x - w / 2, 0.02), b0 = ctx.P(s - len / 2, x + w / 2, 0.02);
  const a1 = ctx.P(s + len / 2, x - w / 2, h), b1 = ctx.P(s + len / 2, x + w / 2, h);
  B.quad(a0, b0, b1, a1, [0, 0, w / 3, 1], [1, 1, 1], reg);
  // sides and front face
  const c0 = ctx.P(s + len / 2, x - w / 2, 0), c1 = ctx.P(s + len / 2, x + w / 2, 0);
  B.quad(c1, c0, a1, b1, [0, 0, 1, 1], [0.7, 0.6, 0.5], reg);
  B.tri(a0, a1, c0, [0.6, 0.5, 0.4], reg);
  B.tri(b0, c1, b1, [0.6, 0.5, 0.4], reg);
  // drums underneath
  for (const dx of [-w / 2 + 0.4, w / 2 - 0.4]) {
    const p = ctx.P(s + len / 2 - 0.5, x + dx, 0);
    ctx.B.misc.cylinder(p[0], p[1], p[2], 0.32, 0.32, h - 0.1, 10, [0.15, 0.35, 0.7], ctx.misc.get('rust'));
  }
  ctx.obstacle(s, x, w / 2, len / 2, 'ramp', { jump, rh: h });
}

// a street at ground level under a jump
function groundRoad(ctx, a, b) {
  return roadAtGround(ctx, a, b, 7.2);
}

function roadAtGround(ctx, a, b, hw) {
  const T = ctx.track;
  // lower the strip by the elevation so it sits on the ground
  const geo = buildRoadStrip(T, a, b, () => -hw, () => hw, () => 0, () => hw, () => 4);
  const pos = geo.getAttribute('position');
  const STEPL = 2;
  for (let i = 0; i < pos.count; i++) {
    const s = Math.min(Math.floor(i / 2) * STEPL + Math.floor(a / STEPL) * STEPL, T.length);
    pos.setY(i, pos.getY(i) - T.elevAt(s));
  }
  pos.needsUpdate = true;
  geo.computeBoundingSphere();
  return geo;
}
