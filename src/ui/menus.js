// Screen flow: title -> map (pick a district circuit or the Run) -> race ->
// results -> map. The garage and settings hang off the title.

import { CARS } from '../game/cars.js';
import { audio } from '../audio/audio.js';
import { STAGES, ROUTE, CIRCUIT_LAPS, RUN_FIELD, KNOCKOUTS } from '../world/stages.js';
import { CIRCUIT_FIELD } from '../game/race.js';
import { drawDhaka, stepOnMap, hitOnMap } from './dhakamap.js';
import { bn, store, fmtTime } from '../core/util.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['loading', 'title', 'map', 'garage', 'settings', 'howto', 'pause', 'results'];
const ord = (n) => n + (n % 10 === 1 && n !== 11 ? 'ST' : n % 10 === 2 && n !== 12 ? 'ND' : n % 10 === 3 && n !== 13 ? 'RD' : 'TH');

export class Menus {
  constructor(game, input, settings, saveSettings) {
    this.game = game;
    this.input = input;
    this.settings = settings;
    this.save = saveSettings;
    this.screen = 'loading';
    this.sel = 0;
    this.returnTo = 'title';
    this.mapSel = store.get('mapSel', 'dhanmondi');
    if (this.mapSel !== 'run' && !STAGES[this.mapSel]) this.mapSel = 'dhanmondi';
    this.best = store.get('best', {});
    this.bindMouse();
  }

  show(name) {
    for (const s of SCREENS) $(s).classList.toggle('show', s === name);
    this.screen = name;
    this.sel = 0;
    this.refresh();
  }

  hideAll() {
    for (const s of SCREENS) $(s).classList.remove('show');
    this.screen = 'race';
  }

