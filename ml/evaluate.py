"""Race a trained driver on every district and compare it with the medal times.

Writes a results table and one telemetry CSV per district (a row per decision: time, distance, line, speed,
inputs) to ml/runs/<name>/, plus a chart of its line and speed through each district.

    python ml/evaluate.py --name ppo-v1
"""

import argparse
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import DummyVecEnv, VecNormalize

from outrun_env import OutrunEnv, medal
from train import HELD_OUT, RUNS


def race(model, norm, env, district):
    obs, info = env.reset(seed=1, options={"district": district})
    rows, done = [], False
    while not done:
        action, _ = model.predict(norm.normalize_obs(obs[None]), deterministic=True)
        action = action[0]
        obs, _, terminated, truncated, info = env.step(action)
        done = terminated or truncated
        rows.append({
            "time": info["time"], "s": info["s"], "x": info["x"], "half_width": info["halfW"], "curvature": info["k"],
            "kmh": info["kmh"], "position": info["position"], "steer": action[0], "pedal": action[1], "nitro": action[2] > 0,
        })
    return info, terminated, pd.DataFrame(rows)


def chart(df, district, path):
    fig, (a, b) = plt.subplots(2, 1, figsize=(12, 5), sharex=True)
    km = df["s"] / 1000
    a.fill_between(km, -df["half_width"], df["half_width"], color="#ddd", label="road")
    a.plot(km, df["x"], color="#c8102e", lw=1, label="line")
    a.set_ylabel("across road (m)")
    a.legend(loc="upper right")
    b.plot(km, df["kmh"], color="#1d4fd8", lw=1)
    b.set_ylabel("km/h")
    b.set_xlabel("distance (km)")
    a.set_title(district)
    fig.tight_layout()
    fig.savefig(path, dpi=110)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", default="ppo")
    ap.add_argument("--districts", nargs="*")
    ap.add_argument("--solo", action="store_true", help="race alone, without the rivals")
    args = ap.parse_args()

    run = RUNS / args.name
    model = PPO.load(run / "model")
    env = OutrunEnv(rivals=not args.solo)
    norm = VecNormalize.load(str(run / "vecnormalize.pkl"), DummyVecEnv([lambda: env]))
    norm.training = False
    (run / "telemetry").mkdir(exist_ok=True)

    results = []
    for district in args.districts or env.all_districts:
        info, finished, df = race(model, norm, env, district)
        df.to_csv(run / "telemetry" / f"{district}.csv", index=False)
        chart(df, district, run / "telemetry" / f"{district}.png")
        par = env.par(district)
        results.append({
            "district": district, "held_out": district in HELD_OUT, "finished": finished,
            "place": f'{info["position"]}/{info["field"]}', "time": round(info["time"], 1), "gold": round(par["gold"], 1), "bronze": round(par["bronze"], 1),
            "medal": medal(info["time"], par) if finished else "-",
            "passed": info["passed"], "hits": info["hits"], "offroad_s": round(info["offroad"], 1), "wrong_way_s": round(info["wrong_way"], 1), "nitro": info["nitro"],
            "avg_kmh": round(df["kmh"].mean()),
        })
    env.close()

    table = pd.DataFrame(results)
    table.to_csv(run / "results.csv", index=False)
    print(table.to_string(index=False))
    medals = (table["medal"] != "-").sum()
    print(f"\n{medals}/{len(table)} medals, gold on {(table['medal'] == 'gold').sum()}")
    for label, part in (("trained-on", table[~table["held_out"]]), ("held-out", table[table["held_out"]])):
        if len(part):
            print(f"{label}: mean time / gold = {np.mean(part['time'] / part['gold']):.3f}")


if __name__ == "__main__":
    main()
