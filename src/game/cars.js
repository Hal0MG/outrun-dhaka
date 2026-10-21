// Player vehicles. Built from extruded side profiles + primitives, with a
// clear-coat paint that reflects a sky-gradient environment map.

import * as THREE from 'three';
import { buildCNG, buildRickshaw } from './vehicles.js';
import * as P from '../world/paint.js';
import { loftCar, loftToGeometry, BODIES } from './carbody.js';
import { playerParts } from './carassets.js';

// player cars are the refitted CC0 pack meshes
const PACK = {
  rosso: ['roadster', { L: 4.5, W: 1.96, H: 1.22 }],
  premio: ['sedan', { L: 4.6, W: 1.76, H: 1.45 }],
  supra: ['sports', { L: 4.5, W: 1.82, H: 1.3 }],
  skyline: ['muscle_2', { L: 4.6, W: 1.8, H: 1.36 }],
  celica: ['muscle', { L: 4.4, W: 1.78, H: 1.32 }],
  chaser: ['sedan', { L: 4.75, W: 1.77, H: 1.4 }],
  miata: ['roadster', { L: 3.95, W: 1.75, H: 1.25 }],
};

export const CARS = [
  {
    id: 'rosso', name: 'ROSSO 86', bn: 'রোসো ৮৬', tag: 'FLAT-12 · 1986 · RIGHT-HAND DRIVE',
    blurb: 'Flat-twelve wedge, right-hand drive, imported in 1989 by an uncle nobody talks about.',
    top: 290, accel: 1.05, grip: 0.82, width: 1.98, length: 4.5,
    colors: ['#c8102e', '#f2f0ea', '#111318', '#ffb000', '#1d5fa8'],
  },
  {
    id: 'premio', name: 'UNCLE PREMIO', bn: 'আঙ্কেল প্রিমিও', tag: '1.8 VVT-i · TISSUE BOX INCLUDED',
    blurb: 'The official car of Dhaka uncles. Tissue box on the rear shelf. Indestructible.',
    top: 190, accel: 0.92, grip: 0.95, width: 1.74, length: 4.6,
    colors: ['#f2f2ee', '#b9bcc0', '#1c1c1e', '#7a1d22', '#2b4a6b'],
  },
  {
    id: 'cng', name: 'CNG TURBO', bn: 'সিএনজি টার্বো', tag: 'THREE WHEELS · ONE CAGE · ZERO FEAR',
    blurb: 'Three wheels, one cage, zero fear. Squeezes through gaps that do not exist.',
    top: 95, accel: 1.2, grip: 0.88, width: 1.4, length: 2.7,
    colors: ['#1f8a3c', '#ffb000', '#c8102e', '#1d5fa8', '#111318'],
  },
  {
    id: 'supra', name: 'SUPRA MK4', tag: '', blurb: '', engine: 'i6',
    top: 285, accel: 1.0, grip: 0.9, width: 1.81, length: 4.52,
    colors: ['#ff6a00', '#e8e4da', '#111318', '#1d4fd8', '#c8102e'],
  },
  {
    id: 'skyline', name: 'SKYLINE R34', tag: '', blurb: '', engine: 'rb',
    top: 265, accel: 1.05, grip: 1.0, width: 1.79, length: 4.6,
    colors: ['#1d4fd8', '#c0c4cc', '#111318', '#f2f2ee', '#6b6f78'],
  },
  {
    id: 'celica', name: 'CELICA', tag: '', blurb: '', engine: 'i4t',
    top: 225, accel: 0.95, grip: 0.92, width: 1.74, length: 4.34,
    colors: ['#ffd200', '#c8102e', '#f2f2ee', '#111318', '#1d4fd8'],
  },
  {
    id: 'chaser', name: 'CHASER', tag: '', blurb: '', engine: 'i6',
    top: 245, accel: 0.9, grip: 0.86, width: 1.76, length: 4.72,
    colors: ['#f2f2ee', '#111318', '#1d4fd8', '#6b6f78', '#2f8f4e'],
  },
  {
    id: 'miata', name: 'MX-5', tag: '', blurb: '', engine: 'i4t',
    top: 215, accel: 1.0, grip: 1.05, width: 1.73, length: 3.92,
    colors: ['#c8102e', '#f2f2ee', '#111318', '#ffb000', '#22d3ee'],
  },
  {
    id: 'rickshaw', name: 'RICKSHAW 9000', bn: 'রিকশা ৯০০০', tag: 'HAND-PAINTED · JET-ASSISTED',
    blurb: 'Hand-painted, jet-assisted. The puller has not been told. Unlocks after your first goal.',
    top: 250, accel: 1.12, grip: 0.7, width: 1.15, length: 2.6, locked: true,
    colors: ['#c8102e', '#1d5fa8', '#118a4a', '#ffb000', '#7b2f9e'],
  },
];

