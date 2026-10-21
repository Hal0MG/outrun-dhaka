// Pedestrians who cross wherever they like (often right under the footbridge).
// Hit one and they go spinning through the air like a cardboard cut-out,
// land, lie there seeing stars, then get up and shake a fist at you.
// Rendered as painted billboard sprites that can rotate in the screen plane.

import * as THREE from 'three';
import { clamp, damp, fx, RNG } from '../core/util.js';
import { shared } from '../world/materials.js';

const MAX = 90;
const KINDS = {
  street: ['p_lungi', 'p_shirt', 'p_saree', 'p_kameez', 'p_panjabi', 'p_vendor', 'p_lungi', 'p_shirt'],
  commuter: ['p_shirt', 'p_kameez', 'p_saree', 'p_panjabi', 'p_shirt'],
  shopper: ['p_saree', 'p_kameez', 'p_saree', 'p_shirt', 'p_panjabi'],
  park: ['p_kameez', 'p_saree', 'p_shirt', 'p_panjabi', 'p_lungi'],
  student: ['p_shirt', 'p_kameez', 'p_panjabi', 'p_shirt'],
};

function makeMaterial(atlas) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: atlas.map },
      uCamRight: shared.uCamRight,
      uLight: shared.uSpriteLight,
      uLampAdd: shared.uLampAdd,
      uFogColor: shared.uFogColor,
      uFogDensity: shared.uFogDensity,
    },
    vertexShader: /* glsl */ `
      attribute vec4 iPos;
      attribute vec3 iSize;
      attribute vec4 iRegion;
      varying vec2 vUv;
      varying float vFog;
      varying float vH;
      uniform vec3 uCamRight;
      void main() {
        vec3 right = uCamRight * (iSize.x < 0.0 ? -1.0 : 1.0);
        // rotate around the sprite's centre in the billboard plane
        vec2 l = vec2(position.x * abs(iSize.x), (position.y - 0.5) * iSize.y);
        float c = cos(iSize.z), s = sin(iSize.z);
        vec2 r = vec2(c * l.x - s * l.y, s * l.x + c * l.y);
        vec3 wp = iPos.xyz + vec3(0.0, iSize.y * 0.5, 0.0) + right * r.x + vec3(0.0, r.y, 0.0);
        vUv = iRegion.xy + uv * iRegion.zw;
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        vFog = -mv.z;
        vH = position.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uLight;
      uniform vec3 uLampAdd;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      varying vec2 vUv;
      varying float vFog;
      varying float vH;
      void main() {
        vec4 c = texture2D(uMap, vUv);
        if (c.a < 0.5) discard;
        vec3 col = c.rgb * (uLight * mix(0.75, 1.05, vH) + uLampAdd * 0.8);
        float f = 1.0 - exp(-uFogDensity * uFogDensity * vFog * vFog);
        gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
      }`,
    side: THREE.DoubleSide,
  });
}

