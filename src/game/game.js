// The game: owns the world, the car, the camera and the race, and runs a
// frame: driving, the field, pickups, lighting, effects, sound and the HUD.
// Two races: a district circuit (three laps) or the Run (the whole city,
// knockout gates on the way). See race.js for the rules.

import * as THREE from 'three';
import { World, FORK_OFF } from '../world/world.js';
import { Sky } from '../world/sky.js';
import { Atmosphere } from '../world/atmosphere.js';
import { shared } from '../world/materials.js';
import { ROUTE, LEVEL_TIME, circuitStage } from '../world/stages.js';
import { Player } from './player.js';
import { CameraRig } from './camera.js';
import { Fleet } from './fleet.js';
import { Traffic } from './traffic.js';
import { Peds } from './peds.js';
import { Stalls, DEBRIS } from './stalls.js';
import { Litter, SCATTER } from './litter.js';
import { CarDrops } from './carwet.js';
import { Attract } from './attract.js';
import { Dialogue } from '../ui/dialogue.js';
import { Ambience } from './ambience.js';
import { contraAt } from '../world/contra.js';
import { Particles } from './particles.js';
import { Weather } from './weather.js';
import { loadCarAssets } from './carassets.js';
import { loadLandmarkModels } from '../world/models.js';
import { Race } from './race.js';
import { CARS, buildPlayerCar, makeEnvMap, applyEnv } from './cars.js';
import { audio } from '../audio/audio.js';
import { music, TRACKS } from '../audio/music.js';
import { clamp, lerp, damp, smoothstep, fx } from '../core/util.js';

const MENU_STATES = ['title', 'map', 'garage', 'radio', 'settings', 'howto'];
// behind these menus the showreel plays (the garage shows your own car instead)
const ATTRACT_STATES = ['title', 'map', 'settings', 'howto'];

export class Game {
  constructor(R, input, hud, settings) {
    this.R = R;
    this.scene = R.scene;
    this.input = input;
    this.hud = hud;
    this.settings = settings;
    this.world = new World(this.scene, R.renderer);
    this.atmo = new Atmosphere();
    this.time = 0;
    this.state = 'boot';
    this.kind = null; // 'circuit' | 'run' while racing
  }

