// World: owns the atlases/materials, builds tracks for stages (with forks),
// streams chunks around the player and answers collision queries.

import * as THREE from 'three';
import { Track, STEP, LANE_W, CURVE_MUL as CURVE_MUL_W } from './track.js';
import { buildChunk, CHUNK, sideLimits, ChunkCtx } from './chunk.js';
import { buildFacadeAtlas, buildMiscAtlas } from './textures.js';
import { buildSignAtlas, makeGantryTexture } from './signs.js';
import { buildFxAtlas } from './fxatlas.js';
import { buildSpriteAtlas, makeSpriteMaterial } from './sprites.js';
import { shared, makeAtlasMaterial, makeGlowMaterial, makeWaterMaterial } from './materials.js';
import { makeRoadMaterial, buildFeatureTexture } from './road.js';
import { STAGES, childrenOf, KNOCKOUTS } from './stages.js';
import { buildContra } from './contra.js';
import { oppLayout } from './zones.js';
import { LANDMARKS, bannerMaterial, gantryMaterial } from './landmarks.js';
import * as PR from './props.js';
import { RNG, hashStr, clamp, smoothstep, lerp } from '../core/util.js';

export const DIVERGE = 340;
export const FORK_LEN = 280;
export const FORK_LANES = 3;
export const GATE_S = 430;
export const FORK_OFF = (FORK_LANES * LANE_W) / 2;
const VIEW_AHEAD = 1150;
// ordinary road is authored long; play it shorter so stages fly by (set pieces keep their size)
export const STAGE_SCALE = 0.5;
const isPlain = (sec) => !sec.hardK;
const KEEP_BEHIND = 160;