export class Peds {
  constructor(scene, world) {
    this.world = world;
    const atlas = world.assets.sprites;
    this.atlas = atlas;
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    base.dispose();
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aReg = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos);
    g.setAttribute('iSize', this.aSize);
    g.setAttribute('iRegion', this.aReg);
    g.instanceCount = 0;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, makeMaterial(atlas));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);
    this.list = [];
    this.rng = new RNG(4242);
    this.events = [];
    this.spawnT = 0;
    this.time = 0;
    this._p = new THREE.Vector3();
    this.usedSpots = new WeakSet();
  }

  clear() { this.list.length = 0; this.usedSpots = new WeakSet(); }

  add(track, s, x, kind, opts = {}) {
    if (this.list.length >= MAX) return null;
    const names = KINDS[kind] || KINDS.street;
    const name = opts.name || this.rng.pick(names);
    const inf = this.atlas.info[name];
    if (!inf) return null;
    const p = {
      track, s, x, h: opts.h || 0, vx: opts.vx ?? 0, vs: 0, vh: 0, rot: 0, rotV: 0,
      name, inf, flip: this.rng.chance(0.5), state: opts.vx ? 'walk' : 'idle', t: 0, panic: this.rng.next(),
      w: inf.worldH * inf.aspect, hgt: inf.worldH * this.rng.range(0.95, 1.05), stars: 0, cow: name.startsWith('cow'),
    };
    this.list.push(p);
    return p;
  }

  // a little group crossing the road ahead of the player
  crossing(track, s, n = 3) {
    const hw = track.halfWAt(Math.min(s, track.length));
    const dir = this.rng.sign();
    for (let i = 0; i < n; i++) {
      const kind = track.stage.pedKind || 'street';
      const cow = track.stage.cows && this.rng.chance(0.25);
      this.add(track, s + this.rng.range(-2.5, 2.5), -dir * (hw + this.rng.range(0.4, 3)), kind, { vx: dir * this.rng.range(1.1, 1.7), name: cow ? this.rng.pick(['cow0', 'cow1']) : null });
    }
  }

  update(dt, player, world, active) {
    this.time += dt;
    const P = player;
    const tr = P.track;
    // spawn street crossers ahead (more of them near footbridges, naturally)
    if (active) {
      this.spawnT -= dt;
      const rate = tr.stage.peds ?? 0.5;
      if (this.spawnT <= 0 && rate > 0) {
        this.spawnT = this.rng.range(1.2, 3.2) / rate;
        const s = P.s + this.rng.range(140, 260);
        const sec = tr.sectionAt(Math.min(s, tr.length));
        if (s < tr.length - 300 && !sec.env && !sec.fork && !sec.diverge && (sec.surface || 'asphalt') === 'asphalt' && (sec.elev ?? 0) < 1 && tr.elevAt(s) < 1) {
          let sp = s;
          for (const fb of tr.stage.footbridges || []) { const fs = fb + tr.contentOffset; if (Math.abs(fs - s) < 120 && this.rng.chance(0.6)) sp = fs + this.rng.range(-3, 3); }
          this.crossing(tr, sp, this.rng.int(1, 4));
        }
      }
      // people standing about inside set pieces
      for (const ch of world.chunks.values()) {
        if (ch.track !== tr || !ch.peds) continue;
        for (const spot of ch.peds) {
          if (this.usedSpots.has(spot)) continue;
          if (spot.s < P.s + 60 || spot.s > P.s + 260) continue;
          this.usedSpots.add(spot);
          this.add(tr, spot.s, spot.x, spot.kind, { vx: spot.cross, h: spot.h });
        }
      }
    }
    const pw = P.halfW, pl = P.halfL * 0.9;
    const lift = P.air ? P.air.h0 * (1 - P.airU()) + P.air.h * 4 * P.airU() * (1 - P.airU()) : (P.rampLift || 0);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      const ds = p.s - P.s;
      if (p.track !== tr && p.track !== tr.parent) { this.list.splice(i, 1); continue; }
      if (p.track === tr && (ds < -60 || ds > 700)) { this.list.splice(i, 1); continue; }
      const hw = p.track.halfWAt(Math.min(p.s, p.track.length));
      if (p.state === 'walk' || p.state === 'idle' || p.state === 'run') {
        // see the car coming: freeze or bolt
        if (p.track === tr && ds > 0 && ds < 32 + P.v * 0.4 && Math.abs(p.x - P.x) < 6 && P.v > 12 && p.state !== 'run' && !p.cow) {
          if (p.panic < 0.45) { p.state = 'run'; p.vx = (p.x > P.x ? 1 : -1) * this.rng.range(3, 4.5); }
          else if (p.panic < 0.8) { p.state = 'freeze'; p.vx = 0; p.t = 0; }
        }
        p.x += p.vx * dt;
        if (p.state !== 'idle' && Math.abs(p.x) > hw + 4) { this.list.splice(i, 1); continue; }
      } else if (p.state === 'freeze') {
        p.rot = Math.sin(p.t * 30) * 0.08;
        if (p.t > 1.2) { p.state = 'run'; p.rot = 0; p.vx = this.rng.sign() * 3.5; }
      } else if (p.state === 'fly') {
        p.s += p.vs * dt;
        p.x += p.vx * dt;
        p.h += p.vh * dt;
        p.vh -= 18 * dt;
        p.rot += p.rotV * dt;
        if (p.h <= 0 && p.vh < 0) {
          p.h = 0;
          if (Math.abs(p.vh) > 4) { p.vh = -p.vh * 0.35; p.vs *= 0.5; p.vx *= 0.5; p.rotV *= 0.5; }
          else { p.state = 'down'; p.t = 0; p.vs = 0; p.vx = 0; p.vh = 0; this.events.push({ type: 'pedDown', p }); }
        }
      } else if (p.state === 'down') {
        p.rot = damp(p.rot, Math.round(p.rot / Math.PI) * Math.PI + Math.PI / 2 * Math.sign(p.rotV || 1), 8, dt);
        p.stars = 1;
        if (p.t > 1.3) { p.state = 'up'; p.t = 0; }
      } else if (p.state === 'up') {
        p.rot = damp(p.rot, Math.round(p.rot / (Math.PI * 2)) * Math.PI * 2, 6, dt);
        if (p.t > 0.6) {
          // shake a fist, then walk off in a huff
          p.rot = Math.sin(p.t * 22) * 0.12 * Math.max(0, 1.6 - p.t);
          if (p.t > 1.6) { p.state = 'walk'; p.rot = 0; p.stars = 0; p.vx = (p.x > 0 ? 1 : -1) * 1.4; }
        }
      }
      // the bonk
      if (p.track === tr && p.state !== 'fly' && p.state !== 'down' && !P.crash) {
        if (Math.abs(ds) < pl + 0.3 && Math.abs(p.x - P.x) < pw + 0.25 && lift < 1.4) {
          if (p.cow) {
            // the cow does not move. you do.
            this.events.push({ type: 'cow', p });
            p.t = 0;
          } else {
            p.state = 'fly';
            p.t = 0;
            p.vs = P.v * this.rng.range(0.45, 0.7) + 3;
            p.vx = (p.x - P.x >= 0 ? 1 : -1) * this.rng.range(2, 5);
            p.vh = 6 + Math.min(P.v, 80) * 0.09 + this.rng.next() * 3;
            p.rotV = this.rng.sign() * this.rng.range(7, 13);
            this.events.push({ type: 'ped', p, speed: P.v });
          }
        }
      }
    }
    this.render();
  }

  render() {
    const pos = this.aPos.array, size = this.aSize.array, reg = this.aReg.array;
    let n = 0;
    const v = this._p;
    const stars = this.atlas.info.stars;
    for (const p of this.list) {
      if (n >= MAX - 1) break;
      p.track.point(p.s, p.x, p.h + (p.state === 'down' ? -p.hgt * 0.5 + 0.18 : 0), v);
      const bob = p.state === 'walk' || p.state === 'run' ? Math.abs(Math.sin(this.time * (p.state === 'run' ? 16 : 9) + p.s)) * 0.06 : 0;
      pos[n * 4] = v.x; pos[n * 4 + 1] = v.y + bob; pos[n * 4 + 2] = v.z; pos[n * 4 + 3] = 1;
      size[n * 3] = p.w * (p.flip ? -1 : 1) * (p.vx < 0 ? -1 : 1); size[n * 3 + 1] = p.hgt; size[n * 3 + 2] = p.rot;
      reg.set(p.inf.region, n * 4);
      n++;
      if (p.stars && stars) {
        p.track.point(p.s, p.x, p.state === 'down' ? 0.6 : p.hgt + 0.1, v);
        pos[n * 4] = v.x; pos[n * 4 + 1] = v.y; pos[n * 4 + 2] = v.z; pos[n * 4 + 3] = 1;
        size[n * 3] = stars.worldH * stars.aspect; size[n * 3 + 1] = stars.worldH; size[n * 3 + 2] = this.time * 3;
        reg.set(stars.region, n * 4);
        n++;
      }
    }
    this.geo.instanceCount = n;
    this.aPos.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aReg.needsUpdate = true;
  }
}
