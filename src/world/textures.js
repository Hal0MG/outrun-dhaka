// Procedural paintings for buildings, shopfronts and general materials.
// Facade regions represent 4 bays x 4 floors (each bay 3m x 3m), so the
// builder tiles them with tile = [12, 12] metres.

import { Atlas, grain } from './atlas.js';
import { RNG } from '../core/util.js';
import * as P from './paint.js';

const WARM = ['#ffcf8a', '#ffd9a0', '#ffc070', '#ffe2b8'];
const COOL = ['#eef6ff', '#dff0ff', '#f6fbff'];
const ODD = ['#9ec9ff', '#ff9ad5', '#b8ffb0', '#ffa86b'];

function litColor(rng) {
  const r = rng.next();
  if (r < 0.5) return rng.pick(WARM);
  if (r < 0.88) return rng.pick(COOL);
  return rng.pick(ODD);
}

function glass(ctx, x, y, w, h, rng, tint = '#2a3a4c') {
  const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  g.addColorStop(0, P.shade(tint, 0.25));
  g.addColorStop(0.5, tint);
  g.addColorStop(1, P.shade(tint, -0.35));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // diagonal sky reflection
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  const o = rng.range(-w, w);
  ctx.beginPath();
  ctx.moveTo(x + o, y + h);
  ctx.lineTo(x + o + w * 0.35, y + h);
  ctx.lineTo(x + o + w * 0.9, y);
  ctx.lineTo(x + o + w * 0.55, y);
  ctx.fill();
  ctx.restore();
}

function grill(ctx, x, y, w, h, col, style = 0) {
  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  if (style === 0) {
    for (let i = 1; i < 6; i++) {
      const xx = x + (w * i) / 6;
      ctx.moveTo(xx, y); ctx.lineTo(xx, y + h);
    }
    ctx.moveTo(x, y + h * 0.5); ctx.lineTo(x + w, y + h * 0.5);
  } else if (style === 1) {
    // diamond lattice
    const n = 4;
    for (let i = -n; i <= n * 2; i++) {
      ctx.moveTo(x + (i * w) / n, y); ctx.lineTo(x + ((i + n) * w) / n, y + h);
      ctx.moveTo(x + ((i + n) * w) / n, y); ctx.lineTo(x + (i * w) / n, y + h);
    }
  } else {
    // vertical bars with sun-burst top
    for (let i = 1; i < 8; i++) {
      const xx = x + (w * i) / 8;
      ctx.moveTo(xx, y + h * 0.3); ctx.lineTo(xx, y + h);
    }
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      ctx.moveTo(x + w / 2, y + h * 0.32);
      ctx.lineTo(x + w / 2 + Math.cos(a) * w * 0.5, y + h * 0.32 + Math.sin(a) * h * 0.3);
    }
  }
  ctx.stroke();
  ctx.strokeRect(x + 0.7, y + 0.7, w - 1.4, h - 1.4);
  ctx.restore();
}

function laundry(ctx, x, y, w, rng) {
  ctx.strokeStyle = 'rgba(30,30,30,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + w / 2, y + 4, x + w, y);
  ctx.stroke();
  let cx = x + 3;
  const cols = ['#d0213b', '#2a62c9', '#f2c230', '#2ea36b', '#f07c2a', '#7a3fb0', '#f4f4f4', '#1f9db4', '#e85d9d'];
  while (cx < x + w - 6) {
    const cw = rng.range(5, 14), ch = rng.range(10, 22);
    const c = rng.pick(cols);
    ctx.fillStyle = c;
    ctx.fillRect(cx, y + 1, cw, ch);
    // checked lungi pattern
    if (rng.chance(0.4)) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let k = 0; k < ch; k += 4) ctx.fillRect(cx, y + 1 + k, cw, 1.5);
      for (let k = 0; k < cw; k += 4) ctx.fillRect(cx + k, y + 1, 1.5, ch);
    }
    cx += cw + rng.range(1, 4);
  }
}

function plant(ctx, x, y, s, rng) {
  ctx.fillStyle = '#8a4a2a';
  ctx.fillRect(x - s * 0.3, y - s * 0.4, s * 0.6, s * 0.4);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = rng.pick(['#2f7d3a', '#3d9a46', '#246b30']);
    ctx.beginPath();
    ctx.arc(x + rng.range(-s * 0.4, s * 0.4), y - s * 0.5 - rng.range(0, s * 0.5), s * rng.range(0.2, 0.35), 0, Math.PI * 2);
    ctx.fill();
  }
}

function acUnit(ctx, x, y, w, h) {
  ctx.fillStyle = '#d9dadb';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#8b8d90';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.beginPath();
  ctx.arc(x + w * 0.38, y + h / 2, h * 0.36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#6d7073';
  ctx.beginPath();
  ctx.arc(x + w * 0.38, y + h / 2, h * 0.1, 0, Math.PI * 2);
  ctx.fill();
  // drip stain
  const g = ctx.createLinearGradient(0, y + h, 0, y + h + 30);
  g.addColorStop(0, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x + w * 0.7, y + h, 3, 30);
}

function emissiveWindow(e, x, y, w, h, rng, grillCol = 'rgba(0,0,0,0.85)', gstyle = 0) {
  if (!e) return;
  const c = litColor(rng);
  const g = e.createRadialGradient(x + w / 2, y + h * 0.4, 2, x + w / 2, y + h / 2, Math.max(w, h) * 0.8);
  g.addColorStop(0, P.shade(c, 0.3));
  g.addColorStop(1, P.shade(c, -0.35));
  e.fillStyle = g;
  e.fillRect(x, y, w, h);
  // curtain
  if (rng.chance(0.6)) {
    e.fillStyle = `rgba(0,0,0,${rng.range(0.25, 0.65)})`;
    const cw = w * rng.range(0.2, 0.5);
    if (rng.chance(0.5)) e.fillRect(x, y, cw, h); else e.fillRect(x + w - cw, y, cw, h);
  }
  // silhouette of a ceiling fan / person occasionally
  if (rng.chance(0.15)) {
    e.fillStyle = 'rgba(0,0,0,0.6)';
    e.beginPath();
    e.arc(x + w * rng.range(0.3, 0.7), y + h * 0.55, h * 0.12, 0, Math.PI * 2);
    e.fill();
    e.fillRect(x + w * 0.4, y + h * 0.66, w * 0.2, h * 0.34);
  }
  grill(e, x, y, w, h, grillCol, gstyle);
}

// ---------------------------------------------------------------- facades

function drawApartment(style) {
  return (ctx, e, w, h) => {
    const rng = new RNG(style.seed || style.name);
    const bays = 4, floors = 4, bw = w / bays, fh = h / floors;
    P.noiseFill(ctx, 0, 0, w, h, style.wall, rng, 0.05, 4);
    grain(ctx, 0, 0, w, h, 0.18);
    P.blotches(ctx, 0, 0, w, h, rng, 16, 'rgba(70,55,40,0.12)', 15, 70);
    for (let f = 0; f < floors; f++) {
      const y0 = f * fh;
      for (let b = 0; b < bays; b++) {
        const x0 = b * bw;
        const type = rng.weighted(style.mix || { win: 5, balcony: 3, ac: 1 });
        if (type === 'balcony') {
          // recessed balcony
          const bx = x0 + bw * 0.08, by = y0 + fh * 0.12, bwid = bw * 0.84, bh = fh * 0.78;
          const g = ctx.createLinearGradient(0, by, 0, by + bh);
          g.addColorStop(0, '#2a2622');
          g.addColorStop(1, '#46403a');
          ctx.fillStyle = g;
          ctx.fillRect(bx, by, bwid, bh);
          // door inside
          ctx.fillStyle = P.shade(style.trim || '#ddd', -0.4);
          ctx.fillRect(bx + bwid * 0.55, by + bh * 0.15, bwid * 0.3, bh * 0.85);
          if (rng.chance(0.7)) laundry(ctx, bx + 2, by + bh * 0.18, bwid - 4, rng);
          if (e && rng.chance(0.45)) {
            const c = litColor(rng);
            const gg = e.createRadialGradient(bx + bwid / 2, by + 6, 2, bx + bwid / 2, by + bh / 2, bwid);
            gg.addColorStop(0, c);
            gg.addColorStop(1, 'rgba(0,0,0,0)');
            e.fillStyle = gg;
            e.fillRect(bx, by, bwid, bh);
            // tube light
            e.fillStyle = '#fff';
            e.fillRect(bx + bwid * 0.3, by + 2, bwid * 0.35, 2);
          }
          // parapet / railing
          const py = by + bh * 0.58;
          if (style.railing === 'solid' || rng.chance(0.4)) {
            ctx.fillStyle = style.trim || P.shade(style.wall, 0.15);
            ctx.fillRect(bx - 2, py, bwid + 4, by + bh - py);
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fillRect(bx - 2, py, bwid + 4, 2);
            if (e && rng.chance(0.15)) {
              e.fillStyle = 'rgba(0,0,0,1)';
              e.fillRect(bx - 2, py, bwid + 4, by + bh - py);
            }
          } else {
            grill(ctx, bx, py, bwid, by + bh - py, style.grill || '#ddd', 0);
            if (e) grill(e, bx, py, bwid, by + bh - py, '#000', 0);
          }
          if (rng.chance(0.5)) plant(ctx, bx + rng.range(8, bwid - 8), py, 12, rng);
          // slab edge
          ctx.fillStyle = P.shade(style.wall, -0.2);
          ctx.fillRect(x0, y0 + fh - 5, bw, 5);
        } else {
          const ww = bw * 0.56, wh = fh * 0.5;
          const wx = x0 + (bw - ww) / 2 + (type === 'ac' ? -bw * 0.1 : 0), wy = y0 + fh * 0.24;
          // frame
          ctx.fillStyle = style.trim || P.shade(style.wall, 0.2);
          ctx.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
          glass(ctx, wx, wy, ww, wh, rng, style.glass || '#2b3846');
          const gs = style.grillStyle ?? rng.int(0, 2);
          grill(ctx, wx, wy, ww, wh, style.grill || '#e2e2da', gs);
          // sunshade slab (kaarnish)
          ctx.fillStyle = P.shade(style.wall, 0.12);
          ctx.fillRect(wx - 10, wy - 12, ww + 20, 6);
          const sh = ctx.createLinearGradient(0, wy - 6, 0, wy + 10);
          sh.addColorStop(0, 'rgba(0,0,0,0.35)');
          sh.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = sh;
          ctx.fillRect(wx - 8, wy - 6, ww + 16, 16);
          if (rng.chance(style.litP ?? 0.5)) emissiveWindow(e, wx, wy, ww, wh, rng, 'rgba(0,0,0,0.85)', gs);
          if (type === 'ac') acUnit(ctx, wx + ww + 8, wy + wh * 0.4, bw * 0.24, bw * 0.17);
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(x0, y0 + fh - 4, bw, 4);
        }
      }
    }
    P.streaks(ctx, 0, 0, w, h, rng, 30, 0.2);
  };
}

function drawTiled(style) {
  return (ctx, e, w, h) => {
    const rng = new RNG(style.name);
    const fh = h / 4, bw = w / 4;
    // tile bands
    for (let y = 0; y < h; y += 6) {
      for (let x = 0; x < w; x += 12) {
        ctx.fillStyle = P.shade(style.wall, rng.range(-0.08, 0.08));
        ctx.fillRect(x, y, 11, 5);
      }
    }
    for (let f = 0; f < 4; f++) {
      const y0 = f * fh;
      ctx.fillStyle = style.tile2;
      ctx.fillRect(0, y0 + fh * 0.12, w, fh * 0.66);
      for (let b = 0; b < 4; b++) {
        const x0 = b * bw;
        const wx = x0 + bw * 0.12, ww = bw * 0.76, wy = y0 + fh * 0.2, wh = fh * 0.5;
        ctx.fillStyle = '#9ea4a8';
        ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
        glass(ctx, wx, wy, ww, wh, rng, '#24525e');
        ctx.fillStyle = '#c9ced1';
        ctx.fillRect(wx + ww / 2 - 1, wy, 2, wh);
        if (rng.chance(0.5)) emissiveWindow(e, wx, wy, ww, wh, rng, 'rgba(0,0,0,0.7)', 0);
        if (rng.chance(0.3)) acUnit(ctx, wx + ww * 0.65, wy + wh + 6, bw * 0.24, bw * 0.15);
      }
    }
    grain(ctx, 0, 0, w, h, 0.12);
    P.streaks(ctx, 0, 0, w, h, rng, 22, 0.16);
  };
}

function drawRaw(style) {
  // unfinished concrete frame with brick infill (very Dhaka)
  return (ctx, e, w, h) => {
    const rng = new RNG(style.name);
    const fh = h / 4, bw = w / 4;
    // brick infill
    for (let y = 0; y < h; y += 6) {
      const off = (y / 6) % 2 ? 6 : 0;
      for (let x = -12; x < w; x += 12) {
        ctx.fillStyle = P.shade('#9c4f36', rng.range(-0.15, 0.1));
        ctx.fillRect(x + off, y, 11, 5);
      }
    }
    ctx.fillStyle = 'rgba(210,200,185,0.6)';
    for (let y = 5; y < h; y += 6) ctx.fillRect(0, y, w, 1);
    // concrete frame
    ctx.fillStyle = style.wall;
    for (let f = 0; f <= 4; f++) ctx.fillRect(0, f * fh - 6, w, 12);
    for (let b = 0; b <= 4; b++) ctx.fillRect(b * bw - 6, 0, 12, h);
    for (let f = 0; f < 4; f++) {
      for (let b = 0; b < 4; b++) {
        if (rng.chance(0.6)) {
          const wx = b * bw + bw * 0.25, wy = f * fh + fh * 0.25, ww = bw * 0.5, wh = fh * 0.45;
          ctx.fillStyle = '#1b1a18';
          ctx.fillRect(wx, wy, ww, wh);
          if (rng.chance(0.3)) emissiveWindow(e, wx, wy, ww, wh, rng, 'rgba(0,0,0,0.4)', 0);
        }
      }
    }
    // bamboo props
    ctx.strokeStyle = '#b89a5a';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const x = rng.range(0, w);
      ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + rng.range(-10, 10), h - rng.range(40, 120)); ctx.stroke();
    }
    grain(ctx, 0, 0, w, h, 0.2);
    P.blotches(ctx, 0, 0, w, h, rng, 12, 'rgba(0,0,0,0.12)', 20, 60);
  };
}

