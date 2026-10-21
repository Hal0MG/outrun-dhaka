// The race: timer, checkpoints, forks, score, combos, stage events, lighting,
// and everything that makes it loud: enemies, takedowns, nitro, jumps,
// smashable everything, bouncing pedestrians, set pieces and bosses.

import * as THREE from 'three';
import { World, GATE_S, FORK_OFF } from '../world/world.js';
import { LANE_W } from '../world/track.js';
import { Sky } from '../world/sky.js';
import { Atmosphere } from '../world/atmosphere.js';
import { shared } from '../world/materials.js';
import { STAGES, PYRAMID, LEVEL_TIME, CHECKPOINT_BONUS, ENDINGS } from '../world/stages.js';
import { contraAt, jamSpan } from '../world/zones.js';
import { SAREE_CSS } from '../world/fxatlas.js';
import { Player } from './player.js';
import { HCTPlayer } from './hctplayer.js';
import { Circuit, CIRCUIT_FIELD } from './circuit.js';
import { CameraRig } from './camera.js';
import { Traffic, ENEMY_TYPES } from './traffic.js';
import { Particles } from './particles.js';
import { Weather } from './weather.js';
import { SetPieces } from './dynamic.js';
import { Breakables, debrisOf } from './breakables.js';
import { Peds } from './peds.js';
import { Bosses } from './bosses.js';
import { loadCarAssets } from './carassets.js';
import { Race, FIELD, RIVALS } from './race.js';
import { CARS, buildPlayerCar, makeEnvMap, applyEnv, attachSaree, attachBags } from './cars.js';
import { audio } from '../audio/audio.js';
import { music, TRACKS } from '../audio/music.js';
import { clamp, lerp, damp, smoothstep, fx, bn, fmtTime } from '../core/util.js';

const COMBO = ['NEAR MISS', 'NEAR MISS', 'NEAR MISS', 'NEAR MISS', 'NEAR MISS', 'NEAR MISS'];
const SAREE_COLS = [[0.9, 0.08, 0.2], [1, 0.7, 0.05], [0.1, 0.6, 0.3], [1, 0.25, 0.6], [0.15, 0.4, 0.95], [0.6, 0.2, 0.8], [1, 1, 1]];

export class Game {
  constructor(R, input, hud, dialogue, settings) {
    this.R = R;
    this.scene = R.scene;
    this.input = input;
    this.hud = hud;
    this.say = dialogue;
    this.settings = settings;
    this.world = new World(this.scene, R.renderer);
    this.atmo = new Atmosphere();
    this.time = 0;
    this.mode = 'arcade';
    this.state = 'boot';
    this.ts = 1;
    this.slowT = 0;
    this.slowK = 1;
  }