// ------------------------------------------------------------ environment map from the sky colours
export function makeEnvMap(renderer, S, old) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const ctx = cv.getContext('2d');
  const hex = (c) => '#' + c.clone().convertLinearToSRGB().getHexString();
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, hex(S.zen));
  g.addColorStop(0.42, hex(S.hor));
  g.addColorStop(0.5, hex(S.fog));
  g.addColorStop(0.56, '#2a2622');
  g.addColorStop(1, '#141210');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);
  // a bright band for the sun / city glow
  const sx = 64;
  const sg = ctx.createRadialGradient(sx, 56, 2, sx, 56, 50);
  sg.addColorStop(0, hex(S.sun.clone().multiplyScalar(Math.min(1, S.sunI))));
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, 256, 128);
  // streetlights as streaks
  ctx.fillStyle = `rgba(255,200,140,${0.6 * S.lamps})`;
  for (let i = 0; i < 12; i++) ctx.fillRect(i * 22, 40 + (i % 3) * 3, 6, 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromEquirectangular(tex);
  pm.dispose();
  tex.dispose();
  if (old) old.dispose();
  return rt;
}

function plateTexture(text) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f4f4ec';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 252, 60);
  P.signText(ctx, 'ঢাকা মেট্রো-গ', 128, 20, { font: `700 22px ${P.FONT_BN_SANS}`, fill: '#111', stroke: null, lw: 0 });
  P.signText(ctx, text, 128, 46, { font: `700 28px ${P.FONT_BN_SANS}`, fill: '#111', stroke: null, lw: 0 });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function stickerTexture(text, bg = 'rgba(0,0,0,0)', fg = '#ffffff') {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 96;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 96);
  P.signText(ctx, text, 256, 50, { font: `700 64px ${P.FONT_BN}`, fill: fg, stroke: 'rgba(0,0,0,0.6)', lw: 4, maxW: 490 });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// extrude a side profile (u along length, +u = front; v up) across the width
function profileBody(points, arches, width, bevel = 0.05) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  // bottom: from rear to front, bulging over the wheels
  const yb = points[points.length - 1][1];
  for (const [cu, r] of arches) {
    shape.lineTo(cu - r, yb);
    shape.absarc(cu, yb, r, Math.PI, 0, true);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 10 });
  geo.translate(0, 0, -(width - bevel * 2) / 2);
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function wheelMesh(r, w, tyreMat, rimMat) {
  const g = new THREE.Group();
  // tyre with rounded shoulders
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w * 0.82, 32, 1, true), tyreMat);
  tyre.rotation.z = Math.PI / 2;
  g.add(tyre);
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.TorusGeometry(r * 0.86, r * 0.13, 6, 32), tyreMat);
    wall.rotation.y = Math.PI / 2;
    wall.position.x = sx * w * 0.41;
    g.add(wall);
  }
  // dished rim: barrel, lip ring, ten split spokes, centre cap with lugs
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.7, w * 0.9, 24, 1, true), rimMat);
  barrel.rotation.z = Math.PI / 2;
  g.add(barrel);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(r * 0.7, 0.012, 4, 28), rimMat);
  lip.rotation.y = Math.PI / 2;
  lip.position.x = w * 0.46;
  g.add(lip);
  const dark = wheelMesh.dark || (wheelMesh.dark = new THREE.MeshStandardMaterial({ color: '#151618', metalness: 0.4, roughness: 0.6 }));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r * 0.69, 24), dark);
  disc.rotation.y = Math.PI / 2;
  disc.position.x = w * 0.2;
  g.add(disc);
  const spokeGeo = new THREE.BoxGeometry(0.03, r * 0.62, 0.035);
  spokeGeo.translate(0, r * 0.34, 0);
  for (let i = 0; i < 10; i++) {
    const sp = new THREE.Mesh(spokeGeo, rimMat);
    sp.rotation.x = (i / 10) * Math.PI * 2 + (i % 2 ? 0.1 : -0.1);
    sp.position.x = w * 0.4;
    g.add(sp);
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.13, r * 0.15, 0.05, 12), rimMat);
  cap.rotation.z = Math.PI / 2;
  cap.position.x = w * 0.44;
  g.add(cap);
  return g;
}

