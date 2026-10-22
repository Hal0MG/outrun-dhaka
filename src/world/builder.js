// MeshBuilder: accumulates triangles into flat arrays so a whole road chunk
// (buildings, lamps, curbs...) becomes a handful of draw calls.
// Every vertex carries an atlas region (vec4: u0, v0, du, dv) and a tile uv;
// the atlas material wraps the tile uv inside the region in the shader.

import * as THREE from 'three';

const FULL = [0, 0, 1, 1];

export class MeshBuilder {
  constructor(withRegion = true) {
    this.withRegion = withRegion;
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
    this.reg = [];
    this.idx = [];
    this.v = 0;
  }

  get empty() { return this.idx.length === 0; }

  vert(x, y, z, nx, ny, nz, u, v, c, r) {
    this.pos.push(x, y, z);
    this.nor.push(nx, ny, nz);
    this.uv.push(u, v);
    this.col.push(c[0], c[1], c[2]);
    if (this.withRegion) this.reg.push(r[0], r[1], r[2], r[3]);
    return this.v++;
  }

  // quad from 4 points (counter-clockwise when seen from the front: a=bl, b=br, c=tr, d=tl)
  quad(a, b, c, d, uv = [0, 0, 1, 1], color = [1, 1, 1], region = FULL, normal = null) {
    let nx, ny, nz;
    if (normal) { [nx, ny, nz] = normal; } else {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
    }
    const [u0, v0, u1, v1] = uv;
    const i0 = this.vert(a[0], a[1], a[2], nx, ny, nz, u0, v0, color, region);
    const i1 = this.vert(b[0], b[1], b[2], nx, ny, nz, u1, v0, color, region);
    const i2 = this.vert(c[0], c[1], c[2], nx, ny, nz, u1, v1, color, region);
    const i3 = this.vert(d[0], d[1], d[2], nx, ny, nz, u0, v1, color, region);
    this.idx.push(i0, i1, i2, i0, i2, i3);
  }

