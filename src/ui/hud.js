// HUD: the in-race overlay. Written to the DOM at a throttled rate.

import { bn, fmtTime, clamp } from '../core/util.js';
import { ROUTE, STAGES } from '../world/stages.js';

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
    this.timeLbl = $('hTimeLbl');
    this.ofEl = $('hOf');
    this.objEl = $('hObj');
    this.needEl = $('hNeed');
    this.gapA = $('hGapA');
    this.gapB = $('hGapB');
    this.tagsEl = $('hTags');
    this.tagPool = [];
    this.takeT = 0;
    this.villainEl = $('hVillain');
    this._villainMood = -1;
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

  // circuit mode: lap counter in the objective slot, fuel gauge and nitro charges at the bottom
  setCircuit(on) {
    this.circuitOn = on;
    document.body.classList.toggle('circuit', on);
    this.score.previousElementSibling.textContent = on ? 'COINS' : 'SCORE';
    this.last = {};
  }

  circuitPanel(d) {
    const L = this.last;
    const lapTxt = d.lap >= d.laps ? `FINAL LAP ${d.lap}/${d.laps}` : `LAP ${d.lap}/${d.laps}`;
    if (L.hctLap !== lapTxt) { this.needEl.textContent = lapTxt; this.needEl.classList.toggle('ok', d.lap >= d.laps); L.hctLap = lapTxt; }
    const f = Math.round(clamp(d.fuel, 0, 1) * 100);
    if (L.fuel !== f) { $('hFuelBar').style.width = f + '%'; $('hFuel').classList.toggle('low', f < 20); L.fuel = f; }
    const n = Math.floor(d.nitro) + (d.boosting ? 1 : 0);
    const key = n + ':' + d.boosting;
    if (L.charges !== key) {
      const el = $('hCharges');
      [...el.querySelectorAll('i')].forEach((i, k) => i.classList.toggle('on', k < n));
      el.classList.toggle('burn', !!d.boosting);
      L.charges = key;
    }
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
    this.stageEn.textContent = stage.circuit ? `${stage.laps} LAPS · 20 CARS` : `STAGE ${stage.level + 1} / ${ROUTE.length}`;
    this.stageSub.textContent = '';
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

  // event announcements are off: the road tells you what's going on
  warn() {}

  speak(text, cls = '') {
    this.sayBn.textContent = text;
    this.sayEn.textContent = '';
    this.bubble.className = 'h-bubble show ' + cls;
    this.speakT = Math.max(2.8, text.length * 0.065);
  }

  // ---- boss bar
  boss(on, name = '', sub = '', portrait = false) {
    this.bossEl.classList.toggle('show', on);
    this.bossEl.classList.toggle('portrait', on && portrait);
    document.body.classList.toggle('boss', on && portrait);
    if (on) { this.bossName.textContent = name; this.bossSub.textContent = sub; this.bossHP(1); if (portrait) this.villain(1); }
  }

  // the villain's portrait: calm, then more and more furious as the bar drains
  villain(f) {
    const mood = f <= 0 ? 4 : f > 0.75 ? 0 : f > 0.5 ? 1 : f > 0.25 ? 2 : 3;
    if (mood === this._villainMood) return;
    this._villainMood = mood;
    const c = this.villainEl.getContext('2d');
    const w = 96, h = 96;
    c.clearRect(0, 0, w, h);
    const heat = [0, 0.25, 0.55, 0.9, 0.3][mood];
    c.fillStyle = `rgb(${Math.round(70 + 170 * heat)},${Math.round(70 - 40 * heat)},${Math.round(80 - 50 * heat)})`;
    c.fillRect(0, 0, w, h);
    // saree shoulder
    c.fillStyle = '#7a1d22';
    c.beginPath(); c.moveTo(0, 96); c.quadraticCurveTo(48, 62, 96, 96); c.fill();
    c.fillStyle = '#f2ead6';
    c.beginPath(); c.moveTo(14, 96); c.quadraticCurveTo(48, 70, 82, 96); c.fill();
    // hair and bun
    c.fillStyle = '#d4d0c8';
    c.beginPath(); c.ellipse(48, 46, 29, 34, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(48, 14, 11, 0, Math.PI * 2); c.fill();
    // face
    c.fillStyle = mood >= 2 && mood < 4 ? `rgb(${200 + 30 * heat | 0},${130 - 40 * heat | 0},${100 - 40 * heat | 0})` : '#c89066';
    c.beginPath(); c.ellipse(48, 52, 22, 27, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.5; c.stroke();
    // glasses
    c.strokeStyle = '#222'; c.lineWidth = 2;
    for (const ex of [38, 58]) { c.beginPath(); c.ellipse(ex, 48, 7, 6, 0, 0, Math.PI * 2); c.stroke(); }
    c.beginPath(); c.moveTo(45, 48); c.lineTo(51, 48); c.stroke();
    // eyes and brows by mood
    c.fillStyle = '#111';
    const pupil = mood === 4 ? 1.2 : 2.4;
    for (const ex of [38, 58]) { c.beginPath(); c.arc(ex, 48.5, mood === 4 ? 3.4 : pupil, 0, Math.PI * 2); c.fill(); }
    c.strokeStyle = '#2a1a10'; c.lineWidth = 3;
    const tilt = [0, 3, 6, 9, -3][mood];
    c.beginPath(); c.moveTo(30, 39 - tilt * 0.3 + 3); c.lineTo(45, 39 + tilt); c.stroke();
    c.beginPath(); c.moveTo(66, 39 - tilt * 0.3 + 3); c.lineTo(51, 39 + tilt); c.stroke();
    // mouth
    c.strokeStyle = '#6a1a1a'; c.fillStyle = '#4a0f10'; c.lineWidth = 2.5;
    c.beginPath();
    if (mood === 0) { c.moveTo(40, 68); c.quadraticCurveTo(48, 72, 56, 68); c.stroke(); }
    else if (mood === 1) { c.moveTo(40, 69); c.lineTo(56, 69); c.stroke(); }
    else if (mood === 2) { c.moveTo(40, 71); c.quadraticCurveTo(48, 65, 56, 71); c.stroke(); }
    else if (mood === 3) { c.moveTo(38, 66); c.lineTo(58, 66); c.lineTo(55, 76); c.lineTo(41, 76); c.closePath(); c.fill(); c.fillStyle = '#fff'; c.fillRect(41, 66, 14, 3); }
    else { c.ellipse(48, 71, 5, 7, 0, 0, Math.PI * 2); c.fill(); }
    // steam when furious
    if (mood === 3) { c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 3; for (const x of [14, 82]) { c.beginPath(); c.moveTo(x, 44); c.quadraticCurveTo(x + 6, 34, x, 24); c.stroke(); } }
  }

  bossHP(f, hurt = false) {
    if (this.bossEl.classList.contains('portrait')) this.villain(f);
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
      el.className = r.kind === 'police' ? 'blue' : r.kind === 'racer' || r.kind === 'rival' ? 'gold' : '';
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

  position(pos, up) {
    this.timeBox.classList.remove('up', 'down');
    void this.timeBox.offsetWidth;
    this.timeBox.classList.add(up ? 'up' : 'down');
  }

  // floating name tags over rival cars: [{x, y, name, pos, boss}] in px
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

  timeAdded() {
    this.timeBox.classList.remove('add');
    void this.timeBox.offsetWidth;
    this.timeBox.classList.add('add');
  }

  setPath(path) {
    this.path = path.slice();
    this.drawMap(this.mapCv, this.path, 0);
  }

  // route map: the fifteen districts as a snaking line of stops (shared with the ending postcard)
  drawMap(cv, path, blink, opts = {}) {
    const c = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    c.clearRect(0, 0, W, H);
    const cols = 5, rows = Math.ceil(ROUTE.length / cols);
    const pos = (i) => {
      const r = Math.floor(i / cols), k = i % cols;
      const col = r % 2 ? cols - 1 - k : k;
      return [14 + col * ((W - 28) / (cols - 1)), 14 + r * ((H - 28 - (opts.labels ? 10 : 0)) / Math.max(1, rows - 1))];
    };
    const at = path.length - 1;
    const cur = ROUTE.indexOf(path[at]);
    for (let i = 0; i < ROUTE.length - 1; i++) {
      const [x, y] = pos(i), [x2, y2] = pos(i + 1);
      c.strokeStyle = i < cur ? '#ffb000' : 'rgba(255,241,210,0.25)';
      c.lineWidth = i < cur ? (opts.big ? 5 : 3) : (opts.big ? 2 : 1.5);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
    }
    ROUTE.forEach((id, i) => {
      const [x, y] = pos(i);
      const visited = i <= cur;
      const current = i === cur;
      c.fillStyle = current ? (blink ? '#e4252b' : '#ffe14a') : visited ? '#19a84a' : 'rgba(11,10,26,0.85)';
      c.strokeStyle = '#000';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(x, y, opts.big ? 6 : (current ? 5 : 4), 0, Math.PI * 2);
      c.fill(); c.stroke();
      if (opts.labels) {
        c.font = `400 ${opts.big ? 8 : 7}px "Bungee", sans-serif`;
        c.textAlign = 'center';
        c.fillStyle = visited ? (opts.ink || '#1a0f08') : 'rgba(26,15,8,0.45)';
        c.fillText(STAGES[id].short || STAGES[id].name, x, y + (opts.big ? 16 : 13));
      }
    });
  }

  update(dt, d) {
    this.t += dt;
    const L = this.last;
    // the big plate shows your race position in the Run, the clock otherwise
    if (L.race !== !!d.race) {
      L.race = !!d.race;
      this.timeLbl.textContent = d.race ? 'POS' : 'TIME';
      this.ofEl.style.display = d.race ? '' : 'none';
      this.objEl.style.display = d.race ? '' : 'none';
      L.time = null;
    }
    const tInt = d.race ? d.pos : Math.max(0, Math.ceil(d.time));
    if (L.time !== tInt) { this.time.textContent = bn(tInt); L.time = tInt; }
    if (d.race) {
      const ok = d.pos <= d.need;
      const needTxt = d.need === 1 ? 'FINISH FIRST' : `TARGET P${d.need}`;
      if (!this.circuitOn && L.need !== needTxt + ok) { this.needEl.textContent = needTxt; this.needEl.classList.toggle('ok', ok); L.need = needTxt + ok; }
      if (this.t - (L.gapT || 0) > 0.2) {
        L.gapT = this.t;
        const n = d.near || {};
        this.gapA.textContent = n.ahead ? `▲ ${n.ahead.name} +${n.ahead.t.toFixed(1)}s` : '▲ CLEAR ROAD';
        this.gapB.textContent = n.behind ? `▼ ${n.behind.name} −${n.behind.t.toFixed(1)}s` : '';
      }
      if (L.field !== d.field) { this.ofEl.textContent = '/' + d.field; L.field = d.field; }
    }
    const low = !d.race && d.time < 10 && d.running;
    if (L.low !== low) { this.timeBox.classList.toggle('low', low); L.low = low; }
    const sc = Math.floor(d.score);
    if (L.score !== sc) { this.score.textContent = bn(sc.toLocaleString('en-US')); L.score = sc; }
    if (this.t - (L.lapT || 0) > 0.07) { this.lap.textContent = fmtTime(d.lap); L.lapT = this.t; }
    const sp = Math.round(d.speed);
    if (L.speed !== sp) { this.speed.textContent = bn(sp); L.speed = sp; }
    if (d.gearN) {
      if (L.gearN !== d.gearN) { this.gear.innerHTML = `<b class="on">${d.gearN}</b>`; L.gearN = d.gearN; L.gear = null; }
    } else if (L.gear !== d.gear) {
      if (L.gearN) { this.gear.innerHTML = '<b class="lo">LO</b><b class="hi">HI</b>'; L.gearN = 0; }
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
      const pi = Math.floor((d.stageIndex * 5) / ROUTE.length);
      this.pips.forEach((p, i) => { p.className = i < pi ? 'done' : i === pi ? 'now' : ''; });
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
