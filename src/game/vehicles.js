// Vehicle models. Model space: forward = -Z, right = +X, up = +Y, origin at
// ground centre. The +Z face is the vehicle's REAR (what you see overtaking).
// Each builder returns { body, tail, head, extra?, len, wid, hgt } geometries.

import * as THREE from 'three';
import { MeshBuilder } from '../world/builder.js';

function lights() {
  return { tail: new MeshBuilder(false), head: new MeshBuilder(false), amber: new MeshBuilder(false) };
}

function person(B, misc, x, y, z, opts = {}) {
  const shirt = opts.shirt || [0.92, 0.92, 0.88];
  const skin = opts.skin || [0.55, 0.36, 0.24];
  const w = misc.get('white');
  B.box(x, y, z, 0.4, 0.55, 0.26, 0, { color: shirt, region: w });
  B.box(x, y + 0.55, z, 0.12, 0.08, 0.12, 0, { color: skin, region: w });
  B.box(x, y + 0.63, z, 0.22, 0.24, 0.22, 0, { color: skin, region: w });
  B.box(x, y + 0.8, z + 0.02, 0.23, 0.1, 0.23, 0, { color: opts.hair || [0.08, 0.06, 0.05], region: w });
  if (opts.helmet) B.box(x, y + 0.62, z, 0.3, 0.32, 0.32, 0, { color: opts.helmet, region: w });
}

