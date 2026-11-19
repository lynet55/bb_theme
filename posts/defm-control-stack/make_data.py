"""Data for the DeFM control-stack post.

norm.csv is computed from the input-normalisation formulas in the paper.
nav.csv, grasp.csv and ladder.csv are the result tables reported in the paper
(arXiv:2601.18923, Sec. VI), typed in by hand.
"""
import csv, math
from pathlib import Path

out = Path(__file__).parent / "data"
out.mkdir(exist_ok=True)
logp = lambda d: math.log(1 + d)

# three input channels against metric depth; C1 shown for an image spanning 0.5 m to 20 m
dmin, dmax = 0.5, 20.0
with open(out / "norm.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["depth", "channel", "value"])
    for i in range(121):
        d = 10 ** (-1 + 3 * i / 120)            # 0.1 m to 100 m
        if dmin <= d <= dmax:
            w.writerow([f"{d:.4g}", "C1 (this image)", f"{(logp(d) - logp(dmin)) / (logp(dmax) - logp(dmin)):.4f}"])
        w.writerow([f"{d:.4g}", "C2 (10 m scale)", f"{logp(d) / logp(10):.4f}"])
        w.writerow([f"{d:.4g}", "C3 (100 m scale)", f"{logp(d) / logp(100):.4f}"])

nav = {  # success rate, %
    "ImageNet": [77.61, 50.00, 38.33, 65.00],
    "VAE": [90.23, 89.67, 83.00, 73.67],
    "DINOv3": [83.64, 90.00, 74.67, 72.67],
    "DeFM": [90.31, 92.67, 84.33, 79.00],
}
envs = ["Industrial hangar", "Abandoned cable", "City downtown", "Training env."]
with open(out / "nav.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["model", "panel", "value", "ylabel"])
    for m, vals in nav.items():
        for e, v in zip(envs, vals):
            w.writerow([m, e, v, "Success (%)"])

grasp = {  # success normalised to the teacher
    "ImageNet": [0.6576, 0.0043, 0.7950, 0.7366],
    "VAE": [0.6894, 0.0219, 0.8105, 0.0379],
    "DINOv3": [0.6532, 0.2075, 0.8243, 0.7837],
    "DeFM": [0.8089, 0.4860, 0.8936, 0.8763],
}
conds = ["Frozen, training noise", "Frozen, Kinect noise", "Fine-tuned, training noise", "Fine-tuned, Kinect noise"]
with open(out / "grasp.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["model", "panel", "value", "ylabel"])
    for m, vals in grasp.items():
        for c, v in zip(conds, vals):
            w.writerow([m, c, v, "Relative to teacher"])

ladder = {"CNN from scratch": 90.45, "ImageNet": 89.29, "VAE": 89.75, "DINOv3": 89.59, "DeFM": 90.14}
with open(out / "ladder.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["model", "value"])
    for m, v in ladder.items():
        w.writerow([m, v])
print("wrote", sorted(p.name for p in out.iterdir()))
