// Traffic: Dhaka-flavoured AI and instanced rendering for every model.
// Also hosts the enemies (police, RAB, street racers, the boss buses), since
// they share the road, the collision code and the instanced meshes.

import * as THREE from 'three';
import { buildTrafficModels, TRAFFIC_TYPES as BASE_TYPES } from './vehicles.js';
import { buildFxModels } from './carmodels.js';
import { LANE_W } from '../world/track.js';
import { FORK_OFF } from '../world/world.js';
import { medianW, oppHalf } from '../world/chunk.js';
import { contraAt, stallsAt, closedAt, oppLaneX, oppLayout } from '../world/zones.js';
import { clamp, damp, fx, RNG } from '../core/util.js';
import { shared } from '../world/materials.js';

const MAX_PER_MODEL = 40;
const CAR_COLORS = ['#f2f2ee', '#c9ccd0', '#1c1c1e', '#8a1d22', '#2b4a6b', '#e8e2d0', '#5a5a5e', '#f2f2ee', '#c9ccd0', '#d8d2c0', '#3a4a3a'];
const DARK_COLORS = ['#141416', '#1c1c1e', '#f2f2ee', '#2a2a2e', '#d8d8d4', '#e8e4dc'];
const RACER_COLORS = { supra: '#ff6a00', skyline: '#1d4fd8', celica: '#ffd200', chaser: '#f2f2ee', miata: '#c8102e' };

// overall traffic volume: sparse enough to weave through at full speed
const TRAFFIC_SCALE = 0.9;

export const TRAFFIC_TYPES = {
  ...BASE_TYPES,
  car: { models: ['axio', 'premio', 'allion', 'corolla'], speed: [15, 24], lanes: 'any', weave: 0.3, honkDodge: 0.4, colors: true },
  suv: { models: ['prado', 'noah', 'prado'], speed: [16, 26], lanes: 'right', weave: 0.25, honkDodge: 0.2, colors: 'dark' },
  micro: { models: ['hiace', 'noah'], speed: [14, 22], lanes: 'any', weave: 0.35, honkDodge: 0.35, colors: true },
  tesla: { models: ['tesla0', 'tesla1', 'tesla2', 'tesla3'], speed: [6, 9], lanes: 'any', weave: 0.6, honkDodge: 0.25, cutter: true, tippable: true },
  police: { models: ['policeHilux'], speed: [42, 46], lanes: 'any', weave: 0, honkDodge: 0 },
};

// enemies: hp in damage points; speed is a multiple of the player's top speed
export const ENEMY_TYPES = {
  police: { models: ['policeHilux'], hp: 100, speed: 1.04, ram: 6.5, siren: true, score: 6000, time: 2, label: 'POLICE', weight: 1.1 },
  rab: { models: ['rab'], hp: 170, speed: 1.1, ram: 8.5, siren: true, score: 9000, time: 3, label: 'RAB', weight: 1.4 },
  racer: { models: ['supra', 'skyline', 'celica', 'chaser', 'miata'], hp: 115, speed: 1.08, ram: 5.5, score: 7000, time: 2, label: 'RACER', weight: 0.9 },
  rival: { models: ['supra', 'skyline', 'celica', 'chaser', 'miata'], hp: 150, speed: 1.02, ram: 4.5, score: 5000, time: 0, label: 'RIVAL', weight: 1 },
  bossbus: { models: ['bossbus0', 'bossbus1'], hp: 240, speed: 0.97, ram: 9, score: 0, time: 0, label: 'BUS', weight: 2.6 },
};

export class Traffic {
  constructor(scene, assets, world) {
    this.scene = scene;
    this.world = world;
    this.models = { ...buildTrafficModels(assets.misc), ...buildFxModels(assets.fx) };
    this.meshes = {};
    this.tailMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.headMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.amberMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const dummyColor = new THREE.Color(1, 1, 1);
    for (const key in this.models) {
      const m = this.models[key];
      const bodyMat = m.atlas === 'fx' ? world.mats.fx : world.mats.misc;
      const mk = (geo, mat) => {
        if (!geo) return null;
        const im = new THREE.InstancedMesh(geo, mat, MAX_PER_MODEL);
        im.count = 0;
        im.frustumCulled = false;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        for (let i = 0; i < MAX_PER_MODEL; i++) im.setColorAt(i, dummyColor);
        im.instanceColor.setUsage(THREE.DynamicDrawUsage);
        scene.add(im);
        return im;
      };
      this.meshes[key] = {
        body: mk(m.body, bodyMat),
        tail: mk(m.tail, this.tailMat),
        head: mk(m.head, this.headMat),
        amber: mk(m.amber, this.amberMat),
        beacon: mk(m.beacon, this.amberMat),
        def: m,
      };
    }
    this.list = [];
    this.oncoming = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this._c = new THREE.Color();
    this.rng = new RNG(12345);
    this.time = 0;
    this.densityMul = 1;
    this.night = 0;
    this.nearMisses = [];
    this.honkReplies = [];
    this.events = [];
  }

  clear() {
    this.list.length = 0;
    this.oncoming.length = 0;
  }

  // ------------------------------------------------------------ spawning
  laneX(tr, s, lane) {
    const hw = tr.halfWAt(s);
    return -hw + LANE_W * (lane + 0.5);
  }

  ourLanes(tr, s) {
    const n = tr.lanesAt(s);
    if (tr.stage.twoWay && !tr.sectionAt(s).fork && !tr.sectionAt(s).diverge) return Math.max(1, Math.floor(n / 2));
    return n;
  }

  // lanes traffic may use here (stalls block an outer lane)
  laneRange(tr, s) {
    const n = this.ourLanes(tr, s);
    let lo = 0, hi = n - 1;
    const st = stallsAt(tr, s);
    if (st && n > 2) { if (st.side < 0) lo = 1; else hi = n - 2; }
    if (n > 2 && this.rampWindow(tr, s)) hi = Math.min(hi, n - 2);
    return [lo, hi];
  }

  // the stretch where the jam ramp sits in the right-hand lane: keep it empty
  rampWindow(tr, s) {
    // (the jam ramp is gone: the median is a free crossing)
    return null;
  }

  pickType(stage) {
    const mix = stage.traffic?.mix || { car: 1 };
    return this.rng.weighted(mix);
  }

