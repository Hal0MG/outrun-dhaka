// A district circuit, or The Run, raced with no renderer: the game's own track builder (World.makeTrack), driving
// model (Player) and race (Race: the rivals, contact, nitro rows, nitro for passes and the knockout gates), stepped by
// a driver that is not a person. For training and measuring AI drivers, and for trying trained ones as rivals. No
// traffic, pedestrians or stalls: in the game they cost a racer nothing, so they are left out.

import { World } from '../src/world/world.js';
import { ROUTE, KNOCKOUTS, RUN_FIELD, circuitStage } from '../src/world/stages.js';
import { contraAt } from '../src/world/contra.js';
import { Player, NITRO_MAX, SPEED_K } from '../src/game/player.js';
import { Race } from '../src/game/race.js';
import { RNG, clamp, mulberry32 } from '../src/core/util.js';
import { Brain } from './brain.mjs';
import { LearnedRivals, observe, CAR, LOOK, SEE_AHEAD, SEE_BEHIND, OBS_SIZE } from '../src/game/learned.js';

export { ROUTE as DISTRICTS, CAR, LOOK, SEE_AHEAD, SEE_BEHIND, OBS_SIZE };
export const DT = 1 / 60;
// rival car sizes, as src/game/carmodels.js fits them (the meshes themselves need a browser)
const SIZES = { skyline: [4.6, 1.8], supra: [4.5, 1.82], celica: [4.4, 1.78], chaser: [4.75, 1.77], miata: [3.95, 1.75], premio: [4.6, 1.76], prado: [4.8, 1.9] };
const MD = Object.fromEntries(Object.entries(SIZES).map(([k, [len, wid]]) => [k, { len, wid, hgt: 1.4 }]));


// building a track is the slow part (a few ms), and it is the same every time: keep them
const world = Object.create(World.prototype);
world.tracks = new Map();
const built = new Map();
function trackFor(district) {
  if (!built.has(district)) {
    if (!ROUTE.includes(district)) throw new Error(`unknown district ${district}; one of ${ROUTE.join(', ')}`);
    built.set(district, world.makeTrack(circuitStage(district).id, null, 0));
  }
  return built.get(district);
}

// The Run: every district's road laid end to end, each the child of the one before, as the game builds them while the
// player nears each fork (without the gantry sign, which needs a canvas). Built once; what a race leaves on the tracks
// (the gates passed, the nitro laid, the road taken) is cleared on every reset.
let chain = null;
function runChain() {
  if (!chain) {
    chain = [];
    for (const id of ROUTE) {
      const prev = chain[chain.length - 1] ?? null;
      const tr = world.makeTrack(id, prev, 0);
      if (prev) prev.children = [tr, tr];
      chain.push(tr);
    }
  }
  for (const tr of chain) { tr.koDone = false; tr.stocked = false; tr.chosen = null; }
  return chain;
}

// gold, silver and bronze times, as the game sets them (src/game/race.js)
export function parTimes(district) {
  const tr = trackFor(district);
  const nom = (tr.goalS - tr.gateS) / ((CAR.top / 3.6) * SPEED_K);
  return { gold: nom * 1.12, silver: nom * 1.19, bronze: nom * 1.28 };
}

export const ACT_SIZE = 3;

