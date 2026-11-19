"""Data for the SLAM basics post. Everything here is synthetic and only illustrates the ideas."""
import csv, math
from pathlib import Path
import numpy as np

out = Path(__file__).parent / "data"
out.mkdir(exist_ok=True)
rng = np.random.default_rng(7)

def write(name, header, rows):
    with open(out / name, "w", newline="") as f:
        w = csv.writer(f); w.writerow(header)
        for r in rows:
            w.writerow([f"{v:.5g}" if isinstance(v, (float, np.floating)) else v for v in r])

# ---------- 1. a loop: odometry drift, then a loop closure ----------
# ground truth: a rounded rectangle, 0.5 m steps, starting and ending at the same place
pts = []
W, H, R = 16.0, 8.0, 2.0
def rr(s):
    segs = [("l", (R, 0), (W - R, 0)), ("a", (W - R, R), -90, 0), ("l", (W, R), (W, H - R)), ("a", (W - R, H - R), 0, 90),
            ("l", (W - R, H), (R, H)), ("a", (R, H - R), 90, 180), ("l", (0, H - R), (0, R)), ("a", (R, R), 180, 270)]
    return segs
length = 2 * (W - 2 * R) + 2 * (H - 2 * R) + 2 * math.pi * R
n = int(length / 0.5)
for i in range(n + 1):
    s = i / n * length
    for seg in rr(s):
        L = math.dist(seg[1], seg[2]) if seg[0] == "l" else math.pi / 2 * R
        if s <= L + 1e-9:
            if seg[0] == "l":
                f = s / L; pts.append((seg[1][0] + f * (seg[2][0] - seg[1][0]), seg[1][1] + f * (seg[2][1] - seg[1][1])))
            else:
                a = math.radians(seg[2] + (seg[3] - seg[2]) * s / L); pts.append((seg[1][0] + R * math.cos(a), seg[1][1] + R * math.sin(a)))
            break
        s -= L
gt = np.array(pts)
d = np.diff(gt, axis=0)
step = np.hypot(d[:, 0], d[:, 1]); head = np.arctan2(d[:, 1], d[:, 0]); dhead = np.diff(np.r_[head[0], head])
dhead = (dhead + np.pi) % (2 * np.pi) - np.pi
# odometry: a small heading bias and noise per step, a slight scale error
th = head[0]; o = [gt[0].copy()]; oth = []
for k in range(len(step)):
    th += dhead[k] + 0.0045 + rng.normal(0, 0.002); oth.append(th)
    o.append(o[-1] + 1.02 * step[k] * np.array([math.cos(th), math.sin(th)]))
odo = np.array(o)
# loop closure, position-only pose graph: odometry steps as soft constraints, the end tied to the start
N = len(odo); A = []; b = []
for k in range(N - 1):
    for dim in range(2):
        row = np.zeros(2 * N); row[2 * (k + 1) + dim] = 1; row[2 * k + dim] = -1; A.append(row); b.append(odo[k + 1, dim] - odo[k, dim])
for dim in range(2):
    row = np.zeros(2 * N); row[dim] = 1e3; A.append(row); b.append(1e3 * gt[0, dim])
    row = np.zeros(2 * N); row[2 * (N - 1) + dim] = 30; row[dim] = -30; A.append(row); b.append(0.0)
x = np.linalg.lstsq(np.array(A), np.array(b), rcond=None)[0].reshape(N, 2)
write("loop.csv", ["i", "gx", "gy", "ox", "oy", "cx", "cy", "last"], [(i, *gt[i], *odo[i], *x[i], int(i == N - 1)) for i in range(N)])
# a landmark near the start, seen at the start and again at the end of the lap
lm = np.array([2.5, -1.4]); i0, i1 = 3, N - 4
def place(traj, i, ths):
    rel = lm - gt[i]; c, s = math.cos(ths - head[min(i, len(head) - 1)]), math.sin(ths - head[min(i, len(head) - 1)])
    return traj[i] + np.array([c * rel[0] - s * rel[1], s * rel[0] + c * rel[1]])
th_odo = np.r_[head[0], oth]
corr = np.linspace(0, 1, N) * ((head[-1] - th_odo[-1] + np.pi) % (2 * np.pi) - np.pi)
th_c = th_odo + corr
write("loop_lm.csv", ["is_odo", "is_closed", "is_gt", "seen_txt", "x", "y"], [
    (1, 0, 0, "start of the lap", *place(odo, i0, th_odo[i0])), (1, 0, 0, "end of the lap", *place(odo, i1, th_odo[i1])),
    (0, 1, 0, "start of the lap", *place(x, i0, th_c[i0])), (0, 1, 0, "end of the lap", *place(x, i1, th_c[i1])), (0, 0, 1, "true", *lm)])
