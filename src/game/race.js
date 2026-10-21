// THE DHAKA RUN: one illegal race across the city. Twenty-three rivals, one
// night, and you start dead last. Rivals live as a "progress" number along the
// route; the ones near you are materialised as real cars on the road (driven
// by traffic.js, role 'rival') and fold back into numbers when they fall out
// of range. Each stage has a position you must reach by its end.

import * as THREE from 'three';
import { clamp } from '../core/util.js';
import { closedAt, contraAt } from '../world/zones.js';
import { ROUTE } from '../world/stages.js';

export const RIVALS = [
  { name: 'RAJA', model: 'skyline', color: '#0b0b0f', f: 0.84, tag: 'THREE-TIME CHAMPION' },
  { name: 'NAWAB', model: 'supra', color: '#e8e4da', f: 0.80 },
  { name: 'TURBO SHUMON', model: 'supra', color: '#ff6a00', f: 0.79 },
  { name: 'DJ PIASH', model: 'celica', color: '#ff2e88', f: 0.78 },
  { name: 'CAPTAIN RUBEL', model: 'chaser', color: '#1d4fd8', f: 0.77 },
  { name: 'RUMANA', model: 'miata', color: '#c8102e', f: 0.765 },
  { name: 'ZIKO', model: 'skyline', color: '#6b6f78', f: 0.76 },
  { name: 'CHAIRMAN’S SON', model: 'prado', color: '#111214', f: 0.75 },
  { name: 'TONY OF UTTARA', model: 'celica', color: '#ffd200', f: 0.745 },
  { name: 'NIPA', model: 'miata', color: '#22d3ee', f: 0.74 },
  { name: 'POLASH', model: 'chaser', color: '#2f8f4e', f: 0.73 },
  { name: 'MOTU BHAI', model: 'prado', color: '#f2f2ee', f: 0.72 },
  { name: 'FARHAN', model: 'supra', color: '#7b2f9e', f: 0.715 },
  { name: 'JOLLY', model: 'miata', color: '#ffb000', f: 0.71 },
  { name: 'KHOKON', model: 'premio', color: '#b9bcc0', f: 0.70 },
  { name: 'BABLU', model: 'celica', color: '#e4252b', f: 0.69 },
  { name: 'SHAKIL', model: 'chaser', color: '#0e7c86', f: 0.685 },
  { name: 'PINKY', model: 'miata', color: '#ff7eb6', f: 0.68 },
  { name: 'RONY', model: 'skyline', color: '#c0c4cc', f: 0.67 },
  { name: 'MITHU', model: 'premio', color: '#7a1d22', f: 0.66 },
  { name: 'SHUVO', model: 'supra', color: '#3a7bd5', f: 0.65 },
  { name: 'ANIK', model: 'celica', color: '#9acd32', f: 0.64 },
  { name: 'UNCLE FAISAL', model: 'premio', color: '#f2f2ee', f: 0.63 },
];

export const FIELD = RIVALS.length + 1;
// position needed by the end of each pyramid level (level 4 = the finish)
export const TARGETS = ROUTE.map((_, i) => Math.max(1, Math.round(19 - (i * 18) / (ROUTE.length - 1))));
// rivals get a touch slower relative to you as the night goes on
const LEVEL_PACE = ROUTE.map((_, i) => 1 - i * 0.003);
const AHEAD = 380, BEHIND = 130, MAX_LIVE = 3;

export class Race {
  constructor(game) {
    this.game = game;
    // pace is a fraction of your top speed; +0.07 keeps the field honest at full throttle
    this.rivals = RIVALS.map((r, i) => ({ ...r, f: r.f + 0.07, i, prog: 0, v: 0, veh: null, cool: 0, wob: Math.random() * 10 }));
    this.active = false;
    this.position = FIELD;
    this.routeBase = 0;
    this._c = new THREE.Color();
  }

  // everyone on the grid; you start last
  start() {
    const P = this.game.player;
    this.routeBase = 0;
    this.active = true;
    const p0 = P.s;
    const n = this.rivals.length;
    for (const r of this.rivals) {
      this.drop(r);
      // two-wide grid, leader at the front
      r.prog = p0 + 10 + Math.floor((n - 1 - r.i) / 2) * 11;
      r.lane = (n - 1 - r.i) % 2;
      r.v = 0;
      r.cool = 0;
    }
    this.position = FIELD;
    this.best = FIELD;
    this.snapshot();
  }

  stop() {
    this.active = false;
    for (const r of this.rivals) this.drop(r);
  }

  progress() { return this.routeBase + this.game.player.s; }

  // called when the player's track switches to the next stage
  onFork(oldLength, snap = true) {
    this.routeBase += oldLength;
    for (const r of this.rivals) if (r.veh) this.drop(r);
    if (snap) this.snapshot();
  }

  // state at the start of a stage, for "retry stage"
  snapshot() {
    const g = this.game;
    const pp = this.progress();
    this.snap = {
      base: this.routeBase,
      path: g.path.slice(),
      stageId: g.player.track.stageId || g.player.track.stage.id,
      rel: this.rivals.map((r) => r.prog - pp),
      score: g.score || 0,
      best: this.best,
    };
  }

  restore() {
    const s = this.snap;
    if (!s) return;
    this.routeBase = s.base;
    const pp = this.progress();
    this.rivals.forEach((r, i) => { this.drop(r); r.prog = pp + s.rel[i]; r.v = 0; r.cool = 0; });
    this.active = true;
    this.best = s.best;
  }

  drop(r) {
    if (!r.veh) return;
    const T = this.game.traffic;
    const k = T.list.indexOf(r.veh);
    if (k >= 0 && !r.veh.wreck) T.list.splice(k, 1);
    r.veh.rival = null;
    r.veh = null;
  }

