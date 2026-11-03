// One RaceEnv per process, driven over stdin/stdout, one JSON message per line (ml/outrun_env.py is the other end).
//   {"cmd":"spec"}                                 -> {"obs_size", "act_size", "districts", "look"}
//   {"cmd":"reset","district":"gulshan","seed":3}  -> {"obs", "info"}
//   {"cmd":"step","action":[steer, pedal, nitro]}  -> {"obs", "reward", "terminated", "truncated", "info"}
//   {"cmd":"par","district":"gulshan"}             -> {"gold", "silver", "bronze"}
// Options for the env come from argv as JSON: node sim/server.mjs '{"randomStart":true,"laps":1}'

import { createInterface } from 'node:readline';
import { RaceEnv, DISTRICTS, OBS_SIZE, ACT_SIZE, LOOK, parTimes } from './env.mjs';

const env = new RaceEnv(JSON.parse(process.argv[2] || '{}'));
const out = (m) => process.stdout.write(JSON.stringify(m) + '\n');

createInterface({ input: process.stdin }).on('line', (line) => {
  if (!line.trim()) return;
  try {
    const m = JSON.parse(line);
    if (m.cmd === 'step') out(env.step(m.action));
    else if (m.cmd === 'reset') out(env.reset(m));
    else if (m.cmd === 'spec') out({ obs_size: OBS_SIZE, act_size: ACT_SIZE, districts: DISTRICTS, look: [...LOOK] });
    else if (m.cmd === 'par') out(parTimes(m.district));
    else out({ error: `unknown cmd ${m.cmd}` });
  } catch (e) {
    out({ error: String(e?.stack || e) });
  }
});
