// A trained driver, run in plain JavaScript: the weights ml/export.py wrote, no Python or library. It turns the
// observation (sim/env.mjs) into [steer, pedal, nitro], the same as the network does in Python.

import { readFileSync } from 'node:fs';

export class Brain {
  constructor(json) {
    this.mean = Float64Array.from(json.obs_mean);
    this.std = Float64Array.from(json.obs_var, (v) => Math.sqrt(v + json.epsilon));
    this.clip = json.clip_obs;
    this.layers = json.layers.map((l) => ({ w: l.w.map((row) => Float64Array.from(row)), b: Float64Array.from(l.b) }));
    this.bufs = this.layers.map((l) => new Float64Array(l.b.length));
    this.x = new Float64Array(this.mean.length);
  }

  static load(path) {
    return new Brain(JSON.parse(readFileSync(path, 'utf8')));
  }

  // the deterministic action, each part -1..1
  act(obs) {
    const x = this.x;
    for (let i = 0; i < x.length; i++) x[i] = Math.max(-this.clip, Math.min(this.clip, (obs[i] - this.mean[i]) / this.std[i]));
    let input = x;
    const last = this.layers.length - 1;
    this.layers.forEach((l, li) => {
      const out = this.bufs[li];
      for (let j = 0; j < out.length; j++) {
        const row = l.w[j];
        let sum = l.b[j];
        for (let i = 0; i < input.length; i++) sum += row[i] * input[i];
        out[j] = li < last ? Math.tanh(sum) : sum;
      }
      input = out;
    });
    return Array.from(input, (v) => Math.max(-1, Math.min(1, v)));
  }
}
