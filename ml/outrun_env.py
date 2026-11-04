"""Outrun Dhaka as a Gymnasium environment.

Each env runs the game's own driving model in a Node process (sim/server.mjs) and talks to it one JSON line
per message. No browser, no graphics: a full three-lap race takes milliseconds.

    env = OutrunEnv(districts=["dhanmondi"])
    obs, info = env.reset(seed=0)
    obs, reward, terminated, truncated, info = env.step(env.action_space.sample())
"""

import json
import subprocess
from pathlib import Path

import gymnasium as gym
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SERVER = ROOT / "sim" / "server.mjs"


class OutrunEnv(gym.Env):
    """Race a district circuit against the game's 23 rivals (or alone, with rivals=False), or, with mode="run", The
    Run: 48 cars across all fifteen districts, where the episode also ends if the car is knocked out at a gate.

    Observation: speed, line across the road, sideways speed, off-road and wall contact, nitro, room either
    side, road works ahead, place in the field, passes towards the next nitro; then for each look-ahead distance
    the bend and the room either side; then the nearest four rivals ahead and two behind (there or not, gap,
    offset across the road, speed difference); then the road works (distance to them, inside, distance to the end,
    where the opposite carriageway starts); then the next knockout gate on The Run (how far off, its cut, how far
    past the cut this car is, and that this is The Run; all zeros on a circuit).
    Action: [steer, pedal, nitro], each -1..1. Pedal above 0 is throttle, below is brake; nitro above 0 fires
    (it is a tap: hold it and it fires once).
    Reward: progress (1 a decision at top speed) less 0.3 a decision for the time taken, a little less for the
    verge and the wall, 0.4 for staying in the coned-off lane in road works and more for the opposite carriageway
    outside them (its oncoming traffic is not simulated yet), and 20 spread over the places made, from last to
    first.
    """

    metadata = {"render_modes": []}

    def __init__(self, districts=None, mode="circuit", rivals=True, random_start=False, laps=None, repeat=4, max_time=None):
        opts = {"mode": mode, "rivals": rivals, "randomStart": random_start, "repeat": repeat}
        if max_time:
            opts["maxTime"] = max_time
        if laps:
            opts["laps"] = laps
        self.proc = subprocess.Popen(
            ["node", str(SERVER), json.dumps(opts)],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, bufsize=1, cwd=ROOT,
        )
        spec = self._call({"cmd": "spec"})
        self.all_districts = spec["districts"]
        self.districts = list(districts or self.all_districts)
        self.observation_space = gym.spaces.Box(-np.inf, np.inf, shape=(spec["obs_size"],), dtype=np.float32)
        self.action_space = gym.spaces.Box(-1.0, 1.0, shape=(spec["act_size"],), dtype=np.float32)

    def _call(self, msg):
        self.proc.stdin.write(json.dumps(msg) + "\n")
        reply = json.loads(self.proc.stdout.readline())
        if "error" in reply:
            raise RuntimeError(reply["error"])
        return reply

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        options = options or {}
        district = options.get("district") or self.districts[self.np_random.integers(len(self.districts))]
        r = self._call({"cmd": "reset", "district": district, "seed": int(self.np_random.integers(2**31))})
        return np.asarray(r["obs"], dtype=np.float32), r["info"]

    def step(self, action):
        r = self._call({"cmd": "step", "action": [float(a) for a in action]})
        return np.asarray(r["obs"], dtype=np.float32), r["reward"], r["terminated"], r["truncated"], r["info"]

    def par(self, district):
        """Gold, silver and bronze times for a district, as the game sets them."""
        return self._call({"cmd": "par", "district": district})

    def close(self):
        if self.proc.poll() is None:
            self.proc.stdin.close()
            self.proc.wait(timeout=5)


def medal(time, par):
    for name in ("gold", "silver", "bronze"):
        if time <= par[name]:
            return name
    return "-"
