// The Run, many times over: how often a driver gets through each knockout gate, and how it finishes.
//   node sim/run.mjs [--runs 20] [--brain ml/runs/<name>/brain.json]    one driver, gate by gate
//   node sim/run.mjs --rivals ml/runs/<name>/brain.json [--learned 5]   the front-runners driven by a trained network
//   node sim/run.mjs --sweep 0.84,0.88,0.92,0.96,1 [--runs 30]        a range of paces, as a stand-in for weaker players
//
// Each run is a fresh seed: the field's mistakes differ, so the margin at each gate does too. A gate is survived when
// the player is inside the cut as it crosses the line; "margin" is the cut less the place held there, so 0 is the last
// place that stays in. The driver is the simple one (sim/drivers.mjs) unless a brain is given. A pace holds the driver
// to that fraction of top speed and takes its nitro away, so it models a player who simply is not as fast.

import { RaceEnv } from './env.mjs';
import { simpleDriver } from './drivers.mjs';
import { Brain } from './brain.mjs';
import { KNOCKOUTS, ROUTE } from '../src/world/stages.js';

const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(name); return i < 0 ? dflt : args.splice(i, 2)[1]; };
const runs = +flag('--runs', 20);
const brainPath = flag('--brain', null);
const sweep = flag('--sweep', null);
const rivalBrain = flag('--rivals', null); // a trained driver for the front-running rivals
const learned = +flag('--learned', 5);
const brain = brainPath ? Brain.load(brainPath) : null;
const VMAX_MS = (275 / 3.6) * 1.35; // top speed in m/s (src/game/player.js SPEED_K)

const env = new RaceEnv({ mode: 'run', ...(rivalBrain && { brain: rivalBrain, learned }) });
const gateIds = ROUTE.filter((id) => KNOCKOUTS[id]);

function play(pace) {
  const stats = Object.fromEntries(gateIds.map((id) => [id, { reached: 0, survived: 0, margins: [], places: [] }]));
  const finishes = [], outs = {};
  let steps = 0;
  for (let seed = 1; seed <= runs; seed++) {
    let { obs } = env.reset({ seed });
    let r = { terminated: false, truncated: false }, t = 0;
    while (!r.terminated && !r.truncated) {
      let a = brain ? brain.act(obs) : simpleDriver(obs, t);
      if (pace < 1) a = [a[0], Math.min(a[1], Math.max(0, Math.min(1, (pace - obs[0]) * (VMAX_MS * 0.5)))), 0];
      r = env.step(a);
      obs = r.obs;
      t++; steps++;
    }
    for (const g of r.info.gates) {
      const s = stats[g.stage];
      s.reached++;
      s.places.push(g.position);
      if (!g.out) { s.survived++; s.margins.push(g.cut - g.position); }
    }
    if (r.info.out) outs[r.info.stage] = (outs[r.info.stage] || 0) + 1;
    else if (r.terminated) finishes.push({ place: r.info.position, time: r.info.time });
    else outs[`stuck in ${r.info.stage}`] = (outs[`stuck in ${r.info.stage}`] || 0) + 1;
  }
  return { stats, finishes, outs, steps };
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const f = (v, d = 1) => (Number.isNaN(v) ? '-' : +v.toFixed(d));
const t0 = performance.now();

if (sweep) {
  const rows = [];
  for (const pace of sweep.split(',').map(Number)) {
    const { stats, finishes } = play(pace);
    const row = { pace: `${Math.round(pace * 100)}%` };
    // still in the Run after each gate, as a share of all the runs started
    for (const id of gateIds) row[id] = `${Math.round((100 * stats[id].survived) / runs)}%`;
    row.finished = `${Math.round((100 * finishes.length) / runs)}%`;
    row['median place'] = f(median(finishes.map((x) => x.place)), 0);
    row['mean time s'] = f(mean(finishes.map((x) => x.time)), 0);
    rows.push(row);
  }
  console.log(`share of ${runs} runs still in after each gate (cut in brackets: ${gateIds.map((id) => `${id} ${KNOCKOUTS[id]}`).join(', ')})`);
  console.table(rows);
} else {
  const { stats, finishes, outs, steps } = play(1);
  console.table(gateIds.map((id) => {
    const s = stats[id];
    return { gate: id, cut: KNOCKOUTS[id], reached: s.reached, survived: s.survived, 'survival %': s.reached ? Math.round((100 * s.survived) / s.reached) : '-', 'median place': f(median(s.places), 0), 'mean margin (survivors)': f(mean(s.margins)), tightest: f(Math.min(...s.margins)) };
  }));
  console.log(`${runs} runs: ${finishes.length} finished the Run` + (finishes.length ? ` (median place ${f(median(finishes.map((x) => x.place)), 0)}, mean time ${f(mean(finishes.map((x) => x.time)))} s)` : ''));
  console.log('where the others went out:', JSON.stringify(outs));
  console.log(`${steps} decisions in ${((performance.now() - t0) / 1000).toFixed(1)} s (${Math.round(steps / ((performance.now() - t0) / 1000))} a second)`);
}
