// Street signage: shop signs, billboards (hand-painted cinema posters and
// parody ads), road signs. Everything is painted into one atlas.

import { Atlas, grain } from './atlas.js';
import { RNG } from '../core/util.js';
import * as P from './paint.js';

const bnNum = (n) => String(n).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);

export const SHOP_SIGNS = [
  ['মায়ের দোয়া ভ্যারাইটিজ স্টোর', 'সকল প্রকার মালামাল পাওয়া যায়'],
  ['ভাই ভাই স্টোর', 'পাইকারি ও খুচরা'],
  ['বিসমিল্লাহ হোটেল', 'ভাত • মাছ • মাংস • ডাল'],
  ['নিউ মডার্ন টেইলার্স', 'প্রো: হাবিবুর রহমান'],
  ['আল-মদিনা ফার্মেসী', '২৪ ঘণ্টা খোলা'],
  ['হাজী বিরিয়ানী', 'স্থাপিত ১৯৩৯'],
  ['ফুচকা চটপটি হাউস', 'টক-ঝাল-মিষ্টি'],
  ['রহিম মিয়ার চা স্টল', 'দুধ চা • লাল চা • মালাই চা'],
  ['জামদানী কুটির', 'খাঁটি তাঁতের শাড়ি'],
  ['সততা স্টোর', 'বাকি চাহিয়া লজ্জা দিবেন না'],
  ['ফ্লেক্সিলোড এখানে', 'মোবাইল ব্যাংকিং • রিচার্জ'],
  ['কাচ্চি ডাইন', 'আজকের কাচ্চি আজকেই'],
  ['মরণচাঁদের দই', 'মিষ্টি • দই • রসমালাই'],
  ['কম্পিউটার কম্পোজ ও ফটোকপি', 'প্রিন্ট • স্ক্যান • লেমিনেটিং'],
  ['রয়েল হেয়ার কাটিং সেলুন', 'চুল কাটা ৮০ টাকা'],
  ['বাকরখানি ঘর', 'পুরান ঢাকার আসল স্বাদ'],
  ['তারকা কাবাব', 'শিক • বটি • চাপ'],
  ['ঢাকা মোবাইল সার্ভিসিং', 'সব ধরনের মোবাইল মেরামত'],
  ['গরম জিলাপি', 'সন্ধ্যায় পাওয়া যায়'],
  ['এ+ কোচিং সেন্টার', 'গণিত • ইংরেজি • বিজ্ঞান'],
  ['লন্ড্রি এন্ড ড্রাই ক্লিনার্স', 'ইস্ত্রি ১০ টাকা'],
  ['ইলিশ মাছ পাওয়া যায়', 'পদ্মার তাজা ইলিশ'],
  ['নিউ সোনার বাংলা ডায়াগনস্টিক', 'এক্স-রে • আল্ট্রাসনো'],
  ['ঝালমুড়ি এক্সপ্রেস', 'মুড়ি দিয়ে সব চলে'],
  ['তেহারি ঘর', 'গরুর তেহারি ১৫০/-'],
  ['বোরহানি বার', 'ঠান্ডা বোরহানি'],
  ['জনতা হার্ডওয়্যার', 'রড • সিমেন্ট • টিন'],
  ['কাঁচা বাজার', 'তাজা সবজি'],
  ['মিতালী শাড়ি বিতান', 'বেনারসি • কাতান'],
  ['সাইবার ক্যাফে', 'ইন্টারনেট ঘণ্টা ২০ টাকা'],
];

export const SHOP_SIGNS_EN = [
  ['CAFE MONSOON', 'coffee • cha • cake'],
  ['BUNS & BHAI', 'smash burgers'],
  ['SOUTH END COFFEE', 'since yesterday'],
  ['THE KACCHI LAB', 'biryani research facility'],
  ['SUSHI SHAHEB', 'Gulshan 2'],
  ['CAFE 400 TAKA', 'tea, but expensive'],
  ['DHAKA DENTAL', 'smile, it is free'],
  ['PIZZA PAGLA', 'extra cheese, extra jam'],
  ['GADGET BAZAR', 'original copy available'],
  ['HOTEL SHUKHTARA', 'AC • NON-AC'],
];