function drawOld(style) {
  return (ctx, e, w, h) => {
    const rng = new RNG(style.name);
    const fh = h / 4, bw = w / 4;
    P.noiseFill(ctx, 0, 0, w, h, style.wall, rng, 0.1, 4);
    grain(ctx, 0, 0, w, h, 0.25);
    P.blotches(ctx, 0, 0, w, h, rng, 26, 'rgba(50,40,25,0.18)', 10, 60);
    // peeling plaster showing brick
    for (let i = 0; i < 8; i++) {
      const x = rng.range(0, w), y = rng.range(0, h), pw = rng.range(10, 40), ph = rng.range(8, 24);
      ctx.fillStyle = '#8f4a33';
      ctx.beginPath();
      ctx.ellipse(x, y, pw / 2, ph / 2, rng.range(0, 3), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(230,210,180,0.5)';
      for (let k = 0; k < ph; k += 4) { ctx.beginPath(); ctx.moveTo(x - pw / 3, y - ph / 2 + k); ctx.lineTo(x + pw / 3, y - ph / 2 + k); ctx.stroke(); }
    }
    for (let f = 0; f < 4; f++) {
      const y0 = f * fh;
      // cornice
      ctx.fillStyle = P.shade(style.wall, 0.15);
      ctx.fillRect(0, y0 + fh - 10, w, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, y0 + fh - 4, w, 4);
      for (let b = 0; b < 4; b++) {
        const x0 = b * bw;
        const ww = bw * 0.48, wh = fh * 0.58, wx = x0 + (bw - ww) / 2, wy = y0 + fh * 0.2;
        // arch frame
        ctx.fillStyle = P.shade(style.wall, 0.22);
        ctx.beginPath();
        ctx.moveTo(wx - 5, wy + wh + 2);
        ctx.lineTo(wx - 5, wy + ww * 0.3);
        ctx.arc(wx + ww / 2, wy + ww * 0.3, ww / 2 + 5, Math.PI, 0);
        ctx.lineTo(wx + ww + 5, wy + wh + 2);
        ctx.fill();
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(wx, wy + wh);
        ctx.lineTo(wx, wy + ww * 0.3);
        ctx.arc(wx + ww / 2, wy + ww * 0.3, ww / 2, Math.PI, 0);
        ctx.lineTo(wx + ww, wy + wh);
        ctx.closePath();
        ctx.clip();
        const open = rng.chance(0.5);
        if (open) {
          ctx.fillStyle = '#1e1a16';
          ctx.fillRect(wx, wy - 10, ww, wh + 10);
        }
        // shutters (louvres)
        ctx.fillStyle = style.shutter;
        const sw = open ? ww * 0.22 : ww / 2;
        ctx.fillRect(wx, wy - 10, sw, wh + 10);
        ctx.fillRect(wx + ww - sw, wy - 10, sw, wh + 10);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let k = wy; k < wy + wh; k += 4) {
          ctx.fillRect(wx, k, sw, 1.5);
          ctx.fillRect(wx + ww - sw, k, sw, 1.5);
        }
        ctx.restore();
        if (open && e && rng.chance(0.6)) {
          e.fillStyle = rng.pick(WARM);
          e.beginPath();
          e.moveTo(wx + sw, wy + wh);
          e.lineTo(wx + sw, wy + ww * 0.3);
          e.lineTo(wx + ww - sw, wy + ww * 0.3);
          e.lineTo(wx + ww - sw, wy + wh);
          e.fill();
        }
        // wrought iron balcony on some
        if (rng.chance(0.35)) {
          ctx.strokeStyle = '#1d1d1d';
          ctx.lineWidth = 1.2;
          const by = wy + wh - 12;
          ctx.strokeRect(wx - 8, by, ww + 16, 14);
          for (let k = 0; k < ww + 16; k += 5) {
            ctx.beginPath(); ctx.arc(wx - 8 + k, by + 7, 2.2, 0, Math.PI * 2); ctx.stroke();
          }
        }
      }
    }
    // plants growing on facade
    for (let i = 0; i < 6; i++) {
      const x = rng.range(0, w), y = rng.range(0, h);
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = rng.pick(['#3f6b2a', '#58823a', '#2c4f20']);
        ctx.beginPath(); ctx.arc(x + rng.range(-6, 6), y + rng.range(-6, 6), rng.range(2, 5), 0, Math.PI * 2); ctx.fill();
      }
    }
    P.streaks(ctx, 0, 0, w, h, rng, 40, 0.25);
  };
}