  spawnable(tr, s) {
    if (closedAt(tr, s, 420)) return false;
    const z = contraAt(tr, s);
    if (z && s > z.ramp - 40 && s < z.jam0) return false; // keep the run-up to the ramp clear
    return true;
  }

  spawn(tr, s, opts = {}) {
    const stage = tr.stage;
    const type = opts.type || this.pickType(stage);
    const T = opts.T || TRAFFIC_TYPES[type];
    if (!T) return null;
    const model = opts.model || this.rng.pick(T.models);
    const md = this.models[model];
    if (!md) return null;
    const [lo, hi] = this.laneRange(tr, Math.min(s, tr.length));
    let lane = opts.lane;
    if (lane == null) {
      // fill every lane evenly: take the emptiest lane near here (slow types lean left, big SUVs right)
      const n = hi - lo + 1;
      let from = lo, to = hi;
      if (T.lanes === 'left') to = Math.max(lo, lo + Math.ceil(n * 0.6) - 1);
      else if (T.lanes === 'right') from = Math.min(hi, hi - Math.ceil(n * 0.6) + 1);
      const counts = new Map();
      for (const o of this.list) if (o.track === tr && !o.oncoming && Math.abs(o.s - s) < 160) counts.set(o.lane, (counts.get(o.lane) || 0) + 1);
      let best = [], bc = 1e9;
      for (let l = from; l <= to; l++) { const c = counts.get(l) || 0; if (c < bc) { bc = c; best = [l]; } else if (c === bc) best.push(l); }
      lane = this.rng.pick(best);
    }
    if (!opts.contra) lane = clamp(lane, opts.anyLane ? 0 : lo, opts.anyLane ? this.ourLanes(tr, s) - 1 : hi);
    const x = opts.x ?? (opts.contra ? oppLaneX(tr, s, stage, lane) : this.laneX(tr, Math.min(s, tr.length), lane) + this.rng.range(-0.5, 0.5));
    // keep a gap
    if (!opts.force) {
      for (const o of this.list) {
        if (o.track === tr && Math.abs(o.s - s) < (o.l + md.len / 2 + 6) && Math.abs(o.x - x) < 2.6) return null;
      }
    }
    const spd = opts.speed ?? this.rng.range(T.speed[0], T.speed[1]);
    const veh = {
      type, model, T, md, track: tr, s, x, lane,
      v: spd, vT: spd, base: spd, vx: 0,
      w: md.wid / 2, l: md.len / 2,
      brake: 0, state: 'drive', timer: this.rng.range(2, 6), laneT: lane,
      color: opts.color || this.colorFor(T, model, md), passed: false, honkCool: 0, oncoming: !!opts.oncoming || !!opts.contra, contra: !!opts.contra,
      yaw: 0, roll: 0, pitch: 0, lift: 0, bob: this.rng.next() * 10, special: opts.special || null, life: 0,
      wreck: null, enemy: null, cut: null,
    };
    this.list.push(veh);
    return veh;
  }

  colorFor(T, model, md) {
    if (md?.colorFixed) return new THREE.Color(1, 1, 1);
    if (RACER_COLORS[model]) return new THREE.Color(RACER_COLORS[model]);
    if (T.colors === true) return new THREE.Color(this.rng.pick(CAR_COLORS));
    if (T.colors === 'dark') return new THREE.Color(this.rng.pick(DARK_COLORS));
    const b = this.rng.range(0.85, 1.05);
    return new THREE.Color(b, b, b);
  }

  populate(tr, s0, s1, density) {
    const spacing = 1000 / Math.max(1, clamp(density, 13, 20) * TRAFFIC_SCALE);
    for (let s = s0; s < s1; s += spacing * this.rng.range(0.6, 1.4)) if (this.spawnable(tr, s)) this.spawn(tr, s);
    this.frontTr = tr;
    this.front = s1;
  }

