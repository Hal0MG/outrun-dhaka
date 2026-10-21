// Painted billboard sprites (OutRun's roadside DNA): trees, people, stalls,
// festival masks. Rendered as camera-facing (cylindrical) instanced quads.

import * as THREE from 'three';
import { Atlas } from './atlas.js';
import { RNG } from '../core/util.js';
import * as P from './paint.js';

// ---------------------------------------------------------------- drawing helpers

function blob(ctx, x, y, r, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function trunk(ctx, x0, y0, x1, y1, w0, w1, col, rings = false) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;
  const cx = (x0 + x1) / 2 + nx * len * 0.06, cy = (y0 + y1) / 2 + ny * len * 0.06;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x0 - nx * w0, y0 - ny * w0);
  ctx.quadraticCurveTo(cx - nx * (w0 + w1) / 2, cy - ny * (w0 + w1) / 2, x1 - nx * w1, y1 - ny * w1);
  ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
  ctx.quadraticCurveTo(cx + nx * (w0 + w1) / 2, cy + ny * (w0 + w1) / 2, x0 + nx * w0, y0 + ny * w0);
  ctx.closePath();
  ctx.fill();
  // shade one side
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
  ctx.quadraticCurveTo(cx + nx * (w0 + w1) / 2, cy + ny * (w0 + w1) / 2, x0 + nx * w0, y0 + ny * w0);
  ctx.closePath();
  ctx.fill();
  if (rings) {
    ctx.strokeStyle = 'rgba(40,25,15,0.55)';
    ctx.lineWidth = 1.2;
    for (let t = 0.02; t < 1; t += 0.035) {
      const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
      const py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
      const w = w0 + (w1 - w0) * t;
      ctx.beginPath();
      ctx.moveTo(px - nx * w, py - ny * w);
      ctx.lineTo(px + nx * w, py + ny * w + 1);
      ctx.stroke();
    }
  }
}

function frond(ctx, x, y, ang, len, droop, col, col2) {
  // a palm frond: curved spine with leaflets
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const a = ang + droop * t * t;
    const px = x + Math.cos(ang) * len * t + Math.cos(a) * len * 0.15 * t;
    const py = y + Math.sin(ang) * len * t + droop * len * 0.35 * t * t;
    pts.push([px, py, a]);
  }
  ctx.strokeStyle = col2;
  ctx.lineWidth = 2;
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.stroke();
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i];
    const t = i / pts.length;
    const ll = len * 0.28 * (1 - t * 0.6);
    for (const side of [-1, 1]) {
      const la = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) + side * 1.1 + 0.5;
      ctx.strokeStyle = (i + (side > 0 ? 1 : 0)) % 3 === 0 ? col2 : col;
      ctx.lineWidth = 2.6 * (1 - t * 0.5);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + Math.cos(la) * ll * 0.5, py + Math.sin(la) * ll * 0.5, px + Math.cos(la + 0.4) * ll, py + Math.sin(la + 0.4) * ll + ll * 0.25);
      ctx.stroke();
    }
  }
}

function drawPalm(seed) {
  return (ctx, e, w, h) => {
    const rng = new RNG(seed);
    const bx = w / 2 + rng.range(-10, 10);
    const lean = rng.range(-28, 28);
    const tx = w / 2 + lean, ty = h * 0.24;
    trunk(ctx, bx, h, tx, ty, 9, 6, '#8b7660', true);
    // crown
    const cols = ['#2f6e2c', '#3d8a34', '#25591f'];
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + ((i / (n - 1)) - 0.5) * Math.PI * 1.7 + rng.range(-0.1, 0.1);
      const len = rng.range(w * 0.36, w * 0.48);
      frond(ctx, tx, ty, a, len, rng.range(0.6, 1.3) * (Math.abs(Math.cos(a)) + 0.3), rng.pick(cols), '#1d4a19');
    }
    // coconuts
    for (let i = 0; i < 6; i++) blob(ctx, tx + rng.range(-10, 10), ty + rng.range(4, 14), 5.5, rng.pick(['#5c7a2a', '#6f8a30', '#7a5a2a']));
    blob(ctx, tx, ty, 6, '#3a5a20');
  };
}

function drawBetel(seed) {
  return (ctx, e, w, h) => {
    const rng = new RNG(seed);
    const tx = w / 2 + rng.range(-8, 8), ty = h * 0.13;
    trunk(ctx, w / 2, h, tx, ty, 4, 3, '#a39a8a', true);
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + ((i / 7) - 0.5) * Math.PI * 1.5;
      frond(ctx, tx, ty, a, rng.range(w * 0.32, w * 0.44), 1.0, rng.pick(['#3d8a34', '#2f6e2c']), '#1d4a19');
    }
    blob(ctx, tx, ty + 8, 5, '#4a7a24');
  };
}

function canopy(ctx, cx, cy, rx, ry, rng, cols, n = 260, rmin = 5, rmax = 14, topCols = null) {
  for (let i = 0; i < n; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = Math.sqrt(rng.next());
    const x = cx + Math.cos(a) * rx * r;
    const y = cy + Math.sin(a) * ry * r;
    const top = y < cy;
    const shadeK = (y - (cy - ry)) / (2 * ry);
    const palette = topCols && top && rng.chance(0.7) ? topCols : cols;
    let col = rng.pick(palette);
    col = P.shade(col, -shadeK * 0.35 + 0.05);
    blob(ctx, x, y, rng.range(rmin, rmax), col);
  }
}

function drawFlameTree(seed, flowerCols) {
  return (ctx, e, w, h) => {
    const rng = new RNG(seed);
    const cx = w / 2, by = h;
    // trunk + limbs
    trunk(ctx, cx, by, cx + rng.range(-10, 10), h * 0.55, 13, 9, '#5a4434');
    for (let i = 0; i < 4; i++) {
      const ex = cx + rng.range(-w * 0.35, w * 0.35), ey = h * rng.range(0.28, 0.42);
      trunk(ctx, cx, h * 0.6, ex, ey, 7, 3, '#4e3a2c');
    }
    // umbrella canopy: underside green, top flowers
    canopy(ctx, cx, h * 0.34, w * 0.46, h * 0.18, rng, ['#2f6a2a', '#3f7d33', '#24521f'], 220, 6, 14);
    canopy(ctx, cx, h * 0.28, w * 0.44, h * 0.14, rng, flowerCols, 340, 4, 10, flowerCols.map((c) => P.shade(c, 0.2)));
    // scattered petals on the ground
    for (let i = 0; i < 26; i++) blob(ctx, cx + rng.range(-w * 0.4, w * 0.4), h - rng.range(1, 6), rng.range(1.5, 3), rng.pick(flowerCols));
  };
}