export function buildRickshaw(misc, variant = 0) {
  const B = new MeshBuilder(true);
  const Lt = lights();
  const w = misc.get('white');
  const tyre = misc.get('tyre'), spokes = misc.get('spokes');
  const metal = misc.get('metal');
  // rear wheels + front wheel
  B.wheel(-0.52, 0.34, 0.62, 0.34, 0.06, 14, [1, 1, 1], tyre, spokes);
  B.wheel(0.52, 0.34, 0.62, 0.34, 0.06, 14, [1, 1, 1], tyre, spokes);
  B.wheel(0, 0.31, -1.05, 0.31, 0.06, 14, [1, 1, 1], tyre, spokes);
  // axle & frame
  B.tube([-0.52, 0.34, 0.62], [0.52, 0.34, 0.62], 0.025, 0.025, 4, [0.2, 0.2, 0.2], metal);
  B.tube([0, 0.34, 0.5], [0, 0.65, -0.55], 0.035, 0.035, 4, [0.85, 0.15, 0.15], metal);
  B.tube([0, 0.65, -0.55], [0, 0.31, -1.05], 0.03, 0.03, 4, [0.85, 0.15, 0.15], metal);
  B.tube([0, 0.95, -0.95], [0, 0.31, -1.05], 0.025, 0.025, 4, [0.6, 0.6, 0.6], metal);
  B.tube([-0.28, 1.0, -0.95], [0.28, 1.0, -0.95], 0.02, 0.02, 4, [0.7, 0.7, 0.7], metal); // handlebar
  // passenger box + seat
  B.box(0, 0.48, 0.45, 1.0, 0.36, 0.62, 0, { color: [0.75, 0.12, 0.15], region: w });
  B.box(0, 0.84, 0.45, 0.96, 0.12, 0.6, 0, { color: [0.9, 0.2, 0.55], region: w });
  B.box(0, 0.84, 0.78, 0.96, 0.5, 0.08, 0, { color: [0.95, 0.75, 0.1], region: w });
  // painted back panel (rickshaw art) facing the car behind
  B.quad([-0.48, 0.42, 0.86], [0.48, 0.42, 0.86], [0.48, 0.86, 0.86], [-0.48, 0.86, 0.86], [0, 0, 1, 1], [1, 1, 1], misc.get('rick_art' + (variant % 6)));
  // folding hood (arched canopy)
  const hood = misc.get('hood' + (variant % 4));
  // profile: rises vertically behind the passengers, then curls forward into a canopy
  const segs = 8;
  const hp = (t) => [0.84 - 0.78 * (1 - Math.cos(t * Math.PI / 2)), 0.88 + 0.74 * Math.sin(t * Math.PI / 2)];
  for (let i = 0; i < segs; i++) {
    const [z0, y0] = hp(i / segs), [z1, y1] = hp((i + 1) / segs);
    // outside (normal backward/up) and inside faces
    B.quad([-0.54, y0, z0], [0.54, y0, z0], [0.54, y1, z1], [-0.54, y1, z1], [0, i / segs, 1, (i + 1) / segs], [1, 1, 1], hood);
    B.quad([0.54, y0, z0], [-0.54, y0, z0], [-0.54, y1, z1], [0.54, y1, z1], [0, i / segs, 1, (i + 1) / segs], [0.55, 0.55, 0.55], hood);
  }
  // side bows of the hood
  for (const x of [-0.55, 0.55]) {
    for (let i = 0; i < segs; i++) {
      const [z0, y0] = hp(i / segs), [z1, y1] = hp((i + 1) / segs);
      B.tube([x, y0, z0], [x, y1, z1], 0.02, 0.02, 3, [0.15, 0.15, 0.15], metal);
    }
  }
  // tassels / fringe
  const tc = [[0.9, 0.1, 0.2], [1, 0.8, 0.1], [0.1, 0.7, 0.3], [1, 0.3, 0.7]];
  for (let i = 0; i < 8; i++) B.box(-0.5 + i * 0.14, 1.52, 0.1, 0.05, 0.14, 0.05, 0, { color: tc[i % 4], region: w });
  // the puller
  person(B, misc, 0, 0.98, -0.6, { shirt: [0.95, 0.95, 0.92] });
  B.box(0, 0.7, -0.62, 0.36, 0.34, 0.3, 0, { color: [0.1, 0.35, 0.6], region: w }); // lungi
  B.box(-0.1, 0.38, -0.78, 0.1, 0.5, 0.1, 0, { color: [0.5, 0.33, 0.22], region: w });
  B.box(0.1, 0.38, -0.66, 0.1, 0.5, 0.1, 0, { color: [0.5, 0.33, 0.22], region: w });
  // passenger(s)
  if (variant % 3 !== 2) person(B, misc, -0.22, 0.9, 0.42, { shirt: variant % 2 ? [0.9, 0.2, 0.5] : [0.2, 0.4, 0.8] });
  if (variant % 2 === 0) person(B, misc, 0.22, 0.9, 0.42, { shirt: [0.95, 0.75, 0.2] });
  // reflector + lantern
  Lt.tail.box(-0.4, 0.5, 0.87, 0.09, 0.06, 0.02, 0, { color: [1.8, 0.1, 0.05] });
  Lt.tail.box(0.4, 0.5, 0.87, 0.09, 0.06, 0.02, 0, { color: [1.8, 0.1, 0.05] });
  Lt.amber.box(0, 0.3, 0.3, 0.08, 0.1, 0.08, 0, { color: [2.5, 1.4, 0.3] });
  Lt.head.box(0, 0.75, -1.1, 0.08, 0.08, 0.04, 0, { color: [1.5, 1.4, 1.1] });
  return { body: B.build(), tail: Lt.tail.build(), head: Lt.head.build(), amber: Lt.amber.build(), len: 2.6, wid: 1.15, hgt: 1.7 };
}

