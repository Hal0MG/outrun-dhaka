// The top-down map of Dhaka: rivers, lakes, the Run's route and a stop for
// every district. Painted onto a 2D canvas for the race picker and, small,
// for the Run's HUD. Positions come from MAP_POS (0..1 of the map).

import { ROUTE, STAGES, MAP_POS } from '../world/stages.js';

// the Run's start badge sits in the open ground west of Dhanmondi
export const RUN_POS = [0.13, 0.62];

const INK = '#1a0f08';
const RIVERS = [
  // Buriganga, round the south-west of the old city
  [[0.02, 0.52], [0.12, 0.62], [0.22, 0.78], [0.36, 0.86], [0.52, 0.87], [0.66, 0.84], [0.8, 0.86], [1.0, 0.9]],
  // Turag, down the west
  [[0.2, 0.0], [0.2, 0.12], [0.15, 0.26], [0.16, 0.4], [0.08, 0.5], [0.02, 0.52]],
  // Balu, the east
  [[0.74, 0.0], [0.76, 0.18], [0.74, 0.36], [0.78, 0.55], [0.76, 0.72], [0.8, 0.86]],
  // Shitalakshya, far east
  [[0.97, 0.05], [0.95, 0.35], [0.96, 0.62], [0.93, 0.9]],
  // the Padma, off the bottom of the map
  [[0.0, 0.99], [0.25, 0.97], [0.5, 1.0]],
];
const LAKES = [
  [0.32, 0.48, 0.03, 0.012, -0.5], // Dhanmondi
  [0.57, 0.43, 0.06, 0.01, 0.15], // Hatirjheel
  [0.63, 0.24, 0.012, 0.05, 0.3], // Gulshan
  [0.4, 0.35, 0.025, 0.01, 0], // Crescent lake
];

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

// opts: { sel: district id | 'run', best: {id: pos}, reached: route index on the Run, labels, small }
export function drawDhaka(cv, opts = {}) {
  const c = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const small = !!opts.small;
  c.clearRect(0, 0, W, H);
  // paper and a faint street grid
  c.fillStyle = small ? 'rgba(243,223,178,0.9)' : '#f3dfb2';
  c.fillRect(0, 0, W, H);
  if (!small) {
    c.strokeStyle = 'rgba(26,15,8,0.06)';
    c.lineWidth = 1;
    for (let x = 0; x < W; x += 24) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + H * 0.15, H); c.stroke(); }
    for (let y = 0; y < H; y += 24) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y - W * 0.05); c.stroke(); }
  }
  // water
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const r of RIVERS) {
    curve(c, r, W, H);
    c.strokeStyle = '#1a0f08';
    c.lineWidth = small ? 7 : 26;
    c.stroke();
    c.strokeStyle = '#4fb3c8';
    c.lineWidth = small ? 4 : 20;
    c.stroke();
  }
  for (const [x, y, rx, ry, rot] of LAKES) {
    c.beginPath();
    c.ellipse(x * W, y * H, rx * W, ry * W * 1.4, rot, 0, Math.PI * 2);
    c.fillStyle = '#4fb3c8';
    c.fill();
    c.lineWidth = small ? 1 : 2.5;
    c.strokeStyle = INK;
    c.stroke();
  }
  // the Run's route, district to district
  const P = (id) => [MAP_POS[id][0] * W, MAP_POS[id][1] * H];
  const reached = opts.reached ?? -1;
  c.setLineDash(small ? [] : [14, 10]);
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const [x, y] = P(ROUTE[i]), [x2, y2] = P(ROUTE[i + 1]);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2);
    c.strokeStyle = i < reached ? '#e4252b' : opts.sel === 'run' ? '#ffb000' : 'rgba(26,15,8,0.35)';
    c.lineWidth = small ? (i < reached ? 3 : 1.5) : opts.sel === 'run' ? 6 : 3;
    c.stroke();
  }
  c.setLineDash([]);
  // district stops
  const r = small ? 4 : 13;
  ROUTE.forEach((id, i) => {
    const [x, y] = P(id);
    const sel = opts.sel === id;
    const here = i === reached;
    c.beginPath();
    c.arc(x, y, sel ? r * 1.45 : r, 0, Math.PI * 2);
    c.fillStyle = here ? '#e4252b' : sel ? '#ffe14a' : i < reached ? '#19a84a' : '#fff1d2';
    c.fill();
    c.lineWidth = small ? 1.5 : sel ? 5 : 3;
    c.strokeStyle = INK;
    c.stroke();
    const best = opts.best?.[id];
    if (best && !small) {
      c.fillStyle = best === 1 ? '#ffb000' : best <= 3 ? '#c0c4cc' : '#19a84a';
      c.beginPath(); c.arc(x + r * 0.95, y - r * 0.95, 8, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = INK; c.font = '400 10px "Bungee", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(best), x + r * 0.95, y - r * 0.95 + 1);
    }
    if (opts.labels) {
      c.font = `400 ${sel ? 17 : 14}px "Bungee", sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'top';
      c.lineWidth = 5;
      c.strokeStyle = '#f3dfb2';
      const label = STAGES[id].short || STAGES[id].name.toUpperCase();
      c.strokeText(label, x, y + r + 6);
      c.fillStyle = sel ? '#e4252b' : INK;
      c.fillText(label, x, y + r + 6);
    }
  });
  // the Run's start badge
  if (!small) {
    const [x, y] = [RUN_POS[0] * W, RUN_POS[1] * H];
    const sel = opts.sel === 'run';
    c.save();
    c.translate(x, y);
    c.rotate(-0.06);
    c.fillStyle = sel ? '#e4252b' : '#fff1d2';
    c.fillRect(-82, -26, 164, 52);
    c.lineWidth = sel ? 5 : 3;
    c.strokeStyle = INK;
    c.strokeRect(-82, -26, 164, 52);
    c.fillStyle = sel ? '#fff1d2' : INK;
    c.font = '400 22px "Bungee", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('THE RUN', 0, 1);
    c.restore();
    const [dx, dy] = P(ROUTE[0]);
    c.beginPath(); c.moveTo(x + 82, y); c.lineTo(dx - r, dy);
    c.strokeStyle = sel ? '#e4252b' : 'rgba(26,15,8,0.35)'; c.lineWidth = 3; c.stroke();
  }
}

// nearest stop from `from` in a direction ([dx, dy]); stops are districts plus 'run'
export function stepOnMap(from, dx, dy) {
  const pos = (id) => (id === 'run' ? RUN_POS : MAP_POS[id]);
  const [x0, y0] = pos(from);
  let best = null, bestScore = Infinity;
  for (const id of ['run', ...ROUTE]) {
    if (id === from) continue;
    const [x, y] = pos(id);
    const vx = x - x0, vy = (y - y0) * 0.75;
    const along = vx * dx + vy * dy;
    if (along <= 0.01) continue;
    const across = Math.abs(vx * dy - vy * dx);
    const score = along + across * 2.2;
    if (score < bestScore) { bestScore = score; best = id; }
  }
  return best || from;
}

// which stop is under a click (canvas pixels)
export function hitOnMap(cv, px, py) {
  const W = cv.width, H = cv.height;
  if (Math.abs(px - RUN_POS[0] * W) < 84 && Math.abs(py - RUN_POS[1] * H) < 28) return 'run';
  let best = null, bd = 34;
  for (const id of ROUTE) {
    const d = Math.hypot(px - MAP_POS[id][0] * W, py - MAP_POS[id][1] * H);
    if (d < bd) { bd = d; best = id; }
  }
  return best;
}