function drawBigTree(seed, kind = 'mango') {
  return (ctx, e, w, h) => {
    const rng = new RNG(seed);
    const cx = w / 2;
    trunk(ctx, cx, h, cx + rng.range(-6, 6), h * 0.5, 18, 11, '#4a3a2e');
    if (kind === 'banyan') {
      ctx.strokeStyle = '#5c4a3a';
      ctx.lineWidth = 2;
      for (let i = 0; i < 18; i++) {
        const x = cx + rng.range(-w * 0.4, w * 0.4);
        ctx.beginPath(); ctx.moveTo(x, h * 0.45); ctx.lineTo(x + rng.range(-4, 4), h); ctx.stroke();
      }
    }
    for (let i = 0; i < 3; i++) trunk(ctx, cx, h * 0.6, cx + rng.range(-w * 0.3, w * 0.3), h * 0.35, 8, 3, '#45362a');
    const cols = kind === 'mango' ? ['#1f4d1f', '#2a5e25', '#346b2b', '#183f18'] : ['#2b5a26', '#356b2d', '#22481f', '#3e7a33'];
    canopy(ctx, cx, h * 0.36, w * 0.45, h * 0.3, rng, cols, 520, 7, 16);
    // highlights
    for (let i = 0; i < 60; i++) blob(ctx, cx + rng.range(-w * 0.3, w * 0.25), h * 0.2 + rng.range(0, h * 0.2), rng.range(3, 7), 'rgba(140,190,90,0.6)');
  };
}

function drawBanana(seed) {
  return (ctx, e, w, h) => {
    const rng = new RNG(seed);
    const cx = w / 2;
    for (let s = 0; s < 3; s++) {
      const sx = cx + (s - 1) * 22;
      trunk(ctx, sx, h, sx + rng.range(-6, 6), h * 0.45, 7, 5, '#6b8a3a');
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + rng.range(-1.3, 1.3);
        const len = rng.range(50, 80);
        ctx.save();
        ctx.translate(sx, h * 0.45);
        ctx.rotate(a);
        ctx.fillStyle = rng.pick(['#4f9a3a', '#5aa846', '#3f8530']);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(len * 0.5, -16, len, 4);
        ctx.quadraticCurveTo(len * 0.5, 14, 0, 0);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,200,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -1, len, 4); ctx.stroke();
        // tears
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        for (let k = 0.3; k < 0.95; k += 0.12) { ctx.beginPath(); ctx.moveTo(len * k, 0); ctx.lineTo(len * k + 4, -10); ctx.stroke(); }
        ctx.restore();
      }
    }
  };
}

function drawBamboo(seed) {
  return (ctx, e, w, h) => {
    const rng = new RNG(seed);
    const cx = w / 2;
    for (let i = 0; i < 22; i++) {
      const bx = cx + rng.range(-24, 24);
      const tx = bx + rng.range(-w * 0.45, w * 0.45), ty = rng.range(10, h * 0.3);
      ctx.strokeStyle = rng.pick(['#8ea64a', '#a7b85a', '#6d8a3a']);
      ctx.lineWidth = rng.range(2.5, 4);
      ctx.beginPath(); ctx.moveTo(bx, h); ctx.quadraticCurveTo(bx, h * 0.5, tx, ty); ctx.stroke();
      for (let k = 0; k < 14; k++) {
        const t = rng.range(0.4, 1);
        const px = (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * bx + t * t * tx;
        const py = (1 - t) * (1 - t) * h + 2 * (1 - t) * t * (h * 0.5) + t * t * ty;
        P.leaf(ctx, px, py, rng.range(10, 18), rng.range(0, Math.PI * 2), rng.pick(['#4f8a2e', '#64a03a', '#3a6e24']));
      }
    }
  };
}

function drawKash(seed) {
  return (ctx, e, w, h) => {
    const rng = new RNG(seed);
    for (let i = 0; i < 40; i++) {
      const bx = w / 2 + rng.range(-w * 0.35, w * 0.35);
      const tx = bx + rng.range(-30, 30), ty = rng.range(h * 0.1, h * 0.5);
      ctx.strokeStyle = rng.pick(['#7a9a4a', '#8fae58', '#6a8a3a']);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(bx, h); ctx.quadraticCurveTo(bx, (h + ty) / 2, tx, ty); ctx.stroke();
      // plume
      for (let k = 0; k < 16; k++) {
        const a = rng.range(-2.6, -0.5);
        const l = rng.range(6, 20);
        ctx.strokeStyle = rng.pick(['#f6f3ea', '#ffffff', '#ece6db', '#f3e9f0']);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx, ty + k);
        ctx.quadraticCurveTo(tx + Math.cos(a) * l * 0.5 + 4, ty + k + Math.sin(a) * l * 0.5, tx + Math.cos(a) * l + 8, ty + k + Math.sin(a) * l);
        ctx.stroke();
      }
    }
  };
}

function drawBush(seed, flowers = null) {
  return (ctx, e, w, h) => {
    const rng = new RNG(seed);
    canopy(ctx, w / 2, h * 0.6, w * 0.44, h * 0.36, rng, ['#2f6a2a', '#3f7d33', '#24521f', '#4b8a3a'], 200, 4, 10);
    if (flowers) for (let i = 0; i < 120; i++) blob(ctx, w / 2 + rng.range(-w * 0.4, w * 0.4), h * 0.6 + rng.range(-h * 0.35, h * 0.2), rng.range(2, 5), rng.pick(flowers));
  };
}

// people ---------------------------------------------------------------

const SKIN = ['#8a5a3a', '#a06a45', '#7a4a2e', '#b57a50', '#6e4228'];
const SHIRT = ['#f2f2ea', '#3b6fb5', '#c8102e', '#2ea36b', '#f2c230', '#7a3fb0', '#e8561c', '#1a1a1a', '#9fb6c9', '#e3d7bf'];
const LUNGI = ['#1d5fa8', '#118a4a', '#5b2a86', '#7a1d0c', '#2a2a2a'];