export function buildCNG(misc, opts = {}) {
  const B = new MeshBuilder(true);
  const Lt = lights();
  const w = misc.get('white');
  const tyre = misc.get('tyre'), rim = misc.get('rim');
  const green = opts.color || [0.12, 0.55, 0.24];
  B.wheel(-0.6, 0.22, 0.75, 0.22, 0.14, 10, [1, 1, 1], tyre, rim);
  B.wheel(0.6, 0.22, 0.75, 0.22, 0.14, 10, [1, 1, 1], tyre, rim);
  B.wheel(0, 0.22, -1.0, 0.22, 0.14, 10, [1, 1, 1], tyre, rim);
  // lower body
  B.box(0, 0.25, 0.15, 1.36, 0.6, 1.9, 0, { color: green, region: w });
  // nose
  B.box(0, 0.3, -0.95, 0.9, 0.7, 0.5, 0, { color: green, region: w });
  // cabin with cage
  B.box(0, 0.85, 0.25, 1.38, 0.82, 1.7, 0, { regions: { side: misc.get('cng_side'), front: misc.get('cng_back'), back: misc.get('glass_dark'), top: misc.get('tyre') }, color: [1, 1, 1] });
  // roof (canvas)
  B.box(0, 1.67, 0.2, 1.44, 0.09, 1.9, 0, { color: [0.08, 0.08, 0.08], region: w });
  B.box(0, 0.85, -0.66, 1.0, 0.75, 0.06, 0, { color: [0.3, 0.45, 0.55], region: misc.get('glass_dark') });
  person(B, misc, 0, 0.6, -0.4, { shirt: [0.3, 0.3, 0.32] });
  if (opts.turbo) {
    // CNG TURBO: spoiler, racing stripe, chrome pipes
    B.box(0, 1.85, 1.0, 1.5, 0.06, 0.4, 0, { color: [0.95, 0.75, 0.1], region: w });
    B.box(-0.65, 1.74, 1.0, 0.05, 0.16, 0.2, 0, { color: [0.1, 0.1, 0.1], region: w });
    B.box(0.65, 1.74, 1.0, 0.05, 0.16, 0.2, 0, { color: [0.1, 0.1, 0.1], region: w });
    B.box(0, 1.72, 0.2, 0.25, 0.02, 1.9, 0, { color: [0.95, 0.75, 0.1], region: w });
    B.tube([0.45, 0.25, 0.9], [0.45, 0.3, 1.25], 0.06, 0.07, 6, [0.85, 0.85, 0.85], misc.get('metal'));
    B.tube([-0.45, 0.25, 0.9], [-0.45, 0.3, 1.25], 0.06, 0.07, 6, [0.85, 0.85, 0.85], misc.get('metal'));
  }
  Lt.tail.box(-0.55, 0.42, 1.11, 0.16, 0.1, 0.02, 0, { color: [2.2, 0.1, 0.05] });
  Lt.tail.box(0.55, 0.42, 1.11, 0.16, 0.1, 0.02, 0, { color: [2.2, 0.1, 0.05] });
  Lt.head.box(0, 0.62, -1.21, 0.18, 0.16, 0.02, 0, { color: [2.5, 2.4, 2.0] });
  Lt.amber.box(-0.5, 0.62, -1.2, 0.08, 0.06, 0.02, 0, { color: [2.5, 1.3, 0.2] });
  Lt.amber.box(0.5, 0.62, -1.2, 0.08, 0.06, 0.02, 0, { color: [2.5, 1.3, 0.2] });
  return { body: B.build(), tail: Lt.tail.build(), head: Lt.head.build(), amber: Lt.amber.build(), len: 2.7, wid: 1.4, hgt: 1.75 };
}