print("lap length %.1f m" % (np.hypot(*np.diff(gt, axis=0).T).sum()))
print("loop: end gap odometry %.2f m, after closure %.2f m" % (np.hypot(*(odo[-1] - odo[0])), np.hypot(*(x[-1] - x[0]))))

# ---------- 2. epipolar fan: rays from five pixels in image 1 ----------
f, cx, cy = 400.0, 320.0, 240.0
pix = [(560, 340), (210, 150), (500, 110), (150, 380), (420, 420)]
write("epi_rays.csv", ["k", "u1", "v1", "mx", "my"], [(k, u, v, (u - cx) / f, (v - cy) / f) for k, (u, v) in enumerate(pix)])
write("epi_ticks.csv", ["z", "lab", "zlab"], [(z, int(z in (1, 5)), f"{z:g}\\,\\mathrm{{m}}") for z in (0.75, 1, 1.5, 2, 3, 5, 10)])

# ---------- 3. reprojection: 12 points seen by one camera, one bad match ----------
P = np.c_[rng.uniform(-1.8, 1.8, 12), rng.uniform(-1.1, 1.1, 12), rng.uniform(3, 8, 12)]
um = f * P[:, 0] / P[:, 2] + cx + rng.normal(0, 1.0, 12); vm = f * P[:, 1] / P[:, 2] + cy + rng.normal(0, 1.0, 12)
um[7] += 55; vm[7] -= 38   # a wrong match
print("bad match at", round(um[7], 1), round(vm[7], 1))
write("reproj.csv", ["X", "Y", "Z", "um", "vm", "bad"], [(*P[i], um[i], vm[i], int(i == 7)) for i in range(12)])

# ---------- 4. RANSAC iterations for 99 % confidence ----------
rows = []
for s in (2, 3, 5, 8):
    for w in np.linspace(0.15, 0.8, 27):
        rows.append((f"{s}-point sample", round(w * 100, 1), math.log(0.01) / math.log(1 - w ** s)))
write("ransac.csv", ["sample", "inliers", "iterations"], rows)
for s in (5, 8):
    print("RANSAC s=%d, w=0.5: %.0f" % (s, math.log(0.01) / math.log(1 - 0.5 ** s)))

# ---------- 5. robust kernels: cost and weight ----------
rows = []
k = 1.0
for r in np.linspace(-5, 5, 201):
    a = abs(r)
    for name, rho, wgt in [("Squared (L2)", r * r / 2, 1.0),
                           ("Huber, k = 1", r * r / 2 if a <= k else k * (a - k / 2), 1.0 if a <= k else k / a),
                           ("Cauchy, c = 1", 0.5 * math.log(1 + r * r), 1 / (1 + r * r))]:
        rows.append((name, round(r, 3), rho, wgt))
write("robust.csv", ["kernel", "r", "cost", "weight"], rows)

# ---------- 6. pose samples for the banana ----------
write("banana.csv", ["n1", "n2", "n3"], [tuple(rng.standard_normal(3)) for _ in range(160)])

# ---------- 7. scale ambiguity: five landmarks seen from above ----------
write("scale_pts.csv", ["x", "y"], [(-1.2, 3.0), (0.4, 4.2), (1.6, 2.6), (-0.3, 5.0), (2.4, 4.6)])

# ---------- 8. range-only localisation (Gauss-Newton vs Levenberg-Marquardt) ----------
L = np.array([[0.0, 0.0], [4.0, 0.6], [8.0, 0.0]]); xt = np.array([4.6, 2.6])
r = np.hypot(*(L - xt).T) + np.array([0.05, -0.04, 0.03])
print("ranges", np.round(r, 3))

# ---------- 9. bundle-adjustment Hessian: 4 poses (6 each), 8 points (3 each) ----------
obs = {0: [0, 1, 2, 3], 1: [1, 2, 3, 4, 5], 2: [3, 4, 5, 6], 3: [5, 6, 7, 0]}
NP, NL = 4, 8
size = 6 * NP + 3 * NL
blocks, schur = [], []
def blk(r0, c0, h, w, kind):
    return (c0, r0, w, h, kind)
for i in range(NP):
    blocks.append(blk(6 * i, 6 * i, 6, 6, "dark"))
for j in range(NL):
    o = 6 * NP + 3 * j; blocks.append(blk(o, o, 3, 3, "mid"))
for i, js in obs.items():
    for j in js:
        o = 6 * NP + 3 * j
        blocks.append(blk(6 * i, o, 6, 3, "light")); blocks.append(blk(o, 6 * i, 3, 6, "light"))
write("hess.csv", ["x", "y", "w", "h", "kind"], blocks)
for a in range(NP):
    for b2 in range(NP):
        if a == b2 or set(obs[a]) & set(obs[b2]):
            schur.append((6 * b2, 6 * a, 6, 6, "dark" if a == b2 else "light"))
write("schur.csv", ["x", "y", "w", "h", "kind"], schur)
print("wrote", sorted(p.name for p in out.iterdir()))
