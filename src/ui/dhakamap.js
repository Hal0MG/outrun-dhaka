// The map of Dhaka from above, at night: the city as a field of warm lights with a river cutting through it, the main
// roads glowing between districts, and a bright pin for every district. It is stylised, not accurate. Painted onto a
// 2D canvas for the race picker and, small, for the Run's HUD. Positions come from MAP_POS (0..1 of the map).
// In the picker a circuit shows bare pins (the list beside it does the choosing); the Run shows its one route,
// numbered, with the knockout gates marked.

import { ROUTE, STAGES, MAP_POS, KNOCKOUTS } from '../world/stages.js';

const INK = '#1a0f08';
const PAPER = '#fff1d2';
const MEDAL = ['', '#ffb000', '#d6dae2', '#d9955a'];
// a few broad rivers, only for shape: the lights stop at the water
const RIVERS = [
  [[0.0, 0.5], [0.12, 0.64], [0.24, 0.8], [0.4, 0.88], [0.56, 0.88], [0.7, 0.85], [0.84, 0.88], [1.0, 0.92]],
  [[0.18, 0.0], [0.2, 0.14], [0.14, 0.28], [0.15, 0.42], [0.06, 0.52]],
  [[0.74, 0.0], [0.76, 0.2], [0.73, 0.38], [0.78, 0.56], [0.76, 0.74], [0.8, 0.88]],
];
// which side of its pin each label goes, chosen so neighbours never sit on each other
const LABEL = {
  mirpur: 'l', airport: 'r', gulshan: 'r', purbachal: 'b', savar: 'r', manikmia: 'l', kawranBazar: 't', hatirjheel: 'r',
  dhanmondi: 'l', shahbag: 'b', motijheel: 'r', oldDhaka: 'l', sadarghat: 'l', highway: 'l', padma: 'r',
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// a small deterministic random stream, so the city looks the same every time
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function curve(c, pts, W, H) {
  c.beginPath();
  c.moveTo(pts[0][0] * W, pts[0][1] * H);
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [nx, ny] = pts[i + 1];
    c.quadraticCurveTo(x * W, y * H, ((x + nx) / 2) * W, ((y + ny) / 2) * H);
  }
  const l = pts[pts.length - 1];
  c.lineTo(l[0] * W, l[1] * H);
}

// the main roads: each district joined to its two nearest neighbours by a gently bent road
function roads() {
  const seen = new Set(), out = [];
  for (const a of ROUTE) {
    const near = ROUTE.filter((b) => b !== a)
      .map((b) => [b, Math.hypot(MAP_POS[a][0] - MAP_POS[b][0], (MAP_POS[a][1] - MAP_POS[b][1]) * 0.75)])
      .sort((p, q) => p[1] - q[1]).slice(0, 2);
    for (const [b] of near) {
      const key = [a, b].sort().join('|');
      if (!seen.has(key)) { seen.add(key); out.push([a, b]); }
    }
  }
  return out;
}
const ROADS = roads();

