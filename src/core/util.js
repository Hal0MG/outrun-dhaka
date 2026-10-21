// Small math + randomness helpers shared everywhere.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeIO = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * t));
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInCubic = (t) => Math.pow(clamp(t, 0, 1), 3);
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const kmh = (ms) => ms * 3.6;

export function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed = 1) {
    this.f = mulberry32(typeof seed === 'string' ? hashStr(seed) : seed);
  }
  next() { return this.f(); }
  range(a, b) { return a + (b - a) * this.f(); }
  int(a, b) { return Math.floor(a + (b - a + 1) * this.f()); }
  chance(p) { return this.f() < p; }
  pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  sign() { return this.f() < 0.5 ? -1 : 1; }
  // weighted pick from {key: weight}
  weighted(obj) {
    let total = 0;
    for (const k in obj) total += obj[k];
    let r = this.f() * total;
    for (const k in obj) {
      r -= obj[k];
      if (r <= 0) return k;
    }
    return Object.keys(obj)[0];
  }
  gauss() {
    return (this.f() + this.f() + this.f() + this.f() - 2) / 2;
  }
}

// Global non-deterministic rng for effects
export const fx = new RNG((Math.random() * 1e9) | 0);

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
export let useBanglaDigits = false;
export function setBanglaDigits(v) { useBanglaDigits = v; }
export function bn(n) {
  const s = String(n);
  if (!useBanglaDigits) return s;
  return s.replace(/[0-9]/g, (d) => BN_DIGITS[d]);
}
export function toBnAlways(n) {
  return String(n).replace(/[0-9]/g, (d) => BN_DIGITS[d]);
}

export function fmtTime(sec, decimals = 2) {
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  const ss = s.toFixed(decimals).padStart(decimals ? 3 + decimals : 2, '0');
  return `${m}'${ss.replace('.', '"')}`;
}

// 1D value noise for cheap wobble
export function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}

export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('outrun-dhaka:' + key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('outrun-dhaka:' + key, JSON.stringify(value));
    } catch (e) { /* storage unavailable */ }
  },
};