  // pace of a rival at a point of the route
  paceAt(r, tr, s, refV, level) {
    let v = refV * r.f * LEVEL_PACE[Math.min(level, LEVEL_PACE.length - 1)] * (1 + Math.sin(r.wob) * 0.025);
    if (s > 0 && s < tr.length) {
      const sec = tr.sectionAt(s);
      if (sec.vcap) v = Math.min(v, sec.vcap * 0.95);
      // set pieces are your shortcut; the field goes the long way round
      if (sec.closed) v *= 0.8;
      // busy and narrow streets slow everyone, not just you
      const dens = tr.stage.traffic?.density || 15;
      v *= 1 - Math.max(0, dens - 12) * 0.01;
      if (tr.stage.twoWay) v *= 0.85;
      const k = Math.abs(tr.kAt(s));
      if (k > 1e-4) v = Math.min(v, Math.sqrt(55 / k));
      // jams cost everyone: over the median and back against oncoming traffic
      const z = contraAt(tr, s);
      if (z && s > z.ramp - 40 && s < z.end) v *= 0.72;
    }
    return v;
  }

  update(dt) {
    if (!this.active) return;
    const g = this.game;
    const P = g.player;
    const T = g.traffic;
    const tr = P.track;
    const pp = this.progress();
    const refV = P.vmax;
    const level = tr.level ?? 0;
    const racing = g.state === 'race';
    let live = 0;
    for (const r of this.rivals) if (r.veh) live++;
    this.spawnCool = (this.spawnCool || 0) - dt;
    // the closest unspawned rival in range is the only one allowed to appear this frame
    this.nearest = null;
    let nd = 1e9;
    for (const r of this.rivals) {
      if (r.veh || r.cool > 0) continue;
      const rel = r.prog - this.routeBase - P.s;
      if (rel > -BEHIND && rel < AHEAD && Math.abs(rel) < nd) { nd = Math.abs(rel); this.nearest = r; }
    }
    for (const r of this.rivals) {
      r.wob += dt * 0.3;
      if (r.cool > 0) r.cool -= dt;
      const s = r.prog - this.routeBase;
      let v = this.paceAt(r, tr, s, refV, level);
      // keep the field within reach: leaders ease off, stragglers push
      const gap = r.prog - pp;
      if (gap > 900) v *= Math.max(0.82, 1 - (gap - 900) / 6000);
      else if (gap < -450) v *= Math.min(1.06, 1 + (-gap - 450) / 5000);
      if (!racing) v = 0;
      r.vT = v;
      if (r.veh) {
        const veh = r.veh;
        if (!T.list.includes(veh) || veh.track !== tr) { r.veh.rival = null; r.veh = null; live--; continue; }
        if (veh.wreck) continue;
        r.prog = this.routeBase + veh.s;
        r.v = veh.v;
        const rel = veh.s - P.s;
        // fold back into a number when out of range or heading into a set piece
        const blocked = closedAt(tr, veh.s + 60, 0) || this.contraBlock(tr, veh.s) || veh.s > tr.length - 80 || (tr.isFinal && veh.s > tr.goalS + 40);
        if (rel < -BEHIND - 30 || rel > AHEAD + 60 || blocked) { this.drop(r); live--; }
      } else {
        // virtual: accelerate toward pace
        r.v += clamp(v - r.v, -12 * dt, 15 * dt);
        r.prog += r.v * dt;
        const rel = s - P.s;
        if (live < MAX_LIVE && this.spawnCool <= 0 && r === this.nearest && r.cool <= 0 && rel > -BEHIND && rel < AHEAD && s > 5 && s < tr.length - 120 &&
            !(tr.isFinal && s > tr.goalS) && !closedAt(tr, s + 80, 0) && !this.contraBlock(tr, s) && !(P.air && Math.abs(rel) < 60)) {
          // only pop in where you can't see it happen
          const visible = rel > 40 && rel < 300;
          if (!visible || g.state === 'countdown' || g.state === 'story') {
            const veh = T.spawnEnemy(tr, 'rival', s, { model: r.model, speed: r.v, lane: r.lane ?? undefined });
            if (veh) {
              veh.rival = r;
              veh.color = this._c.set(r.color).clone();
              veh.enemy.base = v;
              r.veh = veh;
              live++;
              this.spawnCool = 2.5; // rivals trickle in one at a time, never in a pack
            }
          }
        }
      }
      if (r.veh) r.veh.enemy.vT = v;
    }
    // standings
    let ahead = 0;
    for (const r of this.rivals) if (r.prog > pp) ahead++;
    const pos = ahead + 1;
    if (pos !== this.position && racing) {
      g.onPosition?.(pos, this.position);
      this.position = pos;
      this.best = Math.min(this.best, pos);
    }
  }

  contraBlock(tr, s) {
    const z = contraAt(tr, s + 60);
    return z && s < z.end;
  }

  // the rival directly ahead of / behind you, with gap in seconds
  neighbours() {
    const pp = this.progress();
    let a = null, b = null;
    for (const r of this.rivals) {
      const d = r.prog - pp;
      if (d > 0 && (!a || d < a.d)) a = { r, d };
      if (d <= 0 && (!b || d > b.d)) b = { r, d };
    }
    const v = Math.max(20, this.game.player.v);
    return { ahead: a && { name: a.r.name, t: a.d / v }, behind: b && { name: b.r.name, t: -b.d / v } };
  }

  onWreck(veh) {
    const r = veh.rival;
    if (!r) return;
    r.prog -= 260;
    r.v = 0;
    r.cool = 5;
    r.veh = null;
    veh.rival = null;
    return r;
  }

  target(level) { return TARGETS[Math.min(level, TARGETS.length - 1)]; }
}