export function buildCar(misc, kind = 'sedan') {
  const B = new MeshBuilder(true);
  const Lt = lights();
  const w = misc.get('white');
  const tyre = misc.get('tyre'), rim = misc.get('rim');
  const glass = misc.get('glass_dark');
  const suv = kind === 'suv' || kind === 'police';
  const L = suv ? 4.8 : 4.5, W = suv ? 1.9 : 1.74, H0 = suv ? 0.38 : 0.28;
  const bodyH = suv ? 0.95 : 0.7, cabH = suv ? 0.75 : 0.55;
  const r = suv ? 0.38 : 0.31;
  for (const [x, z] of [[-W / 2 + 0.12, -L / 2 + 0.85], [W / 2 - 0.12, -L / 2 + 0.85], [-W / 2 + 0.12, L / 2 - 0.85], [W / 2 - 0.12, L / 2 - 0.85]]) {
    B.wheel(x, r, z, r, 0.24, 12, [1, 1, 1], tyre, rim);
  }
  B.box(0, H0, 0, W, bodyH, L, 0, { regions: { side: misc.get('white'), front: misc.get('car_back'), back: misc.get('white'), top: misc.get('white') }, color: [1, 1, 1] });
  // cabin / greenhouse
  const cz = suv ? 0.15 : 0.2, cl = suv ? 2.9 : 2.3;
  B.box(0, H0 + bodyH, cz, W - 0.14, cabH, cl, 0, { regions: { side: glass, front: glass, back: glass, top: w }, color: [1, 1, 1] });
  // pillars
  B.box(0, H0 + bodyH + cabH, cz, W - 0.1, 0.05, cl + 0.05, 0, { color: [1, 1, 1], region: w });
  // bumpers (darker)
  B.box(0, H0 - 0.05, L / 2 + 0.04, W + 0.02, 0.22, 0.12, 0, { color: [0.15, 0.15, 0.15], region: w });
  B.box(0, H0 - 0.05, -L / 2 - 0.04, W + 0.02, 0.22, 0.12, 0, { color: [0.15, 0.15, 0.15], region: w });
  if (suv) {
    B.box(0, H0 + bodyH + cabH + 0.05, cz, W - 0.3, 0.06, cl - 0.2, 0, { color: [0.3, 0.3, 0.3], region: misc.get('metal') }); // roof rails
    B.wheel(0, H0 + bodyH * 0.55, L / 2 + 0.2, 0.36, 0.22, 12, [1, 1, 1], tyre, rim); // spare wheel
  }
  // tail lights wide
  Lt.tail.box(-W / 2 + 0.22, H0 + bodyH * 0.7, L / 2 + 0.01, 0.36, 0.14, 0.02, 0, { color: [2.4, 0.08, 0.04] });
  Lt.tail.box(W / 2 - 0.22, H0 + bodyH * 0.7, L / 2 + 0.01, 0.36, 0.14, 0.02, 0, { color: [2.4, 0.08, 0.04] });
  Lt.head.box(-W / 2 + 0.25, H0 + bodyH * 0.65, -L / 2 - 0.01, 0.34, 0.14, 0.02, 0, { color: [2.6, 2.5, 2.2] });
  Lt.head.box(W / 2 - 0.25, H0 + bodyH * 0.65, -L / 2 - 0.01, 0.34, 0.14, 0.02, 0, { color: [2.6, 2.5, 2.2] });
  const out = { body: B.build(), tail: Lt.tail.build(), head: Lt.head.build(), len: L, wid: W, hgt: H0 + bodyH + cabH };
  if (kind === 'police') {
    const bc = new MeshBuilder(false);
    bc.box(-0.3, H0 + bodyH + cabH + 0.05, cz, 0.5, 0.14, 0.22, 0, { color: [0.2, 0.4, 3] });
    bc.box(0.3, H0 + bodyH + cabH + 0.05, cz, 0.5, 0.14, 0.22, 0, { color: [3, 0.1, 0.1] });
    out.beacon = bc.build();
  }
  return out;
}

export function buildBus(misc, variant = 0, opts = {}) {
  const B = new MeshBuilder(true);
  const Lt = lights();
  const w = misc.get('white');
  const tyre = misc.get('tyre'), rim = misc.get('rim');
  const dd = !!opts.double;
  const L = dd ? 10 : 10.5, W = 2.5, H = dd ? 4.3 : 3.1;
  for (const z of [-L / 2 + 2.2, L / 2 - 2.0]) {
    for (const x of [-W / 2 + 0.2, W / 2 - 0.2]) B.wheel(x, 0.5, z, 0.5, 0.32, 12, [1, 1, 1], tyre, rim);
  }
  const side = dd ? misc.get('brtc_side') : misc.get('bus_side' + variant);
  const rear = dd ? misc.get('bus_back1') : misc.get('bus_back' + variant);
  B.box(0, 0.35, 0, W, H - 0.35, L, 0, { regions: { side, front: rear, back: misc.get('glass_dark'), top: misc.get('metal') }, color: [1, 1, 1] });
  B.box(0, H, 0, W - 0.2, 0.15, L - 1, 0, { color: [0.4, 0.4, 0.42], region: misc.get('metal') });
  // front windshield frame & route board
  B.box(0, H - 0.55, -L / 2 - 0.02, W - 0.2, 0.32, 0.04, 0, { color: [0.05, 0.05, 0.05], region: w });
  // passengers hanging off the door (Dhaka classic)
  if (!dd && variant % 2 === 0) {
    person(B, misc, -W / 2 - 0.2, 0.55, -L / 2 + 1.6, { shirt: [0.9, 0.9, 0.85] });
    person(B, misc, -W / 2 - 0.25, 0.65, -L / 2 + 2.2, { shirt: [0.3, 0.45, 0.75] });
  }
  Lt.tail.box(-W / 2 + 0.25, 0.9, L / 2 + 0.01, 0.3, 0.3, 0.02, 0, { color: [2.4, 0.1, 0.05] });
  Lt.tail.box(W / 2 - 0.25, 0.9, L / 2 + 0.01, 0.3, 0.3, 0.02, 0, { color: [2.4, 0.1, 0.05] });
  Lt.amber.box(-W / 2 + 0.25, 1.3, L / 2 + 0.01, 0.2, 0.15, 0.02, 0, { color: [2.5, 1.3, 0.2] });
  Lt.amber.box(W / 2 - 0.25, 1.3, L / 2 + 0.01, 0.2, 0.15, 0.02, 0, { color: [2.5, 1.3, 0.2] });
  // interior tube lights visible through windows
  Lt.amber.box(0, H * 0.72, 0, W - 0.1, 0.05, L * 0.8, 0, { color: [0.8, 0.9, 0.9] });
  Lt.head.box(-W / 2 + 0.3, 0.85, -L / 2 - 0.01, 0.35, 0.22, 0.02, 0, { color: [2.6, 2.5, 2.2] });
  Lt.head.box(W / 2 - 0.3, 0.85, -L / 2 - 0.01, 0.35, 0.22, 0.02, 0, { color: [2.6, 2.5, 2.2] });
  return { body: B.build(), tail: Lt.tail.build(), head: Lt.head.build(), amber: Lt.amber.build(), len: L, wid: W, hgt: H };
}

