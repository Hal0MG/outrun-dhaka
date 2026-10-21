// All sound is synthesised: engines, horns, bells, crashes, the city.

import { clamp, fx } from '../core/util.js';
import { ENGINE_WORKLET, ENGINES } from './engineWorklet.js';

const GEAR_TOPS = {
  4: [0.28, 0.5, 0.75, 1.0],
  5: [0.23, 0.4, 0.58, 0.78, 1.0],
  6: [0.2, 0.34, 0.49, 0.64, 0.81, 1.0],
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.vol = { master: 0.8, music: 0.7, sfx: 0.8 };
    this.engineKind = 'v12';
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC({ latencyHint: 'interactive' }));
    this.master = ctx.createGain();
    // the master only stops clipping. Music and sound effects each have their own bus, compressor and reverb,
    // so loud effects never squash the music and each slider moves only its own sound (reverb included)
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -2;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.12;
    this.master.connect(this.limiter).connect(ctx.destination);
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 4;
    this.music = ctx.createGain();
    this.sfx = ctx.createGain();
    this.amb = ctx.createGain();
    this.eng = ctx.createGain();
    this.music.connect(this.master);
    this.sfx.connect(this.comp).connect(this.master);
    this.amb.connect(this.sfx);
    this.eng.connect(this.sfx);
    // reverb
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.6, 2.2);
    this.revIn = ctx.createGain();
    this.revIn.gain.value = 1;
    this.revIn.connect(this.reverb).connect(this.sfx);
    // the music's own reverb, returned into the music bus
    this.reverbM = ctx.createConvolver();
    this.reverbM.buffer = this.reverb.buffer;
    this.revInM = ctx.createGain();
    this.revInM.connect(this.reverbM).connect(this.music);
    this.sfxRev = ctx.createGain();
    this.sfxRev.gain.value = 0.25;
    this.sfxRev.connect(this.reverb);
    this.noiseBuf = this.makeNoise(2);
    this.ready = true;
    this.applyVolumes();
    this.buildEngine();
    this.buildLoops();
    this.loadEngineWorklet();
  }

  // the modelled engine; until it loads (or where worklets are missing) the old oscillator engine plays
  async loadEngineWorklet() {
    const ctx = this.ctx;
    if (!ctx.audioWorklet || typeof AudioWorkletNode === 'undefined') return;
    try {
      const url = URL.createObjectURL(new Blob([ENGINE_WORKLET], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(url);
      const eng = ENGINES[this.engineKind] || ENGINES.v12;
      const W = new AudioWorkletNode(ctx, 'engine-proc', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: eng.cfg });
      // body: a little low-end weight and a presence bump, like a mic behind the car
      const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 160; low.gain.value = 9;
      const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 2600; pres.Q.value = 0.7; pres.gain.value = -5;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 28;
      W.connect(hp).connect(low).connect(pres).connect(this.eng);
      const send = ctx.createGain(); send.gain.value = 0.08;
      pres.connect(send).connect(this.reverb);
      this.W = W;
      this.vg = { gear: 1, shiftT: 0, blipT: 0, rpm: eng.idle, last: ctx.currentTime };
    } catch (e) {
      console.warn('engine worklet unavailable', e);
    }
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.05);
    this.music.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
  }

  // a plate-ish room: sparse early reflections, then a dense tail whose highs die first
  impulse(sec, decay) {
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * sec);
    const pre = Math.floor(sr * 0.012);
    const b = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let lp = 0;
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / (len - pre);
        const damp = 0.85 - 0.75 * t;
        lp += ((Math.random() * 2 - 1) - lp) * damp;
        d[i] = lp * Math.pow(1 - t, decay) * (t < 0.02 ? t / 0.02 : 1);
      }
      for (let k = 0; k < 9; k++) {
        const at = pre + Math.floor(sr * (0.004 + Math.random() * 0.07));
        if (at < len) d[at] += (Math.random() < 0.5 ? -1 : 1) * (0.5 - k * 0.04);
      }
    }
    return b;
  }

  makeNoise(sec) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  noise(loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = loop;
    return s;
  }

  // ------------------------------------------------------------ continuous layers
  buildEngine() {
    const ctx = this.ctx;
    const E = (this.E = {});
    E.out = ctx.createGain();
    E.out.gain.value = 0;
    E.out.connect(this.eng);
    E.filter = ctx.createBiquadFilter();
    E.filter.type = 'lowpass';
    E.filter.Q.value = 2.5;
    E.shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 2.6); }
    E.shaper.curve = curve;
    E.shaper.connect(E.filter).connect(E.out);
    E.o1 = ctx.createOscillator(); E.o1.type = 'sawtooth';
    E.o2 = ctx.createOscillator(); E.o2.type = 'sawtooth'; E.o2.detune.value = 9;
    E.o3 = ctx.createOscillator(); E.o3.type = 'square';
    E.g1 = ctx.createGain(); E.g2 = ctx.createGain(); E.g3 = ctx.createGain();
    E.g1.gain.value = 0.32; E.g2.gain.value = 0.26; E.g3.gain.value = 0.22;
    E.o1.connect(E.g1).connect(E.shaper);
    E.o2.connect(E.g2).connect(E.shaper);
    E.o3.connect(E.g3).connect(E.shaper);
    // amplitude "putt" modulation for the CNG two-stroke
    E.am = ctx.createGain();
    E.am.gain.value = 1;
    E.lfo = ctx.createOscillator(); E.lfo.type = 'square';
    E.lfoG = ctx.createGain(); E.lfoG.gain.value = 0;
    E.lfo.connect(E.lfoG).connect(E.out.gain);
    // intake roar
    E.n = this.noise();
    E.nf = ctx.createBiquadFilter(); E.nf.type = 'bandpass'; E.nf.Q.value = 0.8;
    E.ng = ctx.createGain(); E.ng.gain.value = 0;
    E.n.connect(E.nf).connect(E.ng).connect(E.out);
    // jet whine (rickshaw 9000)
    E.jet = ctx.createOscillator(); E.jet.type = 'sine';
    E.jetG = ctx.createGain(); E.jetG.gain.value = 0;
    E.jet.connect(E.jetG).connect(this.eng);
    for (const o of [E.o1, E.o2, E.o3, E.lfo, E.jet]) o.start();
    E.n.start();
  }

  buildLoops() {
    const ctx = this.ctx;
    const mk = (type, f, q) => {
      const n = this.noise();
      const flt = ctx.createBiquadFilter();
      flt.type = type; flt.frequency.value = f; flt.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      n.connect(flt).connect(g);
      n.start(ctx.currentTime + Math.random() * 0.5);
      return { n, flt, g };
    };
    this.L = {
      wind: mk('lowpass', 500, 0.5),
      screech: mk('bandpass', 1900, 7),
      rumble: mk('lowpass', 180, 1),
      scrape: mk('highpass', 2500, 0.7),
      rain: mk('bandpass', 2600, 0.4),
      city: mk('lowpass', 260, 0.6),
      river: mk('lowpass', 420, 0.8),
    };
    for (const k of ['wind', 'screech', 'rumble', 'scrape']) this.L[k].g.connect(this.eng);
    for (const k of ['rain', 'city', 'river']) this.L[k].g.connect(this.amb);
    // screech wobble
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 13;
    const lg = ctx.createGain();
    lg.gain.value = 260;
    lfo.connect(lg).connect(this.L.screech.flt.frequency);
    lfo.start();
    // helicopter rotor: band-passed noise chopped by a square LFO
    {
      const r = mk('bandpass', 260, 0.9);
      const chop = ctx.createGain(); chop.gain.value = 0;
      const lfo2 = ctx.createOscillator(); lfo2.type = 'square'; lfo2.frequency.value = 13;
      const lg2 = ctx.createGain(); lg2.gain.value = 0.5;
      const bias = ctx.createConstantSource ? ctx.createConstantSource() : null;
      lfo2.connect(lg2).connect(chop.gain);
      if (bias) { bias.offset.value = 0.5; bias.connect(chop.gain); bias.start(); }
      r.g.connect(chop).connect(this.sfx);
      lfo2.start();
      this.L.rotor = r;
    }
    // tyre roar on the tarmac
    this.L.road = mk('lowpass', 320, 0.9);
    this.L.road.g.connect(this.eng);
    // high wind whistle around the mirrors at speed
    this.L.whistle = mk('bandpass', 2400, 9);
    this.L.whistle.g.connect(this.eng);
    // gusts: a slow random wobble on the wind level
    {
      const gl = ctx.createOscillator(); gl.frequency.value = 0.23;
      const gl2 = ctx.createOscillator(); gl2.frequency.value = 0.61;
      const gg = ctx.createGain(); gg.gain.value = 0.35;
      this.gust = ctx.createGain(); this.gust.gain.value = 1;
      gl.connect(gg); gl2.connect(gg);
      gg.connect(this.gust.gain);
      this.L.wind.g.disconnect();
      this.L.wind.g.connect(this.gust).connect(this.eng);
      gl.start(); gl2.start();
    }
    // street chatter: noise through moving vowel formants, a crowd you hear but can't follow
    {
      this.chat = ctx.createGain(); this.chat.gain.value = 0;
      this.chat.connect(this.amb);
      const formants = [[520, 6, 0.9, 3.1], [900, 7, 0.7, 4.3], [1500, 8, 0.45, 5.7], [2500, 9, 0.25, 2.3]];
      for (const [fr, q, a, rate] of formants) {
        for (const side of [-0.6, 0.5]) {
          const n = this.noise();
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fr * (1 + side * 0.08); bp.Q.value = q;
          const lfo = ctx.createOscillator(); lfo.frequency.value = rate * (1 + side * 0.13);
          const lg = ctx.createGain(); lg.gain.value = fr * 0.18;
          lfo.connect(lg).connect(bp.frequency);
          const am = ctx.createGain(); am.gain.value = a * 0.5;
          const al = ctx.createOscillator(); al.frequency.value = rate * 1.7 + side;
          const alg = ctx.createGain(); alg.gain.value = a * 0.5;
          al.connect(alg).connect(am.gain);
          const pn = ctx.createStereoPanner(); pn.pan.value = side;
          n.connect(bp).connect(am).connect(pn).connect(this.chat);
          n.start(ctx.currentTime + Math.random()); lfo.start(); al.start();
        }
      }
    }
    // the nearest rival's engine: two detuned saws through a growl filter, panned to where they are
    {
      this.riv = {};
      const R = this.riv;
      R.o1 = ctx.createOscillator(); R.o1.type = 'sawtooth';
      R.o2 = ctx.createOscillator(); R.o2.type = 'sawtooth'; R.o2.detune.value = 14;
      R.f = ctx.createBiquadFilter(); R.f.type = 'lowpass'; R.f.Q.value = 3; R.f.frequency.value = 600;
      R.g = ctx.createGain(); R.g.gain.value = 0;
      R.p = ctx.createStereoPanner();
      R.o1.connect(R.f); R.o2.connect(R.f);
      R.f.connect(R.g).connect(R.p).connect(this.sfx);
      R.o1.start(); R.o2.start();
    }
    // nitro hiss
    this.L.nitro = mk('highpass', 1800, 0.6);
    this.L.nitro.g.connect(this.eng);
    // VIP siren (two-tone)
    this.siren = ctx.createOscillator();
    this.siren.type = 'sawtooth';
    this.sirenG = ctx.createGain();
    this.sirenG.gain.value = 0;
    const sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 1800;
    this.siren.connect(sf).connect(this.sirenG).connect(this.sfx);
    this.siren.start();
  }

  setEngineKind(kind) {
    this.engineKind = kind;
    if (this.W) this.W.port.postMessage({ cfg: (ENGINES[kind] || ENGINES.v12).cfg });
  }

  // a virtual multi-speed gearbox for the sound: real cars climb through gears
  modelEngine(p, t) {
    const eng = ENGINES[this.engineKind] || ENGINES.v12;
    const vg = this.vg;
    const dt = clamp(t - vg.last, 0, 0.1);
    vg.last = t;
    const tops = GEAR_TOPS[eng.gears];
    const vmax = p.vmax || 80;
    const sp = Math.max(0, p.speed);
    let thr = p.throttle;
    const rpmAt = (g) => eng.red * 0.97 * sp / (vmax * tops[g - 1]);
    let rpm = rpmAt(vg.gear);
    if (vg.shiftT > 0) vg.shiftT -= dt;
    if (vg.blipT > 0) vg.blipT -= dt;
    if (vg.shiftT <= 0) {
      if (rpm > eng.red * 0.95 && vg.gear < eng.gears && thr > 0.2) {
        vg.gear++;
        vg.shiftT = 0.13;
        if (this.W && fx.next() < 0.5) this.W.port.postMessage({ pop: 1 + (fx.next() < 0.4 ? 1 : 0) });
        rpm = rpmAt(vg.gear);
      } else if (vg.gear > 1 && rpm < eng.red * (thr > 0.5 ? 0.55 : 0.4)) {
        vg.gear--;
        vg.blipT = 0.09;
        rpm = rpmAt(vg.gear);
      }
    }
    // pulling away: the clutch lets the revs rise ahead of the wheels
    if (vg.gear === 1) rpm = Math.max(rpm, eng.idle + thr * (eng.red * 0.5 - eng.idle) * clamp(1 - sp / (vmax * 0.12), 0, 1));
    rpm = Math.max(eng.idle, rpm);
    // limiter bounce
    if (rpm > eng.red) rpm = eng.red - fx.next() * 260;
    if (vg.shiftT > 0) thr = 0;
    if (vg.blipT > 0) thr = 1;
    if (!p.engineOn) thr = 0;
    vg.rpm = rpm;
    this.rpmNorm = rpm / eng.red;
    return { rpm, thr };
  }

  // per-frame continuous parameters
  update(p) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const E = this.E;
    const rpm = clamp(p.rpm, 0, 1.1);
    const thr = p.throttle;
    const k = this.engineKind;
    const on = p.engineOn ? 1 : 0;
    let base, span, cut, vol;
    if (k === 'cng') {
      base = 26; span = 70; cut = 900 + rpm * 1800; vol = 0.26;
      E.lfo.frequency.setTargetAtTime(base + rpm * span, t, 0.05);
      E.lfoG.gain.setTargetAtTime(0.1 * on, t, 0.1);
      E.o3.type = 'square';
    } else if (k === 'i4') {
      base = 32; span = 120; cut = 700 + rpm * 2200 + thr * 600; vol = 0.2;
      E.lfoG.gain.setTargetAtTime(0, t, 0.1);
    } else if (k === 'jet') {
      base = 30; span = 60; cut = 500; vol = 0.08;
      E.lfoG.gain.setTargetAtTime(0, t, 0.1);
    } else {
      base = 42; span = 175; cut = 600 + rpm * 3200 + thr * 1400; vol = 0.24;
      E.lfoG.gain.setTargetAtTime(0, t, 0.1);
    }
    if (this.W) {
      const m = this.modelEngine(p, t);
      const P = this.W.parameters;
      P.get('rpm').setTargetAtTime(m.rpm, t, 0.02);
      P.get('throttle').setTargetAtTime(m.thr, t, 0.02);
      P.get('gain').setTargetAtTime(on * (k === 'jet' ? 0.2 : 0.3) * (0.55 + m.thr * 0.45) * (p.boost ? 1.15 : 1), t, 0.05);
      vol = 0;
    }
    const f = base + rpm * span;
    E.o1.frequency.setTargetAtTime(f, t, 0.03);
    E.o2.frequency.setTargetAtTime(f * 2.0, t, 0.03);
    E.o3.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    E.filter.frequency.setTargetAtTime(cut, t, 0.05);
    E.out.gain.setTargetAtTime(on * vol * (0.55 + thr * 0.45 + rpm * 0.2), t, 0.06);
    E.nf.frequency.setTargetAtTime(400 + rpm * 2600, t, 0.05);
    E.ng.gain.setTargetAtTime(on * (k === 'jet' ? 0.35 : 0.06) * (0.3 + thr), t, 0.08);
    E.jet.frequency.setTargetAtTime(600 + rpm * 2600, t, 0.08);
    E.jetG.gain.setTargetAtTime(on * (k === 'jet' ? 0.05 : 0), t, 0.1);

    const L = this.L;
    const sp = clamp(p.speed / 80, 0, 1.2);
    L.wind.flt.frequency.setTargetAtTime(300 + sp * 2200, t, 0.1);
    L.wind.g.gain.setTargetAtTime(sp * sp * (p.convertible ? 0.36 : 0.18), t, 0.1);
    L.road.g.gain.setTargetAtTime(clamp(p.speed / 30, 0, 1) * 0.16 * (1 + (p.rain || 0) * 0.6), t, 0.1);
    L.road.flt.frequency.setTargetAtTime(180 + sp * 420, t, 0.1);
    L.whistle.g.gain.setTargetAtTime(Math.max(0, sp - 0.65) * 0.05, t, 0.2);
    L.whistle.flt.frequency.setTargetAtTime(1800 + sp * 1600, t, 0.2);
    this.chat.gain.setTargetAtTime((p.crowd || 0) * 0.07 * (1 - clamp(p.speed / 110, 0, 0.7)), t, 0.4);
    const rv = p.rival;
    if (rv) {
      const fr = 38 + rv.v * 0.9;
      this.riv.o1.frequency.setTargetAtTime(fr, t, 0.05);
      this.riv.o2.frequency.setTargetAtTime(fr * 2.01, t, 0.05);
      this.riv.f.frequency.setTargetAtTime(400 + rv.v * 18, t, 0.08);
      this.riv.p.pan.setTargetAtTime(clamp(rv.pan, -1, 1), t, 0.05);
      this.riv.g.gain.setTargetAtTime(0.06 * clamp(1 - rv.d / 45, 0, 1), t, 0.06);
    } else this.riv.g.gain.setTargetAtTime(0, t, 0.15);
    L.screech.g.gain.setTargetAtTime(clamp(p.slip, 0, 1) * 0.18 * (p.speed > 8 ? 1 : 0), t, 0.05);
    L.rumble.g.gain.setTargetAtTime(p.offroad * clamp(p.speed / 20, 0, 1) * 0.5, t, 0.05);
    L.scrape.g.gain.setTargetAtTime(p.scrape ? 0.22 : 0, t, 0.03);
    L.rain.g.gain.setTargetAtTime(p.rain * 0.22, t, 0.3);
    L.city.g.gain.setTargetAtTime(p.city * 0.16, t, 0.5);
    L.river.g.gain.setTargetAtTime(p.river * 0.12, t, 0.5);
    L.rotor.g.gain.setTargetAtTime((p.rotor || 0) * 0.5, t, 0.2);
    L.rotor.flt.frequency.setTargetAtTime(200 + (p.rotor || 0) * 140, t, 0.2);
    L.nitro.g.gain.setTargetAtTime(p.boost ? 0.1 : 0, t, 0.06);
    if (p.boost) E.filter.frequency.setTargetAtTime(cut * 1.6, t, 0.05);
    // siren
    const sOn = p.siren || 0;
    this.sirenG.gain.setTargetAtTime(sOn * 0.06, t, 0.1);
    if (sOn > 0.01) this.siren.frequency.setTargetAtTime(Math.sin(t * 3.2) > 0 ? 960 : 720, t, 0.04);
  }

  // ------------------------------------------------------------ one-shots
  env(g, t, a, peak, d, sustainT = 0) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (sustainT) g.gain.setValueAtTime(peak, t + a + sustainT);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + sustainT + d);
  }

  tone(type, freq, dur, vol, opts = {}) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + (opts.delay || 0);
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const g = ctx.createGain();
    this.env(g, t, opts.a ?? 0.005, vol, dur, opts.hold || 0);
    let node = o.connect(g);
    if (opts.lp) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp;
      g.connect(f); node = f;
    }
    const dest = opts.dest || this.sfx;
    node.connect(dest);
    if (opts.pan != null && ctx.createStereoPanner) {
      const pn = ctx.createStereoPanner(); pn.pan.value = opts.pan;
      node.disconnect(); node.connect(pn).connect(dest);
    }
    if (opts.rev) node.connect(this.sfxRev);
    o.start(t);
    o.stop(t + (opts.a ?? 0.005) + (opts.hold || 0) + dur + 0.05);
  }

  noiseHit(dur, vol, type, freq, q = 1, opts = {}) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + (opts.delay || 0);
    const n = this.noise(false);
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const g = ctx.createGain();
    this.env(g, t, opts.a ?? 0.003, vol, dur);
    n.connect(f).connect(g).connect(opts.dest || this.sfx);
    if (opts.rev) g.connect(this.sfxRev);
    n.start(t, Math.random() * 1.5);
    n.stop(t + dur + 0.1);
  }

  // horns ---------------------------------------------------------------
  horn(kind = 'v12', on = true) {
    if (!this.ready) return;
    const ctx = this.ctx;
    if (on) {
      if (this.hornNodes) return;
      const t = ctx.currentTime;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.02);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
      const sh = ctx.createWaveShaper();
      const c = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 3); }
      sh.curve = c;
      g.connect(sh).connect(f).connect(this.sfx);
      const freqs = kind === 'cng' ? [520] : kind === 'jet' ? [880, 1320] : kind === 'i4' ? [400, 500] : [415, 523];
      const os = freqs.map((fr) => {
        const o = ctx.createOscillator();
        o.type = kind === 'cng' ? 'square' : 'sawtooth';
        o.frequency.value = fr;
        o.connect(g);
        o.start();
        return o;
      });
      if (kind === 'jet') {
        // the rickshaw 9000 still has its bell
        this.bell(0);
      }
      this.hornNodes = { g, os };
    } else if (this.hornNodes) {
      const { g, os } = this.hornNodes;
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      os.forEach((o) => o.stop(t + 0.08));
      this.hornNodes = null;
    }
  }

  // other vehicles' horns at a distance (pan + volume)
  otherHorn(kind, dist = 30, pan = 0) {
    if (!this.ready) return;
    const v = clamp(1.2 / (1 + dist * 0.05), 0.02, 0.4) * 0.35;
    const d = 0.18 + fx.next() * 0.35;
    if (kind === 'busHorn') {
      // the infamous musical hydraulic horn
      const seq = [[392, 0], [494, 0.12], [587, 0.24], [784, 0.36]];
      for (const [f, dt] of seq) this.tone('sawtooth', f, 0.2, v * 0.7, { delay: dt, lp: 2400, pan });
      return;
    }
    if (kind === 'cngHorn') {
      this.tone('square', 640, 0.12, v * 0.8, { to: 420, lp: 1600, pan });
      this.tone('square', 640, 0.12, v * 0.8, { to: 420, lp: 1600, pan, delay: 0.16 });
      return;
    }
    if (kind === 'bell') { this.bell(pan, v * 2); return; }
    const f = 330 + fx.next() * 260;
    this.tone('sawtooth', f, d, v, { lp: 1800, pan });
    this.tone('sawtooth', f * 1.26, d, v * 0.7, { lp: 1800, pan });
  }

  bell(pan = 0, vol = 0.12) {
    // rickshaw bell: tring-tring (inharmonic partials, fast decay)
    for (let r = 0; r < 2; r++) {
      for (const [mul, a] of [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.9, 0.12]]) {
        this.tone('sine', 1850 * mul * (1 + r * 0.01), 0.35, vol * a * 0.6, { delay: r * 0.13, pan });
      }
    }
  }

  // events --------------------------------------------------------------
  crash() {
    this.noiseHit(0.9, 0.9, 'lowpass', 3000, 0.7, { to: 200 });
    this.tone('sine', 90, 0.6, 0.6, { to: 40 });
    this.noiseHit(0.25, 0.4, 'highpass', 4000, 1, { delay: 0.05 });
    for (let i = 0; i < 6; i++) this.tone('triangle', 2200 + fx.next() * 3000, 0.15, 0.05, { delay: 0.1 + fx.next() * 0.4 });
  }
  bump() {
    this.noiseHit(0.2, 0.4, 'lowpass', 600, 1);
    this.tone('sine', 120, 0.15, 0.3, { to: 60 });
  }
  hit() {
    this.noiseHit(0.3, 0.6, 'bandpass', 900, 1.2, { to: 300 });
    this.tone('square', 160, 0.12, 0.15, { to: 80, lp: 800 });
  }
  shift(up) {
    this.noiseHit(up ? 0.22 : 0.12, up ? 0.12 : 0.06, 'highpass', up ? 3000 : 1500, 1, { to: up ? 6000 : 800 });
  }
  backfire() {
    for (let i = 0; i < 3; i++) this.noiseHit(0.06, 0.4, 'lowpass', 900, 1, { delay: i * 0.07 + fx.next() * 0.03 });
  }
  splash() {
    this.noiseHit(0.5, 0.35, 'lowpass', 1200, 0.8, { to: 300 });
  }
  // a car flashing past: rising then falling band of noise and engine tone, swept across the stereo field
  passBy(relV, side, big = false) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const k = clamp(relV / 60, 0.25, 1.4);
    const dur = 0.55 / Math.max(0.5, k);
    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(side * 0.2, t);
    pan.pan.linearRampToValueAtTime(side * 0.95, t + dur);
    pan.connect(this.sfx);
    const n = this.noise(false);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(900 * k + 300, t);
    bp.frequency.exponentialRampToValueAtTime(260, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22 * k * (big ? 1.4 : 1), t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(g).connect(pan);
    n.start(t, Math.random()); n.stop(t + dur + 0.05);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f0 = big ? 70 : 110;
    o.frequency.setValueAtTime(f0 * (1 + k * 0.25), t);
    o.frequency.exponentialRampToValueAtTime(f0 * (1 - k * 0.2), t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.06 * k, t + dur * 0.3);
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(og).connect(pan);
    o.start(t); o.stop(t + dur + 0.05);
  }

  whoosh(pan = 0) {
    this.noiseHit(0.45, 0.22, 'bandpass', 600, 1.5, { to: 2400, a: 0.12 });
  }
  thunder(delay = 0) {
    this.noiseHit(3.5, 0.55, 'lowpass', 300, 0.7, { delay, to: 60, a: 0.08 });
    this.noiseHit(0.4, 0.4, 'lowpass', 1800, 0.7, { delay, to: 200 });
  }
  shipHorn(pan = -0.6) {
    this.tone('sawtooth', 98, 2.4, 0.09, { lp: 500, pan, a: 0.2, rev: true });
    this.tone('sawtooth', 123.5, 2.4, 0.07, { lp: 500, pan, a: 0.2 });
  }
  trainHorn() {
    this.tone('sawtooth', 311, 1.2, 0.06, { lp: 1400, a: 0.1, rev: true });
    this.tone('sawtooth', 370, 1.2, 0.05, { lp: 1400, a: 0.1 });
  }
  crow(pan = 0) {
    for (let i = 0; i < 2; i++) {
      this.noiseHit(0.16, 0.06, 'bandpass', 1200, 4, { delay: i * 0.28, to: 900 });
      this.tone('sawtooth', 520, 0.16, 0.025, { delay: i * 0.28, to: 380, lp: 1600, pan });
    }
  }
  cricket() {
    for (let i = 0; i < 6; i++) this.tone('sine', 4200 + fx.next() * 300, 0.03, 0.012, { delay: i * 0.05 });
  }
  firework(delay = 0) {
    this.noiseHit(0.08, 0.15, 'bandpass', 1500, 2, { delay, to: 4000 });
    this.noiseHit(1.2, 0.3, 'lowpass', 1800, 0.8, { delay: delay + 1.2, to: 200 });
    for (let i = 0; i < 8; i++) this.noiseHit(0.03, 0.06, 'highpass', 5000, 1, { delay: delay + 1.4 + fx.next() * 0.8 });
  }
  crowdRoar(vol = 0.25) {
    this.noiseHit(2.5, vol, 'bandpass', 900, 0.6, { a: 0.4 });
    // "Bang-la-desh!" clap rhythm
    const pattern = [0, 0.32, 0.64, 1.1, 1.3];
    pattern.forEach((d) => this.noiseHit(0.08, vol * 0.8, 'bandpass', 1400, 1.2, { delay: d + 0.6 }));
  }
  plane() {
    this.noiseHit(5, 0.4, 'lowpass', 400, 0.6, { a: 2.2, to: 2400 });
    this.tone('sawtooth', 220, 4, 0.04, { a: 2, to: 160, lp: 900 });
  }
  powerCut() {
    this.tone('sawtooth', 120, 0.6, 0.12, { to: 30, lp: 600 });
    this.noiseHit(0.08, 0.3, 'highpass', 2000, 1);
  }
  generator() {
    // the whole street's generators kick in
    this.tone('square', 50, 2.5, 0.04, { a: 0.5, hold: 1, lp: 300 });
  }
  powerBack() {
    this.tone('sine', 50, 0.4, 0.15, { to: 120 });
    this.noiseHit(0.1, 0.2, 'bandpass', 3000, 1);
  }

  glass() {
    this.noiseHit(0.5, 0.45, 'highpass', 3500, 0.8, { to: 7000 });
    for (let i = 0; i < 10; i++) this.tone('sine', 2500 + fx.next() * 4500, 0.12 + fx.next() * 0.2, 0.04, { delay: fx.next() * 0.35 });
  }
  smash(heavy = false) {
    this.noiseHit(heavy ? 0.5 : 0.28, heavy ? 0.6 : 0.4, 'lowpass', heavy ? 1400 : 2400, 0.8, { to: 300 });
    this.tone('triangle', heavy ? 140 : 220, 0.18, 0.18, { to: 60 });
    for (let i = 0; i < 4; i++) this.noiseHit(0.05, 0.12, 'bandpass', 1800 + fx.next() * 2000, 2, { delay: 0.05 + fx.next() * 0.25 });
  }
  boing() {
    // the cartoon spring when somebody goes flying
    this.tone('sine', 220, 0.45, 0.16, { to: 880 });
    this.tone('sine', 660, 0.5, 0.06, { delay: 0.05, to: 330 });
    this.tone('triangle', 900, 0.6, 0.05, { delay: 0.15, to: 1800 });
  }
  thud() {
    this.noiseHit(0.18, 0.3, 'lowpass', 500, 1);
    this.tone('sine', 110, 0.2, 0.2, { to: 55 });
  }
  moo() {
    this.tone('sawtooth', 150, 1.1, 0.07, { to: 110, lp: 700, a: 0.12 });
    this.tone('sawtooth', 152, 1.1, 0.05, { to: 112, lp: 500, a: 0.15 });
  }
  takedown() {
    this.noiseHit(1.2, 0.85, 'lowpass', 2600, 0.8, { to: 140 });
    this.tone('sine', 70, 0.9, 0.7, { to: 30 });
    for (let i = 0; i < 10; i++) this.tone('triangle', 1600 + fx.next() * 3500, 0.12, 0.05, { delay: 0.05 + fx.next() * 0.6 });
    this.noiseHit(0.6, 0.25, 'highpass', 5000, 1, { delay: 0.1 });
  }
  clang() {
    for (const f of [420, 610, 890]) this.tone('square', f, 0.3, 0.05, { to: f * 0.7, lp: 2600 });
    this.noiseHit(0.2, 0.3, 'bandpass', 1400, 1.5);
  }
  nitro() {
    this.noiseHit(0.9, 0.4, 'bandpass', 500, 1.2, { to: 3200, a: 0.05 });
    this.tone('sawtooth', 90, 0.6, 0.14, { to: 260, lp: 1200 });
  }
  jump() {
    this.noiseHit(0.35, 0.3, 'lowpass', 900, 1, { to: 2600 });
  }
  land(big = false) {
    this.noiseHit(big ? 0.6 : 0.35, big ? 0.7 : 0.45, 'lowpass', 1100, 0.8, { to: 120 });
    this.tone('sine', 80, 0.4, big ? 0.6 : 0.35, { to: 38 });
  }
  bossStinger() {
    const notes = [196, 233, 262, 311, 294];
    notes.forEach((f, i) => this.tone('sawtooth', f, 0.35, 0.07, { delay: i * 0.16, lp: 1800, rev: true }));
    this.noiseHit(1.4, 0.3, 'lowpass', 400, 0.7, { a: 0.3 });
  }
  victory() {
    const notes = [523, 659, 784, 659, 784, 1047];
    notes.forEach((f, i) => this.tone('square', f, 0.2, 0.08, { delay: i * 0.11, lp: 3500, rev: true }));
    this.crowdRoar(0.3);
  }

  // UI ------------------------------------------------------------------
  // Tuntuni talking: a little voiced babble, one syllable-blip per letter, no words (like a game character's
  // chatter). Vowels are longer and brighter, a trailing '?' lifts the pitch, '!' is more excited.
  talk(text) {
    if (!this.ctx || !this.ready) return;
    const ctx = this.ctx;
    const letters = text.replace(/[^A-Za-z!?., '’]/g, '');
    const excited = /!/.test(text);
    const asks = text.trim().endsWith('?');
    const base = excited ? 470 : 410;
    let t = ctx.currentTime + 0.03;
    let n = 0;
    // a soft pop as the bubble appears
    this.tone('sine', excited ? 980 : 780, 0.05, 0.045, { lp: 3000 });
    for (let i = 0; i < letters.length && n < 36; i++) {
      const ch = letters[i].toLowerCase();
      if (ch === ' ') { t += 0.045; continue; }
      if ('.,!?'.includes(ch)) { t += 0.13; continue; }
      if (ch === "'" || ch === '’') continue;
      const code = ch.charCodeAt(0) - 96;
      const vowel = 'aeiouy'.includes(ch);
      const lift = asks && i > letters.length - 9 ? 1 + (i - (letters.length - 9)) * 0.025 : 1;
      const f0 = base * (1 + (((code * 7) % 11) - 5) * 0.04 + (vowel ? 0.07 : 0)) * lift;
      const dur = vowel ? 0.08 : 0.045;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.linearRampToValueAtTime(f0 * (excited ? 1.1 : 1.04), t + dur);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = vowel ? 650 + ((code * 37) % 900) : 1900;
      bp.Q.value = 2.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vowel ? 0.2 : 0.09, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(bp).connect(g).connect(this.sfx);
      o.start(t);
      o.stop(t + dur + 0.02);
      t += vowel ? 0.064 : 0.05;
      n++;
    }
  }

  blip(f = 880) { this.tone('square', f, 0.06, 0.06, { lp: 3000 }); }
  confirm() { this.tone('square', 660, 0.08, 0.07, { lp: 3000 }); this.tone('square', 990, 0.12, 0.07, { lp: 3000, delay: 0.07 }); }
  back() { this.tone('square', 440, 0.1, 0.06, { lp: 2000, to: 330 }); }
  countBeep(final) { this.tone('square', final ? 1320 : 660, final ? 0.6 : 0.25, 0.12, { lp: 4000 }); }
  checkpoint() {
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((f, i) => this.tone('square', f, 0.14, 0.08, { delay: i * 0.08, lp: 3500, rev: true }));
  }
  goal() {
    const notes = [523, 659, 784, 1047, 1319, 1568, 2093];
    notes.forEach((f, i) => this.tone('sawtooth', f, 0.3, 0.06, { delay: i * 0.1, lp: 3500, rev: true }));
  }
  combo(n) { this.tone('square', 600 + Math.min(n, 8) * 120, 0.08, 0.06, { lp: 4000 }); }
  timeWarn() { this.tone('square', 1200, 0.08, 0.06, { lp: 4000 }); }
  tune() {
    // radio dial static
    this.noiseHit(0.35, 0.2, 'bandpass', 2200, 0.7, { to: 800 });
    this.tone('sine', 1800, 0.25, 0.03, { to: 600 });
  }
}

export const audio = new AudioEngine();