function drawBrick(style) {
  return (ctx, e, w, h) => {
    const rng = new RNG(style.name);
    ctx.fillStyle = '#d8c8b0';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 5) {
      const off = (y / 5) % 2 ? 5 : 0;
      for (let x = -10; x < w; x += 10) {
        ctx.fillStyle = P.shade(style.wall, rng.range(-0.15, 0.12));
        ctx.fillRect(x + off, y, 9, 4);
      }
    }
    const fh = h / 4, bw = w / 4;
    for (let f = 0; f < 4; f++) {
      const y0 = f * fh;
      ctx.fillStyle = '#efe6d6';
      ctx.fillRect(0, y0 + fh - 9, w, 5);
      for (let b = 0; b < 4; b++) {
        const x0 = b * bw;
        const ww = bw * 0.5, wh = fh * 0.55, wx = x0 + bw * 0.25, wy = y0 + fh * 0.22;
        // white stone arch trim (Indo-Saracenic)
        ctx.fillStyle = '#efe6d6';
        ctx.beginPath();
        ctx.moveTo(wx - 6, wy + wh + 3);
        ctx.lineTo(wx - 6, wy + 10);
        ctx.quadraticCurveTo(wx + ww / 2, wy - 26, wx + ww + 6, wy + 10);
        ctx.lineTo(wx + ww + 6, wy + wh + 3);
        ctx.fill();
        ctx.fillStyle = '#22201c';
        ctx.beginPath();
        ctx.moveTo(wx, wy + wh);
        ctx.lineTo(wx, wy + 12);
        ctx.quadraticCurveTo(wx + ww / 2, wy - 16, wx + ww, wy + 12);
        ctx.lineTo(wx + ww, wy + wh);
        ctx.fill();
        if (e && rng.chance(0.4)) {
          e.fillStyle = rng.pick(WARM);
          e.beginPath();
          e.moveTo(wx, wy + wh);
          e.lineTo(wx, wy + 12);
          e.quadraticCurveTo(wx + ww / 2, wy - 16, wx + ww, wy + 12);
          e.lineTo(wx + ww, wy + wh);
          e.fill();
        }
        ctx.strokeStyle = '#efe6d6';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.stroke();
      }
    }
    grain(ctx, 0, 0, w, h, 0.15);
    P.streaks(ctx, 0, 0, w, h, rng, 20, 0.15);
  };
}

function drawGlass(style) {
  return (ctx, e, w, h) => {
    const rng = new RNG(style.name);
    const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
    g.addColorStop(0, P.shade(style.glass, 0.35));
    g.addColorStop(0.5, style.glass);
    g.addColorStop(1, P.shade(style.glass, -0.3));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const cols = 8, rows = 8;
    const cw = w / cols, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = `rgba(255,255,255,${rng.range(0, 0.1)})`;
        ctx.fillRect(c * cw, r * rh, cw, rh);
      }
    }
    // reflections of clouds
    ctx.fillStyle = 'rgba(255,240,230,0.12)';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(rng.range(0, w), rng.range(0, h), rng.range(30, 80), rng.range(8, 20), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#9fb1bd';
    for (let c = 0; c <= cols; c++) ctx.fillRect(c * cw - 1, 0, 2, h);
    ctx.fillStyle = '#7f909b';
    for (let r = 0; r <= rows; r++) ctx.fillRect(0, r * rh - 2, w, 4);
    if (e) {
      // office floors lit in bands, cool white
      for (let r = 0; r < rows; r += 2) {
        const lit = rng.chance(0.55);
        if (!lit) continue;
        for (let c = 0; c < cols; c++) {
          if (rng.chance(0.2)) continue;
          const col = rng.chance(0.85) ? rng.pick(COOL) : rng.pick(WARM);
          e.fillStyle = col;
          e.globalAlpha = rng.range(0.55, 1);
          e.fillRect(c * cw + 2, r * rh + 3, cw - 4, rh * 2 - 6);
        }
        e.globalAlpha = 1;
      }
    }
  };
}

function drawOffice(style) {
  return (ctx, e, w, h) => {
    const rng = new RNG(style.name);
    P.noiseFill(ctx, 0, 0, w, h, style.wall, rng, 0.05, 4);
    grain(ctx, 0, 0, w, h, 0.15);
    const fh = h / 4;
    for (let f = 0; f < 4; f++) {
      const wy = f * fh + fh * 0.3, wh = fh * 0.42;
      const g = ctx.createLinearGradient(0, wy, 0, wy + wh);
      g.addColorStop(0, '#5d7484');
      g.addColorStop(1, '#22313b');
      ctx.fillStyle = g;
      ctx.fillRect(0, wy, w, wh);
      ctx.fillStyle = '#bfc4c6';
      for (let x = 0; x < w; x += w / 12) ctx.fillRect(x, wy, 2, wh);
      if (e) {
        for (let x = 0; x < w; x += w / 12) {
          if (rng.chance(0.5)) {
            e.fillStyle = rng.pick(COOL);
            e.globalAlpha = rng.range(0.5, 1);
            e.fillRect(x + 2, wy, w / 12 - 2, wh);
          }
        }
        e.globalAlpha = 1;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(0, wy + wh, w, 3);
    }
    P.streaks(ctx, 0, 0, w, h, rng, 18, 0.15);
  };
}

function drawTin(style) {
  return (ctx, e, w, h) => {
    const rng = new RNG(style.name);
    let x = 0;
    while (x < w) {
      const pw = rng.range(30, 70);
      const base = rng.pick(['#8c9296', '#6f8fa8', '#a8584a', '#7d8a6a', '#9a9a92', '#3d6e9c']);
      for (let k = 0; k < pw; k += 4) {
        ctx.fillStyle = P.shade(base, k % 8 < 4 ? 0.12 : -0.12);
        ctx.fillRect(x + k, 0, 4, h);
      }
      // rust
      P.blotches(ctx, x, 0, pw, h, rng, 4, 'rgba(140,60,20,0.35)', 8, 30);
      x += pw;
    }
    // horizontal seams and nails
    for (let y = 0; y < h; y += h / 4) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, y, w, 2);
    }
    // small windows with light leaking through gaps
    if (e) {
      for (let i = 0; i < 10; i++) {
        e.fillStyle = rng.pick(WARM);
        e.fillRect(rng.range(0, w), rng.range(0, h), rng.range(2, 18), rng.range(1, 3));
      }
    }
    grain(ctx, 0, 0, w, h, 0.2);
  };
}

// ---------------------------------------------------------------- shopfronts (4 shops x 1 floor)

const GOODS = ['#e23b3b', '#f2c230', '#2a62c9', '#2ea36b', '#f07c2a', '#ffffff', '#9b4dca', '#e85d9d', '#20b2c9'];

function drawShops(style) {
  return (ctx, e, w, h) => {
    const rng = new RNG(style.name);
    const n = 4, bw = w / n;
    P.noiseFill(ctx, 0, 0, w, h, style.wall || '#cfc7b8', rng, 0.06, 4);
    for (let i = 0; i < n; i++) {
      const x0 = i * bw;
      const sx = x0 + 6, sw = bw - 12, sy = h * 0.3, sh = h * 0.7;
      // sign band (generic)
      const sc = rng.pick(['#c81e2e', '#1f6fb5', '#1c8a4c', '#f2b81f', '#7b2f9e', '#e8561c', '#0d0d0d']);
      ctx.fillStyle = sc;
      ctx.fillRect(x0 + 2, h * 0.06, bw - 4, h * 0.2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let k = 0; k < 4; k++) ctx.fillRect(x0 + 10 + k * rng.range(18, 26), h * 0.11, rng.range(10, 20), h * 0.09);
      if (e) {
        e.fillStyle = P.shade(sc, 0.3);
        e.globalAlpha = 0.8;
        e.fillRect(x0 + 2, h * 0.06, bw - 4, h * 0.2);
        e.globalAlpha = 1;
      }
      const kind = style.kind === 'mall' ? 'glass' : rng.weighted({ open: 6, shutter: 2, half: 3 });
      if (kind === 'shutter') {
        ctx.fillStyle = '#8a8f93';
        ctx.fillRect(sx, sy, sw, sh);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        for (let k = sy; k < sy + sh; k += 4) ctx.fillRect(sx, k, sw, 1.5);
        P.blotches(ctx, sx, sy, sw, sh, rng, 3, 'rgba(120,60,20,0.3)', 6, 18);
        // graffiti / poster
        if (rng.chance(0.5)) {
          ctx.fillStyle = rng.pick(['#f4f0e0', '#f9d84a']);
          ctx.fillRect(sx + sw * 0.2, sy + sh * 0.3, sw * 0.35, sh * 0.3);
        }
      } else {
        // interior
        const g = ctx.createLinearGradient(0, sy, 0, sy + sh);
        g.addColorStop(0, '#3a332a');
        g.addColorStop(1, '#1c1814');
        ctx.fillStyle = g;
        ctx.fillRect(sx, sy, sw, sh);
        // shelves with goods
        for (let r = 0; r < 4; r++) {
          const ry = sy + 6 + r * (sh / 4.5);
          ctx.fillStyle = '#5a4630';
          ctx.fillRect(sx + 2, ry + sh / 6, sw - 4, 2);
          for (let gx = sx + 3; gx < sx + sw - 6; gx += rng.range(4, 9)) {
            ctx.fillStyle = rng.pick(GOODS);
            const gh = rng.range(5, sh / 6);
            ctx.fillRect(gx, ry + sh / 6 - gh, rng.range(3, 7), gh);
          }
        }
        // counter
        ctx.fillStyle = '#6b5236';
        ctx.fillRect(sx, sy + sh * 0.72, sw, sh * 0.28);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(sx, sy + sh * 0.72, sw, 2);
        if (kind === 'glass') {
          ctx.fillStyle = 'rgba(160,200,220,0.25)';
          ctx.fillRect(sx, sy, sw, sh);
          ctx.fillStyle = '#c9d0d4';
          ctx.fillRect(sx + sw / 2 - 1, sy, 2, sh);
        }
        if (kind === 'half') {
          ctx.fillStyle = '#8a8f93';
          ctx.fillRect(sx, sy, sw, sh * 0.32);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          for (let k = sy; k < sy + sh * 0.32; k += 4) ctx.fillRect(sx, k, sw, 1.5);
        }
        if (e) {
          const lc = rng.chance(0.7) ? rng.pick(COOL) : rng.pick(WARM);
          const top = kind === 'half' ? sy + sh * 0.32 : sy;
          const gg = e.createLinearGradient(0, top, 0, sy + sh);
          gg.addColorStop(0, lc);
          gg.addColorStop(1, P.shade(lc, -0.5));
          e.fillStyle = gg;
          e.fillRect(sx, top, sw, sy + sh - top);
          // goods silhouettes
          e.fillStyle = 'rgba(0,0,0,0.35)';
          for (let r = 0; r < 4; r++) {
            const ry = sy + 6 + r * (sh / 4.5);
            if (ry < top) continue;
            e.fillRect(sx + 2, ry + sh / 6, sw - 4, 2);
          }
          e.fillStyle = 'rgba(0,0,0,0.6)';
          e.fillRect(sx, sy + sh * 0.72, sw, sh * 0.28);
          // tube light
          e.fillStyle = '#ffffff';
          e.fillRect(sx + sw * 0.25, top + 2, sw * 0.5, 2);
        }
      }
      // awning tarp
      if (rng.chance(style.awning ?? 0.5)) {
        const ac = rng.pick(['#2f6fc0', '#d23b2f', '#1f8a4c', '#e8b21d', '#3b4fae']);
        ctx.fillStyle = ac;
        ctx.beginPath();
        ctx.moveTo(x0, sy);
        ctx.lineTo(x0 + bw, sy);
        ctx.lineTo(x0 + bw - 4, sy + 14);
        ctx.lineTo(x0 + 4, sy + 14);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        for (let k = x0; k < x0 + bw; k += 12) ctx.fillRect(k, sy, 6, 14);
      }
      // pillar between shops
      ctx.fillStyle = P.shade(style.wall || '#cfc7b8', -0.15);
      ctx.fillRect(x0, sy, 5, sh);
    }
    grain(ctx, 0, 0, w, h, 0.15);
    P.streaks(ctx, 0, 0, w, h * 0.3, rng, 10, 0.2);
  };
}

