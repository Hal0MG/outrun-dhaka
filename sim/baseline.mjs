// The hand-written driver every learned one has to beat (sim/drivers.mjs). Races every district against the field and
// prints the finishing place and time against the medals.
//   node sim/baseline.mjs [--solo] [district ...]

import { RaceEnv, DISTRICTS, LOOK, parTimes } from './env.mjs';
import { simpleDriver } from './drivers.mjs';

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
  while (!r.terminated && !r.truncated) { r = env.step(simpleDriver(obs, t++)); obs = r.obs; }
  const p = parTimes(district), i = r.info;
  rows.push({ district, place: `${i.position}/${i.field}`, time: +i.time.toFixed(1), gold: +p.gold.toFixed(1), medal: medal(i.time, p), passed: i.passed, hits: i.hits, nitro: i.nitro, offroad_s: +i.offroad.toFixed(1), finished: r.terminated });
}
console.table(rows);
const wins = rows.filter((r) => r.place.startsWith('1/')).length;
console.log(`${solo ? 'solo' : `${wins} wins,`} ${rows.filter((r) => r.medal !== '-').length}/${rows.length} medals, raced in ${(performance.now() - t0).toFixed(0)} ms (look-ahead ${LOOK.join('/')} m)`);