  async init(progress) {
    await loadCarAssets();
    this.world.buildAssets(progress);
    progress?.('Hanging the sky');
    this.sky = new Sky(this.scene);
    this.hemi = new THREE.HemisphereLight('#9db4d6', '#4a4038', 1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffd59a', 1.5);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.scene.fog = new THREE.FogExp2('#e8cfa6', 0.0012);
    progress?.('Gathering rickshaws');
    this.traffic = new Traffic(this.scene, this.world.assets, this.world);
    this.particles = new Particles(this.scene);
    this.weather = new Weather(this.scene);
    this.pieces = new SetPieces(this.scene, this.world.assets, this.world.mats);
    this.breakables = new Breakables(this.scene, this.world);
    this.peds = new Peds(this.scene, this.world);
    this.bosses = new Bosses(this.scene, this.world, this.traffic, this.breakables, this.particles);
    this.world.onChunk = (ch) => this.pieces.addRides(ch);
    this.race = new Race(this);
    this.circuit = new Circuit(this);
    this.cam = new CameraRig(this.R.camera);
    this.carIndex = this.settings.car ?? 0;
    this.colorIndex = this.settings.color ?? 0;
    this.buildCar();
    this.resetWorld('dhanmondi');
    // pre-build the first chunks
    for (let i = 0; i < 14; i++) this.world.stream(this.player.track, this.player.s, 4);
  }

  // ------------------------------------------------------------ car
  buildCar() {
    const def = CARS[this.carIndex];
    if (this.car) this.scene.remove(this.car.group);
    const color = def.colors[this.colorIndex % def.colors.length];
    this.car = buildPlayerCar(def, color, { misc: this.world.assets.misc, fx: this.world.assets.fx, mats: this.world.mats });
    this.scene.add(this.car.group);
    if (this.env) applyEnv(this.car, this.env.texture);
    const prev = this.player;
    this.player = this.mode === 'circuit' ? new HCTPlayer(def) : new Player(def);
    if (prev) {
      this.player.track = prev.track;
      this.player.s = prev.s;
      this.player.x = prev.x;
    }
    this.updateExtras();
    audio.setEngineKind(def.engine || (def.id === 'rosso' ? 'v12' : def.id === 'premio' ? 'i4' : def.id === 'cng' ? 'cng' : 'jet'));
  }

  resetWorld(stageId) {
    this.instantAtmo = true;
    this._tint = null;
    const tr = this.world.startTrack(stageId);
    this.player.reset(tr);
    this.player.s = tr.gateS - 18;
    this.player.x = -tr.halfWAt(0) + LANE_W * 1.5;
    this.traffic.clear();
    this.pieces.clear();
    this.breakables.clear();
    this.peds.clear();
    this.bosses.clear();
    this.hud.boss(false);
    this.hud.saree(false);
    this.path = [stageId];
    this.stageIndex = 0;
    this.hud.setPath(this.path);
    this.sky.setSkyline(tr.stage.skyline || 'midrise', true);
    this.firedLines = new Set();
    this.firedEvents = new Set();
    this.outage = 0;
    this.cam.init = false;
    this.applyStageAtmo(tr);
    this.instantAtmo = false;
    this.traffic.populate(tr, tr.gateS + 60, tr.gateS + 900, (tr.stage.traffic?.density || 15) * 0.9);
    this.envT = 0;
    this.sareeT = 0;
    this.bags = false;
    this.updateExtras();
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

  // ------------------------------------------------------------ run lifecycle
  // swap the driving model when the mode changes (circuit vs the Run)
  usePlayer(mode) {
    const want = mode === 'circuit' ? HCTPlayer : Player;
    if (this.player.constructor === want) return;
    const prev = this.player;
    this.player = new want(CARS[this.carIndex]);
    this.player.track = prev.track;
  }

  // the Horizon Chase-style race: grid, three laps, nineteen rivals, nothing else on the road
  startCircuit() {
    this.mode = 'circuit';
    this.race.stop();
    this.racing = false;
    this.usePlayer('circuit');
    this.resetWorld('circuit');
    this.timeLeft = Infinity;
    this.score = 0;
    this.lap = 0;
    this.totalTime = 0;
    this.combo = 0;
    this.nearMisses = 0;
    this.crashes = 0;
    this.say.reset();
    this.say.quiet = true;
    this.circuit.start();
    for (let i = 0; i < 14; i++) this.world.stream(this.player.track, this.player.s, 4);
    this.state = 'countdown';
    this.countT = 0;
    this.countStep = -1;
    const st = this.player.track.stage;
    this.areaMusic(st, 1.5);
    this.hud.setStage(st, true);
    this.hud.setCircuit(true);
    this.hud.msg.classList.remove('show');
    this.hud.msgT = 0;
    this.hud.show(true);
    this.cam.mode = 'chase';
    this.cam.init = false;
    this.goalReached = null;
    this.eliminated = null;
  }

  leaveCircuit() {
    if (this.circuit.active) this.circuit.stop();
    this.say.quiet = false;
    this.hud.setCircuit(false);
  }

  onCircuitLap(n, laps) {
    this.hud.message(n === laps ? 'FINAL LAP' : `LAP ${n} / ${laps}`, 2);
    audio.checkpoint();
  }

  onCircuitPickup(p) {
    if (p.kind === 'coin') { audio.tone('square', 1500 + (this.circuit.coins % 5) * 120, 0.07, 0.05, { lp: 5000 }); this.score = this.circuit.coins; }
    else if (p.kind === 'fuel') { audio.checkpoint(); this.hud.combo('FUEL', '+TANK'); }
    else if (p.kind === 'nitro') { audio.blip(1800); this.hud.combo('NITRO', '+1 CHARGE'); }
  }

  onCircuitFinish(res) {
    const P = this.player;
    const tr = P.track;
    this.circuitResult = res;
    if (res.out) {
      this.state = 'gameover';
      this.overT = 0;
      this.hud.message('OUT OF FUEL', 3);
      this.onCircuitEnd?.(res, 2200);
      return;
    }
    this.state = 'goal';
    this.endT = 0; this._endInit = false; this._endLook = null;
    audio.goal();
    const g = tr.point(tr.goalS + 3, 0, 7, new THREE.Vector3());
    this.particles.confetti(g.x, g.y, g.z);
    this.particles.confetti(g.x, g.y + 2, g.z);
    this.hud.message(res.pos === 1 ? 'WINNER!' : `FINISHED P${res.pos}`, 3.5);
    this.onCircuitEnd?.(res, 3800);
  }

  startRun(mode) {
    if (mode === 'circuit') return this.startCircuit();
    this.leaveCircuit();
    this.usePlayer(mode);
    this.mode = mode;
    this.resetWorld('dhanmondi');
    const diff = this.settings.difficulty || 'normal';
    // the Run has no clock: you race the field, and each stage has a position to reach
    this.timeLeft = Infinity;
    this.traffic.densityMul = diff === 'easy' ? 0.75 : diff === 'hard' ? 1.25 : 1;
    this.score = 0;
    this.lap = 0;
    this.totalTime = 0;
    this.combo = 0;
    this.comboT = 0;
    this.nearMisses = 0;
    this.crashes = 0;
    this.takedowns = 0;
    this.smashed = 0;
    this.bounced = 0;
    this.chainT = 0;
    this.chain = 0;
    this.say.reset();
    this.racing = mode === 'arcade';
    if (this.racing) {
      this.race.start();
      // the grid owns the first stretch of road
      this.traffic.list = this.traffic.list.filter((v) => v.s > this.player.s + 320);
    } else this.race.stop();
    this.state = 'countdown';
    this.areaMusic(STAGES.dhanmondi, 1.5);
    this.countT = 0;
    this.countStep = -1;
    this.hud.setStage(STAGES.dhanmondi, true);
    this.hud.show(true);
    this.lowWarned = false;
    this.cam.mode = 'chase';
    this.goalReached = null;
    this.player.boost = 0.35;
  }

  // the story card is done: lights
  beginCountdown() {
    this.state = 'countdown';
    this.countT = 0;
    this.countStep = -1;
    this.hud.setStage(this.player.track.stage, true);
    const need = this.race.target(this.player.track.level);
    setTimeout(() => this.hud.warn(need === 1 ? 'FINAL STAGE · FINISH FIRST' : `REACH P${need} BY THE END OF THE STAGE`, 4), 3400);
  }

  eliminate(pos, need) {
    if (this.state !== 'race') return;
    this.state = 'gameover';
    this.overT = 0;
    this.eliminated = { pos, need, stage: this.race.snap?.stageId };
    this.hud.boss(false);
    this.say.say('eliminated', true);
    this.onTimeUp?.();
  }

  // back to the start of the stage you failed, with the field as it was
  retryStage() {
    const sn = this.race.snap;
    if (!sn) return this.startRun(this.mode);
    this.resetWorld(sn.stageId);
    this.path = sn.path.slice();
    this.stageIndex = this.path.length - 1;
    this.hud.setPath(this.path);
    this.race.restore();
    this.traffic.list = this.traffic.list.filter((v) => v.s > this.player.s + 320);
    this.score = sn.score;
    this.eliminated = null;
    this.goalReached = null;
    this.player.boost = 0.35;
    this.hud.show(true);
    this.areaMusic(this.player.track.stage, 1.5);
    this.beginCountdown();
  }

  onPosition(pos, prev) {
    this.hud.position(pos, pos < prev);
    if (pos < prev) {
      audio.blip(1400);
      this.addScore(1500 * (prev - pos));
      if (pos === 1) this.say.say('lead', true);
      else if (fx.next() < 0.25) this.say.say('posGain');
    } else if (fx.next() < 0.3) this.say.say('posLose');
  }

  // a moment of slow motion
  slowmo(k, dur) {
    return; // no slow motion
    this.slowK = Math.min(this.slowK, k);
    this.slowT = Math.max(this.slowT, dur);
  }

  // ------------------------------------------------------------ per-frame
  update(dtReal) {
    // world time can slow down for the big moments
    let tsT = 1;
    if (this.slowT > 0) { this.slowT -= dtReal; tsT = this.slowK; if (this.slowT <= 0) this.slowK = 1; }
    const P = this.player;
    if (false) {
      const u = P.airU();
      if (u > 0.08 && u < 0.9) tsT = Math.min(tsT, Math.max(0.72, P.air.slow));
    }
    this.ts = damp(this.ts, tsT, tsT < this.ts ? 14 : 5, dtReal);
    const dt = dtReal * this.ts;
    this.time += dt;
    const input = this.input;
    shared.uTime.value = this.time;

    let autopilot = null;
    let cinematic = false;
    const st = this.state;
    if (st === 'title' || st === 'menu' || st === 'garage' || st === 'radio' || st === 'settings' || st === 'scores' || st === 'howto') {
      autopilot = this.attract(dt);
      cinematic = st === 'garage' ? 'garage' : 'title';
    } else if (st === 'countdown' || st === 'story') {
      autopilot = { throttle: 0, steer: 0, brake: 1 };
      if (st === 'countdown') this.updateCountdown(dt);
    } else if (st === 'goal' || st === 'ending' || st === 'nameentry2') {
      autopilot = { throttle: 0, steer: -P.x * 0.08, brake: P.v > 2 ? 0.75 : 1 };
      cinematic = 'ending';
    } else if (st === 'gameover') {
      autopilot = { throttle: 0, steer: 0, brake: 0.25 };
    } else if (st === 'race') {
      this.raceInput(dt);
      if (window.__auto) autopilot = this.autoDrive(window.__autoSpeed || 90, window.__autoSide);
    }

    if (this.mode === 'circuit' && this.circuit.active && st !== 'paused' && st !== 'photo') {
      // the circuit: you, the field, the pickups and the scenery; every other system stays off
      P.update(dt, input, this.world, { autopilot, wet: shared.uWet.value });
      this.handlePlayerEvents();
      this.circuit.update(dt);
      this.world.stream(P.track, P.s, 2, cinematic === 'ending' ? 300 : 160);
      this.world.update(dt, this.time);
      this.updateFx(dt);
    } else if (st !== 'paused' && st !== 'photo') {
      const wet = shared.uWet.value;
      P.update(dt, input, this.world, { auto: true, autopilot, wet });
      this.handlePlayerEvents();
      this.handleFork();
      if (st === 'race') this.raceLogic(dt);
      this.traffic.update(dt, P, this.world, { densityMul: st === 'race' || st === 'countdown' ? 1 : 0.7 });
      this.handleTrafficEvents();
      if (this.racing) this.race.update(dt);
      this.bosses.update(dt, P, this.R.camera);
      this.handleBossEvents();
      this.peds.update(dt, P, this.world, st !== 'countdown' && st !== 'story', this.traffic.list);
      this.handlePedEvents();
      this.world.stream(P.track, P.s, 2, cinematic === 'ending' ? 300 : 160);
      this.world.update(dt, this.time);
      this.updateFx(dt);
    }

    // camera
    if (window.__camHold) { /* debug: camera placed by hand */ }
    else if (st === 'photo') this.photoCam(dtReal);
    else if (cinematic === 'garage') this.cam.update(dt, P, { cinematic: true, orbitSpeed: 0.25, radius: 7.5, height: 1.9, fov: 42 });
    else if (cinematic === 'title') this.titleCam(dt);
    else if (cinematic === 'ending') this.endingCam(dt);
    else this.cam.update(dt, P, { boost: P.boosting ? 12 : 0 });
    shared.uCamS.value = this.cam.camS;
    shared.uCamX.value = this.cam.camX;
    shared.uCamH.value = this.cam.camH;
    const cr = new THREE.Vector3().setFromMatrixColumn(this.R.camera.matrixWorld, 0);
    cr.y = 0;
    if (cr.lengthSq() > 1e-6) shared.uCamRight.value.copy(cr.normalize());

    this.updateAtmosphere(dt);
    this.updateCarVisual(dt);
    this.traffic.render(P, this.night, this.cam.camS, this.cam.camX);
    this.circuit.render(this.time);
    this.breakables.update(st === 'paused' || st === 'photo' ? 0 : dt, P, this.cam.camS);
    this.handleBreakableEvents(dtReal);
    this.updateRoadUniforms();
    this.updateAudio(dt);
    this.particles.setScale(this.R.renderer.domElement.height, this.R.camera.fov);
    this.particles.update(dt);
    if (this.hud.el.classList.contains('show')) this.updateHUD(dtReal);
    this.say.update(dtReal);
    // post fx
    const vr = P.v / P.vmax;
    const F = this.R.final.uniforms;
    F.uBlur.value = st === 'race' ? Math.max(0, vr - 0.85) * 0.4 + (P.boosting ? 0.2 : 0) : 0;
    F.uScan.value = this.settings.crt ? 1 : 0;
    F.uFlash.value = Math.max(this.weather.flash * 0.35, this.flashT || 0);
    this.flashT = Math.max(0, (this.flashT || 0) - dtReal * 2);
    F.uDim.value = this.dimT || 0;
  }

  // title / menu background: the car waits on the start line, nobody else on the road
  attract(dt) {
    if (this.circuit.active || this.mode === 'circuit') { this.leaveCircuit(); this.mode = 'arcade'; this.usePlayer('arcade'); this.resetWorld('dhanmondi'); }
    const P = this.player;
    this.traffic.list.length = 0;
    this.peds.clear?.();
    if (this.state !== 'garage' && P.s > P.track.gateS + 2) { this.resetWorld('dhanmondi'); }
    return { throttle: 0, steer: 0, brake: 1 };
  }

  // simple driver AI: hold a lane, counter-steer curves, dodge traffic
  autoDrive(want, forkSide) {
    const P = this.player;
    const tr = P.track;
    const s = Math.min(P.s, tr.length);
    const k = tr.kAt(s);
    const hw = tr.halfWAt(s);
    const lanes = Math.max(1, this.traffic.ourLanes(tr, s));
    if (!this._autoLane || this.time - this._autoLaneT > 0.6) {
      let best = 0, bestGap = -1;
      for (let l = 0; l < lanes; l++) {
        const lx = -hw + LANE_W * (l + 0.5);
        let gap = 400;
        for (const v of this.traffic.list) {
          if (v.track !== tr) continue;
          const d = v.s - P.s;
          if (d > -4 && d < gap && Math.abs(v.x - lx) < 2.4) gap = d;
        }
        gap -= Math.abs(lx - P.x) * 2;
        if (gap > bestGap) { bestGap = gap; best = l; }
      }
      this._autoLane = best + 1;
      this._autoLaneT = this.time;
    }
    let targetX = want < 25 ? -hw + LANE_W * 1.5 : -hw + LANE_W * (this._autoLane - 0.5);
    // aim for the ramp when a jam is ahead
    if (forkSide && !tr.isFinal && P.s > tr.length - 320) targetX = forkSide * hw * 0.55;
    const sec = tr.sectionAt(s);
    if (sec.surface === 'rail') targetX = this.pieces.safeRail?.(tr, P) ?? -LANE_W / 2;
    const cf = k * P.v * P.v * 0.14 * (1.15 - P.def.grip * 0.25) * (sec.cf ?? 1);
    const steerRate = 14 * clamp(P.v / 12, 0, 1) * (1 - 0.32 * Math.min(1, P.v / P.vmax)) * P.def.grip;
    let steer = clamp((cf + (targetX - P.x) * 1.4 - P.vx * 0.25) / Math.max(1, steerRate), -1, 1);
    for (const v of this.traffic.list) {
      if (v.track !== tr) continue;
      const d = v.s - P.s;
      if (d > 0 && d < 14 + P.v * 0.25 && Math.abs(v.x - P.x) < 2.2) { steer = clamp(steer + (P.x > v.x ? 0.7 : -0.7), -1, 1); }
    }
    const curveLift = Math.abs(k) * P.v * P.v * (sec.cf ?? 1) > 26 ? 1 : 0;
    return { throttle: P.v < want && !curveLift ? 1 : 0, brake: P.v > want + 3 ? 0.4 : (want === 0 ? 1 : 0), steer, boost: window.__autoBoost && P.boost > 0.5 };
  }

  // photo mode: frozen world, free orbit around the car
  togglePhoto() {
    if (this.state === 'photo') {
      this.state = this.photoPrev || 'race';
      this.hud.show(true);
      document.getElementById('photoHint').hidden = true;
      return false;
    }
    if (this.state !== 'race') return false;
    this.photoPrev = this.state;
    this.state = 'photo';
    this.photo = { a: 0.6, h: 1.6, r: 7.5 };
    this.hud.show(false);
    document.body.classList.add('racing');
    document.getElementById('photoHint').hidden = false;
    return true;
  }

  photoCam(dt) {
    const I = this.input;
    const ph = this.photo;
    if (I.held('left')) ph.a += dt * 1.2;
    if (I.held('right')) ph.a -= dt * 1.2;
    if (I.held('up')) ph.h = Math.min(14, ph.h + dt * 3);
    if (I.held('down')) ph.h = Math.max(0.4, ph.h - dt * 3);
    if (I.held('boost')) ph.r = Math.min(30, ph.r + dt * 6);
    if (I.held('horn')) ph.r = Math.max(3.5, ph.r - dt * 6);
    const pose = this.player.pose(this._pp || (this._pp = { pos: new THREE.Vector3() }));
    const cam = this.R.camera;
    const yaw = pose.yaw + ph.a;
    cam.position.set(pose.pos.x + Math.sin(yaw) * ph.r, pose.pos.y + pose.lift + ph.h, pose.pos.z - Math.cos(yaw) * ph.r);
    cam.up.set(0, 1, 0);
    cam.lookAt(pose.pos.x, pose.pos.y + pose.lift + 0.8, pose.pos.z);
    cam.fov = damp(cam.fov, 50, 4, dt);
    cam.updateProjectionMatrix();
  }

  // big jumps: swing out to the side and watch it happen
  airCam(dt) {
    const P = this.player;
    const tr = P.track;
    const cam = this.R.camera;
    const a = P.air;
    const u = P.airU();
    if (!a.camSide) a.camSide = (a.x1 != null ? -Math.sign(a.x1 - a.x0) : P.x > 0 ? -1 : 1) || 1;
    const side = a.camSide;
    const lift = a.h0 * (1 - u) + a.h * 4 * u * (1 - u);
    const p = tr.point(P.s - 5 - u * 5, P.x + side * (8 + u * 4), lift + 2.0 - u * 0.6, new THREE.Vector3());
    const l = tr.point(P.s + 4, P.x, lift + 0.5, new THREE.Vector3());
    if (this._airId !== a) { cam.position.copy(p); this._airId = a; }
    cam.position.lerp(p, 1 - Math.exp(-dt * 6));
    cam.up.set(0, 1, 0);
    cam.lookAt(l);
    cam.fov = damp(cam.fov, 60, 3, dt);
    cam.updateProjectionMatrix();
    this.cam.camS = P.s - 5; this.cam.camX = P.x + side * 8; this.cam.camH = lift + 2;
    this.cam.init = false;
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
    const ang = pose.yaw + Math.sin(t) * 0.75 + (Math.sin(t) > 0 ? 0 : 0);
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
    if (step !== this.countStep) {
      this.countStep = step;
      if (step === 0) { this.hud.signal('r'); audio.countBeep(false); }
      else if (step === 1) { this.hud.signal('r'); audio.countBeep(false); }
      else if (step === 2) { this.hud.signal('y'); audio.countBeep(false); }
      else if (step === 3) {
        this.hud.signal('g');
        audio.countBeep(true);
        this.state = 'race';
        this.hud.message('GO!', 1.2);
        setTimeout(() => this.hud.signal(null), 1400);
        if (this.mode !== 'circuit') setTimeout(() => this.say.say('start', true), 900);
      }
    }
  }

  raceInput(dt) {
    const I = this.input;
    const P = this.player;
    if (I.pressed('fire') && this.bosses.fire(P, this.R.camera)) audio.nitro();
    if (I.horn && !this.horning) {
      this.horning = true;
      audio.horn(audio.engineKind, true);
      this.traffic.honk(P);
      this.honkCount = (this.honkCount || 0) + 1;
      if (this.honkCount % 7 === 6) this.say.say('honk');
    } else if (!I.horn && this.horning) {
      this.horning = false;
      audio.horn(audio.engineKind, false);
    }
    if (P.boosting && !this._wasBoost) {
      audio.nitro();
      this.backfire = 0.15;
      if (!this._nitroSaid) { this._nitroSaid = true; this.say.say('nitro'); }
    }
    this._wasBoost = P.boosting;
  }

  addScore(pts) { this.score = Math.max(0, this.score + pts); }
  addBoost(f) { this.player.boost = clamp(this.player.boost + f, 0, 1); }

  // ------------------------------------------------------------ race rules
  raceLogic(dt) {
    const P = this.player;
    const tr = P.track;
    if (this.timeLeft !== Infinity) this.timeLeft -= dt;
    this.lap += dt;
    this.totalTime += dt;
    const lim = this.world.limits(tr, Math.min(P.s, tr.length), P.x);
    const wrong = lim.opp && !P.air;
    // score: distance at speed (double on the wrong side of the road)
    this.score += P.v * dt * (2 + (P.v / P.vmax) * 2.5) * (wrong ? 2 : 1);
    if (wrong) {
      this.addBoost(dt * 0.07);
      if (!this._wrongShown) { this._wrongShown = true; this.hud.warn('WRONG SIDE! SCORE ×2', 2.5); this.say.say('contra', true); }
    } else this._wrongShown = false;
    if (P.drift > 0.5) this.addBoost(dt * 0.09);
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    if (this.chainT > 0) { this.chainT -= dt; if (this.chainT <= 0) this.chain = 0; }
    if (this.timeLeft < 10 && !this.lowWarned) { this.lowWarned = true; this.say.say('lowtime', true); }
    if (this.timeLeft < 10 && this.timeLeft > 0) {
      const sec = Math.ceil(this.timeLeft);
      if (sec !== this._lastSec) { this._lastSec = sec; audio.timeWarn(); }
    }
    if (P.kmh > 300 && !this._fastSaid) { this._fastSaid = true; this.say.say('fast'); }
    // checkpoint gate (child tracks)
    if (!tr.isFirst && !tr.gatePassed && P.s >= tr.gateS) {
      tr.gatePassed = true;
      const bonus = CHECKPOINT_BONUS[tr.level] + (tr.stage.bonus || 0);
      if (this.timeLeft !== Infinity) this.timeLeft += bonus;
      this.hud.timeAdded();
      this.hud.message('CHECKPOINT', 2);
      this.hud.setStage(tr.stage, true);
      audio.checkpoint();
      this.lap = 0;
      const g = tr.point(tr.gateS + 3, 0, 7, new THREE.Vector3());
      this.particles.confetti(g.x, g.y, g.z);
      setTimeout(() => this.say.say('checkpoint', true), 2600);
    }
    // goal
    if (tr.isFinal && P.s >= tr.goalS && !this.goalReached && this.racing && this.race.position > 1) {
      this.goalReached = 'lost';
      this.eliminate(this.race.position, 1);
    }
    if (tr.isFinal && P.s >= tr.goalS && !this.goalReached) {
      this.goalReached = tr.stage.ending;
      this.state = 'goal';
      this.endT = 0; this._endInit = false; this._endLook = null;
      this.goalT = 0;
      audio.goal();
      const g = tr.point(tr.goalS + 3, 0, 7, new THREE.Vector3());
      this.particles.confetti(g.x, g.y, g.z);
      this.particles.confetti(g.x, g.y + 2, g.z);
      this.hud.message('GOAL!', 3.5);
      this.hud.boss(false);
      this.say.say('goal', true);
      this.goalBonus = this.timeLeft === Infinity ? 0 : Math.floor(Math.max(0, this.timeLeft) * 25000);
      this.onGoal?.(tr.stage.ending);
    }
    // time up
    if (this.timeLeft <= 0 && this.state === 'race') {
      this.timeLeft = 0;
      this.state = 'gameover';
      this.overT = 0;
      this.hud.boss(false);
      this.say.say('timeup', true);
      this.onTimeUp?.();
    }
    // stage dialogue
    const off = tr.contentOffset;
    for (const l of tr.stage.lines || []) {
      const key = tr.id + ':' + l.id + ':' + l.s;
      if (!this.firedLines.has(key) && P.s >= tr.mapS(l.s)) {
        this.firedLines.add(key);
        this.say.say(l.id, true);
      }
    }
    if (!tr.isFinal && P.s > tr.length - 260 && !tr.musicNext) {
      tr.musicNext = true;
      const kids = this.world.ensureChildren(tr);
      if (kids) this.areaMusic(kids[0].stage, 6);
    }
    if (!tr.isFinal && P.s > tr.length - 520 && !tr.forkSaid) {
      tr.forkSaid = true;
      const kids = this.world.ensureChildren(tr);
      if (kids) this.hud.warn(`NEXT · ${kids[0].stage.name.toUpperCase()}`, 3);
    }
    this.stageEvents(dt);
    this.railTrains(dt);
  }

  stageEvents(dt) {
    const P = this.player;
    const tr = P.track;
    const off = tr.contentOffset;
    const T = this.traffic;
    const fire = (key) => { if (this.firedEvents.has(key)) return false; this.firedEvents.add(key); return true; };
    let outageT = 0;
    this.siren = 0;
    this.planeMode = false;
    for (const [i, e] of (tr.stage.events || []).entries()) {
      const key = tr.id + ':' + i;
      const s = tr.mapS(e.s ?? e.s0);
      if (e.type === 'jam') {
        if (P.s > s - 560 && fire(key)) { const js = jamSpan(tr, e); T.spawnJam(tr, js.s0, js.s1 - js.s0); T.spawnJamCause(tr, js.s1); }
        if (P.s > s - 330 && P.s < s - 120 && fire(key + 'w')) {
          const z = contraAt(tr, s);
          this.hud.warn('JAM AHEAD', 3);
          this.say.say('jam', true);
        }
      } else if (e.type === 'loadshed') {
        const a = s, b = tr.mapS((e.s ?? 0) + (e.len || 600));
        if (P.s > a && P.s < b) {
          outageT = 1;
          if (fire(key)) {
            audio.powerCut();
            setTimeout(() => audio.generator(), 900);
            this.hud.warn('POWER CUT', 3);
            this.flickerT = 1.2;
          }
        } else if (P.s >= b && fire(key + 'end')) {
          audio.powerBack();
          
          this.flickerT = 0.8;
        }
      } else if (e.type === 'busrace') {
        if (P.s > s - 380 && fire(key)) {
          T.spawnBusRace(tr, P.s + 160);
          this.hud.warn('BUS RACE!', 3);
        }
      } else if (e.type === 'vip') {
        if (P.s > s && fire(key)) {
          const lane = T.spawnVIP(tr, P.s - 140);
          this.hud.warn('MOTORCADE BEHIND', 4);
          this.vipT = 14;
        }
      } else if (e.type === 'enemies') {
        if (P.s > s && fire(key) && !tr.sectionAt(Math.min(P.s, tr.length)).closed) {
          const n = e.n || 2;
          for (let k = 0; k < n; k++) {
            const behind = e.from !== 'ahead';
            const es = behind ? P.s - 70 - k * 18 : P.s + 160 + k * 25;
            T.spawnEnemy(tr, e.role, es, { speed: behind ? P.v * 0.9 + 6 : P.v * 0.7, lane: k % T.ourLanes(tr, P.s) });
          }
          const E = ENEMY_TYPES[e.role];
          this.hud.warn(e.label || `${E.label}${n > 1 ? 'S' : ''} ${e.from === 'ahead' ? 'AHEAD' : 'ON YOUR TAIL'}!`, 3);
          this.say.say(e.role === 'racer' ? 'racersNew' : e.role, true);
        }
      } else if (e.type === 'teslas') {
        if (P.s > s && fire(key)) {
          for (let k = 0; k < Math.ceil((e.n || 6) * 0.85); k++) { const ts = P.s + 150 + k * 34 + fx.next() * 10; if (T.spawnable(tr, ts)) T.spawn(tr, ts, { type: 'tesla' }); }
          this.hud.warn('E-RICKSHAWS AHEAD', 2.5);
          this.say.say('tesla', true);
        }
      } else if (e.type === 'boss') {
        if (P.s > s && fire(key)) {
          if (e.id === 'heli') this.bosses.startHeli(tr, P.s + 40, { end: e.end != null ? tr.mapS(e.end) : tr.length - 300, fromX: e.fromX });
          else if (e.id === 'bus') this.bosses.startBuses(tr, P.s);
        }
      } else if (e.type === 'racers') {
        if (P.s > s && fire(key) && !this.racing) {
          for (let k = 0; k < (e.n || 3); k++) T.spawnEnemy(tr, 'racer', P.s - 50 - k * 20, { speed: P.v * 0.95 + 8, lane: k });
          this.hud.warn('STREET RACERS!', 3);
          this.say.say('racersNew', true);
        }
      } else if (e.type === 'kites') {
        if (P.s > tr.mapS(e.s0) - 400 && fire(key)) this.pieces.spawnKites(tr, tr.mapS(e.s0), tr.mapS(e.s1), this.world.mats.sprite);
      } else if (e.type === 'fireworks') {
        if (P.s > tr.mapS(e.s0) && P.s < tr.mapS(e.s1)) {
          this.fwT = (this.fwT || 0) - dt;
          if (this.fwT <= 0) {
            this.fwT = 0.5 + fx.next() * 1.2;
            const p = tr.point(P.s + 80 + fx.next() * 220, fx.sign() * (25 + fx.next() * 130), 0, new THREE.Vector3(), true);
            this.particles.firework(p.x, p.y + 15, p.z);
            audio.firework();
          }
        }
      } else if (e.type === 'firebreathers') {
        if (P.s > tr.mapS(e.s0) && P.s < tr.mapS(e.s1)) {
          this.fbT = (this.fbT || 0) - dt;
          if (this.fbT <= 0) {
            this.fbT = 1.5 + fx.next() * 2.5;
            const p = tr.point(P.s + 60 + fx.next() * 120, fx.sign() * (tr.halfWAt(P.s) + 8 + fx.next() * 6), 18 + fx.next() * 6, new THREE.Vector3(), true);
            this.particles.flame(p.x, p.y, p.z);
            audio.noiseHit(0.6, 0.12, 'lowpass', 900, 0.8, { to: 200 });
          }
        }
      } else if (e.type === 'crowd') {
        if (P.s > tr.mapS(e.s0) && P.s < tr.mapS(e.s1)) {
          this.crowdT = (this.crowdT || 0) - dt;
          if (this.crowdT <= 0) { this.crowdT = 3.2; audio.crowdRoar(0.22); }
        }
      } else if (e.type === 'planes') {
        if (P.s > tr.mapS(e.s0) && P.s < tr.mapS(e.s1)) this.planeMode = true;
      } else if (e.type === 'railTrain') {
        if (P.s > s && fire(key)) {
          this.pieces.railTrain(tr, P.s + (e.ahead || 560), e.lane * LANE_W / 2, e.speed || 19);
          setTimeout(() => { if (this.state === 'race') { this.hud.warn(e.lane > 0 ? 'TRAIN! ◀ TAKE THE LEFT TRACK' : 'TRAIN! TAKE THE RIGHT TRACK ▶', 3); this.say.say('metroTrain', true); audio.trainHorn(); } }, 900);
        }
      } else if (e.type === 'warn') {
        if (P.s > s && fire(key)) { if (e.line) this.say.say(e.line, true); }
      } else if (e.type === 'title') {
        if (P.s > s && fire(key)) { /* set-piece titles are off: the place speaks for itself */ }
      }
    }
    // police sirens near you
    for (const v of T.list) {
      if (!v.enemy || v.wreck || !v.enemy.E.siren) continue;
      const d = Math.abs(T.relS(v, P));
      if (d < 220) this.siren = Math.max(this.siren, 1 - d / 220);
    }
    if (this.flickerT > 0) {
      this.flickerT -= dt;
      this.outage = fx.next() > 0.5 ? outageT : 1 - outageT;
    } else {
      this.outage = damp(this.outage, outageT, 6, dt);
    }
    if (this.vipT > 0) { this.vipT -= dt; this.siren = Math.max(this.siren, smoothstep(0, 3, this.vipT)); }
  }

  railTrains(dt) {
    // a metro train coming the other way on the track you are driving on
    const P = this.player;
    if (P.air || P.crash) return;
    for (const t of this.pieces.trains) {
      if (!t.onTrack || t.track !== P.track) continue;
      // the train body runs from its nose (t.s - 11) back to t.s - 11 + len; only the rail it is on is dangerous
      const front = t.s - 11, back = t.s - 11 + t.len;
      if (P.s + P.halfL * 0.85 > front && P.s - P.halfL * 0.85 < back && Math.abs(P.x - t.x) < 1.45 + P.halfW * 0.75) {
        P.startCrash('flip');
        t.v = 0;
      } else if (!t.passed && P.s > back) {
        t.passed = true;
        if (Math.abs(P.x - t.x) < 4.8) { this.addScore(5000); this.hud.combo('TRAIN DODGE!', '+5,000'); this.addBoost(0.2); audio.whoosh(); }
      }
    }
  }

  handleFork() {
    const P = this.player;
    const tr = P.track;
    if (!tr.isFinal && P.s > tr.length) {
      const verdict = this.racing && this.state === 'race' ? { pos: this.race.position, need: this.race.target(tr.level) } : null;
      const failed = verdict && verdict.pos > verdict.need;
      const { child, xNew } = this.world.commitFork(tr, P.x);
      P.track = child;
      P.s -= tr.length;
      P.x = xNew;
      this.path.push(child.stageId);
      this.stageIndex = this.path.length - 1;
      this.hud.setPath(this.path);
      if (this.racing) this.race.onFork(tr.length, !failed);
      if (failed) this.eliminate(verdict.pos, verdict.need);
      else if (verdict) {
        const next = this.race.target(child.level);
        this.hud.takedown(`STAGE CLEAR · P${verdict.pos}`, next === 1 ? 'FINAL STAGE · WIN IT' : `NEXT TARGET · P${next}`, 3);
        audio.checkpoint();
      }
      this.sky.setSkyline(child.stage.skyline || 'midrise');
      this.applyStageAtmo(child);
      this.pieces.clear();
      this.firedEvents = new Set([...this.firedEvents].filter((k) => k.startsWith(child.id)));
      if (this.bosses.active && this.bosses.active.kind === 'heli') { this.bosses.clear(); this.hud.boss(false); }
      if (this.state === 'title' || this.state === 'menu') return;
      this._fastSaid = false;
      if (child.stageId === 'oldDhaka' || child.stage.weather?.rain) setTimeout(() => this.say.say(child.stage.weather?.rain ? 'rain' : 'oldDhaka'), 4000);
    }
    if (tr.parent && P.s > 560 && !tr.gcDone) {
      tr.gcDone = true;
      this.world.gc(tr);
    }
  }

  handlePlayerEvents() {
    const P = this.player;
    const racing = this.state === 'race';
    for (const e of P.events) {
      if (e.type === 'crash') {
        audio.crash();
        this.cam.kick(0.6);
        this.flashT = 0.35;
        if (racing) { this.crashes++; this.combo = 0; this.say.say('crash', true); }
        const pose = P.pose({ pos: new THREE.Vector3() });
        for (let i = 0; i < 20; i++) this.particles.smoke(pose.pos, new THREE.Vector3(), 1.4, [0.5, 0.48, 0.46]);
        for (let i = 0; i < 6; i++) this.particles.sparks(pose.pos, new THREE.Vector3(fx.next() - 0.5, 0, fx.next() - 0.5));
      } else if (e.type === 'spin') {
        audio.hit();
        this.cam.kick(0.3);
        if (racing) { this.combo = 0; this.say.say('hit'); }
      } else if (e.type === 'hit') {
        audio.hit();
        this.cam.kick(e.hard ? 0.3 : 0.15);
        if (racing && fx.next() < 0.3) this.say.say('hit');
      } else if (e.type === 'bump') {
        audio.bump();
        this.cam.kick(0.12);
      } else if (e.type === 'scrape') {
        if (racing && fx.next() < 0.01) this.say.say('scrape');
      } else if (e.type === 'shift') {
        audio.shift(e.up);
        if (e.up && P.v > 20) this.backfire = 0.15;
      } else if (e.type === 'jump') {
        audio.jump();
        this.cam.kick(0.2);
        const lines = { store: 'storeJump', cinemaOut: 'cinemaOut', coaster: 'coaster' };
        if (racing && lines[e.kind]) this.say.say(lines[e.kind], true);
        if (e.kind === 'cinemaOut') { this.flashT = 0.6; audio.glass(); }
        if (e.kind === 'contra' && racing) this.say.say('bigair');
      } else if (e.type === 'land') {
        audio.land(e.h > 4);
        this.cam.kick(e.h > 4 ? 0.55 : 0.3);
        const pose = P.pose({ pos: new THREE.Vector3() });
        for (let i = 0; i < 14; i++) this.particles.dust(pose.pos, new THREE.Vector3((fx.next() - 0.5) * 10, 0, (fx.next() - 0.5) * 10));
        for (let i = 0; i < 4; i++) this.particles.sparks(pose.pos, new THREE.Vector3(fx.next() - 0.5, 0, fx.next() - 0.5));
        if (racing) {
          const air = e.airTime || 0;
          if (air > 0.6) {
            const pts = Math.round(air * 20) * 100;
            this.addScore(pts);
            this.addBoost(0.12 + air * 0.05);
            this.hud.combo('BIG AIR', `+${bn(pts.toLocaleString('en-US'))}`);
          }
          if (e.kind === 'store') setTimeout(() => this.say.say('store', true), 300);
          if (e.kind === 'storeOut') {
            this.sareeT = 22;
            this.bags = true;
            this.updateExtras();
            setTimeout(() => this.say.say('saree', true), 2600);
          }
        }
      }
    }
    P.events.length = 0;
    if (racing && P.offroad > 0.9 && P.v > 15) {
      this.offT = (this.offT || 0) + 1 / 60;
      if (this.offT > 1.5) { this.offT = -6; this.say.say('offroad'); }
    }
  }

  handleTrafficEvents() {
    const T = this.traffic;
    const P = this.player;
    const racing = this.state === 'race';
    for (const n of T.nearMisses) {
      if (!racing) continue;
      this.combo++;
      this.comboT = 4;
      this.nearMisses++;
      const pts = 500 * this.combo * (n.oncoming ? 2 : 1);
      this.addScore(pts);
      this.addBoost(n.oncoming ? 0.14 : 0.09);
      const c = COMBO[Math.min(this.combo - 1, COMBO.length - 1)];
      this.hud.combo(`${c} ×${bn(this.combo)}`, `+${bn(pts.toLocaleString('en-US'))}${n.oncoming ? ' · ONCOMING' : ''}`);
      audio.combo(this.combo);
      audio.whoosh();
      if (this.combo === 3) this.say.say('nearmiss');
    }
    T.nearMisses.length = 0;
    for (const h of T.honkReplies) audio.otherHorn(h.kind, h.d, fx.next() * 1.2 - 0.6);
    T.honkReplies.length = 0;
    for (const e of T.events) {
      const v = e.v;
      const pos = v.track.point(v.s, v.x, 0.8, new THREE.Vector3());
      if (e.type === 'takedown') {
        const rv = v.rival ? this.race.onWreck(v) : null;
        audio.thud();
        for (let i = 0; i < 12; i++) this.particles.smoke(pos, new THREE.Vector3(), 1.6, [0.3, 0.28, 0.27]);
        for (let i = 0; i < 10; i++) this.particles.sparks(pos, new THREE.Vector3(fx.next() - 0.5, 0.5, fx.next() - 0.5));
        this.particles.flame(pos.x, pos.y, pos.z);
        // only wrecks you caused get the big moment; enemies crashing on their own just crash
        const mine = e.cause === 'player' || this.traffic.time - (v.enemy.playerT ?? -99) < 3;
        if (!racing || v.enemy.role === 'bossbus' || !mine) continue;
        audio.takedown();
        this.cam.kick(0.35);
        const E = v.enemy.E;
        this.takedowns++;
        this.chain = this.chainT > 0 ? this.chain + 1 : 1;
        this.chainT = 6;
        const pts = E.score * this.chain;
        this.addScore(pts);
        this.addBoost(0.35);
        const how = e.cause === 'wall' ? 'INTO THE WALL' : e.cause === 'traffic' ? 'INTO TRAFFIC' : e.cause === 'enemy' ? 'FRIENDLY FIRE' : e.cause === 'barrier' ? 'INTO THE BARRIER' : 'RAMMED';
        if (this.timeLeft !== Infinity && E.time) { this.timeLeft += E.time; this.hud.timeAdded(); }
        this.hud.takedown(this.chain > 1 ? `TAKEDOWN ×${this.chain}` : 'TAKEDOWN', `+${bn(pts.toLocaleString('en-US'))}`);
        if (fx.next() < 0.6) this.say.say('takedown', true);
      } else if (e.type === 'tipped') {
        audio.smash(true);
        for (let i = 0; i < 10; i++) this.particles.smoke(pos, new THREE.Vector3(), 1.0, [0.5, 0.48, 0.46]);
        if (!racing) continue;
        if (e.cause === 'player') {
          const pts = v.type === 'tesla' ? 1500 : 2500;
          this.addScore(pts);
          this.addBoost(0.06);
          this.hud.combo(v.type === 'tesla' ? 'TIPPED' : 'SHUNTED', `+${bn(pts.toLocaleString('en-US'))}`);
        }
      } else if (e.type === 'tesla') {
        audio.otherHorn('cngHorn', 25, 0);
        if (racing && fx.next() < 0.5) this.say.say('tesla');
      } else if (e.type === 'ram') {
        audio.clang();
        this.cam.kick(e.by === 'enemy' ? 0.35 : 0.25);
        for (let i = 0; i < 4; i++) this.particles.sparks(pos, new THREE.Vector3((P.x - v.x) * 0.3, 0.2, 0));
      } else if (e.type === 'enemyHit') {
        if (e.cause === 'wall') for (let i = 0; i < 3; i++) this.particles.sparks(pos, new THREE.Vector3(Math.sign(v.x), 0.2, 0));
      } else if (e.type === 'clang') {
        audio.clang();
        for (let i = 0; i < 4; i++) this.particles.sparks(pos, new THREE.Vector3(0, 0.4, 0));
      }
    }
    T.events.length = 0;
  }

  handleBreakableEvents(dt) {
    const racing = this.state === 'race';
    const P = this.player;
    for (const e of this.breakables.events) {
      const b = e.b;
      const pos = b.track.point(b.s, b.x, (b.h || 0) + 0.8, new THREE.Vector3());
      if (e.type === 'smash') {
        const [kind, cols, n] = debrisOf(b.kind);
        this.debris(pos, kind, cols, n);
        if (b.kind === 'glass' || b.kind === 'tv' || b.kind === 'chandelier') audio.glass(); else audio.smash(b.kind === 'sofa' || b.kind.startsWith('stall') || b.kind === 'screen');
        this.cam.kick(0.08);
        if (racing && b.score) {
          this.smashed++;
          this.addScore(b.score);
          this.addBoost(0.02);
          this.smashN = (this.smashT > 0 ? this.smashN || 0 : 0) + 1;
          this.smashT = 1.6;
          if (this.smashN > 2) this.hud.combo('SMASH', `×${this.smashN}`);
          if (this.smashN === 6 && fx.next() < 0.5) this.say.say('smash');
        }
      } else if (e.type === 'hazard') {
        if (!P.air) {
          if (b.kind === 'saree') { this.sareeScreen = 2.6; this.hud.saree(true, SAREE_CSS[(fx.next() * SAREE_CSS.length) | 0]); }
          else if (b.mass > 0.2) P.startSpin(fx.sign());
          else { P.v *= 0.82; P.emit('hit', { hard: true }); }
        }
      } else if (e.type === 'pickup') {
        audio.checkpoint();
        this.debris(pos, 'money', null, 30);
        if (racing) { this.addScore(b.score || 3000); this.hud.combo('BONUS', `+${bn((b.score || 3000).toLocaleString('en-US'))}`); }
        this.bosses.damageHeli(0.07, 'loot');
      } else if (e.type === 'cat') {
        audio.tone('sine', 900, 0.25, 0.08, { to: 1400 });
        if (racing) { this.addScore(1000);  }
      } else if (e.type === 'land') {
        audio.thud();
        if (b.kind === 'tv' || b.kind === 'chandelier') { audio.glass(); this.debris(pos, 'glass', null, 10); }
      }
    }
    this.breakables.events.length = 0;
    if (this.smashT > 0) this.smashT -= dt;
    if (this.sareeScreen > 0) { this.sareeScreen -= dt; if (this.sareeScreen <= 0) this.hud.saree(false); }
  }

  // bits flying off a smashed thing
  debris(pos, kind, cols, n) {
    const PS = this.particles;
    const P = this.player;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.car.group.quaternion).multiplyScalar(P.v * 0.5);
    for (let i = 0; i < n; i++) {
      let c = cols ? cols[(fx.next() * cols.length) | 0] : SAREE_COLS[(fx.next() * SAREE_COLS.length) | 0];
      const vx = fwd.x + (fx.next() - 0.5) * 9, vy = 2 + fx.next() * 7, vz = fwd.z + (fx.next() - 0.5) * 9;
      if (kind === 'glass' || kind === 'spark') {
        PS.add.add(pos.x, pos.y + fx.next() * 2, pos.z, vx, vy, vz, c[0], c[1], c[2], 0.08 + fx.next() * 0.1, 0.6 + fx.next() * 0.6, { grav: 14, drag: 0.8 });
      } else if (kind === 'money') {
        PS.soft.add(pos.x + (fx.next() - 0.5) * 2, pos.y + fx.next() * 2, pos.z + (fx.next() - 0.5) * 2, vx * 0.5, vy, vz * 0.5, 0.5, 0.7, 0.45, 0.18, 3 + fx.next() * 2, { grav: 1.5, drag: 1.2, alpha: 1 });
      } else if (kind === 'cloth' || kind === 'pop' || kind === 'feather') {
        if (kind === 'pop') c = [1, 0.97, 0.8];
        if (kind === 'feather') c = [1, 1, 1];
        PS.soft.add(pos.x, pos.y + fx.next() * 1.5, pos.z, vx, vy, vz, c[0], c[1], c[2], kind === 'pop' ? 0.08 : 0.1 + fx.next() * 0.08, 1.8 + fx.next() * 1.6, { grav: kind === 'cloth' ? 2.5 : 4, drag: 1.6, alpha: 1 });
      } else if (kind === 'fruit') {
        const fc = [[1, 0.55, 0.1], [1, 0.85, 0.2], [0.2, 0.65, 0.2], [0.9, 0.15, 0.1]][(fx.next() * 4) | 0];
        PS.soft.add(pos.x, pos.y, pos.z, vx, vy, vz, fc[0], fc[1], fc[2], 0.16, 1.4 + fx.next(), { grav: 14, drag: 0.6, alpha: 1 });
      } else if (kind) {
        PS.soft.add(pos.x, pos.y, pos.z, vx, vy, vz, c[0], c[1], c[2], 0.12 + fx.next() * 0.12, 1.2 + fx.next(), { grav: 14, drag: 0.7, alpha: 1 });
      }
    }
  }

  handlePedEvents() {
    const racing = this.state === 'race';
    const P = this.player;
    for (const e of this.peds.events) {
      if (e.type === 'ped') {
        audio.boing();
        audio.thud();
        this.cam.kick(0.12);
        if (!racing) continue;
        this.bounced++;
        this.addScore(-500);
        P.v *= 0.94;
        const lines = ['PEDESTRIAN'];
        this.hud.combo(fx.pick(lines), '−500');
        if (fx.next() < 0.35) this.say.say('ped');
      } else if (e.type === 'pedDown') {
        audio.thud();
      } else if (e.type === 'cow') {
        audio.moo();
        if (!P.spin && P.v > 10) P.startSpin(fx.sign());
      }
    }
    this.peds.events.length = 0;
  }

  handleBossEvents() {
    const B = this.bosses;
    const racing = this.state === 'race';
    for (const e of B.events) {
      if (e.type === 'bossStart') {
        if (!racing) continue;
        this.hud.boss(true, e.b.name, e.b.sub, e.b.kind === 'heli');
        audio.bossStinger();
      } else if (e.type === 'bossHit') {
        this.hud.bossHP(B.hpFrac(), true);
        if (e.why === 'rocket' && racing) { audio.takedown(); this.cam.kick(0.4); this.addScore(5000); }
      } else if (e.type === 'bossDown') {
        this.hud.boss(false);
        audio.victory();
        this.slowmo(0.3, 1.4);
        this.flashT = 0.5;
        if (!racing) continue;
        const pts = 50000;
        this.addScore(pts);
        if (this.timeLeft !== Infinity) { this.timeLeft += 8; this.hud.timeAdded(); }
        this.hud.takedown('DEFEATED', `+${bn(pts.toLocaleString('en-US'))}`, 2.4);
        const pos = this.player.track.point(this.player.s + 30, 0, 12, new THREE.Vector3());
        for (let i = 0; i < 4; i++) this.particles.firework(pos.x + (fx.next() - 0.5) * 30, pos.y, pos.z + (fx.next() - 0.5) * 30);
      } else if (e.type === 'bossGone') {
        this.hud.boss(false);
        // (it simply drops out of the fight)
      } else if (e.type === 'busDown') {
        if (racing) { this.addScore(15000); this.hud.takedown('BUS DOWN', '+15,000', 2); this.slowmo(0.4, 0.6); }
        const v = e.v;
        for (let i = 0; i < 6; i++) this.peds.add(v.track, v.s + (fx.next() - 0.5) * 8, v.x + (fx.next() - 0.5) * 3, 'street', { vx: fx.sign() * 1.6 });
      } else if (e.type === 'busHonk') {
        audio.otherHorn('busHorn', 20, fx.next() - 0.5);
      } else if (e.type === 'throw') {
        // thrown items make their own noise
      }
    }
    B.events.length = 0;
    if (B.active && racing) this.hud.bossHP(B.hpFrac());
  }

  // ------------------------------------------------------------ lighting
  hourNow() {
    const st = this.state;
    if (st === 'title' || st === 'menu' || st === 'garage' || st === 'radio' || st === 'settings' || st === 'scores' || st === 'howto') return this.settings.titleHour ?? 17.75;
    const P = this.player;
    const tr = P.track;
    if (tr.stage.circuit) return 17.55; // golden hour, the whole race
    const [h0, h1] = LEVEL_TIME[tr.level];
    const f = clamp(P.s / (tr.length + (tr.isFinal ? -700 : 0)), 0, 1);
    return lerp(h0, h1, f);
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
    const S = this.atmo.compute(hour, sunAz, this._tint, { rain: this.weather.rain, mist: this.mist || 0 }, this.outage || 0);
    this.S = S;
    this.night = smoothstep(18.2, 19.2, hour) * (1 - smoothstep(29.3, 30.0, hour));
    this.scene.fog.color.copy(S.fog);
    this.scene.fog.density = S.fogD;
    shared.uFogColor.value.copy(S.fog);
    shared.uFogDensity.value = S.fogD;
    this.hemi.color.copy(S.amb);
    this.hemi.groundColor.copy(S.fog).multiplyScalar(0.35);
    this.hemi.intensity = S.ambI * 1.25;
    this.sun.color.copy(S.sun);
    this.sun.intensity = S.sunI * S.sunVis * 1.3;
    const cp = this.R.camera.position;
    this.sun.position.set(cp.x + S.sunDir.x * 500, cp.y + Math.max(30, S.sunDir.y * 500), cp.z + S.sunDir.z * 500);
    this.sun.target.position.copy(cp);
    shared.uAmb.value.copy(S.amb).multiplyScalar(S.ambI * (0.62 + this.night * 0.55));
    // indoors (station, store, mall, cinema) is lit by tube lights, whatever the hour
    const rk = this.roofK || 0;
    if (rk > 0) shared.uAmb.value.lerp(this._inAmb || (this._inAmb = new THREE.Color(0.95, 0.93, 0.88)), rk * 0.8);
    shared.uSun.value.copy(S.sun).multiplyScalar(S.sunI * S.sunVis * clamp(S.sunDir.y + 0.35, 0, 1) * 0.55);
    shared.uLamps.value = S.lamps;
    shared.uGlow.value = S.glow;
    shared.uSignGlow.value = S.glow * 0.42 * (1 - (this.outage || 0) * 0.85) + 0.04;
    shared.uSpriteLight.value.copy(S.amb).multiplyScalar(S.ambI * 0.95).add(this._c1 = (this._c1 || new THREE.Color()).copy(S.sun).multiplyScalar(S.sunI * S.sunVis * 0.4));
    if (rk > 0) shared.uSpriteLight.value.lerp(this._inAmb, rk * 0.8);
    shared.uLampAdd.value.copy(shared.uLampCol.value).multiplyScalar(S.lamps * 0.75);
    shared.uSkyRefl.value.copy(S.hor).multiplyScalar(0.75).add(this._c2 = (this._c2 || new THREE.Color()).copy(S.city).multiplyScalar(0.6));
    shared.uZenith.value.copy(S.zen);
    shared.uHorizon.value.copy(S.hor);
    shared.uSunDir.value.copy(S.sunDir);
    shared.uSunColor.value.copy(S.sun).multiplyScalar(S.sunVis);
    shared.uMoonDir.value.copy(S.moonDir);
    shared.uFlash.value = this.weather.flash;
    shared.uRain.value = this.weather.rain;
    shared.uWet.value = damp(shared.uWet.value, Math.max(this.wetTarget || 0, this.weather.rain), 0.5, dt);
    const head = smoothstep(18.25, 18.9, hour) * (1 - smoothstep(29.4, 29.9, hour));
    shared.uHead.value = Math.max(head, (this.outage || 0) * 0.8);
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

  // saree on the spoiler, bags in Tuntuni's lap
  updateExtras() {
    const C = this.car;
    if (!C) return;
    if (!C.saree) attachSaree(C);
    if (!C.bags) attachBags(C);
    C.saree.visible = (this.sareeT || 0) > 0;
    C.bags.visible = !!this.bags;
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
    C.shadow.visible = !(P.crash && pose.lift > 0.3) && !(P.air && pose.lift > 2);
    for (const w of C.wheels) w.rotation.x = -P.wheelSpin;
    for (const f of C.front) f.rotation.y = -P.steer * 0.42;
    if (C.steeringWheel) C.steeringWheel.rotation.z = P.steer * 1.6;
    const head = shared.uHead.value;
    this.popT = damp(this.popT || 0, head > 0.4 ? 1 : 0, 5, dt);
    for (const p of C.popups) p.rotation.x = -this.popT * 1.25;
    C.headMat.color.setRGB(2.5 * (0.3 + head), 2.4 * (0.3 + head), 2.1 * (0.3 + head));
    const brake = P.braking ? 1 : 0;
    C.tailMat.color.setRGB(0.5 + this.night * 0.8 + brake * 1.8, 0.03, 0.02);
    C.spot.intensity = head * 45;
    if (C.driver) { C.driver.rotation.z = -P.lean * 2; C.driver.position.x = 0.4 + P.lean * 0.5; }
    if (C.passenger) {
      // she screams with both hands up through every jump
      C.passenger.rotation.z = -P.lean * 2.4 + Math.sin(this.time * 2) * 0.02 + (P.air ? Math.sin(this.time * 18) * 0.15 : 0);
    }
    if (C.armsUp) C.armsUp.visible = !!P.air;
    if (C.scarf) this.flutter(C.scarf, C.scarfBase, 0.9, 1);
    if (C.saree && C.saree.visible) {
      this.sareeT -= dt;
      this.flutter(C.saree, C.sareeBase, 2.6, 2.4);
      if (this.sareeT <= 0) {
        // it finally lets go
        const p = new THREE.Vector3(0, 1.1, C.dims.len * 0.5).applyMatrix4(g.matrixWorld);
        this.debris(p, 'cloth', null, 18);
        this.updateExtras();
      }
    }
    if (C.ledMat) C.ledMat.color.setHSL((this.time * 0.2) % 1, 1, 0.6).multiplyScalar(2.4);
    g.updateMatrixWorld();
  }

  flutter(mesh, base, len, amp) {
    const P = this.player;
    const pos = mesh.geometry.getAttribute('position');
    const sp = clamp(P.v / 60, 0, 1);
    for (let i = 0; i < pos.count; i++) {
      const z = base[i * 3 + 2];
      const along = Math.max(0, z) / len;
      pos.setY(i, base[i * 3 + 1] + Math.sin(this.time * 14 + along * 6) * 0.06 * amp * along * sp - (1 - sp) * along * 0.5);
      pos.setX(i, base[i * 3] + Math.sin(this.time * 9 + along * 4) * 0.05 * amp * along * sp);
      pos.setZ(i, z * (0.4 + sp * 0.6));
    }
    pos.needsUpdate = true;
  }

  updateFx(dt) {
    const P = this.player;
    const C = this.car;
    const g = C.group;
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(g.quaternion);
    const vel = new THREE.Vector3(0, 0, -1).applyQuaternion(g.quaternion).multiplyScalar(P.v);
    const rearL = new THREE.Vector3(-0.8, 0.1, C.dims.len * 0.32).applyMatrix4(g.matrixWorld);
    const rearR = new THREE.Vector3(0.8, 0.1, C.dims.len * 0.32).applyMatrix4(g.matrixWorld);
    if (P.slip > 0.3 && P.v > 10 && !P.crash && !P.air) {
      if (fx.next() < P.slip * 0.5) { this.particles.smoke(rearL, vel, P.slip * 0.6); this.particles.smoke(rearR, vel, P.slip * 0.6); }
    }
    if (P.offroad > 0.5 && P.v > 6 && !P.air) {
      if (fx.next() < 0.7) this.particles.dust(fx.next() < 0.5 ? rearL : rearR, vel);
    }
    const wet = shared.uWet.value;
    if ((wet > 0.85 || this.weather.rain > 0.25) && P.v > 12 && fx.next() < 0.35 && !P.air) {
      this.particles.spray(rearL, vel, wet);
      this.particles.spray(rearR, vel, wet);
    }
    if (P.scrape && P.v > 10) {
      const side = P.x < 0 ? -1 : 1;
      const sp = new THREE.Vector3(side * 1.0, 0.3, 0).applyMatrix4(g.matrixWorld);
      this.particles.sparks(sp, back);
    }
    if (this.backfire > 0) {
      this.backfire -= dt;
      for (const e of C.exhaust) this.particles.backfire(e.clone().applyMatrix4(g.matrixWorld), back);
      if (this.backfire <= 0) audio.backfire();
      this.backfire = 0;
    }
    // nitro: blue flame out of every pipe
    if (P.boosting) {
      for (const e of C.exhaust) this.particles.jet(e.clone().applyMatrix4(g.matrixWorld), back, 1.2);
    }
    if (C.def.id === 'rickshaw' && P.throttle > 0.2) {
      for (const e of C.exhaust) this.particles.jet(e.clone().applyMatrix4(g.matrixWorld), back, 0.4 + P.throttle);
    }
    // wrecks smoke and burn for a while
    for (const v of this.traffic.list) {
      if (!v.wreck || v.wreck.t > 9 || fx.next() > 0.35) continue;
      const p = v.track.point(v.s, v.x, 1 + v.lift, new THREE.Vector3());
      this.particles.smoke(p, new THREE.Vector3(), 0.8, [0.22, 0.2, 0.2]);
      if (v.enemy && fx.next() < 0.3) this.particles.add.add(p.x, p.y, p.z, (fx.next() - 0.5), 2 + fx.next() * 2, (fx.next() - 0.5), 3, 1.2, 0.2, 0.5, 0.4, { grav: -2, drag: 1 });
    }
    const st = P.track.stage;
    if ((st.id === 'dhanmondi' || st.id === 'shahbag') && fx.next() < 0.5) {
      const p = P.track.point(P.s + 10 + fx.next() * 40, (fx.next() - 0.5) * 30, 4 + fx.next() * 6, new THREE.Vector3());
      this.particles.petals(p.x, p.y, p.z, new THREE.Vector3(1.2, 0, 0.4));
    }
    for (const e of this.world.emitters) {
      if (fx.next() < 0.25) this.particles.kilnSmoke(e.pos[0], e.pos[1], e.pos[2]);
    }
    // no rain indoors
    const roof = P.track.sectionAt(Math.min(this.cam.camS > 0 ? this.cam.camS : P.s, P.track.length)).roof;
    this.roofK = damp(this.roofK || 0, roof ? 1 : 0, 8, dt);
    const thunder = this.weather.update(dt, this.R.camera, vel, this.rainTarget || 0, this.storm);
    this.weather.uniforms.uAmount.value *= 1 - this.roofK;
    this.weather.lines.visible = this.weather.uniforms.uAmount.value > 0.02;
    if (thunder != null) audio.thunder(thunder);
    this.pieces.update(dt, P, this.S ? this.S.glow : 0, { planes: this.planeMode, onPlane: () => { audio.plane(); } });
  }

  // ------------------------------------------------------------ audio
  updateAudio(dt) {
    const P = this.player;
    const tr = P.track;
    const st = tr.stage;
    const L = (t) => st.L === t || st.R === t;
    const A = this.bosses.active;
    const heli = A && A.kind === 'heli' ? clamp(1 - Math.abs(A.s - P.s) / 220, 0, 1) : 0;
    const quiet = this.state === 'paused' || this.state === 'photo';
    audio.update({
      rpm: P.rpm, throttle: P.throttle, speed: P.v, vmax: P.vmax, slip: P.slip, offroad: P.offroad, scrape: P.scrape,
      engineOn: !quiet, convertible: P.def.id === 'rosso' || P.def.id === 'miata',
      rain: this.weather.rain, city: L('river') ? 0.5 : 1 - this.night * 0.3, river: L('river') || st.farWater ? 1 : 0,
      siren: quiet ? 0 : this.siren || 0, rotor: quiet ? 0 : heli, boost: P.boosting && this.state === 'race',
      crowd: quiet ? 0 : clamp(0.25 + (st.peds ?? 0.5) * 0.6, 0, 1) * (tr.sectionAt(Math.min(P.s, tr.length)).closed ? 1.4 : 1),
      rival: quiet ? null : this.nearestRival(),
    });
    // cars flashing past you
    if (!quiet) {
      for (const v of this.traffic.list) {
        if (v.track !== tr || v.wreck) continue;
        const rel = v.s - P.s;
        const relV = P.v - (v.oncoming ? -v.v : v.v);
        if (v._pr > 0 && rel <= 0 && Math.abs(v.x - P.x) < 5.5 && Math.abs(relV) > 12) audio.passBy(Math.abs(relV), Math.sign(v.x - P.x) || 1, v.type === 'bus' || v.type === 'truck' || v.type === 'brtc');
        v._pr = rel;
      }
    }
    this.ambT = (this.ambT || 0) - dt;
    if (this.ambT <= 0) {
      const dens = (st.traffic?.density || 15) / 20;
      this.ambT = (0.4 + fx.next() * 2.4) / dens;
      const r = fx.next();
      const pan = fx.next() * 1.6 - 0.8;
      const d = 40 + fx.next() * 150;
      if (r < 0.45) audio.otherHorn('carHorn', d, pan);
      else if (r < 0.62) audio.otherHorn('busHorn', d, pan);
      else if (r < 0.75) audio.otherHorn('cngHorn', d, pan);
      else if ((st.traffic?.mix?.rickshaw || 0) > 2) audio.bell(pan, 0.05);
    }
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

  nearestRival() {
    if (this.circuit.active) return this.circuit.nearest();
    if (!this.racing) return null;
    const P = this.player;
    let best = null;
    for (const r of this.race.rivals) {
      const v = r.veh;
      if (!v || v.wreck || v.track !== P.track) continue;
      const d = Math.hypot(v.s - P.s, v.x - P.x);
      if (d < 45 && (!best || d < best.d)) best = { d, v: v.v, pan: (v.x - P.x) / 8 };
    }
    return best;
  }

  // ------------------------------------------------------------ HUD
  updateHUD(dt) {
    const P = this.player;
    const tr = P.track;
    if (this.circuit.active) {
      const C = this.circuit;
      this.hud.update(dt, {
        time: 99, running: this.state === 'race', score: C.coins, lap: C.lapT,
        speed: P.kmh, rpm: audio.rpmNorm ?? P.rpm, gear: 1, gearN: audio.vg ? audio.vg.gear : 0,
        progress: clamp((P.s - tr.gateS) / (tr.goalS - tr.gateS), 0, 1), stageIndex: 0,
        race: true, pos: C.position, need: C.position, field: CIRCUIT_FIELD, near: C.neighbours(),
      });
      this.hud.circuitPanel({ lap: Math.min(C.lap, tr.laps), laps: tr.laps, fuel: P.fuel, nitro: P.nitro, boosting: P.boosting });
      this.hud.tags(this.state === 'race' || this.state === 'countdown' ? C.tags(this.R.camera) : []);
      return;
    }
    const prog = tr.isFinal ? P.s / tr.goalS : P.s / tr.length;
    this.hud.update(dt, {
      time: this.timeLeft === Infinity ? 99 : this.timeLeft,
      running: this.state === 'race',
      score: this.score || 0,
      lap: this.lap || 0,
      speed: P.kmh,
      rpm: audio.rpmNorm ?? P.rpm,
      gear: P.gear,
      gearN: audio.vg ? audio.vg.gear : 0,
      progress: prog,
      stageIndex: this.stageIndex,
      race: this.racing,
      pos: this.race.position,
      need: this.race.target(tr.level),
      field: FIELD,
      near: this.racing ? this.race.neighbours() : null,
    });
    this.updateTags();
    this.hud.nitro(P.boost, P.boosting);
    // enemies closing in from behind
    this.rearT = (this.rearT || 0) - dt;
    if (this.rearT <= 0) {
      this.rearT = 0.1;
      const list = [];
      for (const v of this.traffic.list) {
        if (!v.enemy || v.wreck) continue;
        const d = this.traffic.relS(v, P);
        if (d < -3 && d > -140) list.push({ x: (v.x - P.x) / 8, near: 1 + d / 140, kind: v.enemy.role });
      }
      this.hud.rear(list.slice(0, 6));
    }
  }

  // name tags over the rival cars ahead of you
  updateTags() {
    const list = [];
    if (this.racing && (this.state === 'race' || this.state === 'countdown')) {
      const P = this.player;
      const cam = this.R.camera;
      const W = window.innerWidth, H = window.innerHeight;
      const order = this.race.rivals.map((r) => r.prog).sort((a, b) => b - a);
      const pp = this.race.progress();
      const v = this._tagV || (this._tagV = new THREE.Vector3());
      for (const r of this.race.rivals) {
        const veh = r.veh;
        if (!veh || veh.wreck || veh.track !== P.track) continue;
        const rel = veh.s - P.s;
        if (rel < 4 || rel > 170) continue;
        veh.track.point(veh.s, veh.x, (veh.md?.hgt || 1.4) + 0.5, v);
        v.project(cam);
        if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) continue;
        let pos = 1;
        for (const p of order) if (p > r.prog) pos++;
        if (pp > r.prog) pos++;
        list.push({ x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, name: r.name, pos, boss: r.i === 0, a: rel < 130 ? 1 : (170 - rel) / 40 });
        if (list.length >= 2) break;
      }
    }
    this.hud.tags(list);
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

  // ------------------------------------------------------------ radio
  setStation(i) {
    this.station = i;
    if (i < TRACKS.length) {
      music.play(i);
      const t = TRACKS[i];
      this.hud.radio(`${t.station} · ${t.title.toUpperCase()}`, t.freq, true);
    } else {
      music.stop();
      this.hud.radio('RADIO OFF · JUST DHAKA', '--.-', false);
    }
  }
}
