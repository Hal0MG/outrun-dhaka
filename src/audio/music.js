// Live-synthesised soundtrack: Bengali folk and film music, played on modelled
// instruments, no synths. Five tracks on Bengali ragas (Yaman, Kafi, Bhairav,
// Khamaj, Bilawal), each over a tanpura drone with its own rhythm:
//   tabla (dayan + bayan, in keherwa and teental), dhol, finger cymbals,
//   harmonium, tanpura, sitar, ektara, bansuri, shehnai and bowed strings.

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
    // mix: melodic bus + percussion bus -> glue compressor -> tone -> music bus
    this.mix = ctx.createGain();
    this.mix.gain.value = 3; // the instruments are voiced quietly; bring the bus up before the glue compressor
    this.glue = ctx.createDynamicsCompressor();
    this.glue.threshold.value = -18; this.glue.ratio.value = 3; this.glue.attack.value = 0.012; this.glue.release.value = 0.2; this.glue.knee.value = 8;
    const lowS = ctx.createBiquadFilter(); lowS.type = 'lowshelf'; lowS.frequency.value = 90; lowS.gain.value = 1.5;
    const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 9000; air.gain.value = 2;
    const mud = ctx.createBiquadFilter(); mud.type = 'peaking'; mud.frequency.value = 320; mud.Q.value = 1; mud.gain.value = -2;
    this.mix.connect(this.glue).connect(mud).connect(lowS).connect(air).connect(audio.music);
    this.out = ctx.createGain();
    this.duckG = ctx.createGain();
    this.out.connect(this.duckG).connect(this.mix);
    this.drums = ctx.createGain();
    this.drums.gain.value = 0.95;
    this.drums.connect(this.mix);
    this.rev = ctx.createGain();
    this.rev.gain.value = 0.5;
    this.rev.connect(audio.revInM);
    // an echo for the lead, set to a dotted beat
    this.delay = ctx.createDelay(1.0);
    this.delay.delayTime.value = 0.36;
    this.fb = ctx.createGain();
    this.fb.gain.value = 0.28;
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass'; dlp.frequency.value = 2400;
    this.delay.connect(dlp).connect(this.fb).connect(this.delay);
    this.delayOut = ctx.createGain();
    this.delayOut.gain.value = 0.22;
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

  // ---------------------------------------------------------- percussion
  // tabla dayan (the small right-hand drum): na (closed ring), tin (open ring), tun (low ring), ta (dry tap)
  dayan(t, v = 1, kind = 'na') {
    const [pitch, ring] = { na: [540, 0.22], tin: [720, 0.32], tun: [330, 0.55], ta: [600, 0.07] }[kind] || [540, 0.22];
    for (const [mul, a, d] of [[1, 1, ring], [2.02, 0.45, ring * 0.55], [3.01, 0.2, ring * 0.35]]) {
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

  // tabla bayan (the big left-hand drum): ge (open, pitch bent up by the heel of the palm), ghe (deeper), ke (closed slap)
  bayan(t, v = 1, kind = 'ge') {
    if (kind === 'ke') {
      const n = this.nsrc(t, 0.05);
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 1.2;
      const g = this.g(t, 0.2 * v, 0.001, 0.05);
      n.connect(f).connect(g).connect(this.drums);
      return;
    }
    const base = kind === 'ghe' ? 76 : 92;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base + (kind === 'ghe' ? 22 : 55), t + 0.22);
    const g = this.g(t, 0.42 * v, 0.004, kind === 'ghe' ? 0.6 : 0.45);
    o.connect(g).connect(this.drums);
    o.start(t); o.stop(t + 0.7);
    const n = this.nsrc(t, 0.02);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const ng = this.g(t, 0.06 * v, 0.001, 0.018);
    n.connect(f).connect(ng).connect(this.drums);
  }

  // a tabla bol: the syllable the drummer would say, played on one or both drums
  bol(t, name, v = 1) {
    switch (name) {
      case 'dha': this.dayan(t, v, 'na'); this.bayan(t, v, 'ge'); break;
      case 'dhin': this.dayan(t, v * 0.9, 'tin'); this.bayan(t, v, 'ge'); break;
      case 'dhi': this.dayan(t, v * 0.55, 'na'); this.bayan(t, v * 0.6, 'ge'); break;
      case 'na': this.dayan(t, v, 'na'); break;
      case 'tin': this.dayan(t, v, 'tin'); break;
      case 'tun': this.dayan(t, v, 'tun'); break;
      case 'ta': this.dayan(t, v, 'ta'); break;
      case 'ti': this.dayan(t, v * 0.5, 'ta'); break;
      case 'ge': this.bayan(t, v, 'ge'); break;
      case 'ghe': this.bayan(t, v, 'ghe'); break;
      case 'ke': this.bayan(t, v * 0.7, 'ke'); break;
      case 'ka': this.bayan(t, v * 0.45, 'ke'); break;
      default: break;
    }
  }

  // dhol: dhag (bass side, played with the heavy stick) and tilli (treble side, thin stick)
  dhol(t, v = 1, kind = 'dhag') {
    const ctx = this.ctx;
    if (kind === 'dhag') {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(66, t + 0.06);
      const g = this.g(t, 0.5 * v, 0.002, 0.34);
      o.connect(g).connect(this.drums);
      o.start(t); o.stop(t + 0.45);
      const n = this.nsrc(t, 0.03);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1;
      const ng = this.g(t, 0.14 * v, 0.001, 0.025);
      n.connect(f).connect(ng).connect(this.drums);
    } else {
      const n = this.nsrc(t, 0.08);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2800; f.Q.value = 3;
      const g = this.g(t, 0.17 * v, 0.001, 0.07);
      n.connect(f).connect(g).connect(this.drums);
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 420;
      const og = this.g(t, 0.07 * v, 0.001, 0.08);
      o.connect(og).connect(this.drums);
      o.start(t); o.stop(t + 0.12);
    }
  }

  // finger cymbals (zil / khartal): a bright, brief inharmonic ping
  zil(t, v = 1) {
    const ctx = this.ctx;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const g = this.g(t, 0.034 * v, 0.001, 0.3);
    const pan = ctx.createStereoPanner(); pan.pan.value = 0.25;
    hp.connect(g).connect(pan).connect(this.drums);
    for (const fr of [3900, 5230, 6760, 8100]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = fr;
      o.connect(hp);
      o.start(t); o.stop(t + 0.36);
    }
    g.connect(this.rev);
  }

  // ---------------------------------------------------------- strings
  // a plucked string by Karplus-Strong; decay close to 1 rings long (tanpura), lower is a quick pluck
  ksBuffer(m, decay = 0.996) {
    const key = m + ':' + decay;
    if (this.ks[key]) return this.ks[key];
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const f = hz(m);
    const len = Math.floor(sr * (decay > 0.999 ? 3.2 : 1.6));
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const N = Math.max(2, Math.round(sr / f));
    const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const next = (idx + 1) % N;
      const val = (ring[idx] + ring[next]) * 0.5 * decay;
      d[i] = ring[idx];
      ring[idx] = val;
      idx = next;
    }
    this.ks[key] = buf;
    return buf;
  }

  // the bridge of a sitar or tanpura buzzes (jawari): a soft clip adds the brightness
  jawariCurve() {
    if (this._jawari) return this._jawari;
    const c = new Float32Array(512);
    for (let i = 0; i < 512; i++) { const x = i / 256 - 1; c[i] = Math.tanh(x * 3); }
    return (this._jawari = c);
  }

  // one string of the tanpura drone
  tanpura(t, m, v = 1) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.ksBuffer(m, 0.9993);
    const buzz = ctx.createBiquadFilter(); buzz.type = 'peaking'; buzz.frequency.value = 2600; buzz.gain.value = 7; buzz.Q.value = 1;
    const sh = ctx.createWaveShaper();
    sh.curve = this.jawariCurve();
    const g = this.g(t, 0.2 * v, 0.004, 2.6);
    s.connect(sh).connect(buzz).connect(g).connect(this.out);
    g.connect(this.rev);
    s.start(t); s.stop(t + 3.2);
  }

  // sitar: a plucked string with the buzzing bridge and meend (a glide up or down from the last note)
  sitar(t, m, dur, v = 1, prev = null) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.ksBuffer(m, 0.9985);
    if (prev != null && Math.abs(prev - m) <= 5 && prev !== m) {
      s.playbackRate.setValueAtTime(Math.pow(2, (prev - m) / 12), t);
      s.playbackRate.setTargetAtTime(1, t, 0.05);
    }
    const sh = ctx.createWaveShaper();
    sh.curve = this.jawariCurve();
    const buzz = ctx.createBiquadFilter(); buzz.type = 'peaking'; buzz.frequency.value = 2400; buzz.gain.value = 6; buzz.Q.value = 1;
    const g = this.g(t, 0.2 * v, 0.002, Math.min(1.5, dur + 0.7));
    s.connect(sh).connect(buzz).connect(g);
    g.connect(this.out);
    g.connect(this.delay);
    g.connect(this.rev);
    s.start(t); s.stop(t + dur + 1.6);
  }

  // ektara: the one-string folk instrument of the Baul singers, with the "gub-gubi" squeeze
  ektara(t, m, dur, v = 1, bend = 0) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.ksBuffer(m);
    s.playbackRate.setValueAtTime(1, t);
    if (bend) {
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

  // ---------------------------------------------------------- reeds, winds, bows
  // harmonium: a reed organ, two slightly detuned reeds per note through a nasal filter
  harmonium(t, ms, dur, v = 1) {
    const ctx = this.ctx;
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 2300; flt.Q.value = 0.8;
    const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 950; body.gain.value = 4; body.Q.value = 1.1;
    const g = this.g(t, 0.036 * v, 0.045, 0.28, Math.max(0.01, dur - 0.1));
    flt.connect(body).connect(g);
    g.connect(this.out);
    g.connect(this.rev);
    for (const m of ms) {
      for (const [det, ty, a] of [[-7, 'sawtooth', 1], [7, 'sawtooth', 1], [0, 'square', 0.35]]) {
        const o = ctx.createOscillator();
        o.type = ty;
        o.frequency.value = hz(m);
        o.detune.value = det;
        const og = ctx.createGain(); og.gain.value = a;
        o.connect(og).connect(flt);
        o.start(t);
        o.stop(t + dur + 0.5);
      }
    }
  }

  // bansuri: a breathy bamboo flute with meend (glide) from the previous note
  bansuri(t, m, dur, v = 1, prev = null) {
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
    const g = this.g(t, 0.17 * v, 0.06, 0.25, Math.max(0.01, dur - 0.1));
    const g2 = ctx.createGain();
    g2.gain.value = 0.18;
    o.connect(g);
    o2.connect(g2).connect(g);
    // breath
    const n = this.nsrc(t, dur + 0.3);
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = f * 2; bf.Q.value = 3;
    const bg = this.g(t, 0.06 * v, 0.04, 0.2, Math.max(0.01, dur - 0.1));
    n.connect(bf).connect(bg).connect(this.out);
    g.connect(this.out);
    g.connect(this.rev);
    g.connect(this.delay);
    const end = t + dur + 0.4;
    for (const x of [o, o2, lfo]) { x.start(t); x.stop(end); }
  }

  // shehnai: the double-reed oboe of weddings and festivals, nasal and bright, with a wide vibrato
  shehnai(t, m, dur, v = 1, prev = null) {
    const ctx = this.ctx;
    const f = hz(m);
    const startF = prev && Math.abs(prev - m) <= 4 ? hz(prev) : f;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.8;
    const lg = ctx.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(f * 0.009, t + Math.min(0.35, dur * 0.7));
    lfo.connect(lg);
    const nasal = ctx.createBiquadFilter(); nasal.type = 'bandpass'; nasal.frequency.value = 1350; nasal.Q.value = 2.6;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800;
    const g = this.g(t, 0.12 * v, 0.045, 0.2, Math.max(0.01, dur - 0.08));
    nasal.connect(lp).connect(g);
    g.connect(this.out);
    g.connect(this.delay);
    g.connect(this.rev);
    const end = t + dur + 0.35;
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = det;
      o.frequency.setValueAtTime(startF, t);
      o.frequency.setTargetAtTime(f, t, 0.04);
      lg.connect(o.frequency);
      o.connect(nasal);
      o.start(t); o.stop(end);
    }
    lfo.start(t); lfo.stop(end);
  }

  // bowed strings (esraj / violin): a slow swell under the melody
  strings(t, ms, dur, v = 1) {
    const ctx = this.ctx;
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 2100; flt.Q.value = 0.6;
    const g = this.g(t, 0.028 * v, Math.min(0.5, dur * 0.35), 0.6, Math.max(0.01, dur - 0.5));
    flt.connect(g);
    g.connect(this.out);
    g.connect(this.rev);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5;
    for (const m of ms) {
      const lg = ctx.createGain();
      lg.gain.value = hz(m) * 0.004;
      lfo.connect(lg);
      for (const det of [-8, 8]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(m);
        o.detune.value = det;
        lg.connect(o.frequency);
        o.connect(flt);
        o.start(t); o.stop(t + dur + 0.8);
      }
    }
    lfo.start(t); lfo.stop(t + dur + 0.8);
  }
}

