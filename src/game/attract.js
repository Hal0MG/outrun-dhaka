// The title screen's showreel. While the menus are up, a field of racers streams past a static camera set up beside
// (or over) the road, and every dozen seconds the picture cuts to a different district: a different road, time of
// day and weather. Nobody is driving: the player's car is hidden and parked at the camera, and the rivals are fed
// past it again and again so there is always something going by.

import * as THREE from 'three';
import { ROUTE, STAGES, circuitStage, LANDMARK_NAMES } from '../world/stages.js';

const SHOT_TIME = [11, 15]; // seconds on one shot
const FADE = 0.45;
// every shot looks the way the traffic is driving, the same as the game camera: the world is built to be seen from
// behind the cars, and from the other way round it shows its unfinished back
// all of them from above the road, like a traffic camera on a gantry: nothing beside the road to stand in the way
const TYPES = ['over', 'high', 'shoulder'];

const pick = (a) => a[(Math.random() * a.length) | 0];
const range = (a, b) => a + Math.random() * (b - a);

export class Attract {
  constructor(game) {
    this.game = game;
    this.on = false;
    this.phase = 'show'; // show -> out -> (cut) -> in -> show
    this.t = 0;
    this.dur = 12;
    this.order = [];
    this.shot = null;
    this.cut = document.getElementById('cut');
    this.nowEl = document.getElementById('nowShow');
    this._look = new THREE.Vector3();
    this._pos = new THREE.Vector3();
  }

  start() {
    this.on = true;
    this.game.car.group.visible = false;
    this.order = [];
    this.setup(true);
    this.phase = 'in';
    this.t = 0;
    this.fade(false);
  }

  stop() {
    if (!this.on) return;
    this.on = false;
    this.game.car.group.visible = true;
    this.fade(false, true);
  }

  fade(black, instant) {
    if (!this.cut) return;
    if (instant) this.cut.style.transition = 'none';
    this.cut.style.opacity = black ? '1' : '0';
    if (instant) { void this.cut.offsetWidth; this.cut.style.transition = ''; }
  }

  // the next district in a shuffled order, so every one is shown before any repeats
  nextDistrict(first) {
    if (!this.order.length) {
      this.order = ROUTE.slice().sort(() => Math.random() - 0.5);
      // open on the home district, the one the game starts in
      if (first) this.order.sort((a, b) => (a === 'dhanmondi' ? 1 : 0) - (b === 'dhanmondi' ? 1 : 0));
    }
    return this.order.pop();
  }

