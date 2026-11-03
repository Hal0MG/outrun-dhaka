// The hand-written driver every learned one has to beat: flat out, steer against the corner push, never brake,
// fire nitro on straights, and pay no attention to the other cars. Races every district against the field and
// prints the finishing place and time against the medals.
//   node sim/baseline.mjs [--solo] [district ...]

import { RaceEnv, DISTRICTS, LOOK, parTimes } from './env.mjs';

const ROAD = 12; // where the look-ahead starts in the observation (sim/env.mjs observe)

function drive(obs, t) {
  const v = obs[0], x = obs[1], vx = obs[2];
  const kNear = obs[ROAD + 3 * 2], kFar = obs[ROAD + 3 * 4];
  // the outward push is curvature × speed², so steer against that, not the bend alone (0.55 cancels it at the car's grip)
  const steer = Math.max(-1, Math.min(1, kNear * v * v * 0.55 - x * 0.6 - vx * 0.05));
  // nitro is a tap: press on a straight, let go on the next decision
  const nitro = t % 2 === 0 && Math.abs(kFar) < 0.05 && Math.abs(kNear) < 0.05 && v > 0.5 ? 1 : 0;
  return [steer, 1, nitro];
}

const args = process.argv.slice(2);
const solo = args.includes('--solo');
const list = args.filter((a) => !a.startsWith('--'));
const medal = (t, p) => (t <= p.gold ? 'gold' : t <= p.silver ? 'silver' : t <= p.bronze ? 'bronze' : '-');
const env = new RaceEnv({ rivals: !solo });
const rows = [];
const t0 = performance.now();
for (const district of list.length ? list : DISTRICTS) {
  let { obs } = env.reset({ district, seed: 1 });
  let r = { terminated: false, truncated: false }, t = 0;
  while (!r.terminated && !r.truncated) { r = env.step(drive(obs, t++)); obs = r.obs; }
  const p = parTimes(district), i = r.info;
  rows.push({ district, place: `${i.position}/${i.field}`, time: +i.time.toFixed(1), gold: +p.gold.toFixed(1), medal: medal(i.time, p), passed: i.passed, hits: i.hits, nitro: i.nitro, offroad_s: +i.offroad.toFixed(1), finished: r.terminated });
}
console.table(rows);
const wins = rows.filter((r) => r.place.startsWith('1/')).length;
console.log(`${solo ? 'solo' : `${wins} wins,`} ${rows.filter((r) => r.medal !== '-').length}/${rows.length} medals, raced in ${(performance.now() - t0).toFixed(0)} ms (look-ahead ${LOOK.join('/')} m)`);
