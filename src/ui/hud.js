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
    this.buildTacho();
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
    for (const el of [this.msg, this.comboEl, this.takeEl]) el.classList.remove('show');
    this.msgT = this.comboT = this.takeT = 0;
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

  // the district name, big at the start of a race and as the Run enters each one
  setStage(stage, kind) {
    this.stageBn.textContent = stage.name.toUpperCase();
    if (kind === 'circuit') this.stageEn.textContent = `${stage.laps} LAPS · 20 CARS`;
    else this.stageEn.textContent = `THE RUN · ${ROUTE.indexOf(stage.id) + 1} / ${ROUTE.length}`;
    this.stage.classList.add('big');
    this.stageT = 3.4;
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
    if (this.stageT > 0) { this.stageT -= dt; if (this.stageT <= 0) this.stage.classList.remove('big'); }
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.msg.classList.remove('show'); }
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.comboEl.classList.remove('show'); }
    if (this.takeT > 0) { this.takeT -= dt; if (this.takeT <= 0) this.takeEl.classList.remove('show'); }
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