export const FACADE_STYLES = [
  { name: 'apt_cream', fn: drawApartment, wall: '#e3d7bf', trim: '#f1ebdd', grill: '#efeee8' },
  { name: 'apt_pink', fn: drawApartment, wall: '#dca99e', trim: '#f2ddd5', grill: '#f4f2ec' },
  { name: 'apt_mint', fn: drawApartment, wall: '#a9cdb5', trim: '#e2efe4', grill: '#f2f2ea' },
  { name: 'apt_yellow', fn: drawApartment, wall: '#e2c477', trim: '#f2e6c8', grill: '#2f6249', grillStyle: 1 },
  { name: 'apt_white', fn: drawApartment, wall: '#e9e7e2', trim: '#ffffff', grill: '#2a2a2a', glass: '#1f2d3a', railing: 'solid' },
  { name: 'apt_blue', fn: drawApartment, wall: '#9fb6c9', trim: '#e4ecf2', grill: '#ffffff', grillStyle: 2 },
  { name: 'apt_tile', fn: drawTiled, wall: '#8a3b33', tile2: '#e3d6bf' },
  { name: 'apt_tile2', fn: drawTiled, wall: '#2f4b6b', tile2: '#d9d4c7' },
  { name: 'apt_raw', fn: drawRaw, wall: '#a39d93' },
  { name: 'old_ochre', fn: drawOld, wall: '#c49a58', shutter: '#2f6b4a' },
  { name: 'old_blue', fn: drawOld, wall: '#7a9ea3', shutter: '#6b3b2a' },
  { name: 'old_pink', fn: drawOld, wall: '#c48a85', shutter: '#2e5a6b' },
  { name: 'brick', fn: drawBrick, wall: '#9a4a32' },
  { name: 'glass_blue', fn: drawGlass, glass: '#2c5878' },
  { name: 'glass_green', fn: drawGlass, glass: '#2b6b62' },
  { name: 'office', fn: drawOffice, wall: '#c9c4bb' },
  { name: 'tin', fn: drawTin },
];

export const SHOP_STYLES = [
  { name: 'shop_a', kind: 'street', wall: '#cbbfa9', awning: 0.6 },
  { name: 'shop_b', kind: 'street', wall: '#b9b2a6', awning: 0.3 },
  { name: 'shop_old', kind: 'street', wall: '#a58a64', awning: 0.7 },
  { name: 'shop_mall', kind: 'mall', wall: '#d8d6d2', awning: 0 },
];

export function buildFacadeAtlas() {
  const A = new Atlas(2048, { emissive: true, emissiveScale: 0.5 });
  for (const st of FACADE_STYLES) A.add(st.name, 384, 384, st.fn(st));
  for (const st of SHOP_STYLES) A.add(st.name, 384, 120, drawShops(st));
  // roof & misc concrete in the facade atlas too so buildings are 1 draw call
  A.add('roof', 128, 128, (ctx) => {
    const rng = new RNG('roof');
    P.noiseFill(ctx, 0, 0, 128, 128, '#8d8780', rng, 0.12, 4);
    grain(ctx, 0, 0, 128, 128, 0.3);
    P.blotches(ctx, 0, 0, 128, 128, rng, 6, 'rgba(0,0,0,0.2)', 10, 40);
  });
  A.add('concrete', 128, 128, (ctx) => {
    const rng = new RNG('conc');
    P.noiseFill(ctx, 0, 0, 128, 128, '#b3aea6', rng, 0.08, 4);
    grain(ctx, 0, 0, 128, 128, 0.25);
    P.streaks(ctx, 0, 0, 128, 128, rng, 6, 0.12);
  });
  A.add('side_plain', 128, 128, (ctx) => {
    const rng = new RNG('sideplain');
    P.noiseFill(ctx, 0, 0, 128, 128, '#cfc6b6', rng, 0.08, 4);
    grain(ctx, 0, 0, 128, 128, 0.25);
    P.streaks(ctx, 0, 0, 128, 128, rng, 10, 0.2);
    // small ventilation windows
    ctx.fillStyle = '#2a2622';
    ctx.fillRect(56, 40, 16, 12);
  });
  A.add('wall_poster', 384, 96, (ctx) => {
    const rng = new RNG('wallp');
    P.noiseFill(ctx, 0, 0, 384, 96, '#d6cbb5', rng, 0.08, 4);
    // posters glued in layers
    for (let i = 0; i < 26; i++) {
      const pw = rng.range(18, 40), ph = rng.range(24, 44);
      const x = rng.range(-10, 384), y = rng.range(0, 60);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rng.range(-0.08, 0.08));
      ctx.fillStyle = rng.pick(['#f3eedc', '#f9de4a', '#ea5a5a', '#5ab0ea', '#ffffff', '#9fe08a']);
      ctx.fillRect(0, 0, pw, ph);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      for (let k = 6; k < ph - 4; k += 6) ctx.fillRect(3, k, pw * rng.range(0.4, 0.9), 2);
      ctx.restore();
    }
    // the eternal wall warning
    P.signText(ctx, 'এখানে প্রস্রাব করা নিষেধ', 192, 82, { font: `700 18px ${P.FONT_BN_SANS}`, fill: '#c41a1a', stroke: null, lw: 0 });
    grain(ctx, 0, 0, 384, 96, 0.2);
    P.streaks(ctx, 0, 0, 384, 96, rng, 20, 0.2);
  });
  return A;
}

// ---------------------------------------------------------------- misc atlas: props, vehicles, landmarks

