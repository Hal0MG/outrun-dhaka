// Tuntuni, your passenger. Short, dry reactions.

export const LINES = {
  // the race
  start: ['Last place. Start overtaking.'],
  posGain: ['One down.','Good.'],
  posLose: ['He passed us!'],
  lead: ['First place.'],
  eliminated: ['That’s it. We’re out.', 'Out of the Run. I am walking home.'],
  busrace: ['Those two buses are racing. Do NOT get between them.'],
  vip: ['VIP motorcade behind us! Move or become a footnote.'],
  racers: ['Those boys want to race. Don’t you dare let them win.'],
  plane: ['That plane is RIGHT above us! DUCK!'],

  // new: enemies & chaos
  tesla: ['E-rickshaws ahead.'],
  police: ['Police behind us.'],
  rab: ['RAB behind us.'],
  racersNew: ['More racers.'],
  takedown: ['Got him.','Nice.'],
  wrecked: ['We’re fine! We’re fine. Is the car fine?'],
  ped: ['Sorry!','Pedestrian!'],
  smash: ['That was a shop.'],
  jamRamp: ['Jam ahead. Ramp on the right.'],
  contra: ['Oncoming traffic!'],
  bigair: ['Whoa!'],
  nitro: ['Nitro!'],
  // set pieces
  metroClosed: ['Road’s closed. Take the stairs.'],
  metroStairs: ['Stairs!'],
  metroGates: ['Through the gates.'],
  metroTracks: ['We’re on the tracks.'],
  metroTrain: ['TRAIN! TRAIN! OTHER TRACK! NOW!'],
  storeJump: ['The track ends! No no no no-'],
  cinemaOut: ['Through the screen!'],
  coaster: ['ROLLER COASTER! We do not fit in the seat!'],
  // bosses

  // reactions
  crash: ['Careful!','Are you okay?'],
  nearmiss: ['Close one.','Phew.'],
  scrape: ['Stop rubbing the divider!'],
  hit: ['Sorry! Sorry!', 'There goes the bumper...'],
  checkpoint: ['Checkpoint.'],
  lowtime: ['Time’s running out! Floor it!'],
  jam: ['Jam ahead.'],
  rain: ['Rain. Watch the road.'],
  fast: ['Are we doing THREE HUNDRED?!'],
  honk: ['Stop honking!'],
  goal: ['We did it.'],
};

export class Dialogue {
  constructor(hud) {
    this.hud = hud;
    this.cool = 0;
    this.used = {};
  }

  say(id, force = false) {
    if (this.quiet) return;
    const set = LINES[id];
    if (!set) return;
    if (!force && this.cool > 0) return;
    const n = (this.used[id] || 0);
    this.used[id] = n + 1;
    const line = set[n % set.length];
    const loud = id === 'crash' || id === 'stadium' || id === 'metroTrain' || id === 'storeJump' || id === 'bigair' || id === 'takedown';
    this.hud.speak(line, loud ? 'loud' : '');
    this.cool = force ? 2.5 : 4.5;
  }

  reset() { this.used = {}; this.cool = 0; }

  update(dt) {
    this.cool = Math.max(0, this.cool - dt);
  }
}