export class RaceEnv {
  // opts.mode: 'circuit' (a district, three laps; the default) or 'run' (The Run: 48 cars, all fifteen districts, the
  //   knockout gates; the player is out below the cut and the episode ends there). Learned rivals work there too.
  // opts.rivals: race the field (default) or alone
  // opts.repeat: physics frames per decision (4 = 15 decisions a second)
  // opts.randomStart: move the whole grid to a random point on the first lap, so training sees every corner early
  // opts.laps: race this many laps from the start (default: the whole race)
  // opts.openOpposite: let the driver use the opposite carriageway anywhere, as the game does. Off by default: in the
  //   game it pays wrong-way nitro, but the scripted rivals never use it, so a learned rival must not either, and
  //   on the empty road it would pay nitro all lap. Closed, it costs reward and pays no nitro, except through ROAD WORKS, where the game sends you across.
  // opts.learned and opts.brain: how many of the front-running rivals (the leader first) are driven by a trained
  //   network (brain: its brain.json from ml/export.py) instead of the scripted driver. Each is a real Player, held
  //   to the pace its scripted self would run so it is as beatable, and it has no nitro.
  // opts.detail: say how every rival is doing in info.rivals
  constructor(opts = {}) {
    this.mode = opts.mode ?? 'circuit';
    this.rivals = opts.rivals ?? true;
    this.openOpposite = !!opts.openOpposite;
    this.detail = !!opts.detail;
    this.repeat = opts.repeat ?? 4;
    this.randomStart = !!opts.randomStart;
    this.laps = opts.laps ?? null;
    this.maxTime = opts.maxTime ?? (this.mode === 'run' ? 900 : 400);
    this.rng = new RNG(opts.seed ?? 1);
    this.player = new Player(CAR);
    // the race only asks the game for these
    this.game = {
      player: this.player, world, state: 'race',
      fleet: { md: (m) => MD[m] },
      stalls: { stock() {} }, // roadside stalls go flying and cost nothing
      scene: { add() {} },
      onPass: (n) => { this.passed += n; },
    };
    this.race = new Race(this.game);
    if (!this.openOpposite) {
      const pay = this.race.wrongWayReward;
      this.race.wrongWayReward = (dt) => { if (contraAt(this.player.track, this.player.s)) pay.call(this.race, dt); };
    }
    this.brain = opts.brain ? Brain.load(opts.brain) : null;
    this.ai = this.brain ? new LearnedRivals(this.race, this.brain, { count: opts.learned ?? 0, pace: opts.learnedPace }).attach() : null;
  }

  reset(opts = {}) {
    if (opts.seed != null) this.rng = new RNG(opts.seed);
    // the rivals' mistakes come from Math.random: seed it too, so a race replays exactly
    Math.random = mulberry32((this.rng.next() * 2 ** 32) >>> 0);
    const run = this.mode === 'run';
    this.district = run ? 'run' : opts.district ?? this.rng.pick(ROUTE);
    const tr = (this.track = run ? runChain()[0] : trackFor(this.district));
    const P = this.player, R = this.race;
    P.reset(tr);
    R.start(run ? 'run' : 'circuit');
    if (!this.rivals) R.rivals = [];
    if (this.randomStart && !run) {
      // the grid as it is, further round the lap
      const d = this.rng.range(0, tr.lapLen);
      P.s += d;
      for (const r of R.rivals) r.G += d;
      P.nitro = this.rng.int(0, NITRO_MAX);
    }
    this.startS = P.s;
    this.goalS = this.laps && !run ? Math.min(tr.goalS, P.s + this.laps * tr.lapLen) : tr.goalS;
    // where it all ends, as distance along the route (a circuit is one track, so this is its own s)
    const last = run ? chain[chain.length - 1] : tr;
    this.goalG = last.base + (this.laps && !run ? this.goalS : last.goalS);
    this.startG = tr.base + P.s;
    this.endG = last.base + last.goalS;
    this.fieldStart = R.field;
    this.gates = [];
    this.time = 0;
    this.lapTimes = [];
    this.lapsDone = run ? 0 : Math.max(0, Math.floor((P.s - tr.gateS) / tr.lapLen));
    this.lapStart = 0;
    this.offroadTime = 0;
    this.scrapeTime = 0;
    this.nitroUsed = 0;
    this.passed = 0;
    this.hits = 0;
    this.wrongTime = 0;
    this.conedTime = 0;
    this.stillTime = 0;
    for (const r of R.rivals) r.finishT = null;
    R.standings();
    this.lastPos = R.position;
    return { obs: this.observe(), info: this.info() };
  }

