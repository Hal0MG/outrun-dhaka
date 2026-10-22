// Time-of-day: the whole run goes from golden hour in Dhanmondi, through the
// night, to sunrise at whichever edge of Dhaka you escape to. Hours are on a
// continuous axis (17.0 ... 30.8) so midnight never wraps.

import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../core/util.js';

const C = (h) => new THREE.Color(h);

// keyframes. fields not present are inherited from the previous key.
const RAW = [
  { h: 16.0, zen: '#3e7cc8', hor: '#f4dcae', gnd: '#5a5a48', sun: '#fff1cf', sunTop: '#fff6c8', sunBot: '#ffd36a', sunI: 2.3, amb: '#a8bcd8', ambI: 1.05, fog: '#ead5b0', fogD: 0.00105, lamps: 0, glow: 0.04, stars: 0, cloud: '#fff4e2', city: '#000000', sunSize: 0.05 },
  { h: 17.3, zen: '#4a72bf', hor: '#ffc27e', sun: '#ffcf8f', sunTop: '#ffe98a', sunBot: '#ff9c3a', sunI: 1.95, amb: '#b0a8c6', ambI: 0.95, fog: '#f0bc8c', fogD: 0.00115, lamps: 0, glow: 0.08, cloud: '#ffd7ad' },
  { h: 17.85, zen: '#4b52a6', hor: '#ff9b5f', sun: '#ff9550', sunTop: '#ffe14a', sunBot: '#ff4f6a', sunI: 1.45, amb: '#a68cba', ambI: 0.8, fog: '#ec9a72', lamps: 0.25, glow: 0.25, cloud: '#ffa48a', sunSize: 0.075 },
  { h: 18.25, zen: '#33337f', hor: '#ff7466', sun: '#ff6a52', sunTop: '#ffd23a', sunBot: '#ff2e6a', sunI: 0.95, amb: '#8c78b4', ambI: 0.72, fog: '#cf6e78', lamps: 0.75, glow: 0.55, cloud: '#ff7fa0', city: '#1a0a08' },
  { h: 18.8, zen: '#201d5a', hor: '#c5527f', sun: '#ff4070', sunTop: '#ffb03a', sunBot: '#ff1f7a', sunI: 0.35, amb: '#6a68a8', ambI: 0.68, fog: '#82406f', lamps: 1, glow: 0.85, stars: 0.15, cloud: '#c24a7a', city: '#2a1208' },
  { h: 19.6, zen: '#12133c', hor: '#5e2e6c', sunI: 0.0, amb: '#5566b0', ambI: 0.78, fog: '#3d2652', fogD: 0.0013, glow: 1, stars: 0.45, cloud: '#4a2a5a', city: '#4a2410' },
  { h: 21.0, zen: '#0a0b27', hor: '#3c2649', amb: '#4e60ae', ambI: 0.74, fog: '#2c1e3c', stars: 0.65, cloud: '#2e2040', city: '#5a2a10' },
  { h: 24.0, zen: '#06070f', hor: '#2c1e2e', amb: '#485aa6', ambI: 0.72, fog: '#211a28', stars: 0.85, cloud: '#221a2a', city: '#663010' },
  { h: 27.2, zen: '#06070f', hor: '#271b2c', amb: '#485aa6', fog: '#1f1828', stars: 0.9, city: '#5a2a10' },
  { h: 28.4, zen: '#0c1534', hor: '#3a3a6c', amb: '#4e60ae', ambI: 0.74, fog: '#2f355a', stars: 0.55, glow: 0.9, cloud: '#3a3a64', city: '#3a1a10' },
  { h: 29.0, zen: '#1f3172', hor: '#b2708b', sun: '#ff4a3a', sunTop: '#ff3a2a', sunBot: '#d41a1a', sunI: 0.25, amb: '#5c5c92', ambI: 0.5, fog: '#8c6a8c', fogD: 0.00125, lamps: 0.9, glow: 0.7, stars: 0.15, cloud: '#c07a8a', city: '#1a0a08', sunSize: 0.08 },
  { h: 29.55, zen: '#3b5ca3', hor: '#ff9b7c', sun: '#ff4a32', sunTop: '#ff4a2a', sunBot: '#e01818', sunI: 0.9, amb: '#8c86b2', ambI: 0.7, fog: '#e6a28c', lamps: 0.45, glow: 0.4, stars: 0, cloud: '#ffb0a0', city: '#000000' },
  { h: 30.05, zen: '#5b88ca', hor: '#ffca9c', sun: '#ff8c4c', sunTop: '#ffcf6a', sunBot: '#ff5a32', sunI: 1.5, amb: '#aab2ce', ambI: 0.88, fog: '#f0c2a2', lamps: 0.08, glow: 0.15, cloud: '#ffe0c8', sunSize: 0.065 },
  { h: 30.8, zen: '#6fa2de', hor: '#ffe2bc', sun: '#ffdaa2', sunTop: '#fff2c0', sunBot: '#ffc86a', sunI: 2.0, amb: '#bac6de', ambI: 1.0, fog: '#f0dec2', lamps: 0, glow: 0.04, cloud: '#fff6ea', sunSize: 0.05 },
];

