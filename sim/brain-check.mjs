// Checks the JavaScript driver against Python: the actions it takes in states from real races must match what
// the network does in Python (ml/export.py writes both files).
//   node sim/brain-check.mjs ml/runs/<name>

import { readFileSync } from 'node:fs';
import { Brain } from './brain.mjs';

const dir = process.argv[2];
if (!dir) { console.error('usage: node sim/brain-check.mjs ml/runs/<name>'); process.exit(2); }
const brain = Brain.load(`${dir}/brain.json`);
const { obs, act } = JSON.parse(readFileSync(`${dir}/brain.check.json`, 'utf8'));
let worst = 0;
obs.forEach((o, i) => { const a = brain.act(o); for (let k = 0; k < a.length; k++) worst = Math.max(worst, Math.abs(a[k] - act[i][k])); });
console.log(`${obs.length} states, largest difference ${worst.toExponential(2)}`);
process.exit(worst < 1e-4 ? 0 : 1);
