// Physically inspired engine synth, run in an AudioWorklet.
// A crank phase fires each cylinder in turn; every firing drops a pressure
// pulse into a model exhaust (two damped waveguide resonators: header and
// muffler), plus intake roar, valvetrain whine and overrun crackle.
// The source is shipped as a string and loaded from a Blob URL so the game
// stays a single file.

export const ENGINE_WORKLET = /* js */ `
class EngineProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 900, minValue: 0, maxValue: 14000, automationRate: 'k-rate' },
      { name: 'throttle', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'gain', defaultValue: 0, minValue: 0, maxValue: 2, automationRate: 'k-rate' },
    ];
  }
  constructor(opts) {
    super();
    this.sr = sampleRate;
    this.phase = 0;
    this.env = 0;
    this.seed = 1234567;
    this.d1 = new Float32Array(4096); this.i1 = 0; this.lp1 = 0;
    this.d2 = new Float32Array(8192); this.i2 = 0; this.lp2 = 0;
    this.muf = 0; this.muf2 = 0;
    this.dcx = 0; this.dcy = 0;
    this.bpL = 0; this.bpB = 0;
    this.whP = 0;
    this.popQ = 0; this.popEnv = 0;
    this.smRpm = 900; this.smThr = 0;
    this.setCfg(opts.processorOptions || {});
    this.port.onmessage = (e) => {
      if (e.data.cfg) this.setCfg(e.data.cfg);
      if (e.data.pop) this.popQ += e.data.pop;
    };
  }
  setCfg(c) {
    this.cyl = c.cyl || 4;
    this.stroke = c.stroke || 4;
    this.offs = c.offs || Array.from({ length: this.cyl }, (_, i) => i / this.cyl);
    this.jitter = c.jitter ?? 0.06;
    this.L1 = Math.max(8, Math.min(4000, Math.round(this.sr * 2 * (c.header || 0.6) / 343)));
    this.L2 = Math.max(16, Math.min(8000, Math.round(this.sr * 2 * (c.muffler || 1.8) / 343)));
    this.fb1 = c.fb1 ?? 0.45;
    this.fb2 = c.fb2 ?? 0.35;
    this.pulseT = c.pulse || 0.0011;
    this.grit = c.grit ?? 0.3;
    this.bright = c.bright ?? 0.5;
    this.intake = c.intake ?? 0.25;
    this.whine = c.whine ?? 0.01;
    this.crackle = c.crackle ?? 0.25;
    this.red = c.red || 7000;
    this.drive = c.drive ?? 1.6;
    // no two cylinders burn quite alike: fixed per-cylinder strength gives the engine its lumpy character
    const imb = c.imbalance ?? 0.1;
    this.cv = Array.from({ length: this.cyl }, (_, i) => 1 + Math.sin(i * 12.9898 + this.cyl * 78.233) * imb);
  }
  rnd() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  process(inputs, outputs, params) {
    const out = outputs[0];
    const L = out[0], R = out[1] || out[0];
    const n = L.length;
    const sr = this.sr;
    const tRpm = params.rpm[0], tThr = params.throttle[0], gain = params.gain[0];
    const decay = Math.exp(-1 / (this.pulseT * sr));
    const cycles = this.stroke === 4 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      this.smRpm += (tRpm - this.smRpm) * 0.0015;
      this.smThr += (tThr - this.smThr) * 0.002;
      const rpm = this.smRpm, thr = this.smThr;
      const fc = rpm / 60 / cycles;
      const p0 = this.phase;
      let p1 = p0 + fc / sr;
      const wrap = p1 >= 1;
      if (wrap) p1 -= 1;
      // fire any cylinder whose offset we just crossed
      for (let c = 0; c < this.cyl; c++) {
        const o = this.offs[c];
        const hit = wrap ? (o > p0 || o <= p1) : (o > p0 && o <= p1);
        if (!hit) continue;
        const load = 0.22 + 0.78 * thr;
        let a = load * this.cv[c] * (1 + (this.rnd() - 0.5) * this.jitter * 2);
        // overrun: unburnt fuel popping in a hot exhaust
        const high = rpm / this.red;
        if (thr < 0.12 && high > 0.45 && this.rnd() < this.crackle * (high - 0.4)) a += 0.9 + this.rnd() * 1.4;
        if (this.popQ > 0 && this.rnd() < 0.5) { a += 1.6; this.popQ -= 1; }
        this.env += a;
      }
      this.phase = p1;
      const nz = this.rnd() * 2 - 1;
      const ex = this.env * (1 - this.grit + this.grit * nz);
      this.env *= decay;
      // header resonator
      const r1 = this.d1[(this.i1 - this.L1 + 4096) & 4095];
      this.lp1 += (r1 - this.lp1) * (0.35 + this.bright * 0.5);
      const y1 = ex + this.fb1 * this.lp1;
      this.d1[this.i1] = y1; this.i1 = (this.i1 + 1) & 4095;
      // muffler resonator
      const r2 = this.d2[(this.i2 - this.L2 + 8192) & 8191];
      this.lp2 += (r2 - this.lp2) * 0.25;
      const y2 = y1 + this.fb2 * this.lp2;
      this.d2[this.i2] = y2; this.i2 = (this.i2 + 1) & 8191;
      // tailpipe: two-pole lowpass that opens up under load and at high revs
      const cut = Math.min(0.6, 0.03 + this.bright * 0.15 + thr * 0.1 + (rpm / this.red) * 0.16);
      this.muf += (y2 - this.muf) * cut;
      this.muf2 += (this.muf - this.muf2) * cut;
      let s = this.muf2;
      // intake roar: band-passed noise breathing with the firings
      const f = Math.min(0.9, 2 * Math.sin(Math.PI * Math.min(0.45, (500 + rpm * 0.35) / sr)));
      this.bpL += f * this.bpB;
      const hp = nz - this.bpL - 0.6 * this.bpB;
      this.bpB += f * hp;
      s += this.bpB * this.intake * (0.15 + thr) * (0.4 + Math.min(1.5, this.env));
      // valvetrain / gear whine
      this.whP += (rpm / 60) * 24 / sr;
      if (this.whP > 1) this.whP -= 1;
      s += Math.sin(this.whP * 6.2831853) * this.whine * (rpm / this.red);
      // dc block + saturation
      const y = s - this.dcx + 0.995 * this.dcy;
      this.dcx = s; this.dcy = y;
      const v = Math.tanh(y * this.drive * (0.7 + thr * 0.5)) * gain;
      L[k] = v; R[k] = v;
    }
    return true;
  }
}
registerProcessor('engine-proc', EngineProcessor);
`;