function rickshawArt(ctx, w, h, rng, theme) {
  // background panel
  const bgs = [['#1d5fa8', '#0e2f5a'], ['#c8102e', '#5c0716'], ['#118a4a', '#063d20'], ['#e7a400', '#7a4700'], ['#5b2a86', '#25103a']];
  const [b1, b2] = rng.pick(bgs);
  ctx.fillStyle = P.linGrad(ctx, 0, 0, 0, h, [[0, b1], [1, b2]]);
  ctx.fillRect(0, 0, w, h);
  // scene
  if (theme === 'city') {
    // Dhaka skyline painted with a big sun and a plane (classic rickshaw art motif)
    ctx.fillStyle = '#ffcf33';
    ctx.beginPath(); ctx.arc(w * 0.72, h * 0.35, h * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff5a36';
    for (let i = 0; i < 9; i++) {
      const bw = rng.range(w * 0.06, w * 0.12), bh = rng.range(h * 0.2, h * 0.5);
      const bx = (i / 9) * w;
      ctx.fillStyle = rng.pick(['#f25c54', '#43aa8b', '#f7b267', '#577590', '#f4f1de']);
      ctx.fillRect(bx, h * 0.8 - bh, bw, bh);
      ctx.fillStyle = '#ffeaa0';
      for (let wy = h * 0.8 - bh + 4; wy < h * 0.78; wy += 7) ctx.fillRect(bx + 3, wy, bw - 6, 2);
    }
    // plane
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(w * 0.15, h * 0.22); ctx.lineTo(w * 0.42, h * 0.2); ctx.lineTo(w * 0.45, h * 0.23); ctx.lineTo(w * 0.15, h * 0.25);
    ctx.fill();
    ctx.beginPath(); ctx.moveTo(w * 0.28, h * 0.22); ctx.lineTo(w * 0.22, h * 0.12); ctx.lineTo(w * 0.32, h * 0.22); ctx.fill();
  } else if (theme === 'peacock') {
    // stylised peacock with fanned tail
    const cx = w * 0.5, cy = h * 0.62;
    for (let i = 0; i < 13; i++) {
      const a = Math.PI + (i / 12) * Math.PI;
      const ex = cx + Math.cos(a) * h * 0.5, ey = cy + Math.sin(a) * h * 0.48;
      ctx.strokeStyle = '#2bc48a';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = '#1d9f6b';
      ctx.beginPath(); ctx.ellipse(ex, ey, 9, 12, a + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2c230';
      ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#123f9c';
      ctx.beginPath(); ctx.arc(ex, ey, 2.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#1452c4';
    ctx.beginPath(); ctx.ellipse(cx, cy, 12, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 4, cy - 28, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c230';
    ctx.beginPath(); ctx.moveTo(cx + 10, cy - 29); ctx.lineTo(cx + 17, cy - 27); ctx.lineTo(cx + 10, cy - 25); ctx.fill();
  } else if (theme === 'hero') {
    // film star portrait
    P.burst(ctx, w * 0.5, h * 0.5, h * 0.48, 16, '#ffd23a', '#e2301b');
    P.posterFace(ctx, w * 0.5, h * 0.52, h * 0.55, rng, { angry: rng.chance(0.5) });
  } else if (theme === 'tiger') {
    // royal bengal tiger face
    const cx = w / 2, cy = h * 0.55, r = h * 0.32;
    ctx.fillStyle = '#f08a1c';
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.15, r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff4dc';
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.35, r * 0.6, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(cx - r * 1.1, cy - r * 0.5 + i * r * 0.25); ctx.lineTo(cx - r * 0.6, cy - r * 0.4 + i * r * 0.22); ctx.lineTo(cx - r * 1.0, cy - r * 0.35 + i * r * 0.25); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + r * 1.1, cy - r * 0.5 + i * r * 0.25); ctx.lineTo(cx + r * 0.6, cy - r * 0.4 + i * r * 0.22); ctx.lineTo(cx + r * 1.0, cy - r * 0.35 + i * r * 0.25); ctx.fill();
    }
    ctx.fillStyle = '#f2e14a';
    ctx.beginPath(); ctx.ellipse(cx - r * 0.38, cy - r * 0.12, r * 0.16, r * 0.1, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + r * 0.38, cy - r * 0.12, r * 0.16, r * 0.1, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(cx - r * 0.38, cy - r * 0.12, r * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.38, cy - r * 0.12, r * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d6336c';
    ctx.beginPath(); ctx.moveTo(cx - r * 0.12, cy + r * 0.15); ctx.lineTo(cx + r * 0.12, cy + r * 0.15); ctx.lineTo(cx, cy + r * 0.3); ctx.fill();
  } else {
    // village scene: river, boat, hut
    ctx.fillStyle = '#7fd1e8';
    ctx.fillRect(0, h * 0.62, w, h * 0.38);
    ctx.fillStyle = '#2d9a4a';
    ctx.beginPath(); ctx.moveTo(0, h * 0.64); ctx.quadraticCurveTo(w * 0.3, h * 0.45, w * 0.6, h * 0.62); ctx.lineTo(0, h * 0.64); ctx.fill();
    ctx.fillStyle = '#7a3e1d';
    ctx.beginPath(); ctx.moveTo(w * 0.55, h * 0.78); ctx.quadraticCurveTo(w * 0.72, h * 0.86, w * 0.9, h * 0.76); ctx.lineTo(w * 0.86, h * 0.82); ctx.lineTo(w * 0.6, h * 0.82); ctx.fill();
    ctx.fillStyle = '#f4f1de';
    ctx.beginPath(); ctx.moveTo(w * 0.7, h * 0.78); ctx.lineTo(w * 0.72, h * 0.46); ctx.lineTo(w * 0.84, h * 0.72); ctx.fill();
    ctx.fillStyle = '#ffcf33';
    ctx.beginPath(); ctx.arc(w * 0.82, h * 0.25, h * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b5651d';
    ctx.fillRect(w * 0.12, h * 0.4, w * 0.16, h * 0.2);
    ctx.fillStyle = '#e8c35a';
    ctx.beginPath(); ctx.moveTo(w * 0.08, h * 0.42); ctx.lineTo(w * 0.2, h * 0.28); ctx.lineTo(w * 0.32, h * 0.42); ctx.fill();
  }
  // floral frame
  P.scallopBorder(ctx, 6, 6, w - 12, h - 12, '#ffffff', '#e4252b', 9);
  for (const [fx, fy] of [[14, 14], [w - 14, 14], [14, h - 14], [w - 14, h - 14]]) {
    P.flower(ctx, fx, fy, 11, 7, [rng.pick(['#e4252b', '#ff2e88', '#ffb000']), '#ffffff', '#ffd23a'], rng.range(0, 3));
  }
}

function hoodPattern(ctx, w, h, rng, base) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  // concentric bands with dots, typical of rickshaw hoods
  const bands = ['#e4252b', '#ffb000', '#1fae4b', '#1d5fa8', '#ff2e88', '#ffffff'];
  for (let y = 0; y < h; y += 22) {
    ctx.fillStyle = rng.pick(bands);
    ctx.fillRect(0, y, w, 6);
    ctx.fillStyle = '#fff';
    for (let x = 6; x < w; x += 14) {
      ctx.beginPath(); ctx.arc(x + ((y / 22) % 2) * 7, y + 3, 2, 0, Math.PI * 2); ctx.fill();
    }
  }
  for (let i = 0; i < 10; i++) {
    P.flower(ctx, rng.range(0, w), rng.range(0, h), rng.range(8, 16), 6, [rng.pick(bands), '#ffffff', '#ffd23a'], rng.range(0, 3));
  }
  grain(ctx, 0, 0, w, h, 0.12);
}

function busLivery(ctx, w, h, rng, scheme) {
  // side of a Dhaka city bus: dented, scratched, painted stripes, windows
  const [c1, c2, c3] = scheme;
  ctx.fillStyle = c1;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = c2;
  ctx.fillRect(0, h * 0.62, w, h * 0.12);
  ctx.fillStyle = c3;
  ctx.fillRect(0, h * 0.76, w, h * 0.05);
  // windows
  const wy = h * 0.12, wh = h * 0.38;
  for (let x = 12; x < w - 30; x += 34) {
    ctx.fillStyle = '#1c2228';
    ctx.fillRect(x, wy, 30, wh);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 2, wy + 2, 10, wh - 4);
    // passengers' heads
    if (rng.chance(0.7)) {
      ctx.fillStyle = '#2a1e18';
      ctx.beginPath(); ctx.arc(x + rng.range(8, 22), wy + wh * 0.7, 5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // door
  ctx.fillStyle = '#20262c';
  ctx.fillRect(w * 0.08, h * 0.12, 26, h * 0.8);
  // Bengali route text
  P.signText(ctx, rng.pick(['মিরপুর - মতিঝিল', 'গুলিস্তান - উত্তরা', 'সদরঘাট - গাজীপুর', 'ফার্মগেট - যাত্রাবাড়ী', 'আজিমপুর - কুড়িল']), w * 0.55, h * 0.68, { font: `700 ${Math.round(h * 0.1)}px ${P.FONT_BN_SANS}`, fill: '#fff', stroke: 'rgba(0,0,0,0.6)', lw: 2 });
  // dents & scratches
  for (let i = 0; i < 18; i++) {
    const x = rng.range(0, w), y = rng.range(h * 0.5, h);
    ctx.strokeStyle = `rgba(0,0,0,${rng.range(0.15, 0.4)})`;
    ctx.lineWidth = rng.range(0.5, 2);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rng.range(-30, 30), y + rng.range(-4, 4)); ctx.stroke();
  }
  P.blotches(ctx, 0, h * 0.5, w, h * 0.5, rng, 10, 'rgba(0,0,0,0.18)', 6, 18);
  P.blotches(ctx, 0, 0, w, h, rng, 6, 'rgba(255,255,255,0.12)', 6, 18);
  grain(ctx, 0, 0, w, h, 0.18);
  // dust at bottom
  ctx.fillStyle = P.linGrad(ctx, 0, h * 0.8, 0, h, [[0, 'rgba(120,100,70,0)'], [1, 'rgba(120,100,70,0.5)']]);
  ctx.fillRect(0, h * 0.8, w, h * 0.2);
}

function busRear(ctx, w, h, rng, scheme) {
  const [c1, c2] = scheme;
  ctx.fillStyle = c1;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1b2026';
  ctx.fillRect(w * 0.1, h * 0.08, w * 0.8, h * 0.36);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(w * 0.12, h * 0.1, w * 0.3, h * 0.32);
  ctx.fillStyle = c2;
  ctx.fillRect(0, h * 0.5, w, h * 0.12);
  P.signText(ctx, 'মায়ের দোয়া', w / 2, h * 0.56, { font: `700 ${Math.round(h * 0.09)}px ${P.FONT_BN}`, fill: '#fff6c8', stroke: '#000', lw: 3 });
  P.signText(ctx, rng.pick(['লোকাল', 'সিটিং সার্ভিস', 'গেটলক', 'বিরতিহীন']), w / 2, h * 0.7, { font: `700 ${Math.round(h * 0.07)}px ${P.FONT_BN_SANS}`, fill: '#ffef5a', stroke: '#000', lw: 2 });
  // plate
  ctx.fillStyle = '#f3f3ec';
  ctx.fillRect(w * 0.3, h * 0.78, w * 0.4, h * 0.1);
  P.signText(ctx, 'ঢাকা মেট্রো-ব ১১-' + rng.int(1000, 9999).toString().replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[d]), w / 2, h * 0.83, { font: `700 ${Math.round(h * 0.05)}px ${P.FONT_BN_SANS}`, fill: '#111', stroke: null, lw: 0 });
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = `rgba(0,0,0,${rng.range(0.15, 0.4)})`;
    ctx.beginPath();
    const x = rng.range(0, w), y = rng.range(h * 0.45, h);
    ctx.moveTo(x, y); ctx.lineTo(x + rng.range(-20, 20), y + rng.range(-3, 3)); ctx.stroke();
  }
  P.blotches(ctx, 0, 0, w, h, rng, 8, 'rgba(0,0,0,0.2)', 6, 20);
  grain(ctx, 0, 0, w, h, 0.2);
}

function truckArt(ctx, w, h, rng) {
  // painted wooden cargo body: panels with flowers, birds, slogans
  const base = rng.pick(['#e8b21d', '#1f6fb5', '#c8102e', '#118a4a']);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const panels = 5;
  for (let i = 0; i < panels; i++) {
    const px = (i / panels) * w + 4, pw = w / panels - 8;
    ctx.fillStyle = rng.pick(['#ffffff', '#ffe08a', '#a8e6cf', '#ffb3c6']);
    ctx.fillRect(px, h * 0.15, pw, h * 0.55);
    P.flower(ctx, px + pw / 2, h * 0.42, Math.min(pw, h * 0.5) * 0.32, 8, [rng.pick(['#e4252b', '#ff2e88', '#1d5fa8']), '#ffb000', '#ffffff'], rng.range(0, 3));
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, h * 0.15, pw, h * 0.55);
  }
  ctx.fillStyle = '#111';
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  P.signText(ctx, rng.pick(['সাবধানে চালান', 'মায়ের দোয়া পরিবহন', 'আল্লাহর দান', 'বাবা মায়ের দোয়া']), w / 2, h * 0.89, { font: `700 ${Math.round(h * 0.15)}px ${P.FONT_BN}`, fill: '#ffd23a', stroke: '#c8102e', lw: 2 });
  P.scallopBorder(ctx, 2, 2, w - 4, h * 0.74, '#ffffff', '#e4252b', 6);
  grain(ctx, 0, 0, w, h, 0.18);
}

export function buildMiscAtlas() {
  const A = new Atlas(2048, { emissive: true, emissiveScale: 0.5 });
  const rng = new RNG('misc');
  A.add('white', 32, 32, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 32, 32); });
  A.add('sidewalk', 128, 128, (ctx) => {
    const r = new RNG('sw');
    ctx.fillStyle = '#6f6a62';
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 16) {
      for (let x = 0; x < 128; x += 32) {
        const off = (y / 16) % 2 ? 16 : 0;
        ctx.fillStyle = r.chance(0.5) ? P.shade('#a8584a', r.range(-0.15, 0.1)) : P.shade('#9a958c', r.range(-0.15, 0.1));
        ctx.fillRect(x + off + 1, y + 1, 30, 14);
        if (r.chance(0.12)) { ctx.fillStyle = '#3a3630'; ctx.fillRect(x + off + 1, y + 1, 30, 14); }
      }
    }
    grain(ctx, 0, 0, 128, 128, 0.3);
    P.blotches(ctx, 0, 0, 128, 128, r, 6, 'rgba(0,0,0,0.25)', 8, 30);
  });
  A.add('curb', 128, 32, (ctx) => {
    for (let x = 0; x < 128; x += 64) {
      ctx.fillStyle = '#e7c21d'; ctx.fillRect(x, 0, 32, 32);
      ctx.fillStyle = '#151515'; ctx.fillRect(x + 32, 0, 32, 32);
    }
    grain(ctx, 0, 0, 128, 32, 0.35);
    P.blotches(ctx, 0, 0, 128, 32, rng, 6, 'rgba(60,50,30,0.4)', 4, 12);
  });
  A.add('curb_white', 128, 32, (ctx) => {
    for (let x = 0; x < 128; x += 64) {
      ctx.fillStyle = '#e8e6df'; ctx.fillRect(x, 0, 32, 32);
      ctx.fillStyle = '#151515'; ctx.fillRect(x + 32, 0, 32, 32);
    }
    grain(ctx, 0, 0, 128, 32, 0.35);
  });
  A.add('concrete', 128, 128, (ctx) => {
    const r = new RNG('c2');
    P.noiseFill(ctx, 0, 0, 128, 128, '#a7a39b', r, 0.08, 4);
    grain(ctx, 0, 0, 128, 128, 0.25);
    P.streaks(ctx, 0, 0, 128, 128, r, 8, 0.15);
  });
  A.add('concrete_smooth', 128, 128, (ctx) => {
    const r = new RNG('c3');
    P.noiseFill(ctx, 0, 0, 128, 128, '#c9c3b8', r, 0.04, 8);
    grain(ctx, 0, 0, 128, 128, 0.12);
  });
  A.add('metal', 64, 64, (ctx) => {
    const r = new RNG('m');
    P.noiseFill(ctx, 0, 0, 64, 64, '#8d9296', r, 0.06, 2);
    grain(ctx, 0, 0, 64, 64, 0.2);
  });
  A.add('rust', 64, 64, (ctx) => {
    const r = new RNG('rust');
    P.noiseFill(ctx, 0, 0, 64, 64, '#6e4a36', r, 0.15, 2);
    P.blotches(ctx, 0, 0, 64, 64, r, 6, 'rgba(160,80,30,0.5)', 4, 16);
  });
  A.add('wood', 128, 64, (ctx) => {
    const r = new RNG('wood');
    for (let y = 0; y < 64; y += 8) {
      ctx.fillStyle = P.shade('#7a4a28', r.range(-0.2, 0.1));
      ctx.fillRect(0, y, 128, 7);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, y + 7, 128, 1);
    }
    grain(ctx, 0, 0, 128, 64, 0.3);
  });
  A.add('bamboo', 64, 128, (ctx) => {
    ctx.fillStyle = '#c9a862';
    ctx.fillRect(0, 0, 64, 128);
    ctx.fillStyle = 'rgba(80,60,20,0.5)';
    for (let y = 0; y < 128; y += 32) ctx.fillRect(0, y, 64, 3);
    grain(ctx, 0, 0, 64, 128, 0.2);
  });
  A.add('tarp', 64, 64, (ctx) => {
    const r = new RNG('tarp');
    P.noiseFill(ctx, 0, 0, 64, 64, '#2f6fc0', r, 0.08, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (let x = 0; x < 64; x += 8) ctx.fillRect(x, 0, 1, 64);
  });
  A.add('glass_dark', 64, 64, (ctx) => {
    ctx.fillStyle = P.linGrad(ctx, 0, 0, 64, 64, [[0, '#5a6e80'], [0.5, '#1d2732'], [1, '#0d1218']]);
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.moveTo(10, 64); ctx.lineTo(24, 64); ctx.lineTo(50, 0); ctx.lineTo(36, 0); ctx.fill();
  });
  A.add('tyre', 64, 64, (ctx) => {
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#222';
    for (let x = 0; x < 64; x += 6) ctx.fillRect(x, 0, 3, 64);
  });
  A.add('rim', 64, 64, (ctx) => {
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#c9ccd0';
    ctx.beginPath(); ctx.arc(32, 32, 24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5c6066';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(32, 32); ctx.arc(32, 32, 21, a + 0.25, a + 0.95); ctx.fill();
    }
    ctx.fillStyle = '#e8e9eb';
    ctx.beginPath(); ctx.arc(32, 32, 5, 0, Math.PI * 2); ctx.fill();
  });
  A.add('spokes', 64, 64, (ctx) => {
    // rickshaw wheel with colourful spoke tassels
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#d8d8d8';
    ctx.lineWidth = 1;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(32, 32); ctx.lineTo(32 + Math.cos(a) * 29, 32 + Math.sin(a) * 29); ctx.stroke();
    }
    const cols = ['#e4252b', '#ffb000', '#1fae4b', '#ff2e88', '#1d5fa8'];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath(); ctx.arc(32 + Math.cos(a) * 18, 32 + Math.sin(a) * 18, 3, 0, Math.PI * 2); ctx.fill();
    }
  });
  // Rickshaw art panels
  ['city', 'peacock', 'hero', 'tiger', 'village', 'city'].forEach((t, i) => {
    A.add('rick_art' + i, 192, 128, (ctx) => rickshawArt(ctx, 192, 128, new RNG('ra' + i), t));
  });
  ['#c8102e', '#1d5fa8', '#111111', '#118a4a'].forEach((b, i) => {
    A.add('hood' + i, 128, 128, (ctx) => hoodPattern(ctx, 128, 128, new RNG('hood' + i), b));
  });
  A.add('cng_side', 128, 128, (ctx) => {
    ctx.fillStyle = '#1f8a3c';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = P.linGrad(ctx, 0, 0, 0, 128, [[0, '#2fb352'], [1, '#156b2c']]);
    ctx.fillRect(0, 64, 128, 64);
    // metal cage
    ctx.fillStyle = '#20262a';
    ctx.fillRect(0, 0, 128, 64);
    ctx.strokeStyle = '#a8adb2';
    ctx.lineWidth = 2;
    for (let x = 4; x < 128; x += 10) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 64); ctx.stroke(); }
    for (let y = 8; y < 64; y += 14) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke(); }
    ctx.fillStyle = '#f5f5f0';
    ctx.font = `700 12px ${P.FONT_SIGN}`;
    ctx.fillText('CNG', 10, 100);
    grain(ctx, 0, 0, 128, 128, 0.15);
  });
  A.add('cng_back', 128, 128, (ctx) => {
    ctx.fillStyle = P.linGrad(ctx, 0, 0, 0, 128, [[0, '#2fb352'], [1, '#13612a']]);
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#20262a';
    ctx.fillRect(14, 8, 100, 44);
    ctx.strokeStyle = '#a8adb2';
    ctx.lineWidth = 2;
    for (let x = 18; x < 112; x += 10) { ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, 52); ctx.stroke(); }
    ctx.fillStyle = '#f2f2ea';
    ctx.fillRect(32, 86, 64, 22);
    P.signText(ctx, 'ঢাকা মেট্রো-থ', 64, 92, { font: `700 9px ${P.FONT_BN_SANS}`, fill: '#111', stroke: null, lw: 0 });
    P.signText(ctx, '১১-' + toBnLocal(rng.int(1000, 9999)), 64, 102, { font: `700 10px ${P.FONT_BN_SANS}`, fill: '#111', stroke: null, lw: 0 });
    P.signText(ctx, 'আস্তে চলুন', 64, 68, { font: `700 13px ${P.FONT_BN}`, fill: '#ffe14a', stroke: '#000', lw: 2 });
  });
  const busSchemes = [
    ['#2266b8', '#e8e3d0', '#d42a2a'],
    ['#d42a2a', '#f2c230', '#1a1a1a'],
    ['#1f8a4c', '#f4f0e0', '#e8561c'],
    ['#e8e3d0', '#1d4e9e', '#d42a2a'],
    ['#7a2f9e', '#f2c230', '#ffffff'],
  ];
  busSchemes.forEach((s, i) => {
    A.add('bus_side' + i, 512, 128, (ctx) => busLivery(ctx, 512, 128, new RNG('bus' + i), s));
    A.add('bus_back' + i, 128, 128, (ctx) => busRear(ctx, 128, 128, new RNG('busb' + i), s));
  });
  A.add('brtc_side', 512, 128, (ctx) => {
    // BRTC red double decker
    const r = new RNG('brtc');
    ctx.fillStyle = '#c4161c';
    ctx.fillRect(0, 0, 512, 128);
    for (const wy of [10, 70]) {
      for (let x = 10; x < 500; x += 40) {
        ctx.fillStyle = '#1b2026';
        ctx.fillRect(x, wy, 34, 34);
        if (r.chance(0.7)) { ctx.fillStyle = '#2a1e18'; ctx.beginPath(); ctx.arc(x + r.range(8, 26), wy + 26, 5, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    ctx.fillStyle = '#f4f0e0';
    ctx.fillRect(0, 52, 512, 10);
    P.signText(ctx, 'বিআরটিসি', 256, 57, { font: `700 10px ${P.FONT_BN_SANS}`, fill: '#c4161c', stroke: null, lw: 0 });
    grain(ctx, 0, 0, 512, 128, 0.15);
  });
  A.add('truck_side0', 384, 128, (ctx) => truckArt(ctx, 384, 128, new RNG('tr0')));
  A.add('truck_side1', 384, 128, (ctx) => truckArt(ctx, 384, 128, new RNG('tr1')));
  A.add('truck_back', 128, 128, (ctx) => {
    const r = new RNG('trb');
    truckArt(ctx, 128, 128, r);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, 128, 18);
    P.signText(ctx, 'হর্ন দিন', 64, 10, { font: `700 12px ${P.FONT_BN}`, fill: '#fff', stroke: null, lw: 0 });
  });
  A.add('truck_cab', 128, 128, (ctx) => {
    ctx.fillStyle = '#e8561c';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#1b2026';
    ctx.fillRect(10, 10, 108, 50);
    P.flower(ctx, 30, 90, 14, 8, ['#ffd23a', '#1d5fa8', '#fff'], 0);
    P.flower(ctx, 98, 90, 14, 8, ['#ffd23a', '#1d5fa8', '#fff'], 1);
    ctx.fillStyle = '#ffd23a';
    ctx.fillRect(0, 64, 128, 6);
  });
  A.add('car_side', 256, 64, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#1a222a';
    ctx.beginPath(); ctx.moveTo(50, 28); ctx.lineTo(80, 4); ctx.lineTo(180, 4); ctx.lineTo(206, 28); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(84, 6, 40, 20);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 40, 256, 2);
  });
  A.add('car_back', 128, 64, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = '#1a222a';
    ctx.fillRect(18, 2, 92, 22);
    ctx.fillStyle = '#f3f3ec';
    ctx.fillRect(40, 40, 48, 14);
    P.signText(ctx, 'ঢাকা মেট্রো-গ', 64, 47, { font: `700 7px ${P.FONT_BN_SANS}`, fill: '#111', stroke: null, lw: 0 });
  });
  A.add('mrt_side', 512, 96, (ctx) => {
    // Dhaka MRT line 6 livery: white body, red & green stripes
    ctx.fillStyle = '#f2f3f1';
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = '#0f7a43';
    ctx.fillRect(0, 62, 512, 8);
    ctx.fillStyle = '#d4202a';
    ctx.fillRect(0, 71, 512, 5);
    for (let x = 14; x < 500; x += 48) {
      ctx.fillStyle = '#1a222a';
      ctx.fillRect(x, 18, 36, 34);
    }
    ctx.fillStyle = '#9aa1a6';
    for (let x = 100; x < 512; x += 128) ctx.fillRect(x, 14, 22, 58);
    ctx.fillStyle = '#1a222a';
    for (let x = 100; x < 512; x += 128) { ctx.fillRect(x + 2, 18, 8, 30); ctx.fillRect(x + 12, 18, 8, 30); }
  }, { wrap: true });
  A.add('train_side', 512, 96, (ctx) => {
    // Bangladesh Railway intercity: dark green with yellow stripe
    ctx.fillStyle = '#1d4f3a';
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(0, 60, 512, 6);
    for (let x = 10; x < 500; x += 30) {
      ctx.fillStyle = '#121a16';
      ctx.fillRect(x, 20, 20, 26);
      ctx.strokeStyle = '#7a8a80';
      ctx.strokeRect(x, 20, 20, 26);
    }
  });
  A.add('launch_side', 512, 192, (ctx) => {
    // multi-deck river launch with colourful lights
    const r = new RNG('launch');
    ctx.fillStyle = '#f2efe6';
    ctx.fillRect(0, 0, 512, 192);
    const decks = [[0, 50], [50, 50], [100, 50], [150, 42]];
    decks.forEach(([y, h], di) => {
      ctx.fillStyle = di === 3 ? '#1f5fae' : '#f2efe6';
      ctx.fillRect(0, y, 512, h);
      ctx.fillStyle = di === 3 ? '#c8102e' : '#2a62c9';
      ctx.fillRect(0, y + h - 6, 512, 6);
      if (di < 3) {
        for (let x = 6; x < 506; x += 16) {
          ctx.fillStyle = '#26303a';
          ctx.fillRect(x, y + 10, 12, 22);
        }
        ctx.strokeStyle = '#666';
        ctx.beginPath();
        for (let x = 0; x < 512; x += 8) { ctx.moveTo(x, y + 34); ctx.lineTo(x, y + 44); }
        ctx.stroke();
      }
    });
    P.signText(ctx, 'এম.ভি. বর্ষা-৭', 256, 170, { font: `700 22px ${P.FONT_BN}`, fill: '#fff', stroke: '#000', lw: 3 });
    grain(ctx, 0, 0, 512, 192, 0.15);
  }, { wrap: false });
  // patch the launch emissive: windows & fairy lights
  {
    const rr = A.rects['launch_side'];
    const e = A.ectx, s = A.es;
    e.save();
    e.scale(s, s);
    e.translate(rr.x, rr.y);
    const r = new RNG('launchE');
    for (const y of [10, 60, 110]) {
      for (let x = 6; x < 506; x += 16) {
        if (r.chance(0.7)) { e.fillStyle = r.pick(['#ffe0a0', '#f2f7ff', '#ffd080']); e.fillRect(x, y, 12, 22); }
      }
    }
    const cols = ['#ff3b3b', '#3bff6b', '#3b9bff', '#ffd23b', '#ff3bd8'];
    for (const y of [3, 48, 98, 148]) {
      for (let x = 2; x < 512; x += 7) { e.fillStyle = cols[(x / 7 | 0) % cols.length]; e.fillRect(x, y, 3, 3); }
    }
    e.restore();
  }
  A.add('stadium_crowd', 256, 128, (ctx) => {
    const r = new RNG('crowd');
    ctx.fillStyle = '#1c2a4a';
    ctx.fillRect(0, 0, 256, 128);
    for (let y = 2; y < 128; y += 6) {
      for (let x = 0; x < 256; x += 4) {
        ctx.fillStyle = r.pick(['#d6232a', '#0f7a43', '#f2f2ea', '#f2c230', '#2a1e18', '#d6232a', '#0f7a43']);
        ctx.fillRect(x + r.range(-1, 1), y, 3, 4);
      }
    }
  });
  A.add('gate_cloth', 128, 128, (ctx) => {
    // wedding-gate drapes: marigold garlands on red/yellow cloth
    ctx.fillStyle = '#c8102e';
    ctx.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 32) {
      ctx.fillStyle = '#f2c230';
      ctx.fillRect(x, 0, 16, 128);
    }
    for (let x = 8; x < 128; x += 16) {
      for (let y = 4; y < 128; y += 7) {
        ctx.fillStyle = (y / 7) % 2 ? '#ff8c00' : '#ffb300';
        ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    grain(ctx, 0, 0, 128, 128, 0.15);
  });
  A.add('marble', 128, 128, (ctx) => {
    const r = new RNG('marb');
    P.noiseFill(ctx, 0, 0, 128, 128, '#e8e4dc', r, 0.04, 4);
    ctx.strokeStyle = 'rgba(120,110,100,0.25)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo(r.range(0, 128), 0);
      ctx.bezierCurveTo(r.range(0, 128), 40, r.range(0, 128), 80, r.range(0, 128), 128);
      ctx.stroke();
    }
  });
  A.add('sangsad', 256, 256, (ctx) => {
    // exposed concrete with white marble inlay bands (Kahn's parliament)
    const r = new RNG('sangsad');
    P.noiseFill(ctx, 0, 0, 256, 256, '#8f8a82', r, 0.06, 4);
    grain(ctx, 0, 0, 256, 256, 0.22);
    ctx.fillStyle = '#e9e5dc';
    for (let y = 0; y < 256; y += 42) ctx.fillRect(0, y, 256, 4);
    ctx.fillRect(126, 0, 4, 256);
    P.streaks(ctx, 0, 0, 256, 256, r, 20, 0.12);
  });
  A.add('ahsan', 256, 128, (ctx) => {
    // pink palace arcade
    ctx.fillStyle = '#d9798a';
    ctx.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 4; i++) {
      const x = i * 64 + 10;
      ctx.fillStyle = '#5a2430';
      ctx.beginPath(); ctx.moveTo(x, 120); ctx.lineTo(x, 50); ctx.arc(x + 22, 50, 22, Math.PI, 0); ctx.lineTo(x + 44, 120); ctx.fill();
      ctx.fillStyle = '#f2d5da';
      ctx.fillRect(x - 6, 0, 4, 128);
    }
    ctx.fillStyle = '#f2d5da';
    ctx.fillRect(0, 6, 256, 6);
    ctx.fillRect(0, 122, 256, 6);
    grain(ctx, 0, 0, 256, 128, 0.15);
  });
  A.add('star_tiles', 128, 128, (ctx) => {
    // Tara Masjid: white with blue star mosaic
    ctx.fillStyle = '#f2f3f4';
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 8; y < 128; y += 22) {
      for (let x = 8; x < 128; x += 22) {
        ctx.fillStyle = '#1d5fa8';
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
          const rr = k % 2 ? 3 : 7;
          ctx.lineTo(x + ((y / 22) % 2 ? 11 : 0) + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.fill();
      }
    }
  });
  A.add('terracotta', 128, 128, (ctx) => {
    const r = new RNG('terra');
    P.noiseFill(ctx, 0, 0, 128, 128, '#a5512f', r, 0.1, 4);
    for (let y = 0; y < 128; y += 8) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, y, 128, 1); }
  });
  A.add('water_tank', 64, 64, (ctx) => {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let y = 4; y < 64; y += 10) ctx.fillRect(0, y, 64, 3);
    P.signText(ctx, 'GAZI', 32, 34, { font: `700 10px ${P.FONT_SIGN}`, fill: '#c9c9c9', stroke: null, lw: 0 });
  });
  A.add('toll', 128, 128, (ctx) => {
    ctx.fillStyle = '#e8e6df';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#0f7a43';
    ctx.fillRect(0, 0, 128, 24);
    ctx.fillStyle = '#d4202a';
    ctx.fillRect(0, 24, 128, 6);
    ctx.fillStyle = '#1b2026';
    ctx.fillRect(16, 44, 96, 50);
  });
  A.add('checker', 64, 64, (ctx) => {
    for (let y = 0; y < 64; y += 16) for (let x = 0; x < 64; x += 16) {
      ctx.fillStyle = ((x + y) / 16) % 2 ? '#111' : '#f4f4f4';
      ctx.fillRect(x, y, 16, 16);
    }
  });
  A.add('kiln_brick', 64, 64, (ctx) => {
    const r = new RNG('kiln');
    for (let y = 0; y < 64; y += 5) {
      const off = (y / 5) % 2 ? 4 : 0;
      for (let x = -8; x < 64; x += 8) {
        ctx.fillStyle = P.shade('#8e3f26', r.range(-0.2, 0.1));
        ctx.fillRect(x + off, y, 7, 4);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, 64, 64);
  });
  A.add('plane', 256, 64, (ctx) => {
    // airliner livery (generic national carrier homage)
    ctx.fillStyle = '#f4f5f6';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#0f7a43';
    ctx.fillRect(0, 38, 256, 6);
    ctx.fillStyle = '#d4202a';
    ctx.fillRect(0, 44, 256, 4);
    for (let x = 30; x < 220; x += 10) { ctx.fillStyle = '#26303a'; ctx.fillRect(x, 22, 5, 7); }
  });
  return A;
}

