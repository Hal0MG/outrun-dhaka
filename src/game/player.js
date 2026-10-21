// Player driving model. Arcade OutRun physics in road space:
// LO/HI gearbox, centrifugal push on curves, drift, off-road drag, crashes,
// nitro, and guided jumps (ramps throw you along an arc to a landing point).

import * as THREE from 'three';
import { clamp, damp, lerp, fx, easeIO } from '../core/util.js';

const G = 9.81;
// the world is played faster than the speedometer admits: the dash shows v / SPEED_K
export const SPEED_K = 1.35;

export class Player {
  constructor(def) {
    this.def = def;
    this.vmax = (def.top / 3.6) * SPEED_K;
    this.reset(null);
    this._obs = [];
  }

  reset(track) {
    this.track = track;
    this.s = 0;
    this.x = 0;
    this.v = 0;
    this.vx = 0;
    this.gear = 0;
    this.rpm = 0;
    this.yawRel = 0;
    this.drift = 0;
    this.offroad = 0;
    this.scrape = 0;
    this.crash = null;
    this.spin = null;
    this.air = null;
    this.lean = 0;
    this.bounce = 0;
    this.distance = 0;
    this.steer = 0;
    this.braking = false;
    this.lastShift = 0;
    this.events = [];
    this.throttle = 0;
    this.surface = 'road';
    this.wheelSpin = 0;
    this.slip = 0;
    this.puddle = 0;
    this.time = 0;
    this.boost = 0.35;
    this.boosting = false;
    this.boostT = 0;
    this.airTime = 0;
  }

  get kmh() { return (this.v * 3.6) / SPEED_K; }
  get halfW() { return this.def.width / 2; }
  get halfL() { return this.def.length / 2; }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  shiftUp() {
    if (this.gear === 0) { this.gear = 1; this.lastShift = this.time; this.emit('shift', { up: true }); }
  }
  shiftDown() {
    if (this.gear === 1) { this.gear = 0; this.lastShift = this.time; this.emit('shift', { up: false }); }
  }

  // ramps call this: fly from here to s + len along an arc of apex h
  startJump(j) {
    if (this.air || this.crash) return;
    const minV = j.minV ?? 26;
    if (this.v < minV) this.v = minV;
    this.spin = null;
    this.air = {
      s0: this.s, s1: this.s + j.len, h: j.h ?? 5, h0: j.h0 ?? this.rampLift ?? 0, x0: this.x, x1: j.x1 ?? null,
      roll: j.roll || 0, slow: j.slow || 0, kind: j.kind || 'ramp', t: 0, id: j.id || null,
    };
    this.emit('jump', { ...this.air });
  }

  airU() {
    const a = this.air;
    return a ? clamp((this.s - a.s0) / (a.s1 - a.s0), 0, 1) : 0;
  }

