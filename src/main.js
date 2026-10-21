import { Renderer } from './core/renderer.js';
import { Input } from './core/input.js';
import { store } from './core/util.js';
import { HUD } from './ui/hud.js';
import { Dialogue } from './ui/dialogue.js';
import { Menus } from './ui/menus.js';
import { Game } from './game/game.js';
import { audio } from './audio/audio.js';
import { music, TRACKS } from './audio/music.js';

const DEFAULTS = {
  quality: 'high', qualityAuto: false, difficulty: 'normal', manual: false, musicVol: 0.6, sfxVol: 0.8,
  camera: 'chase', blur: true, crt: true, touch: 'auto', car: 0, color: 0, station: 0, slowmo: true,
};
// v2 presets: high resolution and the CRT filter on for everyone, once
const saved = store.get('settings', {});
if (saved.v !== 2) Object.assign(saved, { v: 2, quality: 'high', qualityAuto: false, crt: true });
const settings = { ...DEFAULTS, ...saved };
const saveSettings = () => store.set('settings', settings);

const loadMsg = document.getElementById('loadMsg');
const progress = (m) => { loadMsg.textContent = m; };
// a frame, or a short timeout when the tab is in the background and rAF is paused
const nextFrame = () => new Promise((r) => { let done = false; const go = () => { if (!done) { done = true; setTimeout(r, 0); } }; requestAnimationFrame(go); setTimeout(go, 120); });

async function loadFonts() {
  if (!document.fonts) return;
  const want = ['700 40px "Galada"', '700 40px "Hind Siliguri"', '600 20px "Hind Siliguri"', '400 40px "Bungee"', '400 40px "Bungee Shade"', '400 40px "Tiro Bangla"'];
  const t = new Promise((r) => setTimeout(r, 3500));
  try {
    await Promise.race([Promise.all(want.map((f) => document.fonts.load(f, 'ঢাকা Dhaka'))), t]);
  } catch (e) { /* offline: fall back to system Bengali fonts */ }
}