// ------------------------------------------------------------ rhythm
// one bar is sixteen steps. keherwa is eight beats of two steps; teental is sixteen beats over two bars.
const KEHERWA = ['dha', 'ti', 'ge', 'ta', 'na', 'ka', 'ti', 'na', 'na', 'ti', 'ka', 'ta', 'dhi', 'ti', 'na', 'ka'];
const KEHERWA_LIGHT = ['dha', '', 'ge', '', 'na', '', 'ti', '', 'na', '', 'ka', '', 'dhi', '', 'na', ''];
const TEENTAL = ['dha', 'dhin', 'dhin', 'dha', 'dha', 'dhin', 'dhin', 'dha', 'dha', 'tin', 'tin', 'ta', 'ta', 'dhin', 'dhin', 'dha'];
// the end of a phrase: a short tihai fill
const FILL = { 10: 'na', 11: 'ge', 12: 'na', 13: 'dha', 14: 'na', 15: 'dha' };

// the tabla for this step: pattern is a 16-step bols array (or for teental, 32 steps over two bars at two steps a beat)
function tabla(I, t, bar, step, pat, v, opts = {}) {
  let bol = pat[step];
  if (opts.teental) bol = step % 2 === 0 ? TEENTAL[((bar % 2) * 16 + step) / 2 | 0] : '';
  if (opts.fills && bar % 4 === 3 && FILL[step]) bol = FILL[step];
  if (bol) I.bol(t, bol, v * (opts.light && step % 4 !== 0 ? 0.7 : 1));
}

