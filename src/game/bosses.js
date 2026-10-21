// Bosses.
//  THE GREAT ESCAPE  (Manik Mia): a helicopter lifts off from Ganabhaban and
//      flees over the avenue, dumping the household on you. Catch the golden
//      suitcases, hit the ramps when it swoops low and clip its skids.
//  THE MIDNIGHT BUS WAR  (Motijheel): two local buses, two drivers who should
//      not be driving, one road. Shove them into each other, the walls, the
//      traffic.

import * as THREE from 'three';
import { clamp, damp, lerp, fx } from '../core/util.js';

const ITEMS = { suitcase: 3, saree: 2.2, tv: 1.4, sofa: 1, duck: 1.6, cat: 0.6, fish: 1, chandelier: 0.6, mango: 1, goldcase: 1.6 };
const ITEM_SIZE = { suitcase: [0.5, 0.3, 0.7], saree: [1.2, 0.6, 0.2], tv: [0.7, 0.3, 0.9], sofa: [1.1, 0.5, 1.1], duck: [0.3, 0.3, 0.5], cat: [0.3, 0.3, 0.5], fish: [0.2, 0.4, 0.3], chandelier: [0.7, 0.7, 1.2], mango: [0.4, 0.3, 0.6], goldcase: [0.6, 0.5, 0.8] };

function buildHeli(fxAtlasMap) {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#e9ecee', roughness: 0.5, metalness: 0.2 });
  const green = new THREE.MeshStandardMaterial({ color: '#0f7a43', roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.4, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: '#203040', roughness: 0.1, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), white);
  body.scale.set(1.5, 1.45, 3.2);
  g.add(body);
  const belly = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.35, 5.2), green);
  belly.position.y = -0.7;
  g.add(belly);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  nose.scale.set(1.2, 1.1, 1.4);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0.2, -2.3);
  g.add(nose);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 6.5, 10), white);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 0.5, 5.6);
  g.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.8, 1.0), green);
  fin.position.set(0, 1.4, 8.6);
  g.add(fin);
  const tail = new THREE.Group();
  tail.position.set(0.25, 1.5, 8.7);
  for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.2, 0.18), dark); b.rotation.x = i * Math.PI / 2; tail.add(b); }
  g.add(tail);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.8, 8), dark);
  mast.position.y = 1.7;
  g.add(mast);
  const rotor = new THREE.Group();
  rotor.position.y = 2.1;
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 13), dark); b.rotation.y = i * Math.PI / 2; rotor.add(b); }
  const blur = new THREE.Mesh(new THREE.CircleGeometry(6.6, 32), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
  blur.rotation.x = -Math.PI / 2;
  rotor.add(blur);
  g.add(rotor);
  for (const x of [-1.2, 1.2]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 6), dark);
    skid.rotation.x = Math.PI / 2;
    skid.position.set(x, -1.75, 0);
    g.add(skid);
    for (const z of [-1.2, 1.2]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6), dark); st.position.set(x * 0.8, -1.3, z); st.rotation.z = x > 0 ? -0.3 : 0.3; g.add(st); }
  }
  // the open door, and the passenger leaning out of it
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.5), new THREE.MeshBasicMaterial({ color: '#0a0c10' }));
  door.position.set(1.51, -0.05, 0.1);
  door.rotation.y = Math.PI / 2;
  g.add(door);
  const lady = new THREE.Group();
  lady.position.set(1.35, -0.55, 0.2);
  const saree = new THREE.MeshStandardMaterial({ color: '#f2ead6', roughness: 0.8 });
  const border = new THREE.MeshStandardMaterial({ color: '#7a1d22', roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: '#b07a52', roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.0, 10), saree);
  torso.position.y = 0.5;
  lady.add(torso);
  const sash = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.5), border);
  sash.position.set(0.18, 0.55, 0); sash.rotation.z = 0.5;
  lady.add(sash);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), skin);
  head.position.y = 1.18;
  lady.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshStandardMaterial({ color: '#d8d4cc' }));
  hair.position.y = 1.2;
  lady.add(hair);
  const veil = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), saree);
  veil.position.set(0, 1.21, 0.04);
  lady.add(veil);
  const specs = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.26), new THREE.MeshBasicMaterial({ color: '#111' }));
  specs.position.set(0.19, 1.2, 0);
  lady.add(specs);
  const arm = new THREE.Group();
  arm.position.set(0.15, 0.95, -0.15);
  const fore = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), skin);
  fore.position.y = 0.25;
  arm.add(fore);
  lady.add(arm);
  g.add(lady);
  // a suitcase dangling on a rope, of course
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.5, 4), dark);
  rope.position.set(0.6, -2.8, 1.2);
  g.add(rope);
  const dangle = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.3), new THREE.MeshStandardMaterial({ color: '#5a3a1a', roughness: 0.6 }));
  dangle.position.set(0.6, -4.2, 1.2);
  g.add(dangle);
  // lights
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.1) }));
  beacon.position.set(0, -0.9, 1.5);
  g.add(beacon);
  const search = new THREE.SpotLight('#fff6e0', 0, 120, 0.35, 0.5, 1.2);
  search.position.set(0, -1, -2);
  search.target.position.set(0, -20, -6);
  g.add(search);
  g.add(search.target);
  g.userData = { rotor, tail, arm, beacon, search, lady };
  return g;
}

