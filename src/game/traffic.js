// Traffic: Dhaka's ordinary road users (rickshaws, CNGs, buses, cars, police
// and RAB pickups) and plenty of them: the road is meant to be
// busy. They are scenery that moves: nothing here ever slows a racer down.
// Anything a racer (you or a rival) runs into is flung off the road and gone a
// moment later. There are no lanes to keep to: everyone drifts across the whole road, bikes, CNGs and e-rickshaws most of all.
//
// Cars live at a distance G along the whole route, like the field does, so the
// road can cross district tracks.

import { oppLayout } from '../world/zones.js';
import * as THREE from 'three';
import { clamp, RNG } from '../core/util.js';

const MAX_CARS = 40; // moving cars on the road ahead at once
const MAX_ONCOMING = 14; // coming the other way on the opposite carriageway
const SPAWN_AHEAD = [220, 820];
const KEEP_BEHIND = 70, KEEP_AHEAD = 950;
// no near-black paint: at night it simply vanishes into the road
const CAR_COLORS = ['#f2f2ee', '#c9ccd0', '#6f8296', '#b02a30', '#3f6fa0', '#e8e2d0', '#8e9097', '#d8d2c0', '#4f8a5a', '#d9a23a', '#7e6aa8'];
const DARK_COLORS = ['#3c3c44', '#4c4c56', '#f2f2ee', '#62626c', '#d8d8d4'];

// weight is the share of traffic; speeds in m/s (every racer is far quicker)
const TYPES = {
  car: { models: ['axio', 'premio', 'allion', 'corolla'], speed: [16, 24], weight: 4, colors: CAR_COLORS, weave: 0.3 },
  rickshaw: { models: ['rickshaw0', 'rickshaw1', 'rickshaw2', 'rickshaw3'], speed: [5, 7], weight: 3.5, weave: 0.25 },
  cng: { models: ['cng'], speed: [12, 16], weight: 3, weave: 0.7 },
  tesla: { models: ['tesla0', 'tesla1', 'tesla2', 'tesla3'], speed: [7, 10], weight: 1.5, weave: 0.6 },
  suv: { models: ['prado', 'noah'], speed: [17, 25], weight: 1.4, colors: DARK_COLORS },
  micro: { models: ['hiace', 'noah'], speed: [14, 20], weight: 1.2, colors: CAR_COLORS },
  bus: { models: ['bus0', 'bus1', 'bus2'], speed: [11, 16], weight: 1.2 },
  truck: { models: ['truck0', 'truck1'], speed: [12, 17], weight: 0.6 },
  bike: { models: ['bike'], speed: [14, 22], weight: 1.2, weave: 0.9 },
  leguna: { models: ['leguna'], speed: [10, 14], weight: 0.6 },
  van: { models: ['van'], speed: [8, 12], weight: 0.6 },
  police: { models: ['policeHilux'], speed: [28, 36], weight: 0.35, beacon: true },
  rab: { models: ['rab'], speed: [30, 38], weight: 0.25, beacon: true },
};

export class Traffic {
  constructor(game) {
    this.game = game;
    this.rng = new RNG(777);
    this.cars = [];
    this.events = [];
    this.cool = 0;
    this.factor = 1; // (how busy the streets are; the pedestrians read it)
  }

  clear() {
    this.cars.length = 0;
    this.events.length = 0;
    this.cool = 1;
  }

  make(type, G, x, v, opts = {}) {
    const T = TYPES[type];
    const model = this.rng.pick(T.models);
    const md = this.game.fleet.md(model);
    if (!md) return null;
    const color = md.colorFixed || !T.colors ? [1, 1, 1] : null;
    const car = {
      type, model, md, G, x, v, w: md.wid / 2, l: md.len / 2, track: null, s: 0,
      weave: T.weave || 0, weaveT: this.rng.range(1, 5), tx: x,
      color: color ? new THREE.Color(1, 1, 1) : new THREE.Color(this.rng.pick(T.colors)),
      brake: !!opts.brake, beacon: !!T.beacon, wreck: null, yaw: opts.dir < 0 ? Math.PI : 0, roll: 0, pitch: 0, lift: 0, still: !!opts.still, dir: opts.dir || 1,
    };
    // the plain-bodied models (rickshaws, buses...) carry their own paint: tint them a little
    if (!T.colors && !color) car.color.setScalar(this.rng.range(0.85, 1.05));
    this.cars.push(car);
    return car;
  }

