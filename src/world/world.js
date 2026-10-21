// World: owns the atlases/materials, builds tracks for stages (with forks),
// streams chunks around the player and answers collision queries.

import * as THREE from 'three';
import { Track, STEP, LANE_W } from './track.js';
import { buildChunk, CHUNK, sideLimits, ChunkCtx } from './chunk.js';
import { buildFacadeAtlas, buildMiscAtlas } from './textures.js';
import { buildSignAtlas, makeGantryTexture } from './signs.js';
import { buildFxAtlas } from './fxatlas.js';
import { buildZones, contraAt, oppLayout } from './zones.js';
import { buildSpriteAtlas, makeSpriteMaterial } from './sprites.js';
import { shared, makeAtlasMaterial, makeGlowMaterial, makeWaterMaterial } from './materials.js';
import { makeRoadMaterial, buildFeatureTexture } from './road.js';
import { STAGES, childrenOf, CHECKPOINT_BONUS } from './stages.js';
import { LANDMARKS, bannerMaterial, gantryMaterial } from './landmarks.js';
import * as PR from './props.js';
import { rampAt } from './envs.js';
import { RNG, hashStr, clamp, smoothstep, lerp } from '../core/util.js';

export const DIVERGE = 340;
export const FORK_LEN = 280;
export const FORK_LANES = 3;
export const GATE_S = 430;
export const FORK_OFF = (FORK_LANES * LANE_W) / 2;
const VIEW_AHEAD = 1150;
// ordinary road is authored long; play it shorter so stages fly by (set pieces keep their size)
export const STAGE_SCALE = 0.5;
const isPlain = (sec) => !(sec.closed || sec.env || sec.surface || sec.hardK || sec.gap || sec.jump || sec.rides || sec.crests || sec.endRamp || sec.lift);
const KEEP_BEHIND = 160;

