// Live-synthesised soundtrack. Five original tracks: OutRun-style synth pop
// built on Bengali scales (Yaman, Kafi, Bhairav, Khamaj) with tabla, bansuri
// and a plucked ektara.

import { audio } from './audio.js';

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return null;
  let n = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return n + (parseInt(m[3], 10) + 1) * 12;
}
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// "A4:2 D5:2 -:4 | ..." -> [[{step, m, len}], ...] per bar
function parseLine(str) {
  return str.split('|').map((bar) => {
    const out = [];
    let step = 0;
    for (const tok of bar.trim().split(/\s+/)) {
      if (!tok) continue;
      const [n, l] = tok.split(':');
      const len = parseFloat(l || '1');
      if (n !== '-') out.push({ step, m: midi(n), len });
      step += len;
    }
    return out;
  });
}
const chordM = (s) => s.split(/\s+/).map(midi);

// ------------------------------------------------------------ instruments
class Instruments {
  constructor() {
    const ctx = audio.ctx;
    this.ctx = ctx;
    // mix: melodic bus (ducked by the kick) + drum bus -> glue compressor -> tone -> music
    this.mix = ctx.createGain();
    this.glue = ctx.createDynamicsCompressor();
    this.glue.threshold.value = -18; this.glue.ratio.value = 3; this.glue.attack.value = 0.012; this.glue.release.value = 0.18; this.glue.knee.value = 8;
    const lowS = ctx.createBiquadFilter(); lowS.type = 'lowshelf'; lowS.frequency.value = 90; lowS.gain.value = 3;
    const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 9000; air.gain.value = 3;
    const mud = ctx.createBiquadFilter(); mud.type = 'peaking'; mud.frequency.value = 320; mud.Q.value = 1; mud.gain.value = -2.5;
    this.mix.connect(this.glue).connect(mud).connect(lowS).connect(air).connect(audio.music);
    this.out = ctx.createGain();
    this.duckG = ctx.createGain();
    this.out.connect(this.duckG).connect(this.mix);
    this.drums = ctx.createGain();
    this.drums.gain.value = 0.95;
    this.drums.connect(this.mix);
    this.rev = ctx.createGain();
    this.rev.gain.value = 0.5;
    this.rev.connect(audio.revIn);
    // tempo-synced delay for leads
    this.delay = ctx.createDelay(1.0);
    this.delay.delayTime.value = 0.36;
    this.fb = ctx.createGain();
    this.fb.gain.value = 0.32;
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass'; dlp.frequency.value = 2400;
    this.delay.connect(dlp).connect(this.fb).connect(this.delay);
    this.delayOut = ctx.createGain();
    this.delayOut.gain.value = 0.28;
    dlp.connect(this.delayOut).connect(this.out);
    this.noise = audio.noiseBuf;
    this.ks = {};
  }

  setTempo(bpm) {
    this.delay.delayTime.value = (60 / bpm) * 0.75;
  }

