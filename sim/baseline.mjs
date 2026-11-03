// The hand-written driver every learned one has to beat: flat out, steer by the bend ahead and back to the
// centre, never brake, fire nitro on straights. Races every district and prints the times against the medals.
//   node sim/baseline.mjs [district ...]

import { RaceEnv, DISTRICTS, parTimes } from './env.mjs';

function drive(obs) {
  const v = obs[0], x = obs[1], vx = obs[2];
  const kNear = obs[10 + 3 * 2], kFar = obs[10 + 3 * 4];
  // the outward push is curvature × speed², so steer against that, not the bend alone (0.55 cancels it at the car's grip)
  const steer = Math.max(-1, Math.min(1, kNear * v * v * 0.55 - x * 0.6 - vx * 0.05));
  const nitro = Math.abs(kFar) < 0.05 && Math.abs(kNear) < 0.05 && v > 0.5 ? 1 : 0;
  return [steer, 1, nitro];
}

const medal = (t, p) => (t <= p.gold ? 'gold' : t <= p.silver ? 'silver' : t <= p.bronze ? 'bronze' : '-');
const env = new RaceEnv();
const list = process.argv.slice(2).length ? process.argv.slice(2) : DISTRICTS;
const rows = [];
const t0 = performance.now();
for (const district of list) {
  let { obs } = env.reset({ district });
  let r = { terminated: false, truncated: false };
  while (!r.terminated && !r.truncated) { r = env.step(drive(obs)); obs = r.obs; }
  const p = parTimes(district);
  rows.push({ district, time: +r.info.time.toFixed(1), gold: +p.gold.toFixed(1), bronze: +p.bronze.toFixed(1), medal: medal(r.info.time, p), offroad_s: +r.info.offroad.toFixed(1), scrape_s: +r.info.scrape.toFixed(1), finished: r.terminated });
}
console.table(rows);
console.log(`${rows.filter((r) => r.medal !== '-').length}/${rows.length} medals, raced in ${(performance.now() - t0).toFixed(0)} ms`);
