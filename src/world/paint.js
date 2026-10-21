// Canvas painting toolkit. All textures in the game are painted at boot with
// these helpers: grimy concrete, rickshaw-art flowers, hand lettering, etc.

export const FONT_BN = '"Galada", "Hind Siliguri", "Nirmala UI", "Vrinda", sans-serif';
export const FONT_BN_SANS = '"Hind Siliguri", "Nirmala UI", "Vrinda", sans-serif';
export const FONT_BN_SERIF = '"Tiro Bangla", "Hind Siliguri", "Nirmala UI", serif';
export const FONT_SIGN = '"Bungee", "Impact", "Arial Black", sans-serif';

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function rgbToHex(r, g, b) {
  const c = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
}
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// Fill with blotchy noise to break up flat colours
export function noiseFill(ctx, x, y, w, h, base, rng, amt = 0.08, cell = 3) {
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  for (let yy = 0; yy < h; yy += cell) {
    for (let xx = 0; xx < w; xx += cell) {
      const v = (rng.next() - 0.5) * amt;
      ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
      ctx.fillRect(x + xx, y + yy, cell, cell);
    }
  }
}

// soft large blotches (water damage, sun fade)
export function blotches(ctx, x, y, w, h, rng, n = 10, color = 'rgba(0,0,0,0.08)', rmin = 10, rmax = 50) {
  ctx.save();
  for (let i = 0; i < n; i++) {
    const cx = x + rng.next() * w, cy = y + rng.next() * h, r = rng.range(rmin, rmax);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();
}

// monsoon stains: dark streaks running down from ledges
export function streaks(ctx, x, y, w, h, rng, n = 20, alpha = 0.18) {
  ctx.save();
  for (let i = 0; i < n; i++) {
    const sx = x + rng.next() * w;
    const sy = y + rng.next() * h * 0.8;
    const len = rng.range(10, h * 0.5);
    const sw = rng.range(1, 5);
    const g = ctx.createLinearGradient(0, sy, 0, sy + len);
    g.addColorStop(0, `rgba(20,18,15,${alpha})`);
    g.addColorStop(1, 'rgba(20,18,15,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sx, sy, sw, len);
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// A rickshaw-art flower: layered petals with white highlight strokes
export function flower(ctx, x, y, r, petals = 8, cols = ['#e4252b', '#ffb000', '#ffffff'], rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  // outer petals
  for (let layer = 0; layer < 2; layer++) {
    const rr = layer === 0 ? r : r * 0.62;
    ctx.fillStyle = cols[layer % cols.length];
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2 + layer * (Math.PI / petals);
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(rr * 0.35, -rr * 0.25, rr * 0.9, -rr * 0.3, rr, 0);
      ctx.bezierCurveTo(rr * 0.9, rr * 0.3, rr * 0.35, rr * 0.25, 0, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = Math.max(0.6, r * 0.05);
      ctx.stroke();
      // highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = Math.max(0.5, r * 0.04);
      ctx.beginPath();
      ctx.moveTo(rr * 0.25, -rr * 0.05);
      ctx.quadraticCurveTo(rr * 0.6, -rr * 0.15, rr * 0.85, -rr * 0.05);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.fillStyle = cols[2] || '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.1, Math.sin(a) * r * 0.1, r * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function leaf(ctx, x, y, len, ang, col = '#1fae4b') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = Math.max(0.5, len * 0.04);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.moveTo(len * 0.1, 0);
  ctx.lineTo(len * 0.85, 0);
  ctx.stroke();
  ctx.restore();
}

// scalloped / dotted border used on rickshaw plates and UI frames
export function scallopBorder(ctx, x, y, w, h, col = '#ffb000', dot = '#e4252b', size = 8) {
  ctx.save();
  ctx.fillStyle = col;
  const n = Math.floor(w / (size * 1.6));
  for (let i = 0; i <= n; i++) {
    const px = x + (i / n) * w;
    ctx.beginPath(); ctx.arc(px, y, size / 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px, y + h, size / 2, 0, Math.PI * 2); ctx.fill();
  }
  const m = Math.floor(h / (size * 1.6));
  for (let i = 0; i <= m; i++) {
    const py = y + (i / m) * h;
    ctx.beginPath(); ctx.arc(x, py, size / 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + w, py, size / 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = dot;
  for (let i = 0; i < n; i++) {
    const px = x + ((i + 0.5) / n) * w;
    ctx.beginPath(); ctx.arc(px, y, size / 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px, y + h, size / 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// Hand-painted sign lettering: fill + thick outline + drop shadow
export function signText(ctx, text, x, y, opts = {}) {
  const {
    font = `700 40px ${FONT_BN}`,
    fill = '#fff',
    stroke = '#000',
    lw = 4,
    shadow = null,
    shadowOff = 3,
    align = 'center',
    baseline = 'middle',
    maxW = 0,
    inner = null,
  } = opts;
  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.lineJoin = 'round';
  let sx = 1;
  if (maxW) {
    const m = ctx.measureText(text).width;
    if (m > maxW) sx = maxW / m;
  }
  ctx.translate(x, y);
  ctx.scale(sx, 1);
  if (shadow) {
    ctx.fillStyle = shadow;
    ctx.strokeStyle = shadow;
    ctx.lineWidth = lw;
    if (lw) ctx.strokeText(text, shadowOff, shadowOff);
    ctx.fillText(text, shadowOff, shadowOff);
  }
  if (lw && stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.strokeText(text, 0, 0);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  if (inner) {
    ctx.strokeStyle = inner;
    ctx.lineWidth = Math.max(1, lw * 0.25);
    ctx.strokeText(text, 0, 0);
  }
  ctx.restore();
}

export function linGrad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

// Draws a stylised painted face (for Dhallywood movie posters)
export function posterFace(ctx, cx, cy, s, rng, opts = {}) {
  const skin = opts.skin || rng.pick(['#e0a476', '#c98a5e', '#d79a6b', '#b97a50']);
  const hair = opts.hair || '#15110f';
  const angry = opts.angry ?? rng.chance(0.6);
  const female = opts.female ?? false;
  ctx.save();
  ctx.translate(cx, cy);
  // hair back
  ctx.fillStyle = hair;
  ctx.beginPath();
  if (female) {
    ctx.ellipse(0, s * 0.05, s * 0.62, s * 0.85, 0, 0, Math.PI * 2);
  } else {
    ctx.ellipse(0, -s * 0.18, s * 0.52, s * 0.5, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  // neck
  ctx.fillStyle = shade(skin, -0.15);
  ctx.fillRect(-s * 0.18, s * 0.35, s * 0.36, s * 0.4);
  // face
  const fg = ctx.createRadialGradient(-s * 0.15, -s * 0.15, s * 0.05, 0, 0, s * 0.6);
  fg.addColorStop(0, shade(skin, 0.25));
  fg.addColorStop(1, shade(skin, -0.2));
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.4, s * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,20,10,0.6)';
  ctx.lineWidth = s * 0.02;
  ctx.stroke();
  // hair front
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.moveTo(-s * 0.42, -s * 0.1);
  ctx.quadraticCurveTo(-s * 0.3, -s * 0.62, s * 0.1, -s * 0.58);
  ctx.quadraticCurveTo(s * 0.48, -s * 0.5, s * 0.42, -s * 0.05);
  ctx.quadraticCurveTo(s * 0.2, -s * 0.38, -s * 0.1, -s * 0.32);
  ctx.quadraticCurveTo(-s * 0.3, -s * 0.3, -s * 0.42, -s * 0.1);
  ctx.fill();
  // brows
  ctx.strokeStyle = hair;
  ctx.lineWidth = s * 0.055;
  ctx.lineCap = 'round';
  const bt = angry ? 0.09 : -0.02;
  ctx.beginPath(); ctx.moveTo(-s * 0.28, -s * 0.17 - bt * s * 0.5); ctx.lineTo(-s * 0.07, -s * 0.13 + bt * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s * 0.28, -s * 0.17 - bt * s * 0.5); ctx.lineTo(s * 0.07, -s * 0.13 + bt * s); ctx.stroke();
  // eyes
  for (const ex of [-0.17, 0.17]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(ex * s, -s * 0.05, s * 0.08, s * 0.045, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b1a10';
    ctx.beginPath(); ctx.arc(ex * s + (opts.look || 0) * s * 0.03, -s * 0.05, s * 0.035, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1a0d08';
    ctx.lineWidth = s * 0.018;
    ctx.beginPath(); ctx.ellipse(ex * s, -s * 0.05, s * 0.08, s * 0.045, 0, Math.PI, Math.PI * 2); ctx.stroke();
  }
  // nose
  ctx.strokeStyle = 'rgba(80,30,10,0.7)';
  ctx.lineWidth = s * 0.02;
  ctx.beginPath(); ctx.moveTo(0, -s * 0.02); ctx.lineTo(-s * 0.04, s * 0.12); ctx.lineTo(s * 0.03, s * 0.14); ctx.stroke();
  // mustache (heroes always have one)
  if (!female && (opts.mustache ?? true)) {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.moveTo(-s * 0.16, s * 0.24);
    ctx.quadraticCurveTo(0, s * 0.14, s * 0.16, s * 0.24);
    ctx.quadraticCurveTo(0, s * 0.2, -s * 0.16, s * 0.24);
    ctx.fill();
  }
  // mouth
  ctx.strokeStyle = female ? '#b0182a' : '#5a1a10';
  ctx.lineWidth = s * (female ? 0.04 : 0.025);
  ctx.beginPath();
  if (angry) { ctx.moveTo(-s * 0.1, s * 0.31); ctx.lineTo(s * 0.1, s * 0.3); } else {
    ctx.moveTo(-s * 0.1, s * 0.29); ctx.quadraticCurveTo(0, s * 0.36, s * 0.1, s * 0.29);
  }
  ctx.stroke();
  if (female) {
    ctx.fillStyle = '#c4162a';
    ctx.beginPath(); ctx.arc(0, -s * 0.2, s * 0.03, 0, Math.PI * 2); ctx.fill(); // tip
  }
  ctx.restore();
}

// Explosion burst behind posters
export function burst(ctx, cx, cy, r, spikes = 14, c1 = '#ffd23a', c2 = '#ff4d1a') {
  ctx.save();
  ctx.translate(cx, cy);
  const g = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#fff6c0');
  g.addColorStop(0.4, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.55;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
