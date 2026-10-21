// A Track is a sampled road centreline built from authored "sections"
// (length, curvature, elevation). Everything in the game lives in road space
// (s = distance along, x = lateral offset), and the track converts that into
// world space. Positive curvature turns right. Forward at yaw=0 is -Z.

import * as THREE from 'three';
import { easeIO, smoothstep } from '../core/util.js';

export const STEP = 2;
export const LANE_W = 4.2;
// ordinary road bends are authored gently; play them tighter (set pieces keep their exact shape)
export const CURVE_MUL = 2.6;

export class Track {
  /**
   * @param {object} def
   *  sections: [{len, k, dy, elev, lanes, ...flags}]
   *  start: {x, z, yaw, gy, elev, lanes}
   */
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.stage = def.stage;
    this.sections = def.sections;
    let total = 0;
    for (const sec of this.sections) {
      sec.s0 = total;
      total += sec.len;
      sec.s1 = total;
    }
    const n = Math.ceil(total / STEP) + 1;
    this.n = n;
    this.length = (n - 1) * STEP;
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.pz = new Float32Array(n);
    this.yaw = new Float32Array(n);
    this.k = new Float32Array(n);
    this.gy = new Float32Array(n);
    this.elev = new Float32Array(n);
    this.lanesF = new Float32Array(n);
    this.halfW = new Float32Array(n);
    this.sec = new Uint16Array(n);

    const st = def.start;
    let x = st.x, z = st.z, yaw = st.yaw;
    let gy = st.gy || 0;
    let elev = st.elev || 0;
    let lanes = st.lanes || 3;
    let si = 0;
    let secGy0 = gy, secElev0 = elev, secLanes0 = lanes;
    for (let i = 0; i < n; i++) {
      const s = i * STEP;
      while (si < this.sections.length - 1 && s >= this.sections[si].s1) {
        // close section
        const sec = this.sections[si];
        secGy0 = secGy0 + (sec.dy || 0);
        secElev0 = sec.elev != null ? sec.elev : secElev0;
        secLanes0 = sec.lanes != null ? sec.lanes : secLanes0;
        si++;
      }
      const sec = this.sections[si];
      const t = Math.min(1, (s - sec.s0) / sec.len);
      let env = 1;
      if (!sec.hardK) env = smoothstep(0, 0.22, t) * (1 - smoothstep(0.78, 1, t));
      const tight = sec.hardK || sec.closed || sec.env || sec.surface ? 1 : (sec.kMul ?? CURVE_MUL);
      const k = (sec.k || 0) * env * tight;
      gy = secGy0 + (sec.dy || 0) * easeIO(t);
      const targetElev = sec.elev != null ? sec.elev : secElev0;
      elev = secElev0 + (targetElev - secElev0) * easeIO(t);
      const targetLanes = sec.lanes != null ? sec.lanes : secLanes0;
      lanes = secLanes0 + (targetLanes - secLanes0) * easeIO(sec.laneEase ? Math.min(1, t / sec.laneEase) : t);

      this.px[i] = x;
      this.pz[i] = z;
      this.gy[i] = gy;
      this.elev[i] = elev;
      this.py[i] = gy + elev;
      this.yaw[i] = yaw;
      this.k[i] = k;
      this.lanesF[i] = lanes;
      this.halfW[i] = (lanes * LANE_W) / 2;
      this.sec[i] = si;

      // integrate with midpoint yaw
      const ym = yaw + k * STEP * 0.5;
      x += Math.sin(ym) * STEP;
      z -= Math.cos(ym) * STEP;
      yaw += k * STEP;
    }
    this.endYaw = this.yaw[n - 1];
    this.children = null;
    this.parent = def.parent || null;
    this.side = def.side || 0;
    this._tmp = new THREE.Vector3();
  }

  idx(s) {
    let f = s / STEP;
    if (f < 0) f = 0;
    if (f > this.n - 1.0001) f = this.n - 1.0001;
    const i = Math.floor(f);
    return [i, f - i];
  }

  sectionAt(s) {
    const [i] = this.idx(s);
    return this.sections[this.sec[i]];
  }

  sample(arr, s) {
    const [i, t] = this.idx(s);
    return arr[i] + (arr[i + 1] - arr[i]) * t;
  }

  halfWAt(s) { return this.sample(this.halfW, s); }
  lanesAt(s) { return Math.round(this.sample(this.lanesF, s)); }
  kAt(s) { return this.sample(this.k, s); }
  yawAt(s) {
    if (s > this.length) return this.endYaw;
    return this.sample(this.yaw, s);
  }
  groundAt(s) { return this.sample(this.gy, s); }
  elevAt(s) { return this.sample(this.elev, s); }

  // Writes world position for road-space (s, x, h) into out. h is height above road surface.
  // ground=true puts the point on terrain (for off-road props on elevated stretches).
  point(s, x, h, out, ground = false) {
    let ext = 0;
    if (s > this.length) { ext = s - this.length; s = this.length; }
    if (s < 0) { ext = s; s = 0; }
    const [i, t] = this.idx(s);
    const yaw = this.yaw[i] + (this.yaw[i + 1] - this.yaw[i]) * t;
    const cx = this.px[i] + (this.px[i + 1] - this.px[i]) * t;
    const cz = this.pz[i] + (this.pz[i + 1] - this.pz[i]) * t;
    const cy = ground
      ? this.gy[i] + (this.gy[i + 1] - this.gy[i]) * t
      : this.py[i] + (this.py[i + 1] - this.py[i]) * t;
    const sy = Math.sin(yaw), cyw = Math.cos(yaw);
    out.x = cx + cyw * x + sy * ext;
    out.z = cz + sy * x - cyw * ext;
    out.y = cy + h;
    return out;
  }

  // full frame: pos, fwd (with pitch), right, up
  frame(s, out) {
    const p = this.point(s, 0, 0, out.pos);
    const yaw = this.yawAt(s);
    const ds = 1.0;
    const y0 = this.sample(this.py, Math.max(0, Math.min(this.length, s - ds)));
    const y1 = this.sample(this.py, Math.max(0, Math.min(this.length, s + ds)));
    const pitch = Math.atan2(y1 - y0, ds * 2);
    const cp = Math.cos(pitch);
    out.fwd.set(Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
    out.right.set(Math.cos(yaw), 0, Math.sin(yaw));
    out.up.crossVectors(out.right, out.fwd).normalize();
    out.yaw = yaw;
    out.pitch = pitch;
    out.k = s > this.length ? 0 : this.kAt(s);
    out.halfW = this.halfWAt(s);
    return p;
  }
}

export function makeFrame() {
  return {
    pos: new THREE.Vector3(),
    fwd: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    k: 0,
    halfW: 5,
  };
}

// lateral world offset between two tracks at a point (used for fork re-basing)
export function lateralOffset(trackA, sA, trackB, sB) {
  const pa = trackA.point(sA, 0, 0, new THREE.Vector3());
  const pb = trackB.point(sB, 0, 0, new THREE.Vector3());
  const yaw = trackA.yawAt(sA);
  const rx = Math.cos(yaw), rz = Math.sin(yaw);
  return (pb.x - pa.x) * rx + (pb.z - pa.z) * rz;
}
