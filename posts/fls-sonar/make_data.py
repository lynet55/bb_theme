"""Beam table for the FLS post: beam index and fixed angle beta_j for N = 16 over alpha = 180 deg."""
import csv
from pathlib import Path
N, ALPHA = 16, 180.0
out = Path(__file__).parent / "data"; out.mkdir(exist_ok=True)
with open(out / "beams.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["j", "beta", "first", "last", "ex"])
    for j in range(1, N + 1):
        b = -ALPHA / 2 + (j - 1) * ALPHA / (N - 1)
        w.writerow([j, round(b, 4), int(j == 1), int(j == N), int(j == 11)])
print("beam spacing", round(ALPHA / (N - 1), 3), "deg")