  tri(a, b, c, color = [1, 1, 1], region = FULL, uvs = [[0, 0], [1, 0], [0.5, 1]]) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const i0 = this.vert(a[0], a[1], a[2], nx, ny, nz, uvs[0][0], uvs[0][1], color, region);
    const i1 = this.vert(b[0], b[1], b[2], nx, ny, nz, uvs[1][0], uvs[1][1], color, region);
    const i2 = this.vert(c[0], c[1], c[2], nx, ny, nz, uvs[2][0], uvs[2][1], color, region);
    this.idx.push(i0, i1, i2);
  }

  /**
   * Oriented box. (cx, cy, cz) is the centre of the BOTTOM face. yaw rotates around Y.
   * Local axes: +x = width (w), +y up (h), +z = depth (d). "Front" face is -z local... we
   * call it front = +z side by convention (faces local +z).
   * opts: color, region per face {front, back, left, right, top, bottom} or region,
   *       tile: [metersPerU, metersPerV] for wrapping textures, uvOff:[u,v]
   */
  box(cx, cy, cz, w, h, d, yaw = 0, opts = {}) {
    const color = opts.color || [1, 1, 1];
    const R = opts.regions || {};
    const reg = opts.region || FULL;
    const tile = opts.tile || null;
    const off = opts.uvOff || [0, 0];
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const hw = w / 2, hd = d / 2;
    // local -> world (rotation around y: x' = x cos - z sin ... we use right=(cos,sin) mapping)
    const P = (lx, ly, lz) => [cx + lx * cs - lz * sn, cy + ly, cz + lx * sn + lz * cs];
    const p000 = P(-hw, 0, -hd), p100 = P(hw, 0, -hd), p110 = P(hw, h, -hd), p010 = P(-hw, h, -hd);
    const p001 = P(-hw, 0, hd), p101 = P(hw, 0, hd), p111 = P(hw, h, hd), p011 = P(-hw, h, hd);
    const uvFor = (lenU, lenV) => {
      if (!tile) return [0, 0, 1, 1];
      return [off[0], off[1], off[0] + lenU / tile[0], off[1] + lenV / tile[1]];
    };
    const skip = opts.skip || {};
    const cTop = opts.topColor || color;
    // front (+z)
    if (!skip.front) this.quad(p001, p101, p111, p011, uvFor(w, h), color, R.front || reg);
    // back (-z)
    if (!skip.back) this.quad(p100, p000, p010, p110, uvFor(w, h), color, R.back || reg);
    // right (+x)
    if (!skip.right) this.quad(p101, p100, p110, p111, uvFor(d, h), color, R.right || R.side || reg);
    // left (-x)
    if (!skip.left) this.quad(p000, p001, p011, p010, uvFor(d, h), color, R.left || R.side || reg);
    // top
    if (!skip.top) this.quad(p011, p111, p110, p010, opts.topTile ? [0, 0, w / opts.topTile, d / opts.topTile] : [0, 0, 1, 1], cTop, R.top || reg);
    if (opts.bottom) this.quad(p000, p100, p101, p001, [0, 0, 1, 1], color, R.bottom || reg);
  }

  // vertical cylinder / cone. (cx,cy,cz) = bottom centre
  cylinder(cx, cy, cz, rBot, rTop, h, seg = 8, color = [1, 1, 1], region = FULL, opts = {}) {
    const tileV = opts.tileV || 0;
    const uRep = opts.uRep || 1;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const b0 = [cx + Math.cos(a0) * rBot, cy, cz + Math.sin(a0) * rBot];
      const b1 = [cx + Math.cos(a1) * rBot, cy, cz + Math.sin(a1) * rBot];
      const t1 = [cx + Math.cos(a1) * rTop, cy + h, cz + Math.sin(a1) * rTop];
      const t0 = [cx + Math.cos(a0) * rTop, cy + h, cz + Math.sin(a0) * rTop];
      const vmax = tileV ? h / tileV : 1;
      // outward normals (approx, flat per quad but smooth-ish)
      const am = (a0 + a1) / 2;
      this.quad(b1, b0, t0, t1, [(i + 1) / seg * uRep, 0, i / seg * uRep, vmax], color, region, opts.flat ? null : [Math.cos(am), (rBot - rTop) / h, Math.sin(am)]);
    }
    if (opts.cap && rTop > 0) {
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
        this.tri(
          [cx, cy + h, cz],
          [cx + Math.cos(a1) * rTop, cy + h, cz + Math.sin(a1) * rTop],
          [cx + Math.cos(a0) * rTop, cy + h, cz + Math.sin(a0) * rTop],
          opts.capColor || color, region,
        );
      }
    }
  }

  // general cylinder between two points (for poles, arms, trunks)
  tube(a, b, r0, r1, seg = 6, color = [1, 1, 1], region = FULL) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    const ax = dx / len, ay = dy / len, az = dz / len;
    // pick perpendicular
    let px = -az, py = 0, pz = ax;
    if (Math.abs(ay) < 0.99) { px = -az; py = 0; pz = ax; } else { px = 1; py = 0; pz = 0; }
    let pl = Math.hypot(px, py, pz) || 1;
    px /= pl; py /= pl; pz /= pl;
    // q = axis x p
    const qx = ay * pz - az * py, qy = az * px - ax * pz, qz = ax * py - ay * px;
    for (let i = 0; i < seg; i++) {
      const t0 = (i / seg) * Math.PI * 2, t1 = ((i + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
      const n0 = [px * c0 + qx * s0, py * c0 + qy * s0, pz * c0 + qz * s0];
      const n1 = [px * c1 + qx * s1, py * c1 + qy * s1, pz * c1 + qz * s1];
      const A0 = [a[0] + n0[0] * r0, a[1] + n0[1] * r0, a[2] + n0[2] * r0];
      const A1 = [a[0] + n1[0] * r0, a[1] + n1[1] * r0, a[2] + n1[2] * r0];
      const B1 = [b[0] + n1[0] * r1, b[1] + n1[1] * r1, b[2] + n1[2] * r1];
      const B0 = [b[0] + n0[0] * r1, b[1] + n0[1] * r1, b[2] + n0[2] * r1];
      const nm = [(n0[0] + n1[0]) / 2, (n0[1] + n1[1]) / 2, (n0[2] + n1[2]) / 2];
      this.quad(A0, A1, B1, B0, [i / seg, 0, (i + 1) / seg, len], color, region, nm);
    }
  }

  // flat quad facing a yaw direction (a vertical "sign" plane). centre bottom at c.
  panel(cx, cy, cz, w, h, yaw, color = [1, 1, 1], region = FULL, uv = [0, 0, 1, 1], doubleSided = false) {
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    // local +x along (cs, sn), facing normal local +z = (-sn, cs)
    const hw = w / 2;
    const a = [cx - cs * hw, cy, cz - sn * hw];
    const b = [cx + cs * hw, cy, cz + sn * hw];
    const c = [b[0], cy + h, b[2]];
    const d = [a[0], cy + h, a[2]];
    this.quad(a, b, c, d, uv, color, region);
    if (doubleSided) this.quad(b, a, d, c, [uv[2], uv[1], uv[0], uv[3]], color, region);
  }

  // Sphere-ish dome (upper hemisphere) at base centre
  dome(cx, cy, cz, r, hScale = 1, seg = 10, rings = 5, color = [1, 1, 1], region = FULL) {
    for (let j = 0; j < rings; j++) {
      const p0 = (j / rings) * Math.PI / 2, p1 = ((j + 1) / rings) * Math.PI / 2;
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
        const P = (a, p) => [cx + Math.cos(a) * Math.cos(p) * r, cy + Math.sin(p) * r * hScale, cz + Math.sin(a) * Math.cos(p) * r];
        const N = (a, p) => [Math.cos(a) * Math.cos(p), Math.sin(p), Math.sin(a) * Math.cos(p)];
        const a = P(a1, p0), b = P(a0, p0), c = P(a0, p1), d = P(a1, p1);
        const n = N((a0 + a1) / 2, (p0 + p1) / 2);
        this.quad(a, b, c, d, [i / seg, j / rings, (i + 1) / seg, (j + 1) / rings], color, region, n);
      }
    }
  }

  // wheel with its axle along X. tread uses tireReg, both faces use rimReg (circular uv)
  wheel(cx, cy, cz, r, w, seg = 12, tireColor = [1, 1, 1], tireReg = FULL, rimReg = FULL, rimColor = [1, 1, 1]) {
    const hx = w / 2;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const y0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r, y1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
      const am = (a0 + a1) / 2;
      this.quad([cx - hx, cy + y0, cz + z0], [cx - hx, cy + y1, cz + z1], [cx + hx, cy + y1, cz + z1], [cx + hx, cy + y0, cz + z0], [0, 0, 1, 1], tireColor, tireReg, [0, Math.cos(am), Math.sin(am)]);
      for (const sx of [-1, 1]) {
        const x = cx + sx * hx;
        const c = [x, cy, cz];
        const p0 = [x, cy + y0, cz + z0], p1 = [x, cy + y1, cz + z1];
        const uv0 = [0.5 + Math.sin(a0) * 0.5, 0.5 + Math.cos(a0) * 0.5], uv1 = [0.5 + Math.sin(a1) * 0.5, 0.5 + Math.cos(a1) * 0.5];
        if (sx > 0) this.tri(c, p0, p1, rimColor, rimReg, [[0.5, 0.5], uv0, uv1]);
        else this.tri(c, p1, p0, rimColor, rimReg, [[0.5, 0.5], uv1, uv0]);
      }
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (this.withRegion) g.setAttribute('aRegion', new THREE.Float32BufferAttribute(this.reg, 4));
    if (this.v > 65535) g.setIndex(new THREE.Uint32BufferAttribute(this.idx, 1));
    else g.setIndex(new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// Line builder for wires
export class LineBuilder {
  constructor() { this.pos = []; this.col = []; }
  seg(a, b, c = [0.05, 0.05, 0.06]) {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    this.col.push(c[0], c[1], c[2], c[0], c[1], c[2]);
  }
  // catenary between two points
  sag(a, b, sag = 0.8, n = 8, c) {
    let prev = a;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t];
      this.seg(prev, p, c);
      prev = p;
    }
  }
  get empty() { return this.pos.length === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}
