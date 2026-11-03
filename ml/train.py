"""Train an AI driver with PPO.

Trains on one-lap stints from random points on the lap, so every corner turns up early, on every district except
the held-out ones. Those are kept back to measure whether it learned to drive or just learned the tracks.

    python ml/train.py --steps 2000000 --name ppo-v1
    python ml/evaluate.py --name ppo-v1
"""

import argparse
from pathlib import Path

from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import SubprocVecEnv, VecMonitor, VecNormalize

from outrun_env import OutrunEnv

RUNS = Path(__file__).resolve().parent / "runs"
HELD_OUT = ["gulshan", "oldDhaka", "padma"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", default="ppo")
    ap.add_argument("--steps", type=int, default=1_000_000, help="decisions to train for (15 a second of race)")
    ap.add_argument("--envs", type=int, default=8, help="races run side by side, one Node process each")
    ap.add_argument("--districts", nargs="*", help="train on these (default: all but the held-out ones)")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    probe = OutrunEnv()
    districts = args.districts or [d for d in probe.all_districts if d not in HELD_OUT]
    probe.close()
    out = RUNS / args.name
    out.mkdir(parents=True, exist_ok=True)
    print(f"training on {len(districts)} districts: {', '.join(districts)}")

    make = lambda: OutrunEnv(districts=districts, random_start=True, laps=1)
    env = VecNormalize(VecMonitor(SubprocVecEnv([make] * args.envs)), norm_obs=True, norm_reward=True, gamma=0.995)
    model = PPO(
        "MlpPolicy", env, seed=args.seed, verbose=1, tensorboard_log=str(RUNS / "tb"),
        n_steps=1024, batch_size=2048, n_epochs=10, gamma=0.995, gae_lambda=0.95,
        learning_rate=3e-4, ent_coef=0.0, clip_range=0.2, policy_kwargs={"net_arch": [256, 256]},
    )
    try:
        model.learn(total_timesteps=args.steps, tb_log_name=args.name)
    finally:
        model.save(out / "model")
        env.save(str(out / "vecnormalize.pkl"))
        env.close()
    print(f"saved to {out}")


if __name__ == "__main__":
    main()