export class Bosses {
  constructor(scene, world, traffic, breakables, particles) {
    this.scene = scene;
    this.world = world;
    this.traffic = traffic;
    this.br = breakables;
    this.particles = particles;
    this.active = null;
    this.events = [];
    this.heli = buildHeli();
    this.heli.visible = false;
    scene.add(this.heli);
    // landing markers for thrown things
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.2, 0.1), transparent: true, opacity: 0.8, depthWrite: false });
    this.ringMat = ringMat;
    this.rings = [];
    for (let i = 0; i < 10; i++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 24), ringMat);
      r.rotation.x = -Math.PI / 2;
      r.visible = false;
      scene.add(r);
      this.rings.push(r);
    }
    this._p = new THREE.Vector3();
    this.time = 0;
  }

  clear() {
    this.active = null;
    this.heli.visible = false;
    for (const r of this.rings) { r.visible = false; r.userData.b = null; }
  }

  // ------------------------------------------------------------ helicopter
  startHeli(track, s, opts = {}) {
    this.active = {
      kind: 'heli', track, hp: 1, s: s, x: opts.fromX ?? -60, fromX: opts.fromX ?? -60, h: 2, t: 0, throwT: 3.5, phase: 'rise', swoopT: 0, low: 0,
      name: 'BOSS · THE GREAT ESCAPE', sub: 'Sheikh Hasina, airborne with the entire Ganabhaban inventory', hits: 0, spinT: 0, end: opts.end ?? track.length - 260,
    };
    this.heli.visible = true;
    this.events.push({ type: 'bossStart', b: this.active });
  }

  // ------------------------------------------------------------ buses
  startBuses(track, s) {
    const T = this.traffic;
    const lanes = T.ourLanes(track, s);
    // they pull out of Gulistan bus stand right in front of you
    const a = T.spawnEnemy(track, 'bossbus', s + 95, { lane: 0, model: 'bossbus0', speed: 18 });
    const b = T.spawnEnemy(track, 'bossbus', s + 125, { lane: lanes - 1, model: 'bossbus1', speed: 18 });
    if (a) a.enemy.side = -1;
    if (b) b.enemy.side = 1;
    this.active = { kind: 'bus', track, buses: [a, b].filter(Boolean), t: 0, name: 'BOSS · THE MIDNIGHT BUS WAR', sub: 'Two drivers. One road. Zero sobriety.', hp: 1 };
    this.events.push({ type: 'bossStart', b: this.active });
  }

  hpFrac() {
    const A = this.active;
    if (!A) return 0;
    if (A.kind === 'bus') {
      let hp = 0, max = 0;
      for (const v of A.buses) { max += v.enemy.maxHp; hp += Math.max(0, v.wreck ? 0 : v.enemy.hp); }
      return max ? hp / max : 0;
    }
    return A.hp;
  }

  damageHeli(f, why) {
    const A = this.active;
    if (!A || A.kind !== 'heli' || A.phase !== 'fight') return;
    A.hp = Math.max(0, A.hp - f);
    this.events.push({ type: 'bossHit', b: A, why });
    if (A.hp <= 0) {
      A.phase = 'flee';
      A.t = 0;
      this.events.push({ type: 'bossDown', b: A });
    }
  }

  update(dt, player, camera) {
    this.time += dt;
    const A = this.active;
    if (!A) return;
    A.t += dt;
    if (A.kind === 'heli') this.updateHeli(dt, player, A);
    else if (A.kind === 'bus') this.updateBus(dt, player, A);
  }

  updateBus(dt, P, A) {
    const alive = A.buses.filter((v) => !v.wreck && this.traffic.list.includes(v));
    for (const v of A.buses) if (v.wreck && !v._counted) { v._counted = true; this.events.push({ type: 'busDown', v }); }
    if (!alive.length) {
      const won = A.buses.every((v) => v.wreck);
      this.events.push({ type: won ? 'bossDown' : 'bossGone', b: A });
      this.active = null;
      return;
    }
    // honk like it's a wedding
    A.honkT = (A.honkT || 0) - dt;
    if (A.honkT <= 0) { A.honkT = 0.6 + fx.next() * 1.4; this.events.push({ type: 'busHonk', v: fx.pick(alive) }); }
  }

  updateHeli(dt, P, A) {
    const tr = P.track;
    if (A.track !== tr) { this.events.push({ type: 'bossGone', b: A }); this.clear(); return; }
    const hw = tr.halfWAt(Math.min(P.s, tr.length));
    const U = this.heli.userData;
    // where it wants to be
    let sT = P.s + 48 + Math.sin(A.t * 0.37) * 16;
    let xT = Math.sin(A.t * 0.53) * hw * 0.8;
    let hT = 15;
    if (A.phase === 'rise') {
      // lifting off from the lawn beside the road
      hT = lerp(2, 15, clamp(A.t / 4, 0, 1));
      xT = lerp(A.fromX, 0, clamp((A.t - 1.5) / 4, 0, 1));
      sT = Math.max(A.s, P.s + 70);
      if (A.t > 5.5) { A.phase = 'fight'; A.t = 0; }
    } else if (A.phase === 'fight') {
      // swoop low over the next ramp so you have a chance
      const ramp = this.nextRamp(tr, P.s);
      if (ramp && ramp.s - P.s < 180 && ramp.s - P.s > 15) {
        sT = ramp.s + 22 + (P.v * 0.3);
        xT = ramp.x;
        hT = 7.2;
        A.low = 1;
      } else A.low = 0;
      // throw things
      A.throwT -= dt;
      if (A.throwT <= 0) {
        A.throwT = 1.0 + fx.next() * 1.2 - (1 - A.hp) * 0.4;
        this.throwItem(P, A, tr);
      }
      if (P.s > A.end) { A.phase = 'escape'; A.t = 0; this.events.push({ type: 'bossGone', b: A }); }
    } else if (A.phase === 'flee' || A.phase === 'escape') {
      // up and away, west
      hT = 15 + A.t * 9;
      xT = -40 - A.t * 30;
      sT = A.s + 40 * dt + P.v * dt;
      if (A.phase === 'flee' && A.t < 2.5) {
        // drop everything on the way out
        A.dropT = (A.dropT || 0) - dt;
        if (A.dropT <= 0) { A.dropT = 0.12; this.throwItem(P, A, tr, true); }
      }
      if (A.t > 9) { this.heli.visible = false; this.active = null; return; }
    }
    // fly there like a helicopter: lag, bank, nose down when chasing
    const vs = clamp((sT - A.s) * 1.6, -30, P.v + 26);
    A.vs = damp(A.vs || 0, vs, 2, dt);
    A.s += (A.phase === 'flee' || A.phase === 'escape' ? Math.max(A.vs, P.v * 0.9) : A.vs) * dt;
    A.vx = damp(A.vx || 0, clamp((xT - A.x) * 1.2, -18, 18), 2.5, dt);
    A.x += A.vx * dt;
    A.h = damp(A.h, hT, 1.6, dt);
    if (A.spinT > 0) A.spinT -= dt;
    // pose
    const p = tr.point(A.s, A.x, A.h, this._p);
    this.heli.position.copy(p);
    const yaw = tr.yawAt(Math.min(A.s, tr.length));
    this.heli.rotation.set(0, 0, 0);
    this.heli.rotateY(-yaw + (A.spinT > 0 ? A.spinT * 9 : 0));
    this.heli.rotateX(-clamp((A.vs - P.v) * 0.01, -0.25, 0.25) - 0.08);
    this.heli.rotateZ(-A.vx * 0.03 + Math.sin(this.time * 1.7) * 0.03);
    U.rotor.rotation.y += dt * 38;
    U.tail.rotation.x += dt * 50;
    U.arm.rotation.z = -1.2 + Math.sin(this.time * 7) * 0.5;
    U.beacon.visible = Math.sin(this.time * 8) > 0;
    U.search.intensity = 30;
    // a hit: airborne off a ramp, right at the skids
    if (A.phase === 'fight' && P.air && P.air.kind === 'heliRamp' && !P.air.hitHeli) {
      const lift = P.air.h0 * (1 - P.airU()) + P.air.h * 4 * P.airU() * (1 - P.airU());
      if (Math.abs(A.s - P.s) < 14 && Math.abs(A.x - P.x) < 7.5 && A.h - lift < 8) {
        P.air.hitHeli = true;
        A.spinT = 0.7;
        this.damageHeli(0.26, 'ram');
        this.particles.sparks(p, new THREE.Vector3(0, -1, 0));
        for (let i = 0; i < 6; i++) this.throwItem(P, A, tr, true);
      }
    }
    // rotor wash kicks up dust when low
    if (A.h < 9 && fx.next() < 0.5) {
      const g = tr.point(A.s + (fx.next() - 0.5) * 10, A.x + (fx.next() - 0.5) * 10, 0.2, new THREE.Vector3());
      this.particles.dust(g, new THREE.Vector3((fx.next() - 0.5) * 8, 0, (fx.next() - 0.5) * 8));
    }
    // landing markers
    for (const r of this.rings) {
      const b = r.userData.b;
      if (!b || !b.flying || !b.flying.thrown) { r.visible = false; r.userData.b = null; continue; }
      const f = b.flying;
      // predict the landing point
      const T = (f.vh + Math.sqrt(Math.max(0, f.vh * f.vh + 2 * (b.kind === 'saree' ? 5 : 20) * b.h))) / (b.kind === 'saree' ? 5 : 20);
      tr.point(b.s + f.vs * T, b.x + f.vx * T, 0.08, r.position);
      r.visible = true;
      const k = 1 + Math.sin(this.time * 14) * 0.15;
      r.scale.setScalar(k * (b.kind === 'sofa' ? 1.6 : 1));
    }
  }

  nextRamp(tr, s) {
    let best = null;
    for (const ch of this.world.chunks.values()) {
      if (ch.track !== tr) continue;
      for (const o of ch.obstacles) if (o.kind === 'ramp' && o.jump?.kind === 'heliRamp' && o.s > s && (!best || o.s < best.s)) best = o;
    }
    return best;
  }

  throwItem(P, A, tr, panic = false) {
    const kind = panic ? fx.weighted({ suitcase: 2, saree: 2, goldcase: 2, duck: 1, mango: 1, fish: 1 }) : fx.weighted(ITEMS);
    const T = 1.1 + fx.next() * 0.8;
    const sT = P.s + P.v * T + (fx.next() - 0.5) * 10;
    const xT = clamp(P.x + (fx.next() - 0.5) * 6, -tr.halfWAt(Math.min(P.s, tr.length)) + 1, tr.halfWAt(Math.min(P.s, tr.length)) - 1);
    const g = kind === 'saree' ? 5 : 20;
    const h0 = A.h - 1.6;
    const vs = (sT - A.s) / T;
    const vx = (xT - A.x) / T;
    const vh = (0.5 * g * T * T - h0) / T;
    const sz = ITEM_SIZE[kind];
    const b = this.br.spawn(kind, tr, A.s, A.x + 1.4, h0, vs, vx, vh, {
      hw: sz[0], hl: sz[1] + 0.3, ht: sz[2], hazard: kind !== 'goldcase' && kind !== 'cat' && kind !== 'duck', pickup: kind === 'goldcase', mass: kind === 'sofa' ? 0.25 : 0.08, score: kind === 'goldcase' ? 3000 : 400,
    });
    // saree, duck and cat fall slowly and wobble
    if (kind === 'saree' || kind === 'duck' || kind === 'cat') b.flying.wx *= 0.3;
    const ring = this.rings.find((r) => !r.userData.b);
    if (ring && !panic) ring.userData.b = b;
    this.events.push({ type: 'throw', kind });
  }
}