  // build a new shot: a district, a road position and a camera, with the rivals lined up to pass it
  setup(first) {
    const g = this.game;
    const P = g.player;
    const district = this.nextDistrict(first);
    const tr = g.resetWorld(circuitStage(district).id);
    g.race.start('circuit');
    g.race.pickups = [];
    const type = pick(TYPES);
    const side = Math.random() < 0.5 ? -1 : 1;
    // a hand-picked spot, not a random one: just before a landmark, footbridge or festival gate, so the shot has
    // something in it. (The first lap only; the camera stands 85-130 m short of it, looking down the road.)
    const st = tr.stage;
    const lo = tr.gateS + 160, hi = tr.goalS - 500; // any of the three laps: the same places come round each time
    const pois = [];
    // the named places count most: the shot is about them. (Generic towers and the like are left out.)
    for (const l of st.landmarks || []) if (LANDMARK_NAMES[l.type]) pois.push({ s: tr.mapS(l.s), side: l.side || 0, d: l.dist || 20, w: 8, name: LANDMARK_NAMES[l.type] });
    for (const f of st.footbridges || []) pois.push({ s: tr.mapS(f), side: 0, d: 0, w: 0.4 });
    for (const b of st.banners || []) pois.push({ s: tr.mapS(b.s), side: 0, d: 0, w: 0.6 });
    let ok = pois.filter((p) => p.s - 140 >= lo && p.s <= hi);
    if (!ok.length) ok = [{ s: tr.gateS + tr.lapLen * 0.3, side: 0, d: 0, w: 1 }];
    let total = 0;
    for (const p of ok) total += p.w;
    let roll = Math.random() * total, poi = ok[0];
    for (const p of ok) { roll -= p.w; if (roll <= 0) { poi = p; break; } }
    // far-off landmarks (a parliament across a lake) need standing further back to read as a whole
    const s = Math.max(lo, poi.s - (70 + Math.min(poi.d, 150) * 0.6 + Math.random() * 25));
    P.s = s;
    P.x = 0;
    P.v = 0;
    for (let i = 0; i < 14; i++) g.world.stream(tr, P.s, 4);
    const hw = tr.halfWAt(s);
    const shot = { type, side, s, tr, hw };
    // look down the road toward the thing, leaning a little to the side it stands on
    const lookS = Math.max(60, poi.s - s);
    // a named place is the subject, held right of centre, clear of the title
    const dd = Math.min(poi.d, 80);
    // (a place set far back from the road, like the parliament across its lake, is aimed at directly)
    const far = !!poi.name && poi.d > 90;
    // The title always sits on the left, so a place on the left is framed by aiming past it: it lands right of centre.
    const lean = poi.name
      ? (poi.side < 0 ? -(Math.min(poi.d, 220) + 25) : poi.side * (far ? Math.min(poi.d, 220) * 0.85 : dd * 0.4))
      : poi.side * Math.min(poi.d, hw + 24) * 0.55;
    // the pack comes up from behind the camera, goes by and drives away down the road
    // aim a little above the road so the landmark sits in the upper half and the racers in the lower
    const lh = poi.name ? 10 : 3;
    if (type === 'over') Object.assign(shot, { x: 0, h: 7.5, ls: lookS, lx: lean, lh, fov: poi.name ? (far ? 54 : 46) : 40 });
    else if (type === 'high') Object.assign(shot, { x: 0, h: 10, ls: lookS, lx: lean, lh, fov: poi.name ? 44 : 38 });
    else Object.assign(shot, { x: (poi.side ? -poi.side : side) * hw * 0.55, h: 6, ls: lookS, lx: lean, lh, fov: poi.name ? 46 : 40 });
    // the title and menu sit on the left, so push the action to the right half of the picture
    if (!poi.name) shot.lx -= Math.min(7, hw * 0.9);
    shot.poi = poi;
    this.shot = shot;
    this.fov0 = shot.fov;
    // the pack: every racer at a cinematic pace, lined up on the side of the camera they will come from
    const R = g.race;
    const PG = R.playerG();
    R.rivals.forEach((r, i) => {
      r.skill = range(0.5, 0.64);
      r.out = false; r.done = false;
      r.v = g.player.vmax * r.skill;
      this.place(r, PG, shot, i);
    });
    // fill the road in before the picture comes up
    for (let i = 0; i < 60; i++) g.traffic.update(0.15, true, []);
    for (let i = 0; i < 24; i++) g.peds.update(0.4, P, true, 1, g.traffic.cars, []);
    g.peds.rain = g.weather.rain;
    // the caption
    if (this.nowEl) {
      const st = STAGES[district];
      this.nowEl.querySelector('b').textContent = st.name.toUpperCase();
      // the caption names the place being filmed (a district's own landmarks, so a local knows where this is)
      this.nowEl.querySelector('span').textContent = this.shot.poi.name ? `${this.shot.poi.name}` : st.sub;
      this.nowEl.classList.remove('swap');
      void this.nowEl.offsetWidth;
      this.nowEl.classList.add('swap');
    }
    this.dur = range(SHOT_TIME[0], SHOT_TIME[1]);
    this.t = 0;
  }

  // put a racer on the road on the far side of the camera from where it is going to run
  place(r, PG, shot, i) {
    const hw = shot.hw;
    r.x = -hw + 1.6 + Math.random() * (2 * hw - 3.2);
    // spread from well behind the camera to well down the road, so there is something to see from the first frame
    r.G = PG - 230 + i * 19 + Math.random() * 8;
    r.gx = r.x;
  }

  update(dt) {
    const g = this.game;
    const sh = this.shot;
    this.t += dt;
    // keep the racers coming: whoever has gone by is fed back in
    const PG = g.race.playerG();
    for (const r of g.race.rivals) {
      const d = r.G - PG;
      if (d > 330) {
        r.G = PG - 90 - Math.random() * 210;
        r.x = -sh.hw + 1.6 + Math.random() * (2 * sh.hw - 3.2);
        r.v = g.player.vmax * r.skill;
        r.done = false;
      }
    }
    // the cut: fade out, build the next shot behind black, fade back in
    if (this.phase === 'show' && this.t > this.dur) { this.phase = 'out'; this.t = 0; this.fade(true); }
    else if (this.phase === 'out' && this.t > FADE + 0.1) { this.setup(false); this.phase = 'in'; this.t = 0; this.fade(false); }
    else if (this.phase === 'in' && this.t > FADE) { this.phase = 'show'; this.t = 0; }
  }

  // the camera never moves; it only eases its lens a little over the shot
  camera(dt) {
    const g = this.game;
    const cam = g.R.camera;
    const sh = this.shot;
    const tr = sh.tr;
    tr.point(sh.s, sh.x, sh.h, this._pos);
    tr.point(sh.s + sh.ls, sh.lx, sh.lh, this._look);
    cam.position.copy(this._pos);
    cam.up.set(0, 1, 0);
    cam.lookAt(this._look);
    const portrait = cam.aspect < 1 ? (1 - cam.aspect) * 26 : 0;
    cam.fov = this.fov0 + portrait - Math.min(this.t, 14) * 0.25;
    cam.updateProjectionMatrix();
    g.cam.camS = sh.s; g.cam.camX = sh.x; g.cam.camH = sh.h;
  }
}
