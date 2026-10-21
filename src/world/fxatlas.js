// Second atlas: vehicle liveries for the new cars, enemies and bosses, things
// you can smash, and the interiors of the set pieces (metro station, the
// clothing store, the mall, the cinema, the amusement park).

import { Atlas } from './atlas.js';
import * as P from './paint.js';
import { RNG } from '../core/util.js';

const SAREE = [
  ['#c8102e', '#ffb000', '#1a7a3c'], ['#1d5fa8', '#ffe14a', '#ff2e88'], ['#0f7a43', '#e4252b', '#ffd23a'],
  ['#ff2e88', '#22d3ee', '#ffffff'], ['#7b2f9e', '#ffb000', '#ff6a2e'], ['#f2a900', '#c8102e', '#1d5fa8'],
];
export const SAREE_CSS = SAREE.map(([a, b, c]) => `repeating-linear-gradient(115deg, ${a} 0 38px, ${b} 38px 46px, ${a} 46px 84px, ${c} 84px 90px)`);

function fabric(ctx, w, h, rng, cols, opts = {}) {
  const [base, border, motif] = cols;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  // woven sheen
  for (let y = 0; y < h; y += 3) { ctx.fillStyle = `rgba(255,255,255,${0.03 + rng.next() * 0.04})`; ctx.fillRect(0, y, w, 1); }
  // buti dots
  ctx.fillStyle = motif;
  for (let y = 10; y < h - 18; y += 16) for (let x = 8 + ((y / 16) % 2) * 8; x < w; x += 16) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); }
  // borders (paar) with a zigzag
  const bh = opts.border ?? Math.max(10, h * 0.16);
  ctx.fillStyle = border;
  ctx.fillRect(0, h - bh, w, bh);
  ctx.fillStyle = motif;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h - bh + ((x / 8) % 2 ? 2 : bh * 0.45));
  ctx.lineTo(w, h - bh); ctx.lineTo(0, h - bh); ctx.fill();
  ctx.fillStyle = P.shade(border, -0.3);
  ctx.fillRect(0, h - 3, w, 3);
}

function windowTiles(ctx, x, y, w, h, n, col, glow) {
  for (let i = 0; i < n; i++) {
    const ww = w / n;
    ctx.fillStyle = col;
    ctx.fillRect(x + i * ww + 2, y, ww - 4, h);
    if (glow) { glow.fillStyle = 'rgba(255,220,160,0.8)'; glow.fillRect(x + i * ww + 2, y, ww - 4, h); }
  }
}

