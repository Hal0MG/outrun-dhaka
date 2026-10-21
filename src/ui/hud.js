// HUD: the in-race overlay. Written to the DOM at a throttled rate.

import { bn, fmtTime, clamp } from '../core/util.js';
import { PYRAMID, STAGES } from '../world/stages.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = $('hud');
    this.time = $('hTime');
    this.timeBox = $('hTimeBox');
    this.score = $('hScore');
    this.lap = $('hLap');
    this.speed = $('hSpeed');
    this.gear = $('hGear');
    this.prog = $('hProg');
    this.pips = [...$('hPips').children];
    this.stage = $('hStage');
    this.stageBn = $('hStageBn');
    this.stageEn = $('hStageEn');
    this.stageSub = $('hStageSub');
    this.msg = $('hMsg');
    this.comboEl = $('hCombo');
    this.warnEl = $('hWarn');
    this.bubble = $('hBubble');
    this.sayBn = $('hSayBn');
    this.sayEn = $('hSayEn');
    this.sig = $('signal');
    this.radioEl = $('hRadio');
    this.station = $('hStation');
    this.freq = $('hFreq');
    this.eq = [...$('hEq').children];
    this.camEl = $('hCam');
    this.mapCv = $('hMap');
    this.portrait = $('tuntuni');
    this.bossEl = $('hBoss');
    this.bossName = $('hBossName');
    this.bossSub = $('hBossSub');
    this.bossBar = $('hBossBar');
    this.nitroEl = $('hNitro');
    this.nitroBar = $('hNitroBar');
    this.takeEl = $('hTake');
    this.rearEl = $('hRear');
    this.sareeEl = $('hSaree');
    this.takeT = 0;
    this.rearPool = [];
    this.buildTacho();
    this.drawPortrait(0);
    this.last = {};
    this.t = 0;
    this.speakT = 0;
    this.msgT = 0;
    this.comboT = 0;
    this.warnT = 0;
    this.stageT = 0;
    this.path = [];
    this.mapT = 0;
  }

  show(on) {
    this.el.classList.toggle('show', on);
    document.body.classList.toggle('racing', on);
  }

  buildTacho() {
    const svg = $('tacho');
    const N = 15;
    let html = '';
    // backing arc (cream enamel with dots)
    html += '<path d="M -104 8 A 104 104 0 0 1 104 8 L 60 8 A 60 60 0 0 0 -60 8 Z" fill="rgba(11,10,26,0.55)" stroke="#000" stroke-width="3"/>';
    for (let i = 0; i < N; i++) {
      const a = 180 + (i / (N - 1)) * 180;
      html += `<path class="pt" data-i="${i}" transform="rotate(${a})" d="M 58 0 C 70 -11, 90 -10, 101 0 C 90 10, 70 11, 58 0 Z" fill="rgba(255,241,210,0.12)" stroke="#000" stroke-width="2.5"/>`;
    }
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      html += `<circle cx="${Math.cos(a) * 52}" cy="${Math.sin(a) * 52}" r="2.5" fill="#ffb000"/>`;
    }
    svg.innerHTML = html;
    this.petals = [...svg.querySelectorAll('.pt')];
  }

  drawPortrait(mouth) {
    const c = this.portrait.getContext('2d');
    const w = 96, h = 96;
    c.clearRect(0, 0, w, h);
    // halo of petals (rickshaw art)
    c.fillStyle = '#ff2e88';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.fillStyle = i % 2 ? '#ffb000' : '#ffe14a';
      c.beginPath();
      c.ellipse(48 + Math.cos(a) * 40, 50 + Math.sin(a) * 40, 9, 5, a, 0, Math.PI * 2);
      c.fill();
    }
    // hair back
    c.fillStyle = '#140e0a';
    c.beginPath(); c.ellipse(48, 52, 27, 33, 0, 0, Math.PI * 2); c.fill();
    // face
    const g = c.createRadialGradient(42, 44, 4, 48, 52, 26);
    g.addColorStop(0, '#d99a6a');
    g.addColorStop(1, '#a8673f');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(48, 54, 19, 23, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#3a1a0a'; c.lineWidth = 1.5; c.stroke();
    // fringe
    c.fillStyle = '#140e0a';
    c.beginPath(); c.moveTo(28, 50); c.quadraticCurveTo(34, 24, 52, 28); c.quadraticCurveTo(68, 30, 68, 50); c.quadraticCurveTo(58, 36, 46, 38); c.quadraticCurveTo(36, 40, 28, 50); c.fill();
    // flower clip
    c.fillStyle = '#e4252b';
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.beginPath(); c.arc(66 + Math.cos(a) * 4, 34 + Math.sin(a) * 4, 3.4, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#ffe14a'; c.beginPath(); c.arc(66, 34, 2.4, 0, Math.PI * 2); c.fill();
    // eyes with kajal
    for (const ex of [40, 56]) {
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex, 52, 5, 3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a0d08'; c.beginPath(); c.arc(ex + 0.5, 52, 2.2, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#000'; c.lineWidth = 1.8; c.beginPath(); c.ellipse(ex, 52, 5.5, 3.2, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
      c.lineWidth = 1.4; c.beginPath(); c.moveTo(ex - 5, 46); c.quadraticCurveTo(ex, 43.5, ex + 5, 46); c.stroke();
    }
    // nose ring + nose
    c.strokeStyle = '#7a3a1a'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(48, 54); c.lineTo(46.5, 60); c.lineTo(49, 61); c.stroke();
    c.strokeStyle = '#ffcf33'; c.lineWidth = 1.4; c.beginPath(); c.arc(50.5, 61, 2.4, 0, Math.PI * 2); c.stroke();
    // mouth
    c.fillStyle = '#9a1a2a';
    c.beginPath();
    if (mouth) c.ellipse(48, 67, 4.5, 3 + mouth * 2, 0, 0, Math.PI * 2);
    else { c.moveTo(43, 67); c.quadraticCurveTo(48, 70, 53, 67); c.quadraticCurveTo(48, 68.5, 43, 67); }
    c.fill();
    // jhumka earrings
    for (const ex of [28, 68]) {
      c.fillStyle = '#ffcf33';
      c.beginPath(); c.moveTo(ex - 4, 62); c.lineTo(ex + 4, 62); c.lineTo(ex, 70); c.closePath(); c.fill();
      c.beginPath(); c.arc(ex, 71, 2, 0, Math.PI * 2); c.fill();
    }
  }

  setStage(stage, big = true) {
    this.stageBn.textContent = stage.name.toUpperCase();
    this.stageEn.textContent = 'STAGE ' + (stage.level + 1);
    this.stageSub.textContent = stage.sub;
    if (big) {
      this.stage.classList.add('big');
      this.stageT = 3.4;
    }
  }

  message(en, dur = 2) {
    if (typeof dur !== 'number') dur = arguments[2] ?? 2;
    this.msg.innerHTML = en;
    this.msg.classList.remove('show');
    void this.msg.offsetWidth;
    this.msg.classList.add('show');
    this.msgT = dur;
  }

  combo(text, small = '') {
    this.comboEl.innerHTML = `${text}${small ? `<small>${small}</small>` : ''}`;
    this.comboEl.classList.remove('show');
    void this.comboEl.offsetWidth;
    this.comboEl.classList.add('show');
    this.comboT = 1.6;
  }

  warn(html, dur = 3) {
    this.warnEl.innerHTML = html;
    this.warnEl.classList.add('show');
    this.warnT = dur;
  }

  speak(text, cls = '') {
    this.sayBn.textContent = text;
    this.sayEn.textContent = '';
    this.bubble.className = 'h-bubble show ' + cls;
    this.speakT = Math.max(2.8, text.length * 0.065);
  }

  // ---- boss bar
  boss(on, name = '', sub = '') {
    this.bossEl.classList.toggle('show', on);
    if (on) { this.bossName.textContent = name; this.bossSub.textContent = sub; this.bossHP(1); }
  }

  bossHP(f, hurt = false) {
    this.bossBar.style.width = (clamp(f, 0, 1) * 100).toFixed(1) + '%';
    if (hurt) {
      this.bossBar.classList.add('hurt');
      clearTimeout(this._bossT);
      this._bossT = setTimeout(() => this.bossBar.classList.remove('hurt'), 120);
    }
  }

  // ---- nitro
  nitro(f, on) {
    const L = this.last;
    const w = Math.round(clamp(f, 0, 1) * 100);
    if (L.nitro !== w) { this.nitroBar.style.width = w + '%'; L.nitro = w; }
    const full = f > 0.98;
    if (L.nitroFull !== full) { this.nitroEl.classList.toggle('full', full); L.nitroFull = full; }
    if (L.nitroOn !== on) { this.nitroEl.classList.toggle('on', on); L.nitroOn = on; }
  }

  // ---- big slam text (takedowns, set pieces)
  takedown(text, small = '', dur = 1.6) {
    this.takeEl.innerHTML = `${text}${small ? `<small>${small}</small>` : ''}`;
    this.takeEl.classList.remove('show');
    void this.takeEl.offsetWidth;
    this.takeEl.classList.add('show');
    this.takeT = dur;
  }

  // ---- markers for enemies closing in from behind: [{x: -1..1, kind}]
  rear(list) {
    while (this.rearPool.length < list.length) {
      const i = document.createElement('i');
      this.rearEl.appendChild(i);
      this.rearPool.push(i);
    }
    this.rearPool.forEach((el, i) => {
      const r = list[i];
      if (!r) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.style.left = (50 + clamp(r.x, -1, 1) * 46).toFixed(1) + '%';
      el.style.transform = `translateX(-50%) scale(${(0.7 + r.near * 0.6).toFixed(2)})`;
      el.className = r.kind === 'police' ? 'blue' : r.kind === 'racer' ? 'gold' : '';
    });
  }

  // ---- a saree stuck on the windscreen
  saree(on, pattern) {
    if (on && pattern && this._sareeP !== pattern) { this.sareeEl.style.background = pattern; this._sareeP = pattern; }
    this.sareeEl.classList.toggle('show', on);
  }

  signal(state) {
    if (!state) { this.sig.classList.remove('show'); return; }
    this.sig.classList.add('show');
    for (const i of this.sig.children) i.classList.toggle('on', i.classList.contains(state));
  }

  radio(name, freq, on) {
    this.station.textContent = name;
    this.freq.textContent = freq;
    this.radioEl.classList.toggle('off', !on);
    this.radioOn = on;
  }

  cam(label) {
    this.camEl.textContent = 'CAMERA · ' + label.toUpperCase();
    this.camEl.classList.add('show');
    clearTimeout(this._camT);
    this._camT = setTimeout(() => this.camEl.classList.remove('show'), 1400);
  }

  timeAdded() {
    this.timeBox.classList.remove('add');
    void this.timeBox.offsetWidth;
    this.timeBox.classList.add('add');
  }

  setPath(path) {
    this.path = path.slice();
    this.drawMap(this.mapCv, this.path, 0);
  }

  // OutRun-style route map (shared with the ending postcard)
  drawMap(cv, path, blink, opts = {}) {
    const c = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    c.clearRect(0, 0, W, H);
    const pos = (lv, i) => {
      const n = PYRAMID[lv].length;
      const x = W / 2 + (i - (n - 1) / 2) * (W / 5.4);
      const y = 12 + lv * ((H - 24) / 4);
      return [x, y];
    };
    c.lineWidth = opts.big ? 3 : 2;
    for (let lv = 0; lv < 4; lv++) {
      for (let i = 0; i < PYRAMID[lv].length; i++) {
        const [x, y] = pos(lv, i);
        for (const j of [i, i + 1]) {
          const [x2, y2] = pos(lv + 1, j);
          const on = path[lv] === PYRAMID[lv][i] && path[lv + 1] === PYRAMID[lv + 1][j];
          c.strokeStyle = on ? '#ffb000' : 'rgba(255,241,210,0.25)';
          c.lineWidth = on ? (opts.big ? 5 : 3.5) : (opts.big ? 2 : 1.5);
          c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
        }
      }
    }
    for (let lv = 0; lv < 5; lv++) {
      for (let i = 0; i < PYRAMID[lv].length; i++) {
        const [x, y] = pos(lv, i);
        const id = PYRAMID[lv][i];
        const visited = path[lv] === id;
        const current = visited && lv === path.length - 1;
        c.fillStyle = current ? (blink ? '#e4252b' : '#ffe14a') : visited ? '#19a84a' : 'rgba(11,10,26,0.85)';
        c.strokeStyle = '#000';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(x, y, opts.big ? 7 : 5, 0, Math.PI * 2);
        c.fill(); c.stroke();
        if (opts.labels) {
          c.font = `400 ${opts.big ? 9 : 8}px "Bungee", sans-serif`;
          c.textAlign = 'center';
          c.fillStyle = visited ? (opts.ink || '#1a0f08') : 'rgba(26,15,8,0.45)';
          c.fillText(STAGES[id].short || STAGES[id].name, x, y + (opts.big ? 20 : 15));
        }
      }
    }
  }

  update(dt, d) {
    this.t += dt;
    const L = this.last;
    const tInt = Math.max(0, Math.ceil(d.time));
    if (L.time !== tInt) { this.time.textContent = bn(tInt); L.time = tInt; }
    const low = d.time < 10 && d.running;
    if (L.low !== low) { this.timeBox.classList.toggle('low', low); L.low = low; }
    const sc = Math.floor(d.score);
    if (L.score !== sc) { this.score.textContent = bn(sc.toLocaleString('en-US')); L.score = sc; }
    if (this.t - (L.lapT || 0) > 0.07) { this.lap.textContent = fmtTime(d.lap); L.lapT = this.t; }
    const sp = Math.round(d.speed);
    if (L.speed !== sp) { this.speed.textContent = bn(sp); L.speed = sp; }
    if (L.gear !== d.gear) {
      this.gear.children[0].classList.toggle('on', d.gear === 0);
      this.gear.children[1].classList.toggle('on', d.gear === 1);
      L.gear = d.gear;
    }
    const lit = Math.round(clamp(d.rpm, 0, 1) * this.petals.length);
    if (L.lit !== lit) {
      this.petals.forEach((p, i) => {
        const on = i < lit;
        const f = i / this.petals.length;
        p.setAttribute('fill', on ? (f > 0.8 ? '#e4252b' : f > 0.55 ? '#ffb000' : '#19a84a') : 'rgba(255,241,210,0.12)');
      });
      L.lit = lit;
    }
    this.prog.style.width = (clamp(d.progress, 0, 1) * 100).toFixed(1) + '%';
    if (L.stageIdx !== d.stageIndex) {
      this.pips.forEach((p, i) => { p.className = i < d.stageIndex ? 'done' : i === d.stageIndex ? 'now' : ''; });
      L.stageIdx = d.stageIndex;
    }
    // timers
    if (this.stageT > 0) { this.stageT -= dt; if (this.stageT <= 0) this.stage.classList.remove('big'); }
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.msg.classList.remove('show'); }
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.comboEl.classList.remove('show'); }
    if (this.warnT > 0) { this.warnT -= dt; if (this.warnT <= 0) this.warnEl.classList.remove('show'); }
    if (this.takeT > 0) { this.takeT -= dt; if (this.takeT <= 0) this.takeEl.classList.remove('show'); }
    if (this.speakT > 0) {
      this.speakT -= dt;
      const m = Math.floor(this.t * 9) % 3;
      if (m !== this._mouth) { this.drawPortrait(this.speakT > 0.5 ? m / 2 : 0); this._mouth = m; }
      if (this.speakT <= 0) { this.bubble.classList.remove('show'); this.drawPortrait(0); }
    }
    // radio EQ
    if (this.radioOn) {
      this.eq.forEach((b, i) => { b.style.height = (20 + Math.abs(Math.sin(this.t * (3 + i * 1.7) + i)) * 80 * (0.6 + 0.4 * Math.random())).toFixed(0) + '%'; });
    }
    this.mapT -= dt;
    if (this.mapT <= 0) {
      this.mapT = 0.35;
      this._blink = !this._blink;
      this.drawMap(this.mapCv, this.path, this._blink);
    }
  }
}
