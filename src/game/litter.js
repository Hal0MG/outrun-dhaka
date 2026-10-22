// Road blemishes. Potholes and repair patches stay where they are (a pothole gives the car a bump); mud, dirt and
// litter (paper, bottles, wrappers, banana peel) lie about and scatter into the air when a racer drives through them.
// Scenery with a little feedback: nothing here ever stops a racer. Items live at a distance G along the whole route,
// like the traffic, and are laid down in fixed cells ahead of the player so the road is the same each time round.

import * as THREE from 'three';
import { RNG } from '../core/util.js';

const CELL = 12; // metres of road per cell
const AHEAD = 520, BEHIND = 40;
const MAX_DISC = 200, MAX_QUAD = 520, MAX_PUDDLE = 120;

const KINDS = { pothole: 3, patch: 1.2, dirt: 1.6, paper: 2.2, bottle: 1, wrapper: 1.6, peel: 0.8 };
const PAPER = [[0.95, 0.94, 0.86], [0.85, 0.82, 0.72], [0.9, 0.9, 0.95]];
const WRAP = [[0.9, 0.12, 0.15], [0.95, 0.75, 0.1], [0.2, 0.6, 0.95], [0.95, 0.3, 0.6], [0.2, 0.75, 0.35]];
const BOTTLE = [[0.35, 0.8, 0.95], [0.3, 0.75, 0.4], [0.9, 0.55, 0.2]];
const CHIPS = { dirt: [[0.45, 0.33, 0.2], [0.35, 0.26, 0.16]], paper: PAPER, bottle: BOTTLE, wrapper: WRAP, peel: [[0.95, 0.8, 0.2]] };