  // nobody drives through anybody: a rear car caught overlapping the one ahead drops back behind it
  separate() {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (a.wreck || a.oncoming) continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (b.wreck || b.oncoming || b.track !== a.track) continue;
        const ds = b.s - a.s;
        if (Math.abs(ds) > a.l + b.l + 0.6) continue;
        if (Math.abs(b.x - a.x) > (a.w + b.w) * 0.92) continue;
        const [front, rear] = ds >= 0 ? [b, a] : [a, b];
        if (rear.enemy && (rear.enemy.role === 'rival' || rear.enemy.ramDur > 0)) continue;
        rear.s = front.s - front.l - rear.l - 0.6;
        rear.v = Math.min(rear.v, front.v);
      }
    }
  }

  // dense cluster blocking the whole carriageway: Dhaka jam
  spawnJam(tr, s, len) {
    const lanes = this.ourLanes(tr, s);
    for (let ss = s; ss < s + len - 14; ss += this.rng.range(8, 13)) {
      for (let l = 0; l < lanes; l++) {
        if (this.rng.chance(0.62)) {
          const type = this.rng.weighted({ rickshaw: 4, cng: 3, car: 2, bus: 1.2, bike: 1.5, leguna: 0.8, tesla: 2, micro: 0.8 });
          const v = this.spawn(tr, ss + this.rng.range(-2, 2), { type, lane: l, speed: this.rng.range(0.0, 1.2), anyLane: true });
          if (v) v.special = 'jam';
        }
      }
    }
  }

  // what the jam is queuing for: a police checkpoint with its cars slewed across the lanes
  spawnJamCause(tr, s) {
    const lanes = this.ourLanes(tr, s);
    for (const [l, yaw, back] of [[Math.min(1, lanes - 1), 0.45, 10], [Math.max(0, lanes - 2), -0.4, 16]]) {
      const v = this.spawn(tr, s - back, { T: { models: ['policeHilux'], speed: [0, 0], lanes: 'any', weave: 0, honkDodge: 0 }, type: 'police', model: 'policeHilux', lane: l, speed: 0, force: true, anyLane: true });
      if (v) { v.special = 'jam'; v.fixedYaw = yaw; v.v = 0; v.vT = 0; v.base = 0; }
    }
  }

  spawnBusRace(tr, s) {
    if (!this.spawnable(tr, s)) return;
    const a = this.spawn(tr, s, { type: 'bus', lane: 0, speed: 21 });
    const b = this.spawn(tr, s + 6, { type: 'bus', lane: 1, speed: 21.5 });
    if (a) a.special = 'race';
    if (b) b.special = 'race';
  }

  spawnVIP(tr, s) {
    const lanes = this.ourLanes(tr, s);
    if (closedAt(tr, s, 0)) return 0;
    const lane = Math.min(lanes - 1, 1);
    const p = this.spawn(tr, s, { type: 'police', model: 'policeHilux', lane, speed: 46, force: true });
    if (p) p.special = 'vip';
    for (let i = 1; i <= 3; i++) {
      const v = this.spawn(tr, s - i * 12, { type: 'suv', model: 'prado', lane, speed: 46, force: true });
      if (v) { v.special = 'vip'; v.color = new THREE.Color('#0c0c0e'); }
    }
    return lane;
  }

  // ------------------------------------------------------------ enemies
  spawnEnemy(tr, role, s, opts = {}) {
    const E = ENEMY_TYPES[role];
    const lanes = this.ourLanes(tr, Math.min(Math.max(0, s), tr.length));
    const lane = opts.lane ?? this.rng.int(0, lanes - 1);
    const model = opts.model || this.rng.pick(E.models);
    const v = this.spawn(tr, Math.max(1, s), { T: { models: E.models, speed: [20, 20], lanes: 'any', weave: 0, honkDodge: 0 }, type: 'enemy', model, lane, speed: opts.speed ?? 30, force: true, anyLane: true });
    if (!v) return null;
    v.enemy = { role, E, hp: E.hp * (opts.hpMul || 1), maxHp: E.hp * (opts.hpMul || 1), ramT: this.rng.range(1.2, 2.6), ramDur: 0, side: this.rng.sign(), hitBy: 0, lastHit: -9, boss: opts.boss || null, wobble: this.rng.next() * 10 };
    if (role === 'racer') v.color = new THREE.Color(RACER_COLORS[model] || '#ff6a00');
    return v;
  }

  enemiesNear(player, range = 200) {
    return this.list.filter((v) => v.enemy && !v.wreck && Math.abs(this.relS(v, player)) < range);
  }

  wreck(v, cause = 'player') {
    if (v.wreck) return;
    const big = v.enemy?.role === 'bossbus' || v.type === 'bus' || v.type === 'truck';
    v.wreck = {
      t: 0, vy: big ? 3 : 5 + this.rng.next() * 4, rollV: this.rng.sign() * (big ? 1.4 : 4 + this.rng.next() * 5),
      yawV: this.rng.sign() * (0.6 + this.rng.next() * 2), pitchV: (this.rng.next() - 0.5) * (big ? 0.2 : 3), cause, big,
    };
    v.brake = 1;
    this.events.push({ type: v.enemy ? 'takedown' : 'tipped', v, cause });
  }

  // ------------------------------------------------------------ update
  update(dt, player, world, opts = {}) {
    this.time += dt;
    this.separate();
    const tr = player.track;
    const ps = player.s;
    const density = clamp(tr.stage.traffic?.density || 15, 13, 20) * TRAFFIC_SCALE * this.densityMul * (opts.densityMul || 1);
    // keep traffic evenly spaced ahead: a moving frontier drops one car every ~spacing metres
    const spacing = 1000 / Math.max(1, density);
    if (this.frontTr !== tr) { this.frontTr = tr; this.front = ps + 250; }
    for (const v of this.list) if (v.track === tr && !v.oncoming && !v.enemy && v.special !== 'jam' && v.s > this.front && v.s < ps + 1000) this.front = v.s;
    if (this.front < ps + 200) this.front = ps + 200;
    let guard = 0;
    while (this.front < ps + 950 && guard++ < 4) {
      const sp = this.front + spacing * this.rng.range(0.6, 1.4);
      this.front = sp;
      if (sp < tr.length) { if (!tr.sectionAt(sp).fork && this.spawnable(tr, sp)) this.spawn(tr, sp); }
      else if (!tr.isFinal) {
        const kids = world.ensureChildren(tr);
        const k = kids && kids[0];
        if (k && this.spawnable(k, sp - tr.length)) this.spawn(k, sp - tr.length);
      }
    }
    // oncoming (two-way stages) — they share our road
    if (tr.stage.twoWay) {
      let onc = 0;
      for (const v of this.list) if (v.oncoming && v.track === tr && v.s > ps) onc++;
      if (onc < density * 0.95 * 0.6 && this.rng.chance(0.5)) {
        const sp = ps + this.rng.range(600, 900);
        if (sp < tr.length - 300 && !tr.sectionAt(sp).diverge && this.spawnable(tr, sp)) {
          const n = tr.lanesAt(sp);
          const lane = this.rng.int(Math.ceil(n / 2), n - 1);
          const v = this.spawn(tr, sp, { lane, oncoming: true, anyLane: true, type: this.rng.weighted({ rickshaw: 5, cng: 2, bike: 2, horse: 0.8, van: 1, car: 1, tesla: 2 }) });
          if (v) v.lane = lane;
        }
      }
    }
    // wrong-side traffic once you are over the median
    const cz = contraAt(tr, ps + 300);
    if (cz) {
      let onc = 0;
      for (const v of this.list) if (v.contra && v.track === tr && v.s > ps) onc++;
      if (onc < 9 && this.rng.chance(0.35)) {
        const sp = ps + this.rng.range(260, 520);
        if (sp > cz.ramp && sp < cz.end + 200) {
          const lanes = tr.stage.lanes;
          const lane = this.rng.int(0, lanes - 1);
          this.spawn(tr, sp, { contra: true, lane, speed: this.rng.range(9, 16), type: this.rng.weighted({ car: 3, bus: 1.2, cng: 2, micro: 1, truck: 0.7, bike: 1 }) });
        }
      }
    }
    this.updateOpposite(dt, player, world);

    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const v = list[i];
      v.life += dt;
      // anything parked on the jam ramp itself goes away while it is still far off
      if (!v.enemy && !v.contra && !v.oncoming && v.special !== 'jam' && v.track === tr && v.s - ps > 45) {
        const rz = this.rampWindow(tr, v.s);
        if (rz && v.s > rz.ramp - 25 && v.s < rz.ramp + 60 && v.x > tr.halfWAt(Math.min(v.s, tr.length)) - LANE_W * 1.2) { list.splice(i, 1); continue; }
      }
      // remove far behind / far ahead / on abandoned branches
      if (v.track !== tr && v.track !== tr.chosen && !(tr.children && tr.children.includes(v.track)) && v.track !== tr.parent) { list.splice(i, 1); continue; }
      if (v.track.abandoned && player.track !== v.track) { list.splice(i, 1); continue; }
      const rel = this.relS(v, player);
      if (rel < (v.enemy && !v.wreck ? -260 : -90) || rel > 1300) { list.splice(i, 1); continue; }
      if (v.wreck) this.updateWreck(v, dt);
      else if (v.enemy) this.driveEnemy(v, dt, player, world);
      else this.drive(v, dt, player);
      // cross onto a child track at a fork
      if (v.s > v.track.length && !v.track.isFinal) {
        const kids = world.ensureChildren(v.track);
        if (!kids) { list.splice(i, 1); continue; }
        let side = v.x < 0 ? -1 : 1;
        if (v.enemy && player.track.parent === v.track) side = player.track.side; // they follow you
        const child = side < 0 ? kids[0] : kids[1];
        if (v.track.chosen && child !== v.track.chosen) { list.splice(i, 1); continue; }
        v.s -= v.track.length;
        v.x -= side * FORK_OFF;
        v.track = child;
        v.lane = clamp(Math.round((v.x + child.halfWAt(v.s)) / LANE_W - 0.5), 0, this.ourLanes(child, v.s) - 1);
        v.laneT = v.lane;
      }
      if (v.oncoming && v.s < 0) { list.splice(i, 1); continue; }
    }
    this.enemyContacts(dt);
    this.collide(dt, player, world);
  }

  relS(v, player) {
    if (v.track === player.track) return v.s - player.s;
    if (v.track.parent === player.track) return v.s + player.track.length - player.s;
    if (player.track.parent === v.track) return v.s - (player.s + v.track.length);
    return 9999;
  }

  drive(v, dt, player) {
    const T = v.T;
    const tr = v.track;
    v.honkCool = Math.max(0, v.honkCool - dt);
    if (v.oncoming) {
      v.s -= v.v * dt;
      v.yaw = Math.PI;
      if (v.contra) {
        const lx = oppLaneX(tr, Math.max(0, v.s), tr.stage, v.lane) + (v.dodge || 0);
        v.x = damp(v.x, lx, 2, dt);
        v.dodge = damp(v.dodge || 0, 0, 0.6, dt);
      } else {
        const lx = this.laneX(tr, Math.max(0, v.s), v.lane);
        v.x = damp(v.x, lx, 2, dt);
      }
      v.brake = 0;
      return;
    }
    const sNow = Math.min(v.s, tr.length);
    const [lo, hi] = this.laneRange(tr, sNow);
    // leader in our lane
    let lead = null, gap = 1e9;
    for (const o of this.list) {
      if (o === v || o.track !== v.track || o.oncoming) continue;
      const d = o.s - v.s;
      if (d > 0 && d < 40 && Math.abs(o.x - v.x) < (o.w + v.w) * 0.9) {
        if (d < gap) { gap = d; lead = o; }
      }
    }
    // the player counts as a leader too (so traffic does not drive through you from behind)
    if (player.track === v.track && !player.air) {
      const d = player.s - v.s;
      if (d > 0 && d < 30 && Math.abs(player.x - v.x) < (player.halfW + v.w) * 0.9 && d < gap) { gap = d; lead = { v: player.v, l: player.halfL }; }
    }
    let vT = v.base;
    if (v.special === 'race') vT = v.base + Math.sin(this.time * 0.7 + v.bob) * 3;
    if (v.special === 'jam') vT = Math.max(0, Math.sin(this.time * 0.3 + v.bob)) * 1.2;
    if (v.state === 'stop') {
      vT = 0;
      v.timer -= dt;
      if (v.timer <= 0) { v.state = 'drive'; v.timer = this.rng.range(6, 14); }
    }
    // set-piece closures: queue up at the barrier, outer lanes only
    const cl = closedAt(tr, v.s, 420);
    if (cl && v.s < cl.s0) {
      const lanes = this.ourLanes(tr, sNow);
      v.laneT = v.lane < lanes / 2 ? 0 : lanes - 1;
      const stopAt = cl.s0 - 14;
      if (v.s > stopAt - 60) vT = Math.min(vT, Math.max(0, (stopAt - v.s) * 0.4));
    }
    // a Tesla sees you coming and decides this is its lane now
    if (T.cutter) this.teslaCut(v, dt, player);
    if (v.cut) vT = Math.min(vT, v.cut.v);
    if (lead && v.special !== 'vip' && v.special !== 'racer') {
      const want = gap - (lead.l || 2) - v.l - 2.5;
      if (want < 12) vT = Math.min(vT, (lead.v || 0) * clamp(want / 12, 0, 1.1));
    }
    const dv = vT - v.v;
    v.v += clamp(dv, -9 * dt, 3 * dt);
    v.brake = damp(v.brake, dv < -0.5 || v.v < 0.5 ? 1 : 0, 10, dt);
    v.s += v.v * dt;

    // lane decisions
    v.timer -= dt;
    if (v.state === 'drive' && v.timer <= 0 && !v.cut && v.special !== 'jam') {
      v.timer = this.rng.range(2, 6) / Math.max(0.15, T.weave);
      const r = this.rng.next();
      if (T.stops && r < 0.3 && v.special !== 'race') {
        v.laneT = lo;
        v.state = 'toStop';
      } else if (r < T.weave || (lead && gap < 18)) {
        const dir = this.rng.sign();
        const nl = clamp(v.laneT + dir, lo, hi);
        if (this.laneFree(v, nl)) v.laneT = nl;
      }
    }
    if (v.state === 'toStop' && Math.abs(v.x - this.laneX(tr, sNow, lo)) < 0.6) {
      v.state = 'stop';
      v.timer = this.rng.range(2.5, 5);
    }
    if (v.special === 'race') {
      if (this.rng.chance(dt * 0.6)) v.laneT = clamp(v.laneT + this.rng.sign(), lo, hi);
    }
    if (!v.cut && v.special !== 'jam') v.laneT = clamp(v.laneT, lo, hi);
    const lx = v.cut ? v.cut.x : this.laneX(tr, sNow, v.laneT) + (v.type === 'rickshaw' || v.type === 'van' ? -0.6 : 0);
    const prevX = v.x;
    const latSpd = v.cut ? 4.2 : v.type === 'bike' ? 3.5 : v.type === 'cng' || v.type === 'tesla' ? 2.4 : 1.4;
    v.x += clamp(lx - v.x, -latSpd * dt, latSpd * dt);
    // keep inside the road during width changes
    const hw = tr.halfWAt(sNow);
    v.x = clamp(v.x, -hw + v.w + 0.1, hw - v.w - 0.1);
    v.yaw = v.fixedYaw != null ? v.fixedYaw : Math.atan2(-(v.x - prevX) / Math.max(dt, 1e-4), Math.max(v.v, 1)) * 0.8;
  }

  teslaCut(v, dt, player) {
    if (v.cut) {
      v.cut.t -= dt;
      if (v.cut.t <= 0) { v.cut = null; v.laneT = clamp(Math.round((v.x + v.track.halfWAt(Math.min(v.s, v.track.length))) / LANE_W - 0.5), 0, this.ourLanes(v.track, v.s) - 1); }
      return;
    }
    if (player.track !== v.track || player.air || v.cutDone || this.rampWindow(v.track, v.s)) return;
    const d = v.s - player.s;
    const dx = Math.abs(player.x - v.x);
    if (d > 16 && d < 44 && dx > 1.6 && dx < 7 && player.v > v.v + 10 && this.rng.chance(dt * 1.6)) {
      v.cut = { t: 2.6, x: player.x, v: 1.5 };
      v.cutDone = true;
      v.honkCool = 0;
      this.events.push({ type: 'tesla', v });
    }
  }

  // ------------------------------------------------------------ enemy AI
  driveEnemy(v, dt, player, world) {
    const E = v.enemy.E;
    const en = v.enemy;
    const tr = v.track;
    const sNow = Math.min(v.s, tr.length);
    const rel = this.relS(v, player);
    const pv = player.v;
    const vmaxE = player.vmax * E.speed;
    const hw = tr.halfWAt(sNow);
    en.ramT -= dt;
    en.wobble += dt;
    // player x in this vehicle's track space
    const px = v.track === player.track ? player.x : v.track.parent === player.track ? player.x - v.track.side * FORK_OFF : player.track.parent === v.track ? player.x + player.track.side * FORK_OFF : player.x;
    // set pieces are closed: chasers pile into the barrier at the entrance
    const cl = closedAt(tr, v.s + v.l + 2, 0);
    if (cl && !v.wreck && en.role !== 'bossbus' && en.role !== 'rival') {
      const bs = cl.s0 + (tr.sectionAt(Math.min(cl.s0 + 1, tr.length)).closeLead ?? 0);
      if (v.s + v.l > bs - 2) { v.vx = (fx.next() - 0.5) * 6; this.damageEnemy(v, 999, 'barrier'); return; }
    }
    let vT, xT;
    if (en.role === 'rival') {
      // racing, not hunting: hold a line, overtake traffic, lean on you when you are alongside
      vT = Math.min(en.vT ?? en.base ?? 40, vmaxE);
      en.lineT = (en.lineT ?? 0) - dt;
      if (en.lineT <= 0 || en.lineX == null) {
        en.lineT = 2 + this.rng.next() * 4;
        const lanes = this.ourLanes(tr, sNow);
        en.lineX = this.laneX(tr, sNow, this.rng.int(0, lanes - 1));
      }
      xT = clamp(en.lineX, -hw + v.w + 0.6, hw - v.w - 0.6);
      if (rel > 2 && rel < 22 && Math.abs(px - v.x) < 3.5 && this.rng.chance(dt * 0.5)) en.lineX = px; // block
      if (Math.abs(rel) < 4 && en.ramT <= 0 && this.rng.chance(dt * 0.8)) { en.ramDur = 0.35; en.ramT = 3 + this.rng.next() * 3; }
    } else if (en.role === 'bossbus') {
      // drunk: lurching, swerving, trying to squash you, racing each other
      const lurch = Math.sin(en.wobble * 0.9) * 0.6 + Math.sin(en.wobble * 2.3 + 1) * 0.25;
      // ahead: hog the road and make you earn the overtake; behind: floor it
      vT = clamp(pv + (rel < -10 ? 22 : rel > 25 ? -14 : rel > 6 ? -4 + Math.sin(en.wobble * 0.5) * 5 : 2 + Math.sin(en.wobble * 0.5) * 6), 8, vmaxE);
      xT = px * 0.6 + lurch * hw * 0.8 + en.side * 1.5;
      if (en.ramT <= 0 && Math.abs(rel) < 10) { en.ramDur = 0.7; en.ramT = 2.2 + this.rng.next() * 2; }
    } else if (rel < -8) {
      // closing in from behind
      vT = Math.min(vmaxE, pv + 14);
      xT = px + en.side * 3.2;
    } else if (rel > 10) {
      // ahead: police brake-check you, racers stay ahead
      if (en.role === 'racer') { vT = Math.min(vmaxE * 0.97, pv + 3); xT = px + Math.sin(en.wobble) * 3; }
      else { vT = Math.max(12, pv - 6); xT = px; }
    } else {
      // alongside: match speed and wait for the moment
      vT = pv + (rel < 0 ? 3 : -2);
      xT = px + en.side * (v.w + player.halfW + 0.9);
      if (en.ramT <= 0) { en.ramDur = 0.55; en.ramT = 1.6 + this.rng.next() * 2.2; }
    }
    // stay off the jam ramp so it is always a clean run-up
    const rw = this.rampWindow(tr, v.s + 40);
    if (rw && v.s > rw.ramp - 720 && v.s < rw.ramp + 70 && en.role !== 'bossbus') xT = Math.min(xT, hw - LANE_W * 1.7);
    // dodge slow traffic ahead
    for (const o of this.list) {
      if (o === v || o.track !== v.track || o.enemy || o.oncoming) continue;
      const d = o.s - v.s;
      if (d > 0 && d < 30 && Math.abs(o.x - v.x) < o.w + v.w + 0.5) {
        const room = (o.x > 0 ? -1 : 1);
        xT = o.x + room * (o.w + v.w + 1.2);
        if (d < 12 && en.role !== 'rival') vT = Math.min(vT, o.v + 4);
      }
    }
    // the ram itself
    let vxT = clamp((xT - v.x) * 1.6, -6, 6);
    if (en.ramDur > 0) {
      en.ramDur -= dt;
      vxT = Math.sign(px - v.x || 1) * E.ram;
    }
    v.vx = damp(v.vx, vxT, en.role === 'bossbus' ? 3 : 6, dt);
    const dv = vT - v.v;
    v.v = clamp(v.v + clamp(dv, -12 * dt, (en.role === 'bossbus' ? 5 : en.role === 'rival' ? 15 : 9) * dt), 0, vmaxE);
    v.s += v.v * dt;
    v.x += v.vx * dt;
    // walls: slamming into the edge hurts
    const lim = hw - v.w - 0.15;
    if (Math.abs(v.x) > lim) {
      if (Math.abs(v.vx) > 3.5) this.damageEnemy(v, Math.abs(v.vx) * 7, 'wall');
      v.x = Math.sign(v.x) * lim;
      v.vx *= -0.3;
    }
    v.yaw = -v.vx * 0.04;
    v.roll = damp(v.roll, -v.vx * (en.role === 'bossbus' ? 0.03 : 0.012), 4, dt);
    v.brake = dv < -1 ? 1 : 0;
    // into the back of traffic
    for (const o of this.list) {
      if (o === v || o.track !== v.track || o.enemy || o.wreck) continue;
      const d = o.s - v.s;
      if (Math.abs(d) < o.l + v.l && Math.abs(o.x - v.x) < o.w + v.w) {
        const relv = v.v - (o.oncoming ? -o.v : o.v);
        if (en.role === 'rival' && !o.oncoming) {
          // rivals bully their way through: shove the slowpoke aside, lose a little speed
          if (relv > 2) { o.x += Math.sign(o.x - v.x || 1) * 1.4; o.v += relv * 0.3; v.v *= 0.9; if (o.T.tippable && relv > 15) this.wreck(o, 'enemy'); }
          continue;
        }
        if (relv > 9) {
          this.damageEnemy(v, relv * (en.role === 'bossbus' ? 1.2 : 4.5), 'traffic');
          if (o.T.tippable || relv > 20) this.wreck(o, 'enemy');
          else { o.v += relv * 0.4; o.x += Math.sign(o.x - v.x || 1) * 0.6; }
        }
        v.v = Math.min(v.v, o.v);
        v.s = o.s - o.l - v.l - 0.1;
      }
    }
  }

  damageEnemy(v, dmg, cause) {
    const en = v.enemy;
    if (!en || v.wreck || dmg <= 0) return;
    if (cause === 'player') en.playerT = this.time;
    en.hp -= dmg;
    en.lastHit = this.time;
    this.events.push({ type: 'enemyHit', v, dmg, cause });
    if (en.hp <= 0) this.wreck(v, cause);
  }

  // enemies bumping each other (the boss buses love this)
  enemyContacts(dt) {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (!a.enemy || a.wreck) continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (!b.enemy || b.wreck || b.track !== a.track) continue;
        const dx = b.x - a.x, ds = b.s - a.s;
        const ox = a.w + b.w - Math.abs(dx), os = a.l + b.l - Math.abs(ds);
        if (ox <= 0 || os <= 0) continue;
        const push = Math.sign(dx || 1);
        const rv = Math.abs(a.vx - b.vx);
        if (ox < os) {
          a.x -= push * ox * 0.5; b.x += push * ox * 0.5;
          if (rv > 3) { this.damageEnemy(a, rv * 6, 'enemy'); this.damageEnemy(b, rv * 6, 'enemy'); this.events.push({ type: 'clang', v: a }); }
          const t = a.vx; a.vx = b.vx * 0.6; b.vx = t * 0.6;
        } else if (ds > 0) { a.v = Math.min(a.v, b.v); a.s = b.s - b.l - a.l - 0.1; }
        else { b.v = Math.min(b.v, a.v); b.s = a.s - a.l - b.l - 0.1; }
      }
    }
  }

  updateWreck(v, dt) {
    const w = v.wreck;
    w.t += dt;
    if (v.oncoming) v.s -= v.v * dt; else v.s += v.v * dt;
    v.v = Math.max(0, v.v - (w.big ? 7 : 14) * dt);
    v.x += (v.vx || 0) * dt;
    v.vx = damp(v.vx || 0, 0, 2, dt);
    w.vy -= 22 * dt;
    v.lift += w.vy * dt;
    if (v.lift < 0) {
      v.lift = 0;
      w.vy = Math.abs(w.vy) > 3 ? -w.vy * 0.35 : 0;
      w.rollV *= 0.55; w.yawV *= 0.6; w.pitchV *= 0.5;
      // settle on a side or the roof
      if (Math.abs(w.vy) < 0.1) {
        const tgt = Math.round(v.roll / (Math.PI / 2)) * (Math.PI / 2);
        v.roll = damp(v.roll, tgt, 4, dt);
        v.pitch = damp(v.pitch, 0, 4, dt);
      }
    }
    v.roll += w.rollV * dt;
    v.yaw += w.yawV * dt;
    v.pitch += w.pitchV * dt;
    v.brake = 1;
  }

  laneFree(v, lane) {
    const x = this.laneX(v.track, Math.min(v.s, v.track.length), lane);
    for (const o of this.list) {
      if (o === v || o.track !== v.track) continue;
      if (Math.abs(o.s - v.s) < o.l + v.l + 6 && Math.abs(o.x - x) < o.w + v.w + 0.4) return false;
    }
    return true;
  }

  honk(player) {
    let reacted = 0;
    for (const v of this.list) {
      if (v.track !== player.track || v.honkCool > 0 || v.enemy || v.wreck) continue;
      const d = v.s - player.s;
      if (d < 0 || d > 70) continue;
      if (Math.abs(v.x - player.x) > 2.8) continue;
      v.honkCool = 2.5;
      if (v.contra) {
        // oncoming drivers flinch toward their kerb
        if (this.rng.chance(0.6)) { v.dodge = (v.x > player.x ? 1 : -1) * 2.2; reacted++; }
        continue;
      }
      if (v.oncoming) continue;
      if (this.rng.chance(v.T.honkDodge)) {
        const [lo, hi] = this.laneRange(v.track, v.s);
        const dir = v.x > player.x ? 1 : -1;
        const nl = clamp(v.laneT + dir, lo, hi);
        if (nl !== v.laneT && this.laneFree(v, nl)) { v.laneT = nl; reacted++; }
        else if (this.laneFree(v, clamp(v.laneT - dir, lo, hi))) { v.laneT = clamp(v.laneT - dir, lo, hi); reacted++; }
      }
      if (v.T.bell) this.honkReplies.push({ kind: 'bell', d });
      else if (this.rng.chance(0.3)) this.honkReplies.push({ kind: v.type === 'bus' ? 'busHorn' : v.type === 'cng' ? 'cngHorn' : 'carHorn', d });
    }
    return reacted;
  }

  collide(dt, player, world) {
    if (player.crash || player.air) return;
    const pw = player.halfW * 0.92, pl = player.halfL * 0.92;
    const boost = player.boosting ? 1 : 0;
    for (const v of this.list) {
      if (v.track !== player.track) continue;
      const ds = v.s - player.s;
      const dx = v.x - player.x;
      const ox = v.w + pw - Math.abs(dx);
      const os = v.l + pl - Math.abs(ds);
      // near-miss bookkeeping: passing a vehicle at speed with a small gap
      if (!v.oncoming && !v.passed && ds < 0 && player.v > v.v + 8 && !v.wreck) {
        v.passed = true;
        const gapX = Math.abs(dx) - (v.w + player.halfW);
        if (gapX < 1.1 && gapX > -0.05 && player.v > 24) this.nearMisses.push({ gap: gapX, type: v.type });
      }
      if (v.oncoming && !v.passed && ds < 0 && !v.wreck) {
        v.passed = true;
        const gapX = Math.abs(dx) - (v.w + player.halfW);
        if (gapX < 1.6 && gapX > -0.05) this.nearMisses.push({ gap: gapX, type: v.type, oncoming: true });
      }
      if (ox <= 0 || os <= 0) continue;
      if (v.ghost && this.time < v.ghost) continue;
      if (v.wreck) {
        if (v.wreck.t < 0.4) continue;
        player.v *= boost ? 0.85 : 0.6;
        v.x += Math.sign(dx || 1) * 1.5;
        v.ghost = this.time + 0.6;
        player.emit('hit', { type: v.type, hard: true });
        continue;
      }
      if (v.oncoming) {
        if (boost && v.T.tippable) { this.wreck(v, 'player'); player.v *= 0.8; continue; }
        player.startCrash('flip');
        this.wreck(v, 'player');
        v.v = 0;
        return;
      }
      if (v.enemy) { this.ramEnemy(v, player, ds, dx, ox, os, boost); continue; }
      if (os < ox && ds > 0) {
        // rear-ending them
        const rel = player.v - v.v;
        if (v.T.tippable && rel > 8) {
          // Teslas go flying
          v.v = player.v * 0.8;
          v.vx = Math.sign(dx || 1) * 3;
          this.wreck(v, 'player');
          player.v *= boost ? 0.95 : 0.78;
          player.emit('hit', { type: v.type, hard: true });
          continue;
        }
        const big = v.type === 'bus' || v.type === 'brtc' || v.type === 'truck';
        if (boost && !big && rel > 14) {
          // nitro turns you into a battering ram
          v.v = player.v * 0.9;
          v.vx = Math.sign(dx || 1) * 4;
          this.wreck(v, 'player');
          player.v *= 0.9;
          player.emit('hit', { type: v.type, hard: true });
          continue;
        }
        if (rel > 14) {
          // arcade bump: lose a chunk of speed, shove them aside, keep racing
          player.v = Math.max(v.v + 4, player.v * (big ? 0.55 : 0.68));
          player.vx = -Math.sign(dx || 1) * 3;
          v.v += 5;
          v.x += Math.sign(dx || 1) * 1.6;
          v.ghost = this.time + 0.6;
          player.emit('hit', { type: v.type, hard: true });
        }
        else {
          player.v = Math.min(player.v, v.v * 0.9);
          player.s = v.s - v.l - pl - 0.05;
          player.emit('hit', { type: v.type });
        }
        v.honkCool = 0;
        this.honkReplies.push({ kind: v.T.bell ? 'bell' : 'carHorn', d: 2 });
      } else if (os < ox && ds < 0) {
        // they rear-ended us (VIP convoy)
        player.v = Math.max(player.v, v.v * 0.8);
        v.v = player.v * 0.95;
        v.s = player.s - pl - v.l - 0.1;
        player.emit('hit', { type: v.type, fromBehind: true });
      } else {
        // side swipe: push apart
        const push = Math.sign(dx || 1);
        player.x -= push * ox * 0.6;
        v.x += push * ox * 0.4;
        player.vx = -push * 3;
        player.v *= 0.94;
        if (v.T.tippable && Math.abs(player.vx) > 2) this.wreck(v, 'player');
        player.emit('hit', { type: v.type, side: true });
      }
    }
  }

  ramEnemy(v, player, ds, dx, ox, os, boost) {
    const en = v.enemy;
    const E = en.E;
    const pw = player.halfW * 0.92, pl = player.halfL * 0.92;
    if (os < ox) {
      if (ds > 0) {
        // shunting them from behind
        const rel = Math.max(0, player.v - v.v);
        this.damageEnemy(v, rel * 3.2 / E.weight + boost * 45, 'player');
        v.v += rel * 0.6;
        player.v -= rel * 0.35;
        player.s = v.s - v.l - pl - 0.05;
        if (rel > 6) player.emit('hit', { type: 'enemy', hard: rel > 15 });
      } else {
        // they shunt you
        const rel = Math.max(0, v.v - player.v);
        player.v += rel * 0.5;
        v.v -= rel * 0.6;
        v.s = player.s - pl - v.l - 0.1;
        player.emit('hit', { type: 'enemy', fromBehind: true });
      }
      return;
    }
    // side contact
    const push = Math.sign(dx || 1); // +1: enemy is to our right
    const relVx = (player.vx - v.vx) * push;
    if (relVx > 0.8) {
      // we hit them
      const dmg = (relVx * 11 + 6) / E.weight + boost * 40;
      this.damageEnemy(v, dmg, 'player');
      v.vx = push * (relVx * 0.9 / E.weight + 2.5);
      player.vx *= 0.25;
      this.events.push({ type: 'ram', v, dmg, by: 'player' });
    } else {
      // they hit us
      const force = Math.max(1.5, -relVx);
      player.vx = -push * (force * 0.85 * E.weight + 1.5);
      v.vx = push * 1.2;
      if (force > E.ram * 0.75 && !boost && en.ramDur > 0) player.startSpin(-push);
      this.events.push({ type: 'ram', v, by: 'enemy' });
      en.ramDur = 0;
    }
    player.x -= push * ox * 0.55;
    v.x += push * ox * 0.45;
    en.playerT = this.time;
    player.v *= 0.985;
    player.emit('hit', { type: 'enemy', side: true });
  }

  // decorative opposite carriageway (median roads)
  updateOpposite(dt, player, world) {
    const tr = player.track;
    const st = tr.stage;
    const sec = tr.sectionAt(Math.min(player.s + 200, tr.length));
    const has = (tr.sectionAt(player.s).R || st.R) === 'median' || sec.R === 'median' || (!sec.R && st.R === 'median');
    const arr = this.oncoming;
    for (let i = arr.length - 1; i >= 0; i--) {
      const o = arr[i];
      o.s -= o.v * dt;
      if (o.track !== tr || o.s < player.s - 60 || contraAt(tr, o.s)) arr.splice(i, 1);
    }
    if (!has) return;
    const target = ((st.traffic?.density || 15) * 0.9 * 1000) / 1000;
    if (arr.length < target && this.rng.chance(0.4)) {
      const s = player.s + this.rng.range(500, 950);
      if (s > tr.length - 50) return;
      if ((tr.sectionAt(s).R || st.R) !== 'median') return;
      if (contraAt(tr, s) || closedAt(tr, s, 50)) return;
      const type = this.pickType(st);
      const T = TRAFFIC_TYPES[type];
      if (!T) return;
      const model = this.rng.pick(T.models);
      const md = this.models[model];
      const lanes = st.lanes;
      const lane = this.rng.int(0, lanes - 1);
      const xBase = tr.halfWAt(s) + medianW(st);
      const x = xBase + oppHalf(st) * 2 - LANE_W * (lane + 0.5);
      arr.push({ track: tr, s, x, xRel: x - tr.halfWAt(s), v: this.rng.range(T.speed[0], T.speed[1]), model, md, color: this.colorFor(T, model, md), opp: true });
    }
  }

  // ------------------------------------------------------------ rendering
  render(player, night, camS, camX = player.x) {
    const counts = {};
    for (const key in this.meshes) counts[key] = 0;
    const m = this._m, q = this._q, e = this._e, p = this._p, sc = this._s;
    const c = this._c;
    const tailK = 0.35 + night * 0.65;
    const headK = night * 1.1;
    const bodyK = 1 + night * 1.6;
    const flash = Math.sin(this.time * 9) > 0;
    const lights = [];
    const put = (veh, track, s, x, yaw) => {
      const M = this.meshes[veh.model];
      if (!M) return;
      // never let a vehicle swallow the chase camera: hide anything between the lens and the car
      if (track === player.track && s > camS - veh.l - 1.5 && s < player.s - player.halfL && Math.abs(x - camX) < veh.w + 1.3) return;
      const i = counts[veh.model];
      if (i >= MAX_PER_MODEL) return;
      counts[veh.model]++;
      track.point(s, x, 0, p);
      const ry = track.yawAt(s) + yaw;
      const bob = veh.type === 'rickshaw' || veh.type === 'horse' || veh.type === 'tesla' ? Math.abs(Math.sin(this.time * 6 + veh.bob)) * 0.04 : 0;
      p.y += bob + (veh.lift || 0) + (veh.wreck ? veh.w * Math.abs(Math.sin(veh.roll)) + veh.md.hgt * 0.9 * Math.max(0, -Math.cos(veh.roll)) : 0);
      e.set(veh.pitch || 0, -ry, veh.roll || 0, 'YXZ');
      q.setFromEuler(e);
      m.compose(p, q, sc);
      M.body.setMatrixAt(i, m);
      const hurt = veh.enemy && this.time - veh.enemy.lastHit < 0.12;
      // at night the shared world lighting leaves vehicles as black slabs; lift them so they read
      M.body.setColorAt(i, hurt ? c.setRGB(3, 3, 3) : c.copy(veh.color || c.set(1, 1, 1)).multiplyScalar((veh.wreck ? 0.45 : 1) * bodyK));
      const bk = veh.brake > 0.5 ? 2.2 : tailK;
      if (M.tail) { M.tail.setMatrixAt(i, m); M.tail.setColorAt(i, c.setScalar(veh.wreck ? 0.05 : bk)); }
      if (M.head) { M.head.setMatrixAt(i, m); M.head.setColorAt(i, c.setScalar(veh.wreck ? 0 : Math.max(headK, veh.enemy || veh.contra ? 0.6 : 0.4))); }
      if (M.amber) {
        M.amber.setMatrixAt(i, m);
        const hz = veh.state === 'stop' || veh.state === 'toStop' ? (flash ? 1.2 : 0.05) : 0.25 + night * 0.6;
        M.amber.setColorAt(i, c.setScalar(veh.wreck ? (flash ? 1 : 0) : hz));
      }
      if (M.beacon) {
        M.beacon.setMatrixAt(i, m);
        const ph = Math.sin(this.time * 14 + veh.bob) > 0;
        M.beacon.setColorAt(i, veh.wreck ? c.setScalar(0.05) : ph ? c.setRGB(0.1, 0.2, 1.6) : c.setRGB(1.6, 0.1, 0.1));
      }
    };
    for (const v of this.list) {
      put(v, v.track, v.s, v.x, v.oncoming ? Math.PI + (v.yaw - Math.PI) * (v.wreck ? 1 : 0) : v.yaw);
      if (v.track === player.track) {
        const d = v.s - player.s;
        if (d > -2 && d < 140) lights.push({ d: Math.abs(d), s: v.s, x: v.x, k: v.oncoming ? headK : (v.brake > 0.5 ? 1.4 : tailK * 0.7), w: v.oncoming ? 1 : 0 });
      }
    }
    for (const o of this.oncoming) {
      if (o.s > o.track.length) continue;
      const x = o.track.halfWAt(o.s) + o.xRel;
      put(o, o.track, o.s, x, Math.PI);
    }
    for (const key in this.meshes) {
      const M = this.meshes[key];
      for (const part of ['body', 'tail', 'head', 'amber', 'beacon']) {
        const im = M[part];
        if (!im) continue;
        im.count = counts[key];
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
    }
    // feed the nearest lights to the road shader (glow + wet streaks)
    lights.sort((a, b) => a.d - b.d);
    const U = shared.uCars.value;
    for (let i = 0; i < 8; i++) {
      const l = lights[i];
      if (l && night > 0.05) U[i].set(l.s, l.x, l.k * night, l.w);
      else U[i].set(0, 0, 0, 0);
    }
  }
}