// opts: { sel: district id | 'run', best: {id: medal}, reached: route index on the Run (small map), labels,
//         small, u: canvas pixels per CSS pixel (the picker draws at the size it is shown) }
export function drawDhaka(cv, opts = {}) {
  const c = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const small = !!opts.small;
  const u = small ? 1 : (opts.u || 1);
  // k: pixels for a thing that is "one unit" on a ~760px map, shrinking gently on phones
  const k = small ? 1 : u * clamp(W / u / 760, 0.7, 1.15);
  const run = opts.sel === 'run';
  const P = (id) => [MAP_POS[id][0] * W, MAP_POS[id][1] * H];
  const pins = ROUTE.map(P);
  c.clearRect(0, 0, W, H);
  c.lineCap = 'round';
  c.lineJoin = 'round';

  // night ground
  const bg = c.createRadialGradient(W * 0.5, H * 0.45, W * 0.05, W * 0.5, H * 0.5, W * 0.75);
  bg.addColorStop(0, '#1d1740');
  bg.addColorStop(1, '#0a0820');
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);

  // the city as a field of lit windows on a slightly tilted street grid, thickest around the districts
  {
    const r = rng(20240611);
    const step = small ? 4.5 : 7 * k;
    const sig = W * 0.13;
    const cosA = Math.cos(-0.2), sinA = Math.sin(-0.2);
    c.save();
    c.translate(W / 2, H / 2);
    c.rotate(-0.2);
    c.translate(-W / 2, -H / 2);
    const ext = Math.max(W, H) * 0.2;
    for (let y = -ext; y < H + ext; y += step) {
      for (let x = -ext; x < W + ext; x += step) {
        // where this lattice point lands on screen, for the density
        const dx = x - W / 2, dy = y - H / 2;
        const sx = W / 2 + dx * cosA - dy * sinA, sy = H / 2 + dx * sinA + dy * cosA;
        // a low base everywhere, rising and falling in broad patches so no part of the map is left empty, and the districts on top
        let d = 0.2 + 0.13 * Math.sin(sx / W * 9 + 1.3) * Math.sin(sy / H * 7 + 0.4);
        for (const [px, py] of pins) { const ex = sx - px, ey = sy - py; d += Math.exp(-(ex * ex + ey * ey) / (2 * sig * sig)); }
        if (r() > d * 0.8) continue;
        const a = 0.15 + r() * 0.5;
        const t = r();
        c.fillStyle = t < 0.8 ? `rgba(255,200,120,${a})` : `rgba(255,236,200,${a})`;
        const s = step * (0.2 + r() * 0.22);
        c.fillRect(x + r() * step * 0.4, y + r() * step * 0.4, s, s);
      }
    }
    c.restore();
  }

  // a faint street grid over the whole city, so the quiet parts still read as streets
  if (!small) {
    c.save();
    c.translate(W / 2, H / 2);
    c.rotate(-0.2);
    c.strokeStyle = 'rgba(255,200,120,0.06)';
    c.lineWidth = Math.max(1, k);
    const g = 38 * k;
    c.beginPath();
    for (let x = -W; x < W; x += g) { c.moveTo(x, -H); c.lineTo(x, H); }
    for (let y = -H; y < H; y += g * 0.8) { c.moveTo(-W, y); c.lineTo(W, y); }
    c.stroke();
    c.restore();
  }

  // the main roads, glowing between the districts
  if (!small) {
    for (const [a, b] of ROADS) {
      const [x, y] = P(a), [x2, y2] = P(b);
      const mx = (x + x2) / 2, my = (y + y2) / 2, nx = -(y2 - y), ny = x2 - x;
      const bend = 0.12 * (((a.length + b.length) % 2) ? 1 : -1);
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx + nx * bend, my + ny * bend, x2, y2);
      c.strokeStyle = `rgba(255,176,0,${run ? 0.07 : 0.13})`; c.lineWidth = 7 * k; c.stroke();
      c.strokeStyle = `rgba(255,222,160,${run ? 0.25 : 0.5})`; c.lineWidth = 1.4 * k; c.stroke();
    }
  }

  // the rivers: dark water the lights stop at, with a faint glint down the middle
  for (const rv of RIVERS) {
    curve(c, rv, W, H);
    c.strokeStyle = '#080a1c'; c.lineWidth = small ? 7 : 26 * k; c.stroke();
    c.strokeStyle = 'rgba(80,170,210,0.28)'; c.lineWidth = small ? 1.5 : 2.5 * k; c.stroke();
  }

  // vignette
  const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(5,4,16,0)');
  vg.addColorStop(1, 'rgba(5,4,16,0.55)');
  c.fillStyle = vg;
  c.fillRect(0, 0, W, H);

  const reached = opts.reached ?? -1;
  // the Run's route, district to district (the HUD map colours it as you go; the picker draws it once, glowing)
  if (small) {
    for (let i = 0; i < ROUTE.length - 1; i++) {
      const [x, y] = P(ROUTE[i]), [x2, y2] = P(ROUTE[i + 1]);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2);
      c.strokeStyle = i < reached ? '#ff5a52' : 'rgba(255,241,210,0.35)';
      c.lineWidth = i < reached ? 3 : 1.5;
      c.stroke();
    }
  } else if (run) {
    c.beginPath();
    ROUTE.forEach((id, i) => { const [x, y] = P(id); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    c.strokeStyle = 'rgba(255,176,0,0.22)'; c.lineWidth = 12 * k; c.stroke();
    c.strokeStyle = '#ffb000'; c.lineWidth = 3.5 * k; c.stroke();
  }

  // district pins: a glow, a bright core, a ring for the pick and a ring for the best medal
  ROUTE.forEach((id, i) => {
    const [x, y] = pins[i];
    const sel = opts.sel === id;
    const here = i === reached;
    const base = small ? 3.6 : (run ? 12 : 9) * k;
    const r = sel ? base * 1.5 : base;
    const medal = !small && !run ? opts.best?.[id] : 0;
    const ko = run && !small && KNOCKOUTS[id];
    const tint = sel ? '255,225,74' : ko ? '255,110,100' : '255,241,210';
    if (!small) {
      const g = c.createRadialGradient(x, y, r * 0.4, x, y, r * (sel ? 4.6 : 3));
      g.addColorStop(0, `rgba(${tint},${sel ? 0.55 : 0.35})`);
      g.addColorStop(1, `rgba(${tint},0)`);
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, r * (sel ? 4.6 : 3), 0, Math.PI * 2); c.fill();
    }
    if (sel && !small) {
      c.beginPath(); c.arc(x, y, r + 8 * k, 0, Math.PI * 2);
      c.strokeStyle = '#ffe14a'; c.lineWidth = 2.5 * k; c.stroke();
    }
    if (medal) {
      c.beginPath(); c.arc(x, y, r + 5.5 * k, 0, Math.PI * 2);
      c.fillStyle = MEDAL[medal]; c.fill();
      c.lineWidth = 1.5 * k; c.strokeStyle = INK; c.stroke();
    }
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = here ? '#ff3b32' : sel ? '#ffe14a' : small && i < reached ? '#19c25a' : ko ? '#ff8a80' : PAPER;
    c.fill();
    c.lineWidth = small ? 1 : (sel ? 3.5 : 2.5) * k;
    c.strokeStyle = INK;
    c.stroke();
    if (run && !small) {
      c.fillStyle = INK;
      c.font = `400 ${11 * k}px "Bungee", sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(i + 1), x, y + 0.5 * k);
    }
    if (opts.labels && !small && (sel || W / u > 540)) {
      const dir = LABEL[id] || 'r';
      const label = STAGES[id].short || STAGES[id].name.toUpperCase();
      const fs = (sel ? 15 : 12) * k;
      const gap = r + 8 * k;
      c.font = `400 ${fs}px "Bungee", sans-serif`;
      c.textAlign = dir === 'r' ? 'left' : dir === 'l' ? 'right' : 'center';
      c.textBaseline = dir === 't' ? 'bottom' : dir === 'b' ? 'top' : 'middle';
      const lx = dir === 'r' ? x + gap : dir === 'l' ? x - gap : x;
      const ly = dir === 't' ? y - gap : dir === 'b' ? y + gap : y;
      c.lineWidth = 4.5 * k;
      c.strokeStyle = 'rgba(8,6,24,0.9)';
      c.strokeText(label, lx, ly);
      c.fillStyle = sel ? '#ffe14a' : PAPER;
      c.fillText(label, lx, ly);
      if (ko) {
        // the knockout cut-off, as a red tag beside the name
        const tag = `TOP ${KNOCKOUTS[id]}`;
        const th = 15 * k;
        const ty = dir === 't' ? ly - fs - th / 2 - 2 * k : dir === 'b' ? ly + fs + th / 2 + 2 * k : ly + fs / 2 + th / 2 + 2 * k;
        c.font = `400 ${10.5 * k}px "Bungee", sans-serif`;
        const tw = c.measureText(tag).width + 10 * k;
        const tx = dir === 'r' ? lx : dir === 'l' ? lx - tw : lx - tw / 2;
        c.fillStyle = '#e4252b';
        c.fillRect(tx, ty - th / 2, tw, th);
        c.lineWidth = 2 * k; c.strokeStyle = INK;
        c.strokeRect(tx, ty - th / 2, tw, th);
        c.fillStyle = PAPER;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(tag, tx + tw / 2, ty + 0.5 * k);
      }
    }
  });
}

// which district pin is under a point (canvas pixels); u is canvas pixels per CSS pixel. Generous for thumbs.
export function hitOnMap(cv, px, py, u = 1) {
  const W = cv.width, H = cv.height;
  let best = null, bd = 26 * u;
  for (const id of ROUTE) {
    const d = Math.hypot(px - MAP_POS[id][0] * W, py - MAP_POS[id][1] * H);
    if (d < bd) { bd = d; best = id; }
  }
  return best;
}