  async init(progress) {
    await Promise.all([loadCarAssets(), loadLandmarkModels()]);
    this.world.buildAssets(progress);
    progress?.('Hanging the sky');
    this.sky = new Sky(this.scene);
    this.hemi = new THREE.HemisphereLight('#9db4d6', '#4a4038', 1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffd59a', 1.5);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    // the moon: a cool directional light at night, so the faces of buildings have some form to them
    this.moon = new THREE.DirectionalLight('#9fb4ff', 0);
    this.scene.add(this.moon);
    this.scene.add(this.moon.target);
    this.scene.fog = new THREE.FogExp2('#e8cfa6', 0.0012);
    this.fleet = new Fleet(this.scene, this.world.assets, this.world);
    this.traffic = new Traffic(this);
    this.peds = new Peds(this.scene, this.world);
    this.stalls = new Stalls(this.scene, this.world);
    this.litter = new Litter(this);
    this.say = new Dialogue(this.hud);
    this.ambience = new Ambience(this);
    this._cars = [];
    this._bv = new THREE.Vector3();
    this.particles = new Particles(this.scene);
    this.weather = new Weather(this.scene);
    this.race = new Race(this);
    this.attract = null; // built once the first car exists
    this.cam = new CameraRig(this.R.camera);
    this.carIndex = this.settings.car ?? 0;
    this.colorIndex = this.settings.color ?? 0;
    this.buildCar();
    this.attract = new Attract(this);
    this.resetWorld('dhanmondi');
    for (let i = 0; i < 14; i++) this.world.stream(this.player.track, this.player.s, 4);
  }

  // ------------------------------------------------------------ car
  buildCar() {
    const def = CARS[this.carIndex];
    if (this.car) this.scene.remove(this.car.group);
    const color = def.colors[this.colorIndex % def.colors.length];
    this.car = buildPlayerCar(def, color, { misc: this.world.assets.misc, fx: this.world.assets.fx, mats: this.world.mats });
    this.scene.add(this.car.group);
    this.drops = new CarDrops(this.car);
    if (this.env) applyEnv(this.car, this.env.texture);
    const prev = this.player;
    this.player = new Player(def);
    if (prev) {
      this.player.track = prev.track;
      this.player.s = prev.s;
      this.player.x = prev.x;
    }
    audio.setEngineKind(def.engine || (def.id === 'rosso' ? 'v12' : def.id === 'premio' ? 'i4' : def.id === 'cng' ? 'cng' : 'jet'));
  }

  resetWorld(stageId) {
    this.instantAtmo = true;
    this._tint = null;
    const tr = this.world.startTrack(stageId);
    this.player.reset(tr);
    this.player.s = tr.gateS - 18;
    this.race.stop();
    this.traffic.clear();
    this.peds.clear();
    this.stalls.clear();
    this.litter.clear();
    this.ambience.clear();
    this.sky.setSkyline(tr.stage.skyline || 'midrise', true);
    this.cam.init = false;
    this.applyStageAtmo(tr);
    this.instantAtmo = false;
    this.envT = 0;
    return tr;
  }

  applyStageAtmo(tr) {
    const st = tr.stage;
    this.lampTarget = (this.lampTarget || new THREE.Color()).set(st.lampColor || '#ffb04a');
    this.markTarget = st.markFade ?? 0.6;
    if (this.instantAtmo) { shared.uLampCol.value.copy(this.lampTarget); shared.uMarkFade.value = this.markTarget; }
    this.rainTarget = st.weather?.rain || 0;
    this.wetTarget = st.weather?.wet ?? this.rainTarget;
    this.storm = !!st.weather?.storm;
    this.mistTarget = st.weather?.mist || 0;
    if (this.instantAtmo) this.mist = this.mistTarget;
    const W = this.world;
    W.farDisc.material = st.farWater ? (tr.waterMat || W.mats.water) : W.farMatGround;
  }

  // ------------------------------------------------------------ races
  // kind 'circuit' races `district` for three laps; kind 'run' crosses the whole city
  startRace(kind, district = 'dhanmondi') {
    this.attract?.stop();
    this.kind = kind;
    this.district = district;
    const stageId = kind === 'circuit' ? circuitStage(district).id : ROUTE[0];
    const tr = this.resetWorld(stageId);
    this.race.start(kind);
    for (let i = 0; i < 14; i++) this.world.stream(tr, this.player.s, 4);
    this.state = 'countdown';
    this.countT = 0;
    this.countStep = -1;
    this.areaMusic(tr.stage, 1.5);
    this.hud.reset(kind);
    this.say.reset();
    this._lowFuel = false;
    this.raceT = 0;
    this._warned = new Set();
    this.hud.setStage(tr.stage, kind);
    this.hud.show(true);
    this.cam.mode = 'chase';
    this.cam.init = false;
    this.endT = 0;
  }

  // back to the title: the car waits on the Dhanmondi start line
  toTitle() {
    this.attract?.stop();
    this.kind = null;
    this.hud.show(false);
    this.hud.tags([]);
    this.resetWorld('dhanmondi');
    this.state = 'title';
  }

  onLap(n, laps) {
    this.hud.message(n === laps ? 'FINAL LAP' : `LAP ${n} / ${laps}`, 2);
    audio.checkpoint();
    this.say.say(n === laps ? 'finalLap' : 'lap', 1, true);
    if (n === laps) setTimeout(() => this.say.say('tipLastLap', 1, false, 9999), 3200);
  }

  onPass(n, nitro) {
    this.hud.combo(n > 1 ? `PASSED ×${n}` : 'PASSED', nitro ? '+NITRO' : '');
    audio.blip(1000 + Math.min(n, 5) * 120);
  }

  onWrongWay(nitro) {
    this.hud.combo('WRONG WAY', nitro ? '+NITRO' : '');
    audio.blip(1500);
  }

  onKnockout(cut, knocked) {
    this.hud.takedown('KNOCKOUT', `${knocked} OUT · TOP ${cut} GO ON`, 2.6);
    audio.checkpoint();
    this.say.say('knockout', 1, true);
  }

  onPosition(pos, prev) {
    this.hud.position(pos, pos < prev);
    if (pos < prev) { audio.blip(1400); this.say.say(pos === 1 ? 'lead' : 'pass', pos === 1 ? 1 : 0.3); }
    else this.say.say('passed', 0.2);
  }

  onPickup(p) {
    if (p.kind === 'coin') audio.tone('square', 1500 + (this.race.coins % 5) * 120, 0.07, 0.05, { lp: 5000 });
    else if (p.kind === 'fuel') { audio.checkpoint(); this.hud.combo('FUEL', '+TANK'); this.say.say('fuel', 0.4); }
    else if (p.kind === 'nitro') { audio.blip(1800); this.hud.combo('NITRO', '+1 CHARGE'); this.say.say('nitroPick', 0.35); }
  }

  onFinish(res) {
    const P = this.player;
    const tr = P.track;
    if (res.out) {
      this.state = 'gameover';
      this.hud.message(res.out === 'fuel' ? 'OUT OF FUEL' : 'KNOCKED OUT', 3);
      this.say.say('out', 1, true);
      this.onRaceEnd?.(res, 2400);
      return;
    }
    this.state = 'goal';
    this.endT = 0; this._endInit = false; this._endLook = null;
    audio.goal();
    const g = tr.point(tr.goalS + 3, 0, 7, new THREE.Vector3());
    this.particles.confetti(g.x, g.y, g.z);
    this.particles.confetti(g.x, g.y + 2, g.z);
    this.hud.message(res.pos === 1 ? 'WINNER!' : `FINISHED P${res.pos}`, 3.5);
    this.say.say(res.pos === 1 ? 'win' : 'finish', 1, true);
    this.onRaceEnd?.(res, 3800);
  }

  // ------------------------------------------------------------ per-frame
  update(dt) {
    this.time += dt;
    const input = this.input;
    shared.uTime.value = this.time;
    const P = this.player;
    const st = this.state;
    // the showreel plays behind the menus while no race is in progress
    if (ATTRACT_STATES.includes(st) && this.kind == null) { if (!this.attract.on) this.attract.start(); }
    else if (this.attract.on) { this.attract.stop(); if (st === 'garage') this.resetWorld('dhanmondi'); }
    if (this.attract.on) this.attract.update(dt);

    let autopilot = null;
    let cinematic = false;
    if (MENU_STATES.includes(st)) {
      autopilot = { throttle: 0, steer: 0, brake: 1 };
      cinematic = st === 'garage' ? 'garage' : 'title';
    } else if (st === 'countdown') {
      // the rolling start: hold the formation speed until GO
      autopilot = { throttle: P.v < 22 ? 1 : 0, steer: 0, brake: P.v > 26 ? 0.6 : 0 };
      this.updateCountdown(dt);
    } else if (st === 'goal') {
      autopilot = { throttle: 0, steer: -P.x * 0.08, brake: P.v > 2 ? 0.75 : 1 };
      cinematic = 'ending';
    } else if (st === 'gameover') {
      autopilot = { throttle: 0, steer: 0, brake: 0.25 };
    } else if (st === 'race') {
      this.raceInput();
    }

    if (st !== 'paused') {
      P.update(dt, input, this.world, { autopilot });
      this.handlePlayerEvents();
      this.handleFork();
      this.race.update(dt);
      this.updateRoad(dt, st);
      if (this.race.active) this.ambience.update(dt, P, this.night, this.S ? this.S.glow : 0);
      this.world.stream(P.track, P.s, 2, cinematic === 'ending' ? 300 : 160);
      this.world.update(dt, this.time);
      this.updateFx(dt);
    }

    // camera
    if (this.attract.on) this.attract.camera(dt);
    else if (cinematic === 'garage') this.cam.update(dt, P, { cinematic: true, orbitSpeed: 0.25, radius: 7.5, height: 1.9, fov: 42 });
    else if (cinematic === 'title') this.titleCam(dt);
    else if (cinematic === 'ending') this.endingCam(dt);
    else this.cam.update(dt, P);
    shared.uCamS.value = this.cam.camS;
    shared.uCamX.value = this.cam.camX;
    shared.uCamH.value = this.cam.camH;
    const cr = new THREE.Vector3().setFromMatrixColumn(this.R.camera.matrixWorld, 0);
    cr.y = 0;
    if (cr.lengthSq() > 1e-6) shared.uCamRight.value.copy(cr.normalize());

    this.updateAtmosphere(dt);
    this.updateCarVisual(dt);
    this.drops?.update(dt, this.weather.rain);
    const cars = this._cars;
    cars.length = 0;
    for (const c of this.race.cars) cars.push(c);
    for (const c of this.traffic.cars) cars.push(c);
    this.fleet.render(dt, cars, P, this.night, this.cam.camS, this.cam.camX);
    this.race.render(this.time);
    this.updateRoadUniforms();
    this.updateAudio(dt);
    this.particles.setScale(this.R.renderer.domElement.height, this.R.camera.fov);
    this.particles.update(dt);
    if (this.hud.el.classList.contains('show')) this.updateHUD(dt);
    // post fx
    const vr = P.v / P.vmax;
    const F = this.R.final.uniforms;
    F.uBlur.value = st === 'race' ? Math.max(0, vr - 0.85) * 0.4 + (P.boosting ? 0.2 : 0) : 0;
    F.uScan.value = this.settings.crt ? 1 : 0;
    F.uFlash.value = this.weather.flash * 0.35;
    F.uDim.value = 0;
  }

  // everything on the road that can hit things: you and the rivals near you
  movers() {
    const R = this.race, P = this.player;
    const PG = R.playerG();
    // (in the showreel the player's car is hidden and parked at the camera: nothing should hit it)
    const out = this.attract.on ? [] : [{ G: PG, x: P.x, v: P.v, hl: P.halfL * 0.9, hw: P.halfW * 0.9, player: true }];
    for (const r of R.rivals) if (!r.out && Math.abs(r.G - PG) < 220) out.push({ G: r.G, x: r.x, v: r.v, hl: r.l, hw: r.w });
    return out;
  }

  // traffic, pedestrians and stalls: they only populate the road, and get flung when a racer hits them
  updateRoad(dt, st) {
    const R = this.race;
    if (!R.active) return;
    const P = this.player;
    const go = st === 'race';
    const live = go || this.attract.on;
    const movers = this.movers();
    this.traffic.update(dt, live, movers);
    this.peds.rain = this.weather.rain;
    this.peds.update(dt, P, live, this.traffic.factor * 1.1, this.traffic.cars, movers);
    this.stalls.update(dt, R.playerG(), movers);
    this.litter.update(dt, this.night, movers, Math.max(this.weather.rain, shared.uWet.value * 0.8));
    for (const e of this.litter.events) {
      const it = e.it;
      const tr = it.tr;
      if (e.type === 'splash') {
        // a wheel through a puddle: spray up and to the sides, and a splash you can hear
        const at = tr.point(Math.min(e.G - tr.base, tr.length), e.x, 0.1, this._bv);
        this.particles.splash(at, { x: 0, z: 0 }, Math.round(4 + e.v * 0.12));
        if (e.first) { audio.splash(e.v); this.cam.kick(0.03); }
        continue;
      }
      if (e.type === 'pothole') {
        // a jolt through the car, a puff of grit and a thump
        P.bounce += 0.09 + Math.min(e.v, 80) * 0.0009;
        P.v *= 0.992;
        this.cam.kick(0.07);
        audio.bump();
        const at = tr.point(it.G - tr.base, it.x, 0.1, this._bv);
        this.particles.dust(at, { x: 0, z: 0 });
        this.particles.dust(at, { x: 0, z: 0 });
        this.say.say('pothole', 0.25);
      } else {
        const sc = SCATTER[it.kind];
        const at = tr.point(it.G - tr.base, it.x, 0.15, this._bv);
        if (sc) this.burst(at, sc.cols, sc.n);
        if (sc?.dust) { this.particles.dust(at, { x: 0, z: 0 }); this.particles.dust(at, { x: 0, z: 0 }); }
      }
    }
    this.litter.events.length = 0;
    this.say.update(dt);
    for (const e of this.traffic.events) {
      if (e.by !== 'player') continue;
      audio.thud();
      this.cam.kick(0.12);
      this.say.say('hitTraffic', 0.2);
    }
    this.traffic.events.length = 0;
    for (const e of this.peds.events) {
      if (e.by !== 'player') continue;
      audio.boing();
      this.say.say('ped', 0.35);
    }
    this.peds.events.length = 0;
    for (const e of this.stalls.events) {
      const b = e.b;
      const [cols, n] = DEBRIS[b.kind] || DEBRIS.crate;
      this.burst(b.tr.point(b.s, b.x, 0.9, this._bv), cols, n);
      audio.smash(b.kind.startsWith('stall'));
      if (e.by === 'player') { this.cam.kick(0.08); this.say.say('smash', 0.4); }
    }
    this.stalls.events.length = 0;
    if (P.scrape && P.v > 20) this.say.say('scrape', 0.02);
    if (go) this.coach(dt);
  }

  // advice that helps win: what is coming up, what to do about it
  coach(dt) {
    const P = this.player, R = this.race, tr = P.track;
    const say = this.say;
    const vr = P.v / P.vmax;
    this.raceT = (this.raceT || 0) + dt;
    const kAt = (d) => Math.abs(tr.kAt(Math.min(P.s + d, tr.length)));
    // road works ahead: cross to the other carriageway (it pays, too)
    const zone = contraAt(tr, P.s, 800);
    this._warned = this._warned || new Set();
    if (zone && !this._warned.has(zone.id)) {
      this._warned.add(zone.id);
      this.hud.takedown('ROAD WORKS AHEAD', 'CROSS OVER TO THE RIGHT · THE WRONG WAY PAYS', 2.6);
      say.sayText('contra', 'Road works! Take the other side, it pays.', 25);
    }
    // how pickups work, once, early
    if (this.raceT > 8) say.say('tipPickups', 1, false, 9999);
    // advice is rare: a few well-timed words, not a running commentary
    if (P.nitro >= 1 && !P.boosting && vr > 0.7 && R.position > 1 && Math.max(kAt(60), kAt(140), kAt(220)) < 0.0015) say.say('tipNitro', 0.6, false, 90);
    if (vr > 0.9 && !P.boosting && kAt(95) > 0.0075) say.say('tipBend', 0.5, false, 80);
    if (P.fuel < 0.3) say.say('tipFuel', 1, false, 90);
    if (P.offroad > 0.85 && P.v > 35) this._grass = (this._grass || 0) + dt; else this._grass = 0;
    if (this._grass > 1.5) say.say('tipGrass', 1, false, 70);
    // the next knockout gate
    const ko = R.nextKnockout();
    if (ko && ko.d != null && ko.d < 1400 && R.position > ko.cut - 3) {
      say.sayText('ko', R.position > ko.cut ? `The cut-off is top ${ko.cut} and we’re ${R.position}th. Push!` : `Cut-off is top ${ko.cut}. Stay ahead of the pack!`, 120);
    }
  }

  // bits flying off something smashed
  burst(pos, cols, n) {
    const PS = this.particles;
    for (let i = 0; i < n; i++) {
      const c = cols[(fx.next() * cols.length) | 0];
      PS.soft.add(pos.x + (fx.next() - 0.5), pos.y + fx.next(), pos.z + (fx.next() - 0.5), (fx.next() - 0.5) * 9, 2 + fx.next() * 7, (fx.next() - 0.5) * 9, c[0], c[1], c[2], 0.12 + fx.next() * 0.12, 1.2 + fx.next(), { grav: 14, drag: 0.7, alpha: 1 });
    }
  }

  endingCam(dt) {
    const P = this.player;
    const tr = P.track;
    const cam = this.R.camera;
    this.endT = (this.endT || 0) + dt;
    const t = Math.min(this.endT, 30);
    const p = tr.point(P.s - 10 + t * 0.35, P.x + 3.4 - t * 0.04, 1.4 + t * 0.07, new THREE.Vector3());
    const l = tr.point(P.s + 70, P.x - 9, 7 + t * 0.1, new THREE.Vector3());
    cam.position.lerp(p, 1 - Math.exp(-dt * 1.5));
    if (!this._endInit) { cam.position.copy(p); this._endInit = true; }
    this._endLook = this._endLook || l.clone();
    this._endLook.lerp(l, 1 - Math.exp(-dt * 1.5));
    cam.up.set(0, 1, 0);
    cam.lookAt(this._endLook);
    cam.fov = damp(cam.fov, 50, 1.5, dt);
    cam.updateProjectionMatrix();
    this.cam.camS = P.s - 10 + t * 0.35; this.cam.camX = P.x + 3.4; this.cam.camH = 1.6;
  }

  titleCam(dt) {
    const P = this.player;
    const cam = this.R.camera;
    const pose = P.pose(this._pose || (this._pose = { pos: new THREE.Vector3() }));
    const c = pose.pos;
    // a slow sweep across the rear three-quarter view, low and wide, start gate and crowd behind the car
    const t = this.time * 0.12;
    const ang = pose.yaw + Math.sin(t) * 0.75;
    const r = 8.5 + Math.sin(t * 0.7) * 1.2;
    const h = 1.5 + Math.sin(t * 0.9) * 0.25;
    cam.position.set(c.x - Math.sin(ang) * r, c.y + h, c.z + Math.cos(ang) * r);
    cam.up.set(0, 1, 0);
    cam.lookAt(c.x + Math.sin(pose.yaw) * 4, c.y + 0.9, c.z - Math.cos(pose.yaw) * 4);
    cam.fov = damp(cam.fov, 42, 3, dt);
    cam.updateProjectionMatrix();
    this.cam.camS = P.s - 8; this.cam.camX = P.x; this.cam.camH = h;
  }

  updateCountdown(dt) {
    this.countT += dt;
    const step = Math.floor(this.countT / 0.9);
    if (step === this.countStep) return;
    this.countStep = step;
    if (step < 2) { this.hud.signal('r'); audio.countBeep(false); }
    else if (step === 2) { this.hud.signal('y'); audio.countBeep(false); }
    else if (step === 3) {
      this.hud.signal('g');
      audio.countBeep(true);
      this.state = 'race';
      this.hud.message('GO!', 1.2);
      setTimeout(() => this.say.say('start', 1, true), 900);
      setTimeout(() => this.hud.signal(null), 1400);
    }
  }

  raceInput() {
    const I = this.input;
    const P = this.player;
    if (P.boosting && !this._wasBoost) { audio.nitro(); this.backfire = 0.15; }
    if (!P.boosting && this._wasBoost && P.nitro < 1) this.say.say('nitroOut', 0.5, false, 45);
    this._wasBoost = P.boosting;
    if (P.fuel < 0.2 && !this._lowFuel) { this._lowFuel = true; this.hud.message('LOW FUEL', 1.6); this.say.say('fuelLow', 1, true); }
    else if (P.fuel > 0.4) this._lowFuel = false;
  }

  // the Run crosses into the next district at the end of each track
  handleFork() {
    const P = this.player;
    const tr = P.track;
    if (!tr.isFinal && P.s > tr.length) {
      const { child, xNew } = this.world.commitFork(tr, P.x);
      P.track = child;
      P.s -= tr.length;
      P.x = xNew;
      this.sky.setSkyline(child.stage.skyline || 'midrise');
      this.applyStageAtmo(child);
      this.areaMusic(child.stage, 1.8);
      this.hud.setStage(child.stage, this.kind);
    }
    if (tr.parent && P.s > 560 && !tr.gcDone) {
      tr.gcDone = true;
      this.world.gc(tr);
      this.race.pickups = this.race.pickups.filter((p) => this.world.tracks.has(p.tr.id));
    }
  }

  handlePlayerEvents() {
    const P = this.player;
    for (const e of P.events) {
      if (e.type === 'nitro') this.say.say('nitro', 0.25);
      else if (e.type === 'nitroEmpty') this.say.say('nitroOut', 1, false, 45);
      else if (e.type === 'hit') {
        audio.hit();
        this.say.say('hitRival', 0.25);
        this.cam.kick(e.hard ? 0.3 : 0.15);
        if (e.side || e.hard) {
          const pose = P.pose({ pos: new THREE.Vector3() });
          for (let i = 0; i < 3; i++) this.particles.sparks(pose.pos, new THREE.Vector3(fx.next() - 0.5, 0.2, fx.next() - 0.5));
        }
      }
    }
    P.events.length = 0;
  }

  // ------------------------------------------------------------ lighting
  hourNow() {
    if (this.attract.on) return this.player.track.stage.hour ?? 17.75;
    if (MENU_STATES.includes(this.state)) return this.settings.titleHour ?? 17.75;
    const P = this.player;
    const tr = P.track;
    if (tr.stage.circuit) return tr.stage.hour;
    const [h0, h1] = LEVEL_TIME[tr.level];
    return lerp(h0, h1, clamp(P.s / (tr.length + (tr.isFinal ? -700 : 0)), 0, 1));
  }

  updateAtmosphere(dt) {
    const P = this.player;
    const tr = P.track;
    const st = tr.stage;
    const hour = this.hourNow();
    this.hour = hour;
    const sunAz = (tr.meanYaw || 0) + (st.sunOffset || 0);
    // ease district colour grading, lamp colour and mist across a boundary instead of snapping
    const k = 1 - Math.exp(-dt * 0.45);
    const tt = st.tint || { color: '#ffffff', amount: 0 };
    if (!this._tint) this._tint = { color: new THREE.Color(tt.color || '#ffffff'), amount: tt.amount || 0, fogMul: tt.fogMul || 1 };
    this._tint.color.lerp(this._tc = (this._tc || new THREE.Color()).set(tt.color || '#ffffff'), k);
    this._tint.amount += ((tt.amount || 0) - this._tint.amount) * k;
    this._tint.fogMul += ((tt.fogMul || 1) - this._tint.fogMul) * k;
    if (this.lampTarget) shared.uLampCol.value.lerp(this.lampTarget, k);
    if (this.markTarget != null) shared.uMarkFade.value += (this.markTarget - shared.uMarkFade.value) * k;
    this.mist = (this.mist || 0) + ((this.mistTarget || 0) - (this.mist || 0)) * k;
    const S = this.atmo.compute(hour, sunAz, this._tint, { rain: this.weather.rain, mist: this.mist || 0 }, 0);
    this.S = S;
    this.night = smoothstep(18.2, 19.2, hour) * (1 - smoothstep(29.3, 30.0, hour));
    this.scene.fog.color.copy(S.fog);
    // a touch of haze after dark gives the lamps something to glow in
    const fogD = S.fogD * (1 + this.night * 0.22);
    this.scene.fog.density = fogD;
    shared.uFogColor.value.copy(S.fog);
    shared.uFogDensity.value = fogD;
    this.hemi.color.copy(S.amb);
    this.hemi.groundColor.copy(S.fog).multiplyScalar(0.35 + this.night * 0.25);
    this.hemi.intensity = S.ambI * 1.25;
    this.sun.color.copy(S.sun);
    this.sun.intensity = S.sunI * S.sunVis * 1.3;
    const cp = this.R.camera.position;
    this.sun.position.set(cp.x + S.sunDir.x * 500, cp.y + Math.max(30, S.sunDir.y * 500), cp.z + S.sunDir.z * 500);
    this.sun.target.position.copy(cp);
    this.moon.color.set('#9fb4ff');
    this.moon.intensity = (S.moonVis ?? 0) * this.night * 0.85;
    this.moon.position.set(cp.x + S.moonDir.x * 500, cp.y + Math.max(30, S.moonDir.y * 500), cp.z + S.moonDir.z * 500);
    this.moon.target.position.copy(cp);
    shared.uAmb.value.copy(S.amb).multiplyScalar(S.ambI * (0.62 + this.night * 0.55));
    shared.uSun.value.copy(S.sun).multiplyScalar(S.sunI * S.sunVis * clamp(S.sunDir.y + 0.35, 0, 1) * 0.55);
    shared.uLamps.value = S.lamps;
    shared.uGlow.value = S.glow;
    shared.uSignGlow.value = S.glow * 0.42 + 0.04;
    shared.uSpriteLight.value.copy(S.amb).multiplyScalar(S.ambI * 0.95).add(this._c1 = (this._c1 || new THREE.Color()).copy(S.sun).multiplyScalar(S.sunI * S.sunVis * 0.4));
    shared.uLampAdd.value.copy(shared.uLampCol.value).multiplyScalar(S.lamps * 0.75);
    shared.uSkyRefl.value.copy(S.hor).multiplyScalar(0.75).add(this._c2 = (this._c2 || new THREE.Color()).copy(S.city).multiplyScalar(0.6));
    shared.uZenith.value.copy(S.zen);
    shared.uHorizon.value.copy(S.hor);
    shared.uSunDir.value.copy(S.sunDir);
    shared.uSunColor.value.copy(S.sun).multiplyScalar(S.sunVis);
    shared.uMoonDir.value.copy(S.moonDir);
    shared.uFlash.value = this.weather.flash;
    shared.uRain.value = this.weather.rain;
    // after dark the streets are always a little wet: lamps and tail lights streak across the tarmac, the road shines
    shared.uWet.value = damp(shared.uWet.value, Math.max(this.wetTarget || 0, this.weather.rain, this.night * 0.6), 0.5, dt);
    shared.uHead.value = smoothstep(18.25, 18.9, hour) * (1 - smoothstep(29.4, 29.9, hour));
    const M = this.world.mats;
    M.lamp.color.setScalar(0.12 + S.lamps * 0.95);
    M.neon.color.setScalar(0.15 + S.glow * 0.9);
    M.always.color.setScalar(0.6 + this.night * 0.5);
    this.R.bloom.strength = 0.28 + this.night * 0.14;
    this.R.bloom.threshold = 0.92;
    this.R.renderer.toneMappingExposure = 1.0 + this.night * 0.08;
    const fd = this.world.farDisc;
    fd.position.set(cp.x, tr.groundAt(Math.min(P.s, tr.length)) - (st.farWater ? 1.0 : 6), cp.z);
    this.world.farMatGround.color.copy(S.fog).multiplyScalar(0.7);
    this.sky.update(dt, this.R.camera, S, this.time, this.weather.flash, this.weather.rain);
    this.envT -= dt;
    if (this.envT <= 0) {
      this.envT = 2.5;
      this.env = makeEnvMap(this.R.renderer, S, this.env);
      applyEnv(this.car, this.env.texture);
    }
  }

  updateRoadUniforms() {
    const P = this.player;
    for (const tr of this.world.tracks.values()) {
      const u = tr.roadMat.uniforms;
      let s = -9999, x = 0, cs = -9999, cx = 0;
      if (tr === P.track) { s = P.s; x = P.x; cs = this.cam.camS; cx = this.cam.camX; }
      else if (tr.parent === P.track) { s = P.s - P.track.length; x = P.x - tr.side * FORK_OFF; cs = this.cam.camS - P.track.length; cx = this.cam.camX - tr.side * FORK_OFF; }
      else if (P.track.parent === tr) { s = P.s + tr.length; x = P.x + P.track.side * FORK_OFF; cs = this.cam.camS + tr.length; cx = this.cam.camX + P.track.side * FORK_OFF; }
      u.uPlayerS.value = s;
      u.uPlayerX.value = x;
      u.uCamS.value = cs;
      u.uCamX.value = cx;
    }
  }

  // ------------------------------------------------------------ visuals & fx
  updateCarVisual(dt) {
    const P = this.player;
    const C = this.car;
    const pose = P.pose(this._pose || (this._pose = { pos: new THREE.Vector3() }));
    const g = C.group;
    g.position.copy(pose.pos);
    g.position.y += pose.lift;
    g.rotation.set(0, 0, 0);
    g.rotateY(-pose.yaw);
    g.rotateX(pose.pitch);
    C.body.rotation.set(0, 0, 0);
    C.body.rotateZ(pose.roll);
    C.body.position.y = Math.abs(P.bounce) * 0.6;
    for (const w of C.wheels) w.rotation.x = -P.wheelSpin;
    for (const f of C.front) f.rotation.y = -P.steer * 0.42;
    if (C.steeringWheel) C.steeringWheel.rotation.z = P.steer * 1.6;
    const head = shared.uHead.value;
    this.popT = damp(this.popT || 0, head > 0.4 ? 1 : 0, 5, dt);
    for (const p of C.popups) p.rotation.x = -this.popT * 1.25;
    C.headMat.color.setRGB(2.5 * (0.3 + head), 2.4 * (0.3 + head), 2.1 * (0.3 + head));
    C.tailMat.color.setRGB(0.5 + this.night * 0.8 + (P.braking ? 1.8 : 0), 0.03, 0.02);
    C.spot.intensity = head * 45;
    if (C.driver) { C.driver.rotation.z = -P.lean * 2; C.driver.position.x = 0.4 + P.lean * 0.5; }
    if (C.armsUp) C.armsUp.visible = false;
    if (C.ledMat) C.ledMat.color.setHSL((this.time * 0.2) % 1, 1, 0.6).multiplyScalar(2.4);
    g.updateMatrixWorld();
  }

  updateFx(dt) {
    const P = this.player;
    const C = this.car;
    const g = C.group;
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(g.quaternion);
    const vel = new THREE.Vector3(0, 0, -1).applyQuaternion(g.quaternion).multiplyScalar(P.v);
    const rearL = new THREE.Vector3(-0.8, 0.1, C.dims.len * 0.32).applyMatrix4(g.matrixWorld);
    const rearR = new THREE.Vector3(0.8, 0.1, C.dims.len * 0.32).applyMatrix4(g.matrixWorld);
    if (P.slip > 0.3 && P.v > 10 && fx.next() < P.slip * 0.5) {
      this.particles.smoke(rearL, vel, P.slip * 0.6);
      this.particles.smoke(rearR, vel, P.slip * 0.6);
    }
    if (P.offroad > 0.5 && P.v > 6 && fx.next() < 0.7) this.particles.dust(fx.next() < 0.5 ? rearL : rearR, vel);
    const wet = shared.uWet.value;
    if ((wet > 0.85 || this.weather.rain > 0.25) && P.v > 12 && fx.next() < 0.35) {
      this.particles.spray(rearL, vel, wet);
      this.particles.spray(rearR, vel, wet);
    }
    if (P.scrape && P.v > 10) {
      const side = P.x < 0 ? -1 : 1;
      this.particles.sparks(new THREE.Vector3(side * 1.0, 0.3, 0).applyMatrix4(g.matrixWorld), back);
    }
    if (this.backfire > 0) {
      this.backfire = 0;
      for (const e of C.exhaust) this.particles.backfire(e.clone().applyMatrix4(g.matrixWorld), back);
      audio.backfire();
    }
    // nitro: blue flame out of every pipe
    if (P.boosting) for (const e of C.exhaust) this.particles.jet(e.clone().applyMatrix4(g.matrixWorld), back, 1.2);
    if (C.def.id === 'rickshaw' && P.throttle > 0.2) {
      for (const e of C.exhaust) this.particles.jet(e.clone().applyMatrix4(g.matrixWorld), back, 0.4 + P.throttle);
    }
    const st = P.track.stage;
    if ((st.id === 'dhanmondi' || st.district === 'dhanmondi' || st.id === 'shahbag' || st.district === 'shahbag') && fx.next() < 0.5) {
      const p = P.track.point(P.s + 10 + fx.next() * 40, (fx.next() - 0.5) * 30, 4 + fx.next() * 6, new THREE.Vector3());
      this.particles.petals(p.x, p.y, p.z, new THREE.Vector3(1.2, 0, 0.4));
    }
    for (const e of this.world.emitters) if (fx.next() < 0.25) this.particles.kilnSmoke(e.pos[0], e.pos[1], e.pos[2]);
    const thunder = this.weather.update(dt, this.R.camera, vel, this.rainTarget || 0, this.storm);
    this.weather.lines.visible = this.weather.uniforms.uAmount.value > 0.02;
    if (thunder != null) audio.thunder(thunder);
  }

  // ------------------------------------------------------------ audio
  updateAudio(dt) {
    const P = this.player;
    const st = P.track.stage;
    const quiet = this.state === 'paused';
    const river = st.L === 'river' || st.R === 'river' || st.farWater;
    audio.update({
      rpm: P.rpm, throttle: P.throttle, speed: P.v, vmax: P.vmax, slip: P.slip, offroad: P.offroad, scrape: P.scrape,
      engineOn: !quiet && !this.attract.on, convertible: P.def.id === 'rosso' || P.def.id === 'miata',
      rain: this.weather.rain, city: river ? 0.5 : 1 - this.night * 0.3, river: river ? 1 : 0,
      siren: 0, rotor: 0, boost: P.boosting && this.state === 'race',
      crowd: quiet ? 0 : 0.2, rival: quiet || !this.race.active ? null : this.race.nearest(),
    });
    // the city around you
    this.birdT = (this.birdT || 3) - dt;
    if (this.birdT <= 0) {
      this.birdT = 4 + fx.next() * 8;
      const h = this.hour || 17;
      if (h < 18.6 || h > 29.2) audio.crow(fx.next() - 0.5);
      else if (st.L === 'field' || st.L === 'kash' || st.L === 'park') audio.cricket();
    }
    if (st.launches) {
      this.shipT = (this.shipT || 5) - dt;
      if (this.shipT <= 0) { this.shipT = 9 + fx.next() * 10; audio.shipHorn(-0.7); }
    }
  }

  // ------------------------------------------------------------ HUD
  updateHUD(dt) {
    const P = this.player;
    const tr = P.track;
    const R = this.race;
    if (!R.active) return;
    // the driver's speech bubble rides above the car
    const bv = this._bv.copy(this.car.group.position);
    bv.y += this.car.dims.hgt + 0.5;
    bv.project(this.R.camera);
    this.hud.bubbleAt((bv.x * 0.5 + 0.5) * window.innerWidth, (-bv.y * 0.5 + 0.5) * window.innerHeight);
    let progress;
    if (this.kind === 'circuit') progress = (P.s - tr.gateS) / (tr.goalS - tr.gateS);
    else progress = (ROUTE.indexOf(tr.stageId) + clamp(P.s / tr.length, 0, 1)) / ROUTE.length;
    this.hud.update(dt, {
      pos: R.position, field: R.field, near: R.neighbours(), coins: R.coins, raceT: R.time, par: R.par, lapT: this.kind === 'circuit' ? R.lapT : R.time,
      speed: P.kmh, rpm: audio.rpmNorm ?? P.rpm, gearN: audio.vg ? audio.vg.gear : 0,
      progress: clamp(progress, 0, 1), stageId: tr.stage.district || tr.stageId,
      lap: Math.min(R.lap, tr.laps || 1), laps: tr.laps, ko: R.nextKnockout(),
      fuel: P.fuel, nitro: P.nitro, boosting: P.boosting,
      cross: this.crossInfo(),
    });
    this.hud.tags(this.state === 'race' || this.state === 'countdown' ? R.tags(this.R.camera) : []);
  }

  // the road-works cross-over for the HUD: metres to the barrier while it is ahead, and whether you still need to cross
  crossInfo() {
    const P = this.player;
    const z = contraAt(P.track, P.s, 700);
    if (!z || P.wrongWay) return null;
    return { d: Math.max(0, z.s0 - P.s) };
  }

  // ------------------------------------------------------------ music: each district has its own song
  areaMusic(stage, fade = 5) {
    if (this.musicOff) return;
    const i = TRACKS.findIndex((t) => t.id === stage.music);
    if (i < 0) return;
    music.play(i, fade);
    const t = TRACKS[i];
    this.hud.radio(`${t.title.toUpperCase()}`, t.freq, true);
  }

  toggleMusic() {
    this.musicOff = !this.musicOff;
    if (this.musicOff) { music.stop(1); this.hud.radio('MUSIC OFF', '--.-', false); }
    else this.areaMusic(this.player.track.stage, 1.5);
  }
}