const FIELDS = ['zen', 'hor', 'gnd', 'sun', 'sunTop', 'sunBot', 'amb', 'fog', 'cloud', 'city'];
const NUMS = ['sunI', 'ambI', 'fogD', 'lamps', 'glow', 'stars', 'sunSize'];
const KEYS = [];
{
  let prev = {};
  for (const k of RAW) {
    const full = { ...prev, ...k };
    const out = { h: k.h };
    for (const f of FIELDS) out[f] = C(full[f]);
    for (const f of NUMS) out[f] = full[f];
    KEYS.push(out);
    prev = full;
  }
}

// sun elevation (radians) for an hour on the continuous axis
export function sunElevation(h) {
  if (h < 24) return (18.15 - h) * 13 * (Math.PI / 180);
  return (h - 29.6) * 13 * (Math.PI / 180);
}

export class Atmosphere {
  constructor() {
    this.state = {
      zen: C('#000'), hor: C('#000'), gnd: C('#000'), sun: C('#000'), sunTop: C('#000'), sunBot: C('#000'),
      amb: C('#000'), fog: C('#000'), cloud: C('#000'), city: C('#000'),
      sunI: 1, ambI: 1, fogD: 0.001, lamps: 0, glow: 0, stars: 0, sunSize: 0.06,
      sunDir: new THREE.Vector3(0, 0.1, -1), moonDir: new THREE.Vector3(0.3, 0.5, -1).normalize(),
      sunVis: 1, hour: 17,
    };
    this._a = new THREE.Color();
    this.tint = { color: C('#ffffff'), amount: 0, fogMul: 1, lampColor: C('#ffad4a') };
  }

  // stage: optional tint params; weather: {rain, mist}; outage 0..1 (load shedding)
  compute(hour, sunAzimuth, stageTint, weather, outage) {
    const S = this.state;
    let i = 0;
    while (i < KEYS.length - 2 && hour > KEYS[i + 1].h) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = clamp((hour - a.h) / (b.h - a.h), 0, 1);
    for (const f of FIELDS) S[f].copy(a[f]).lerp(b[f], t);
    for (const f of NUMS) S[f] = lerp(a[f], b[f], t);
    S.hour = hour;

    // stage colour grading: pull horizon & fog toward the stage's signature hue
    if (stageTint) {
      const tc = this._a.set(stageTint.color || '#ffffff');
      const amt = stageTint.amount || 0;
      S.hor.lerp(tc, amt * 0.6);
      S.fog.lerp(tc, amt);
      S.cloud.lerp(tc, amt * 0.3);
      if (stageTint.fogMul) S.fogD *= stageTint.fogMul;
    }
    // weather
    const rain = weather?.rain || 0, mist = weather?.mist || 0;
    if (rain > 0) {
      const grey = this._a.set('#5a6070');
      S.hor.lerp(grey, rain * 0.45);
      S.zen.lerp(grey.multiplyScalar(0.5), rain * 0.4);
      S.fog.lerp(this._a.set('#4c5262').multiplyScalar(S.ambI + 0.3), rain * 0.5);
      S.fogD *= 1 + rain * 0.9;
      S.sunI *= 1 - rain * 0.7;
      S.stars *= 1 - rain;
    }
    if (mist > 0) {
      S.fogD *= 1 + mist * 1.4;
      S.fog.lerp(S.hor, mist * 0.5);
    }
    // load shedding: city lights die. stars come out (the only upside)
    if (outage > 0) {
      S.lamps *= 1 - outage;
      S.glow *= 1 - outage * 0.88;
      S.city.multiplyScalar(1 - outage * 0.9);
      S.stars = Math.min(1, S.stars + outage * 0.5);
      S.ambI *= 1 - outage * 0.25;
    }

    // sun direction
    const el = sunElevation(hour);
    const cz = Math.cos(el);
    S.sunDir.set(Math.sin(sunAzimuth) * cz, Math.sin(el), -Math.cos(sunAzimuth) * cz).normalize();
    S.sunVis = smoothstep(-0.14, -0.02, el) * (1 - rain * 0.85);
    // moon sits up and to the left of where the sun went
    const mAz = sunAzimuth - 0.7;
    S.moonDir.set(Math.sin(mAz) * 0.85, 0.42, -Math.cos(mAz) * 0.85).normalize();
    S.moonVis = (1 - smoothstep(-0.25, -0.05, el)) * (1 - rain);
    return S;
  }
}