export function buildTruck(misc, variant = 0) {
  const B = new MeshBuilder(true);
  const Lt = lights();
  const w = misc.get('white');
  const tyre = misc.get('tyre'), rim = misc.get('rim');
  const L = 8, W = 2.4;
  for (const z of [-L / 2 + 1.0, L / 2 - 1.8, L / 2 - 0.8]) for (const x of [-W / 2 + 0.2, W / 2 - 0.2]) B.wheel(x, 0.5, z, 0.5, 0.32, 12, [1, 1, 1], tyre, rim);
  // cab
  B.box(0, 0.6, -L / 2 + 1.1, W - 0.1, 2.1, 2.2, 0, { regions: { side: misc.get('truck_cab'), back: misc.get('truck_cab'), front: misc.get('truck_cab'), top: w }, color: [1, 1, 1] });
  // painted wooden cargo body (truck art)
  B.box(0, 0.9, 1.1, W, 2.3, 5.6, 0, { regions: { side: misc.get('truck_side' + variant), front: misc.get('truck_back'), back: misc.get('truck_side' + variant), top: misc.get('tarp') }, color: [1, 1, 1] });
  // the famous painted crown above the cab
  B.box(0, 2.75, -L / 2 + 1.6, W - 0.2, 0.5, 0.3, 0, { color: [1, 1, 1], region: misc.get('truck_back') });
  Lt.tail.box(-W / 2 + 0.25, 0.75, L / 2 - 0.65, 0.25, 0.18, 0.02, 0, { color: [2.4, 0.1, 0.05] });
  Lt.tail.box(W / 2 - 0.25, 0.75, L / 2 - 0.65, 0.25, 0.18, 0.02, 0, { color: [2.4, 0.1, 0.05] });
  // festoon of coloured marker lights
  const cols = [[2.5, 0.2, 0.1], [0.2, 2.5, 0.4], [2.5, 2.0, 0.2], [0.3, 0.6, 2.6]];
  for (let i = 0; i < 8; i++) Lt.amber.box(-W / 2 + 0.15 + i * 0.3, 3.15, L / 2 - 2.6, 0.08, 0.08, 0.04, 0, { color: cols[i % 4] });
  Lt.head.box(-W / 2 + 0.3, 1.0, -L / 2 - 0.01, 0.3, 0.22, 0.02, 0, { color: [2.6, 2.4, 2.0] });
  Lt.head.box(W / 2 - 0.3, 1.0, -L / 2 - 0.01, 0.3, 0.22, 0.02, 0, { color: [2.6, 2.4, 2.0] });
  return { body: B.build(), tail: Lt.tail.build(), head: Lt.head.build(), amber: Lt.amber.build(), len: L, wid: W, hgt: 3.3 };
}