// tanpura: Pa, Sa, Sa, low Sa, once a bar, so the drone never stops
function drone(I, t, step, sa, v = 1) {
  if (step === 0) I.tanpura(t, sa - 5, v);
  else if (step === 4) I.tanpura(t, sa, v * 0.9);
  else if (step === 8) I.tanpura(t, sa, v * 0.9);
  else if (step === 12) I.tanpura(t, sa - 12, v);
}

export const TRACKS = [
  {
    id: 'monsoon', title: 'Monsoon Shower', station: 'JHALMURI FM', freq: '88.0', bn: 'ঝালমুড়ি এফএম',
    bpm: 118, raga: 'Yaman', sa: 50,
    chords: [
      'D3 A3 C#4 E4 F#4', 'D3 G#3 B3 E4', 'D3 A3 C#4 E4 F#4', 'D3 G#3 B3 E4',
      'B2 F#3 A3 D4', 'G#2 D3 F#3 B3', 'G2 D3 F#3 B3', 'A2 E3 F#3 C#4',
      'G2 D3 F#3 B3', 'F#2 C#3 E3 A3', 'E2 B2 D3 G3', 'A2 D3 E3 G3',
      'G2 D3 F#3 B3', 'F#2 C#3 E3 A3', 'B2 F#3 A3 D4', 'E2 B2 D3 G#3',
    ],
    lead: 'A4:2 D5:2 E5:2 F#5:4 E5:2 D5:2 E5:2 | G#5:6 F#5:2 E5:4 B4:4 | A4:2 D5:2 E5:2 F#5:4 A5:2 G#5:2 F#5:2 | E5:8 -:4 C#5:2 D5:2 | F#5:3 E5:3 D5:2 C#5:4 B4:4 | D5:3 C#5:3 B4:2 G#4:4 B4:4 | F#5:4 D5:2 B4:2 A4:4 B4:2 D5:2 | E5:12 -:4 | B5:4 A5:2 F#5:2 -:2 D5:2 E5:2 F#5:2 | A5:4 F#5:2 E5:2 -:2 C#5:2 E5:4 | G5:4 F#5:2 E5:2 D5:2 B4:2 D5:4 | E5:10 D5:2 C#5:2 A4:2 | B5:4 A5:2 F#5:2 -:2 D6:2 C#6:2 B5:2 | A5:6 F#5:2 G#5:4 A5:4 | F#5:4 E5:2 D5:2 C#5:2 B4:2 C#5:2 D5:2 | G#5:12 -:4',
    leadInst: 'shehnai',
    // a bouncy filmi groove: keherwa tabla, dhol on the offbeats, harmonium chops
    play(I, bar, step, t, ctx) {
      const b = bar % 16;
      const chord = ctx.chords[b];
      drone(I, t, step, 50, 0.85);
      tabla(I, t, bar, step, bar >= 2 ? KEHERWA : KEHERWA_LIGHT, 0.95, { fills: true });
      if (bar >= 2) {
        if (step === 0 || step === 8) I.dhol(t, 0.75, 'dhag');
        if (step === 4 || step === 6 || step === 12 || step === 14) I.dhol(t, 0.55, 'tilli');
        if (step % 4 === 2) I.zil(t, 0.6);
      }
      // harmonium: the low root held, the chord chopped on the offbeats
      if (step === 0) I.harmonium(t, [chord[0]], ctx.sec16 * 15, 0.9);
      if (step === 4 || step === 12) I.harmonium(t, chord.slice(1).map((m) => m + 12), ctx.sec16 * 3, 0.8);
      if (bar >= 8 && step % 2 === 1) I.sitar(t, chord.slice(1)[(step >> 1) % (chord.length - 1)] + 24, ctx.sec16 * 2, 0.4);
      if (bar >= 12 && step === 0) I.strings(t, chord.slice(1).map((m) => m + 12), ctx.sec16 * 16, 0.9);
    },
  },
  {
    id: 'kalbaishakhi', title: 'Passing Kalbaishakhi', station: 'RADIO BRISHTI', freq: '91.6', bn: 'রেডিও বৃষ্টি',
    bpm: 96, raga: 'Kafi', sa: 52,
    chords: [
      'E2 B2 D3 F#3 G3', 'A2 C#3 G3 B3 F#4', 'E2 B2 D3 F#3 G3', 'A2 C#3 G3 B3 F#4',
      'C3 G3 B3 E4', 'B2 F#3 A3 D4', 'A2 E3 G3 C4', 'B2 E3 F#3 A3',
    ],
    lead: 'B4:6 D5:2 E5:8 | F#5:4 E5:2 D5:2 C#5:8 | B4:4 E5:4 G5:4 F#5:4 | E5:12 -:4 | G5:6 F#5:2 E5:4 D5:4 | F#5:8 D5:4 B4:4 | C5:4 E5:4 A5:6 G5:2 | F#5:12 D#5:4 | E5:4 G5:4 B5:8 | A5:6 G5:2 F#5:4 E5:4 | G5:4 F#5:4 E5:4 D5:4 | E5:12 -:4 | E5:4 D5:4 C5:4 B4:4 | D5:8 F#5:4 A5:4 | G5:6 F#5:2 E5:4 C5:4 | B4:12 -:4',
    leadInst: 'sitar',
    // a storm coming in over the fields: sitar with meend over a slow teental
    play(I, bar, step, t, ctx) {
      const b = bar % 8;
      const chord = ctx.chords[b];
      drone(I, t, step, 52, 1);
      tabla(I, t, bar, step, [], 0.85, { teental: true });
      if (step === 0) I.harmonium(t, chord.slice(1).map((m) => m + 12), ctx.sec16 * 16, 0.95);
      if (step === 0) I.harmonium(t, [chord[0]], ctx.sec16 * 16, 0.7);
      if (bar >= 4 && step === 0) I.strings(t, chord.slice(1, 4).map((m) => m + 12), ctx.sec16 * 16, 0.8);
      if (step === 8 && bar % 2) I.zil(t, 0.5);
      if (bar >= 4 && (step === 2 || step === 10)) I.sitar(t, chord[2 + (step >> 3)] + 12, ctx.sec16 * 3, 0.45);
      if (bar % 4 === 3 && step === 12) I.dhol(t, 0.6, 'dhag');
    },
  },
  {
    id: 'buriganga', title: 'Buriganga Wave', station: 'BURIGANGA WAVE', freq: '94.4', bn: 'বুড়িগঙ্গা ওয়েভ',
    bpm: 108, raga: 'Bhairav', sa: 48,
    chords: ['C3 E3 G3 B3', 'Db3 F3 Ab3 C4', 'F2 C3 F3 Ab3', 'G2 D3 F3 Ab3 B3', 'C3 E3 G3 B3', 'Ab2 C3 Eb3 G3', 'Db3 F3 Ab3 C4', 'G2 B2 D3 F3'],
    lead: 'C5:4 Db5:2 E5:2 F5:4 E5:2 Db5:2 | C5:6 Db5:2 F5:4 Ab5:4 | G5:4 F5:2 E5:2 F5:4 Ab5:2 G5:2 | F5:2 E5:2 Db5:4 B4:8 | C5:2 E5:2 G5:4 Ab5:4 G5:4 | C6:6 B5:2 Ab5:4 G5:4 | F5:4 Ab5:2 G5:2 F5:2 E5:2 Db5:4 | C5:12 -:4',
    leadInst: 'bansuri',
    // a boat song (bhatiali) on the river: bansuri over a rocking dhol and a dotara-like pluck
    swing: 0.12,
    play(I, bar, step, t, ctx) {
      const b = bar % 8;
      const chord = ctx.chords[b];
      drone(I, t, step, 48, 0.9);
      tabla(I, t, bar, step, KEHERWA_LIGHT, 0.8, { fills: true, light: true });
      if (step === 0 || step === 6 || step === 10) I.dhol(t, 0.55, 'dhag');
      if (step === 3 || step === 11 || step === 14) I.dhol(t, 0.4, 'tilli');
      if (step === 0) I.harmonium(t, chord.slice(0, 3), ctx.sec16 * 16, 0.85);
      if (step === 0) I.strings(t, chord.slice(1).map((m) => m + 12), ctx.sec16 * 16, 0.9);
      // the dotara-style ostinato: root, fifth and octave
      const pat = { 0: 0, 3: 7, 6: 12, 8: 7, 11: 12, 14: 7 };
      if (pat[step] != null) I.ektara(t, chord[0] + 12 + pat[step], ctx.sec16 * 2, 0.6);
      if (step === 2 || step === 10) I.zil(t, 0.45);
    },
  },
  {
    id: 'baul', title: 'Baul Drive', station: 'BAUL FM', freq: '101.1', bn: 'বাউল এফএম',
    bpm: 120, raga: 'Khamaj', sa: 55,
    chords: ['G2 D3 G3 B3', 'F2 C3 F3 A3', 'C3 G3 C4 E4', 'G2 D3 G3 B3', 'G2 D3 G3 B3', 'F2 C3 F3 A3', 'E2 B2 E3 G3', 'D2 A2 D3 F#3'],
    lead: 'D5:4 B4:2 D5:2 E5:4 D5:4 | C5:4 A4:2 C5:2 D5:4 C5:4 | E5:4 G5:4 E5:2 D5:2 C5:4 | B4:8 G4:4 -:4 | D5:2 D5:2 E5:2 G5:2 A5:4 G5:4 | F5:4 E5:2 D5:2 C5:4 A4:4 | B4:4 D5:2 E5:2 G5:4 E5:4 | D5:12 -:4',
    leadInst: 'bansuri',
    // Baul folk: the ektara riff with squeezes, a bass drum (dugi) and khartal cymbals
    play(I, bar, step, t, ctx) {
      const b = bar % 8;
      const chord = ctx.chords[b];
      drone(I, t, step, 55, 0.8);
      // ektara riff with squeezes
      const ek = { 0: [55, 0], 2: [55, 0], 3: [55, 2], 6: [62, 0], 8: [55, 0], 10: [53, 2], 12: [55, 0], 14: [55, 3] };
      if (ek[step]) I.ektara(t, ek[step][0] + 12, ctx.sec16 * 2, 0.9, ek[step][1]);
      // dugi: the little bass drum, bent with the palm
      if (step === 0 || step === 6 || step === 8 || step === 14) I.bayan(t, 0.9, step === 6 ? 'ghe' : 'ge');
      if (step === 4 || step === 12) I.dayan(t, 0.8, 'na');
      if (step === 3 || step === 11 || step === 15) I.dayan(t, 0.5, 'ta');
      if (bar >= 2 && (step === 0 || step === 8)) I.dhol(t, 0.5, 'dhag');
      if (step % 4 === 2) I.zil(t, 0.8);
      if (step === 0) I.harmonium(t, [chord[0], chord[1]], ctx.sec16 * 15, 0.7);
      if (bar >= 4 && step === 4) I.harmonium(t, chord.slice(1).map((m) => m + 12), ctx.sec16 * 3, 0.55);
    },
  },
  {
    id: 'sarobar', title: 'Last Wave at Sarobar', station: 'SAROBAR NIGHTS', freq: '104.2', bn: 'সরোবর নাইটস',
    bpm: 80, raga: 'Bilawal', sa: 50,
    chords: ['D3 A3 C#4 F#4', 'B2 F#3 A3 D4 C#4', 'G2 D3 F#3 B3', 'A2 E3 F#3 C#4', 'F#2 C#3 E3 A3', 'B2 F#3 A3 D4', 'E2 B2 D3 F#3 G3', 'A2 E3 G3 C#4'],
    lead: 'F#5:8 E5:4 D5:4 | C#5:8 D5:4 E5:4 | D5:6 B4:2 A4:8 | -:16 | A5:8 G5:4 F#5:4 | F#5:6 E5:2 D5:8 | E5:4 F#5:4 G5:4 B5:4 | A5:16',
    leadInst: 'bansuri',
    // the quiet ending: tanpura, a held harmonium and one slow flute
    play(I, bar, step, t, ctx) {
      const b = bar % 8;
      const chord = ctx.chords[b];
      drone(I, t, step, 50, 1.1);
      if (step === 0) I.harmonium(t, chord.slice(1).map((m) => m + 12), ctx.sec16 * 16, 1);
      if (step === 0) I.harmonium(t, [chord[0]], ctx.sec16 * 16, 0.7);
      if (bar >= 2 && step === 0) I.strings(t, chord.slice(1).map((m) => m + 12), ctx.sec16 * 16, 0.9);
      if (step % 4 === 0 && bar >= 4) I.sitar(t, chord.slice(1)[(step >> 2) % (chord.length - 1)] + 12 + (step >= 8 ? 12 : 0), ctx.sec16 * 4, 0.35);
      // a few soft tabla strokes, half time
      if (step === 0) I.bol(t, 'dha', 0.55);
      if (step === 8 && bar % 2) I.bol(t, 'na', 0.5);
      if (step === 12) I.bol(t, 'tin', 0.4);
    },
  },
];