export class Litter {
  constructor(game) {
    this.game = game;
    const scene = game.scene;
    this.cells = new Map();
    this.hi = null;
    this.events = [];
    const flat = (geo) => geo.rotateX(-Math.PI / 2);
    const mat = () => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, depthWrite: false });
    const mk = (geo, n) => {
      const im = new THREE.InstancedMesh(geo, mat(), n);
      im.count = 0;
      im.frustumCulled = false;
      im.renderOrder = 2;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const white = new THREE.Color(1, 1, 1);
      for (let i = 0; i < n; i++) im.setColorAt(i, white);
      im.instanceColor.setUsage(THREE.DynamicDrawUsage);
      scene.add(im);
      return im;
    };
    this.discs = mk(flat(new THREE.CircleGeometry(1, 20)), MAX_DISC);
    this.quads = mk(flat(new THREE.PlaneGeometry(1, 1)), MAX_QUAD);
    // puddles: dark wet patches with a pale sheen of sky in them, faded in with the rain
    this.puddles = mk(flat(new THREE.CircleGeometry(1, 24)), MAX_PUDDLE * 2);
    this.puddles.material.transparent = true;
    this.puddles.material.opacity = 0;
    this.puddles.renderOrder = 3;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this._fr = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3() };
  }

  clear() {
    this.cells.clear();
    this.hi = null;
    this.events.length = 0;
    this.discs.count = this.quads.count = this.puddles.count = 0;
  }

  // lay down one cell of road
  generate(cell) {
    const race = this.game.race;
    const rng = new RNG(cell * 9301 + 49297);
    const items = [];
    this.cells.set(cell, items);
    const wantLitter = rng.chance(0.55), wantPuddle = rng.chance(0.3);
    if (!wantLitter && !wantPuddle) return;
    const G = cell * CELL + rng.range(0, CELL);
    const L = race.locate(G);
    if (!L) return;
    const tr = L.tr, s = Math.min(L.s, tr.length);
    if (tr.isFirst && s < tr.gateS + 30) return;
    if (s < 20 || s > tr.length - 20 || (tr.isFinal && s > tr.goalS - 30)) return;
    const hw = tr.halfWAt(s);
    if (wantPuddle) {
      const r = rng.range(1.1, 2.4);
      items.push({ G: G + rng.range(-4, 4), tr, kind: 'puddle', x: rng.range(-hw + 1.2, hw - 1.2), r, sx: rng.range(0.7, 1.0), sz: rng.range(1.2, 2.0), ang: rng.range(-0.3, 0.3), splashT: 0, gone: false });
    }
    if (!wantLitter) return;
    const kind = rng.weighted(KINDS);
    const x = rng.range(-hw + 0.8, hw - 0.8);
    const it = { G, tr, kind, x, r: 0.5, ang: rng.range(0, Math.PI), hit: false, passed: false, bits: [], gone: false };
    if (kind === 'pothole') {
      it.r = rng.range(0.55, 1.05);
      it.sx = rng.range(0.85, 1.2);
    } else if (kind === 'patch') {
      it.r = 1.1; it.w = rng.range(1.2, 2.2); it.l = rng.range(1.6, 3.2); it.ang = rng.range(-0.15, 0.15);
    } else if (kind === 'dirt') {
      it.r = rng.range(0.7, 1.4);
      const n = rng.int(3, 5);
      for (let i = 0; i < n; i++) it.bits.push({ dx: rng.range(-0.6, 0.6), dz: rng.range(-0.8, 0.8), r: it.r * rng.range(0.35, 0.7), col: rng.pick(CHIPS.dirt) });
    } else {
      const n = kind === 'paper' ? rng.int(3, 7) : kind === 'wrapper' ? rng.int(2, 5) : 1;
      it.r = 0.6;
      for (let i = 0; i < n; i++) {
        const b = { dx: rng.range(-0.9, 0.9), dz: rng.range(-1.4, 1.4), a: rng.range(0, Math.PI), col: rng.pick(CHIPS[kind]) };
        if (kind === 'bottle') { b.w = 0.14; b.l = 0.55; } else if (kind === 'peel') { b.w = 0.16; b.l = 0.42; } else if (kind === 'paper') { b.w = rng.range(0.22, 0.4); b.l = rng.range(0.18, 0.3); } else { b.w = 0.16; b.l = 0.16; }
        it.bits.push(b);
      }
    }
    items.push(it);
  }

  // movers: everything that can drive over litter, [{G, x, v, hl, hw, player}]
  update(dt, night, movers, wet = 0) {
    const g = this.game;
    const race = g.race;
    if (!race.active) { this.discs.count = this.quads.count = this.puddles.count = 0; return; }
    const damp = wet > 0.12; // puddles exist only when it is wet
    this.puddles.material.opacity = Math.min(0.85, (wet - 0.1) * 1.6);
    const PG = race.playerG();
    const c0 = Math.floor((PG - BEHIND) / CELL), c1 = Math.floor((PG + AHEAD) / CELL);
    if (this.hi === null) this.hi = c0 - 1;
    // lay down the road ahead; a cell whose track is not loaded yet is tried again next frame
    for (let c = Math.max(this.hi + 1, c0); c <= c1; c++) {
      const G = c * CELL;
      if (!race.locate(G + CELL / 2)) break;
      this.generate(c);
      this.hi = c;
    }
    for (const key of this.cells.keys()) if (key < c0 - 2) this.cells.delete(key);

    const shade = 0.38 + 0.62 * (1 - night);
    const m = this._m, q = this._q, e = this._e, p = this._p, sc = this._s, col = this._c, fr = this._fr;
    let nd = 0, nq = 0, np = 0;
    const world = g.world;
    const put = (mesh, n, tr, s, x, ang, sx, sz, r, gg, b) => {
      tr.point(s, x, 0.05, p);
      tr.frame(s, fr);
      e.set(fr.pitch || 0, -(tr.yawAt(s) + ang), 0, 'YXZ');
      q.setFromEuler(e);
      sc.set(sx, 1, sz);
      m.compose(p, q, sc);
      mesh.setMatrixAt(n, m);
      mesh.setColorAt(n, col.setRGB(r * shade, gg * shade, b * shade));
    };
    for (let c = c0; c <= c1; c++) {
      const items = this.cells.get(c);
      if (!items) continue;
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (it.gone) { items.splice(i, 1); continue; }
        const tr = it.tr;
        if (!tr || !world.tracks.has(tr.id)) continue;
        const s = it.G - tr.base;
        if (s < 0 || s > tr.length) continue;
        if (it.kind === 'puddle') {
          if (!damp) continue;
          it.splashT = Math.max(0, it.splashT - dt);
          for (const mv of movers) {
            const dG = Math.abs(it.G - mv.G);
            if (dG > 6 || mv.v < 6) continue;
            if (dG > mv.hl + it.r * it.sz * 0.8 || Math.abs(it.x - mv.x) > mv.hw + it.r * it.sx * 0.8) continue;
            this.events.push({ type: 'splash', it, v: mv.v, G: mv.G, x: mv.x, player: !!mv.player, first: it.splashT <= 0 && !!mv.player });
            if (mv.player) it.splashT = 0.6;
          }
          if (np + 2 <= MAX_PUDDLE * 2) {
            put(this.puddles, np++, tr, s, it.x, it.ang, it.r * it.sx, it.r * it.sz, 0.07, 0.09, 0.13);
            put(this.puddles, np++, tr, s, it.x, it.ang, it.r * it.sx * 0.72, it.r * it.sz * 0.7, 0.32, 0.4, 0.52);
          }
          continue;
        }
        // a racer drives over it
        for (const mv of movers) {
          const dG = Math.abs(it.G - mv.G);
          if (dG > 6) continue;
          const reach = it.kind === 'pothole' ? it.r * 0.7 : it.kind === 'patch' ? 0 : it.r * 0.8;
          if (!reach || dG > mv.hl + reach || Math.abs(it.x - mv.x) > mv.hw + reach) continue;
          if (it.kind === 'pothole') {
            if (!it.passed && mv.player && mv.v > 8) { it.passed = true; this.events.push({ type: 'pothole', it, v: mv.v }); }
          } else if (!it.hit) {
            it.hit = true; it.gone = true;
            this.events.push({ type: 'scatter', it, v: mv.v, player: !!mv.player });
          }
          break;
        }
        if (it.gone) continue;
        const gx = it.x;
        if (it.kind === 'pothole') {
          if (nd + 2 > MAX_DISC) continue;
          put(this.discs, nd++, tr, s, gx, it.ang, it.r * 1.35 * it.sx, it.r * 1.35, 0.3, 0.28, 0.26);
          put(this.discs, nd++, tr, s, gx, it.ang, it.r * it.sx, it.r, 0.012, 0.012, 0.014);
        } else if (it.kind === 'patch') {
          if (nq >= MAX_QUAD) continue;
          put(this.quads, nq++, tr, s, gx, it.ang, it.w, it.l, 0.035, 0.035, 0.04);
        } else if (it.kind === 'dirt') {
          for (const b of it.bits) {
            if (nd >= MAX_DISC) break;
            put(this.discs, nd++, tr, Math.min(s + b.dz, tr.length), gx + b.dx, it.ang, b.r, b.r, b.col[0], b.col[1], b.col[2]);
          }
        } else {
          for (const b of it.bits) {
            if (nq >= MAX_QUAD) break;
            put(this.quads, nq++, tr, Math.min(s + b.dz, tr.length), gx + b.dx, b.a, b.w, b.l, b.col[0], b.col[1], b.col[2]);
          }
        }
      }
    }
    for (const im of [this.discs, this.quads, this.puddles]) {
      im.count = im === this.discs ? nd : im === this.quads ? nq : np;
      im.instanceMatrix.needsUpdate = true;
      im.instanceColor.needsUpdate = true;
    }
  }
}

// what an item throws into the air when it is hit: colours of the bits, and how many
export const SCATTER = {
  dirt: { cols: [[0.45, 0.33, 0.2], [0.35, 0.26, 0.16], [0.55, 0.45, 0.32]], n: 16, dust: true },
  paper: { cols: PAPER, n: 12 },
  bottle: { cols: BOTTLE, n: 8 },
  wrapper: { cols: WRAP, n: 10 },
  peel: { cols: [[0.95, 0.8, 0.2]], n: 6 },
};