export function buildBike(misc) {
  const B = new MeshBuilder(true);
  const Lt = lights();
  const w = misc.get('white');
  const tyre = misc.get('tyre'), rim = misc.get('rim');
  B.wheel(0, 0.31, 0.65, 0.31, 0.12, 12, [1, 1, 1], tyre, rim);
  B.wheel(0, 0.31, -0.68, 0.31, 0.1, 12, [1, 1, 1], tyre, rim);
  B.box(0, 0.4, 0, 0.32, 0.4, 1.0, 0, { color: [0.75, 0.1, 0.12], region: w });
  B.box(0, 0.78, 0.15, 0.26, 0.1, 0.6, 0, { color: [0.08, 0.08, 0.08], region: w });
  B.tube([0, 0.45, -0.45], [0, 1.05, -0.62], 0.04, 0.04, 4, [0.6, 0.6, 0.6], misc.get('metal'));
  B.tube([-0.35, 1.05, -0.58], [0.35, 1.05, -0.58], 0.025, 0.025, 4, [0.2, 0.2, 0.2], misc.get('metal'));
  // rider leaning forward + green-helmet pillion
  person(B, misc, 0, 0.85, 0.0, { shirt: [0.25, 0.3, 0.45], helmet: [0.85, 0.12, 0.15] });
  person(B, misc, 0, 0.88, 0.38, { shirt: [0.9, 0.85, 0.75], helmet: [0.1, 0.6, 0.25] });
  Lt.tail.box(0, 0.75, 0.82, 0.14, 0.08, 0.02, 0, { color: [2.4, 0.1, 0.05] });
  Lt.head.box(0, 0.95, -0.78, 0.14, 0.12, 0.02, 0, { color: [2.6, 2.5, 2.2] });
  return { body: B.build(), tail: Lt.tail.build(), head: Lt.head.build(), len: 2.0, wid: 0.7, hgt: 1.6 };
}

export function buildLeguna(misc) {
  const B = new MeshBuilder(true);
  const Lt = lights();
  const w = misc.get('white');
  const tyre = misc.get('tyre'), rim = misc.get('rim');
  const L = 3.8, W = 1.6;
  for (const z of [-L / 2 + 0.6, L / 2 - 0.7]) for (const x of [-W / 2 + 0.1, W / 2 - 0.1]) B.wheel(x, 0.3, z, 0.3, 0.2, 10, [1, 1, 1], tyre, rim);
  B.box(0, 0.3, -L / 2 + 0.7, W, 1.5, 1.3, 0, { color: [0.15, 0.45, 0.7], region: w });
  B.box(0, 0.95, -L / 2 + 0.05, W - 0.2, 0.6, 0.05, 0, { color: [1, 1, 1], region: misc.get('glass_dark') });
  B.box(0, 0.3, 0.6, W, 0.35, 2.4, 0, { color: [0.15, 0.45, 0.7], region: w });
  B.box(0, 1.85, 0.4, W + 0.05, 0.08, 3.0, 0, { color: [0.9, 0.85, 0.2], region: w });
  for (const x of [-W / 2, W / 2]) for (const z of [-0.4, 1.8]) B.box(x, 0.65, z, 0.05, 1.2, 0.05, 0, { color: [0.5, 0.5, 0.5], region: misc.get('metal') });
  // people hanging off the back step
  person(B, misc, -0.35, 0.45, L / 2 + 0.1, { shirt: [0.85, 0.3, 0.2] });
  person(B, misc, 0.3, 0.45, L / 2 + 0.15, { shirt: [0.9, 0.9, 0.85] });
  person(B, misc, -0.4, 0.65, 0.6, { shirt: [0.3, 0.6, 0.4] });
  person(B, misc, 0.4, 0.65, 0.2, { shirt: [0.95, 0.75, 0.2] });
  Lt.tail.box(-W / 2 + 0.15, 0.55, L / 2 + 0.01, 0.16, 0.12, 0.02, 0, { color: [2.4, 0.1, 0.05] });
  Lt.tail.box(W / 2 - 0.15, 0.55, L / 2 + 0.01, 0.16, 0.12, 0.02, 0, { color: [2.4, 0.1, 0.05] });
  Lt.head.box(-W / 2 + 0.25, 0.7, -L / 2 - 0.01, 0.2, 0.14, 0.02, 0, { color: [2.6, 2.5, 2.2] });
  Lt.head.box(W / 2 - 0.25, 0.7, -L / 2 - 0.01, 0.2, 0.14, 0.02, 0, { color: [2.6, 2.5, 2.2] });
  return { body: B.build(), tail: Lt.tail.build(), head: Lt.head.build(), len: L, wid: W, hgt: 2.0 };
}