// Two decks so one area's music can crossfade into the next without a gap.
// Each deck has its own melodic and percussion outputs; the Instruments object is
// pointed at a deck's outputs while that deck schedules its notes.
class Deck {
  constructor(I, index, fadeIn) {
    const ac = audio.ctx;
    const tr = TRACKS[index];
    this.index = index;
    this.track = tr;
    this.ctx = { chords: tr.chords.map(chordM), lead: parseLine(tr.lead), sec16: 60 / tr.bpm / 4 };
    this.bar = 0;
    this.step = 0;
    this.prevNote = null;
    this.nextT = ac.currentTime + 0.08;
    this.out = ac.createGain();
    this.out.connect(I.duckG);
    this.drums = ac.createGain();
    this.drums.gain.value = 0.95;
    this.fader = ac.createGain();
    this.drums.connect(this.fader).connect(I.mix);
    const t = ac.currentTime;
    for (const g of [this.out.gain, this.fader.gain]) {
      g.setValueAtTime(fadeIn > 0 ? 0.0001 : 1, t);
      if (fadeIn > 0) g.linearRampToValueAtTime(1, t + fadeIn);
    }
    this.alive = true;
  }

  fadeOut(sec) {
    const t = audio.ctx.currentTime;
    for (const g of [this.out.gain, this.fader.gain]) {
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(0.0001, g.value), t);
      g.linearRampToValueAtTime(0.0001, t + sec);
    }
    this.endT = t + sec;
  }

  dispose() {
    this.alive = false;
    setTimeout(() => { this.out.disconnect(); this.fader.disconnect(); }, 1500);
  }
}