// A road that bends the same way more than the other way swings right round and crosses itself (and laps laid end
// to end spiral back through the first lap). Level the heading so a stage turns net zero: the stronger direction
// of bends is eased and the weaker one strengthened by the same factor, so the total amount of bend is kept.
export function levelHeading(secs) {
  const eff = (s) => (s.hardK || s.closed || s.env || s.surface ? 1 : (s.kMul ?? CURVE_MUL_W));
  const bends = secs.filter((s) => !s.hardK && s.k);
  let pos = 0, neg = 0;
  for (const s of bends) { const c = s.k * eff(s) * s.len; if (c > 0) pos += c; else neg -= c; }
  if (!pos && !neg) return;
  if (!pos || !neg) {
    // all one way: turn every other bend around
    bends.forEach((s, i) => { if (i % 2) s.k = -s.k; });
    return levelHeading(secs);
  }
  const f = Math.sqrt(Math.min(pos, neg) / Math.max(pos, neg));
  const hi = pos > neg ? 1 : -1;
  for (const s of bends) s.k *= Math.sign(s.k) === hi ? f : 1 / f;
}

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
    let net = 0; // running heading change; bends that would swing the route round are not exaggerated
    let aCur = 0, bCur = 0, flip = (hashStr(stageId) + (["padma","savar","sadarghat","oldDhaka"].includes(stageId) ? 1 : 0)) % 2 ? 1 : -1;
    for (const s0 of stage.sections) {
      const sc = defaults(s0);
      const plain = isPlain(sc) && !stage.circuit;
      if (plain) {
        sc.len = Math.max(60, Math.round(sc.len * STAGE_SCALE));
        const water = sc.L === 'lake' || sc.L === 'river' || sc.R === 'lake' || sc.R === 'river' || sc.L === 'bridge' || sc.R === 'bridge' || stage.L === 'bridge';
        // a sweeping bend, never more than ~50 degrees in one section (so long straights can't loop)
        if (!sc.k && sc.len > 90 && !sc.fork && !water) { sc.k = Math.min(0.0034, 0.85 / (sc.len * 1.7)) * flip; flip = -flip; }
        if (!sc.dy && !water && sc.elev == null && !stage.flat) sc.dy = 8 * (hashStr(stageId + map.length) % 2 ? 1 : -1);
      }
      if (plain) {
        const mul = sc.k * net > 0 && Math.abs(net) > 0.5 ? 1 : CURVE_MUL_W;
        sc.kMul = mul;
        net += (sc.k || 0) * mul * sc.len * 0.78;
      } else net += (sc.k || 0) * sc.len * 0.78;
      map.push([aCur, aCur + s0.len, bCur, bCur + sc.len]);
      aCur += s0.len; bCur += sc.len;
      secs.push(sc);
    }
    levelHeading(secs);
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
    // distance along the whole route to this track's s = 0 (the Run spans many tracks)
    tr.base = parent ? parent.base + parent.length : 0;
    tr.contentOffset = contentOffset;
    tr.isFinal = isFinal;
    tr.isFirst = isFirst;
    tr.level = stage.level;
    tr.contentLength = bCur;
    tr.contra = []; // ROAD WORKS stretches that push racers onto the opposite carriageway (filled once the track is built)
    // authored stage distance -> track distance
    tr.mapS = (a) => {
      for (const [a0, a1, b0, b1] of map) if (a <= a1) return contentOffset + b0 + (a1 > a0 ? (Math.max(a, a0) - a0) / (a1 - a0) : 0) * (b1 - b0);
      const last = map[map.length - 1];
      return contentOffset + (last ? last[3] + (a - last[1]) : a);
    };
    tr.goalS = isFinal ? tr.length - 700 : null;
    // the first track's line has room behind it for the grid
    tr.gateS = isFirst ? 360 : GATE_S; // room behind the line for a long rolling grid
    if (stage.circuit) {
      // lap n starts at lapS(n); the flag drops after the last one
      tr.laps = stage.laps;
      tr.lapLen = stage.lapLen;
      tr.lapS = (i) => tr.gateS + i * tr.lapLen;
      tr.goalS = tr.lapS(tr.laps);
    }
    // mean heading (for the sun)
    let ym = 0;
    for (let i = 0; i < tr.n; i += 10) ym += tr.yaw[i];
    tr.meanYaw = ym / Math.ceil(tr.n / 10);
    // reserved zones for landmarks
    tr.clear = (stage.landmarks || []).filter((l) => l.clear).map((l) => ({ s0: tr.mapS(l.clear[0]), s1: tr.mapS(l.clear[1]), side: l.side }));
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
      if (tr.lapS) for (let i = 1; i < tr.laps; i++) if (Math.abs(s - tr.lapS(i) - 0.5) < 1.6) ch = 1;
      if (isFinal && Math.abs(s - tr.goalS) < 2) ch = 1;
      return [z, p, al, ch];
    });
    tr.roadMat = makeRoadMaterial(tr, tr.featTex, stage);
    tr.waterMat = makeWaterMaterial({ deep: stage.waterDeep || '#0c2a33', lights: stage.waterLights || '#ffb060' });
    tr.children = null;
    tr.chosen = null;
    tr.contra = buildContra(tr);
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
    // roadside delineator posts: close, regular, fast-moving reference points that make speed readable
    {
      const white = ctx.misc.get('concrete_smooth');
      for (let s = Math.ceil(ctx.s0 / 8) * 8; s < ctx.s1; s += 8) {
        const sec = tr.sectionAt(Math.min(s, tr.length));
        if (sec.env || sec.surface || sec.closed || sec.fork || sec.diverge || sec.gap || tr.elevAt(s) > 14) continue;
        const hw = tr.halfWAt(s);
        const yaw = tr.yawAt(s);
        for (const sd of [-1, 1]) {
          if (sd > 0 && ctx.sideType(s, 1) === 'median') continue;
          const p = ctx.P(s, sd * (hw + 0.25), 0);
          ctx.B.misc.box(p[0], p[1], p[2], 0.24, 1.2, 0.24, yaw, { color: [0.95, 0.95, 0.93], region: white });
          ctx.B.misc.box(p[0], p[1] + 0.7, p[2], 0.27, 0.3, 0.27, yaw, { color: sd < 0 ? [0.9, 0.12, 0.1] : [0.95, 0.75, 0.1], region: white });
        }
      }
    }
    // road works: warnings in stages (signs at 800 and 500 m, a gantry at 360, the cross-over sign at 250, a gate at 140),
    // a diagonal taper of cones that steers you across, a striped barrier across our lanes and cones down every lane line
    for (const z of tr.contra || []) {
      if (z.s1 < ctx.s0 - 100 || z.s0 > ctx.s1 + 900) continue;
      const signAt = (d, kinds) => {
        const s = z.s0 - d;
        if (!inChunk(s)) return;
        const x = tr.halfWAt(Math.max(0, s)) + 1.5;
        PR.roadSign(ctx, s, -1, x, kinds[0], 2.2, 4.3);
        PR.roadSign(ctx, s, -1, x, kinds[1], 1.4, 2.3);
      };
      signAt(800, ['works', 'dist800']);
      signAt(500, ['works', 'dist500']);
      signAt(250, ['cross', 'dist250']);
      const g2 = z.s0 - 360;
      if (inChunk(g2)) {
        const o2 = oppLayout(tr, g2, st);
        PR.gantrySign(ctx, g2, tr.halfWAt(g2), o2.far, bannerMaterial(['সামনে রাস্তা বন্ধ', 'ROAD WORKS · CROSS TO THE RIGHT'], { c1: '#1456b8', c2: '#0a2a6b', tc: '#ffffff', w: 1024, h: 256 }), { w: 16 });
      }
      const gs = z.s0 - 140;
      if (inChunk(gs)) {
        const hwG = tr.halfWAt(gs);
        const o = oppLayout(tr, gs, st);
        PR.festiveGate(ctx, gs, hwG, o.far, bannerMaterial(['রাস্তা বন্ধ', 'ROAD WORKS · CROSS OVER NOW'], { c1: '#e4252b', c2: '#1a0508' }));
      }
      // the taper: a diagonal line of lit cones from our left edge to our right edge, the last 120 m before the barrier
      for (let k = 0; k <= 15; k++) {
        const t = k / 15;
        const s = z.s0 - 120 + t * 118;
        if (!inChunk(s)) continue;
        const hwT = tr.halfWAt(Math.max(0, s));
        const p = ctx.P(s, -hwT + 0.9 + t * (2 * hwT - 1.8), 0, true);
        ctx.B.misc.cylinder(p[0], p[1], p[2], 0.28, 0.04, 0.8, 8, [1, 0.45, 0.05], ctx.misc.get('white'));
        ctx.B.misc.cylinder(p[0], p[1] + 0.35, p[2], 0.17, 0.12, 0.12, 8, [1.4, 1.4, 1.4], ctx.misc.get('white'));
        if (k % 3 === 0) ctx.B.neon.box(p[0], p[1] + 0.95, p[2], 0.16, 0.16, 0.16, 0, { color: [3, 1.6, 0.1] });
      }
      const hw0 = tr.halfWAt(Math.min(z.s0, tr.length));
      if (inChunk(z.s0)) {
        for (let x = -hw0 + 1.2; x <= hw0 - 1.0; x += 2.4) {
          const p = ctx.P(z.s0, x, 0, true);
          ctx.B.fx.box(p[0], p[1], p[2], 2.2, 0.9, 0.3, tr.yawAt(z.s0), { color: [1, 1, 1], region: ctx.fx.get('chevron') });
        }
      }
      const lanes = Math.max(1, Math.round(tr.lanesAt(Math.min(z.s0, tr.length))));
      for (let s = Math.max(ctx.s0, z.s0 + 6); s < Math.min(ctx.s1, z.s1); s += 8) {
        const hw = tr.halfWAt(s);
        for (let l = 0; l <= lanes; l++) {
          const p = ctx.P(s, -hw + LANE_W * l + (l === 0 ? 0.4 : l === lanes ? -0.4 : 0), 0, true);
          ctx.B.misc.cylinder(p[0], p[1], p[2], 0.28, 0.04, 0.8, 8, [1, 0.45, 0.05], ctx.misc.get('white'));
          ctx.B.misc.cylinder(p[0], p[1] + 0.35, p[2], 0.17, 0.12, 0.12, 8, [1.4, 1.4, 1.4], ctx.misc.get('white'));
        }
      }
    }
    // start / checkpoint / goal gates
    if (inChunk(tr.gateS)) {
      const s = tr.gateS;
      const R = ctx.sideType(s, 1);
      const hwR = R === 'median' ? tr.halfWAt(s) + (st.medianW || 2.6) + st.lanes * LANE_W : tr.halfWAt(s);
      // start line, a knockout gate on the Run, or just the district's welcome arch
      const ko = !tr.isFirst && KNOCKOUTS[tr.stageId];
      const lines = tr.isFirst ? ['আউটরান ঢাকা', 'START · ' + st.name.toUpperCase()] : ko ? ['নকআউট', `KNOCKOUT · TOP ${ko} GO THROUGH`] : [st.bn, st.name.toUpperCase()];
      const cols = tr.isFirst ? { c1: '#c8102e', c2: '#5c0716' } : ko ? { c1: '#e4252b', c2: '#1a0508' } : { c1: '#0f7a43', c2: '#04301a' };
      PR.festiveGate(ctx, s, tr.halfWAt(s), hwR, bannerMaterial(lines, cols));
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
    // lap banners on the circuit
    if (tr.lapS) {
      for (let i = 1; i < tr.laps; i++) {
        const s = tr.lapS(i);
        if (!inChunk(s)) continue;
        const last = i === tr.laps - 1;
        PR.festiveGate(ctx, s, tr.halfWAt(s), tr.halfWAt(s), bannerMaterial([last ? 'শেষ ল্যাপ' : 'ল্যাপ ' + (i + 1), last ? 'FINAL LAP' : `LAP ${i + 1} / ${tr.laps}`], { c1: '#1d4fd8', c2: '#0a1f5c' }));
      }
    }
    if (tr.isFinal && inChunk(tr.goalS)) {
      const s = tr.goalS;
      const R = ctx.sideType(s, 1);
      const hwR = R === 'median' ? tr.halfWAt(s) + (st.medianW || 2.6) + st.lanes * LANE_W : tr.halfWAt(s);
      PR.festiveGate(ctx, s, tr.halfWAt(s), hwR, bannerMaterial(['ফিনিশ', 'FINISH · ' + st.name.toUpperCase()], { c1: '#f2b81f', c2: '#a86d00', tc: '#7a0716' }));
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
    const out = { lSoft: -(hw + L.soft), lWall: -(hw + L.wall), rSoft: hw + R.soft, rWall: hw + R.wall, hw, strip: null, near: null };
    // a divided road: the kerb is low and crossable, and the opposite carriageway is open to you
    if (this.sideTypeAt(tr, s, 1) === 'median') {
      const o = oppLayout(tr, s, tr.stage);
      out.strip = [hw + 0.1, o.near - 0.1];
      out.near = o.near;
      out.rSoft = o.far + 0.25;
      out.rWall = o.far + 0.8;
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
