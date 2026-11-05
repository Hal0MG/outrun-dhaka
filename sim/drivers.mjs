// The hand-written driver: flat out, steer against the corner push, never brake, fire nitro on straights, and pay no
// attention to the other cars. What every learned driver has to beat, and a stand-in for a player.

const ROAD = 12; // where the look-ahead starts in the observation (sim/env.mjs observation)

// t is the decision number: nitro is a tap, press on a straight and let go on the next decision
export function simpleDriver(obs, t) {
  const v = obs[0], x = obs[1], vx = obs[2];
  const kNear = obs[ROAD + 3 * 2], kFar = obs[ROAD + 3 * 4];
  // the outward push is curvature × speed², so steer against that, not the bend alone (0.55 cancels it at the car's grip)
  const steer = Math.max(-1, Math.min(1, kNear * v * v * 0.55 - x * 0.6 - vx * 0.05));
  const nitro = t % 2 === 0 && Math.abs(kFar) < 0.05 && Math.abs(kNear) < 0.05 && v > 0.5 ? 1 : 0;
  return [steer, 1, nitro];
}
