// Trained drivers as rivals: the front-runners of the field (RAJA and the four behind him) are driven by a trained
// network instead of the scripted driver, and the same stand-in player (sim/drivers.mjs) races both fields.
//   node sim/rivals.mjs ml/runs/<name>/brain.json [--learned 5] [district ...]
//
// For each district: where the player finishes in each field, and for the front-runners how long they take, how long
// the learned ones spend off the road or scraping a wall, and whether they all finish. The race runs on, with the
// player braking, until every rival has finished.

import { RaceEnv, DISTRICTS } from './env.mjs';
import { simpleDriver } from './drivers.mjs';

const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(name); return i < 0 ? dflt : args.splice(i, 2)[1]; };
const K = +flag('--learned', 5);
const brain = args.shift();
const list = args.length ? args : DISTRICTS;
if (!brain) { console.error('usage: node sim/rivals.mjs ml/runs/<name>/brain.json [--learned 5] [district ...]'); process.exit(2); }

function race(env, district) {
  let { obs, info } = env.reset({ district, seed: 1 });
  let r = { terminated: false, truncated: false, info }, t = 0, atFlag = null;
  while (!r.truncated && r.info.time < 400) {
    r = env.step(r.terminated ? [0, -1, 0] : simpleDriver(obs, t++));
    obs = r.obs;
    if (r.terminated && !atFlag) atFlag = r.info;
    if (atFlag && r.info.rivals.slice(0, K).every((v) => v.finish != null)) break;
  }
  const front = r.info.rivals.slice(0, K);
  const done = front.filter((v) => v.finish != null);
  return {
    place: `${atFlag.position}/${atFlag.field}`,
    time: atFlag.time,
    done: `${done.length}/${K}`,
    front: done.length ? done.reduce((a, v) => a + v.finish, 0) / done.length : NaN,
    off: front.reduce((a, v) => a + (v.offroad || 0), 0) / K,
    scrape: front.reduce((a, v) => a + (v.scrape || 0), 0) / K,
  };
}

const scripted = new RaceEnv({ detail: true });
const learned = new RaceEnv({ detail: true, brain, learned: K });
const f1 = (v) => (Number.isNaN(v) ? '-' : +v.toFixed(1));
const rows = [];
for (const district of list) {
  const a = race(scripted, district), b = race(learned, district);
  rows.push({ district, you_scripted: a.place, you_learned: b.place, front5_scripted_s: f1(a.front), front5_learned_s: f1(b.front), learned_done: b.done, learned_off_s: f1(b.off), learned_scrape_s: f1(b.scrape) });
}
console.table(rows);
const mean = (k) => rows.reduce((a, r) => a + (+r[k] || 0), 0) / rows.length;
console.log(`front five finish: scripted ${mean('front5_scripted_s').toFixed(1)} s, learned ${mean('front5_learned_s').toFixed(1)} s; learned off the road ${mean('learned_off_s').toFixed(1)} s and on a wall ${mean('learned_scrape_s').toFixed(1)} s each, on average`);