export class Music {
  constructor() {
    this.I = null;
    this.decks = [];
    this.timer = null;
    this.playing = false;
  }

  ensure() {
    if (!audio.ready) return false;
    if (!this.I) this.I = new Instruments();
    return true;
  }

  get index() { const d = this.decks[this.decks.length - 1]; return d ? d.index : -1; }
  get track() { const d = this.decks[this.decks.length - 1]; return d ? d.track : null; }

  // start a track; with fade > 0 the current one crossfades out over the same time
  play(index, fade = 0.6) {
    if (!this.ensure()) return;
    if (index == null || index < 0 || index >= TRACKS.length) { this.stop(); return; }
    if (this.index === index && this.playing) return;
    for (const d of this.decks) if (!d.endT) d.fadeOut(Math.max(0.3, fade));
    const deck = new Deck(this.I, index, fade);
    this.decks.push(deck);
    this.I.setTempo(deck.track.bpm);
    this.playing = true;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
  }

  stop(fade = 0.4) {
    for (const d of this.decks) if (!d.endT) d.fadeOut(fade);
    this.playing = false;
  }

  tick() {
    const ac = audio.ctx;
    const I = this.I;
    const keep = { out: I.out, drums: I.drums };
    for (const d of this.decks) {
      if (!d.alive) continue;
      if (d.endT && ac.currentTime > d.endT + 0.2) { d.dispose(); continue; }
      I.out = d.out;
      I.drums = d.drums;
      const tr = d.track;
      while (d.nextT < ac.currentTime + 0.14) {
        const t = d.nextT;
        const sw = tr.swing && d.step % 2 === 1 ? d.ctx.sec16 * tr.swing : 0;
        try {
          tr.play(I, d.bar, d.step, t + sw, d.ctx);
          const lb = d.ctx.lead[d.bar % d.ctx.lead.length];
          for (const n of lb) {
            if (n.step === d.step && n.m != null) {
              const dur = n.len * d.ctx.sec16;
              if (tr.leadInst === 'bansuri') I.bansuri(t, n.m, dur, 1, d.prevNote);
              else if (tr.leadInst === 'shehnai') I.shehnai(t, n.m, dur, 1, n.len <= 2 ? null : d.prevNote);
              else I.sitar(t, n.m, dur, 1.15, d.prevNote);
              d.prevNote = n.m;
            }
          }
        } catch (e) {
          if (!this._warned) { console.warn('[music]', e); this._warned = true; }
        }
        d.nextT += d.ctx.sec16;
        d.step++;
        if (d.step >= 16) { d.step = 0; d.bar++; }
      }
    }
    I.out = keep.out;
    I.drums = keep.drums;
    this.decks = this.decks.filter((d) => d.alive);
    if (!this.decks.length && this.timer) { clearInterval(this.timer); this.timer = null; }
  }
}

export const music = new Music();