// Engine characters. rpm range, gears, and the exhaust model.
export const ENGINES = {
  // flat-twelve wedge: twelve even pulses, short headers, a howl at the top
  v12: { idle: 950, red: 8400, gears: 6, cfg: { imbalance: 0.32, cyl: 12, stroke: 4, header: 0.8, muffler: 2.6, fb1: 0.5, fb2: 0.55, pulse: 0.0026, grit: 0.12, bright: 0.25, intake: 0.12, whine: 0.004, crackle: 0.35, drive: 1.1 } },
  // the uncle Premio: buzzy four, long quiet exhaust
  i4: { idle: 750, red: 6800, gears: 5, cfg: { imbalance: 0.12, cyl: 4, stroke: 4, header: 0.95, muffler: 2.9, fb1: 0.48, fb2: 0.5, pulse: 0.0018, grit: 0.18, bright: 0.15, intake: 0.2, whine: 0.003, crackle: 0.12, drive: 1.3 } },
  // single-cylinder two-stroke three-wheeler: rattly, nasal, ring-ding-ding
  cng: { idle: 1700, red: 7600, gears: 4, cfg: { cyl: 1, stroke: 2, header: 0.5, muffler: 1.4, fb1: 0.58, fb2: 0.4, pulse: 0.0022, grit: 0.35, bright: 0.35, intake: 0.15, whine: 0.002, crackle: 0.5, drive: 1.7 } },
  // inline-six: smooth, even firing, a deep hum (2JZ)
  i6: { idle: 800, red: 7400, gears: 6, cfg: { imbalance: 0.1, cyl: 6, stroke: 4, header: 0.9, muffler: 2.7, fb1: 0.5, fb2: 0.5, pulse: 0.0022, grit: 0.14, bright: 0.2, intake: 0.16, whine: 0.003, crackle: 0.4, drive: 1.2 } },
  // RB26: six with a hard, raspy edge
  rb: { idle: 850, red: 8000, gears: 6, cfg: { imbalance: 0.14, cyl: 6, stroke: 4, header: 0.8, muffler: 2.4, fb1: 0.52, fb2: 0.48, pulse: 0.0018, grit: 0.2, bright: 0.3, intake: 0.2, whine: 0.004, crackle: 0.5, drive: 1.35 } },
  // small turbo four
  i4t: { idle: 800, red: 7200, gears: 6, cfg: { imbalance: 0.14, cyl: 4, stroke: 4, header: 0.9, muffler: 2.7, fb1: 0.48, fb2: 0.5, pulse: 0.0018, grit: 0.18, bright: 0.2, intake: 0.22, whine: 0.004, crackle: 0.45, drive: 1.3 } },
  // Rickshaw 9000: cross-plane V8 burble under the jet
  jet: { idle: 800, red: 7200, gears: 6, cfg: { cyl: 8, stroke: 4, offs: [0, 0.09, 0.25, 0.34, 0.5, 0.59, 0.75, 0.84], imbalance: 0.28, header: 0.85, muffler: 2.6, fb1: 0.5, fb2: 0.5, pulse: 0.0018, grit: 0.15, bright: 0.2, intake: 0.15, whine: 0.003, crackle: 0.45, drive: 1.2 } },
};