function headOf(skin, hair, opts = {}) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 }));
  g.add(head);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.128, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: hair, roughness: 0.6 }));
  h.position.y = 0.01;
  g.add(h);
  if (opts.long) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.08), new THREE.MeshStandardMaterial({ color: hair, roughness: 0.6 }));
    hl.position.set(0, -0.12, 0.09);
    g.add(hl);
  }
  if (opts.flower) {
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.15, 0.15) }));
    fl.position.set(0.1, 0.07, 0.04);
    g.add(fl);
  }
  if (opts.shades) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.04), new THREE.MeshStandardMaterial({ color: '#050505', metalness: 0.9, roughness: 0.1 }));
    s.position.set(0, 0.015, -0.11);
    g.add(s);
  }
  return g;
}

// Build a player vehicle. Returns an object with the scene group and animated parts.
export function buildPlayerCar(def, colorHex, assets) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color: colorHex, metalness: 0.35, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 });
  const black = new THREE.MeshStandardMaterial({ color: '#0c0c0e', roughness: 0.55, metalness: 0.2 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#d8dadd', metalness: 1, roughness: 0.15 });
  const tyreMat = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 0.9, roughness: 0.25 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#223', metalness: 0, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.35 });
  const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.05, 0.03) });
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.4, 2.1) });
  const amberMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.2, 0.2) });
  const caliperMat = new THREE.MeshStandardMaterial({ color: '#c8102e', roughness: 0.4, metalness: 0.3 });
  const leather = new THREE.MeshStandardMaterial({ color: '#1a1414', roughness: 0.5, metalness: 0.1 });
  const piping = new THREE.MeshStandardMaterial({ color: '#c49a6c', roughness: 0.6 });
  const out = { group, body, paint, wheels: [], front: [], popups: [], tailMat, headMat, exhaust: [], seats: [], def };
  const skin = paint.clone();
  skin.vertexColors = true;
  const lofted = (key) => {
    const b = loftCar({ ...BODIES[key], stations: 80 });
    const m = new THREE.Mesh(loftToGeometry(b), skin);
    body.add(m);
    return b;
  };
  // height of the top surface at a z position (for sitting parts on the skin)
  const topAt = (b, z) => {
    let best = b.rows[0];
    for (const r of b.rows) if (Math.abs(r.z - z) < Math.abs(best.z - z)) best = r;
    return best.pts[15][1];
  };

  const addWheel = (x, y, z, r, w, front) => {
    const wm = wheelMesh(r, w, tyreMat, rimMat);
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    pivot.add(wm);
    const cal = new THREE.Mesh(new THREE.BoxGeometry(0.06, r * 0.5, r * 0.32), caliperMat);
    cal.position.set(Math.sign(x) * w * 0.12, r * 0.25, front ? r * 0.25 : -r * 0.25);
    pivot.add(cal);
    body.add(pivot);
    out.wheels.push(wm);
    if (front) out.front.push(pivot);
    return pivot;
  };

  if (PACK[def.id]) {
    const [model, fit] = PACK[def.id];
    const parts = playerParts(model, fit);
    skin.vertexColors = true;
    if (parts.paint) body.add(new THREE.Mesh(parts.paint, skin));
    if (parts.rest) body.add(new THREE.Mesh(parts.rest, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.1 })));
    if (parts.head) body.add(new THREE.Mesh(parts.head, headMat));
    if (parts.tail) body.add(new THREE.Mesh(parts.tail, tailMat));
    const wmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 });
    for (const w of parts.wheels) {
      const pivot = new THREE.Group();
      pivot.position.set(w.cx, w.cy, w.cz);
      const m = new THREE.Mesh(w.geo, wmat);
      pivot.add(m);
      body.add(pivot);
      out.wheels.push(m);
      if (w.front) out.front.push(pivot);
    }
    const d = parts.dims;
    const rear = d.len / 2;
    for (const [z, rot, txt] of [[parts.plates.rz + 0.012, 0, '১১-৪২০৪'], [parts.plates.fz - 0.012, Math.PI, '১১-৪২০৪']]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.13), new THREE.MeshBasicMaterial({ map: plateTexture(txt) }));
      pl.position.set(0, parts.plates.y, z);
      pl.rotation.y = rot;
      body.add(pl);
    }
    for (const x of [-d.wid * 0.28, d.wid * 0.28]) out.exhaust.push(new THREE.Vector3(x, 0.25, rear + 0.1));
    const open = def.id === 'rosso' || def.id === 'miata';
    out.driver = headOf('#8a5a3a', '#110d0a', { shades: true });
    out.driver.position.set(0.38, open ? d.hgt * 0.92 : d.hgt * 0.72, d.len * 0.02);
    body.add(out.driver);
    out.passenger = headOf('#a06a45', '#140e0a', { long: true, flower: true });
    out.passenger.position.set(-0.38, open ? d.hgt * 0.9 : d.hgt * 0.7, d.len * 0.02);
    body.add(out.passenger);
    out.headLocal = [new THREE.Vector3(-d.wid * 0.3, 0.6, -rear), new THREE.Vector3(d.wid * 0.3, 0.6, -rear)];
    out.dims = { len: d.len, wid: d.wid, hgt: d.hgt };
  } else if (def.id === 'rosso') {
    const W = 1.98;
    const lb = lofted('rosso');
    // seats (driver on the RIGHT: Bangladesh drives on the left)
    for (const x of [-0.4, 0.4]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.5), leather);
      seat.position.set(x, 0.86, 0.12);
      body.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.4, 0.1), leather);
      back.position.set(x, 1.06, 0.46);
      back.rotation.x = -0.28;
      body.add(back);
      const pipe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.11), piping);
      pipe.position.set(x, 1.25, 0.51);
      pipe.rotation.x = -0.28;
      body.add(pipe);
    }
    // rear deck vents (the flat black engine cover)
    const ventMat = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.4, metalness: 0.5 });
    for (let i = 0; i < 7; i++) {
      const z = 0.87 + i * 0.14;
      const v = new THREE.Mesh(new THREE.BoxGeometry(W - 0.7, 0.02, 0.05), ventMat);
      v.position.set(0, topAt(lb, z) + 0.02, z);
      body.add(v);
    }
    // windscreen
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.25, 0.52), glass);
    ws.position.set(0, 1.03, -0.56);
    ws.rotation.x = -0.95;
    body.add(ws);
    for (const x of [-(W - 0.25) / 2, (W - 0.25) / 2]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.56, 0.04), black);
      pillar.position.set(x, 1.03, -0.56);
      pillar.rotation.x = -0.95;
      body.add(pillar);
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.08), paint);
      mirror.position.set(x * 1.08, 0.98, -0.62);
      body.add(mirror);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(W - 0.22, 0.04, 0.05), black);
    top.position.set(0, 1.24, -0.4);
    body.add(top);
    // steering wheel on the right
    const sw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 18), black);
    sw.position.set(0.4, 1.02, -0.22);
    sw.rotation.x = -0.6;
    body.add(sw);
    out.steeringWheel = sw;
    // side strakes (the cheese-grater)
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 1.5 - i * 0.04), black);
        st.position.set(sx * (W / 2 - 0.005), 0.44 + i * 0.05, 0.25 - i * 0.02);
        body.add(st);
      }
    }
    // rear grille over the light bar
    const rl = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.3, 0.04), tailMat);
    rl.position.set(0, 0.68, 2.28);
    body.add(rl);
    for (let i = 0; i < 5; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(W - 0.16, 0.025, 0.06), black);
      slat.position.set(0, 0.55 + i * 0.065, 2.3);
      body.add(slat);
    }
    // plate
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.13), new THREE.MeshBasicMaterial({ map: plateTexture('৮৬-১৯৮৬') }));
    plate.position.set(0, 0.42, 2.3);
    body.add(plate);
    // exhausts
    for (const x of [-0.55, -0.42, 0.42, 0.55]) {
      const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 10), chrome);
      ex.rotation.x = Math.PI / 2;
      ex.position.set(x, 0.32, 2.27);
      body.add(ex);
      out.exhaust.push(new THREE.Vector3(x, 0.32, 2.4));
    }
    // pop-up headlights
    for (const x of [-0.62, 0.62]) {
      const pv = new THREE.Group();
      pv.position.set(x, 0.66, -1.75);
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.32), paint);
      pod.position.set(0, 0.03, 0.16);
      pv.add(pod);
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.12), headMat);
      lens.position.set(0, -0.04, -0.005);
      lens.rotation.y = Math.PI;
      pv.add(lens);
      body.add(pv);
      out.popups.push(pv);
    }
    for (const x of [-0.75, 0.75]) {
      const fl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.02), amberMat);
      fl.position.set(x, 0.38, -2.29);
      body.add(fl);
    }
    addWheel(-0.84, 0.37, -1.44, 0.37, 0.28, true);
    addWheel(0.84, 0.37, -1.44, 0.37, 0.28, true);
    addWheel(-0.83, 0.37, 1.4, 0.37, 0.34, false);
    addWheel(0.83, 0.37, 1.4, 0.37, 0.34, false);
    // driver + Tuntuni
    out.driver = headOf('#8a5a3a', '#110d0a', { shades: true });
    out.driver.position.set(0.4, 1.47, 0.24);
    body.add(out.driver);
    out.passenger = headOf('#a06a45', '#140e0a', { long: true, flower: true });
    out.passenger.position.set(-0.4, 1.43, 0.26);
    body.add(out.passenger);
    for (const [x, c, y] of [[0.4, '#f4f2ec', 1.17], [-0.4, '#ff2e88', 1.14]]) {
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.24), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
      torso.position.set(x, y, 0.3);
      body.add(torso);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.42), new THREE.MeshStandardMaterial({ color: '#8a5a3a', roughness: 0.7 }));
      arm.position.set(x + (x > 0 ? 0.16 : -0.22), 1.1, 0.02);
      arm.rotation.x = 0.4;
      body.add(arm);
    }
    // Tuntuni's orna (scarf) streaming in the wind
    const scarfGeo = new THREE.PlaneGeometry(0.16, 0.9, 1, 8);
    scarfGeo.translate(0, -0.45, 0);
    scarfGeo.rotateX(-Math.PI / 2);
    const scarf = new THREE.Mesh(scarfGeo, new THREE.MeshStandardMaterial({ color: '#ffb000', side: THREE.DoubleSide, roughness: 0.8 }));
    scarf.position.set(-0.4, 1.36, 0.36);
    body.add(scarf);
    out.scarf = scarf;
    out.scarfBase = Float32Array.from(scarfGeo.getAttribute('position').array);
    out.headLocal = [new THREE.Vector3(-0.62, 0.66, -2.2), new THREE.Vector3(0.62, 0.66, -2.2)];
    out.dims = { len: 4.5, wid: 1.98, hgt: 1.2 };
  } else if (def.id === 'premio') {
    const W = 1.74;
    lofted('premio');
    for (const sx of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 3.4), chrome);
      strip.position.set(sx * (W / 2 - 0.01), 0.6, 0.1);
      body.add(strip);
    }
    for (const x of [-0.6, 0.6]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.04), tailMat);
      tl.position.set(x, 0.68, 2.29);
      body.add(tl);
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.04), headMat);
      hl.position.set(x, 0.58, -2.3);
      body.add(hl);
    }
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.13), new THREE.MeshBasicMaterial({ map: plateTexture('১১-৪২০৪') }));
    plate.position.set(0, 0.48, 2.31);
    body.add(plate);
    // the sticker on the rear window (faces backward, follows the glass slope)
    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.15), new THREE.MeshBasicMaterial({ map: stickerTexture('মায়ের দোয়া'), transparent: true }));
    sticker.position.set(0, 1.2, 1.14);
    sticker.rotation.x = -0.89;
    body.add(sticker);
    // tissue box on the rear shelf
    const tb = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.12), new THREE.MeshStandardMaterial({ color: '#ff7eb6' }));
    tb.position.set(0.35, 0.92, 0.95);
    body.add(tb);
    addWheel(-0.74, 0.32, -1.52, 0.32, 0.23, true);
    addWheel(0.74, 0.32, -1.52, 0.32, 0.23, true);
    addWheel(-0.74, 0.32, 1.38, 0.32, 0.23, false);
    addWheel(0.74, 0.32, 1.38, 0.32, 0.23, false);
    out.driver = headOf('#8a5a3a', '#1a1a1a', {});
    out.driver.position.set(0.4, 1.12, -0.05);
    body.add(out.driver);
    out.passenger = headOf('#a06a45', '#140e0a', { long: true });
    out.passenger.position.set(-0.4, 1.1, -0.05);
    body.add(out.passenger);
    out.exhaust.push(new THREE.Vector3(-0.55, 0.3, 2.35));
    out.headLocal = [new THREE.Vector3(-0.6, 0.62, -2.35), new THREE.Vector3(0.6, 0.62, -2.35)];
    out.dims = { len: 4.6, wid: 1.74, hgt: 1.4 };
  } else if (BODIES[def.id]) {
    // the sports cars: smooth lofted body, same builder as the rivals
    const sp = BODIES[def.id];
    const L = sp.L, W = sp.W, hw = W / 2, z0 = -L / 2;
    const lb = lofted(def.id);
    const rowAt = (u) => { let best = lb.rows[0]; for (const r of lb.rows) if (Math.abs(r.u - u) < Math.abs(best.u - u)) best = r; return best; };
    const tw = 0.27;
    sp.wheels.forEach((u, k) => {
      const z = z0 + u * L;
      for (const x of [-hw + tw / 2 + 0.05, hw - tw / 2 - 0.05]) addWheel(x, sp.r, z, sp.r, tw, k === 0);
    });
    // everything small (lamps, grille, vents, plates, seams, mirrors) comes from the shared detail builder
    const nose = lb.rows[0], tail = lb.rows[lb.rows.length - 1];
    const ny = Math.min(nose.pts[15][1], rowAt(0.04).pts[15][1]) + 0.02;
    const det = sportsCar(assets.fx, def.id, { noBody: true, noWheels: true, tyreW: tw, roundTails: def.id === 'supra' || def.id === 'skyline' ? [0.62, 0.36] : undefined, tailBar: def.id === 'chaser' });
    body.add(new THREE.Mesh(det.body, assets.mats.fx));
    if (det.head) body.add(new THREE.Mesh(det.head, headMat));
    if (det.tail) body.add(new THREE.Mesh(det.tail, tailMat));
    if (det.amber) body.add(new THREE.Mesh(det.amber, amberMat));
    for (const x of [-hw * 0.55, hw * 0.55]) out.exhaust.push(new THREE.Vector3(x, sp.clear + 0.08, tail.z + 0.15));
    // wings
    const wing = (z, y, w, up) => {
      for (const x of up) { const u = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.12), paint); u.position.set(x, y - 0.1, z); body.add(u); }
      const bl = new THREE.Mesh(new THREE.BoxGeometry(w, 0.045, 0.3), paint);
      bl.position.set(0, y, z);
      body.add(bl);
    };
    if (def.id === 'supra') wing(L / 2 - 0.26, 1.1, 1.62, [-0.68, 0.68]);
    if (def.id === 'skyline') wing(L / 2 - 0.3, 1.15, 1.5, [-0.6, 0.6]);
    if (def.id === 'celica') wing(L / 2 - 0.12, 1.0, 1.44, [-0.5, 0.5]);
    // occupants sit in the cabin (visible only in the roadster)
    const cabU = sp.open ? (sp.cockpit[0] + sp.cockpit[1]) / 2 : (sp.glass[0] + sp.glass[1]) / 2;
    const cz = z0 + cabU * L;
    const seatY = (sp.open ? rowAt(cabU).pts[15][1] : (sp.belt ? sp.belt[1][1] : 0.9)) + 0.34;
    out.driver = headOf('#8a5a3a', '#110d0a', { shades: true });
    out.driver.position.set(0.4, sp.open ? seatY + 0.2 : seatY - 0.16, cz);
    body.add(out.driver);
    out.passenger = headOf('#a06a45', '#140e0a', { long: true, flower: true });
    out.passenger.position.set(-0.4, sp.open ? seatY + 0.16 : seatY - 0.2, cz);
    body.add(out.passenger);
    if (sp.open) {
      for (const [x, c, y] of [[0.4, '#f4f2ec', seatY - 0.3], [-0.4, '#ff2e88', seatY - 0.34]]) {
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.24), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
        torso.position.set(x, y, cz + 0.08);
        body.add(torso);
      }
    }
    out.headLocal = [new THREE.Vector3(-0.6, ny - 0.1, nose.z - 0.1), new THREE.Vector3(0.6, ny - 0.1, nose.z - 0.1)];
    out.dims = { len: L, wid: W, hgt: Math.max(...sp.top.map((k) => k[1])) + 0.05 };
  } else {
    // CNG TURBO / RICKSHAW 9000 use the traffic geometry (atlas material) + extras
    const misc = assets.misc;
    const m = def.id === 'cng' ? buildCNG(misc, { turbo: true, color: hexToRGB(colorHex) }) : buildRickshaw(misc, 2);
    const atlasMat = assets.mats.misc;
    body.add(new THREE.Mesh(m.body, atlasMat));
    body.add(new THREE.Mesh(m.tail, tailMat));
    body.add(new THREE.Mesh(m.head, headMat));
    if (m.amber) body.add(new THREE.Mesh(m.amber, amberMat));
    if (def.id === 'rickshaw') {
      // jet engines bolted to the back
      const jetMat = new THREE.MeshStandardMaterial({ color: '#9aa0a6', metalness: 0.9, roughness: 0.3 });
      for (const x of [-0.42, 0.42]) {
        const j = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.9, 16, 1, true), jetMat);
        j.rotation.x = Math.PI / 2;
        j.position.set(x, 0.62, 1.2);
        body.add(j);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.04, 6, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.8, 3.0) }));
        ring.position.set(x, 0.62, 1.66);
        body.add(ring);
        out.exhaust.push(new THREE.Vector3(x, 0.62, 1.8));
      }
      // LED strip under the seat
      const led = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 0.04), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 2) }));
      led.position.set(0, 0.32, 0.8);
      body.add(led);
      out.ledMat = led.material;
    } else {
      out.exhaust.push(new THREE.Vector3(-0.45, 0.3, 1.3), new THREE.Vector3(0.45, 0.3, 1.3));
    }
    out.dims = { len: m.len, wid: m.wid, hgt: m.hgt };
    out.headLocal = [new THREE.Vector3(0, 0.62, -1.2)];
    out.atlasBased = true;
  }

  if (!out.atlasBased && !PACK[def.id]) {
    const W = out.dims.wid, L = out.dims.len;
    for (const sx of [-1, 1]) {
      const sk = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, L * 0.42), black);
      sk.position.set(sx * (W / 2 - 0.01), 0.22, 0);
      body.add(sk);
    }
    const dif = new THREE.Mesh(new THREE.BoxGeometry(W - 0.5, 0.1, 0.3), black);
    dif.position.set(0, 0.2, L / 2 - 0.12);
    body.add(dif);
    for (const x of [-0.3, -0.1, 0.1, 0.3]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.28), black);
      fin.position.set(x, 0.18, L / 2 - 0.08);
      body.add(fin);
    }
    const lipM = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 0.04, 0.18), black);
    lipM.position.set(0, 0.17, -L / 2 + 0.1);
    body.add(lipM);
  }

  // headlight spot (only on at night)
  const spot = new THREE.SpotLight('#fff1d6', 0, 70, 0.55, 0.6, 1.4);
  spot.position.set(0, 0.8, -1.5);
  spot.target.position.set(0, 0, -25);
  group.add(spot);
  group.add(spot.target);
  out.spot = spot;

  // soft contact shadow
  const shTex = shadowTexture();
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(out.dims.wid * 1.5, out.dims.len * 1.3), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0.85 }));
  sh.rotation.x = -Math.PI / 2;
  sh.position.y = 0.02;
  sh.renderOrder = 2;
  group.add(sh);
  out.shadow = sh;
  return out;
}