export function buildHorseCart(misc) {
  const B = new MeshBuilder(true);
  const Lt = lights();
  const w = misc.get('white');
  const tyre = misc.get('tyre'), spokes = misc.get('spokes');
  // carriage
  B.wheel(-0.8, 0.7, 1.0, 0.7, 0.08, 16, [1, 1, 1], tyre, spokes);
  B.wheel(0.8, 0.7, 1.0, 0.7, 0.08, 16, [1, 1, 1], tyre, spokes);
  B.box(0, 0.7, 0.8, 1.5, 0.9, 2.2, 0, { color: [0.6, 0.12, 0.15], region: w });
  B.box(0, 1.6, 0.8, 1.55, 0.08, 2.3, 0, { color: [0.95, 0.75, 0.15], region: w });
  for (const x of [-0.72, 0.72]) for (const z of [-0.2, 1.8]) B.box(x, 1.6, z, 0.05, 0.9, 0.05, 0, { color: [0.95, 0.85, 0.3], region: misc.get('metal') });
  B.box(0, 2.45, 0.8, 1.6, 0.1, 2.4, 0, { color: [0.15, 0.3, 0.7], region: w });
  person(B, misc, -0.3, 1.6, 0.9, { shirt: [0.9, 0.3, 0.5] });
  person(B, misc, 0.3, 1.6, 1.1, { shirt: [0.3, 0.6, 0.9] });
  person(B, misc, 0, 1.65, -0.15, { shirt: [0.95, 0.95, 0.9] });
  // horse
  const hc = [0.85, 0.82, 0.78];
  B.box(0, 1.05, -1.6, 0.5, 0.65, 1.5, 0, { color: hc, region: w });
  B.box(0, 1.55, -2.45, 0.3, 0.7, 0.35, 0, { color: hc, region: w });
  B.box(0, 1.85, -2.75, 0.26, 0.28, 0.55, 0, { color: hc, region: w });
  for (const x of [-0.17, 0.17]) for (const z of [-2.2, -1.0]) B.box(x, 0, z, 0.12, 1.05, 0.12, 0, { color: [0.6, 0.55, 0.5], region: w });
  B.box(0, 1.9, -2.3, 0.08, 0.2, 0.4, 0, { color: [0.9, 0.2, 0.2], region: w }); // plume
  Lt.amber.box(0.75, 1.3, 1.95, 0.12, 0.16, 0.12, 0, { color: [2.6, 1.6, 0.4] });
  Lt.tail.box(-0.7, 0.9, 1.92, 0.1, 0.08, 0.02, 0, { color: [1.8, 0.1, 0.05] });
  Lt.head.box(0, 1.2, -2.4, 0.05, 0.05, 0.02, 0, { color: [0.1, 0.1, 0.1] });
  return { body: B.build(), tail: Lt.tail.build(), head: Lt.head.build(), amber: Lt.amber.build(), len: 5.0, wid: 1.6, hgt: 2.5 };
}