function person(ctx, x, by, s, rng, kind) {
  const skin = rng.pick(SKIN);
  const hh = s; // total height px
  ctx.save();
  ctx.translate(x, by);
  const head = hh * 0.12;
  if (kind === 'saree') {
    const c = rng.pick(['#c8102e', '#ff2e88', '#f2b81f', '#118a4a', '#1d5fa8', '#e8561c', '#7b2f9e']);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(-hh * 0.14, 0); ctx.lineTo(hh * 0.14, 0); ctx.lineTo(hh * 0.1, -hh * 0.6); ctx.lineTo(-hh * 0.1, -hh * 0.6); ctx.fill();
    ctx.fillRect(-hh * 0.11, -hh * 0.82, hh * 0.22, hh * 0.25);
    // aanchal border
    ctx.fillStyle = P.shade(c, 0.5);
    ctx.fillRect(-hh * 0.14, -hh * 0.06, hh * 0.28, hh * 0.04);
    ctx.save(); ctx.rotate(0.4); ctx.fillStyle = P.shade(c, -0.25); ctx.fillRect(-hh * 0.02, -hh * 0.82, hh * 0.08, hh * 0.45); ctx.restore();
    blob(ctx, 0, -hh * 0.88, head * 0.75, skin);
    blob(ctx, 0, -hh * 0.92, head * 0.72, '#15100c');
    blob(ctx, hh * 0.04, -hh * 0.82, head * 0.4, '#15100c');
  } else if (kind === 'kameez') {
    const c = rng.pick(['#ff7eb6', '#20b2c9', '#f2c230', '#9b4dca', '#2ea36b', '#ffffff']);
    ctx.fillStyle = rng.pick(['#f4f0e0', '#1a1a1a', '#c8102e']);
    ctx.fillRect(-hh * 0.07, -hh * 0.3, hh * 0.06, hh * 0.3);
    ctx.fillRect(hh * 0.01, -hh * 0.3, hh * 0.06, hh * 0.3);
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.moveTo(-hh * 0.13, -hh * 0.28); ctx.lineTo(hh * 0.13, -hh * 0.28); ctx.lineTo(hh * 0.1, -hh * 0.8); ctx.lineTo(-hh * 0.1, -hh * 0.8); ctx.fill();
    ctx.fillStyle = P.shade(c, -0.3);
    ctx.fillRect(-hh * 0.13, -hh * 0.8, hh * 0.26, hh * 0.07); // orna
    blob(ctx, 0, -hh * 0.88, head * 0.75, skin);
    blob(ctx, 0, -hh * 0.92, head * 0.72, '#15100c');
  } else {
    // man: lungi or trousers + shirt / panjabi / vest
    const lower = kind === 'panjabi' ? rng.pick(['#f4f0e0', '#e8e3d0']) : rng.chance(0.55) ? rng.pick(LUNGI) : rng.pick(['#2a2a2a', '#3a4a5a', '#5a4a3a']);
    ctx.fillStyle = lower;
    if (kind === 'lungi' || rng.chance(0.5)) {
      ctx.beginPath(); ctx.moveTo(-hh * 0.12, -hh * 0.04); ctx.lineTo(hh * 0.12, -hh * 0.04); ctx.lineTo(hh * 0.1, -hh * 0.46); ctx.lineTo(-hh * 0.1, -hh * 0.46); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let k = 0; k < 6; k++) ctx.fillRect(-hh * 0.12, -hh * 0.44 + k * hh * 0.07, hh * 0.24, hh * 0.02);
      ctx.fillStyle = skin;
      ctx.fillRect(-hh * 0.07, -hh * 0.04, hh * 0.04, hh * 0.04);
      ctx.fillRect(hh * 0.03, -hh * 0.04, hh * 0.04, hh * 0.04);
    } else {
      ctx.fillRect(-hh * 0.09, -hh * 0.46, hh * 0.08, hh * 0.46);
      ctx.fillRect(hh * 0.01, -hh * 0.46, hh * 0.08, hh * 0.46);
    }
    const top = kind === 'panjabi' ? rng.pick(['#f4f0e0', '#d6c8a8', '#2a62c9', '#c8102e']) : rng.pick(SHIRT);
    ctx.fillStyle = top;
    const topLen = kind === 'panjabi' ? 0.42 : 0.36;
    ctx.fillRect(-hh * 0.12, -hh * (0.46 + topLen) + hh * (kind === 'panjabi' ? 0.12 : 0), hh * 0.24, hh * topLen);
    ctx.fillStyle = P.shade(top, -0.25);
    ctx.fillRect(-hh * 0.16, -hh * 0.8, hh * 0.05, hh * 0.28);
    ctx.fillRect(hh * 0.11, -hh * 0.8, hh * 0.05, hh * 0.28);
    if (kind === 'vendor') {
      // basket on head
      ctx.fillStyle = '#b08a4a';
      ctx.beginPath(); ctx.ellipse(0, -hh * 1.0, hh * 0.18, hh * 0.06, 0, 0, Math.PI * 2); ctx.fill();
      for (let k = 0; k < 8; k++) blob(ctx, rng.range(-hh * 0.14, hh * 0.14), -hh * 1.03, hh * 0.03, rng.pick(['#f2c230', '#e8561c', '#2ea36b', '#c8102e']));
    }
    blob(ctx, 0, -hh * 0.88, head * 0.75, skin);
    blob(ctx, 0, -hh * 0.93, head * 0.62, '#15100c');
    if (kind === 'panjabi' && rng.chance(0.5)) {
      ctx.fillStyle = '#f4f4f0';
      ctx.beginPath(); ctx.arc(0, -hh * 0.94, head * 0.62, Math.PI, 0); ctx.fill(); // tupi
    }
    if (kind === 'gamcha' || rng.chance(0.2)) {
      ctx.fillStyle = '#c8102e';
      ctx.fillRect(-hh * 0.13, -hh * 0.82, hh * 0.26, hh * 0.04);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-hh * 0.13, -hh * 0.81, hh * 0.26, hh * 0.01);
    }
  }
  ctx.restore();
}

function drawPerson(seed, kind) {
  return (ctx, e, w, h) => person(ctx, w / 2, h - 1, h * 0.95, new RNG(seed), kind);
}

function drawCrowd(seed, n = 8) {
  return (ctx, e, w, h) => {
    const rng = new RNG(seed);
    const kinds = ['lungi', 'saree', 'kameez', 'shirt', 'panjabi', 'shirt', 'lungi'];
    const order = [];
    for (let i = 0; i < n; i++) order.push({ x: rng.range(w * 0.08, w * 0.92), s: rng.range(h * 0.72, h * 0.95), k: rng.pick(kinds) });
    order.sort((a, b) => a.s - b.s);
    order.forEach((o) => person(ctx, o.x, h - 1, o.s, rng, o.k));
  };
}

function drawPolice(ctx, e, w, h) {
  const s = h * 0.95, x = w / 2, by = h - 1;
  ctx.save();
  ctx.translate(x, by);
  ctx.fillStyle = '#1b2333';
  ctx.fillRect(-s * 0.09, -s * 0.46, s * 0.08, s * 0.46);
  ctx.fillRect(s * 0.01, -s * 0.46, s * 0.08, s * 0.46);
  ctx.fillStyle = '#f4f4f0';
  ctx.fillRect(-s * 0.12, -s * 0.82, s * 0.24, s * 0.38);
  // reflective vest
  ctx.fillStyle = '#d9ff3a';
  ctx.fillRect(-s * 0.12, -s * 0.78, s * 0.24, s * 0.3);
  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(-s * 0.12, -s * 0.66, s * 0.24, s * 0.03);
  // raised arm with white glove
  ctx.fillStyle = '#f4f4f0';
  ctx.save(); ctx.translate(s * 0.12, -s * 0.78); ctx.rotate(-2.4); ctx.fillRect(0, -s * 0.03, s * 0.3, s * 0.06); ctx.restore();
  blob(ctx, s * 0.3, -s * 1.0, s * 0.04, '#ffffff');
  ctx.fillRect(-s * 0.16, -s * 0.78, s * 0.05, s * 0.28);
  blob(ctx, 0, -s * 0.88, s * 0.09, '#8a5a3a');
  // cap
  ctx.fillStyle = '#1b2333';
  ctx.fillRect(-s * 0.1, -s * 0.99, s * 0.2, s * 0.07);
  ctx.fillRect(-s * 0.12, -s * 0.93, s * 0.24, s * 0.02);
  ctx.restore();
  if (e) {
    e.fillStyle = '#c8ff4a';
    e.fillRect(w / 2 - s * 0.12, by - s * 0.67, s * 0.24, s * 0.03);
  }
}

