// Road-space layout helpers derived from a stage.

import { LANE_W } from './track.js';

// lateral layout of the opposite carriageway (median stages); it is scenery only
export function oppLayout(tr, s, stage) {
  const hw = tr.halfWAt(s);
  const mw = stage.medianW || 2.6;
  const oh = (stage.lanes * LANE_W) / 2;
  return { near: hw + mw, far: hw + mw + oh * 2, mid: hw + mw + oh, mw, oh };
}