  // action: [steer -1..1, pedal -1..1 (positive is throttle, negative is brake), nitro (> 0 fires a charge)]
  step(action) {
    const P = this.player, R = this.race;
    const steer = clamp(+action[0] || 0, -1, 1);
    const pedal = clamp(+action[1] || 0, -1, 1);
    const input = { steer, throttle: Math.max(0, pedal), brake: Math.max(0, -pedal), boostHeld: (+action[2] || 0) > 0 };
    const G0 = P.track.base + P.s;
    let off = 0, scrape = 0, wrong = 0, coned = 0;
    for (let i = 0; i < this.repeat; i++) {
      P.update(DT, input, world);
      if (this.mode === 'run') this.fork();
      R.update(DT);
      if (this.mode === 'run') this.logGate();
      for (const e of P.events) { if (e.type === 'hit') this.hits++; else if (e.type === 'nitro') this.nitroUsed++; }
      P.events.length = 0;
      this.time += DT;
      for (const r of R.rivals) if (r.done && r.finishT == null) r.finishT = this.time;
      off += P.offroad;
      scrape += P.scrape;
      if (P.wrongWay && !this.openOpposite && !contraAt(P.track, P.s)) wrong++;
      if (P.inWorks) coned++;
      const tr = this.track;
      if (this.mode === 'circuit' && P.s >= tr.gateS + (this.lapsDone + 1) * tr.lapLen && this.lapsDone < tr.laps) {
        this.lapsDone++;
        this.lapTimes.push(this.time - this.lapStart);
        this.lapStart = this.time;
      }
      if (R.finished || P.track.base + P.s >= this.goalG) break;
    }
    this.offroadTime += off * DT;
    this.scrapeTime += scrape * DT;
    this.wrongTime += wrong * DT;
    this.conedTime += coned * DT;
    this.stillTime = P.v < 2 ? this.stillTime + DT * this.repeat : 0;
    // reward is progress down the road (1 per decision at top speed) less a cost for the time taken, so standing still
    // never pays and a faster race scores more; off the road and against the wall are slow anyway, their small extra
    // cost just teaches it sooner
    const progress = (P.track.base + P.s - G0) / (P.vmax * DT * this.repeat);
    const n = this.repeat;
    // the coned-off lane in ROAD WORKS is rough, and the way out is across the kerb onto the opposite carriageway, which
    // takes starting early: say so, the slow speed it costs only shows up a second or two after the mistake
    let reward = progress - 0.3 - 0.05 * (off / n) - 0.25 * (scrape / n) - 0.5 * (wrong / n) - 0.4 * (coned / n);
    // a circuit ends at the flag; The Run also ends where the player is knocked out
    const terminated = this.mode === 'run' ? !!R.finished : P.s >= this.goalS;
    // stopped for five seconds: the race is lost, stop wasting the run on it
    const truncated = !terminated && (this.time >= this.maxTime || this.stillTime > 5);
    // and the places made as they are made (lost ones cost the same): 20 points for coming from last to first
    if (R.rivals.length) reward += (20 * (this.lastPos - R.position)) / (this.fieldStart - 1);
    this.lastPos = R.position;
    return { obs: this.observe(), reward, terminated, truncated, info: this.info() };
  }

  // the road runs on into the next district, as Game.handleFork does
  fork() {
    const P = this.player, tr = P.track;
    if (tr.isFinal || P.s <= tr.length) return;
    const child = tr.children[0];
    tr.chosen = child;
    P.track = child;
    P.s -= tr.length;
    this.track = child;
  }

  // note each knockout gate as it is met: where the player stood, against the cut
  logGate() {
    const R = this.race, tr = this.player.track;
    if (!tr.koDone || this.gates.some((g) => g.stage === tr.stageId)) return;
    this.gates.push({ stage: tr.stageId, cut: KNOCKOUTS[tr.stageId], position: R.finished?.pos ?? R.position, out: !!R.finished?.out });
  }

  // everything the driver sees, scaled to roughly -1..1
  observe() { return this.observation(this.player, null); }

  // what a car sees: P is its Player, self its rival entry (the player has none, and the rivals see the player as
  // one more car)
  observation(P, self) { return observe(this.race, world, P, self); }

  info() {
    const P = this.player, tr = P.track, R = this.race;
    return {
      ...(this.detail && {
        rivals: R.rivals.map((r) => ({ name: r.name, learned: !!r.brain, finish: r.finishT, offroad: r.brain?.off, scrape: r.brain?.scrape, G: r.G })),
      }),
      district: this.district,
      stage: tr.stageId,
      time: this.time,
      progress: clamp((tr.base + P.s - this.startG) / (this.goalG - this.startG), 0, 1),
      ...(this.mode === 'run' && { out: R.finished?.out || false, gates: this.gates.map((g) => ({ ...g })) }),
      laps: this.lapTimes.slice(),
      position: R.rivals.length ? R.position : 1,
      field: R.rivals.length ? R.field : 1,
      passed: this.passed,
      hits: this.hits,
      offroad: this.offroadTime,
      wrong_way: this.wrongTime,
      coned: this.conedTime,
      scrape: this.scrapeTime,
      nitro: this.nitroUsed,
      s: P.s,
      x: P.x,
      kmh: P.kmh,
      halfW: tr.halfWAt(Math.min(P.s, tr.length - 1)),
      k: tr.kAt(Math.min(P.s, tr.length - 1)),
    };
  }
}