export function buildFxAtlas() {
  const A = new Atlas(2048, { emissive: true, emissiveScale: 0.5, bg: '#7f7f7f' });
  const rng = new RNG('fx');
  A.add('white', 32, 32, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 32, 32); });
  A.add('black', 16, 16, (c) => { c.fillStyle = '#0c0c0e'; c.fillRect(0, 0, 16, 16); });
  A.add('glass', 64, 64, (c, e, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3a4a5c'); g.addColorStop(0.5, '#1c2633'); g.addColorStop(1, '#0e141c');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.16)';
    c.beginPath(); c.moveTo(w * 0.15, 0); c.lineTo(w * 0.32, 0); c.lineTo(w * 0.12, h); c.lineTo(0, h); c.fill();
  });
  A.add('tyre', 64, 64, (c, e, w, h) => {
    c.fillStyle = '#141414'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#222'; for (let y = 0; y < h; y += 6) c.fillRect(0, y, w, 2);
  });
  A.add('rim', 64, 64, (c, e, w, h) => {
    c.fillStyle = '#222'; c.fillRect(0, 0, w, h);
    c.translate(w / 2, h / 2);
    c.fillStyle = '#c9ccd0';
    c.beginPath(); c.arc(0, 0, w * 0.46, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3a3c40';
    for (let i = 0; i < 5; i++) { c.rotate((Math.PI * 2) / 5); c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, w * 0.4, -0.4, 0.15); c.fill(); }
    c.fillStyle = '#888'; c.beginPath(); c.arc(0, 0, 5, 0, Math.PI * 2); c.fill();
  });
  A.add('grille', 64, 32, (c, e, w, h) => {
    c.fillStyle = '#0c0c0e'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#3a3a3e'; c.lineWidth = 1;
    for (let x = 0; x < w; x += 5) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 4, h); c.stroke(); }
    c.fillStyle = '#c9ccd0'; c.fillRect(w / 2 - 6, h / 2 - 4, 12, 8);
  });
  A.add('plate', 128, 32, (c, e, w, h) => {
    c.fillStyle = '#f4f4ec'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#111'; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2);
    P.signText(c, 'ঢাকা মেট্রো-গ', w / 2, 10, { font: `700 10px ${P.FONT_BN_SANS}`, fill: '#111', stroke: null, lw: 0 });
    P.signText(c, '১১-' + Math.floor(1000 + rng.next() * 8999).toString().replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[d]), w / 2, 23, { font: `700 13px ${P.FONT_BN_SANS}`, fill: '#111', stroke: null, lw: 0 });
  });
  A.add('taxi_sign', 64, 32, (c, e, w, h) => {
    c.fillStyle = '#ffd200'; c.fillRect(0, 0, w, h);
    P.signText(c, 'TAXI', w / 2, h / 2, { font: `400 16px ${P.FONT_SIGN}`, fill: '#111', stroke: null, lw: 0 });
    if (e) { e.fillStyle = 'rgba(255,220,80,0.9)'; e.fillRect(0, 0, w, h); }
  });
  A.add('police_side', 256, 64, (c, e, w, h) => {
    c.fillStyle = '#1e3270'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f2f2ee'; c.fillRect(0, h * 0.42, w, h * 0.18);
    c.fillStyle = '#e4252b'; c.fillRect(0, h * 0.6, w, 3);
    P.signText(c, 'POLICE', w * 0.38, h * 0.51, { font: `400 13px ${P.FONT_SIGN}`, fill: '#1e3270', stroke: null, lw: 0 });
    P.signText(c, 'পুলিশ', w * 0.72, h * 0.5, { font: `700 13px ${P.FONT_BN_SANS}`, fill: '#1e3270', stroke: null, lw: 0 });
    P.signText(c, '999', w * 0.55, h * 0.8, { font: `400 10px ${P.FONT_SIGN}`, fill: '#ffffff', stroke: null, lw: 0 });
  });
  A.add('police_back', 128, 48, (c, e, w, h) => {
    c.fillStyle = '#1e3270'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f2f2ee'; c.fillRect(0, h * 0.35, w, h * 0.3);
    P.signText(c, 'POLICE', w / 2, h / 2, { font: `400 15px ${P.FONT_SIGN}`, fill: '#1e3270', stroke: null, lw: 0 });
  });
  A.add('rab_side', 256, 64, (c, e, w, h) => {
    c.fillStyle = '#0d0d10'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#3a3a40'; c.fillRect(0, h * 0.7, w, 2);
    P.signText(c, 'RAB', w * 0.45, h * 0.45, { font: `400 26px ${P.FONT_SIGN}`, fill: '#f2f2ee', stroke: null, lw: 0 });
    P.signText(c, 'RAPID ACTION BATTALION', w * 0.45, h * 0.84, { font: `400 7px ${P.FONT_SIGN}`, fill: '#bfbfbf', stroke: null, lw: 0 });
  });
  A.add('rab_back', 128, 32, (c, e, w, h) => {
    c.fillStyle = '#0d0d10'; c.fillRect(0, 0, w, h);
    P.signText(c, 'R A B', w / 2, h / 2, { font: `400 18px ${P.FONT_SIGN}`, fill: '#f2f2ee', stroke: null, lw: 0 });
  });
  A.add('tesla_side', 128, 64, (c, e, w, h) => {
    c.fillStyle = '#e8e2d2'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#c8102e'; c.fillRect(0, 8, w, 6);
    c.fillStyle = '#ffb000'; c.fillRect(0, 16, w, 3);
    P.flower(c, 20, 40, 10, 8, ['#e4252b', '#ffb000', '#ffffff']);
    P.flower(c, 108, 40, 10, 8, ['#1d5fa8', '#ffe14a', '#ffffff']);
    P.signText(c, 'ব্যাটারি চালিত', 64, 42, { font: `700 12px ${P.FONT_BN_SANS}`, fill: '#1a1a1a', stroke: null, lw: 0 });
  });
  A.add('tesla_back', 128, 64, (c, e, w, h) => {
    c.fillStyle = '#1a6a3a'; c.fillRect(0, 0, w, h);
    P.scallopBorder(c, 0, 0, w, h, '#ffb000', '#e4252b', 6);
    P.signText(c, 'মায়ের দোয়া', 64, 24, { font: `700 18px ${P.FONT_BN}`, fill: '#ffe14a', stroke: '#000', lw: 3 });
    // the joke sticker
    c.fillStyle = '#f2f2ee'; c.fillRect(38, 40, 52, 14);
    P.signText(c, 'TESLA', 64, 47, { font: `400 11px ${P.FONT_SIGN}`, fill: '#c8102e', stroke: null, lw: 0 });
  });
  const busNames = [['বাপ-বেটা পরিবহন', 'BAAP-BETA PARIBAHAN', '#c8102e', '#ffb000'], ['হাওয়া এক্সপ্রেস', 'HAWA EXPRESS · LOCAL', '#1d5fa8', '#22d3ee']];
  busNames.forEach(([bn, en, c1, c2], i) => {
    A.add('bossbus_side' + i, 512, 128, (c, e, w, h) => {
      c.fillStyle = '#f2ead6'; c.fillRect(0, 0, w, h);
      c.fillStyle = c1; c.fillRect(0, 0, w, 20); c.fillRect(0, h - 34, w, 34);
      c.fillStyle = c2; c.fillRect(0, h - 40, w, 6);
      windowTiles(c, 20, 24, w - 40, 40, 9, '#1a222c', null);
      if (e) { e.save(); e.fillStyle = 'rgba(255,120,220,0.5)'; for (let k = 0; k < 9; k++) e.fillRect(22 + k * ((w - 40) / 9), 24, (w - 40) / 9 - 4, 40); e.restore(); }
      P.signText(c, bn, w * 0.35, 80, { font: `700 22px ${P.FONT_BN}`, fill: c1, stroke: '#000', lw: 2 });
      P.signText(c, en, w * 0.75, 80, { font: `400 12px ${P.FONT_SIGN}`, fill: '#1a1a1a', stroke: null, lw: 0 });
      // dents and scrapes: this bus has been in every fight in Dhaka
      for (let k = 0; k < 14; k++) { c.strokeStyle = 'rgba(40,30,20,0.45)'; c.lineWidth = 1 + rng.next() * 2; c.beginPath(); const x = rng.range(0, w), y = rng.range(20, h - 30); c.moveTo(x, y); c.lineTo(x + rng.range(-30, 30), y + rng.range(-6, 6)); c.stroke(); }
      c.fillStyle = 'rgba(80,60,40,0.25)'; c.beginPath(); c.ellipse(w * 0.62, h * 0.7, 40, 14, 0.2, 0, Math.PI * 2); c.fill();
    });
    A.add('bossbus_back' + i, 128, 128, (c, e, w, h) => {
      c.fillStyle = c1; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1a222c'; c.fillRect(10, 10, w - 20, 42);
      P.signText(c, i ? 'ধাক্কা দিলে খবর আছে' : 'বাপের রাস্তা', w / 2, 72, { font: `700 14px ${P.FONT_BN}`, fill: '#ffe14a', stroke: '#000', lw: 2, maxW: w - 12 });
      P.signText(c, i ? 'HONK IF YOU DARE' : 'DADDY’S ROAD', w / 2, 96, { font: `400 9px ${P.FONT_SIGN}`, fill: '#fff', stroke: null, lw: 0 });
      P.flower(c, 20, 112, 9, 8, ['#ffb000', '#fff', '#e4252b']);
      P.flower(c, 108, 112, 9, 8, ['#ffb000', '#fff', '#e4252b']);
    });
  });
  A.add('bossbus_front', 128, 128, (c, e, w, h) => {
    c.fillStyle = '#d8d2c0'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1a222c'; c.fillRect(8, 8, w - 16, 58);
    c.fillStyle = '#111'; c.fillRect(0, 70, w, 16);
    P.signText(c, 'গুলিস্তান', w / 2, 78, { font: `700 12px ${P.FONT_BN_SANS}`, fill: '#ff5a2e', stroke: null, lw: 0 });
    if (e) { e.fillStyle = 'rgba(255,90,40,0.9)'; e.fillRect(10, 72, w - 20, 12); }
  });
  A.add('heli_body', 256, 128, (c, e, w, h) => {
    c.fillStyle = '#e9ecee'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#0f7a43'; c.fillRect(0, h * 0.58, w, 10);
    c.fillStyle = '#c8102e'; c.fillRect(0, h * 0.58 + 10, w, 4);
    windowTiles(c, 30, 26, 150, 26, 5, '#1a2633', null);
    P.signText(c, 'VVIP', w * 0.78, h * 0.4, { font: `400 22px ${P.FONT_SIGN}`, fill: '#0f7a43', stroke: null, lw: 0 });
    P.signText(c, 'ONE-WAY TRIP', w * 0.5, h * 0.86, { font: `400 10px ${P.FONT_SIGN}`, fill: '#555', stroke: null, lw: 0 });
  });

  // ---------------------------------------------------- smashables
  SAREE.forEach((cols, i) => A.add('saree' + i, 96, 128, (c, e, w, h) => fabric(c, w, h, rng, cols)));
  A.add('panjabi', 96, 128, (c, e, w, h) => {
    c.fillStyle = '#f2ead6'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#c49a3a'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h * 0.45); c.stroke();
    for (let y = 8; y < h * 0.45; y += 10) { c.beginPath(); c.arc(w / 2, y, 3, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = '#7a1d22'; for (let x = 6; x < w; x += 12) c.fillRect(x, h - 10, 6, 6);
  });
  A.add('folded', 128, 64, (c, e, w, h) => {
    const cols = ['#c8102e', '#ffb000', '#1d5fa8', '#0f7a43', '#ff2e88', '#f2ead6', '#7b2f9e', '#22d3ee'];
    for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 32) { c.fillStyle = cols[(x / 32 + y / 8 * 3) % cols.length | 0]; c.fillRect(x + 1, y + 1, 30, 7); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 1, y + 7, 30, 1); }
  });
  A.add('crate', 64, 64, (c, e, w, h) => {
    c.fillStyle = '#a8763e'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#7a5226'; for (let y = 0; y < h; y += 16) c.fillRect(0, y, w, 3);
    c.strokeStyle = '#5a3a1a'; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4);
    c.beginPath(); c.moveTo(4, 4); c.lineTo(w - 4, h - 4); c.stroke();
  });
  A.add('fruit', 128, 64, (c, e, w, h) => {
    c.fillStyle = '#5a3a1a'; c.fillRect(0, 0, w, h);
    const cols = ['#ff8a1a', '#ffd23a', '#2a9a3a', '#e4252b', '#9acd32'];
    for (let i = 0; i < 90; i++) { c.fillStyle = cols[i % cols.length]; c.beginPath(); c.arc(rng.range(0, w), rng.range(0, h), rng.range(5, 9), 0, Math.PI * 2); c.fill(); }
  });
  A.add('awning', 128, 64, (c, e, w, h) => {
    for (let x = 0; x < w; x += 16) { c.fillStyle = (x / 16) % 2 ? '#f2f2ee' : '#c8102e'; c.fillRect(x, 0, 16, h); }
    c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(0, h - 8, w, 8);
  });
  A.add('stall_tea', 128, 96, (c, e, w, h) => {
    c.fillStyle = '#3a6a8a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffd23a'; c.fillRect(8, 8, w - 16, 30);
    P.signText(c, 'চা · পান · সিগারেট', w / 2, 23, { font: `700 13px ${P.FONT_BN_SANS}`, fill: '#c8102e', stroke: null, lw: 0, maxW: w - 20 });
    for (let i = 0; i < 6; i++) { c.fillStyle = ['#e4252b', '#ffb000', '#1fae4b'][i % 3]; c.fillRect(10 + i * 19, 48, 14, 30); }
  });
  A.add('stall_fuchka', 128, 96, (c, e, w, h) => {
    c.fillStyle = '#f2ead6'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#c8102e'; c.fillRect(0, 0, w, 26);
    P.signText(c, 'ফুচকা · চটপটি', w / 2, 14, { font: `700 14px ${P.FONT_BN_SANS}`, fill: '#ffe14a', stroke: null, lw: 0 });
    for (let i = 0; i < 40; i++) { c.fillStyle = '#d8a050'; c.beginPath(); c.arc(rng.range(10, w - 10), rng.range(40, h - 10), 5, 0, Math.PI * 2); c.fill(); }
  });
  A.add('tv', 64, 48, (c, e, w, h) => {
    c.fillStyle = '#111'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#2a4a8a'; c.fillRect(4, 4, w - 8, h - 8);
    if (e) { e.fillStyle = 'rgba(80,140,255,0.7)'; e.fillRect(4, 4, w - 8, h - 8); }
  });
  A.add('velvet', 64, 64, (c, e, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 1.2);
    g.addColorStop(0, '#b0202e'); g.addColorStop(1, '#5a0a14');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#ffd23a'; c.lineWidth = 2; c.strokeRect(3, 3, w - 6, h - 6);
  });
  A.add('suitcase', 64, 64, (c, e, w, h) => {
    c.fillStyle = '#5a3a1a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#c49a3a';
    for (let y = 6; y < h; y += 14) for (let x = 6 + (y % 28 ? 7 : 0); x < w; x += 14) { c.font = `700 9px ${P.FONT_SIGN}`; c.fillText('✦', x - 4, y + 3); }
    c.fillStyle = '#c49a3a'; c.fillRect(0, h / 2 - 2, w, 4);
  });
  A.add('glasspane', 64, 64, (c, e, w, h) => {
    c.fillStyle = 'rgba(170,210,230,0.9)'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.moveTo(10, 0); c.lineTo(22, 0); c.lineTo(0, 30); c.lineTo(0, 18); c.fill();
  });
  A.add('mannequin', 32, 64, (c, e, w, h) => { c.fillStyle = '#f2ece2'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(0, 0, 4, h); });
  A.add('chevron', 128, 32, (c, e, w, h) => {
    c.fillStyle = '#ffd200'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#111';
    for (let x = -h; x < w + h; x += 24) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 12, 0); c.lineTo(x + 12 + h, h); c.lineTo(x + h, h); c.fill(); }
  });
  A.add('roadclosed', 256, 96, (c, e, w, h) => {
    c.fillStyle = '#f2f2ee'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#c8102e';
    for (let x = -h; x < w + h; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 20, 0); c.lineTo(x + 20 + h * 0.5, h * 0.3); c.lineTo(x + h * 0.5, h * 0.3); c.fill(); }
    P.signText(c, 'ROAD CLOSED · METRO WORK', w / 2, h * 0.52, { font: `400 17px ${P.FONT_SIGN}`, fill: '#111', stroke: null, lw: 0, maxW: w - 16 });
    P.signText(c, 'রাস্তা বন্ধ · অসুবিধার জন্য দুঃখিত', w / 2, h * 0.8, { font: `700 13px ${P.FONT_BN_SANS}`, fill: '#c8102e', stroke: null, lw: 0, maxW: w - 16 });
  });
  A.add('ramp', 64, 64, (c, e, w, h) => {
    c.fillStyle = '#8a6a3a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#6a4a22'; for (let x = 0; x < w; x += 8) c.fillRect(x, 0, 2, h);
    c.fillStyle = 'rgba(255,210,0,0.9)'; c.beginPath(); c.moveTo(w / 2, 8); c.lineTo(w - 10, h / 2); c.lineTo(w / 2 + 6, h / 2); c.lineTo(w / 2 + 6, h - 8); c.lineTo(w / 2 - 6, h - 8); c.lineTo(w / 2 - 6, h / 2); c.lineTo(10, h / 2); c.fill();
  });

  // ---------------------------------------------------- metro station
  A.add('mrt_floor', 128, 128, (c, e, w, h) => {
    c.fillStyle = '#c9c6be'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#9a968e'; c.lineWidth = 1;
    for (let i = 0; i <= w; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); }
    c.fillStyle = '#e8c21a'; c.fillRect(0, h - 14, w, 10);
    c.fillStyle = '#b89a10'; for (let x = 4; x < w; x += 8) for (let y = h - 13; y < h - 5; y += 4) c.fillRect(x, y, 2, 2);
  });
  A.add('stairs', 64, 64, (c, e, w, h) => {
    for (let y = 0; y < h; y += 16) { c.fillStyle = '#b8b4aa'; c.fillRect(0, y, w, 12); c.fillStyle = '#6a665e'; c.fillRect(0, y + 12, w, 4); c.fillStyle = '#e8c21a'; c.fillRect(0, y, w, 2); }
  });
  A.add('mrt_wall', 256, 128, (c, e, w, h) => {
    c.fillStyle = '#e8e6e0'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#0f7a43'; c.fillRect(0, 20, w, 40);
    P.signText(c, 'কারওয়ান বাজার', w * 0.3, 40, { font: `700 22px ${P.FONT_BN_SANS}`, fill: '#fff', stroke: null, lw: 0 });
    P.signText(c, 'KARWAN BAZAR', w * 0.74, 40, { font: `400 16px ${P.FONT_SIGN}`, fill: '#fff', stroke: null, lw: 0 });
    c.fillStyle = '#c8102e'; c.fillRect(0, 60, w, 4);
    c.fillStyle = '#9a968e'; for (let x = 0; x < w; x += 32) c.fillRect(x, 70, 1, h - 70);
    if (e) { e.fillStyle = 'rgba(60,200,120,0.55)'; e.fillRect(0, 20, w, 40); }
  });
  A.add('mrt_gate', 64, 64, (c, e, w, h) => {
    c.fillStyle = '#d8dadc'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#20262c'; c.fillRect(6, 6, w - 12, 18);
    c.fillStyle = '#19a84a'; c.beginPath(); c.moveTo(w / 2 - 8, 15); c.lineTo(w / 2 + 8, 15); c.lineTo(w / 2, 8); c.fill();
    if (e) { e.fillStyle = 'rgba(40,220,90,0.9)'; e.fillRect(w / 2 - 8, 8, 16, 8); }
  });
  A.add('railbed', 128, 64, (c, e, w, h) => {
    c.fillStyle = '#6e6a64'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { const v = 80 + rng.next() * 60 | 0; c.fillStyle = `rgb(${v},${v - 4},${v - 8})`; c.fillRect(rng.range(0, w), rng.range(0, h), 2, 2); }
    c.fillStyle = '#9a968e'; for (let y = 0; y < h; y += 16) c.fillRect(0, y, w, 7);
  });
  A.add('platform_edge', 64, 32, (c, e, w, h) => {
    c.fillStyle = '#e8c21a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#b89a10'; for (let x = 2; x < w; x += 6) for (let y = 2; y < h; y += 6) c.fillRect(x, y, 3, 3);
  });

  // ---------------------------------------------------- the clothing store ("AARAAM")
  A.add('store_floor', 128, 128, (c, e, w, h) => {
    c.fillStyle = '#e6dccb'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(160,120,80,0.35)'; c.fillRect(0, 0, w / 2, h / 2); c.fillRect(w / 2, h / 2, w / 2, h / 2);
    c.strokeStyle = 'rgba(120,90,60,0.4)'; c.strokeRect(0, 0, w, h);
    P.flower(c, w / 2, h / 2, 14, 8, ['#a8763e', '#e6dccb', '#c8102e']);
  });
  A.add('store_wall', 256, 128, (c, e, w, h) => {
    c.fillStyle = '#5a3a22'; c.fillRect(0, 0, w, h);
    for (let row = 0; row < 3; row++) {
      c.fillStyle = '#3a2412'; c.fillRect(0, 10 + row * 38, w, 4);
      for (let x = 4; x < w - 8; x += 9) { c.fillStyle = SAREE[(x * 7 + row * 3) % SAREE.length][(x + row) % 3]; c.fillRect(x, 14 + row * 38, 7, 32); }
    }
    if (e) { e.fillStyle = 'rgba(255,200,120,0.25)'; e.fillRect(0, 0, w, h); }
  });
  A.add('store_sign', 256, 64, (c, e, w, h) => {
    c.fillStyle = '#c8102e'; c.fillRect(0, 0, w, h);
    P.signText(c, 'AARAAM', w * 0.42, h * 0.52, { font: `400 34px ${P.FONT_SIGN}`, fill: '#fff6e0', stroke: null, lw: 0 });
    P.flower(c, w * 0.86, h / 2, 18, 8, ['#ffb000', '#fff6e0', '#c8102e']);
    if (e) { e.fillStyle = 'rgba(255,240,220,0.9)'; e.font = `400 34px ${P.FONT_SIGN}`; e.textAlign = 'center'; e.textBaseline = 'middle'; e.fillText('AARAAM', w * 0.42, h * 0.52); }
  });
  A.add('eid_sale', 256, 64, (c, e, w, h) => {
    c.fillStyle = '#0f7a43'; c.fillRect(0, 0, w, h);
    P.scallopBorder(c, 0, 0, w, h, '#ffb000', '#c8102e', 6);
    P.signText(c, 'EID SALE · UP TO 50% OFF', w / 2, h * 0.42, { font: `400 17px ${P.FONT_SIGN}`, fill: '#ffe14a', stroke: '#000', lw: 2, maxW: w - 20 });
    P.signText(c, 'ঈদ মোবারক', w / 2, h * 0.76, { font: `700 15px ${P.FONT_BN}`, fill: '#fff', stroke: null, lw: 0 });
  });

  // ---------------------------------------------------- the mall and the cinema
  A.add('mall_floor', 128, 128, (c, e, w, h) => {
    c.fillStyle = '#d8d4cc'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#b8b2a6'; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w, h / 2); c.lineTo(w / 2, h); c.lineTo(0, h / 2); c.fill();
    c.fillStyle = '#e8e4dc'; c.beginPath(); c.moveTo(w / 2, 20); c.lineTo(w - 20, h / 2); c.lineTo(w / 2, h - 20); c.lineTo(20, h / 2); c.fill();
  });
  const shops = [['FOOD COURT', '#c8102e'], ['BOSHUNDHORA MOBILE', '#1d5fa8'], ['JUTO GHOR · SHOES', '#7b2f9e'], ['SONALI GOLD', '#b8860b'], ['KIDS ZONE', '#ff2e88'], ['ELECTRONIX', '#0f7a43']];
  A.add('mall_shops', 512, 128, (c, e, w, h) => {
    c.fillStyle = '#2a2a30'; c.fillRect(0, 0, w, h);
    shops.forEach(([name, col], i) => {
      const x = i * (w / shops.length);
      const sw = w / shops.length;
      c.fillStyle = col; c.fillRect(x + 3, 6, sw - 6, 24);
      P.signText(c, name, x + sw / 2, 18, { font: `400 9px ${P.FONT_SIGN}`, fill: '#fff', stroke: null, lw: 0, maxW: sw - 10 });
      c.fillStyle = '#c8d8e0'; c.fillRect(x + 6, 36, sw - 12, h - 44);
      c.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 4; k++) c.fillRect(x + 10 + k * (sw - 20) / 4, 70, (sw - 20) / 4 - 6, h - 80);
      if (e) { e.fillStyle = 'rgba(255,240,220,0.75)'; e.fillRect((x + 6), 36, sw - 12, h - 44); e.fillStyle = 'rgba(255,255,255,0.9)'; e.fillRect(x + 3, 6, sw - 6, 24); }
    });
  });
  A.add('cinema_seat', 64, 64, (c, e, w, h) => {
    c.fillStyle = '#1a0a0e'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#a01020'; P.roundRect(c, 4, 4, w - 8, h - 14, 8); c.fill();
    c.fillStyle = '#5a0a14'; c.fillRect(4, h - 12, w - 8, 8);
  });
  A.add('cinema_screen', 512, 224, (c, e, w, h) => {
    // a Dhallywood climax: hero, villain, explosion, two-line title
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ff6a1a'); g.addColorStop(0.6, '#c8102e'); g.addColorStop(1, '#2a0a10');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    P.burst(c, w * 0.5, h * 0.4, 120, 18, '#ffe14a', '#ff6a1a');
    P.posterFace(c, w * 0.26, h * 0.5, 70, rng, { mustache: true });
    P.posterFace(c, w * 0.74, h * 0.52, 62, rng, { villain: true });
    P.signText(c, 'মাস্তানের শেষ গাড়ি', w / 2, h * 0.84, { font: `700 34px ${P.FONT_BN}`, fill: '#ffe14a', stroke: '#000', lw: 5 });
    P.signText(c, 'THE GANGSTER’S LAST CAR', w / 2, h * 0.95, { font: `400 13px ${P.FONT_SIGN}`, fill: '#fff', stroke: '#000', lw: 2 });
    if (e) { e.fillStyle = 'rgba(255,170,120,0.85)'; e.fillRect(0, 0, w, h); }
  });
  A.add('carpet', 64, 64, (c, e, w, h) => {
    c.fillStyle = '#5a0a24'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#c49a3a'; c.lineWidth = 2;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(w / 2, h / 2, 6 + i * 8, 0, Math.PI * 2); c.stroke(); }
  });
  A.add('popcorn', 32, 48, (c, e, w, h) => {
    for (let x = 0; x < w; x += 8) { c.fillStyle = (x / 8) % 2 ? '#fff' : '#c8102e'; c.fillRect(x, 10, 8, h - 10); }
    c.fillStyle = '#ffe9a8'; for (let i = 0; i < 16; i++) { c.beginPath(); c.arc(rng.range(2, w - 2), rng.range(2, 12), 4, 0, Math.PI * 2); c.fill(); }
  });
  A.add('marquee', 256, 64, (c, e, w, h) => {
    c.fillStyle = '#111'; c.fillRect(0, 0, w, h);
    for (let x = 6; x < w; x += 12) { c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(x, 5, 3, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(x, h - 5, 3, 0, Math.PI * 2); c.fill(); }
    P.signText(c, 'STAR-ISH CINEPLEX', w / 2, h / 2, { font: `400 22px ${P.FONT_SIGN}`, fill: '#ffe14a', stroke: null, lw: 0, maxW: w - 20 });
    if (e) { e.fillStyle = 'rgba(255,220,90,0.95)'; e.fillRect(0, 0, w, 10); e.fillRect(0, h - 10, w, 10); e.font = `400 22px ${P.FONT_SIGN}`; e.textAlign = 'center'; e.textBaseline = 'middle'; e.fillText('STAR-ISH CINEPLEX', w / 2, h / 2); }
  });
  A.add('mall_sign', 256, 64, (c, e, w, h) => {
    c.fillStyle = '#0d3a2a'; c.fillRect(0, 0, w, h);
    P.signText(c, 'BOSHUNDHORA CITY', w / 2, h * 0.42, { font: `400 20px ${P.FONT_SIGN}`, fill: '#e8f4ec', stroke: null, lw: 0, maxW: w - 16 });
    P.signText(c, 'SHOPPING · CINEPLEX · FOOD COURT', w / 2, h * 0.78, { font: `400 9px ${P.FONT_SIGN}`, fill: '#7dffc9', stroke: null, lw: 0 });
    if (e) { e.fillStyle = 'rgba(160,255,210,0.8)'; e.fillRect(0, 0, w, h); }
  });

  // ---------------------------------------------------- amusement park
  A.add('coaster', 64, 32, (c, e, w, h) => {
    c.fillStyle = '#d8dadc'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e4252b'; c.fillRect(0, 0, w, 6); c.fillRect(0, h - 6, w, 6);
    c.fillStyle = '#6a6c70'; for (let x = 0; x < w; x += 10) c.fillRect(x, 6, 3, h - 12);
  });
  A.add('jfp_sign', 256, 64, (c, e, w, h) => {
    c.fillStyle = '#1d1a50'; c.fillRect(0, 0, w, h);
    P.signText(c, 'JOMUNA FUTURE PARK', w / 2, h * 0.4, { font: `400 18px ${P.FONT_SIGN}`, fill: '#22d3ee', stroke: null, lw: 0, maxW: w - 16 });
    P.signText(c, 'RIDES · NO CARS ALLOWED', w / 2, h * 0.78, { font: `400 10px ${P.FONT_SIGN}`, fill: '#ff2e88', stroke: null, lw: 0 });
    if (e) { e.fillStyle = 'rgba(120,230,255,0.85)'; e.fillRect(0, 0, w, h); }
  });
  A.add('bulbs', 64, 16, (c, e, w, h) => {
    c.fillStyle = '#222'; c.fillRect(0, 0, w, h);
    const cols = ['#ff2e88', '#ffd23a', '#22d3ee', '#7dffc9'];
    for (let x = 4; x < w; x += 8) { c.fillStyle = cols[(x / 8 | 0) % 4]; c.beginPath(); c.arc(x, h / 2, 3, 0, Math.PI * 2); c.fill(); if (e) { e.fillStyle = cols[(x / 8 | 0) % 4]; e.beginPath(); e.arc(x, h / 2, 3, 0, Math.PI * 2); e.fill(); } }
  });
  A.add('money', 64, 32, (c, e, w, h) => {
    c.fillStyle = '#7a9a6a'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#3a5a2a'; c.strokeRect(3, 3, w - 6, h - 6);
    P.signText(c, '১০০০', w / 2, h / 2, { font: `700 14px ${P.FONT_BN_SANS}`, fill: '#2a3a1a', stroke: null, lw: 0 });
  });
  return A;
}
