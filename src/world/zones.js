// Road-space zones derived from a stage when its track is built:
//  - contra:  a jam fills our carriageway; a ramp throws you over the median
//             onto the oncoming side, a gap in the median lets you back
//  - stalls:  street stalls eat the outer lane on one side
//  - closed:  set pieces (metro, store, mall...) where no traffic may go
// Everything here is in track s (content offset already applied).

import { LANE_W } from './track.js';

export const CONTRA = { rampBefore: 70, jamLead: 10, gapAfter: 40, gapLen: 150, taper: 70 };

export function buildZones(tr, stage, M) {
  const Z = { contra: [], stalls: [], closed: [], ramps: [] };
  // wherever the road has a divider (not set pieces), the median is a flat crossing: the whole
  // opposite carriageway is open to you, and real oncoming traffic uses it
  if (!stage.twoWay) {
    let run = null;
    for (const sec of tr.sections) {
      const med = (sec.R || stage.R) === 'median' && !sec.closed && !sec.env && !sec.fork && !sec.gap && !sec.goalRun;
      if (med && run && Math.abs(run.end - sec.s0) < 1) run.end = sec.s1;
      else if (med) { run = { s0: sec.s0, end: sec.s1 }; Z.contra.push(run); }
      else run = null;
    }
    for (const r of Z.contra) { r.jam0 = r.s0; r.jam1 = r.s0; r.ramp = r.s0 + 30; r.g0 = r.s0; r.g1 = 1e9; }
  }
  for (const st of stage.stalls || []) Z.stalls.push({ s0: M(st[0]), s1: M(st[1]), side: st[2] || -1 });
  for (const sec of tr.sections) {
    if (sec.closed) Z.closed.push({ s0: sec.s0 - (sec.closeLead ?? 0), s1: sec.s1 });
  }
  // merge touching closed spans
  Z.closed.sort((a, b) => a.s0 - b.s0);
  const m = [];
  for (const c of Z.closed) {
    const last = m[m.length - 1];
    if (last && c.s0 <= last.s1 + 1) last.s1 = Math.max(last.s1, c.s1);
    else m.push({ ...c });
  }
  Z.closed = m;
  return Z;
}

export function contraAt(tr, s) {
  for (const z of tr.zones?.contra || []) if (s >= z.ramp - 30 && s <= z.end) return z;
  return null;
}

export function stallsAt(tr, s) {
  for (const z of tr.zones?.stalls || []) if (s >= z.s0 && s <= z.s1) return z;
  return null;
}

export function closedAt(tr, s, lead = 0) {
  for (const z of tr.zones?.closed || []) if (s >= z.s0 - lead && s <= z.s1) return z;
  return null;
}

// lateral layout of the opposite carriageway (median stages)
export function oppLayout(tr, s, stage) {
  const hw = tr.halfWAt(s);
  const mw = stage.medianW || 2.6;
  const oh = (stage.lanes * LANE_W) / 2;
  return { near: hw + mw, far: hw + mw + oh * 2, mid: hw + mw + oh, mw, oh };
}

// x of an oncoming lane on the opposite carriageway; lane 0 hugs the median
export function oppLaneX(tr, s, stage, lane) {
  const o = oppLayout(tr, s, stage);
  return o.near + LANE_W * (lane + 0.5);
}

// A jam is a long queue (about three times the authored length) with a checkpoint or accident at its head.
export function jamSpan(tr, e) {
  const s0 = tr.mapS(e.s);
  const len = (tr.mapS(e.s + (e.len || 150)) - s0) * 5;
  return { s0, s1: s0 + Math.max(480, len) };
}