function toBnLocal(n) {
  return String(n).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
}

// ---------------------------------------------------------------- skyline textures (R near, G far, B windows)

export function buildSkyline(type, seed = 1) {
  const W = 4096, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  const rng = new RNG(type + seed);
  const base = H - 8; // horizon line in texture

  const layer = (chan, hmin, hmax, density, opts = {}) => {
    const col = chan === 0 ? '#ff0000' : '#00ff00';
    let x = 0;
    while (x < W) {
      const bw = rng.range(opts.wmin || 10, opts.wmax || 40);
      let bh = rng.range(hmin, hmax);
      if (rng.chance(opts.towerP || 0)) bh *= rng.range(1.6, 2.6);
      if (rng.chance(1 - density)) { x += bw * 0.6; continue; }
      ctx.fillStyle = col;
      ctx.fillRect(x, base - bh, bw, bh + 8);
      // rooftop clutter: water tanks, stair rooms, antennas
      if (opts.clutter && rng.chance(0.6)) {
        ctx.fillRect(x + bw * 0.2, base - bh - 4, bw * 0.25, 4);
        if (rng.chance(0.3)) ctx.fillRect(x + bw * 0.6, base - bh - 10, 1.5, 10);
      }
      if (opts.domes && rng.chance(0.08)) {
        ctx.beginPath(); ctx.arc(x + bw / 2, base - bh, bw * 0.45, Math.PI, 0); ctx.fill();
      }
      if (opts.minarets && rng.chance(0.05)) {
        ctx.fillRect(x + bw / 2 - 1.5, base - bh - 40, 3, 40);
        ctx.beginPath(); ctx.arc(x + bw / 2, base - bh - 40, 3, Math.PI, 0); ctx.fill();
      }
      if (opts.cranes && rng.chance(0.03)) {
        ctx.fillRect(x + bw / 2, base - bh - 60, 2, 60);
        ctx.fillRect(x + bw / 2 - 30, base - bh - 60, 60, 2);
      }
      if (opts.towers && rng.chance(0.04)) {
        // telecom lattice tower
        ctx.beginPath();
        ctx.moveTo(x, base - bh); ctx.lineTo(x + 3, base - bh - 50); ctx.lineTo(x + 6, base - bh); ctx.fill();
      }
      // windows
      if (chan === 0 && opts.windows !== false) {
        ctx.fillStyle = '#0000ff';
        for (let wy = base - bh + 4; wy < base - 2; wy += 5) {
          for (let wx = x + 2; wx < x + bw - 2; wx += 4) {
            if (rng.chance(opts.lit || 0.25)) ctx.fillRect(wx, wy, 2, 2);
          }
        }
      }
      x += bw + rng.range(0, opts.gap || 4);
    }
  };
  const trees = (chan, hmin, hmax) => {
    const col = chan === 0 ? '#ff0000' : '#00ff00';
    ctx.fillStyle = col;
    for (let x = 0; x < W; x += rng.range(4, 14)) {
      const r = rng.range(hmin, hmax);
      ctx.beginPath(); ctx.arc(x, base - r * 0.6, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillRect(0, base - 4, W, 12);
  };
  const palms = (chan, n) => {
    ctx.strokeStyle = chan === 0 ? '#ff0000' : '#00ff00';
    ctx.fillStyle = ctx.strokeStyle;
    for (let i = 0; i < n; i++) {
      const x = rng.range(0, W), h = rng.range(30, 60);
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + rng.range(-8, 8), base - h / 2, x + rng.range(-5, 5), base - h); ctx.stroke();
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(x, base - h);
        ctx.quadraticCurveTo(x + Math.cos(a) * 12, base - h - 6, x + Math.cos(a) * 16, base - h + 6 + Math.abs(Math.sin(a)) * 4);
        ctx.stroke();
      }
    }
  };

  if (type === 'midrise') {
    layer(1, 30, 90, 0.9, { towerP: 0.1, gap: 2, clutter: true });
    layer(0, 20, 60, 0.85, { clutter: true, minarets: true, towers: true, lit: 0.22 });
    palms(0, 30);
  } else if (type === 'dense') {
    layer(1, 25, 60, 0.95, { domes: true, minarets: true, gap: 1 });
    layer(0, 18, 45, 0.97, { clutter: true, domes: true, minarets: true, lit: 0.3, gap: 1, wmin: 8, wmax: 26 });
  } else if (type === 'modern') {
    layer(1, 50, 140, 0.9, { towerP: 0.2, cranes: true, gap: 6 });
    layer(0, 30, 90, 0.8, { towerP: 0.15, clutter: true, lit: 0.35, cranes: true });
  } else if (type === 'lake') {
    layer(1, 40, 120, 0.85, { towerP: 0.2, gap: 8 });
    layer(0, 25, 80, 0.75, { towerP: 0.1, lit: 0.4, gap: 6 });
  } else if (type === 'river') {
    trees(1, 4, 9);
    layer(0, 6, 30, 0.6, { lit: 0.2, gap: 20, wmin: 8, wmax: 30 });
    palms(0, 20);
  } else if (type === 'rural') {
    trees(1, 5, 12);
    trees(0, 3, 8);
    palms(0, 50);
    // brick kiln chimneys
    ctx.fillStyle = '#ff0000';
    for (let i = 0; i < 12; i++) {
      const x = rng.range(0, W);
      ctx.fillRect(x, base - rng.range(50, 80), 5, 80);
    }
  } else if (type === 'stadium') {
    layer(1, 30, 80, 0.9, { towerP: 0.1, clutter: true });
    layer(0, 20, 55, 0.85, { clutter: true, lit: 0.25 });
  }
  return cv;
}