export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.shared = shared;
    this.tracks = new Map();
    this.chunks = new Map(); // key trackId:ci -> chunk
    this.landmarks = LANDMARKS;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.dynamic = [];
    this.emitters = [];
    this.breakables = [];
    this.onChunk = null;
  }

  buildAssets(progress) {
    const r = this.renderer;
    const A = {};
    progress?.('Painting facades');
    A.facade = buildFacadeAtlas().textures(r);
    progress?.('Painting rickshaw art');
    A.misc = buildMiscAtlas().textures(r);
    progress?.('Lettering signboards');
    A.signs = buildSignAtlas().textures(r);
    progress?.('Planting krishnachura');
    A.sprites = buildSpriteAtlas().textures(r);
    progress?.('Hanging sarees');
    A.fx = buildFxAtlas().textures(r);
    this.assets = A;
    const M = {};
    M.facade = makeAtlasMaterial(A.facade);
    M.misc = makeAtlasMaterial(A.misc);
    M.fx = makeAtlasMaterial(A.fx);
    M.fxDouble = makeAtlasMaterial(A.fx, { side: THREE.DoubleSide });
    M.sign = makeAtlasMaterial(A.signs, { selfEmissive: 0.9, glowUniform: shared.uSignGlow, side: THREE.DoubleSide });
    M.lamp = makeGlowMaterial(1);
    M.neon = makeGlowMaterial(0.5); // neon is a detail, not the art style
    M.always = makeGlowMaterial(1);
    M.wire = new THREE.LineBasicMaterial({ vertexColors: true, fog: true });
    const gtex = groundDetailTexture();
    M.ground = new THREE.MeshLambertMaterial({ vertexColors: true, map: gtex });
    M.sprite = makeSpriteMaterial(A.sprites, shared);
    M.water = makeWaterMaterial();
    M.rainbow = rainbowMaterial();
    M.fountain = fountainMaterial();
    this.mats = M;

    // far ground disc so the horizon never shows a seam
    this.farMatGround = new THREE.MeshBasicMaterial({ color: '#555', fog: true });
    this.farDisc = new THREE.Mesh(new THREE.RingGeometry(380, 4200, 64, 1), this.farMatGround);
    this.farDisc.rotation.x = -Math.PI / 2;
    this.farDisc.renderOrder = -5;
    this.scene.add(this.farDisc);
  }

  // ------------------------------------------------------------ tracks

  startTrack(stageId) {
    for (const t of this.tracks.values()) this.disposeTrack(t);
    this.tracks.clear();
    const tr = this.makeTrack(stageId, null, 0);
    return tr;
  }

  makeTrack(stageId, parent, side) {
    const stage = STAGES[stageId];
    const secs = [];
    const isFirst = !parent;
    const defaults = (s) => ({ ...s });
    const contentOffset = isFirst ? 0 : DIVERGE;
    if (!isFirst) {
      // the road simply carries on into the next district
      const d = { len: DIVERGE, k: 0.0022 * (hashStr(stageId) % 2 ? 1 : -1), dy: 0, lanes: stage.lanes, laneEase: 0.8, diverge: true };
      const side2 = (t) => (t === 'median' || t === 'bridge' || t === 'elevated' || t === 'cityLow' || t === 'lake' || t === 'river' ? 'city' : t);
      d.L = side2(stage.L); d.R = side2(stage.R);
      secs.push(d);
    }
    // authored sections, shortened, with bends and crests worked into the long plain straights
    const map = [];
    let aCur = 0, bCur = 0, flip = hashStr(stageId) % 2 ? 1 : -1;
    for (const s0 of stage.sections) {
      const sc = defaults(s0);
      const plain = isPlain(sc);
      if (plain) {
        sc.len = Math.max(60, Math.round(sc.len * STAGE_SCALE));
        const water = sc.L === 'lake' || sc.L === 'river' || sc.R === 'lake' || sc.R === 'river' || sc.L === 'bridge' || sc.R === 'bridge' || stage.L === 'bridge';
        // a sweeping bend, never more than ~50 degrees in one section (so long straights can't loop)
        if (!sc.k && sc.len > 90 && !sc.fork && !water) { sc.k = Math.min(0.0034, 0.85 / (sc.len * 1.7)) * flip; flip = -flip; }
        if (!sc.dy && !water && sc.elev == null && !stage.flat) sc.dy = 4 * (hashStr(stageId + map.length) % 2 ? 1 : -1);
      }
      map.push([aCur, aCur + s0.len, bCur, bCur + sc.len]);
      aCur += s0.len; bCur += sc.len;
      secs.push(sc);
    }
    const isFinal = !!stage.final;
    if (!isFinal) {
      const lastL = stage.L === 'median' ? 'city' : stage.L;
      const fl = (lastL === 'lake' || lastL === 'river' || lastL === 'bridge' || lastL === 'elevated' || lastL === 'cityLow') ? (lastL === 'cityLow' ? 'city' : lastL === 'elevated' ? 'city' : lastL) : lastL;
      const fr = stage.R === 'median' || stage.R === 'elevated' || stage.R === 'cityLow' ? 'city' : stage.R;
      secs.push({ len: 160, k: 0, dy: 0, lanes: stage.lanes, L: fl, R: fr, elev: 0, preFork: true });
    } else {
      const last = stage.sections[stage.sections.length - 1];
      secs.push({ len: 700, k: 0, dy: 0, goalRun: true, L: last.L, R: last.R, far: last.far, elev: last.elev });
    }
    let start;
    if (parent) {
      const pe = parent.length;
      const yaw = parent.yawAt(pe);
      const p = parent.point(pe, 0, 0, new THREE.Vector3());
      start = { x: p.x, z: p.z, yaw, gy: parent.groundAt(pe), elev: parent.elevAt(pe), lanes: parent.lanesAt(pe) };
    } else {
      start = { x: 0, z: 0, yaw: 0, gy: 0, elev: 0, lanes: stage.lanes };
    }
    const id = stageId + (parent ? '<' + parent.id : '');
    const tr = new Track({ id, stage, sections: secs, start, parent, side });
    tr.stageId = stageId;
    tr.contentOffset = contentOffset;
    tr.isFinal = isFinal;
    tr.isFirst = isFirst;
    tr.level = stage.level;
    tr.contentLength = bCur;
    // authored stage distance -> track distance
    tr.mapS = (a) => {
      for (const [a0, a1, b0, b1] of map) if (a <= a1) return contentOffset + b0 + (a1 > a0 ? (Math.max(a, a0) - a0) / (a1 - a0) : 0) * (b1 - b0);
      const last = map[map.length - 1];
      return contentOffset + (last ? last[3] + (a - last[1]) : a);
    };
    tr.goalS = isFinal ? tr.length - 700 : null;
    tr.gateS = isFirst ? 40 : GATE_S;
    // mean heading (for the sun)
    let ym = 0;
    for (let i = 0; i < tr.n; i += 10) ym += tr.yaw[i];
    tr.meanYaw = ym / Math.ceil(tr.n / 10);
    // reserved zones for landmarks
    tr.clear = (stage.landmarks || []).filter((l) => l.clear).map((l) => ({ s0: tr.mapS(l.clear[0]), s1: tr.mapS(l.clear[1]), side: l.side }));
    tr.zones = buildZones(tr, stage, tr.mapS);
    // features
    const zebras = (stage.zebras || []).map((z) => tr.mapS(z));
    const alp = (stage.alpana || []).map(([a, b]) => [tr.mapS(a), tr.mapS(b)]);
    const pud = (stage.puddles || []).map(([a, b]) => [tr.mapS(a), tr.mapS(b)]);
    const featRng = new RNG(hashStr(id) + 77);
    const puddleNoise = [];
    for (let i = 0; i < tr.n; i++) puddleNoise.push(featRng.next());
    tr.featTex = buildFeatureTexture(tr, (s) => {
      let z = 0, p = 0, al = 0, ch = 0;
      for (const zs of zebras) if (s >= zs && s < zs + 4) z = 1;
      for (const [a, b] of alp) if (s >= a && s <= b) al = smoothstep(a, a + 40, s) * (1 - smoothstep(b - 40, b, s));
      for (const [a, b] of pud) if (s >= a && s <= b) p = 0.75;
      if (Math.abs(s - tr.gateS - 0.5) < 1.6) ch = 1;
      if (isFinal && Math.abs(s - tr.goalS) < 2) ch = 1;
      return [z, p, al, ch];
    });
    tr.roadMat = makeRoadMaterial(tr, tr.featTex, stage);
    tr.waterMat = makeWaterMaterial({ deep: stage.waterDeep || '#0c2a33', lights: stage.waterLights || '#ffb060' });
    tr.children = null;
    tr.chosen = null;
    this.tracks.set(id, tr);
    return tr;
  }

  ensureChildren(tr) {
    if (tr.children || tr.isFinal) return tr.children;
    const kids = childrenOf(tr.stageId);
    if (!kids) return null;
    const next = this.makeTrack(kids[0], tr, 0);
    tr.children = [next, next];
    // gantry texture for the fork
    const L = STAGES[kids[0]], R = STAGES[kids[1]];
    const tex = new THREE.CanvasTexture(makeGantryTexture({ bn: L.bn, en: L.name }, { bn: R.bn, en: R.name }));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tr.gantryMat = gantryMaterial(tex);
    return tr.children;
  }

  disposeTrack(tr) {
    for (const [key, ch] of this.chunks) {
      if (ch.track === tr) this.disposeChunk(key, ch);
    }
    tr.featTex?.dispose();
    tr.roadMat?.dispose();
    tr.waterMat?.dispose();
    this.tracks.delete(tr.id);
  }

  disposeChunk(key, ch) {
    this.root.remove(ch.group);
    ch.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    this.dynamic = this.dynamic.filter((d) => d.chunk !== ch);
    this.emitters = this.emitters.filter((e) => e.chunk !== ch);
    this.breakables = this.breakables.filter((b) => b.chunk !== ch || b.flying);
    this.chunks.delete(key);
  }

  // ------------------------------------------------------------ streaming

  ensureChunk(tr, ci) {
    const key = tr.id + ':' + ci;
    if (this.chunks.has(key)) return this.chunks.get(key);
    const ch = buildChunk(this, tr, ci);
    if (!ch) return null;
    ch.track = tr;
    ch.key = key;
    this.root.add(ch.group);
    this.chunks.set(key, ch);
    for (const d of ch.dynamic) { d.chunk = ch; this.dynamic.push(d); }
    for (const e of ch.emitters || []) { e.chunk = ch; this.emitters.push(e); }
    for (const b of ch.breakables || []) { b.chunk = ch; b.track = tr; this.breakables.push(b); }
    this.onChunk?.(ch);
    return ch;
  }

  // budget: max chunks built per call
  stream(track, s, budget = 2, behind = KEEP_BEHIND, ahead = VIEW_AHEAD) {
    const want = new Set();
    const need = [];
    const add = (tr, a, b) => {
      const c0 = Math.max(0, Math.floor(a / CHUNK));
      const maxC = Math.floor((tr.length + (tr.isFinal ? 650 : 0)) / CHUNK);
      const c1 = Math.min(maxC, Math.floor(b / CHUNK));
      for (let c = c0; c <= c1; c++) {
        const key = tr.id + ':' + c;
        want.add(key);
        if (!this.chunks.has(key)) need.push([tr, c, Math.abs(c * CHUNK - s)]);
      }
    };
    add(track, s - behind, s + ahead);
    // previous track tail (when just past a fork)
    if (track.parent && s < behind + 20) add(track.parent, track.parent.length - (behind - s) - 20, track.parent.length + 10);
    // the branch we did not take stays visible while the roads diverge
    if (track.parent && s < 520 && track.parent.children) {
      for (const sib of track.parent.children) if (sib !== track) add(sib, Math.max(0, s - behind), Math.min(700, s + ahead));
    }
    // children ahead
    const remain = track.length - s;
    if (!track.isFinal && remain < ahead + 200) {
      const kids = this.ensureChildren(track);
      if (kids) {
        if (track.chosen) {
          add(track.chosen, 0, ahead - remain);
        } else {
          for (const k of kids) add(k, 0, Math.min(ahead - remain, 700));
        }
      }
    }
    // build nearest first
    need.sort((a, b) => a[2] - b[2]);
    let built = 0;
    for (const [tr, c] of need) {
      if (built >= budget) break;
      this.ensureChunk(tr, c);
      built++;
    }
    // drop the rest
    for (const [key, ch] of this.chunks) {
      if (!want.has(key)) this.disposeChunk(key, ch);
    }
    return need.length - built;
  }

  // called when the player crosses a fork; returns the child track and lateral rebase
  commitFork(track, x) {
    const kids = this.ensureChildren(track);
    const child = kids[0];
    track.chosen = child;
    return { child, xNew: x, side: 0 };
  }

  // remove tracks that are no longer reachable
  gc(current) {
    for (const tr of [...this.tracks.values()]) {
      if (tr === current || tr === current.parent) continue;
      if (current.children && current.children.includes(tr)) continue;
      if (current.parent && current.parent.children && current.parent.children.includes(tr) && !current.gcDone) continue;
      this.disposeTrack(tr);
    }
    if (current.parent) {
      for (const k of current.parent.children || []) {
        if (k !== current && this.tracks.has(k.id)) this.disposeTrack(k);
      }
    }
  }

  // ------------------------------------------------------------ chunk population (stage features)

  populateChunk(ctx) {
    const tr = ctx.track, st = ctx.stage;
    const M = tr.mapS;
    const inChunk = (s) => s >= ctx.s0 && s < ctx.s1;
    // landmarks
    for (const l of st.landmarks || []) {
      const s = M(l.s);
      if (!inChunk(s)) continue;
      const fn = LANDMARKS[l.type];
      if (!fn) continue;
      if (l.type === 'ledArch') fn(ctx, s, tr.halfWAt(s) + 10, l.opts);
      else if (l.type === 'tollPlaza') fn(ctx, s, tr.halfWAt(s), tr.lanesAt(s));
      else fn(ctx, s, l.side, l.dist, l.opts);
    }
    for (const fb of st.footbridges || []) {
      const s = M(fb);
      if (!inChunk(s)) continue;
      const R = ctx.sideType(s, 1);
      const hwR = R === 'median' ? tr.halfWAt(s) + (st.medianW || 2.6) + st.lanes * LANE_W : tr.halfWAt(s);
      PR.footbridge(ctx, s, tr.halfWAt(s), hwR, { ads: [ctx.rng.pick(st.billboards || ['gfun']), ctx.rng.pick(st.billboards || ['tea']), 'pathaw'] });
    }
    for (const ms of st.metroStations || []) {
      const s = M(ms);
      if (!inChunk(s)) continue;
      LANDMARKS.metroStation(ctx, s, tr.halfWAt(s), tr.halfWAt(s) + (st.medianW || 2.6) + st.lanes * LANE_W);
    }
    for (const b of st.banners || []) {
      const s = M(b.s);
      if (!inChunk(s)) continue;
      const R = ctx.sideType(s, 1);
      const hwR = R === 'median' ? tr.halfWAt(s) + (st.medianW || 2.6) + st.lanes * LANE_W : tr.halfWAt(s);
      PR.festiveGate(ctx, s, tr.halfWAt(s), hwR, bannerMaterial(b.lines, { c1: b.c1, c2: b.c2 }));
    }
    // pedestrians waiting at zebra crossings
    for (const z of st.zebras || []) {
      const s = M(z) + 2;
      if (!inChunk(s)) continue;
      for (let i = 0; i < 4; i++) {
        const p = ctx.P(s + ctx.rng.range(-1.5, 1.5), -(tr.halfWAt(s) + 0.8 + ctx.rng.next()), 0.18);
        ctx.sprites.add(ctx.rng.pick(['p_lungi', 'p_saree', 'p_shirt', 'p_kameez', 'crowd0']), p[0], p[1], p[2], 1, { lamp: 1 });
      }
      PR.roadSign(ctx, s - 30, -1, tr.halfWAt(s) + 1.2, ctx.rng.pick(['school', 'slow', 'nohorn']));
    }
    // occasional road signs
    if (ctx.rng.chance(0.25) && !tr.sectionAt(ctx.s0 + 50).fork) {
      const s = ctx.s0 + ctx.rng.range(10, 90);
      const L = ctx.sideType(s, -1);
      if (L === 'city' || L === 'park' || L === 'field' || L === 'wall' || L === 'kash') {
        PR.roadSign(ctx, s, -1, tr.halfWAt(s) + (L === 'field' || L === 'kash' ? 1.6 : 1.2), ctx.rng.pick(['speed40', 'speed60', 'speed80', 'slow', 'bump', 'nohorn']));
      }
    }
    // wrong-side runs: the ramp before the jam, barrels closing the far side
    for (const z of tr.zones?.contra || []) {
      if (inChunk(z.ramp)) {
        const s = z.ramp, hw = tr.halfWAt(s);
        const o = oppLayout(tr, s, st);
        rampAt(ctx, s, hw - LANE_W * 0.5, LANE_W - 0.5, 7, 1.3, { len: 52, h: 4.4, x1: o.near + LANE_W * 0.6, kind: 'contra', slow: 0.55 });
        // a van full of planks is how the ramp got here
        const vp = ctx.P(s + 5, hw - LANE_W * 0.5, 0);
        ctx.B.misc.box(vp[0], vp[1], vp[2], 1.4, 0.6, 2.4, tr.yawAt(s), { color: [0.5, 0.32, 0.18], region: ctx.misc.get('wood') });
        PR.roadSign(ctx, s - 40, 1, hw + 1.2, 'slow');
      }
      for (let s = Math.ceil(Math.max(ctx.s0, z.g1) / 6) * 6; s < Math.min(ctx.s1, z.end + 6); s += 6) {
        const o = oppLayout(tr, s, st);
        const t = clamp((s - z.g1) / (z.end - z.g1), 0, 1);
        const x = lerp(o.far + 0.3, o.near + 0.6, t) + 0.4;
        ctx.breakable('barrier', s, x, { hw: 1.2, hl: 0.3, ht: 0.9, mass: 0.02, score: 100, yaw: Math.atan2(o.far - o.near, z.end - z.g1) * 0.0 });
      }
    }
    // street stalls taking over the outer lane
    for (const z of tr.zones?.stalls || []) {
      for (let s = Math.max(ctx.s0, z.s0); s < Math.min(ctx.s1, z.s1); s += ctx.rng.range(6, 11)) {
        const hw = tr.halfWAt(s);
        const x = z.side * (hw - LANE_W * 0.5 + ctx.rng.range(-0.3, 0.4));
        const k = ctx.rng.weighted({ stall_tea: 3, stall_fruit: 2.5, stall_fuchka: 2, crate: 1.2, kiosk: 0.6 });
        ctx.breakable(k, s, x, { hw: 0.95, hl: 0.6, ht: 1.6, mass: 0.05, score: 300, yaw: z.side < 0 ? 0 : Math.PI });
        if (ctx.rng.chance(0.6)) {
          const p = ctx.P(s + ctx.rng.range(-1, 1), z.side * (hw + 0.8), 0.18);
          ctx.sprites.add(ctx.rng.pick(['p_vendor', 'p_lungi', 'crowd0']), p[0], p[1], p[2], 1, { lamp: 1, flip: z.side > 0 });
        }
      }
    }
    // ramps for the helicopter fight
    for (const r of st.ramps || []) {
      const s = M(r.s);
      if (!inChunk(s)) continue;
      const hw = tr.halfWAt(s);
      const x = r.x != null ? r.x * hw : 0;
      rampAt(ctx, s, x, 5.2, 7.5, 1.6, { len: r.len || 46, h: r.h || 6.8, kind: 'heliRamp', slow: 0.45 });
    }
    // start / checkpoint / goal gates
    if (inChunk(tr.gateS)) {
      const s = tr.gateS;
      const R = ctx.sideType(s, 1);
      const hwR = R === 'median' ? tr.halfWAt(s) + (st.medianW || 2.6) + st.lanes * LANE_W : tr.halfWAt(s);
      const lines = tr.isFirst && tr.stageId === 'dhanmondi' ? ['আউটরান ঢাকা', 'START · DHANMONDI'] : ['চেকপয়েন্ট', 'CHECKPOINT · ' + st.name.toUpperCase()];
      if (tr.sectionAt(s).env) { /* set pieces have their own entrance */ }
      PR.festiveGate(ctx, s, tr.halfWAt(s), hwR, bannerMaterial(lines, tr.isFirst ? { c1: '#c8102e', c2: '#5c0716' } : { c1: '#0f7a43', c2: '#04301a' }));
      if (tr.isFirst) {
        // the crowd at the start line + traffic police with white gloves
        for (let i = 0; i < 16; i++) {
          const side = i % 2 ? 1 : -1;
          const x = side < 0 ? -(tr.halfWAt(s) + 1 + ctx.rng.range(0, 2.2)) : tr.halfWAt(s) + 1 + ctx.rng.range(0, 1.2);
          const p = ctx.P(s + ctx.rng.range(-14, 6), x, 0.18);
          ctx.sprites.add(ctx.rng.pick(['crowd0', 'crowd1', 'crowd2']), p[0], p[1], p[2], 1, { lamp: 1, flip: ctx.rng.chance(0.5) });
        }
        const pp = ctx.P(s - 8, -(tr.halfWAt(s) - 1.2), 0);
        ctx.sprites.add('police', pp[0], pp[1], pp[2], 1.05, { lamp: 1 });
        ctx.obstacle(s - 8, -(tr.halfWAt(s) - 1.2), 0.4, 0.4, 'soft');
      }
    }
    if (tr.isFinal && inChunk(tr.goalS)) {
      const s = tr.goalS;
      const R = ctx.sideType(s, 1);
      const hwR = R === 'median' ? tr.halfWAt(s) + (st.medianW || 2.6) + st.lanes * LANE_W : tr.halfWAt(s);
      PR.festiveGate(ctx, s, tr.halfWAt(s), hwR, bannerMaterial(['গোল!', 'GOAL · ' + st.name.toUpperCase()], { c1: '#f2b81f', c2: '#a86d00', tc: '#7a0716' }));
    }
    // fork gantry and gore barrier
    if (!tr.isFinal) {
      const gs = tr.length - FORK_LEN - 220;
      if (inChunk(gs)) {
        this.ensureChildren(tr);
        PR.gantrySign(ctx, gs, tr.halfWAt(gs), tr.halfWAt(gs), tr.gantryMat, { w: 14 });
      }
    }
    if (tr.side) {
      // gore nose (the divider between the two branches) lives on the inner side
      const gs = 34;
      if (inChunk(gs)) {
        const inner = -tr.side;
        const x = inner * (tr.halfWAt(gs) + 1.6);
        const p = ctx.P(gs, x, 0);
        const yaw = tr.yawAt(gs);
        ctx.B.misc.box(p[0], p[1], p[2], 3.6, 2.4, 0.2, yaw, { color: [1, 1, 1], region: ctx.misc.get('checker') });
        for (let i = 0; i < 6; i++) {
          const q = ctx.P(gs - 3 - i * 1.4, inner * (tr.halfWAt(gs) + 0.9 + i * 0.1), 0);
          ctx.B.misc.cylinder(q[0], q[1], q[2], 0.42, 0.42, 1.0, 8, [1, 0.5, 0.05], ctx.misc.get('white'));
          ctx.B.always.cylinder(q[0], q[1] + 0.6, q[2], 0.43, 0.43, 0.16, 8, [2.5, 2.5, 2.5]);
        }
        ctx.obstacle(gs - 3, inner * (tr.halfWAt(gs) + 1.4), 1.6, 6, 'solid');
      }
    }
  }

  // ------------------------------------------------------------ queries

  sideTypeAt(tr, s, side) {
    const sec = tr.sectionAt(s);
    if (side < 0) return sec.L || tr.stage.L || 'city';
    return sec.R || tr.stage.R || 'city';
  }

  limits(tr, s, x = 0) {
    const sec = tr.sectionAt(s);
    const L = sideLimits(this.sideTypeAt(tr, s, -1), tr.stage, sec);
    const R = sideLimits(this.sideTypeAt(tr, s, 1), tr.stage, sec);
    const hw = tr.halfWAt(s);
    const out = { lSoft: -(hw + L.soft), lWall: -(hw + L.wall), rSoft: hw + R.soft, rWall: hw + R.wall, hw, opp: false };
    // wrong-side runs: the opposite carriageway becomes yours
    const z = contraAt(tr, s);
    if (z && this.sideTypeAt(tr, s, 1) === 'median') {
      const o = oppLayout(tr, s, tr.stage);
      const inGap = s >= z.g0 && s <= z.end;
      const onOpp = x > hw + o.mw * 0.5;
      let far = o.far + 0.3;
      if (s > z.g1) far = lerp(o.far + 0.3, o.near + 0.6, clamp((s - z.g1) / (z.end - z.g1), 0, 1));
      if (inGap) { out.rSoft = far - 0.1; out.rWall = far; }
      else if (onOpp) { out.lSoft = o.near - 0.05; out.lWall = o.near - 0.15; out.rSoft = far - 0.1; out.rWall = far; }
      out.opp = onOpp;
    }
    return out;
  }

  obstaclesNear(tr, s, out) {
    out.length = 0;
    const c0 = Math.floor((s - 8) / CHUNK), c1 = Math.floor((s + 8) / CHUNK);
    for (let c = c0; c <= c1; c++) {
      const ch = this.chunks.get(tr.id + ':' + c);
      if (!ch) continue;
      for (const o of ch.obstacles) if (Math.abs(o.s - s) < 12) out.push(o);
    }
    return out;
  }

  update(dt, time, cam) {
    for (const d of this.dynamic) {
      if (d.userData.fountain) {
        const h = 6 + 5 * (0.5 + 0.5 * Math.sin(time * 1.4 + d.userData.phase)) + 4 * Math.max(0, Math.sin(time * 0.6 + d.userData.phase * 0.5));
        d.scale.y = h;
      }
    }
    this.mats.rainbow.uniforms.uTime.value = time;
    this.mats.fountain.uniforms.uTime.value = time;
  }
}

function groundDetailTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  const rng = new RNG('ground');
  ctx.fillStyle = '#c8c8c8';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) {
    const v = rng.range(150, 240) | 0;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rng.range(0, 256), rng.range(0, 256), rng.range(1, 4), rng.range(1, 4));
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function rainbowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFogColor: shared.uFogColor, uFogDensity: shared.uFogDensity, uGlow: shared.uGlow },
    vertexShader: /* glsl */ `
      varying float vT; varying float vFog;
      void main(){ vT = uv.x; vec4 mv = modelViewMatrix * vec4(position,1.0); vFog = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFogDensity, uGlow; uniform vec3 uFogColor; varying float vT; varying float vFog;
      vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.)-3.)-1., 0., 1.); }
      void main(){
        float chase = 0.55 + 0.45 * sin(vT * 60.0 - uTime * 6.0);
        vec3 c = hue(fract(vT * 1.5 + uTime * 0.08)) * (1.2 + 2.2 * chase) * (0.35 + 0.65 * uGlow);
        float f = 1.0 - exp(-uFogDensity*uFogDensity*vFog*vFog);
        gl_FragColor = vec4(mix(c, uFogColor, f * 0.6), 1.0);
      }`,
  });
}

function fountainMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFogDensity: shared.uFogDensity },
    vertexShader: /* glsl */ `
      varying float vH; varying float vFog; varying vec3 vW;
      void main(){ vH = uv.y; vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; vec4 mv = viewMatrix * wp; vFog = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFogDensity; varying float vH; varying float vFog; varying vec3 vW;
      vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.)-3.)-1., 0., 1.); }
      void main(){
        float a = (1.0 - vH) * 0.7 + 0.15;
        vec3 c = mix(vec3(1.0), hue(fract(uTime * 0.1 + vW.x * 0.01)), 0.6) * a * 1.4;
        float f = exp(-uFogDensity*uFogDensity*vFog*vFog);
        gl_FragColor = vec4(c * f, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}