  bindMouse() {
    const click = (id, fn) => $(id).addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b) { audio.init(); fn(b.dataset.act, b); }
    });
    click('mainMenu', (a) => this.mainAction(a));
    $('hPause').addEventListener('click', () => this.pause());
    click('pauseMenu', (a) => this.pauseAction(a));
    click('garage', (a) => this.garageAction(a));
    click('map', (a) => { if (a === 'go') this.startRace(); });
    $('title').addEventListener('click', () => {
      audio.init();
      if ($('mainMenu').hidden) this.openMenu();
    });
    $('mapCv').addEventListener('click', (e) => {
      const cv = $('mapCv');
      const r = cv.getBoundingClientRect();
      const hit = hitOnMap(cv, ((e.clientX - r.left) / r.width) * cv.width, ((e.clientY - r.top) / r.height) * cv.height);
      if (!hit) return;
      audio.init();
      if (hit === this.mapSel) this.startRace();
      else { this.mapSel = hit; audio.blip(); this.refresh(); }
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
    $('results').addEventListener('click', () => this.input.tap('confirm'));
  }

  openMenu() {
    $('mainMenu').hidden = false;
    $('pressStart').style.display = 'none';
    this.sel = 0;
    this.refresh();
    audio.confirm();
  }

  toTitle() {
    this.game.toTitle();
    this.show('title');
    $('mainMenu').hidden = false;
    $('pressStart').style.display = 'none';
  }

  toMap() {
    if (this.game.kind) this.game.toTitle();
    this.game.state = 'map';
    this.show('map');
  }

  // ------------------------------------------------------------ per-frame input
  update() {
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
    } else if (s === 'map') {
      const dir = left ? [-1, 0] : right ? [1, 0] : up ? [0, -1] : down ? [0, 1] : null;
      if (dir) {
        const next = stepOnMap(this.mapSel, dir[0], dir[1]);
        if (next !== this.mapSel) { this.mapSel = next; audio.blip(); this.refresh(); }
      }
      if (ok) this.startRace();
      if (back) { audio.back(); this.toTitle(); }
    } else if (s === 'garage') {
      if (left) this.garageAction('prevCar');
      if (right) this.garageAction('nextCar');
      const nc = CARS[this.game.carIndex].colors.length;
      if (up || down) { this.game.colorIndex = (this.game.colorIndex + (up ? nc - 1 : 1)) % nc; this.game.buildCar(); audio.blip(); this.refresh(); }
      if (ok) this.garageAction('pickCar');
      if (back) { audio.back(); this.show('title'); this.game.state = 'title'; }
    } else if (s === 'settings') {
      const rows = this.settingRows();
      if (up) { this.sel = (this.sel + rows.length - 1) % rows.length; audio.blip(); this.refresh(); }
      if (down) { this.sel = (this.sel + 1) % rows.length; audio.blip(); this.refresh(); }
      if (left) this.changeSetting(-1);
      if (right || ok) this.changeSetting(1);
      if (back) { audio.back(); this.save(); this.show(this.returnTo); this.game.state = this.returnTo === 'title' ? 'title' : 'paused'; }
    } else if (s === 'howto') {
      if (back || ok) { audio.back(); this.show('title'); this.game.state = 'title'; $('mainMenu').hidden = false; $('pressStart').style.display = 'none'; }
    } else if (s === 'pause') {
      const n = $('pauseMenu').children.length;
      if (up) { this.sel = (this.sel + n - 1) % n; audio.blip(); this.refresh(); }
      if (down) { this.sel = (this.sel + 1) % n; audio.blip(); this.refresh(); }
      if (ok) this.pauseAction($('pauseMenu').children[this.sel].dataset.act);
      if (I.pressed('pause') || I.pressed('back')) this.pauseAction('resume');
    } else if (s === 'results') {
      if (ok && this.resultsReady) { audio.confirm(); this.startRace(); }
      if (back && this.resultsReady) { audio.back(); this.toMap(); }
    }
  }

  // ------------------------------------------------------------ actions
  mainAction(a) {
    audio.confirm();
    if (a === 'race') { this.game.state = 'map'; this.show('map'); }
    else if (a === 'garage') { this.show('garage'); this.game.state = 'garage'; }
    else if (a === 'settings') { this.returnTo = 'title'; this.show('settings'); this.game.state = 'settings'; }
    else if (a === 'howto') { this.show('howto'); this.game.state = 'howto'; }
  }

  // the car is unlocked by winning any race
  locked(def) { return def.locked && !store.get('wins', 0); }

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
      if (this.locked(def)) { audio.back(); return; }
      audio.confirm();
      this.settings.car = g.carIndex;
      this.settings.color = g.colorIndex;
      this.save();
      this.game.state = 'map';
      this.show('map');
    }
  }

  // race whatever is picked on the map, in the garage car
  startRace() {
    audio.confirm();
    store.set('mapSel', this.mapSel);
    const g = this.game;
    // a locked car on the drive (browsing the garage) falls back to the first one
    if (this.locked(CARS[g.carIndex])) { g.carIndex = this.settings.car ?? 0; g.colorIndex = this.settings.color ?? 0; g.buildCar(); }
    this.hideAll();
    if (this.mapSel === 'run') g.startRace('run');
    else g.startRace('circuit', this.mapSel);
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
      this.hideAll();
      this.game.state = this.prevState || 'race';
    } else if (a === 'restart') {
      this.startRace();
    } else if (a === 'settings') {
      this.returnTo = 'pause';
      this.show('settings');
    } else if (a === 'quit') {
      this.toMap();
    }
  }

  // ------------------------------------------------------------ results
  showResults(res) {
    const key = res.kind === 'run' ? 'run' : this.game.district;
    const where = res.reached?.name?.toUpperCase() || '';
    if (!res.out) {
      if (!this.best[key] || res.pos < this.best[key]) { this.best[key] = res.pos; store.set('best', this.best); }
      if (res.pos === 1) store.set('wins', store.get('wins', 0) + 1);
    }
    $('overBn').textContent = res.out === 'fuel' ? 'OUT OF FUEL' : res.out === 'knockout' ? 'KNOCKED OUT' : res.pos === 1 ? 'WINNER' : 'FINISHED';
    if (res.out === 'knockout') $('overEn').textContent = `${ord(res.pos)} AT ${where} · NEEDED TOP ${res.cut}`;
    else if (res.out === 'fuel') $('overEn').textContent = `RAN DRY IN ${ord(res.pos)}${res.kind === 'run' ? ' · ' + where : ''}`;
    else $('overEn').textContent = `${ord(res.pos)} OF ${res.field}`;
    $('overSub').textContent = !res.out && res.pos <= 3 ? 'ON THE PODIUM' : '';
    const rows = [['RACE TIME', fmtTime(res.time)]];
    if (res.kind === 'circuit') {
      res.laps.forEach((t, i) => rows.push([`LAP ${i + 1}`, fmtTime(t)]));
      if (res.laps.length) rows.push(['BEST LAP', fmtTime(Math.min(...res.laps))]);
    } else {
      rows.push(['DISTRICTS', `${ROUTE.indexOf(res.reached?.id) + 1} / ${ROUTE.length}`]);
    }
    rows.push(['COINS', bn(res.coins)]);
    $('overTally').innerHTML = rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('');
    $('overHint').textContent = 'ENTER race again · BACKSPACE map';
    this.game.hud.show(false);
    this.game.hud.tags([]);
    this.show('results');
    this.resultsReady = false;
    setTimeout(() => (this.resultsReady = true), 900);
  }

  // ------------------------------------------------------------ settings
  settingRows() {
    return [
      ['QUALITY', 'quality', ['low', 'medium', 'high']],
      ['MUSIC VOLUME', 'musicVol', [0, 0.2, 0.4, 0.6, 0.8, 1], (v) => Math.round(v * 100) + '%'],
      ['SFX VOLUME', 'sfxVol', [0, 0.2, 0.4, 0.6, 0.8, 1], (v) => Math.round(v * 100) + '%'],
      ['SCANLINES', 'crt', [false, true], (v) => (v ? 'ON' : 'OFF')],
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
    } else if (s === 'map') {
      this.refreshMap();
    } else if (s === 'garage') {
      const def = CARS[this.game.carIndex];
      const locked = this.locked(def);
      $('carName').innerHTML = def.name + (locked ? '<span class="lock">WIN A RACE</span>' : '');
      $('carBn').textContent = '';
      $('carBlurb').textContent = '';
      const stat = (label, v) => `<span>${label}</span><div class="bar"><b style="width:${Math.round(v * 100)}%"></b></div>`;
      $('carStats').innerHTML = stat('TOP SPEED', def.top / 300) + stat('ACCEL', def.accel / 1.2) + stat('GRIP', def.grip) + `<span>KM/H</span><span>${bn(def.top)}</span>`;
      $('carColors').innerHTML = def.colors.map((c, i) => `<b data-i="${i}" style="background:${c}" class="${i === this.game.colorIndex ? 'sel' : ''}"></b>`).join('');
    } else if (s === 'settings') {
      $('setList').innerHTML = this.settingRows().map(([label, key, opts, fmt], i) => {
        const v = this.settings[key];
        const txt = fmt ? fmt(v) : String(v).toUpperCase();
        return `<div class="set-row ${i === this.sel ? 'sel' : ''}" data-i="${i}"><span>${label}</span><b>◀ ${txt} ▶</b></div>`;
      }).join('');
    }
  }

  refreshMap() {
    const id = this.mapSel;
    drawDhaka($('mapCv'), { sel: id, best: this.best, labels: true });
    const best = this.best[id];
    if (id === 'run') {
      const gates = ROUTE.filter((d) => KNOCKOUTS[d]).map((d) => `${STAGES[d].short} ${KNOCKOUTS[d]}`).join(' · ');
      $('mapKind').textContent = 'THE RUN';
      $('mapMeta').textContent = `${RUN_FIELD} CARS · ${ROUTE.length} DISTRICTS`;
      $('mapBn').textContent = 'ঢাকা রান';
      $('mapName').textContent = 'DHANMONDI TO THE PADMA';
      $('mapSub').textContent = `One road across the whole city, dusk to dawn. Knockout gates: ${gates}. The last four race over the Padma.`;
    } else {
      const st = STAGES[id];
      $('mapKind').textContent = 'CIRCUIT';
      $('mapMeta').textContent = `${CIRCUIT_FIELD} CARS · ${CIRCUIT_LAPS} LAPS`;
      $('mapBn').textContent = st.bn;
      $('mapName').textContent = st.name.toUpperCase();
      $('mapSub').textContent = st.sub;
    }
    $('mapBest').textContent = best ? `BEST · ${ord(best)}` : 'NOT RACED YET';
  }
}