function shopSign(ctx, w, h, rng, [title, sub], latin) {
  const style = rng.int(0, 4);
  const pal = rng.pick([
    ['#c8102e', '#7a0716', '#ffe14a', '#ffffff'],
    ['#1d5fa8', '#0d2f5c', '#ffffff', '#ffe14a'],
    ['#118a4a', '#05401f', '#ffffff', '#ffe14a'],
    ['#f2b81f', '#a86d00', '#7a0716', '#1a1a1a'],
    ['#151515', '#000000', '#ff2e88', '#20d5ff'],
    ['#ffffff', '#d8d8d0', '#c8102e', '#1d5fa8'],
    ['#7b2f9e', '#3a0f52', '#ffe14a', '#ffffff'],
    ['#e8561c', '#8a2a05', '#ffffff', '#ffe14a'],
  ]);
  const [b1, b2, t1, t2] = pal;
  ctx.fillStyle = P.linGrad(ctx, 0, 0, 0, h, [[0, b1], [1, b2]]);
  ctx.fillRect(0, 0, w, h);
  if (style === 0) {
    // flex banner with swoosh
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.7); ctx.quadraticCurveTo(w * 0.5, h * 0.4, w, h * 0.75); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
  } else if (style === 1) {
    P.scallopBorder(ctx, 5, 5, w - 10, h - 10, t2, b1, 6);
  } else if (style === 2) {
    ctx.strokeStyle = t2;
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  }
  // icon blob on the left sometimes (a picture of the product, flex-print style)
  let left = 0;
  if (rng.chance(0.45)) {
    const r = h * 0.32;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(h * 0.5, h * 0.5, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rng.pick(['#e4252b', '#1fae4b', '#ffb000', '#1d5fa8']);
    ctx.beginPath(); ctx.arc(h * 0.5, h * 0.5, r * 0.72, 0, Math.PI * 2); ctx.fill();
    P.flower(ctx, h * 0.5, h * 0.5, r * 0.55, 6, ['#ffffff', '#ffe14a', '#ffffff'], rng.range(0, 3));
    left = h * 0.8;
  }
  const cx = left + (w - left) / 2;
  const font = latin ? `400 ${Math.round(h * 0.36)}px ${P.FONT_SIGN}` : `700 ${Math.round(h * 0.42)}px ${rng.chance(0.6) ? P.FONT_BN : P.FONT_BN_SANS}`;
  P.signText(ctx, title, cx, h * 0.4, { font, fill: t1, stroke: '#000', lw: Math.max(2, h * 0.05), shadow: 'rgba(0,0,0,0.45)', shadowOff: 2, maxW: (w - left) * 0.9 });
  P.signText(ctx, sub, cx, h * 0.78, { font: `600 ${Math.round(h * 0.18)}px ${latin ? '"Hind Siliguri", sans-serif' : P.FONT_BN_SANS}`, fill: t2, stroke: null, lw: 0, maxW: (w - left) * 0.86 });
  if (!latin && rng.chance(0.5)) {
    P.signText(ctx, 'মোবাইল: ০১৭' + bnNum(rng.int(10000000, 99999999)), w - 6, h - 6, { font: `500 ${Math.round(h * 0.11)}px ${P.FONT_BN_SANS}`, fill: 'rgba(255,255,255,0.75)', stroke: null, lw: 0, align: 'right', baseline: 'bottom' });
  }
  grain(ctx, 0, 0, w, h, 0.12);
  // weathering
  P.blotches(ctx, 0, 0, w, h, rng, 4, 'rgba(0,0,0,0.15)', 10, 40);
}

// ------------------------------------------------------------ billboards

