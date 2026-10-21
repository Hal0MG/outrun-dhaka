// Tuntuni, the passenger. Short generic reactions, shown as a speech bubble
// coming off the car. Rate-limited so she comments on the race, not every frame.

import { fx } from '../core/util.js';

export const LINES = {
  start: ['Last place. Time to overtake.', 'Everyone is ahead of us. Good.', 'Go go go!'],
  pass: ['One down!', 'Passed him!', 'Nice move.', 'Eat my dust!'],
  passed: ['He passed us!', 'Hey! Not fair.', 'Get him back!'],
  lead: ['We’re in front!', 'First place!', 'Don’t blow it now.'],
  nitro: ['Nitro!', 'Hold on tight!', 'Flooring it!'],
  nitroOut: ['No nitro left.', 'Out of nitro!', 'Nitro’s empty.'],
  nitroPick: ['More nitro!', 'Got a charge.'],
  fuel: ['Fuel, thank goodness.', 'Tank topped up.'],
  fuelLow: ['We’re running low on fuel.', 'Watch the fuel gauge!', 'Find a fuel can, quick.'],
  hitRival: ['Careful!', 'Sorry! Sorry!', 'Watch the paint!', 'Hey, we’re racing, not wrestling.'],
  hitTraffic: ['Sorry, uncle!', 'Whoa, he flew!', 'Oops.', 'That was a bus!'],
  ped: ['Sorry!', 'They’re fine, they’re fine.', 'Pedestrian!'],
  smash: ['That was someone’s shop.', 'Free fruit!', 'Whoops, the stall.'],
  scrape: ['Stop rubbing the rail!', 'Mind the paint!'],
  lap: ['Next lap!', 'Another lap done.'],
  finalLap: ['Last lap!', 'Final lap, give it everything!'],
  knockout: ['We’re through!', 'Still in the race!', 'Safe. For now.'],
  win: ['We won!', 'First! I can’t believe it.'],
  finish: ['We made it.', 'Not bad at all.'],
  out: ['Oh no. We’re out.', 'That’s it, we’re done.'],

  // advice: things that help win. Said rarely, with long gaps between repeats
  tipPickups: ['Fuel cans and nitro cover the whole road. Just drive through them.', 'Coins, fuel and nitro are in the lanes. Pick them up as you go.'],
  tipNitro: ['Nitro’s ready. Burn it on the straight!', 'You’ve got nitro. Use it to pass!', 'Straight ahead: perfect time for nitro.'],
  tipBend: ['Sharp bend coming. Ease off!', 'Bend ahead, don’t run wide!', 'Lift before the bend.'],
  tipFuel: ['Fuel’s getting low. There’ll be cans ahead.', 'Grab the next fuel can!'],
  tipGrass: ['The verge slows us down. Back on the road!', 'Off the tarmac, we’re losing speed!'],
  tipOvertake: ['Pull out and go round him.', 'Pick a clear lane and pass.', 'Don’t sit behind him. Go around!'],
  tipLastLap: ['Last lap. Spend all your nitro now!', 'Final lap: nothing to save it for.'],
  tipDraft: ['Stay on the racing line. Hug the inside of the bends.', 'Take the inside of the bend, it’s shorter.'],
};

export class Dialogue {
  constructor(hud) {
    this.hud = hud;
    this.reset();
  }

  reset() { this.cool = 0; this.last = {}; this.t = 0; }

  // id: a key of LINES; chance: how often she bothers; force skips the rate limits
  // gap: the least time in seconds before she says this kind of thing again
  say(id, chance = 1, force = false, gap = 7) {
    const set = LINES[id];
    if (!set) return;
    if (!force) {
      if (this.cool > 0 || this.t - (this.last[id] ?? -99) < gap || fx.next() > chance) return;
    }
    this.last[id] = this.t;
    this.cool = 2.6;
    this.hud.speak(fx.pick(set));
  }

  // a line made for the moment (the knockout cut-off, say)
  sayText(key, text, gap = 25) {
    if (this.cool > 0 || this.t - (this.last[key] ?? -99) < gap) return;
    this.last[key] = this.t;
    this.cool = 2.6;
    this.hud.speak(text);
  }

  update(dt) {
    this.t += dt;
    this.cool = Math.max(0, this.cool - dt);
  }
}
