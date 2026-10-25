// Driving model, after Horizon Chase Turbo: hold gas, steer, fire nitro. No
// gearbox, no crashes, no jumps. Corners push you to the outside in proportion
// to speed squared, so the skill is the line you hold through them. Contact and
// grass cost speed; nothing ever stops the race.
// Everything lives in road space: s along the track, x across it.

import * as THREE from 'three';
import { clamp, damp } from '../core/util.js';
import { contraAt } from '../world/contra.js';

const G = 9.81;
// the world is played faster than the speedometer admits: the dash shows v / SPEED_K
export const SPEED_K = 1.35;
// outward push per unit of curvature × v²; steering grip (m/s sideways) has to beat it
export const CORNER_K = 0.1;
export const NITRO_MAX = 3;
const NITRO_DUR = 2.6;
// off the tarmac the car is held to GRASS_V and loses grip; the wall scrape is a real brake
const GRASS_V = 26;

export class Player {
  constructor(def) {
    this.def = def;
    this.vmax = (def.top / 3.6) * SPEED_K;
    this.reset(null);
  }

  reset(track) {
    this.track = track;
    this.s = 0;
    this.x = 0;
    this.v = 0;
    this.vx = 0;
    this.rpm = 0;
    this.yawRel = 0;
    this.drift = 0;
    this.slip = 0;
    this.offroad = 0;
    this.scrape = 0;
    this.lean = 0;
    this.bounce = 0;
    this.distance = 0;
    this.steer = 0;
    this.throttle = 0;
    this.braking = false;
    this.wheelSpin = 0;
    this.time = 0;
    this.events = [];
    this.nitro = 1;
    this.nitroT = 0;
    this.boosting = false;
    this.wrongWay = false;
    this.inWorks = false;
    // nothing in this game wrecks or launches the car; the camera still asks
    this.crash = null;
    this.air = null;
  }

  get kmh() { return (this.v * 3.6) / SPEED_K; }
  get halfW() { return this.def.width / 2; }
  get halfL() { return this.def.length / 2; }
  // grip in m/s of sideways speed the car can make at the wheel
  get steerGrip() { return 15 * this.def.grip; }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  fireNitro() {
    if (this.boosting) return false;
    if (this.nitro < 1) { this.emit('nitroEmpty'); return false; }
    this.nitro -= 1;
    this.boosting = true;
    this.nitroT = NITRO_DUR;
    this.emit('nitro');
    return true;
  }

  update(dt, input, world, opts = {}) {
    this.time += dt;
    const tr = this.track;
    const def = this.def;
    const sNow = Math.min(this.s, tr.length);
    let throttle = input.throttle, brake = input.brake, steer = input.steer;
    if (opts.autopilot) {
      throttle = opts.autopilot.throttle;
      brake = opts.autopilot.brake || 0;
      steer = opts.autopilot.steer;
    } else {
      // one tap, one charge (keys, pad and touch all land in boostHeld)
      if (input.boostHeld && !this._boostWas) this.fireNitro();
      this._boostWas = input.boostHeld;
    }
    if (this.boosting) {
      this.nitroT -= dt;
      throttle = 1;
      if (this.nitroT <= 0) this.boosting = false;
    }
    this.throttle = throttle;
    this.steer = steer;
    this.braking = brake > 0.1;
    this.bounce = damp(this.bounce, 0, 6, dt);

    // ---- along the road
    const vmax = this.vmax * (this.boosting ? 1.22 : 1);
    const t = this.v / vmax;
    let a = throttle * def.accel * (26 * (1 - t) + 5) * (t < 1 ? 1 : 0);
    if (this.boosting) a += 16 * (1 - clamp(this.v / vmax, 0, 1)) + 4;
    if (this.v > vmax) a -= (this.v - vmax) * 1.5;
    a -= brake * 32;
    if (throttle < 0.05) a -= 3 + this.v * 0.02;
    // hills
    const fr = this._fr || (this._fr = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3() });
    tr.frame(Math.min(this.s, tr.length + 50), fr);
    a -= G * Math.sin(fr.pitch) * 0.4;
    // grass
    const lim = world.limits(tr, sNow, this.x);
    const hw = this.halfW;
    // the verge is rough; so is a coned-off carriageway (road works), and the median kerb is a bump to cross quickly
    const works = contraAt(tr, sNow);
    const inWorks = !!works && this.x - hw < (lim.strip ? lim.strip[0] : lim.hw);
    const onStrip = !!lim.strip && this.x + hw > lim.strip[0] && this.x - hw < lim.strip[1];
    const onGrass = this.x - hw < lim.lSoft || this.x + hw > lim.rSoft;
    const off = onGrass || inWorks;
    this.offroad = damp(this.offroad, off ? 1 : 0, 10, dt);
    if (off && this.v > GRASS_V) a -= (18 + (this.v - GRASS_V) * 1.4) * (inWorks && !onGrass ? 0.6 : 1);
    // the kerb is a bump, except where the road works send you across it: there it is a ramp
    if (onStrip && this.v > 20) a -= (6 + (this.v - 20) * 0.3) * (contraAt(tr, sNow, 150) ? 0.15 : 1);
    this.inWorks = inWorks;
    // wrong way: fully on the opposite carriageway
    this.wrongWay = !!lim.near && this.x - hw > lim.near - 0.2;
    // sliding wide costs a little
    a -= this.drift * 2;
    this.v = clamp(this.v + a * dt, 0, vmax * 1.05);