function poster(ctx, w, h, rng, spec) {
  const { title, sub, tag, kind } = spec;
  if (kind === 'action') {
    ctx.fillStyle = P.linGrad(ctx, 0, 0, 0, h, [[0, '#1a0505'], [0.5, '#8a1010'], [1, '#ff6a00']]);
    ctx.fillRect(0, 0, w, h);
    P.burst(ctx, w * 0.25, h * 0.75, h * 0.5, 18);
    P.burst(ctx, w * 0.8, h * 0.85, h * 0.35, 14, '#ffe14a', '#ff2e00');
    P.posterFace(ctx, w * 0.32, h * 0.42, h * 0.62, rng, { angry: true, look: 1 });
    P.posterFace(ctx, w * 0.72, h * 0.36, h * 0.42, rng, { angry: true, look: -1, mustache: true, hair: '#2a1a10' });
    P.posterFace(ctx, w * 0.56, h * 0.62, h * 0.34, rng, { female: true, angry: false });
    // gun silhouette
    ctx.fillStyle = '#111';
    ctx.fillRect(w * 0.05, h * 0.62, w * 0.18, h * 0.05);
    ctx.fillRect(w * 0.18, h * 0.62, w * 0.03, h * 0.12);
  } else if (kind === 'romance') {
    ctx.fillStyle = P.linGrad(ctx, 0, 0, w, h, [[0, '#ff7eb6'], [0.5, '#ffd1e3'], [1, '#7a5cff']]);
    ctx.fillRect(0, 0, w, h);
    // hearts
    for (let i = 0; i < 14; i++) {
      const x = rng.range(0, w), y = rng.range(0, h), s = rng.range(6, 18);
      ctx.fillStyle = `rgba(255,40,100,${rng.range(0.3, 0.8)})`;
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.3);
      ctx.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.4, y - s, x, y - s * 0.3);
      ctx.bezierCurveTo(x + s * 0.4, y - s, x + s, y - s * 0.4, x, y + s * 0.3);
      ctx.fill();
    }
    P.posterFace(ctx, w * 0.35, h * 0.45, h * 0.6, rng, { angry: false, look: 1, mustache: false });
    P.posterFace(ctx, w * 0.62, h * 0.47, h * 0.56, rng, { female: true, look: -1 });
  } else if (kind === 'cricket') {
    ctx.fillStyle = P.linGrad(ctx, 0, 0, 0, h, [[0, '#0f7a43'], [1, '#04301a']]);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d4202a';
    ctx.beginPath(); ctx.arc(w * 0.24, h * 0.5, h * 0.36, 0, Math.PI * 2); ctx.fill();
    // stumps & ball
    ctx.fillStyle = '#f4ead0';
    for (let i = 0; i < 3; i++) ctx.fillRect(w * 0.2 + i * 12, h * 0.35, 6, h * 0.4);
    ctx.fillStyle = '#c4161c';
    ctx.beginPath(); ctx.arc(w * 0.33, h * 0.32, 9, 0, Math.PI * 2); ctx.fill();
    // tiger stripes along edge
    ctx.fillStyle = '#f08a1c';
    ctx.fillRect(0, h - 26, w, 26);
    ctx.fillStyle = '#111';
    for (let x = 0; x < w; x += 22) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 8, h - 26); ctx.lineTo(x + 14, h); ctx.fill(); }
  } else if (kind === 'telco') {
    ctx.fillStyle = P.linGrad(ctx, 0, 0, w, 0, [[0, spec.c1], [1, spec.c2]]);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.arc(w * 0.82, h * 0.5, 30 + i * 26, -1.2, 1.2); ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke();
    }
    // person on phone
    P.posterFace(ctx, w * 0.82, h * 0.48, h * 0.5, rng, { angry: false, mustache: false });
  } else if (kind === 'realestate') {
    ctx.fillStyle = P.linGrad(ctx, 0, 0, 0, h, [[0, '#ffefd0'], [1, '#ffb76b']]);
    ctx.fillRect(0, 0, w, h);
    // tower renders
    for (let i = 0; i < 4; i++) {
      const bx = w * 0.62 + i * w * 0.09, bh = h * rng.range(0.5, 0.85);
      ctx.fillStyle = P.linGrad(ctx, bx, 0, bx + w * 0.08, 0, [[0, '#4a90c8'], [1, '#1d4e7e']]);
      ctx.fillRect(bx, h - bh, w * 0.08, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let y = h - bh + 6; y < h; y += 8) ctx.fillRect(bx + 3, y, w * 0.08 - 6, 2);
    }
    ctx.fillStyle = '#1fae4b';
    ctx.fillRect(0, h * 0.86, w, h * 0.14);
  } else if (kind === 'tea') {
    ctx.fillStyle = P.linGrad(ctx, 0, 0, 0, h, [[0, '#7a1d0c'], [1, '#2a0904']]);
    ctx.fillRect(0, 0, w, h);
    // tea cup
    const cx = w * 0.78, cy = h * 0.6;
    ctx.fillStyle = '#f4f0e6';
    ctx.beginPath(); ctx.moveTo(cx - 50, cy - 30); ctx.lineTo(cx + 50, cy - 30); ctx.lineTo(cx + 36, cy + 40); ctx.lineTo(cx - 36, cy + 40); ctx.fill();
    ctx.fillStyle = '#b5651d';
    ctx.beginPath(); ctx.ellipse(cx, cy - 30, 50, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(cx - 20 + i * 20, cy - 45);
      ctx.bezierCurveTo(cx - 30 + i * 20, cy - 65, cx - 10 + i * 20, cy - 75, cx - 20 + i * 20, cy - 95); ctx.stroke();
    }
  } else if (kind === 'concert') {
    ctx.fillStyle = '#0b0a1f';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = `rgba(${rng.pick(['255,46,136', '32,213,255', '255,176,0'])},0.35)`;
      ctx.beginPath(); ctx.moveTo(w * 0.5, h); ctx.lineTo(rng.range(0, w), 0); ctx.lineTo(rng.range(0, w), 0); ctx.fill();
    }
    // guitarist silhouette
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(w * 0.78, h * 0.35, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(w * 0.78 - 14, h * 0.4, 28, h * 0.45);
    ctx.save(); ctx.translate(w * 0.78, h * 0.62); ctx.rotate(-0.5);
    ctx.fillRect(-60, -5, 90, 10);
    ctx.beginPath(); ctx.ellipse(30, 0, 22, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (kind === 'mosquito') {
    ctx.fillStyle = P.linGrad(ctx, 0, 0, 0, h, [[0, '#1aa260'], [1, '#05502b']]);
    ctx.fillRect(0, 0, w, h);
    // coil spiral
    ctx.strokeStyle = '#2b5e2b';
    ctx.lineWidth = 7;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 8; a += 0.1) {
      const r = 6 + a * 4;
      ctx.lineTo(w * 0.8 + Math.cos(a) * r, h * 0.52 + Math.sin(a) * r * 0.8);
    }
    ctx.stroke();
    // angry mosquito with X eyes
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(w * 0.62, h * 0.3, 18, 7, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(w * 0.62, h * 0.3); ctx.lineTo(w * 0.6 - 14 + i * 14, h * 0.3 + 20); ctx.stroke(); }
  } else if (kind === 'metro') {
    ctx.fillStyle = '#f2f3f1';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0f7a43';
    ctx.fillRect(0, h * 0.7, w, h * 0.08);
    ctx.fillStyle = '#d4202a';
    ctx.fillRect(0, h * 0.78, w, h * 0.04);
    // train nose
    ctx.fillStyle = '#e2e5e3';
    ctx.beginPath(); ctx.moveTo(w * 0.55, h * 0.68); ctx.lineTo(w * 0.95, h * 0.68); ctx.lineTo(w * 0.95, h * 0.3); ctx.quadraticCurveTo(w * 0.6, h * 0.25, w * 0.55, h * 0.68); ctx.fill();
    ctx.fillStyle = '#1a222a';
    ctx.beginPath(); ctx.moveTo(w * 0.62, h * 0.48); ctx.lineTo(w * 0.93, h * 0.48); ctx.lineTo(w * 0.93, h * 0.34); ctx.quadraticCurveTo(w * 0.68, h * 0.32, w * 0.62, h * 0.48); ctx.fill();
  } else if (kind === 'food') {
    ctx.fillStyle = P.linGrad(ctx, 0, 0, 0, h, [[0, '#ffcf33'], [1, '#e8561c']]);
    ctx.fillRect(0, 0, w, h);
    // biryani handi
    const cx = w * 0.78, cy = h * 0.62;
    ctx.fillStyle = '#7a4a1d';
    ctx.beginPath(); ctx.ellipse(cx, cy, 70, 50, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f7e7b5';
    ctx.beginPath(); ctx.ellipse(cx, cy - 34, 62, 18, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = rng.pick(['#f2c230', '#ffffff', '#e89a2a']);
      ctx.fillRect(cx + rng.range(-50, 50), cy - 34 + rng.range(-10, 10), 4, 2);
    }
    ctx.fillStyle = '#8a3b1d';
    ctx.beginPath(); ctx.arc(cx + 10, cy - 38, 12, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = P.linGrad(ctx, 0, 0, w, h, [[0, spec.c1 || '#1d5fa8'], [1, spec.c2 || '#0b1f3d']]);
    ctx.fillRect(0, 0, w, h);
  }
  // title block
  const tx = spec.tx ?? w * 0.36;
  P.signText(ctx, title, tx, h * (spec.ty ?? 0.2), {
    font: spec.titleFont || `700 ${Math.round(h * 0.2)}px ${P.FONT_BN}`,
    fill: spec.tc || '#ffe14a', stroke: spec.ts || '#7a0716', lw: Math.round(h * 0.035), shadow: 'rgba(0,0,0,0.6)', shadowOff: 4, maxW: w * 0.66,
  });
  if (sub) {
    P.signText(ctx, sub, tx, h * (spec.sy ?? 0.82), {
      font: spec.subFont || `700 ${Math.round(h * 0.085)}px ${P.FONT_BN_SANS}`,
      fill: spec.sc || '#ffffff', stroke: 'rgba(0,0,0,0.75)', lw: 3, maxW: w * 0.66,
    });
  }
  if (tag) {
    ctx.fillStyle = spec.tagBg || '#ffe14a';
    ctx.fillRect(0, h * 0.04, w * 0.22, h * 0.1);
    P.signText(ctx, tag, w * 0.11, h * 0.09, { font: `400 ${Math.round(h * 0.06)}px ${P.FONT_SIGN}`, fill: '#111', stroke: null, lw: 0, maxW: w * 0.2 });
  }
  grain(ctx, 0, 0, w, h, 0.14);
  P.blotches(ctx, 0, 0, w, h, rng, 6, 'rgba(0,0,0,0.12)', 20, 60);
  // painted frame
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, w - 6, h - 6);
}

export const BILLBOARDS = [
  { id: 'ononto', kind: 'action', title: 'অনন্ত ৩', sub: 'অসম্ভব বলে কিছু নাই • আসছে ঈদে', tag: 'IN CINEMAS', tc: '#ffe14a' },
  { id: 'mastan', kind: 'action', title: 'মাস্তান নং ১', sub: 'মধুমিতা হলে চলিতেছে', tag: 'HOUSEFULL' },
  { id: 'kolija', kind: 'romance', title: 'কলিজা ২', sub: 'প্রেম • অ্যাকশন • ট্র্যাজেডি', tag: 'SUPERHIT', tc: '#ffffff', ts: '#c4162a' },
  { id: 'taj', kind: 'romance', title: 'প্রেমের তাজমহল', sub: 'বলাকা সিনেমা হলে', tag: 'NEW', tc: '#fff6c8', ts: '#7a0c3a' },
  { id: 'gfun', kind: 'telco', title: 'গ্রামীণফান', sub: 'কাছে থাকুন, জ্যামে থাকুন', c1: '#1aa0d8', c2: '#0a4f8a', tc: '#ffffff', ts: '#0a2f5a', tag: '4.5G*' },
  { id: 'teletalk', kind: 'telco', title: 'টেলিটক', sub: 'সিগন্যাল আসছে... আসছে...', c1: '#f28c1c', c2: '#b8320a', tc: '#ffffff', ts: '#5a1a05' },
  { id: 'swapno', kind: 'realestate', title: 'স্বপ্ন নিবাস', sub: 'পূর্বাচলে ৩ বেড, বুকিং মাত্র ৫ লাখ!', tc: '#1d4e7e', ts: '#ffffff', tag: 'RAJUK OK' },
  { id: 'tea', kind: 'tea', title: 'মির্জাপুরী চা', sub: 'এক কাপে জ্যাম শেষ', tc: '#ffd23a', ts: '#3a0b03' },
  { id: 'bpl', kind: 'cricket', title: 'BPL ফাইনাল', sub: 'ঢাকা vs চট্টগ্রাম • মিরপুর, রাত ৭টা', tc: '#ffffff', ts: '#0b3d22', tx: 0.62, tag: 'LIVE' },
  { id: 'band', kind: 'concert', title: 'ধানমন্ডি ডিস্টরশন', sub: 'লাইভ • রবীন্দ্র সরোবর • শুক্রবার', tc: '#ff2e88', ts: '#000000', tag: 'ROCK NIGHT', tagBg: '#20d5ff' },
  { id: 'coil', kind: 'mosquito', title: 'মশা মারো কয়েল', sub: 'ডেঙ্গু থেকে দূরে থাকুন', tc: '#ffffff', ts: '#05301a' },
  { id: 'metro', kind: 'metro', title: 'মেট্রোরেল', sub: 'উত্তরা থেকে মতিঝিল ৩৮ মিনিটে', tc: '#0f7a43', ts: '#ffffff', tx: 0.3 },
  { id: 'kacchi', kind: 'food', title: 'কাচ্চি ডাইন', sub: 'বাসমতি নয়, চিনিগুঁড়া!', tc: '#7a0716', ts: '#ffffff' },
  { id: 'pathaw', kind: 'plain', title: 'PATHAW', titleFont: '400 52px "Bungee", Impact, sans-serif', sub: 'বাইকে চলো, জ্যাম ভুলো', c1: '#e01f3d', c2: '#7a0716', tc: '#ffffff', ts: '#000' },
  { id: 'walto', kind: 'plain', title: 'ওয়াল্টু ফ্রিজ', sub: 'দেশের ফ্রিজ, দেশের গর্ব', c1: '#1d5fa8', c2: '#06224a', tc: '#ffffff', ts: '#000' },
  { id: 'rong', kind: 'plain', title: 'রঙ ফ্যাশন', sub: 'পহেলা বৈশাখ কালেকশন ১৪৩৩', c1: '#c8102e', c2: '#f2b81f', tc: '#ffffff', ts: '#5a0510' },
  { id: 'safety', kind: 'plain', title: 'একটি দুর্ঘটনা', sub: 'সারা জীবনের কান্না • গতি নিয়ন্ত্রণ করুন', c1: '#f2c230', c2: '#d18a00', tc: '#c8102e', ts: '#ffffff' },
  { id: 'dana', kind: 'plain', title: 'ডানা এয়ারলাইন্স', sub: 'দেরি হলেও পৌঁছাবেন', c1: '#0f7a43', c2: '#04301a', tc: '#ffffff', ts: '#d4202a', tag: 'FLY HOME' },
  { id: 'chanachur', kind: 'plain', title: 'ঝাল চানাচুর', sub: 'মুখে আগুন, মনে শান্তি', c1: '#ff4d1a', c2: '#8a1010', tc: '#ffe14a', ts: '#000' },
  { id: 'jfp', kind: 'realestate', title: 'যমুনা ফিউচার পার্ক', sub: 'মেগা সেল • ৭০% পর্যন্ত ছাড়', tc: '#c8102e', ts: '#ffffff' },
  { id: 'hatir', kind: 'plain', title: 'ওয়াটার ট্যাক্সি', sub: 'হাতিরঝিল • মাত্র ২০ টাকা', c1: '#20d5ff', c2: '#0b3d6b', tc: '#ffffff', ts: '#04203a' },
  { id: 'coaching', kind: 'plain', title: 'এ+ ফ্যাক্টরি', sub: 'মেডিকেল ভর্তি কোচিং • ১০০% গ্যারান্টি*', c1: '#5b2a86', c2: '#25103a', tc: '#ffe14a', ts: '#000' },
];

function roadSign(ctx, w, h, kind) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#e8e6df';
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, r = w * 0.44;
  if (kind.startsWith('speed')) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d4202a';
    ctx.lineWidth = w * 0.09;
    ctx.beginPath(); ctx.arc(cx, cy, r - w * 0.045, 0, Math.PI * 2); ctx.stroke();
    P.signText(ctx, bnNum(kind.slice(5)), cx, cy + 4, { font: `700 ${Math.round(w * 0.36)}px ${P.FONT_BN_SANS}`, fill: '#111', stroke: null, lw: 0 });
  } else if (kind === 'slow') {
    ctx.fillStyle = '#f2c230';
    ctx.beginPath(); ctx.moveTo(cx, 4); ctx.lineTo(w - 4, cy); ctx.lineTo(cx, h - 4); ctx.lineTo(4, cy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.stroke();
    P.signText(ctx, 'আস্তে', cx, cy - 10, { font: `700 ${Math.round(w * 0.2)}px ${P.FONT_BN}`, fill: '#111', stroke: null, lw: 0 });
    P.signText(ctx, 'চলুন', cx, cy + 16, { font: `700 ${Math.round(w * 0.2)}px ${P.FONT_BN}`, fill: '#111', stroke: null, lw: 0 });
  } else if (kind === 'nohorn') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    // horn icon
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.moveTo(cx - 24, cy - 8); ctx.lineTo(cx - 8, cy - 8); ctx.lineTo(cx + 18, cy - 22); ctx.lineTo(cx + 18, cy + 22); ctx.lineTo(cx - 8, cy + 8); ctx.lineTo(cx - 24, cy + 8); ctx.fill();
    ctx.strokeStyle = '#d4202a';
    ctx.lineWidth = w * 0.09;
    ctx.beginPath(); ctx.arc(cx, cy, r - w * 0.045, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - r * 0.7, cy - r * 0.7); ctx.lineTo(cx + r * 0.7, cy + r * 0.7); ctx.stroke();
  } else if (kind === 'school') {
    ctx.fillStyle = '#d4202a';
    ctx.beginPath(); ctx.moveTo(cx, 6); ctx.lineTo(w - 6, h - 10); ctx.lineTo(6, h - 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(cx, 22); ctx.lineTo(w - 20, h - 18); ctx.lineTo(20, h - 18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(cx - 10, h * 0.5, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 10, h * 0.55, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - 15, h * 0.56, 10, 22);
    ctx.fillRect(cx + 6, h * 0.6, 8, 18);
  } else if (kind === 'bump') {
    ctx.fillStyle = '#f2c230';
    ctx.beginPath(); ctx.moveTo(cx, 6); ctx.lineTo(w - 6, h - 10); ctx.lineTo(6, h - 10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(cx, h * 0.72, 30, 12, 0, Math.PI, 0); ctx.fill();
    P.signText(ctx, 'স্পিড ব্রেকার', cx, h - 22, { font: `700 ${Math.round(w * 0.1)}px ${P.FONT_BN_SANS}`, fill: '#111', stroke: null, lw: 0 });
  } else if (kind === 'works') {
    // yellow diamond with a traffic cone
    ctx.fillStyle = '#f2c230';
    ctx.beginPath(); ctx.moveTo(cx, 4); ctx.lineTo(w - 4, cy); ctx.lineTo(cx, h - 4); ctx.lineTo(4, cy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#e8551a';
    ctx.beginPath(); ctx.moveTo(cx, cy - 22); ctx.lineTo(cx + 15, cy + 16); ctx.lineTo(cx - 15, cy + 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - 9, cy - 2, 18, 6);
    ctx.fillStyle = '#111';
    ctx.fillRect(cx - 20, cy + 16, 40, 6);
  } else if (kind === 'cross') {
    // blue disc, white arrow bending to the right: the other carriageway is on the right
    ctx.fillStyle = '#1456b8';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = w * 0.04; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy + 28); ctx.lineTo(cx - 22, cy - 2); ctx.lineTo(cx + 2, cy - 22); ctx.lineTo(cx + 2, cy - 34);
    ctx.lineTo(cx + 28, cy - 14); ctx.lineTo(cx + 2, cy + 6); ctx.lineTo(cx + 2, cy - 6); ctx.lineTo(cx - 8, cy + 4); ctx.lineTo(cx - 8, cy + 28);
    ctx.closePath(); ctx.fill();
  } else if (kind.startsWith('dist')) {
    // distance plate under a warning sign
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 5; ctx.strokeRect(3, 3, w - 6, h - 6);
    P.signText(ctx, kind.slice(4), cx, cy - 6, { font: `700 ${Math.round(w * 0.34)}px ${P.FONT_BN_SANS}`, fill: '#111', stroke: null, lw: 0 });
    P.signText(ctx, 'M', cx, cy + 26, { font: `700 ${Math.round(w * 0.2)}px ${P.FONT_BN_SANS}`, fill: '#111', stroke: null, lw: 0 });
  } else if (kind === 'kmpost') {
    ctx.fillStyle = '#f4f4f0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d4202a';
    ctx.fillRect(0, 0, w, h * 0.35);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
}

export function buildSignAtlas() {
  const A = new Atlas(2048, { emissive: false });
  const rng = new RNG('signs');
  SHOP_SIGNS.forEach((s, i) => A.add('shop' + i, 320, 80, (ctx) => shopSign(ctx, 320, 80, new RNG('s' + i), s, false)));
  SHOP_SIGNS_EN.forEach((s, i) => A.add('shopen' + i, 320, 80, (ctx) => shopSign(ctx, 320, 80, new RNG('se' + i), s, true)));
  BILLBOARDS.forEach((b, i) => {
    A.add('bb_' + b.id, 384, 192, (ctx) => {
      const spec = { ...b };
      if (typeof spec.tx === 'number' && spec.tx <= 1) spec.tx = spec.tx * 384;
      poster(ctx, 384, 192, new RNG('bb' + i), spec);
    }, { wrap: false });
  });
  ['speed40', 'speed60', 'speed80', 'slow', 'nohorn', 'school', 'bump', 'works', 'cross', 'dist800', 'dist500', 'dist250', 'kmpost'].forEach((k) => {
    A.add('rs_' + k, 96, 96, (ctx) => roadSign(ctx, 96, 96, k), { wrap: false });
  });
  // LED scrolling sign (red dots)
  A.add('led', 256, 48, (ctx) => {
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, 256, 48);
    P.signText(ctx, 'স্বাগতম • WELCOME • ঢাকা', 128, 25, { font: `700 26px ${P.FONT_BN_SANS}`, fill: '#ff2a1a', stroke: null, lw: 0 });
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    for (let x = 0; x < 256; x += 3) ctx.fillRect(x, 0, 1, 48);
    for (let y = 0; y < 48; y += 3) ctx.fillRect(0, y, 256, 1);
  });
  A.shopCount = SHOP_SIGNS.length;
  A.shopEnCount = SHOP_SIGNS_EN.length;
  return A;
}

// A fork/gantry sign texture, made on demand.
export function makeGantryTexture(left, right) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0d6b3d';
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 1004, 236);
  ctx.beginPath(); ctx.moveTo(512, 24); ctx.lineTo(512, 232); ctx.lineWidth = 4; ctx.stroke();
  const half = (x, d, flip) => {
    // arrow
    ctx.fillStyle = '#fff';
    ctx.save();
    ctx.translate(x + (flip ? 430 : 70), 128);
    ctx.scale(flip ? -1 : 1, 1);
    ctx.beginPath();
    ctx.moveTo(-40, 0); ctx.lineTo(0, -40); ctx.lineTo(0, -18); ctx.lineTo(36, -18); ctx.lineTo(36, 18); ctx.lineTo(0, 18); ctx.lineTo(0, 40);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    const tx = x + 250;
    P.signText(ctx, d.bn, tx, 96, { font: `700 64px ${P.FONT_BN_SANS}`, fill: '#fff', stroke: null, lw: 0, maxW: 300 });
    P.signText(ctx, d.en.toUpperCase(), tx, 172, { font: `400 40px ${P.FONT_SIGN}`, fill: '#ffe14a', stroke: null, lw: 0, maxW: 300 });
  };
  half(0, left, false);
  half(512, right, true);
  return cv;
}