  update(dt, input, world, opts = {}) {
    this.time += dt;
    const tr = this.track;
    const def = this.def;
    const auto = opts.auto !== false;
    const sec = tr.sectionAt(Math.min(this.s, tr.length));
    const boostOn = this.boosting;
    const vmax = this.vmax * (boostOn ? 1.28 : 1);
    const vLo = this.vmax * 0.6;
    let throttle = input.throttle, brake = input.brake, steer = input.steer;
    if (opts.autopilot) {
      throttle = opts.autopilot.throttle;
      brake = opts.autopilot.brake || 0;
      steer = opts.autopilot.steer;
    }
    if (this.crash) {
      throttle = 0; brake = 0; steer = 0;
    }
    // nitro
    const wantBoost = (opts.autopilot ? opts.autopilot.boost : input.boostHeld) && !this.crash && this.boost > 0.02;
    this.boosting = !!wantBoost && (this.boosting || this.boost > 0.12);
    if (this.boosting) {
      this.boost = Math.max(0, this.boost - dt * 0.3);
      this.boostT += dt;
      if (this.boost <= 0) this.boosting = false;
    } else this.boostT = 0;
    this.throttle = this.boosting ? 1 : throttle;
    this.steer = steer;
    this.braking = brake > 0.1;

    // ---- airborne: the arc owns you
    if (this.air) {
      const a = this.air;
      a.t += dt;
      this.v = Math.max(this.v - dt * 0.6, 8);
      this.s += this.v * dt;
      this.distance += this.v * dt;
      const u = this.airU();
      if (a.x1 != null) this.x = lerp(a.x0, a.x1, easeIO(u));
      else this.x += steer * 2.2 * dt;
      this.wheelSpin += (this.v / 0.36) * dt * 0.6;
      this.rpm = damp(this.rpm, this.throttle > 0.2 ? 1.05 : 0.6, 6, dt);
      this.yawRel = damp(this.yawRel, 0, 3, dt);
      this.lean = damp(this.lean, 0, 3, dt);
      this.airTime += dt;
      this.offroad = 0; this.scrape = 0; this.drift = 0; this.slip = 0;
      if (u >= 1) {
        this.air = null;
        this.bounce = 0.35;
        this.emit('land', { h: a.h, kind: a.kind, id: a.id, airTime: this.airTime });
        this.airTime = 0;
      }
      return;
    }
    this.bounce = damp(this.bounce, 0, 6, dt);
    this.rampLift = 0;

    // gearbox
    if (auto) {
      if (this.gear === 0 && this.v > vLo * 0.93) this.shiftUp();
      else if (this.gear === 1 && this.v < vLo * 0.55) this.shiftDown();
    }
    // engine force (m/s^2)
    let a = 0;
    const acc = def.accel;
    const thr = this.throttle;
    if (this.gear === 0) {
      const t = this.v / vLo;
      a += thr * 20 * acc * SPEED_K * clamp(1 - t * t, -0.3, 1);
      if (this.v > vLo && !boostOn) a -= 3.5 * SPEED_K; // limiter / engine braking
    } else {
      const t = this.v / vmax;
      // HI gear lugs below ~30% (punish staying in HI from standstill)
      const curve = t < 0.3 ? 0.55 + t * 1.5 : 1 - Math.pow((t - 0.3) / 0.75, 2) * 0.85;
      a += thr * 14 * acc * SPEED_K * clamp(curve, -0.2, 1);
    }
    if (boostOn) a += (11 * (1 - clamp(this.v / vmax, 0, 1)) + 3) * SPEED_K;
    // rpm 0..1 for audio/HUD
    const rpmT = this.gear === 0 ? this.v / vLo : 0.35 + 0.65 * (this.v / this.vmax);
    this.rpm = damp(this.rpm, clamp(rpmT * (0.85 + 0.15 * thr), 0, 1.12), 8, dt);
    // brakes & drag
    a -= brake * 24 * SPEED_K;
    a -= 0.25 + this.v * 0.01 + this.v * this.v * 0.00016;
    if (thr < 0.05) a -= 1.2;
    // section speed caps (spiral ramps, stairs, interiors)
    if (sec.vcap && this.v > sec.vcap) a -= (this.v - sec.vcap) * 2.5;

    // limits & surfaces
    const lim = world.limits(tr, Math.min(this.s, tr.length), this.x);
    const hw = this.halfW;
    const offL = this.x - hw < lim.lSoft;
    const offR = this.x + hw > lim.rSoft;
    const off = offL || offR;
    const offMax = 22;
    this.offroad = damp(this.offroad, off ? 1 : 0, 10, dt);
    if (off && this.v > offMax) a -= 12 + (this.v - offMax) * 0.4;
    // hills
    const fr = this._fr || (this._fr = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3() });
    tr.frame(Math.min(this.s, tr.length + 50), fr);
    a -= G * Math.sin(fr.pitch) * 0.55;
    // puddles slow you down
    if (this.puddle > 0.3 && this.v > 15) a -= 4 * this.puddle;
    // drift costs a little speed
    a -= this.drift * 1.6;

    this.v = clamp(this.v + a * dt, 0, vmax * 1.03);

    // steering
    const k = fr.k;
    const vr = this.v / this.vmax;
    const steerRate = 17 * clamp(this.v / 12, 0, 1) * (1 - 0.32 * Math.min(vr, 1)) * def.grip;
    let vxT = steer * steerRate * (1 + this.drift * 0.25);
    if (this.spin) vxT *= 0.2;
    // external shoves (rams) decay through vx damping
    this.vx = damp(this.vx, vxT, this.spin ? 3 : 9, dt);
    // centrifugal push to the outside of the curve
    const wet = opts.wet || 0;
    const cf = -k * this.v * this.v * 0.14 * (1 + wet * 0.25) * (1.15 - def.grip * 0.25) * (sec.cf ?? 1);
    this.x += (this.vx + cf) * dt;

    // drift: steering hard into a curve at speed
    const into = steer * Math.sign(k || 1) > 0.55 && Math.abs(k) > 0.0016 && vr > 0.55 && !this.crash;
    this.drift = damp(this.drift, into ? Math.min(1, Math.abs(steer)) : 0, into ? 3 : 5, dt);
    this.slip = Math.max(this.drift, this.braking && this.v > 25 ? 0.6 : 0, this.spin ? 1 : 0);

    // walls (curbs on medians, parapets, lake railings, buildings)
    this.scrape = 0;
    if (this.x - hw < lim.lWall) {
      this.x = lim.lWall + hw;
      if (this.vx < 0) this.vx = -this.vx * 0.3;
      this.scrape = 1;
      this.v *= 1 - 0.6 * dt;
      if (this.v > 12) this.emit('scrape', { side: -1 });
    }
    if (this.x + hw > lim.rWall) {
      this.x = lim.rWall - hw;
      if (this.vx > 0) this.vx = -this.vx * 0.3;
      this.scrape = 1;
      this.v *= 1 - 0.6 * dt;
      if (this.v > 12) this.emit('scrape', { side: 1 });
    }

