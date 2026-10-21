// Wrong-way racing. Most districts are divided roads: our carriageway, a low
// kerb you can drive over, and the opposite carriageway with oncoming traffic.
// Every kilometre or so one of those stretches has ROAD WORKS on our side: the
// lanes are coned off and rough, so the only fast way through is the opposite
// carriageway. Driving on it also pays: nitro and fuel for the time spent there.

export const CONTRA_LEN = 300;
const GAP = 1100; // road between one set of works and the next

const medianAt = (tr, s) => (tr.sectionAt(Math.min(Math.max(s, 0), tr.length)).R || tr.stage.R) === 'median';

// pick straight divided stretches and mark them as works
export function buildContra(tr) {
  const zones = [];
  const lo = (tr.isFirst ? tr.gateS : 0) + 520;
  const hi = (tr.isFinal ? tr.goalS : tr.length) - 520;
  let s = lo;
  while (s + CONTRA_LEN < hi) {
    let ok = true;
    for (let d = -20; d <= CONTRA_LEN + 20 && ok; d += 20) {
      const at = s + d;
      if (!medianAt(tr, at) || Math.abs(tr.kAt(Math.min(Math.max(at, 0), tr.length))) > 0.0042 || tr.elevAt(Math.min(Math.max(at, 0), tr.length)) > 1.5) ok = false;
    }
    if (ok) { zones.push({ s0: s, s1: s + CONTRA_LEN, id: tr.id + ':' + Math.round(s) }); s += CONTRA_LEN + GAP; } else s += 40;
  }
  return zones;
}

export function contraAt(tr, s, lead = 0) {
  for (const z of tr.contra || []) if (s >= z.s0 - lead && s <= z.s1) return z;
  return null;
}
