// Keyboard + gamepad + touch, merged into one control state. Edge-triggered
// actions are read with `pressed(name)` once per frame.

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'boost', KeyB: 'boost', KeyN: 'boost', ShiftLeft: 'fire', ShiftRight: 'fire', KeyZ: 'fire',
  KeyH: 'horn', KeyX: 'horn',
  KeyR: 'radio',
  KeyM: 'mute',
  Escape: 'pause', KeyP: 'pause',
  Enter: 'confirm', NumpadEnter: 'confirm',
  Backspace: 'back',
  KeyF: 'fullscreen',
  KeyL: 'lights',
  KeyT: 'talk',
  KeyV: 'photo',
};

export class Input {
  constructor() {
    this.down = new Set();
    this.edges = new Set();
    this.steer = 0;
    this.throttle = 0;
    this.brake = 0;
    this.horn = false;
    this.lastDevice = 'keyboard';
    this.touch = { left: false, right: false, gas: false, brake: false, horn: false, boost: false };
    this.boostHeld = false;
    this.gpPrev = {};
    window.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Backspace'].includes(e.code)) e.preventDefault();
      if (!this.down.has(a)) this.edges.add(a);
      this.down.add(a);
      this.lastDevice = 'keyboard';
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.down.delete(a);
    });
    window.addEventListener('blur', () => this.down.clear());
  }

  pressed(name) {
    return this.edges.has(name);
  }

  held(name) {
    return this.down.has(name);
  }

  // inject a menu/touch action
  tap(name) {
    this.edges.add(name);
  }

  poll(dt) {
    // gamepad
    let gx = 0, gThrottle = 0, gBrake = 0, gHorn = false, gBoost = false;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const ax = gp.axes[0] || 0;
      if (Math.abs(ax) > 0.12) { gx = ax; this.lastDevice = 'gamepad'; }
      const b = (i) => gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5);
      const v = (i) => (gp.buttons[i] ? gp.buttons[i].value : 0);
      gThrottle = Math.max(gThrottle, v(7), b(0) ? 1 : 0);
      gBrake = Math.max(gBrake, v(6));
      if (b(1)) gBoost = true;
      if (b(14)) gx = -1;
      if (b(15)) gx = 1;
      const map = { 2: 'fire', 3: 'camera', 9: 'pause', 4: 'radio', 5: 'horn', 0: 'confirm', 1: 'back', 8: 'photo', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
      for (const k in map) {
        const now = b(+k);
        const key = gp.index + ':' + k;
        if (now && !this.gpPrev[key]) this.edges.add(map[k]);
        this.gpPrev[key] = now;
        if (map[k] === 'horn' && now) gHorn = true;
      }
      if (gThrottle > 0.1 || gBrake > 0.1) this.lastDevice = 'gamepad';
    }
    // keyboard steering ramps like a real wheel
    const kl = this.down.has('left') || this.touch.left, kr = this.down.has('right') || this.touch.right;
    const target = (kr ? 1 : 0) - (kl ? 1 : 0);
    if (gx !== 0) {
      this.steer = gx;
    } else {
      const rate = target === 0 ? 7 : (Math.sign(target) !== Math.sign(this.steer) ? 9 : 4.2);
      const d = target - this.steer;
      this.steer += Math.sign(d) * Math.min(Math.abs(d), rate * dt);
    }
    this.throttle = Math.max(this.down.has('up') || this.touch.gas ? 1 : 0, gThrottle);
    this.brake = Math.max(this.down.has('down') || this.touch.brake ? 1 : 0, gBrake);
    this.horn = this.down.has('horn') || this.touch.horn || gHorn;
    this.boostHeld = this.down.has('boost') || this.touch.boost || gBoost;
  }

  endFrame() {
    this.edges.clear();
  }
}