  g(t, peak, a, d, hold = 0) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (hold) g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
    return g;
  }

  nsrc(t, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
    return s;
  }

  kick(t, v = 1) {
    const ctx = this.ctx;
    // body: fast pitch drop, slightly driven
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(58, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.3);
    const g = this.g(t, 1.0 * v, 0.001, 0.38);
    if (!this.kickShape) {
      this.kickShape = ctx.createWaveShaper();
      const c = new Float32Array(512);
      for (let i = 0; i < 512; i++) { const x = i / 256 - 1; c[i] = Math.tanh(x * 1.8); }
      this.kickShape.curve = c;
      this.kickShape.connect(this.drums);
    }
    o.connect(g).connect(this.kickShape);
    o.start(t); o.stop(t + 0.45);
    // click
    const n = this.nsrc(t, 0.012);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3800; f.Q.value = 0.9;
    const ng = this.g(t, 0.32 * v, 0.0005, 0.01);
    n.connect(f).connect(ng).connect(this.drums);
    // sidechain pump on everything melodic
    const d = this.duckG.gain;
    d.cancelScheduledValues(t);
    d.setValueAtTime(d.value, t);
    d.linearRampToValueAtTime(0.42, t + 0.006);
    d.setTargetAtTime(1, t + 0.03, 0.09);
  }

  snare(t, v = 1, big = true) {
    const ctx = this.ctx;
    const n = this.nsrc(t, 0.32);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    const f = ctx.createBiquadFilter(); f.type = 'peaking'; f.frequency.value = 4200; f.gain.value = 5;
    const g = this.g(t, 0.4 * v, 0.001, 0.2);
    const pan = ctx.createStereoPanner(); pan.pan.value = 0.06;
    n.connect(hp).connect(f).connect(g).connect(pan).connect(this.drums);
    if (big) {
      // gated 80s reverb: send then hard cut
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(1.0 * v, t);
      sg.gain.setValueAtTime(1.0 * v, t + 0.17);
      sg.gain.linearRampToValueAtTime(0.0001, t + 0.26);
      g.connect(sg).connect(this.rev);
    }
    for (const [fr, a] of [[185, 0.34], [330, 0.14]]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(fr * 1.3, t);
      o.frequency.exponentialRampToValueAtTime(fr, t + 0.03);
      const og = this.g(t, a * v, 0.001, 0.11);
      o.connect(og).connect(this.drums);
      o.start(t); o.stop(t + 0.18);
    }
  }

  clap(t, v = 1) {
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.011;
      const n = this.nsrc(tt, 0.1);
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 1.2;
      const g = this.g(tt, 0.28 * v, 0.001, i === 2 ? 0.14 : 0.02);
      n.connect(f).connect(g).connect(this.drums);
      if (i === 2) g.connect(this.rev);
    }
  }

  hat(t, v = 1, open = false) {
    // 808-style: six detuned square waves through a band-pass, not plain noise
    const ctx = this.ctx;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 10000; bp.Q.value = 0.8;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    const g = this.g(t, 0.085 * v, 0.0008, open ? 0.26 : 0.045);
    const pan = ctx.createStereoPanner(); pan.pan.value = -0.22;
    bp.connect(hp).connect(g).connect(pan).connect(this.drums);
    const end = t + (open ? 0.32 : 0.08);
    for (const fr of [205.3, 304.4, 369.6, 522.7, 540.0, 800.0]) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = fr * 1.7;
      o.connect(bp);
      o.start(t); o.stop(end);
    }
  }

  shaker(t, v = 1) {
    const n = this.nsrc(t, 0.07);
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 6000; f.Q.value = 1;
    const g = this.g(t, 0.07 * v, 0.012, 0.04);
    n.connect(f).connect(g).connect(this.drums);
  }

  // tabla dayan stroke "na": ringing, high
  na(t, v = 1, pitch = 540) {
    for (const [mul, a, d] of [[1, 1, 0.22], [2.02, 0.45, 0.12], [3.01, 0.2, 0.08]]) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(pitch * mul * 1.03, t);
      o.frequency.exponentialRampToValueAtTime(pitch * mul, t + 0.03);
      const g = this.g(t, 0.17 * v * a, 0.001, d);
      o.connect(g).connect(this.drums);
      o.start(t); o.stop(t + d + 0.05);
    }
    const n = this.nsrc(t, 0.02);
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200;
    const ng = this.g(t, 0.08 * v, 0.001, 0.015);
    n.connect(f).connect(ng).connect(this.drums);
  }

  // bayan "ge": the bass drum whose pitch the player bends with the palm
  ge(t, v = 1, bend = 1) {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(92, t);
    o.frequency.linearRampToValueAtTime(92 + 55 * bend, t + 0.22);
    const g = this.g(t, 0.42 * v, 0.004, 0.45);
    o.connect(g).connect(this.drums);
    o.start(t); o.stop(t + 0.55);
  }

  conga(t, v = 1, pitch = 230) {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(pitch * 1.4, t);
    o.frequency.exponentialRampToValueAtTime(pitch, t + 0.04);
    const g = this.g(t, 0.24 * v, 0.001, 0.16);
    o.connect(g).connect(this.drums);
    o.start(t); o.stop(t + 0.2);
  }

  bass(t, m, dur, v = 1, style = 'saw') {
    const ctx = this.ctx;
    const f = hz(m);
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.Q.value = style === 'round' ? 1 : 5;
    const base = style === 'round' ? 420 : 240;
    flt.frequency.setValueAtTime(base + (style === 'round' ? 400 : 2200), t);
    flt.frequency.exponentialRampToValueAtTime(base, t + Math.min(dur, 0.22));
    const g = this.g(t, 0.24 * v, 0.003, Math.max(0.05, dur * 0.9), dur * 0.1);
    flt.connect(g).connect(this.out);
    const oscs = [];
    for (const det of style === 'round' ? [0] : [-9, 9]) {
      const o = ctx.createOscillator();
      o.type = style === 'round' ? 'triangle' : 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(flt);
      oscs.push(o);
    }
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = f / 2;
    const sg = this.g(t, 0.26 * v, 0.003, Math.max(0.05, dur * 0.9), dur * 0.1);
    sub.connect(sg).connect(this.out);
    oscs.push(sub);
    for (const o of oscs) { o.start(t); o.stop(t + dur + 0.1); }
  }

  lead(t, m, dur, v = 1, prev = null, type = 'square') {
    // supersaw-ish lead: a core voice plus detuned saws spread across the stereo field
    const f = hz(m);
    const ctx = this.ctx;
    const startF = prev ? hz(prev) : f;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.6;
    const lg = ctx.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(f * 0.011, t + Math.min(0.4, dur * 0.7));
    lfo.connect(lg);
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.Q.value = 1.2;
    flt.frequency.setValueAtTime(6200, t);
    flt.frequency.exponentialRampToValueAtTime(2300, t + dur);
    const g = this.g(t, 0.1 * v, 0.008, 0.18, Math.max(0.01, dur - 0.05));
    flt.connect(g);
    g.connect(this.out);
    g.connect(this.delay);
    g.connect(this.rev);
    const end = t + dur + 0.3;
    const voices = [[0, 0, type, 0.9], [-11, -0.5, 'sawtooth', 0.45], [11, 0.5, 'sawtooth', 0.45], [-23, -0.8, 'sawtooth', 0.25], [23, 0.8, 'sawtooth', 0.25]];
    for (const [det, p, ty, a] of voices) {
      const o = ctx.createOscillator();
      o.type = ty;
      o.detune.value = det;
      o.frequency.setValueAtTime(startF, t);
      o.frequency.exponentialRampToValueAtTime(f, t + (prev ? 0.05 : 0.001));
      lg.connect(o.frequency);
      const vg = ctx.createGain(); vg.gain.value = a;
      const pn = ctx.createStereoPanner(); pn.pan.value = p;
      o.connect(vg).connect(pn).connect(flt);
      o.start(t); o.stop(end);
    }
    lfo.start(t); lfo.stop(end);
  }

  bansuri(t, m, dur, v = 1, prev = null) {
    // breathy bamboo flute with meend (glide) from the previous note
    const ctx = this.ctx;
    const f = hz(m);
    const o = ctx.createOscillator();
    o.type = 'sine';
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    const startF = prev ? hz(prev) : f * 0.98;
    for (const [osc, mul] of [[o, 1], [o2, 2]]) {
      osc.frequency.setValueAtTime(startF * mul, t);
      osc.frequency.setTargetAtTime(f * mul, t, prev ? 0.06 : 0.02);
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.2;
    const lg = ctx.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(f * 0.01, t + Math.min(0.5, dur * 0.8));
    lfo.connect(lg).connect(o.frequency);
    const g = this.g(t, 0.15 * v, 0.06, 0.25, Math.max(0.01, dur - 0.1));
    const g2 = ctx.createGain();
    g2.gain.value = 0.18;
    o.connect(g);
    o2.connect(g2).connect(g);
    // breath
    const n = this.nsrc(t, dur + 0.3);
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = f * 2; bf.Q.value = 3;
    const bg = this.g(t, 0.05 * v, 0.04, 0.2, Math.max(0.01, dur - 0.1));
    n.connect(bf).connect(bg).connect(this.out);
    g.connect(this.out);
    g.connect(this.rev);
    g.connect(this.delay);
    const end = t + dur + 0.4;
    for (const x of [o, o2, lfo]) { x.start(t); x.stop(end); }
  }

  pluck(t, m, dur, v = 1) {
    // electric-piano-ish FM pluck
    const ctx = this.ctx;
    const f = hz(m);
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f * 2;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 1.6, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.4);
    mod.connect(mg).connect(car.frequency);
    const g = this.g(t, 0.08 * v, 0.002, Math.min(1.4, dur + 0.5));
    car.connect(g).connect(this.out);
    g.connect(this.rev);
    car.start(t); mod.start(t);
    car.stop(t + dur + 1.6); mod.stop(t + dur + 1.6);
  }

  pad(t, ms, dur, v = 1) {
    const ctx = this.ctx;
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(600, t);
    flt.frequency.linearRampToValueAtTime(1500, t + dur * 0.6);
    flt.frequency.linearRampToValueAtTime(900, t + dur);
    flt.Q.value = 0.7;
    const g = this.g(t, 0.04 * v, Math.min(0.7, dur * 0.3), 0.9, Math.max(0.01, dur - 0.7));
    flt.connect(g);
    g.connect(this.out);
    g.connect(this.rev);
    for (const m of ms) {
      for (const [det, p] of [[-12, -0.7], [-4, -0.25], [5, 0.25], [13, 0.7]]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(m);
        o.detune.value = det;
        const pn = ctx.createStereoPanner(); pn.pan.value = p;
        o.connect(pn).connect(flt);
        o.start(t);
        o.stop(t + dur + 1);
      }
    }
  }

  ksBuffer(m) {
    if (this.ks[m]) return this.ks[m];
    // Karplus-Strong plucked string (ektara)
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const f = hz(m);
    const len = Math.floor(sr * 1.6);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const N = Math.max(2, Math.round(sr / f));
    const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const next = (idx + 1) % N;
      const val = (ring[idx] + ring[next]) * 0.5 * 0.996;
      d[i] = ring[idx];
      ring[idx] = val;
      idx = next;
    }
    this.ks[m] = buf;
    return buf;
  }

  ektara(t, m, dur, v = 1, bend = 0) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.ksBuffer(m);
    s.playbackRate.setValueAtTime(1, t);
    if (bend) {
      // the "gub-gubi" squeeze: pitch swoops up and back
      s.playbackRate.linearRampToValueAtTime(Math.pow(2, bend / 12), t + 0.12);
      s.playbackRate.linearRampToValueAtTime(1, t + 0.32);
    }
    const g = this.g(t, 0.3 * v, 0.001, Math.min(1.2, dur + 0.6));
    const f = this.ctx.createBiquadFilter(); f.type = 'peaking'; f.frequency.value = 1800; f.gain.value = 6;
    s.connect(f).connect(g).connect(this.out);
    g.connect(this.rev);
    s.start(t);
    s.stop(t + dur + 1.0);
  }
}

