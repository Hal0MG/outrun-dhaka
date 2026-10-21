// Circuit driving model, after Horizon Chase Turbo: hold gas, steer, fire
// nitro. No gearbox, no crashes, no jumps. Corners push you to the outside in
// proportion to speed squared, so the skill is the line you hold through them.
// Contact and grass cost speed; nothing ever stops the race.

import * as THREE from 'three';
import { clamp, damp } from '../core/util.js';
import { Player } from './player.js';

const G = 9.81;
// outward push per unit of curvature × v²; steering grip (m/s sideways) has to beat it
export const CORNER_K = 0.1;
export const NITRO_MAX = 3;
const NITRO_DUR = 2.6;
const GRASS_V = 34;

export class HCTPlayer extends Player {
  reset(track) {
    super.reset(track);
    this.gear = 1;
    this.nitro = 1;
    this.nitroT = 0;
    this.fuel = 1;
    this.boost = 0;
  }

  // grip in m/s of sideways speed the car can make at the wheel
  get steerGrip() { return 15 * this.def.grip; }

  fireNitro() {
    if (this.boosting || this.nitro < 1) return false;
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
    if (this.fuel <= 0) throttle = 0;
    if (this.boosting) {
      this.nitroT -= dt;
      throttle = 1;
      if (this.nitroT <= 0) this.boosting = false;
    }
    this.boost = this.boosting ? this.nitroT / NITRO_DUR : 0;
    this.throttle = throttle;
    this.steer = steer;
    this.braking = brake > 0.1;
    this.bounce = damp(this.bounce, 0, 6, dt);
    this.rampLift = 0;

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
    const off = this.x - hw < lim.lSoft || this.x + hw > lim.rSoft;
    this.offroad = damp(this.offroad, off ? 1 : 0, 10, dt);
    if (off && this.v > GRASS_V) a -= 10 + (this.v - GRASS_V) * 0.6;
    // sliding wide costs a little
    a -= this.drift * 2;
    this.v = clamp(this.v + a * dt, 0, vmax * 1.05);

    // ---- across the road
    const k = fr.k;
    const sp = clamp(this.v / 14, 0, 1);
    const vxT = steer * this.steerGrip * sp;
    // shoves from contact decay through the damping
    this.vx = damp(this.vx, vxT, 10, dt);
    const cf = -k * this.v * this.v * CORNER_K;
    this.x += (this.vx + cf) * dt;
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
      this.v *= 1 - 0.8 * dt;
    }
    if (this.x + hw > lim.rWall) {
      this.x = lim.rWall - hw;
      if (this.vx > 0) this.vx = -this.vx * 0.3;
      this.scrape = 1;
      this.v *= 1 - 0.8 * dt;
    }

    // ---- engine note and looks
    this.rpm = damp(this.rpm, clamp(0.3 + 0.7 * (this.v / this.vmax) * (0.85 + 0.15 * throttle), 0, 1.1), 8, dt);
    const vr = this.v / this.vmax;
    const yawT = this.vx * 0.012 + this.drift * 0.22 * Math.sign(k || steer || 1);
    this.yawRel = damp(this.yawRel, yawT, 6, dt);
    this.lean = damp(this.lean, -steer * 0.03 * Math.min(vr, 1) + k * this.v * this.v * 0.0003, 6, dt);
    if (off) this.bounce += Math.sin(this.time * 32) * 0.035 * Math.min(1, this.v / 10);

    this.s += this.v * dt;
    this.distance += this.v * dt;
    this.wheelSpin += (this.v / 0.36) * dt;
    this.surface = off ? 'offroad' : 'road';
  }

  // contact never wrecks you here
  startCrash() {}
  startSpin() {}
  startJump() {}
}