function hexToRGB(hex) {
  const c = new THREE.Color(hex);
  return [c.r * 1.2, c.g * 1.2, c.b * 1.2];
}

let _shadowTex = null;
function shadowTexture() {
  if (_shadowTex) return _shadowTex;
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 128;
  const ctx = cv.getContext('2d');
  // an ellipse that fades to nothing before it reaches the edge of the card (no hard rectangle)
  ctx.save();
  ctx.scale(1, 2);
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(0,0,0,0.8)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.4)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.restore();
  _shadowTex = new THREE.CanvasTexture(cv);
  return _shadowTex;
}

// a saree caught on the back of the car, streaming in the wind
let _sareeTex = null;
function sareeTexture() {
  if (_sareeTex) return _sareeTex;
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#c8102e'; c.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 3) { c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(0, y, 64, 1); }
  c.fillStyle = '#ffd23a';
  for (let y = 8; y < 256; y += 14) for (let x = 6 + (y % 28 ? 6 : 0); x < 52; x += 12) { c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#ffb000'; c.fillRect(0, 0, 10, 256); c.fillRect(54, 0, 10, 256);
  c.fillStyle = '#1a7a3c'; c.fillRect(3, 0, 3, 256); c.fillRect(58, 0, 3, 256);
  _sareeTex = new THREE.CanvasTexture(cv);
  _sareeTex.colorSpace = THREE.SRGBColorSpace;
  return _sareeTex;
}

export function attachSaree(car) {
  const len = 2.6;
  const geo = new THREE.PlaneGeometry(0.55, len, 1, 14);
  geo.translate(0, -len / 2, 0);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: sareeTexture(), side: THREE.DoubleSide, roughness: 0.85 }));
  const d = car.dims;
  mesh.position.set(0.25, d.hgt * 0.85, d.len * 0.45);
  mesh.visible = false;
  car.body.add(mesh);
  car.saree = mesh;
  car.sareeBase = Float32Array.from(geo.getAttribute('position').array);
}