    // ---- across the road
    const k = fr.k;
    // the verge is loose: less grip while a wheel is off the road
    const vxT = steer * this.steerGrip * clamp(this.v / 14, 0, 1) * (1 - 0.35 * this.offroad);
    // shoves from contact decay through the damping
    this.vx = damp(this.vx, vxT, 10, dt);
    this.x += (this.vx - k * this.v * this.v * CORNER_K) * dt;
    // drift look: hard into a bend at speed
    const into = steer * Math.sign(k || 1) > 0.6 && Math.abs(k) > 0.004 && this.v > this.vmax * 0.6;
    this.drift = damp(this.drift, into ? Math.min(1, Math.abs(steer)) : 0, into ? 4 : 6, dt);
    this.slip = Math.max(this.drift * 0.8, this.braking && this.v > 25 ? 0.5 : 0);

    // walls: slide along them, lose a bit
    this.scrape = 0;
    if (this.x - hw < lim.lWall) {
      this.x = lim.lWall + hw;
      if (this.vx < 0) this.vx = -this.vx * 0.3;
      this.scrape = 1;
      this.v *= 1 - 1.8 * dt;
    }
    if (this.x + hw > lim.rWall) {
      this.x = lim.rWall - hw;
      if (this.vx > 0) this.vx = -this.vx * 0.3;
      this.scrape = 1;
      this.v *= 1 - 1.8 * dt;
    }

    // ---- engine note and looks
    this.rpm = damp(this.rpm, clamp(0.3 + 0.7 * (this.v / this.vmax) * (0.85 + 0.15 * throttle), 0, 1.1), 8, dt);
    const vr = this.v / this.vmax;
    this.yawRel = damp(this.yawRel, this.vx * 0.012 + this.drift * 0.22 * Math.sign(k || steer || 1), 6, dt);
    this.lean = damp(this.lean, -steer * 0.03 * Math.min(vr, 1) + k * this.v * this.v * 0.0003, 6, dt);
    if (off) this.bounce += Math.sin(this.time * 32) * 0.035 * Math.min(1, this.v / 10);

    this.s += this.v * dt;
    this.distance += this.v * dt;
    this.wheelSpin += (this.v / 0.36) * dt;
  }

  // world transform for the car (pos, yaw, roll, pitch, lift)
  pose(out) {
    const tr = this.track;
    const fr = this._fr2 || (this._fr2 = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3() });
    tr.frame(this.s, fr);
    tr.point(this.s, this.x, 0, out.pos);
    out.yaw = fr.yaw + this.yawRel;
    out.pitch = fr.pitch;
    out.roll = this.lean;
    out.lift = this.bounce;
    return out;
  }
}