  free(G, x, l, w) {
    for (const o of this.cars) if (Math.abs(o.G - G) < o.l + l + 5 && Math.abs(o.x - x) < o.w + w + 1.2) return false;
    return true;
  }

  spawn(PG) {
    const race = this.game.race;
    const G = PG + this.rng.range(SPAWN_AHEAD[0], SPAWN_AHEAD[1]);
    const L = race.locate(G);
    if (!L) return;
    const tr = L.tr;
    if (tr.isFinal && L.s > tr.goalS - 120) return;
    if (L.s > tr.length - 60 && !tr.isFinal) return;
    const type = this.rng.weighted(Object.fromEntries(Object.entries(TYPES).map(([k, t]) => [k, t.weight])));
    const T = TYPES[type];
    const sc = Math.min(L.s, tr.length);
    const hw = tr.halfWAt(sc);
    // nobody keeps to a lane here: the emptiest of a few random spots across the whole road
    let x = 0, bc = 1e9;
    for (let k = 0; k < 4; k++) {
      const cx = this.rng.range(-hw + 1.3, hw - 1.3);
      let c = 0;
      for (const o of this.cars) if (Math.abs(o.G - G) < 120 && Math.abs(o.x - cx) < 2.2) c++;
      if (c < bc) { bc = c; x = cx; }
    }
    const md = this.game.fleet.md(T.models[0]);
    if (!this.free(G, x, md.len / 2, md.wid / 2)) return;
    this.make(type, G, x, this.rng.range(T.speed[0], T.speed[1]));
  }

  // a car coming the other way on the opposite carriageway of a divided road
  spawnOncoming(PG) {
    const race = this.game.race;
    const G = PG + this.rng.range(300, 820);
    const L = race.locate(G);
    if (!L) return;
    const tr = L.tr;
    const sc = Math.min(L.s, tr.length);
    if (tr.isFinal && L.s > tr.goalS - 100) return;
    if (L.s > tr.length - 80 && !tr.isFinal) return;
    if (this.game.world.sideTypeAt(tr, sc, 1) !== 'median') return;
    const o = oppLayout(tr, sc, tr.stage);
    const type = this.rng.weighted({ car: 4, rickshaw: 1.5, cng: 3, bus: 1.5, suv: 1.5, micro: 1.2, truck: 1, bike: 1 });
    const T = TYPES[type];
    const x = this.rng.range(o.near + 1.3, o.far - 1.3);
    const md = this.game.fleet.md(T.models[0]);
    if (!this.free(G, x, md.len / 2, md.wid / 2)) return;
    this.make(type, G, x, this.rng.range(T.speed[0], T.speed[1]) + 4, { dir: -1 });
  }

  fling(car, m) {
    const side = Math.sign(car.x - m.x) || (this.rng.chance(0.5) ? 1 : -1);
    // a proper launch: it leaves faster than you are going, well off to the side, high and tumbling
    car.wreck = {
      t: 0, vs: m.v * 1.2 + this.rng.range(6, 14), vx: side * this.rng.range(13, 24), vh: this.rng.range(11, 17),
      rollV: side * this.rng.range(6, 14), yawV: this.rng.sign() * this.rng.range(1.5, 5), pitchV: this.rng.range(-4, 4),
    };
    car.brake = false;
    this.events.push({ type: 'hit', car, by: m.player ? 'player' : 'rival' });
  }