export function attachBags(car) {
  // shopping bags in Tuntuni's lap (and one on her head, there was no room)
  const g = new THREE.Group();
  const cols = ['#c8102e', '#f2ead6', '#0f7a43', '#ffb000'];
  const x = car.passenger ? car.passenger.position.x : -0.4;
  const y = car.passenger ? car.passenger.position.y - 0.35 : 1.0;
  const z = car.passenger ? car.passenger.position.z - 0.25 : 0;
  cols.forEach((c, i) => {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.12), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
    bag.position.set(x + (i % 2 ? 0.16 : -0.16), y + Math.floor(i / 2) * 0.12, z - i * 0.04);
    bag.rotation.set(0.1 * i, 0.3 * (i - 1.5), 0.15 * (i % 2 ? 1 : -1));
    g.add(bag);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.01, 4, 8, Math.PI), new THREE.MeshStandardMaterial({ color: '#111' }));
    handle.position.copy(bag.position).add(new THREE.Vector3(0, 0.16, 0));
    g.add(handle);
  });
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.14), new THREE.MeshStandardMaterial({ color: '#c8102e', roughness: 0.8 }));
  hat.position.set(x, y + 0.72, z + 0.25);
  hat.rotation.z = 0.25;
  g.add(hat);
  g.visible = false;
  car.body.add(g);
  car.bags = g;
}

export function applyEnv(car, envTex) {
  car.group.traverse((o) => {
    if (o.material && (o.material.isMeshStandardMaterial || o.material.isMeshPhysicalMaterial)) {
      o.material.envMap = envTex;
      o.material.envMapIntensity = 1.1;
      o.material.needsUpdate = true;
    }
  });
}
