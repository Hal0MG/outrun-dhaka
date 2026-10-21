// Tuntuni: your passenger, named after the clever tailorbird of Bengali
// folk tales. Dry, quick, and she only talks when it's worth it.

export const LINES = {
  // the race
  start: ['Twenty-three cars ahead. Start counting down.'],
  lead: ['We’re leading. Don’t get comfortable.', 'Front of the pack. Raja’s in the mirror.'],
  eliminated: ['That’s the end of that.', 'We’re out. Golden Bhai won’t be happy.'],
  goal: ['We actually did it.'],
  raja: ['Black Skyline. That’s Raja.'],

  // arriving in each district (one line each)
  shahbag: ['Shahbag. Mind the art on the road.'],
  manikmia: ['Manik Mia Avenue. Wide, straight, fast.'],
  farmgate: ['Farmgate. Somehow, no jam.'],
  hatirjheel: ['Hatirjheel. Lights on the water.'],
  gulshan: ['Gulshan. Expensive cars, cheap manners.'],
  oldDhaka: ['Old Dhaka. Narrow, loud, two hundred years old.'],
  sadarghat: ['Sadarghat. Launch horns all night.'],
  motijheel: ['Motijheel in the rain. Careful.'],
  mirpur: ['Mirpur. Stadium’s on the left.'],
  uttara: ['Airport Road. Planes overhead.'],
  kuril: ['300 Feet. Room to breathe.'],
  highway: ['Highway. Trucks only get bigger from here.'],
  gabtoli: ['Savar. Nearly out of the city.'],
  padma: ['The Padma Bridge. Last stretch.'],

  // set pieces
  metroClosed: ['Road’s closed. Take the station.'],
  metroTracks: ['We’re on the metro line. Watch for trains.'],
  metroTrain: ['TRAIN!'],
  storeJump: ['Through the window. Of course.'],
  mall: ['We’re driving into a mall.'],
  cinemaOut: ['Through the screen!'],
  jfp: ['Future Park. Roller coaster ahead.'],
  jamRamp: ['Jam ahead. Ramp on the right.'],
  heliIntro: ['Is that a helicopter throwing luggage at us?'],
  heliWin: ['She’s gone. Keep going.'],
  busIntro: ['Two buses, both drunk. Stay out of the middle.'],
  busWin: ['Buses down.'],
};

// ids that are allowed to interrupt the minimum gap (rare, important moments)
const URGENT = new Set(['metroTrain', 'eliminated', 'goal', 'lead']);

export class Dialogue {
  constructor(hud) {
    this.hud = hud;
    this.cool = 0;
    this.used = {};
  }

  say(id, force = false) {
    const set = LINES[id];
    if (!set) return;
    // never chatter: at least ten seconds between lines unless it's urgent
    if (this.cool > 0 && !(force && URGENT.has(id))) return;
    const n = this.used[id] || 0;
    // each district line is said once per run; others rotate
    if (n >= set.length && set.length === 1 && !URGENT.has(id)) return;
    this.used[id] = n + 1;
    const line = set[n % set.length];
    const loud = id === 'metroTrain' || id === 'storeJump' || id === 'cinemaOut';
    this.hud.speak(line, loud ? 'loud' : '');
    this.cool = 10;
  }

  reset() { this.used = {}; this.cool = 0; }

  update(dt) {
    this.cool = Math.max(0, this.cool - dt);
  }
}
