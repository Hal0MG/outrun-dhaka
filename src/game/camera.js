// Camera rig: chase / far / bumper / cinematic orbit, driven in road space so
// it follows hills and curves like the OutRun camera.

import * as THREE from 'three';
import { damp, fx } from '../core/util.js';
import { FORK_OFF } from '../world/world.js';

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.mode = 'chase';
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
    this.shake = 0;
    this.fov = 62;
    this.roll = 0;
    this.orbit = { a: 0, r: 9, h: 2.4 };
    this.init = false;
    this.camS = 0;
    this.camX = 0;
    this.camH = 2;
  }

  update(dt, player, opts = {}) {
    const tr = player.track;
    const cam = this.cam;
    const v = player.v;
    const vr = v / player.vmax;
    // fixed rig: close behind, high enough to see over traffic, looking well down the road
    let back = 7.4, height = 2.8, ahead = 20, lookH = 0.8, xf = 0.92;
    if (this.mode === 'far') { back = 11.5; height = 3.9; ahead = 22; lookH = 0.6; xf = 0.65; }
    if (this.mode === 'hood') { back = -0.4; height = 1.18; ahead = 30; lookH = 1.0; xf = 1; }
    if (this.mode === 'low') { back = 5.0; height = 1.05; ahead = 18; lookH = 0.8; xf = 0.9; }

    if (opts.cinematic) {
      // slow orbit around the car (title screen, endings)
      const o = this.orbit;
      o.a += dt * (opts.orbitSpeed ?? 0.12);
      const pose = player.pose(this._pose || (this._pose = { pos: new THREE.Vector3() }));
      const c = pose.pos;
      const yaw = pose.yaw + o.a;
      const r = opts.radius ?? o.r;
      this.pos.set(c.x + Math.sin(yaw) * r, c.y + (opts.height ?? o.h), c.z - Math.cos(yaw) * r);
      this.look.set(c.x, c.y + 0.9, c.z);
      cam.position.copy(this.pos);
      cam.up.set(0, 1, 0);
      cam.lookAt(this.look);
      cam.fov = damp(cam.fov, opts.fov ?? 50, 3, dt);
      cam.updateProjectionMatrix();
      this.camS = player.s; this.camX = player.x; this.camH = 2;
      this.init = false;
      return;
    }

    const s = player.s;
    const crash = player.crash;
    const sc = s - back;
    // camera lateral follows the car but lags (OutRun keeps it near the centre)
    const cx = this.mode === 'hood' ? player.x : player.x * xf;
    const target = this.tmp;
    if (sc < 0 && tr.parent) {
      tr.parent.point(tr.parent.length + sc, cx + (tr.side * FORK_OFF), height, target);
    } else {
      tr.point(sc, cx, height, target);
    }
    const lookT = this.tmp2;
    tr.point(s + ahead, player.x * (this.mode === 'hood' ? 1 : 0.92), lookH, lookT);
    if (crash) {
      // hold position, keep looking at the tumbling car
      const pose = player.pose(this._pose || (this._pose = { pos: new THREE.Vector3() }));
      lookT.copy(pose.pos);
      lookT.y += 0.6;
      target.y += 0.8;
    }
    if (!this.init) {
      this.pos.copy(target);
      this.look.copy(lookT);
      this.init = true;
    }
    // locked to the car along the road (no lag, so it never drifts in and out with speed);
    // only height is smoothed so crests and dips don't jolt
    this.pos.x = target.x;
    this.pos.z = target.z;
    this.pos.y = damp(this.pos.y, target.y, 12, dt);
    this.look.x = lookT.x;
    this.look.z = lookT.z;
    this.look.y = damp(this.look.y, lookT.y, 12, dt);
    // shake
    const sh = this.shake + player.offroad * 0.06 * Math.min(1, v / 15) + (player.scrape ? 0.05 : 0) + vr * vr * 0.004;
    this.shake = damp(this.shake, 0, 4, dt);
    cam.position.set(this.pos.x + (fx.next() - 0.5) * sh, this.pos.y + (fx.next() - 0.5) * sh, this.pos.z + (fx.next() - 0.5) * sh * 0.5);
    cam.up.set(0, 1, 0);
    cam.lookAt(this.look);
    // roll into curves a touch
    const rollT = -player.steer * 0.025 * vr - (player.drift * 0.03);
    this.roll = damp(this.roll, rollT, 4, dt);
    cam.rotateZ(this.roll);
    const portrait = cam.aspect < 1 ? (1 - cam.aspect) * 30 : 0;
    // constant field of view: speed reads from the world rushing past, not from a stretched lens
    const fovT = (this.mode === 'hood' ? 62 : 55) + portrait;
    cam.fov = damp(cam.fov, fovT, 6, dt);
    cam.updateProjectionMatrix();
    this.camS = sc;
    this.camX = cx;
    this.camH = height + 0.3;
  }

  kick(amount) {
    this.shake = Math.max(this.shake, amount);
  }
}