export function makeBannerTexture(lines, opts = {}) {
  const cv = document.createElement('canvas');
  cv.width = opts.w || 1024; cv.height = opts.h || 192;
  const ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  ctx.fillStyle = P.linGrad(ctx, 0, 0, 0, h, [[0, opts.c1 || '#c8102e'], [1, opts.c2 || '#7a0716']]);
  ctx.fillRect(0, 0, w, h);
  P.scallopBorder(ctx, 10, 10, w - 20, h - 20, opts.border || '#ffb000', '#ffffff', 12);
  for (const [fx, fy] of [[34, h / 2], [w - 34, h / 2]]) P.flower(ctx, fx, fy, 22, 8, ['#ffb000', '#ffffff', '#1fae4b'], 0.3);
  P.signText(ctx, lines[0], w / 2, h * 0.38, { font: `700 ${Math.round(h * 0.34)}px ${P.FONT_BN}`, fill: opts.tc || '#ffe14a', stroke: '#000', lw: 6, shadow: 'rgba(0,0,0,0.5)', maxW: w - 140 });
  if (lines[1]) P.signText(ctx, lines[1], w / 2, h * 0.76, { font: `400 ${Math.round(h * 0.2)}px ${P.FONT_SIGN}`, fill: '#ffffff', stroke: '#000', lw: 4, maxW: w - 140 });
  return cv;
}
