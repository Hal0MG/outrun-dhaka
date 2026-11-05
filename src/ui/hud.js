// HUD: the in-race overlay. Written to the DOM at a throttled rate.

import { fmtTime, clamp } from '../core/util.js';
import { ROUTE, STAGES } from '../world/stages.js';
import { audio } from '../audio/audio.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = $('hud');
    this.time = $('hTime');
    this.timeBox = $('hTimeBox');
    this.where = $('hWhere');
    this.toGo = $('hToGo');
    this.route = $('hRoute');
    this.rt = { head: $('hRtHead'), name: $('hRtName'), l1: $('hRtL1'), v1: $('hRtV1'), l2: $('hRtL2'), v2: $('hRtV2') };
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
    this.ofEl = $('hOf');
    this.needEl = $('hNeed');
    this.gapA = $('hGapA');
    this.gapB = $('hGapB');
    this.parEl = $('hPar');
    this.tagsEl = $('hTags');
    this.crossEl = $('hCross');
    this.crossT = $('hCrossT');
    this.crossD = $('hCrossD');
    this.charges = $('hCharges');
    this.tagPool = [];
    this.bubble = $('hBubble');
    this.bubbleText = $('hSay');
    this.speakT = 0;
    this.last = {};
    this.t = 0;
    this.msgT = 0;
    this.comboT = 0;
    this.takeT = 0;
    this.stageT = 0;
  }

  show(on) {
    this.el.classList.toggle('show', on);
    document.body.classList.toggle('racing', on);
  }

  // a new race: clear the overlay; the Run shows the city map, a circuit does not
  reset(kind) {
    this.kind = kind;
    this.last = {};
    this.crossEl.classList.remove('show', 'now');
    document.body.classList.toggle('run', kind === 'run');
    for (const el of [this.msg, this.comboEl, this.takeEl, this.bubble]) el.classList.remove('show');
    this.speakT = 0;
    this.msgT = this.comboT = this.takeT = this.stageT = 0;
    this.stage.classList.remove('show');
  }

  // the driver's speech bubble; bubbleAt() keeps it on the car
  speak(text) {
    audio.talk(text);
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

  // where you are and how far there is to go: the line under the clock, the count under the progress bar, and the card
  // above the map. On a phone the first two are all there is, so they say everything the card does.
  updateRoute(d) {
    const L = this.last;
    const km = (m) => (Math.max(0, m) / 1000).toFixed(1);
    let where, togo, head, name, l1, v1, l2, v2;
    if (this.kind === 'circuit') {
      // (the lap clock only matters on a circuit)
      const lapNo = d.lap >= d.laps ? `FINAL LAP ${d.lap}/${d.laps}` : `LAP ${d.lap}/${d.laps}`;
      if (this.t - (L.lapClk || 0) > 0.1) { L.lapClk = this.t; L.lapTxt = fmtTime(d.lapT); }
      where = `${lapNo} · ${L.lapTxt}`;
      togo = `${km(d.left)} KM TO GO`;
      head = lapNo; name = d.name.toUpperCase(); l1 = 'THIS LAP'; v1 = `${km(d.lapLeft)} KM`; l2 = 'TO THE FLAG'; v2 = `${km(d.left)} KM`;
    } else {
      where = `DISTRICT ${d.district} / ${d.districts} · ${d.name.toUpperCase()}`;
      togo = `${km(d.left)} KM TO PADMA`;
      head = `DISTRICT ${d.district} / ${d.districts}`; name = d.name.toUpperCase();
      l1 = d.gate ? `NEXT GATE · ${d.gate.name}` : 'FINAL'; v1 = d.gate ? `${km(d.gate.d)} KM · TOP ${d.gate.cut}` : 'WIN IT';
      l2 = 'FINISH'; v2 = `${km(d.left)} KM`;
    }
    const key = [where, togo, head, name, l1, v1, l2, v2].join('|');
    if (L.route === key) return;
    L.route = key;
    this.where.textContent = where;
    this.toGo.textContent = togo;
    const r = this.rt;
    r.head.textContent = head; r.name.textContent = name; r.l1.textContent = l1; r.v1.textContent = v1; r.l2.textContent = l2; r.v2.textContent = v2;
  }

  // d: pos, field, near, raceT, lapT, progress, stageId, lap, laps, ko, nitro, boosting, cross, and the route: district,
  // districts (this one's number and how many), name, left (metres to the finish), gate {name, d, cut} (the next knockout)
  update(dt, d) {
    this.t += dt;
    const L = this.last;
    // the clock is the headline; where you are in the field is the small print under it
    if (this.t - (L.rtT || 0) > 0.05) { this.time.textContent = fmtTime(d.raceT); L.rtT = this.t; }
    const posTxt = `P${d.pos} / ${d.field}`;
    if (L.posTxt !== posTxt) { this.ofEl.textContent = posTxt; L.posTxt = posTxt; }
    // the next medal to beat
    let par = '', cls = '';
    if (d.par) {
      const k = d.par.findIndex((p) => d.raceT < p);
      if (k >= 0) { par = `${['GOLD', 'SILVER', 'BRONZE'][k]} ${fmtTime(d.par[k], 0)}`; cls = ['gold', 'silver', 'bronze'][k]; }
      else { par = 'NO MEDAL'; cls = ''; }
    }
    if (L.par !== par) { this.parEl.textContent = par; this.parEl.className = 'par ' + cls; L.par = par; }
    // objective: the lap on a circuit, the next knockout gate on the Run
    let need, ok;
    if (this.kind === 'circuit') {
      need = d.lap >= d.laps ? `FINAL LAP ${d.lap}/${d.laps}` : `LAP ${d.lap}/${d.laps}`;
      ok = d.lap >= d.laps;
    } else if (d.ko) {
      const where = d.gate ? `${(Math.max(0, d.gate.d) / 1000).toFixed(1)} KM` : STAGES[d.ko.at].short;
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
    this.updateRoute(d);
    this.prog.style.width = (clamp(d.progress, 0, 1) * 100).toFixed(1) + '%';
    // nitro charges
    const n = Math.floor(d.nitro) + (d.boosting ? 1 : 0);
    if (L.charges !== n + ':' + d.boosting) {
      [...this.charges.querySelectorAll('i')].forEach((i, k) => i.classList.toggle('on', k < n));
      this.charges.classList.toggle('burn', !!d.boosting);
      L.charges = n + ':' + d.boosting;
    }
    // road works: a standing "cross over" prompt with the distance to the barrier, so the move is never a surprise
    const cr = d.cross;
    const crKey = cr ? (cr.d > 0 ? 'ahead' : 'now') : '';
    if (L.crKey !== crKey) {
      L.crKey = crKey;
      this.crossEl.classList.toggle('show', !!cr);
      this.crossEl.classList.toggle('now', crKey === 'now');
      this.crossT.textContent = crKey === 'now' ? 'KEEP RIGHT · USE THE OTHER SIDE' : 'ROAD WORKS · CROSS OVER';
    }
    if (cr && crKey === 'ahead') {
      const m = Math.round(cr.d / 10) * 10;
      if (L.crM !== m) { this.crossD.textContent = `▶ ${m} M`; L.crM = m; }
    } else if (cr && L.crM !== -1) { this.crossD.textContent = '▶▶▶'; L.crM = -1; }
    // timers
    if (this.stageT > 0) { this.stageT -= dt; if (this.stageT <= 0) this.stage.classList.remove('show'); }
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.msg.classList.remove('show'); }
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.comboEl.classList.remove('show'); }
    if (this.takeT > 0) { this.takeT -= dt; if (this.takeT <= 0) this.takeEl.classList.remove('show'); }
    if (this.speakT > 0) {
      this.speakT -= dt;
      if (this.speakT <= 0) this.bubble.classList.remove('show');
    }
    // radio EQ
    if (this.radioOn) {
      this.eq.forEach((b, i) => { b.style.height = (20 + Math.abs(Math.sin(this.t * (3 + i * 1.7) + i)) * 80 * (0.6 + 0.4 * Math.random())).toFixed(0) + '%'; });
    }
  }
}