    // roadside objects (and ramps)
    if (!this.crash) {
      const obs = world.obstaclesNear(tr, this.s, this._obs);
      for (const o of obs) {
        if (o.dead) continue;
        if (Math.abs(o.s - this.s) < o.hl + this.halfL * 0.8 && Math.abs(o.x - this.x) < o.hw + hw * 0.85) {
          if (o.kind === 'ramp') {
            // climb the ramp, launch off the top edge
            const t = clamp((this.s - (o.s - o.hl)) / (2 * o.hl), 0, 1);
            this.rampLift = (o.rh || 0) * t;
            if (this.v > 4 && this.s + this.v * 0.02 >= o.s + o.hl * 0.92) { this.startJump({ ...o.jump, h0: this.rampLift }); return; }
          } else if (o.kind === 'break') {
            if (!o.hitT) { o.hitT = this.time; this.emit('smash', { o }); this.v *= 1 - (o.mass ?? 0.04) * (this.boosting ? 0.3 : 1); }
          } else if (o.kind === 'soft') {
            if (!o.hitT || this.time - o.hitT > 1) {
              o.hitT = this.time;
              this.v *= 0.82;
              this.emit('bump', { soft: true });
            }
          } else if (this.v > 13) {
            this.startCrash('flip');
            break;
          } else {
            // low speed: just stop against it
            this.v = 0;
            this.x += Math.sign(this.x - o.x) * 0.2;
            this.emit('bump', {});
          }
        }
      }
    }

    // crash / spin animation
    if (this.crash) {
      const c = this.crash;
      c.t += dt;
      this.v = Math.max(0, this.v - 16 * dt);
      this.x = lerp(this.x, c.x0 + Math.sign(c.x0 || 1) * 2, dt * 0.8);
      if (c.t > c.dur) {
        this.crash = null;
        this.x = clamp(this.x, -lim.hw * 0.6, lim.hw * 0.6);
        if (Math.abs(this.x) > lim.hw * 0.5) this.x = 0;
        this.v = this.vmax * 0.35;
        this.gear = 1;
        this.yawRel = 0;
        this.emit('recovered');
      }
    }
    if (this.spin) {
      this.spin.t += dt;
      if (this.spin.t > this.spin.dur) this.spin = null;
    }

    // visual yaw
    // nose points where you are steering; in a drift it tucks into the bend (tail out)
    let yawT = this.vx * 0.014 + this.drift * 0.3 * Math.sign(k || steer || 1);
    if (this.spin) yawT = (this.spin.t / this.spin.dur) * Math.PI * 2 * this.spin.dir;
    this.yawRel = this.spin ? yawT : damp(this.yawRel, yawT, 6, dt);
    this.lean = damp(this.lean, -steer * 0.035 * Math.min(vr, 1) + k * this.v * this.v * 0.0004 * (sec.cf ?? 1), 6, dt);
    // surface rattle: stairs, rails, rough ground
    const surf = sec.surface;
    const rough = off ? 0.035 : surf === 'stairs' ? 0.07 : surf === 'rail' ? 0.025 : 0;
    this.bounce += rough ? Math.sin(this.time * (surf === 'stairs' ? 44 : 32)) * rough * Math.min(1, this.v / 10) : 0;

    // advance
    this.s += this.v * dt;
    this.distance += this.v * dt;
    this.wheelSpin += (this.v / 0.36) * dt;
    this.surface = off ? 'offroad' : 'road';
  }

  startCrash(kind = 'flip') {
    if (this.crash || this.air) return;
    this.crash = { kind, t: 0, dur: kind === 'flip' ? 1.7 : 1.2, x0: this.x, v0: this.v };
    this.spin = null;
    this.boosting = false;
    this.emit('crash', { kind, speed: this.v });
  }

  startSpin(dir = 1) {
    if (this.crash || this.spin || this.air) return;
    this.spin = { t: 0, dur: 0.8, dir };
    this.v *= 0.75;
    this.boosting = false;
    this.emit('spin', {});
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
    out.lift = this.bounce + (this.rampLift || 0);
    if (this.rampLift > 0.05) out.pitch = fr.pitch + 0.16;
    if (this.air) {
      const a = this.air;
      const u = this.airU();
      const L = a.s1 - a.s0;
      out.lift = a.h0 * (1 - u) + a.h * 4 * u * (1 - u);
      // nose follows the arc
      out.pitch = fr.pitch + Math.atan((a.h * 4 * (1 - 2 * u) - a.h0) / L) * 0.9;
      if (a.roll) out.roll = Math.PI * 2 * a.roll * easeIO(clamp((u - 0.12) / 0.76, 0, 1)) * Math.sign(a.x1 != null ? a.x1 - a.x0 || 1 : 1);
    }
    if (this.crash && this.crash.kind === 'flip') {
      const c = this.crash;
      const t = Math.min(1, c.t / 1.9);
      const e = 1 - Math.pow(1 - t, 2);
      out.roll = e * Math.PI * 4 * (c.x0 > 0 ? -1 : 1);
      out.lift = Math.sin(Math.min(1, c.t / 1.9) * Math.PI) * 2.6;
      out.yaw += e * 0.9;
      if (c.t > 1.9) { out.roll = 0; out.lift = 0; }
    }
    return out;
  }
}
