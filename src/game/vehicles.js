// Rickshaw and CNG bodies for the playable novelty cars. Model space: forward = -Z,
// right = +X, up = +Y, origin at ground centre. The +Z face is the rear.
// Each builder returns { body, tail, head, len, wid, hgt } geometries.

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