// ------------------------------------------------------------ tracks
function drums(I, t, step, pat, v = 1) {
  for (const k in pat) {
    const p = pat[k];
    if (!p.includes(step)) continue;
    if (k === 'kick') I.kick(t, v);
    else if (k === 'snare') I.snare(t, v);
    else if (k === 'clap') I.clap(t, v);
    else if (k === 'hat') I.hat(t, v * (step % 4 === 2 ? 1 : 0.6));
    else if (k === 'ohat') I.hat(t, v, true);
    else if (k === 'shaker') I.shaker(t, v);
    else if (k === 'na') I.na(t, v);
    else if (k === 'tin') I.na(t, v * 0.6, 720);
    else if (k === 'ge') I.ge(t, v);
    else if (k === 'conga') I.conga(t, v, step % 8 < 4 ? 230 : 180);
  }
}

const range = (a, b, s = 1) => { const o = []; for (let i = a; i < b; i += s) o.push(i); return o; };

export const TRACKS = [
  {
    id: 'monsoon', title: 'Monsoon Shower', station: 'JHALMURI FM', freq: '88.0', bn: 'ঝালমুড়ি এফএম',
    bpm: 124, raga: 'Yaman',
    chords: [
      'D3 A3 C#4 E4 F#4', 'D3 G#3 B3 E4', 'D3 A3 C#4 E4 F#4', 'D3 G#3 B3 E4',
      'B2 F#3 A3 D4', 'G#2 D3 F#3 B3', 'G2 D3 F#3 B3', 'A2 E3 F#3 C#4',
      'G2 D3 F#3 B3', 'F#2 C#3 E3 A3', 'E2 B2 D3 G3', 'A2 D3 E3 G3',
      'G2 D3 F#3 B3', 'F#2 C#3 E3 A3', 'B2 F#3 A3 D4', 'E2 B2 D3 G#3',
    ],
    lead: 'A4:2 D5:2 E5:2 F#5:4 E5:2 D5:2 E5:2 | G#5:6 F#5:2 E5:4 B4:4 | A4:2 D5:2 E5:2 F#5:4 A5:2 G#5:2 F#5:2 | E5:8 -:4 C#5:2 D5:2 | F#5:3 E5:3 D5:2 C#5:4 B4:4 | D5:3 C#5:3 B4:2 G#4:4 B4:4 | F#5:4 D5:2 B4:2 A4:4 B4:2 D5:2 | E5:12 -:4 | B5:4 A5:2 F#5:2 -:2 D5:2 E5:2 F#5:2 | A5:4 F#5:2 E5:2 -:2 C#5:2 E5:4 | G5:4 F#5:2 E5:2 D5:2 B4:2 D5:4 | E5:10 D5:2 C#5:2 A4:2 | B5:4 A5:2 F#5:2 -:2 D6:2 C#6:2 B5:2 | A5:6 F#5:2 G#5:4 A5:4 | F#5:4 E5:2 D5:2 C#5:2 B4:2 C#5:2 D5:2 | G#5:12 -:4',
    leadInst: 'lead',
    play(I, bar, step, t, ctx) {
      const b = bar % 16;
      const chord = ctx.chords[b];
      // bass: octave pump with a fifth
      if (step % 2 === 0) {
        const r = chord[0] - 12;
        const seq = [0, 12, 0, 0, 12, 0, 7, 12];
        I.bass(t, r + seq[step / 2], ctx.sec16 * 1.8, 0.9);
      }
      drums(I, t, step, { kick: [0, 4, 8, 12], snare: [4, 12], ohat: [2, 6, 10, 14], hat: [1, 3, 5, 7, 9, 11, 13, 15], conga: [3, 7, 11], na: b % 4 === 3 ? [13, 14, 15] : [] }, 0.9);
      if (step === 0) I.pad(t, chord.slice(1).map((m) => m + 12), ctx.sec16 * 16, 0.8);
      if (b >= 8 && step % 2 === 1) {
        const tones = chord.slice(1);
        I.pluck(t, tones[(step >> 1) % tones.length] + 24, ctx.sec16, 0.6);
      }
    },
  },
  {
    id: 'kalbaishakhi', title: 'Passing Kalbaishakhi', station: 'RADIO BRISHTI', freq: '91.6', bn: 'রেডিও বৃষ্টি',
    bpm: 100, raga: 'Kafi',
    chords: [
      'E2 B2 D3 F#3 G3', 'A2 C#3 G3 B3 F#4', 'E2 B2 D3 F#3 G3', 'A2 C#3 G3 B3 F#4',
      'C3 G3 B3 E4', 'B2 F#3 A3 D4', 'A2 E3 G3 C4', 'B2 E3 F#3 A3',
    ],
    lead: 'B4:6 D5:2 E5:8 | F#5:4 E5:2 D5:2 C#5:8 | B4:4 E5:4 G5:4 F#5:4 | E5:12 -:4 | G5:6 F#5:2 E5:4 D5:4 | F#5:8 D5:4 B4:4 | C5:4 E5:4 A5:6 G5:2 | F#5:12 D#5:4 | E5:4 G5:4 B5:8 | A5:6 G5:2 F#5:4 E5:4 | G5:4 F#5:4 E5:4 D5:4 | E5:12 -:4 | E5:4 D5:4 C5:4 B4:4 | D5:8 F#5:4 A5:4 | G5:6 F#5:2 E5:4 C5:4 | B4:12 -:4',
    leadInst: 'bansuri',
    play(I, bar, step, t, ctx) {
      const b = bar % 8;
      const chord = ctx.chords[b];
      const r = chord[0] - 12;
      const bl = { 0: [0, 6], 6: [7, 4], 10: [12, 4], 14: [b % 2 ? 10 : 11, 2] };
      if (bl[step]) I.bass(t, r + bl[step][0], ctx.sec16 * bl[step][1], 0.85, 'round');
      drums(I, t, step, { kick: [0, 10], snare: [8], shaker: range(0, 16), ge: [6, 14], tin: [3, 11], na: bar % 4 === 3 ? [12, 13, 15] : [4] }, 0.85);
      if (step === 0) I.pad(t, chord.slice(1).map((m) => m + 12), ctx.sec16 * 16, 0.9);
      if (step === 2 || step === 10) for (const m of chord.slice(1, 4)) I.pluck(t, m + 12, ctx.sec16 * 3, 0.5);
    },
  },
  {
    id: 'buriganga', title: 'Buriganga Wave', station: 'BURIGANGA WAVE', freq: '94.4', bn: 'বুড়িগঙ্গা ওয়েভ',
    bpm: 112, raga: 'Bhairav',
    chords: ['C3 E3 G3 B3', 'Db3 F3 Ab3 C4', 'F2 C3 F3 Ab3', 'G2 D3 F3 Ab3 B3', 'C3 E3 G3 B3', 'Ab2 C3 Eb3 G3', 'Db3 F3 Ab3 C4', 'G2 B2 D3 F3'],
    lead: 'C5:4 Db5:2 E5:2 F5:4 E5:2 Db5:2 | C5:6 Db5:2 F5:4 Ab5:4 | G5:4 F5:2 E5:2 F5:4 Ab5:2 G5:2 | F5:2 E5:2 Db5:4 B4:8 | C5:2 E5:2 G5:4 Ab5:4 G5:4 | C6:6 B5:2 Ab5:4 G5:4 | F5:4 Ab5:2 G5:2 F5:2 E5:2 Db5:4 | C5:12 -:4',
    leadInst: 'lead',
    leadType: 'sawtooth',
    play(I, bar, step, t, ctx) {
      const b = bar % 8;
      const chord = ctx.chords[b];
      const r = chord[0] - 12;
      const pat = [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 7, 12, 0];
      I.bass(t, r + pat[step], ctx.sec16 * 0.9, 0.75);
      drums(I, t, step, { kick: [0, 4, 8, 12], snare: [4, 12], hat: range(0, 16), ohat: [14], na: bar % 4 === 3 ? [9, 10, 11, 13, 14, 15] : [], ge: bar % 2 ? [7] : [] }, 0.9);
      if (step === 0) I.pad(t, chord.slice(1).map((m) => m + 12), ctx.sec16 * 16, 0.7);
      if (bar >= 8 && step % 1 === 0) {
        const tones = chord.slice(1).concat(chord.slice(1).map((m) => m + 12));
        I.pluck(t, tones[step % tones.length] + 12, ctx.sec16 * 0.8, 0.45);
      }
    },
  },
  {
    id: 'baul', title: 'Baul Drive', station: 'BAUL FM', freq: '101.1', bn: 'বাউল এফএম',
    bpm: 120, raga: 'Khamaj',
    chords: ['G2 D3 G3 B3', 'F2 C3 F3 A3', 'C3 G3 C4 E4', 'G2 D3 G3 B3', 'G2 D3 G3 B3', 'F2 C3 F3 A3', 'E2 B2 E3 G3', 'D2 A2 D3 F#3'],
    lead: 'D5:4 B4:2 D5:2 E5:4 D5:4 | C5:4 A4:2 C5:2 D5:4 C5:4 | E5:4 G5:4 E5:2 D5:2 C5:4 | B4:8 G4:4 -:4 | D5:2 D5:2 E5:2 G5:2 A5:4 G5:4 | F5:4 E5:2 D5:2 C5:4 A4:4 | B4:4 D5:2 E5:2 G5:4 E5:4 | D5:12 -:4',
    leadInst: 'bansuri',
    play(I, bar, step, t, ctx) {
      const b = bar % 8;
      const chord = ctx.chords[b];
      const r = chord[0] - 12;
      if (step % 4 === 0) I.bass(t, r + (step === 8 ? 7 : 0), ctx.sec16 * 3, 0.8, 'round');
      if (step % 4 === 2) I.bass(t, r + 12, ctx.sec16 * 1.5, 0.5, 'round');
      // ektara riff with squeezes
      const ek = { 0: [55, 0], 2: [55, 0], 3: [55, 2], 6: [62, 0], 8: [55, 0], 10: [53, 2], 12: [55, 0], 14: [55, 3] };
      if (ek[step]) I.ektara(t, ek[step][0] + 12, ctx.sec16 * 2, 0.9, ek[step][1]);
      drums(I, t, step, { kick: [0, 4, 8, 12], clap: [4, 12], hat: [2, 6, 10, 14], ge: [0, 6, 8], na: [3, 11, 14] }, 0.85);
      if (step === 0 && bar % 2 === 0) I.pad(t, chord.slice(1).map((m) => m + 12), ctx.sec16 * 32, 0.5);
    },
  },
  {
    id: 'sarobar', title: 'Last Wave at Sarobar', station: 'SAROBAR NIGHTS', freq: '104.2', bn: 'সরোবর নাইটস',
    bpm: 84, raga: 'Bilawal',
    chords: ['D3 A3 C#4 F#4', 'B2 F#3 A3 D4 C#4', 'G2 D3 F#3 B3', 'A2 E3 F#3 C#4', 'F#2 C#3 E3 A3', 'B2 F#3 A3 D4', 'E2 B2 D3 F#3 G3', 'A2 E3 G3 C#4'],
    lead: 'F#5:8 E5:4 D5:4 | C#5:8 D5:4 E5:4 | D5:6 B4:2 A4:8 | -:16 | A5:8 G5:4 F#5:4 | F#5:6 E5:2 D5:8 | E5:4 F#5:4 G5:4 B5:4 | A5:16',
    leadInst: 'bansuri',
    play(I, bar, step, t, ctx) {
      const b = bar % 8;
      const chord = ctx.chords[b];
      if (step === 0) I.bass(t, chord[0] - 12, ctx.sec16 * 14, 0.6, 'round');
      if (step === 0) I.pad(t, chord.slice(1).map((m) => m + 12), ctx.sec16 * 16, 1.0);
      if (step % 2 === 0) {
        const tones = chord.slice(1);
        I.pluck(t, tones[(step >> 1) % tones.length] + 12 + (step >= 8 ? 12 : 0), ctx.sec16 * 2, 0.45);
      }
      drums(I, t, step, { kick: bar % 2 ? [0] : [0, 10], shaker: [2, 6, 10, 14], tin: [12] }, 0.6);
    },
  },
];

