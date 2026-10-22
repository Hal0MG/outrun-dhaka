// Pedestrians who cross wherever they like (often right under the footbridge), at any angle,
// and plenty who are just out strolling in the road.
// A racer that hits one sends them spinning through the air like a cardboard
// cut-out; they land, lie there seeing stars, then get up and shake a fist.
// It costs the racer nothing. Painted billboard sprites that rotate in the screen plane.

import * as THREE from 'three';
import { damp, RNG } from '../core/util.js';
import { shared } from '../world/materials.js';

const MAX = 200;
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
    this.rain = 0; // set each frame by the game
  }

  clear() { this.list.length = 0; this.usedSpots = new WeakSet(); }

  add(track, s, x, kind, opts = {}) {
    if (this.list.length >= MAX) return null;
    const names = KINDS[kind] || KINDS.street;
    let name = opts.name || this.rng.pick(names);
    // in the rain, most people have an umbrella up
    if (!opts.name && this.rain > 0.25 && this.rng.chance(Math.min(0.85, this.rain * 0.9))) {
      const u = 'pu_' + name.slice(2);
      if (this.atlas.info[u]) name = u;
    }
    const inf = this.atlas.info[name];
    if (!inf) return null;
    const p = {
      track, s, x, h: opts.h || 0, vx: opts.vx ?? 0, vs: 0, vh: 0, rot: 0, rotV: 0,
      name, inf, flip: this.rng.chance(0.5), state: opts.vx ? 'walk' : 'idle', t: 0, panic: this.rng.next(),
      w: inf.worldH * inf.aspect, hgt: inf.worldH * this.rng.range(0.95, 1.05), stars: 0,
    };
    this.list.push(p);
    return p;
  }

  // a little group crossing the road ahead of the player, wherever they like: not square across, but at an angle
  crossing(track, s, n = 3) {
    const hw = track.halfWAt(Math.min(s, track.length));
    const dir = this.rng.sign();
    for (let i = 0; i < n; i++) {
      const p = this.add(track, s + this.rng.range(-4, 4), -dir * (hw + this.rng.range(0.4, 3)), 'street', { vx: dir * this.rng.range(1.0, 1.8) });
      if (p) p.vs = this.rng.range(-0.7, 0.7);
    }
  }

  // people already out in the road, ambling about or crossing from the middle
  roam(track, s, n = 2) {
    const hw = track.halfWAt(Math.min(s, track.length));
    for (let i = 0; i < n; i++) {
      const dir = this.rng.sign();
      const p = this.add(track, s + this.rng.range(-8, 8), this.rng.range(-hw + 0.8, hw - 0.8), 'street', { vx: dir * this.rng.range(0.8, 1.6) });
      if (p) p.vs = this.rng.range(-0.9, 0.9);
    }
  }

  // movers: everything that can hit a pedestrian, [{G, x, v, hl, hw, player}]; rate: how busy the streets are (0..1)
  update(dt, player, active, rate, traffic, movers) {
    this.time += dt;
    const P = player;
    const tr = P.track;
    // street crossers ahead of you (more of them near footbridges, naturally)
    if (active && rate > 0.12) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = this.rng.range(0.35, 1.0) / Math.max(rate, 0.5);
        const s = P.s + this.rng.range(120, 300);
        if (s < tr.length - 300 && tr.elevAt(s) < 1) {
          let sp = s;
          for (const fb of tr.stage.footbridges || []) { const fs = tr.mapS(fb); if (Math.abs(fs - s) < 120 && this.rng.chance(0.6)) sp = fs + this.rng.range(-3, 3); }
          // half cross from the kerb, half are already strolling in the road
          if (this.rng.chance(0.5)) this.crossing(tr, sp, this.rng.int(1, 4));
          else this.roam(tr, sp, this.rng.int(1, 3));
        }
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      const ds = p.s - P.s;
      if (p.track !== tr && p.track !== tr.parent) { this.list.splice(i, 1); continue; }
      if (p.track === tr && (ds < -60 || ds > 700)) { this.list.splice(i, 1); continue; }
      const hw = p.track.halfWAt(Math.min(p.s, p.track.length));
      const pG = p.track.base + p.s;
      if (p.state === 'walk' || p.state === 'idle' || p.state === 'run') {
        // see the car coming: freeze or bolt
        if (p.track === tr && ds > 0 && ds < 32 + P.v * 0.4 && Math.abs(p.x - P.x) < 6 && P.v > 12 && p.state !== 'run') {
          if (p.panic < 0.45) { p.state = 'run'; p.vx = (p.x > P.x ? 1 : -1) * this.rng.range(3, 4.5); }
          else if (p.panic < 0.8) { p.state = 'freeze'; p.vx = 0; p.t = 0; }
        }
        // wait for traffic instead of walking through it
        let wait = false;
        if (p.state === 'walk') {
          for (const v of traffic) {
            if (v.wreck) continue;
            const d = p.track.base + p.s - v.G;
            if (Math.abs(d) < v.l + 0.4 && Math.abs(v.x - p.x) < v.w + 0.35) { p.x += Math.sign(p.x - v.x || 1) * 3 * dt; wait = true; break; }
            if (-d > -v.l && -d < 10 + v.v * 0.9 && Math.abs(v.x - (p.x + p.vx * 0.8)) < v.w + 0.8) { wait = true; break; }
          }
        }
        if (!wait) { p.x += p.vx * dt; if (p.state === 'walk') p.s += p.vs * dt; }
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
          else { p.state = 'down'; p.t = 0; p.vs = 0; p.vx = 0; p.vh = 0; }
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
      // the bonk, from you or from a rival
      if (p.state !== 'fly' && p.state !== 'down') {
        for (const m of movers) {
          if (Math.abs(pG - m.G) < m.hl + 0.3 && Math.abs(p.x - m.x) < m.hw + 0.25) {
            p.state = 'fly';
            p.t = 0;
            p.vs = m.v * this.rng.range(0.45, 0.7) + 3;
            p.vx = (p.x - m.x >= 0 ? 1 : -1) * this.rng.range(2, 5);
            p.vh = 6 + Math.min(m.v, 80) * 0.09 + this.rng.next() * 3;
            p.rotV = this.rng.sign() * this.rng.range(7, 13);
            this.events.push({ type: 'ped', p, by: m.player ? 'player' : 'rival' });
            break;
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