export function buildVan(misc) {
  // rickshaw van: flatbed tricycle stacked with sacks / crates
  const B = new MeshBuilder(true);
  const Lt = lights();
  const w = misc.get('white');
  const tyre = misc.get('tyre'), spokes = misc.get('spokes');
  B.wheel(-0.52, 0.34, 0.55, 0.34, 0.06, 14, [1, 1, 1], tyre, spokes);
  B.wheel(0.52, 0.34, 0.55, 0.34, 0.06, 14, [1, 1, 1], tyre, spokes);
  B.wheel(0, 0.31, -1.05, 0.31, 0.06, 14, [1, 1, 1], tyre, spokes);
  B.box(0, 0.62, 0.4, 1.1, 0.06, 1.3, 0, { color: [0.45, 0.3, 0.18], region: misc.get('wood') });
  const cols = [[0.85, 0.8, 0.6], [0.75, 0.7, 0.5], [0.3, 0.5, 0.75], [0.8, 0.3, 0.2]];
  for (let i = 0; i < 6; i++) B.box(-0.3 + (i % 2) * 0.6, 0.68 + Math.floor(i / 2) * 0.32, 0.4 + ((i % 3) - 1) * 0.3, 0.5, 0.3, 0.45, 0, { color: cols[i % 4], region: w });
  person(B, misc, 0, 0.98, -0.6, { shirt: [0.9, 0.9, 0.85] });
  B.box(0, 0.7, -0.62, 0.36, 0.34, 0.3, 0, { color: [0.4, 0.2, 0.5], region: w });
  B.tube([0, 0.62, -0.2], [0, 0.31, -1.05], 0.03, 0.03, 4, [0.3, 0.3, 0.3], misc.get('metal'));
  Lt.tail.box(0, 0.55, 1.06, 0.1, 0.06, 0.02, 0, { color: [1.6, 0.1, 0.05] });
  Lt.head.box(0, 0.8, -1.1, 0.05, 0.05, 0.02, 0, { color: [0.2, 0.2, 0.2] });
  return { body: B.build(), tail: Lt.tail.build(), head: Lt.head.build(), len: 2.6, wid: 1.15, hgt: 1.7 };
}

// Traffic type registry
export function buildTrafficModels(misc) {
  const T = {};
  for (let v = 0; v < 4; v++) T['rickshaw' + v] = buildRickshaw(misc, v * 3 + 1);
  T.cng = buildCNG(misc);
  T.car = buildCar(misc, 'sedan');
  T.suv = buildCar(misc, 'suv');
  T.police = buildCar(misc, 'police');
  for (let v = 0; v < 3; v++) T['bus' + v] = buildBus(misc, v * 2 % 5);
  T.brtc = buildBus(misc, 0, { double: true });
  T.truck0 = buildTruck(misc, 0);
  T.truck1 = buildTruck(misc, 1);
  T.bike = buildBike(misc);
  T.leguna = buildLeguna(misc);
  T.horse = buildHorseCart(misc);
  T.van = buildVan(misc);
  return T;
}

// Logical types (for stage mixes) -> concrete model keys + behaviour
export const TRAFFIC_TYPES = {
  rickshaw: { models: ['rickshaw0', 'rickshaw1', 'rickshaw2', 'rickshaw3'], speed: [4.5, 6.5], lanes: 'left', weave: 0.25, honkDodge: 0.55, bell: true },
  cng: { models: ['cng'], speed: [11, 15], lanes: 'any', weave: 0.7, honkDodge: 0.7 },
  car: { models: ['car'], speed: [15, 24], lanes: 'any', weave: 0.3, honkDodge: 0.4, colors: true },
  suv: { models: ['suv'], speed: [16, 26], lanes: 'right', weave: 0.25, honkDodge: 0.2, colors: 'dark' },
  bus: { models: ['bus0', 'bus1', 'bus2'], speed: [11, 17], lanes: 'any', weave: 0.35, honkDodge: 0.08, stops: true },
  brtc: { models: ['brtc'], speed: [10, 14], lanes: 'left', weave: 0.15, honkDodge: 0.05, stops: true },
  truck: { models: ['truck0', 'truck1'], speed: [12, 18], lanes: 'left', weave: 0.15, honkDodge: 0.1 },
  bike: { models: ['bike'], speed: [14, 22], lanes: 'any', weave: 0.9, honkDodge: 0.8 },
  leguna: { models: ['leguna'], speed: [10, 14], lanes: 'left', weave: 0.4, honkDodge: 0.3, stops: true },
  horse: { models: ['horse'], speed: [5, 7], lanes: 'left', weave: 0.1, honkDodge: 0.3 },
  van: { models: ['van'], speed: [4, 6], lanes: 'left', weave: 0.2, honkDodge: 0.5, bell: true },
  police: { models: ['police'], speed: [42, 46], lanes: 'any', weave: 0, honkDodge: 0 },
};