export class Music {
  constructor() {
    this.I = null;
    this.track = null;
    this.playing = false;
    this.timer = null;
    this.station = 0;
  }

  ensure() {
    if (!audio.ready) return false;
    if (!this.I) this.I = new Instruments();
    return true;
  }

  play(index) {
    if (!this.ensure()) return;
    this.stop();
    if (index == null || index < 0 || index >= TRACKS.length) return;
    const tr = TRACKS[index];
    this.track = tr;
    this.index = index;
    this.ctx = {
      chords: tr.chords.map(chordM),
      lead: parseLine(tr.lead),
      sec16: 60 / tr.bpm / 4,
    };
    this.I.setTempo(tr.bpm);
    this.bar = 0;
    this.step = 0;
    this.prevNote = null;
    this.nextT = audio.ctx.currentTime + 0.1;
    this.playing = true;
    this.I.out.gain.cancelScheduledValues(audio.ctx.currentTime);
    this.I.out.gain.setValueAtTime(0.0001, audio.ctx.currentTime);
    this.I.out.gain.linearRampToValueAtTime(1, audio.ctx.currentTime + 0.6);
    this.timer = setInterval(() => this.tick(), 25);
  }

  stop() {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.I) {
      const t = audio.ctx.currentTime;
      this.I.out.gain.cancelScheduledValues(t);
      this.I.out.gain.setValueAtTime(this.I.out.gain.value, t);
      this.I.out.gain.linearRampToValueAtTime(0.0001, t + 0.3);
      // fresh output node so tails of the old track fade independently
      const old = this.I.out;
      setTimeout(() => old.disconnect(), 600);
      this.I.out = audio.ctx.createGain();
      this.I.out.connect(audio.music);
      this.I.delayOut.disconnect();
      this.I.delayOut.connect(this.I.out);
    }
  }

  tick() {
    if (!this.playing) return;
    const ctx = audio.ctx;
    const tr = this.track;
    while (this.nextT < ctx.currentTime + 0.14) {
      const t = this.nextT;
      const sw = tr.swing && this.step % 2 === 1 ? this.ctx.sec16 * tr.swing : 0;
      try {
        tr.play(this.I, this.bar, this.step, t + sw, this.ctx);
        const lb = this.ctx.lead[this.bar % this.ctx.lead.length];
        for (const n of lb) {
          if (n.step === this.step && n.m != null) {
            const dur = n.len * this.ctx.sec16;
            if (tr.leadInst === 'bansuri') this.I.bansuri(t, n.m, dur, 1, this.prevNote);
            else if (tr.leadInst === 'pluck') this.I.pluck(t, n.m, dur, 1);
            else this.I.lead(t, n.m, dur, 1, n.len <= 2 ? null : this.prevNote, tr.leadType || 'square');
            this.prevNote = n.m;
          }
        }
      } catch (e) {
        // never let a bad note kill the loop, but say so once
        if (!this._warned) { console.warn("[music]", e); this._warned = true; }
      }
      this.nextT += this.ctx.sec16;
      this.step++;
      if (this.step >= 16) {
        this.step = 0;
        this.bar++;
      }
    }
  }
}

export const music = new Music();
