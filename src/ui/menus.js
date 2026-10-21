// Screen flow: title -> menu -> garage -> radio -> race -> ending -> name entry.

import { CARS } from '../game/cars.js';
import { TRACKS, music } from '../audio/music.js';
import { audio } from '../audio/audio.js';
import { ENDINGS, STAGES, PYRAMID } from '../world/stages.js';
import { RIVALS, FIELD, TARGETS } from '../game/race.js';
import { bn, store, fmtTime } from '../core/util.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['loading', 'title', 'garage', 'radio', 'settings', 'scores', 'howto', 'pause', 'ending', 'gameover', 'nameentry', 'story'];

export class Menus {
  constructor(game, input, settings, saveSettings) {
    this.game = game;
    this.input = input;
    this.settings = settings;
    this.save = saveSettings;
    this.screen = 'loading';
    this.sel = 0;
    this.returnTo = 'title';
    this.endings = new Set(store.get('endings', []));
    this.scores = store.get('scores', []);
    this.bindMouse();
    this.updateEndingsLabel();
  }

  show(name) {
    for (const s of SCREENS) $(s).classList.toggle('show', s === name);
    this.screen = name;
    this.sel = 0;
    this.refresh();
  }

  bindMouse() {
    const click = (id, fn) => $(id).addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b) { audio.init(); fn(b.dataset.act, b); }
    });
    click('mainMenu', (a) => this.mainAction(a));
    click('pauseMenu', (a) => this.pauseAction(a));
    click('garage', (a) => this.garageAction(a));
    $('title').addEventListener('click', (e) => {
      audio.init();
      if ($('mainMenu').hidden) this.openMenu();
    });
    $('stationList').addEventListener('click', (e) => {
      const li = e.target.closest('li');
      if (!li) return;
      const i = +li.dataset.i;
      if (i === this.sel) this.startRace();
      else { this.sel = i; this.previewStation(); this.refresh(); }
    });
    $('setList').addEventListener('click', (e) => {
      const r = e.target.closest('.set-row');
      if (!r) return;
      this.sel = +r.dataset.i;
      this.changeSetting(1);
    });
    $('carColors').addEventListener('click', (e) => {
      const b = e.target.closest('b');
      if (!b) return;
      this.game.colorIndex = +b.dataset.i;
      this.game.buildCar();
      this.refresh();
    });
    for (const id of ['ending', 'gameover', 'story']) $(id).addEventListener('click', () => this.input.tap('confirm'));
  }

  updateEndingsLabel() {
    $('endingsFound').textContent = `ENDINGS FOUND ${this.endings.size}/5`;
  }

  openMenu() {
    $('mainMenu').hidden = false;
    $('pressStart').style.display = 'none';
    this.sel = 0;
    this.refresh();
    audio.confirm();
  }

  // ------------------------------------------------------------ per-frame input
  update(dt) {
    const I = this.input;
    const s = this.screen;
    const up = I.pressed('up'), down = I.pressed('down'), left = I.pressed('left'), right = I.pressed('right');
    const ok = I.pressed('confirm'), back = I.pressed('back') || (I.pressed('pause') && s !== 'title');
    if (s === 'title') {
      if ($('mainMenu').hidden) {
        if (ok || I.pressed('boost')) { audio.init(); this.openMenu(); }
        return;
      }
      const n = $('mainMenu').children.length;
      if (up) { this.sel = (this.sel + n - 1) % n; audio.blip(); this.refresh(); }
      if (down) { this.sel = (this.sel + 1) % n; audio.blip(); this.refresh(); }
      if (ok) this.mainAction($('mainMenu').children[this.sel].dataset.act);
      if (back) { $('mainMenu').hidden = true; $('pressStart').style.display = ''; }
    } else if (s === 'garage') {
      if (left) this.garageAction('prevCar');
      if (right) this.garageAction('nextCar');
      const nc = CARS[this.game.carIndex].colors.length;
      if (up || down) { this.game.colorIndex = (this.game.colorIndex + (up ? nc - 1 : 1)) % nc; this.game.buildCar(); audio.blip(); this.refresh(); }
      if (ok) this.garageAction('pickCar');
      if (back) { audio.back(); this.show('title'); this.game.state = 'title'; }
    } else if (s === 'radio') {
      const n = TRACKS.length + 1;
      if (up) { this.sel = (this.sel + n - 1) % n; this.previewStation(); this.refresh(); }
      if (down) { this.sel = (this.sel + 1) % n; this.previewStation(); this.refresh(); }
      if (ok) this.startRace();
      if (back) { audio.back(); music.stop(); this.show('garage'); this.game.state = 'garage'; }
    } else if (s === 'settings') {
      const rows = this.settingRows();
      if (up) { this.sel = (this.sel + rows.length - 1) % rows.length; audio.blip(); this.refresh(); }
      if (down) { this.sel = (this.sel + 1) % rows.length; audio.blip(); this.refresh(); }
      if (left) this.changeSetting(-1);
      if (right || ok) this.changeSetting(1);
      if (back) { audio.back(); this.save(); this.show(this.returnTo); if (this.returnTo === 'title') this.game.state = 'title'; else this.game.state = 'paused'; }
    } else if (s === 'scores' || s === 'howto') {
      if (back || ok) { audio.back(); this.show('title'); this.game.state = 'title'; $('mainMenu').hidden = false; $('pressStart').style.display = 'none'; }
    } else if (s === 'pause') {
      const n = $('pauseMenu').children.length;
      if (up) { this.sel = (this.sel + n - 1) % n; audio.blip(); this.refresh(); }
      if (down) { this.sel = (this.sel + 1) % n; audio.blip(); this.refresh(); }
      if (ok) this.pauseAction($('pauseMenu').children[this.sel].dataset.act);
      if (I.pressed('pause') || I.pressed('back')) this.pauseAction('resume');
    } else if (s === 'ending') {
      if (ok && this.endingReady) this.afterResults();
    } else if (s === 'gameover') {
      if (ok && this.overReady) {
        if (this.game.eliminated) { audio.confirm(); this.hideAll(); this.game.retryStage(); }
        else this.afterResults();
      }
      if (back && this.overReady && this.game.eliminated) { this.game.eliminated = null; this.afterResults(); }
    } else if (s === 'story') {
      if (ok && this.storyReady) { audio.confirm(); this.hideAll(); this.game.beginCountdown(); }
    } else if (s === 'nameentry') {
      const L = this.letters;
      const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .-!';
      if (up || down) {
        const i = A.indexOf(L[this.nameSel]);
        L[this.nameSel] = A[(i + (up ? 1 : A.length - 1)) % A.length];
        audio.blip(1000);
        this.refresh();
      }
      if (left) { this.nameSel = Math.max(0, this.nameSel - 1); this.refresh(); }
      if (right) { this.nameSel = Math.min(2, this.nameSel + 1); this.refresh(); }
      if (ok) {
        if (this.nameSel < 2) { this.nameSel++; audio.blip(); this.refresh(); }
        else this.saveScore();
      }
    }
  }

  // ------------------------------------------------------------ actions
  mainAction(a) {
    audio.confirm();
    if (a === 'arcade' || a === 'cruise') {
      this.pendingMode = a;
      this.show('garage');
      this.game.state = 'garage';
    } else if (a === 'garage') {
      this.pendingMode = 'arcade';
      this.show('garage');
      this.game.state = 'garage';
    } else if (a === 'scores') {
      this.show('scores');
      this.game.state = 'scores';
    } else if (a === 'settings') {
      this.returnTo = 'title';
      this.show('settings');
      this.game.state = 'settings';
    } else if (a === 'howto') {
      this.show('howto');
      this.game.state = 'howto';
    }
  }

  garageAction(a) {
    const g = this.game;
    if (a === 'prevCar' || a === 'nextCar') {
      g.carIndex = (g.carIndex + (a === 'nextCar' ? 1 : CARS.length - 1)) % CARS.length;
      g.colorIndex = 0;
      g.buildCar();
      audio.blip();
      this.refresh();
    } else if (a === 'pickCar') {
      const def = CARS[g.carIndex];
      if (def.locked && !this.endings.size) { audio.back(); this.flashLocked(); return; }
      audio.confirm();
      this.settings.car = g.carIndex;
      this.settings.color = g.colorIndex;
      this.save();
      this.show('radio');
      this.game.state = 'radio';
      this.sel = this.settings.station ?? 0;
      this.previewStation();
      this.refresh();
    }
  }

  flashLocked() {
    const el = $('carName');
    el.style.color = '#000';
    setTimeout(() => (el.style.color = ''), 300);
  }

  previewStation() {
    audio.init();
    audio.tune();
    this.game.setStation(this.sel);
  }

  startRace() {
    audio.confirm();
    this.settings.station = this.sel;
    this.save();
    for (const s of SCREENS) $(s).classList.remove('show');
    this.screen = 'race';
    this.game.startRun(this.pendingMode || 'arcade');
    if (this.game.state === 'story') this.showStory();
    if (CARS[this.game.carIndex].id === 'rickshaw') setTimeout(() => this.game.say.say('rickshaw9000', true), 5000);
  }

  hideAll() {
    for (const s of SCREENS) $(s).classList.remove('show');
    this.screen = 'race';
  }

  // the setup: why you are racing across Dhaka tonight
  showStory() {
    const lines = [
      'You lost <b>Golden Bhai</b>’s shipment of ilish in the Buriganga. All of it. He wants <b>৳5 crore</b> by sunrise.',
      'There is exactly one way to make that kind of money in one night: <b>the Dhaka Run</b>. Twenty-four drivers, Dhanmondi to the edge of the city, no rules, winner takes everything.',
      '<b>RAJA</b> has won it three years running in a black Skyline. Nobody has ever started from the back and won. You are starting from the back.',
      `Reach <b>P${TARGETS[0]}</b> by the end of Dhanmondi, then keep climbing through all fifteen districts to the Padma Bridge. Finish first or don’t come home.`,
    ];
    $('storyLines').innerHTML = lines.map((l) => `<p>${l}</p>`).join('');
    const grid = RIVALS.map((r, i) => `<span><i>P${i + 1}</i>${r.name}</span>`);
    grid.push(`<span class="you"><i>P${FIELD}</i>YOU</span>`);
    $('storyGrid').innerHTML = grid.join('');
    this.show('story');
    this.storyReady = false;
    [...$('storyLines').children].forEach((p, i) => setTimeout(() => p.classList.add('in'), 300 + i * 900));
    setTimeout(() => (this.storyReady = true), 900);
  }

  pause() {
    if (this.game.state !== 'race' && this.game.state !== 'countdown') return;
    this.game.hud.tags([]);
    this.prevState = this.game.state;
    this.game.state = 'paused';
    this.show('pause');
    audio.horn(audio.engineKind, false);
  }

  pauseAction(a) {
    if (a === 'resume') {
      for (const s of SCREENS) $(s).classList.remove('show');
      this.screen = 'race';
      this.game.state = this.prevState || 'race';
    } else if (a === 'restart') {
      for (const s of SCREENS) $(s).classList.remove('show');
      this.screen = 'race';
      this.game.startRun(this.game.mode);
    } else if (a === 'settings') {
      this.returnTo = 'pause';
      this.show('settings');
    } else if (a === 'quit') {
      this.toTitle();
    }
  }

  toTitle() {
    this.game.hud.show(false);
    this.game.state = 'title';
    this.game.resetWorld('dhanmondi');
    this.show('title');
    $('mainMenu').hidden = true;
    $('pressStart').style.display = '';
    this.updateEndingsLabel();
  }

  // ------------------------------------------------------------ endings
  showEnding(id) {
    const E = ENDINGS[id];
    const g = this.game;
    this.endings.add(id);
    store.set('endings', [...this.endings]);
    this.updateEndingsLabel();
    $('pcBn').textContent = E.headline;
    $('pcTitle').textContent = E.title.toUpperCase();
    $('pcStamp').textContent = String(this.endings.size);
    $('pcLines').innerHTML = E.lines.map((l) => `<p>${l}</p>`).join('');
    const total = Math.floor(g.score + g.goalBonus);
    this.finalScore = total;
    $('pcTally').innerHTML = `
      <span>FINISHED</span><span>${g.racing ? 'P1 · WINNER' : 'FREE DRIVE'}</span>
      <span>DISTANCE SCORE</span><span>${bn(Math.floor(g.score).toLocaleString('en-US'))}</span>
      <span>TIME BONUS</span><span>${bn((g.goalBonus || 0).toLocaleString('en-US'))}</span>
      <span>NEAR MISSES</span><span>${bn(g.nearMisses)}</span>
      <span>TAKEDOWNS</span><span>${bn(g.takedowns || 0)}</span>
      <span>STALLS FLATTENED</span><span>${bn(g.smashed || 0)}</span>
      <span>PEOPLE BOUNCED</span><span>${bn(g.bounced || 0)}</span>
      <span>TOTAL TIME</span><span>${fmtTime(g.totalTime)}</span>
      <span class="tot">TOTAL</span><span class="tot">${bn(total.toLocaleString('en-US'))}</span>`;
    g.hud.drawMap($('pcMap'), g.path, false, { big: true, labels: true });
    this.show('ending');
    this.endingReady = false;
    const ps = [...$('pcLines').children];
    ps.forEach((p, i) => setTimeout(() => p.classList.add('in'), 700 + i * 1300));
    setTimeout(() => { this.endingReady = true; }, 1500);
    if (this.endings.size === 1) {
      $('pcHint').textContent = 'ENTER continue · RICKSHAW 9000 unlocked in the garage';
    } else $('pcHint').textContent = 'ENTER continue';
  }

  showGameOver() {
    const g = this.game;
    const total = Math.floor(g.score);
    this.finalScore = total;
    const E = g.eliminated;
    $('overBn').textContent = E ? 'ELIMINATED' : 'TIME UP';
    $('overEn').textContent = E ? (E.need === 1 ? `FINISHED P${E.pos}` : `P${E.pos} · NEEDED P${E.need}`) : 'GAME OVER';
    $('overSub').textContent = E ? (E.need === 1 ? 'Second place pays nothing. Golden Bhai does not do silver.' : 'The field rolled on without you.') : 'Stuck in traffic. Again tomorrow.';
    $('overHint').textContent = E ? 'ENTER retry stage · BACKSPACE give up' : 'ENTER continue';
    $('overTally').innerHTML = `<span>SCORE</span><span>${bn(total.toLocaleString('en-US'))}</span><span>REACHED</span><span>${STAGES[g.path[g.path.length - 1]].name.toUpperCase()}</span>`;
    this.show('gameover');
    this.overReady = false;
    setTimeout(() => (this.overReady = true), 1200);
  }

  afterResults() {
    audio.confirm();
    if (this.game.mode === 'arcade' && this.qualifies(this.finalScore)) {
      this.letters = ['A', 'A', 'A'];
      this.nameSel = 0;
      $('nameScore').textContent = bn(this.finalScore.toLocaleString('en-US'));
      this.show('nameentry');
      this.game.state = this.game.state === 'gameover' ? 'gameover' : 'goal';
    } else {
      this.toTitle();
    }
  }

  qualifies(score) {
    if (score <= 0) return false;
    return this.scores.length < 10 || score > this.scores[this.scores.length - 1].score;
  }

  saveScore() {
    const g = this.game;
    this.scores.push({ name: this.letters.join(''), score: this.finalScore, route: g.path[g.path.length - 1], car: CARS[g.carIndex].name });
    this.scores.sort((a, b) => b.score - a.score);
    this.scores = this.scores.slice(0, 10);
    store.set('scores', this.scores);
    audio.goal();
    this.toTitle();
  }

  // ------------------------------------------------------------ settings
  settingRows() {
    const S = this.settings;
    return [
      ['QUALITY', 'quality', ['low', 'medium', 'high']],
      ['DIFFICULTY', 'difficulty', ['easy', 'normal', 'hard']],
      ['GEARBOX', 'manual', [false, true], (v) => (v ? 'MANUAL LO/HI' : 'AUTOMATIC')],
      ['MUSIC VOLUME', 'musicVol', [0, 0.2, 0.4, 0.6, 0.8, 1], (v) => Math.round(v * 100) + '%'],
      ['SFX VOLUME', 'sfxVol', [0, 0.2, 0.4, 0.6, 0.8, 1], (v) => Math.round(v * 100) + '%'],
      ['CAMERA', 'camera', ['chase', 'far', 'hood', 'low']],
      ['SPEED BLUR', 'blur', [true, false], (v) => (v ? 'ON' : 'OFF')],
      ['SLOW MOTION', 'slowmo', [true, false], (v) => (v ? 'BOLLYWOOD' : 'OFF')],
      ['CRT SCANLINES', 'crt', [false, true], (v) => (v ? 'ON' : 'OFF')],
      ['TOUCH CONTROLS', 'touch', ['auto', 'on', 'off']],
    ];
  }

  changeSetting(dir) {
    const rows = this.settingRows();
    const [, key, opts] = rows[this.sel];
    const i = Math.max(0, opts.indexOf(this.settings[key]));
    this.settings[key] = opts[(i + dir + opts.length) % opts.length];
    audio.blip(1100);
    this.onSettingsChanged?.(key);
    this.refresh();
  }

  // ------------------------------------------------------------ rendering of screens
  refresh() {
    const s = this.screen;
    if (s === 'title') {
      [...$('mainMenu').children].forEach((b, i) => b.classList.toggle('sel', i === this.sel));
    } else if (s === 'pause') {
      [...$('pauseMenu').children].forEach((b, i) => b.classList.toggle('sel', i === this.sel));
    } else if (s === 'garage') {
      const def = CARS[this.game.carIndex];
      const locked = def.locked && !this.endings.size;
      $('carName').innerHTML = def.name + (locked ? '<span class="lock">LOCKED</span>' : '');
      $('carBn').textContent = def.tag || '';
      $('carBlurb').textContent = def.blurb;
      const stat = (label, v) => `<span>${label}</span><div class="bar"><b style="width:${Math.round(v * 100)}%"></b></div>`;
      $('carStats').innerHTML = stat('TOP SPEED', def.top / 430) + stat('ACCEL', def.accel / 1.2) + stat('GRIP', def.grip) + `<span>KM/H</span><span>${bn(def.top)}</span>`;
      $('carColors').innerHTML = def.colors.map((c, i) => `<b data-i="${i}" style="background:${c}" class="${i === this.game.colorIndex ? 'sel' : ''}"></b>`).join('');
    } else if (s === 'radio') {
      const rows = TRACKS.map((t, i) => `<li data-i="${i}" class="${i === this.sel ? 'sel' : ''}"><b>${t.freq}</b><span>${t.station}<small>“${t.title}” · raag ${t.raga}</small></span><em>${t.bpm} bpm</em></li>`);
      rows.push(`<li data-i="${TRACKS.length}" class="${this.sel === TRACKS.length ? 'sel' : ''}"><b>--.-</b><span>RADIO OFF<small>just engines and horns</small></span><em></em></li>`);
      $('stationList').innerHTML = rows.join('');
      const f = this.sel < TRACKS.length ? parseFloat(TRACKS[this.sel].freq) : 107;
      $('needle').style.left = `${8 + ((f - 88) / 20) * 84}%`;
    } else if (s === 'settings') {
      $('setList').innerHTML = this.settingRows().map(([label, key, opts, fmt], i) => {
        const v = this.settings[key];
        const txt = fmt ? fmt(v) : String(v).toUpperCase();
        return `<div class="set-row ${i === this.sel ? 'sel' : ''}" data-i="${i}"><span>${label}</span><b>◀ ${txt} ▶</b></div>`;
      }).join('');
    } else if (s === 'scores') {
      $('scoreList').innerHTML = this.scores.length
        ? this.scores.map((r) => `<li><span>${r.name}</span><span>${bn(r.score.toLocaleString('en-US'))}</span><em>${STAGES[r.route]?.short || ''} · ${r.car}</em></li>`).join('')
        : '<li><span>---</span><span>no scores yet</span><em>race to set one</em></li>';
      const ids = ['padma', 'highway', 'purbachal', 'airport', 'savar'];
      $('endingsGrid').innerHTML = ids.map((id) => `<div class="${this.endings.has(id) ? 'got' : ''}"><i>${this.endings.has(id) ? ENDINGS[id].headline : '?'}</i>${this.endings.has(id) ? STAGES[id].name : 'UNKNOWN'}</div>`).join('');
    } else if (s === 'nameentry') {
      [...$('letters').children].forEach((b, i) => { b.textContent = this.letters[i]; b.classList.toggle('sel', i === this.nameSel); });
    }
  }
}