// stalls -------------------------------------------------------------

function drawTeaStall(ctx, e, w, h) {
  const rng = new RNG('tea');
  // tarp roof
  ctx.fillStyle = '#2f6fc0';
  ctx.beginPath(); ctx.moveTo(w * 0.04, h * 0.18); ctx.lineTo(w * 0.96, h * 0.12); ctx.lineTo(w * 0.92, h * 0.26); ctx.lineTo(w * 0.08, h * 0.3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  for (let x = w * 0.08; x < w * 0.92; x += 14) ctx.fillRect(x, h * 0.16, 5, h * 0.12);
  // bamboo posts
  ctx.fillStyle = '#b89a5a';
  ctx.fillRect(w * 0.1, h * 0.26, 5, h * 0.74);
  ctx.fillRect(w * 0.88, h * 0.22, 5, h * 0.78);
  // box stall
  ctx.fillStyle = '#7a4a28';
  ctx.fillRect(w * 0.16, h * 0.52, w * 0.62, h * 0.48);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (let y = h * 0.52; y < h; y += 8) ctx.fillRect(w * 0.16, y, w * 0.62, 1);
  // counter top: glass jars of biscuits & cake
  for (let i = 0; i < 5; i++) {
    const jx = w * 0.22 + i * w * 0.1;
    ctx.fillStyle = 'rgba(200,230,240,0.85)';
    ctx.fillRect(jx, h * 0.4, w * 0.08, h * 0.12);
    for (let k = 0; k < 6; k++) blob(ctx, jx + rng.range(4, w * 0.07), h * 0.44 + rng.range(0, h * 0.07), 3, rng.pick(['#d9a54a', '#b5651d', '#f2d38a', '#e85d9d']));
    ctx.fillStyle = rng.pick(['#c8102e', '#1d5fa8', '#f2c230']);
    ctx.fillRect(jx, h * 0.39, w * 0.08, 3);
  }
  // hanging banana bunches (essential)
  for (let i = 0; i < 2; i++) {
    const bx = w * (0.3 + i * 0.3), by = h * 0.28;
    ctx.strokeStyle = '#5a4a2a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by + 10); ctx.stroke();
    for (let k = 0; k < 14; k++) {
      ctx.save(); ctx.translate(bx + rng.range(-8, 8), by + 12 + rng.range(0, 18)); ctx.rotate(rng.range(-0.6, 0.6));
      ctx.fillStyle = rng.pick(['#e8d23a', '#d9c22e', '#a8b83a']);
      ctx.beginPath(); ctx.ellipse(0, 0, 3, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  // kettle on clay stove
  const kx = w * 0.72, ky = h * 0.48;
  ctx.fillStyle = '#8a5a3a';
  ctx.fillRect(kx - 14, ky - 2, 28, 16);
  ctx.fillStyle = '#c9ccd0';
  ctx.beginPath(); ctx.ellipse(kx, ky - 12, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(kx + 8, ky - 18, 12, 3);
  ctx.fillStyle = '#9aa0a6';
  ctx.fillRect(kx - 5, ky - 26, 10, 4);
  // steam
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(kx + 20, ky - 18); ctx.bezierCurveTo(kx + 26, ky - 30, kx + 16, ky - 36, kx + 24, ky - 48); ctx.stroke();
  // sign
  ctx.fillStyle = '#c8102e';
  ctx.fillRect(w * 0.2, h * 0.56, w * 0.3, h * 0.12);
  P.signText(ctx, 'চা', w * 0.35, h * 0.62, { font: `700 ${Math.round(h * 0.1)}px ${P.FONT_BN}`, fill: '#ffe14a', stroke: '#000', lw: 2 });
  // bench with two customers
  ctx.fillStyle = '#5a3a20';
  ctx.fillRect(w * 0.05, h * 0.84, w * 0.5, 6);
  ctx.fillRect(w * 0.08, h * 0.86, 4, h * 0.14);
  ctx.fillRect(w * 0.5, h * 0.86, 4, h * 0.14);
  person(ctx, w * 0.18, h * 0.88, h * 0.5, rng, 'lungi');
  person(ctx, w * 0.4, h * 0.88, h * 0.52, rng, 'shirt');
  // vendor
  person(ctx, w * 0.6, h * 0.52, h * 0.36, rng, 'gamcha');
  if (e) {
    // bulb + coal glow
    const g = e.createRadialGradient(w * 0.5, h * 0.3, 2, w * 0.5, h * 0.3, 40);
    g.addColorStop(0, '#fff2c0');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    e.fillStyle = g;
    e.fillRect(w * 0.3, h * 0.2, w * 0.4, h * 0.3);
    e.fillStyle = '#ff6a1a';
    e.fillRect(kx - 12, ky + 6, 24, 6);
    e.fillStyle = '#ffd99a';
    e.fillRect(w * 0.22, h * 0.4, w * 0.48, h * 0.12);
  }
}

function drawFuchka(ctx, e, w, h) {
  const rng = new RNG('fuchka');
  // cart wheels
  for (const x of [w * 0.25, w * 0.65]) {
    ctx.strokeStyle = '#222'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, h * 0.86, h * 0.11, 0, Math.PI * 2); ctx.stroke();
  }
  // body
  ctx.fillStyle = '#e8561c';
  ctx.fillRect(w * 0.1, h * 0.58, w * 0.7, h * 0.2);
  P.signText(ctx, 'ফুচকা • চটপটি', w * 0.45, h * 0.68, { font: `700 ${Math.round(h * 0.09)}px ${P.FONT_BN}`, fill: '#fff', stroke: '#7a0716', lw: 2 });
  // glass case with fuchka pile
  ctx.fillStyle = 'rgba(190,225,240,0.75)';
  ctx.fillRect(w * 0.14, h * 0.3, w * 0.62, h * 0.28);
  for (let i = 0; i < 40; i++) blob(ctx, w * 0.18 + rng.range(0, w * 0.54), h * 0.5 - rng.range(0, h * 0.16) * rng.next(), 5, rng.pick(['#e8b45a', '#d9a04a', '#f2c878']));
  ctx.strokeStyle = '#c0c0c0'; ctx.lineWidth = 2;
  ctx.strokeRect(w * 0.14, h * 0.3, w * 0.62, h * 0.28);
  // canopy
  ctx.fillStyle = '#c8102e';
  ctx.fillRect(w * 0.08, h * 0.16, w * 0.74, h * 0.06);
  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(w * 0.12, h * 0.2, 3, h * 0.12);
  ctx.fillRect(w * 0.76, h * 0.2, 3, h * 0.12);
  person(ctx, w * 0.88, h * 0.98, h * 0.62, rng, 'shirt');
  if (e) {
    e.fillStyle = '#fff8d8';
    e.beginPath(); e.arc(w * 0.45, h * 0.24, 6, 0, Math.PI * 2); e.fill();
    const g = e.createRadialGradient(w * 0.45, h * 0.4, 4, w * 0.45, h * 0.4, w * 0.4);
    g.addColorStop(0, 'rgba(255,230,170,0.9)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    e.fillStyle = g;
    e.fillRect(w * 0.14, h * 0.3, w * 0.62, h * 0.28);
  }
}

function drawFlowerStall(ctx, e, w, h) {
  const rng = new RNG('flowers');
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(w * 0.05, h * 0.6, w * 0.9, h * 0.4);
  // buckets of flowers
  for (let i = 0; i < 6; i++) {
    const bx = w * 0.1 + i * w * 0.14;
    ctx.fillStyle = '#3d6fb5';
    ctx.fillRect(bx, h * 0.5, w * 0.1, h * 0.12);
    const cols = rng.pick([['#e4252b', '#c8102e'], ['#ffb000', '#ff8c00'], ['#ffffff', '#f2e6f0'], ['#ff2e88', '#e85d9d']]);
    for (let k = 0; k < 28; k++) blob(ctx, bx + w * 0.05 + rng.range(-w * 0.06, w * 0.06), h * 0.5 - rng.range(0, h * 0.18), rng.range(3, 6), rng.pick(cols));
  }
  // marigold garlands hanging
  for (let i = 0; i < 9; i++) {
    const gx = w * 0.08 + i * w * 0.1;
    for (let k = 0; k < 10; k++) blob(ctx, gx, h * 0.08 + k * 6, 3.6, k % 2 ? '#ff8c00' : '#ffb300');
  }
  ctx.fillStyle = '#c8102e';
  ctx.fillRect(0, 0, w, h * 0.07);
  if (e) {
    for (let i = 0; i < 6; i++) {
      e.fillStyle = '#ffe9b0';
      e.beginPath(); e.arc(w * 0.12 + i * w * 0.15, h * 0.08, 3, 0, Math.PI * 2); e.fill();
    }
  }
}

function drawBookStall(ctx, e, w, h) {
  const rng = new RNG('books');
  ctx.fillStyle = '#5a3a20';
  ctx.fillRect(0, h * 0.2, w, h * 0.8);
  for (let r = 0; r < 4; r++) {
    let x = 4;
    const y = h * 0.24 + r * h * 0.19;
    while (x < w - 6) {
      const bw = rng.range(4, 10), bh = rng.range(h * 0.1, h * 0.16);
      ctx.fillStyle = rng.pick(['#c8102e', '#1d5fa8', '#f2c230', '#118a4a', '#f4f0e0', '#7b2f9e', '#e8561c', '#222']);
      ctx.fillRect(x, y + h * 0.17 - bh, bw, bh);
      x += bw + 1;
    }
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(0, y + h * 0.17, w, 3);
  }
  ctx.fillStyle = '#f2c230';
  ctx.fillRect(0, 0, w, h * 0.18);
  P.signText(ctx, 'নীলক্ষেত বই বিতান', w / 2, h * 0.09, { font: `700 ${Math.round(h * 0.11)}px ${P.FONT_BN}`, fill: '#7a0716', stroke: null, lw: 0, maxW: w * 0.9 });
  if (e) {
    e.fillStyle = 'rgba(255,240,200,0.6)';
    e.fillRect(0, h * 0.2, w, h * 0.3);
  }
}

function drawSareeShop(ctx, e, w, h) {
  const rng = new RNG('saree');
  ctx.fillStyle = '#2a1e18';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 9; i++) {
    const x = i * (w / 9);
    const c = rng.pick(['#c8102e', '#ff2e88', '#f2b81f', '#118a4a', '#1d5fa8', '#7b2f9e', '#e8561c', '#20b2c9']);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x + 2, 6); ctx.lineTo(x + w / 9 - 2, 6);
    ctx.quadraticCurveTo(x + w / 9 + 2, h * 0.5, x + w / 9 - 4, h * 0.92);
    ctx.lineTo(x + 4, h * 0.92);
    ctx.quadraticCurveTo(x - 2, h * 0.5, x + 2, 6);
    ctx.fill();
    // zari border
    ctx.fillStyle = '#f2d36a';
    ctx.fillRect(x + 4, h * 0.82, w / 9 - 8, h * 0.05);
    for (let k = 0; k < 8; k++) blob(ctx, x + w / 18 + rng.range(-6, 6), rng.range(h * 0.15, h * 0.75), 1.6, '#f2d36a');
  }
  if (e) {
    e.fillStyle = 'rgba(255,220,160,0.45)';
    e.fillRect(0, 0, w, h);
  }
}

function drawFruitVan(ctx, e, w, h) {
  const rng = new RNG('fruit');
  for (const x of [w * 0.2, w * 0.75]) {
    ctx.strokeStyle = '#222'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, h * 0.86, h * 0.12, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(w * 0.05, h * 0.62, w * 0.9, h * 0.1);
  const fruits = [['#f2c230', 9], ['#2ea36b', 8], ['#e8561c', 7], ['#c8102e', 6], ['#a8b83a', 10]];
  for (let i = 0; i < 70; i++) {
    const [c, r] = rng.pick(fruits);
    blob(ctx, w * 0.1 + rng.range(0, w * 0.8), h * 0.6 - rng.range(0, h * 0.25) * rng.next(), r * 0.8, c);
  }
  person(ctx, w * 0.92, h * 0.98, h * 0.6, rng, 'lungi');
}

// animals --------------------------------------------------------------

function drawCow(seed, col) {
  return (ctx, e, w, h) => {
    const rng = new RNG(seed);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(w * 0.48, h * 0.48, w * 0.32, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    // hump
    ctx.beginPath(); ctx.ellipse(w * 0.3, h * 0.3, w * 0.08, h * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    // legs
    ctx.fillStyle = P.shade(col, -0.2);
    for (const x of [0.25, 0.34, 0.62, 0.72]) ctx.fillRect(w * x, h * 0.6, w * 0.05, h * 0.38);
    // head
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(w * 0.14, h * 0.42, w * 0.08, h * 0.12, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e8e0d0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.3); ctx.quadraticCurveTo(w * 0.18, h * 0.16, w * 0.24, h * 0.18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 0.11, h * 0.3); ctx.quadraticCurveTo(w * 0.06, h * 0.16, w * 0.02, h * 0.2); ctx.stroke();
    // garland (Eid cattle)
    for (let k = 0; k < 8; k++) blob(ctx, w * 0.2 + k * 3, h * 0.5 + Math.sin(k) * 3, 3, k % 2 ? '#ff2e88' : '#ffb000');
    // tail
    ctx.strokeStyle = P.shade(col, -0.3); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w * 0.8, h * 0.4); ctx.quadraticCurveTo(w * 0.86, h * 0.6, w * 0.84, h * 0.75); ctx.stroke();
    if (rng.chance(0.5)) P.blotches(ctx, w * 0.3, h * 0.3, w * 0.4, h * 0.3, rng, 4, 'rgba(60,40,25,0.8)', 6, 12);
  };
}

function drawDog(ctx, e, w, h) {
  ctx.fillStyle = '#b58a5a';
  ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.55, w * 0.3, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(w * 0.26, h * 0.6, w * 0.06, h * 0.38);
  ctx.fillRect(w * 0.66, h * 0.6, w * 0.06, h * 0.38);
  ctx.beginPath(); ctx.ellipse(w * 0.18, h * 0.38, w * 0.12, h * 0.15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w * 0.12, h * 0.28); ctx.lineTo(w * 0.14, h * 0.12); ctx.lineTo(w * 0.2, h * 0.26); ctx.fill();
  ctx.strokeStyle = '#b58a5a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(w * 0.8, h * 0.5); ctx.quadraticCurveTo(w * 0.92, h * 0.3, w * 0.88, h * 0.2); ctx.stroke();
}

// festival masks (Mangal Shobhajatra) ---------------------------------

function drawOwlMask(ctx, e, w, h) {
  const cx = w / 2, cy = h * 0.45;
  ctx.fillStyle = '#f2b81f';
  ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.42, h * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 5; ctx.stroke();
  // ear tufts
  ctx.fillStyle = '#e4252b';
  ctx.beginPath(); ctx.moveTo(cx - w * 0.3, cy - h * 0.25); ctx.lineTo(cx - w * 0.42, cy - h * 0.46); ctx.lineTo(cx - w * 0.14, cy - h * 0.34); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + w * 0.3, cy - h * 0.25); ctx.lineTo(cx + w * 0.42, cy - h * 0.46); ctx.lineTo(cx + w * 0.14, cy - h * 0.34); ctx.fill(); ctx.stroke();
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx + sx * w * 0.17, cy - h * 0.06, w * 0.14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e4252b';
    ctx.beginPath(); ctx.arc(cx + sx * w * 0.17, cy - h * 0.06, w * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(cx + sx * w * 0.17, cy - h * 0.06, w * 0.045, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#1d5fa8';
  ctx.beginPath(); ctx.moveTo(cx - w * 0.06, cy + h * 0.06); ctx.lineTo(cx + w * 0.06, cy + h * 0.06); ctx.lineTo(cx, cy + h * 0.2); ctx.fill(); ctx.stroke();
  // chest pattern
  for (let i = 0; i < 3; i++) for (let j = -2; j <= 2; j++) {
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx + j * w * 0.08, cy + h * 0.24 + i * h * 0.06, w * 0.035, 0, Math.PI); ctx.stroke();
  }
  // pole
  ctx.fillStyle = '#b89a5a';
  ctx.fillRect(cx - 4, cy + h * 0.38, 8, h * 0.2);
}

function drawTigerMask(ctx, e, w, h) {
  const cx = w / 2, cy = h * 0.46, r = Math.min(w, h) * 0.4;
  ctx.fillStyle = '#f08a1c';
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.15, r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 5; ctx.stroke();
  // ears
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#f08a1c';
    ctx.beginPath(); ctx.arc(cx + sx * r * 0.8, cy - r * 0.75, r * 0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd9b0';
    ctx.beginPath(); ctx.arc(cx + sx * r * 0.8, cy - r * 0.75, r * 0.12, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#fff4dc';
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.35, r * 0.62, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  for (let i = 0; i < 4; i++) {
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + sx * r * 1.12, cy - r * 0.45 + i * r * 0.26);
      ctx.lineTo(cx + sx * r * 0.62, cy - r * 0.36 + i * r * 0.22);
      ctx.lineTo(cx + sx * r * 1.0, cy - r * 0.3 + i * r * 0.26);
      ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(cx - r * 0.1 + i * 0.07 * r, cy - r * 0.95); ctx.lineTo(cx, cy - r * 0.55); ctx.lineTo(cx + r * 0.1 - i * 0.07 * r, cy - r * 0.95); ctx.fill();
  }
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#ffe14a';
    ctx.beginPath(); ctx.ellipse(cx + sx * r * 0.38, cy - r * 0.15, r * 0.17, r * 0.11, sx * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(cx + sx * r * 0.38, cy - r * 0.15, r * 0.06, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#e4252b';
  ctx.beginPath(); ctx.moveTo(cx - r * 0.14, cy + r * 0.12); ctx.lineTo(cx + r * 0.14, cy + r * 0.12); ctx.lineTo(cx, cy + r * 0.3); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.3); ctx.lineTo(cx, cy + r * 0.45); ctx.moveTo(cx - r * 0.3, cy + r * 0.5); ctx.quadraticCurveTo(cx, cy + r * 0.68, cx + r * 0.3, cy + r * 0.5); ctx.stroke();
  ctx.fillStyle = '#b89a5a';
  ctx.fillRect(cx - 4, cy + r, 8, h - cy - r);
}

function drawFishMask(ctx, e, w, h) {
  const cy = h * 0.45;
  ctx.fillStyle = '#20b2c9';
  ctx.beginPath();
  ctx.moveTo(w * 0.08, cy);
  ctx.quadraticCurveTo(w * 0.4, cy - h * 0.42, w * 0.78, cy);
  ctx.quadraticCurveTo(w * 0.4, cy + h * 0.42, w * 0.08, cy);
  ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = '#ff2e88';
  ctx.beginPath(); ctx.moveTo(w * 0.76, cy); ctx.lineTo(w * 0.97, cy - h * 0.3); ctx.lineTo(w * 0.97, cy + h * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
  // scales
  for (let x = w * 0.3; x < w * 0.7; x += w * 0.06) {
    for (let y = cy - h * 0.18; y < cy + h * 0.2; y += h * 0.1) {
      ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, w * 0.025, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    }
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(w * 0.2, cy - h * 0.05, w * 0.04, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(w * 0.2, cy - h * 0.05, w * 0.02, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b89a5a';
  ctx.fillRect(w * 0.42, cy + h * 0.25, 7, h * 0.3);
}

function drawHorseMask(ctx, e, w, h) {
  // Bengali folk "nakshi" horse (Shokher Hari style)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(w * 0.3, h * 0.92);
  ctx.lineTo(w * 0.36, h * 0.45);
  ctx.quadraticCurveTo(w * 0.3, h * 0.12, w * 0.55, h * 0.06);
  ctx.quadraticCurveTo(w * 0.86, h * 0.1, w * 0.8, h * 0.28);
  ctx.lineTo(w * 0.62, h * 0.3);
  ctx.lineTo(w * 0.6, h * 0.5);
  ctx.lineTo(w * 0.7, h * 0.92);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 5; ctx.stroke();
  // painted motifs
  P.flower(ctx, w * 0.48, h * 0.62, w * 0.1, 8, ['#e4252b', '#ffb000', '#1fae4b'], 0.2);
  P.flower(ctx, w * 0.5, h * 0.82, w * 0.07, 6, ['#1d5fa8', '#ff2e88', '#ffffff'], 0.4);
  ctx.fillStyle = '#e4252b';
  for (let i = 0; i < 7; i++) ctx.fillRect(w * 0.36 + i * 4, h * 0.1 + i * 8, 10, 6);
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(w * 0.62, h * 0.16, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1d5fa8'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(w * 0.38, h * 0.4); ctx.lineTo(w * 0.62, h * 0.4); ctx.stroke();
}

function drawKite(col1, col2) {
  return (ctx, e, w, h) => {
    ctx.fillStyle = col1;
    ctx.beginPath(); ctx.moveTo(w / 2, 2); ctx.lineTo(w - 4, h * 0.36); ctx.lineTo(w / 2, h * 0.7); ctx.lineTo(4, h * 0.36); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col2;
    ctx.beginPath(); ctx.moveTo(w / 2, 2); ctx.lineTo(w - 4, h * 0.36); ctx.lineTo(w / 2, h * 0.36); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(w / 2, 2); ctx.lineTo(w / 2, h * 0.7); ctx.moveTo(4, h * 0.36); ctx.lineTo(w - 4, h * 0.36); ctx.stroke();
    ctx.fillStyle = col2;
    ctx.beginPath(); ctx.moveTo(w / 2, h * 0.68); ctx.lineTo(w / 2 + 8, h * 0.85); ctx.lineTo(w / 2 - 8, h * 0.85); ctx.fill();
  };
}

function drawFlag(ctx, e, w, h) {
  ctx.fillStyle = '#c9c9c9';
  ctx.fillRect(4, 0, 4, h);
  ctx.fillStyle = '#006a4e';
  ctx.beginPath();
  ctx.moveTo(8, 4); ctx.quadraticCurveTo(w * 0.55, -4, w - 2, 8); ctx.lineTo(w - 2, h * 0.55); ctx.quadraticCurveTo(w * 0.55, h * 0.45, 8, h * 0.52); ctx.fill();
  ctx.fillStyle = '#f42a41';
  ctx.beginPath(); ctx.arc(w * 0.48, h * 0.28, h * 0.14, 0, Math.PI * 2); ctx.fill();
}

function drawStars(ctx, e, w, h) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const x = w / 2 + Math.cos(a) * w * 0.32, y = h / 2 + Math.sin(a) * h * 0.18;
    ctx.fillStyle = '#ffe14a';
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const aa = (k / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = k % 2 ? 4 : 9;
      ctx.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr);
    }
    ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.stroke();
  }
}

function drawKiln(ctx, e, w, h) {
  // brick kiln chimney with smoke base
  ctx.fillStyle = '#8e3f26';
  ctx.beginPath(); ctx.moveTo(w * 0.36, h); ctx.lineTo(w * 0.44, h * 0.05); ctx.lineTo(w * 0.56, h * 0.05); ctx.lineTo(w * 0.64, h); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = h * 0.05; y < h; y += 8) ctx.fillRect(w * 0.36, y, w * 0.3, 1);
  ctx.fillStyle = '#f4f0e0';
  ctx.fillRect(w * 0.42, h * 0.3, w * 0.16, h * 0.06);
  ctx.fillStyle = '#5a2a18';
  ctx.fillRect(w * 0.43, h * 0.05, w * 0.14, h * 0.02);
}

// ---------------------------------------------------------------- catalogue

// name: [px w, px h, world height (m), drawFn]
const CATALOGUE = [
  ['palm0', 192, 384, 12, drawPalm('p0')],
  ['palm1', 192, 384, 13.5, drawPalm('p1')],
  ['palm2', 192, 384, 11, drawPalm('p2')],
  ['betel0', 96, 384, 13, drawBetel('b0')],
  ['betel1', 96, 384, 11.5, drawBetel('b1')],
  ['krishnachura0', 384, 288, 10, drawFlameTree('k0', ['#e4252b', '#ff4a1c', '#f5651f', '#c8102e', '#ff7a2e'])],
  ['krishnachura1', 384, 288, 11, drawFlameTree('k1', ['#ff3a1c', '#e4252b', '#ff6a2e', '#d61e1e'])],
  ['radhachura0', 384, 288, 9, drawFlameTree('r0', ['#ffd000', '#ffb000', '#ffe14a', '#f2a900'])],
  ['mango0', 320, 320, 11, drawBigTree('m0', 'mango')],
  ['mango1', 320, 320, 9, drawBigTree('m1', 'mango')],
  ['banyan0', 384, 320, 13, drawBigTree('bn0', 'banyan')],
  ['banana0', 192, 224, 4.5, drawBanana('ba0')],
  ['bamboo0', 224, 384, 12, drawBamboo('bb0')],
  ['kash0', 192, 160, 2.6, drawKash('ka0')],
  ['kash1', 192, 160, 2.2, drawKash('ka1')],
  ['bush0', 160, 112, 1.6, drawBush('bu0')],
  ['bougain0', 160, 112, 1.8, drawBush('bg0', ['#ff2e88', '#e0177a', '#ff5aa8', '#c8106a'])],
  ['p_lungi', 48, 128, 1.68, drawPerson('pl', 'lungi')],
  ['p_shirt', 48, 128, 1.72, drawPerson('ps', 'shirt')],
  ['p_saree', 48, 128, 1.58, drawPerson('psa', 'saree')],
  ['p_kameez', 48, 128, 1.6, drawPerson('pk', 'kameez')],
  ['p_panjabi', 48, 128, 1.7, drawPerson('pp', 'panjabi')],
  ['p_vendor', 48, 144, 1.95, drawPerson('pv', 'vendor')],
  ['crowd0', 256, 128, 1.75, drawCrowd('c0', 9)],
  ['crowd1', 256, 128, 1.75, drawCrowd('c1', 7)],
  ['crowd2', 256, 128, 1.75, drawCrowd('c2', 11)],
  ['police', 64, 144, 1.9, drawPolice],
  ['teastall', 256, 224, 3.2, drawTeaStall],
  ['fuchka', 224, 192, 2.4, drawFuchka],
  ['flowerstall', 256, 192, 2.6, drawFlowerStall],
  ['bookstall', 224, 192, 2.6, drawBookStall],
  ['sareeshop', 256, 224, 3.2, drawSareeShop],
  ['fruitvan', 224, 160, 1.9, drawFruitVan],
  ['cow0', 160, 112, 1.5, drawCow('cw0', '#e8e0d0')],
  ['cow1', 160, 112, 1.45, drawCow('cw1', '#7a4a2a')],
  ['dog', 96, 64, 0.6, drawDog],
  ['mask_owl', 224, 256, 4.5, drawOwlMask],
  ['mask_tiger', 256, 256, 4.2, drawTigerMask],
  ['mask_fish', 320, 160, 3.0, drawFishMask],
  ['mask_horse', 224, 256, 4.0, drawHorseMask],
  ['kite0', 48, 72, 1, drawKite('#e4252b', '#ffb000')],
  ['kite1', 48, 72, 1, drawKite('#1d5fa8', '#ffffff')],
  ['kite2', 48, 72, 1, drawKite('#1fae4b', '#ff2e88')],
  ['kite3', 48, 72, 1, drawKite('#7b2f9e', '#ffe14a')],
  ['flag', 96, 144, 3.2, drawFlag],
  ['stars', 64, 48, 0.8, drawStars],
  ['kiln', 96, 384, 28, drawKiln],
];

export function buildSpriteAtlas() {
  const A = new Atlas(2048, { emissive: true, emissiveScale: 0.5, alpha: true });
  A.pad = 3;
  const info = {};
  for (const [name, w, h, worldH, fn] of CATALOGUE) {
    A.add(name, w, h, fn, { wrap: false });
    info[name] = { region: A.get(name), worldH, aspect: w / h };
  }
  A.info = info;
  return A;
}

// ---------------------------------------------------------------- instanced sprite batches

const quadGeo = (() => {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
})();

export function makeSpriteMaterial(atlas, shared) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: atlas.map },
      uEmap: { value: atlas.emap },
      uCamRight: shared.uCamRight,
      uLight: shared.uSpriteLight,
      uLampAdd: shared.uLampAdd,
      uGlow: shared.uGlow,
      uFogColor: shared.uFogColor,
      uFogDensity: shared.uFogDensity,
      uTime: shared.uTime,
      uWind: shared.uWind,
    },
    vertexShader: /* glsl */ `
      attribute vec4 iPos;
      attribute vec2 iSize;
      attribute vec4 iRegion;
      attribute vec4 iTint;
      uniform vec3 uCamRight;
      uniform float uTime;
      uniform float uWind;
      varying vec2 vUv;
      varying vec4 vTint;
      varying float vFog;
      varying float vH;
      varying float vLamp;
      void main() {
        vec3 right = uCamRight * (iSize.x < 0.0 ? -1.0 : 1.0);
        float sway = position.y * position.y * sin(uTime * 1.3 + iPos.x * 0.3 + iPos.z * 0.2) * 0.05 * uWind * abs(iSize.y) * 0.1;
        vec3 wp = iPos.xyz + right * position.x * abs(iSize.x) + vec3(0.0, position.y * iSize.y, 0.0) + uCamRight * sway;
        vUv = iRegion.xy + uv * iRegion.zw;
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        vFog = -mv.z;
        vTint = iTint;
        vH = position.y;
        vLamp = iPos.w;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform sampler2D uEmap;
      uniform vec3 uLight;
      uniform vec3 uLampAdd;
      uniform float uGlow;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      varying vec2 vUv;
      varying vec4 vTint;
      varying float vFog;
      varying float vH;
      varying float vLamp;
      void main() {
        vec4 c = texture2D(uMap, vUv);
        if (c.a < 0.5) discard;
        vec3 base = c.rgb * vTint.rgb;
        vec3 col = base * (uLight * mix(0.72, 1.06, vH) + uLampAdd * vLamp * (1.0 - vH * 0.5));
        col += texture2D(uEmap, vUv).rgb * uGlow * vTint.a * 1.1;
        float f = 1.0 - exp(-uFogDensity * uFogDensity * vFog * vFog);
        gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
}

export class SpriteBatch {
  constructor(atlas) {
    this.atlas = atlas;
    this.pos = [];
    this.size = [];
    this.reg = [];
    this.tint = [];
    this.n = 0;
    this.min = [Infinity, Infinity, Infinity];
    this.max = [-Infinity, -Infinity, -Infinity];
  }
  // add sprite by name at world pos (bottom centre). scale multiplies world height.
  add(name, x, y, z, scale = 1, opts = {}) {
    const inf = this.atlas.info[name];
    if (!inf) return;
    const h = inf.worldH * scale;
    const w = h * inf.aspect * (opts.flip ? -1 : 1);
    this.pos.push(x, y, z, opts.lamp ?? 0);
    this.size.push(w, h);
    this.reg.push(...inf.region);
    const t = opts.tint || [1, 1, 1];
    this.tint.push(t[0], t[1], t[2], opts.glow ?? 1);
    this.n++;
    this.min[0] = Math.min(this.min[0], x - w); this.max[0] = Math.max(this.max[0], x + w);
    this.min[1] = Math.min(this.min[1], y); this.max[1] = Math.max(this.max[1], y + h);
    this.min[2] = Math.min(this.min[2], z - w); this.max[2] = Math.max(this.max[2], z + w);
  }
  build(material) {
    if (!this.n) return null;
    const g = new THREE.InstancedBufferGeometry();
    g.index = quadGeo.index;
    g.setAttribute('position', quadGeo.getAttribute('position'));
    g.setAttribute('uv', quadGeo.getAttribute('uv'));
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(this.pos), 4));
    g.setAttribute('iSize', new THREE.InstancedBufferAttribute(new Float32Array(this.size), 2));
    g.setAttribute('iRegion', new THREE.InstancedBufferAttribute(new Float32Array(this.reg), 4));
    g.setAttribute('iTint', new THREE.InstancedBufferAttribute(new Float32Array(this.tint), 4));
    g.instanceCount = this.n;
    const c = new THREE.Vector3((this.min[0] + this.max[0]) / 2, (this.min[1] + this.max[1]) / 2, (this.min[2] + this.max[2]) / 2);
    const r = Math.hypot(this.max[0] - this.min[0], this.max[1] - this.min[1], this.max[2] - this.min[2]) / 2 + 2;
    g.boundingSphere = new THREE.Sphere(c, r);
    const m = new THREE.Mesh(g, material);
    m.frustumCulled = true;
    return m;
  }
}