async function boot() {
  progress('');
  await loadFonts();
  await nextFrame();
  const canvas = document.getElementById('gl');
  let R;
  try {
    R = new Renderer(canvas, settings.quality);
  } catch (e) {
    progress('WebGL is not available in this browser. Try Chrome, Edge or Firefox with hardware acceleration on.');
    return;
  }
  const input = new Input();
  const hud = new HUD();
  const dialogue = new Dialogue(hud);
  const game = new Game(R, input, hud, dialogue, settings);
  let si = 0;
  await game.init(async () => { si++; });
  progress('');
  await nextFrame();
  const menus = new Menus(game, input, settings, saveSettings);
  window.__game = game;
  window.__menus = menus;
  window.__audio = audio;
  window.__music = music;
  // debug: jump to any stage (e.g. __goto('motijheel', 1200))
  window.__goto = (id, s = 100) => {
    game.resetWorld(id);
    game.player.s = s;
    game.player.v = 60;
    game.traffic.clear();
    for (let i = 0; i < 16; i++) game.world.stream(game.player.track, game.player.s, 4);
  };

  // debug: advance n frames manually (the browser pane throttles rAF when hidden)
  window.__step = (n = 1, dt = 1 / 60) => {
    for (let i = 0; i < n; i++) { game.update(dt); input.edges.clear(); }
    R.render(dt);
  };

  menus.onSettingsChanged = (key) => {
    if (key === 'quality') { settings.qualityAuto = false; R.setQuality(settings.quality); }
    if (key === 'musicVol' || key === 'sfxVol') { audio.vol.music = settings.musicVol; audio.vol.sfx = settings.sfxVol; audio.applyVolumes(); }
  };
  audio.vol.music = settings.musicVol;
  audio.vol.sfx = settings.sfxVol;

  game.onGoal = (id) => {
    setTimeout(() => {
      game.state = 'ending';
      game.hud.show(false);
      menus.showEnding(id);
      music.play(TRACKS.findIndex((t) => t.id === 'sarobar'));
    }, 4200);
  };
  game.onTimeUp = () => {
    setTimeout(() => { game.hud.show(false); menus.showGameOver(); }, 2600);
  };

  // touch controls
  const touchEl = document.getElementById('touch');
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  function applyTouch() {
    const on = isTouch;
    touchEl.hidden = !on;
    document.body.classList.toggle('touch', on);
  }
  applyTouch();
  for (const b of touchEl.querySelectorAll('button')) {
    const k = b.dataset.t;
    const set = (v) => {
      b.classList.toggle('on', v);
      if (k === 'pause') { if (v) menus.pause(); return; }
      if (k === 'fire') { if (v) input.tap('fire'); return; }
      input.touch[k] = v;
    };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.init(); b.setPointerCapture(e.pointerId); set(true); });
    b.addEventListener('pointerup', () => set(false));
    b.addEventListener('pointercancel', () => set(false));
    b.addEventListener('lostpointercapture', () => set(false));
  }

  // unlock audio on first gesture
  const unlock = () => { audio.init(); audio.applyVolumes(); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  game.state = 'title';
  menus.show('title');

  // automatic quality: watch the frame rate for a few seconds and step down if needed
  const perf = { t: 0, frames: 0, checks: 0 };
  function autoQuality(dt) {
    if (!settings.qualityAuto || perf.checks >= 3 || document.hidden) return;
    perf.t += dt; perf.frames++;
    if (perf.t < 4) return;
    const fps = perf.frames / perf.t;
    perf.t = 0; perf.frames = 0; perf.checks++;
    const order = ['low', 'medium', 'high'];
    const i = order.indexOf(settings.quality);
    if (fps < 38 && i > 0) { settings.quality = order[i - 1]; R.setQuality(settings.quality); saveSettings(); perf.checks = 0; }
  }

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const rawDt = Math.max(0, (now - last) / 1000);
    const dt = Math.min(0.05, rawDt) * (window.__timeScale || 1);
    last = now;
    autoQuality(Math.min(rawDt, 0.25));
    input.poll(dt);
    // global keys
    if (input.pressed('fullscreen')) {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
      else document.exitFullscreen?.();
    }
    if (input.pressed('mute')) { audio.muted = !audio.muted; audio.applyVolumes(); }
    // menus first; the race keys only act if we were racing before and after (so ESC can't pause and unpause in one frame)
    const wasRace = menus.screen === 'race';
    menus.update(dt);
    if (wasRace && menus.screen === 'race') {
      if (input.pressed('photo')) game.togglePhoto();
      if (input.pressed('pause') && game.state !== 'photo') menus.pause();
      else if (input.pressed('pause') && game.state === 'photo') game.togglePhoto();
      if (input.pressed('radio')) game.toggleMusic();
    }
    // sub-step long frames for stable physics; one step per frame normally
    const steps = Math.min(8, Math.max(1, Math.ceil(dt / (1 / 55))));
    try {
      for (let i = 0; i < steps; i++) {
        game.update(dt / steps);
        input.edges.clear();
      }
    } catch (e) {
      // keep the loop alive; report once per message
      if (!frame.seen) frame.seen = new Set();
      if (!frame.seen.has(e.message)) { frame.seen.add(e.message); console.error(e); }
    }
    try { R.render(dt); } catch (e) { if (!frame.rseen) { frame.rseen = true; console.error(e); } }
    input.endFrame();
  }
  requestAnimationFrame(frame);
}

// if anything throws at startup, say so on screen instead of hanging on the loading screen
function showFatal(msg) {
  let el = document.getElementById("fatal");
  if (!el) {
    el = document.createElement("pre");
    el.id = "fatal";
    el.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;max-height:40vh;overflow:auto;margin:0;padding:10px 12px;background:#300;color:#fdd;font:12px/1.4 monospace;z-index:99;white-space:pre-wrap;border:2px solid #f55";
    document.body.appendChild(el);
  }
  el.textContent = "ERROR: " + msg;
}
const trace = (e) => (e && e.stack ? e.stack.split(String.fromCharCode(10)).slice(0, 4).join(String.fromCharCode(10)) : String(e));
window.addEventListener("error", (e) => showFatal(e.message + (e.error ? String.fromCharCode(10) + trace(e.error) : "")));
window.addEventListener("unhandledrejection", (e) => showFatal(trace(e.reason)));
boot().catch((e) => showFatal(trace(e)));