  // bikes, CNGs and e-rickshaws drift into the next lane now and then
  weave(c, dt) {
    c.weaveT -= dt;
    if (c.weaveT <= 0) {
      c.weaveT = this.rng.range(1.5, 5);
      // everyone drifts: heavier vehicles a little, bikes, CNGs and e-rickshaws all over the road
      if (c.track && this.rng.chance(0.25 + c.weave * 0.75)) {
        const hw = c.track.halfWAt(Math.min(c.s, c.track.length));
        const tx = clamp(c.x + this.rng.range(-4.5, 4.5), -hw + c.w + 0.6, hw - c.w - 0.6);
        if (this.free(c.G, tx, c.l, c.w)) c.tx = tx;
      }
    }
    const dx = clamp(c.tx - c.x, -3.2 * dt, 3.2 * dt);
    c.x += dx;
    c.yaw = dx ? -Math.sign(dx) * 0.12 : c.yaw * 0.9;
    // alive on its springs: the body leans out of a lane change, and the light ones (rickshaws, CNGs, bikes,
    // e-rickshaws) jiggle over every rut in the road
    c.ph = (c.ph ?? this.rng.range(0, 6)) + dt * (c.weave > 0.5 ? 13 : 7);
    const jig = c.weave > 0.5 ? 0.025 : c.type === 'rickshaw' ? 0.035 : 0.006;
    c.lean = clamp((c.lean || 0) * 0.9 + (dt ? (dx / dt) * 0.006 : 0), -0.06, 0.06);
    c.roll = c.lean + Math.sin(c.ph) * jig;
    c.pitch = Math.sin(c.ph * 0.7 + 1) * jig * 0.5;
    c.lift = Math.abs(Math.sin(c.ph * 0.5)) * jig * 0.6;
  }

  // movers: everything that can hit traffic, [{G, x, v, hl, hw, player}]
  update(dt, go, movers) {
    const race = this.game.race;
    const PG = race.playerG();
    this.cool -= dt;
    if (go) {
      const alive = this.cars.reduce((n, c) => n + (c.wreck || c.still || c.dir < 0 ? 0 : 1), 0);
      const onc = this.cars.reduce((n, c) => n + (c.dir < 0 && !c.wreck ? 1 : 0), 0);
      if (onc < MAX_ONCOMING && this.rng.chance(dt * 2.5)) this.spawnOncoming(PG);
      if (alive < MAX_CARS && this.cool <= 0) { this.spawn(PG); if (alive < MAX_CARS - 4) this.spawn(PG); this.cool = this.rng.range(0.1, 0.3); }
    }
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (c.G < PG - KEEP_BEHIND || c.G > PG + KEEP_AHEAD || (c.wreck && c.wreck.t > 3.2)) { this.cars.splice(i, 1); continue; }
      if (c.wreck) {
        const w = c.wreck;
        w.t += dt;
        c.G += w.vs * dt;
        c.x += w.vx * dt;
        c.lift += w.vh * dt;
        w.vh -= 20 * dt;
        c.roll += w.rollV * dt;
        c.pitch += w.pitchV * dt;
        c.yaw += w.yawV * dt;
        if (c.lift < 0) { c.lift = 0; w.vh = Math.abs(w.vh) > 3 ? -w.vh * 0.45 : 0; w.vs *= 0.8; w.vx *= 0.85; w.rollV *= 0.7; w.pitchV *= 0.7; w.yawV *= 0.7; }
        w.vs *= Math.exp(-0.25 * dt);
      } else {
        // keep station behind whatever is ahead in the lane
        let v = c.v;
        if (!c.still) {
          for (const o of this.cars) {
            if (o === c || o.wreck || o.dir !== c.dir || Math.abs(o.x - c.x) > c.w + o.w + 0.8) continue;
            const gap = (o.G - c.G) * c.dir - o.l - c.l;
            if (gap > 0 && gap < 12 && o.v < v) v = o.v;
          }
          c.G += v * dt * c.dir;
          if (c.dir > 0) this.weave(c, dt);
        }
        // hit by a racer
        for (const m of movers) {
          if (Math.abs(c.G - m.G) < c.l + m.hl && Math.abs(c.x - m.x) < c.w + m.hw) { this.fling(c, m); break; }
        }
      }
      const L = race.locate(c.G);
      c.track = L ? L.tr : null;
      c.s = L ? L.s : 0;
    }
  }
}
