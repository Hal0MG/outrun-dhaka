// HUD: the in-race overlay. Written to the DOM at a throttled rate.

import { bn, fmtTime, clamp } from '../core/util.js';
import { ROUTE, STAGES } from '../world/stages.js';
import { drawDhaka } from './dhakamap.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = $('hud');
    this.time = $('hTime');
    this.timeBox = $('hTimeBox');
    this.score = $('hScore');
    this.lap = $('hLap');
    this.lapLbl = $('hLapLbl');
    this.speed = $('hSpeed');
    this.gear = $('hGear');
    this.prog = $('hProg');
    this.stage = $('hStage');
    this.stageBn = $('hStageBn');
    this.stageEn = $('hStageEn');
    this.msg = $('hMsg');
    this.comboEl = $('hCombo');
    this.takeEl = $('hTake');
    this.sig = $('signal');
    this.radioEl = $('hRadio');
    this.station = $('hStation');
    this.freq = $('hFreq');
    this.eq = [...$('hEq').children];
    this.camEl = $('hCam');
    this.mapCv = $('hMap');
    this.ofEl = $('hOf');
    this.needEl = $('hNeed');
    this.gapA = $('hGapA');
    this.gapB = $('hGapB');
    this.tagsEl = $('hTags');
    this.fuelEl = $('hFuel');
    this.fuelBar = $('hFuelBar');
    this.charges = $('hCharges');
    this.tagPool = [];
    this.bubble = $('hBubble');
    this.bubbleText = $('hSay');
    this.portrait = $('tuntuni');
    this.speakT = 0;
    this.buildTacho();
    this.drawPortrait(0);
    this.last = {};
    this.t = 0;
    this.msgT = 0;
    this.comboT = 0;
    this.takeT = 0;
    this.stageT = 0;
    this.mapT = 0;
  }

  show(on) {
    this.el.classList.toggle('show', on);
    document.body.classList.toggle('racing', on);
  }

  // a new race: clear the overlay; the Run shows the city map, a circuit does not
  reset(kind) {
    this.kind = kind;
    this.last = {};
    document.body.classList.toggle('run', kind === 'run');
    this.lapLbl.textContent = kind === 'run' ? 'TIME' : 'LAP';
    for (const el of [this.msg, this.comboEl, this.takeEl, this.bubble]) el.classList.remove('show');
    this.speakT = 0;
    this.msgT = this.comboT = this.takeT = this.stageT = 0;
    this.stage.classList.remove('show');
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

  // Tuntuni's speech bubble; bubbleAt() keeps it on the car
  speak(text) {
    this.bubbleText.textContent = text;
    this.bubble.classList.add('show');
    this.speakT = Math.max(2.2, text.length * 0.07);
  }

  bubbleAt(x, y) {
    const W = window.innerWidth, H = window.innerHeight;
    this.bubble.style.left = Math.max(110, Math.min(W - 160, x)).toFixed(0) + 'px';
    this.bubble.style.top = Math.max(120, Math.min(H - 60, y)).toFixed(0) + 'px';
  }

  // the district's name, small and brief, as the Run crosses into it (a circuit needs no announcement)
  setStage(stage, kind) {
    if (kind === 'circuit') return;
    this.stageBn.textContent = stage.name.toUpperCase();
    this.stageEn.textContent = `THE RUN · ${ROUTE.indexOf(stage.id) + 1} / ${ROUTE.length}`;
    this.stage.classList.add('show');
    this.stageT = 2.6;
  }

  message(text, dur = 2) {
    this.msg.innerHTML = text;
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

  // big slam text (knockouts)
  takedown(text, small = '', dur = 1.6) {
    this.takeEl.innerHTML = `${text}${small ? `<small>${small}</small>` : ''}`;
    this.takeEl.classList.remove('show');
    void this.takeEl.offsetWidth;
    this.takeEl.classList.add('show');
    this.takeT = dur;
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

  position(pos, up) {
    this.timeBox.classList.remove('up', 'down');
    void this.timeBox.offsetWidth;
    this.timeBox.classList.add(up ? 'up' : 'down');
  }

  // floating name tags over rival cars: [{x, y, name, pos, boss, a}] in px
  tags(list) {
    while (this.tagPool.length < list.length) {
      const b = document.createElement('b');
      this.tagsEl.appendChild(b);
      this.tagPool.push(b);
    }
    this.tagPool.forEach((el, i) => {
      const t = list[i];
      if (!t) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
      el.style.display = '';
      el.style.left = t.x.toFixed(0) + 'px';
      el.style.top = t.y.toFixed(0) + 'px';
      el.style.opacity = t.a.toFixed(2);
      const html = `<i>P${t.pos}</i>${t.name}`;
      if (el._h !== html) { el.innerHTML = html; el._h = html; }
      el.classList.toggle('boss', !!t.boss);
    });
  }

  // d: pos, field, near, coins, lapT, speed, rpm, gearN, progress, stageId, lap, laps, ko, fuel, nitro, boosting
  update(dt, d) {
    this.t += dt;
    const L = this.last;
    if (L.pos !== d.pos) { this.time.textContent = bn(d.pos); L.pos = d.pos; }
    if (L.field !== d.field) { this.ofEl.textContent = '/' + d.field; L.field = d.field; }
    // objective: the lap on a circuit, the next knockout gate on the Run
    let need, ok;
    if (this.kind === 'circuit') {
      need = d.lap >= d.laps ? `FINAL LAP ${d.lap}/${d.laps}` : `LAP ${d.lap}/${d.laps}`;
      ok = d.lap >= d.laps;
    } else if (d.ko) {
      const where = d.ko.d != null ? `${(Math.max(0, d.ko.d) / 1000).toFixed(1)} KM` : STAGES[d.ko.at].short;
      need = `KNOCKOUT · ${where} · TOP ${d.ko.cut}`;
      ok = d.pos <= d.ko.cut;
    } else {
      need = 'FINAL · WIN IT';
      ok = d.pos === 1;
    }
    if (L.need !== need + ok) { this.needEl.textContent = need; this.needEl.classList.toggle('ok', ok); L.need = need + ok; }
    if (this.t - (L.gapT || 0) > 0.2) {
      L.gapT = this.t;
      const n = d.near || {};
      this.gapA.textContent = n.ahead ? `▲ ${n.ahead.name} +${n.ahead.t.toFixed(1)}s` : '▲ CLEAR ROAD';
      this.gapB.textContent = n.behind ? `▼ ${n.behind.name} −${n.behind.t.toFixed(1)}s` : '';
    }
    if (L.coins !== d.coins) { this.score.textContent = bn(d.coins); L.coins = d.coins; }
    if (this.t - (L.lapT || 0) > 0.07) { this.lap.textContent = fmtTime(d.lapT); L.lapT = this.t; }
    const sp = Math.round(d.speed);
    if (L.speed !== sp) { this.speed.textContent = bn(sp); L.speed = sp; }
    if (L.gearN !== d.gearN) { this.gear.innerHTML = d.gearN ? `<b class="on">${d.gearN}</b>` : ''; L.gearN = d.gearN; }
    const lit = Math.round(clamp(d.rpm, 0, 1) * this.petals.length);
    if (L.lit !== lit) {
      this.petals.forEach((p, i) => {
        const f = i / this.petals.length;
        p.setAttribute('fill', i < lit ? (f > 0.8 ? '#e4252b' : f > 0.55 ? '#ffb000' : '#19a84a') : 'rgba(255,241,210,0.12)');
      });
      L.lit = lit;
    }
    this.prog.style.width = (clamp(d.progress, 0, 1) * 100).toFixed(1) + '%';
    // fuel and nitro charges
    const f = Math.round(clamp(d.fuel, 0, 1) * 100);
    if (L.fuel !== f) { this.fuelBar.style.width = f + '%'; this.fuelEl.classList.toggle('low', f < 20); L.fuel = f; }
    const n = Math.floor(d.nitro) + (d.boosting ? 1 : 0);
    if (L.charges !== n + ':' + d.boosting) {
      [...this.charges.querySelectorAll('i')].forEach((i, k) => i.classList.toggle('on', k < n));
      this.charges.classList.toggle('burn', !!d.boosting);
      L.charges = n + ':' + d.boosting;
    }
    // timers
    if (this.stageT > 0) { this.stageT -= dt; if (this.stageT <= 0) this.stage.classList.remove('show'); }
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.msg.classList.remove('show'); }
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.comboEl.classList.remove('show'); }
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
    // the Run's city map, with the route so far
    if (this.kind === 'run') {
      this.mapT -= dt;
      if (this.mapT <= 0) {
        this.mapT = 0.5;
        drawDhaka(this.mapCv, { small: true, reached: ROUTE.indexOf(d.stageId) });
      }
    }
  }
}
