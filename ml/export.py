"""Export a trained driver as plain weights for the JavaScript side (sim/brain.mjs), so it can drive in Node, and
in time in the game, with no Python or library.

    python ml/export.py --name cur-2-field

Writes to ml/runs/<name>/:
  brain.json        the network (two tanh layers and the output layer) and the observation scaling
  brain.check.json  observations from a real race with the action Python takes for each, to check the JavaScript
                    against: node sim/brain-check.mjs ml/runs/<name>
"""

import argparse
import json
import pickle

import numpy as np
import torch
from stable_baselines3 import PPO

from outrun_env import OutrunEnv
from train import RUNS


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    args = ap.parse_args()
    run = RUNS / args.name

    model = PPO.load(run / "model", device="cpu")
    with open(run / "vecnormalize.pkl", "rb") as f:
        norm = pickle.load(f)

    net = model.policy.mlp_extractor.policy_net
    layers = [m for m in net if isinstance(m, torch.nn.Linear)] + [model.policy.action_net]
    assert all(isinstance(m, (torch.nn.Linear, torch.nn.Tanh)) for m in net), "the JavaScript side only knows tanh layers"
    assert sum(isinstance(m, torch.nn.Tanh) for m in net) == len(layers) - 1

    def grid(t):
        return np.round(t.detach().numpy().astype(np.float64), 6).tolist()

    brain = {
        "obs_mean": np.round(norm.obs_rms.mean, 6).tolist(),
        "obs_var": np.round(norm.obs_rms.var, 6).tolist(),
        "epsilon": float(norm.epsilon),
        "clip_obs": float(norm.clip_obs),
        "layers": [{"w": grid(m.weight), "b": grid(m.bias)} for m in layers],
    }
    (run / "brain.json").write_text(json.dumps(brain, separators=(",", ":")))

    # states from real races, with what Python does in each
    env = OutrunEnv()
    obs_log, act_log = [], []
    for district, seed in (("dhanmondi", 1), ("gulshan", 2), ("oldDhaka", 3)):
        obs, _ = env.reset(seed=seed, options={"district": district})
        done, i = False, 0
        while not done:
            action, _ = model.predict(norm.normalize_obs(obs[None]), deterministic=True)
            if i % 40 == 0:
                obs_log.append(obs.tolist())
                act_log.append(action[0].tolist())
            obs, _, te, tr, _ = env.step(action[0])
            done, i = te or tr, i + 1
    env.close()
    (run / "brain.check.json").write_text(json.dumps({"obs": obs_log, "act": act_log}))

    size = (run / "brain.json").stat().st_size
    print(f"exported {len(layers)} layers, {sum(m.weight.numel() + m.bias.numel() for m in layers)} weights, "
          f"{size / 1e6:.2f} MB; {len(obs_log)} check states")


if __name__ == "__main__":
    main()
