---
title: "Visual SLAM: the geometry, and the tricks that make it work"
date: November 2026
summary: >
  A camera moving through an unknown place has to work out where it is and what the place looks like at
  the same time. This page builds the pieces up one at a time: what a pixel tells you, how two views
  constrain each other, how errors are measured and minimised, and the implementation tricks that real
  systems rely on.
findings:
  - "A pixel fixes a direction, not a distance. Depth comes from a second view, and its error grows with the square of the distance (@fig:tri)."
  - "Each step of the pipeline is one of three correspondence problems: 2D–2D starts the map, 3D–2D tracks against it, 3D–3D stitches maps together (@sec:problems)."
  - "Everything is refined by minimising reprojection error in pixels, with a robust cost so a few bad matches can't pull the answer away (@fig:reproj, @fig:robust)."
  - "Drift is unavoidable without loop closure: places that are next to each other can end up metres apart in the map (@fig:loop)."
---

## What SLAM solves {#problem}

To localise, you need a map; to build a map, you need to know where you are. Simultaneous localisation
and mapping (SLAM) breaks this circle by estimating both together, here from images alone.

It helps to write the problem down once. Collect every unknown (camera poses and map points) in $\mathcal{X}$
and every measurement (where features were seen) in $\mathcal{Z}$. The best estimate is the one that makes the
measurements most probable, with whatever prior knowledge we have:

$$\mathcal{X}^{\star} = \arg\max_{\mathcal{X}}\; p(\mathcal{Z}\mid\mathcal{X})\,p(\mathcal{X}).$$

With Gaussian noise this becomes a weighted least-squares problem, which is why the rest of this page is
mostly about residuals and how to minimise them. Systems are usually split in two: a **front end** that
turns images into measurements and decides which measurement belongs to which map point, and a **back end**
that solves the estimation problem.

A system that only chains frame-to-frame estimates is called visual odometry. It drifts, and the drift does
more than add an offset: it breaks the shape of the map (@fig:loop).

```figure
id: loop
type: plane
tag: drift and loop closure
title: Without loop closure, the start and end of a lap land 2.6 m apart
subtitle: Top view of a 45 m lap; odometry has a small heading bias per step
equal: true
xrange: [-4.5, 20.5]
yrange: [-4.5, 12.5]
xlabel: 'x\ (\mathrm{m})'
ylabel: 'y\ (\mathrm{m})'
legend:
  - {label: True path, cls: cx, shape: dash}
  - {label: Estimate, cls: hl, shape: ln}
  - {label: "Landmark, true position", cls: ink, shape: dot}
views:
  - view: Odometry only
    marks:
      - {kind: path, data: loop.csv, x: gx, y: gy, cls: muted dash}
      - {kind: path, data: loop.csv, x: ox, y: oy, cls: hl}
      - {kind: points, data: loop_lm.csv, filter: 'is_gt', x: x, y: y, shape: square, size: 3.5, cls: ink, tip: "landmark, true position"}
      - {kind: points, data: loop_lm.csv, filter: 'is_odo', x: x, y: y, shape: ring, size: 4.5, cls: hl, tip: "same landmark, mapped at the {seen_txt}"}
      - {kind: point, at: [2, 0], shape: dot, size: 3.5, cls: ink, label: '\text{start}', label_off: [-8, -12], label_anchor: end}
      - {kind: points, data: loop.csv, filter: last, x: ox, y: oy, shape: dot, size: 3.5, cls: hl, label: '\text{end}', label_off: [10, 12], label_anchor: start}
      - {kind: text, at: [5.6, -3.4], text: "one landmark, mapped twice", anchor: start}
  - view: After loop closure
    marks:
      - {kind: path, data: loop.csv, x: gx, y: gy, cls: muted dash}
      - {kind: path, data: loop.csv, x: cx, y: cy, cls: hl}
      - {kind: points, data: loop_lm.csv, filter: 'is_gt', x: x, y: y, shape: square, size: 3.5, cls: ink, tip: "landmark, true position"}
      - {kind: points, data: loop_lm.csv, filter: 'is_closed', x: x, y: y, shape: ring, size: 4.5, cls: hl, tip: "landmark, mapped at the {seen_txt}"}
      - {kind: point, at: [2, 0], shape: dot, size: 3.5, cls: hl, label: '\text{start} = \text{end}', label_off: [-8, -12], label_anchor: end}
      - {kind: text, at: [8, 4], text: "the correction is spread along the lap"}
source: "Synthetic lap; loop closure solved as a position-only pose graph"
caption: "Odometry accumulates small heading errors, so the lap fails to close and a landmark seen at the start and again at the end is mapped in two places. Recognising the start place adds one constraint, end = start; the pose graph spreads the correction along the whole path, with most of the shift near the end."
```

## Three correspondence problems {#problems}

Almost every geometric step in feature-based visual SLAM answers one question: given matches between what
I see now and what I knew before, what is the motion? What you already know decides which version you solve.

| Problem | You know | You solve for | Used for | Standard solvers |
|---|---|---|---|---|
| 2D–2D | Matched pixels in two images | Rotation $\mathbf{R}$ and the *direction* of $\mathbf{t}$ | Starting a monocular map; rejecting bad matches between frames | 5-point (Nistér) for $\mathbf{E}$, 8-point for $\mathbf{F}$, homography for flat scenes, all inside RANSAC |
| 3D–2D (PnP) | 3D map points and their pixels in a new image | The full 6-DoF camera pose | Tracking each frame; relocalisation; checking loop closures | P3P or EPnP in RANSAC, then Levenberg–Marquardt |
| 3D–3D | Two sets of matched 3D points | Rigid or similarity transform ($\mathbf{R}$, $\mathbf{t}$, scale) | Stereo or RGB-D odometry; aligning a loop closure | Horn / Umeyama (closed form), ICP for dense depth |

In short: 2D–2D starts the map, 3D–2D keeps you moving through it, and 3D–3D stitches maps together.

## The geometry {#geometry}

### A pixel is a direction, not a distance {#pinhole}

The pinhole model maps a 3D point $\mathbf{X}$ to a pixel $\mathbf{x}$ through the intrinsics $\mathbf{K}$ and
the camera pose $(\mathbf{R}, \mathbf{t})$:

$$\lambda\,\mathbf{x} = \mathbf{K}\,[\mathbf{R}\mid\mathbf{t}]\,\mathbf{X}.$$

The scale factor $\lambda$ is the depth, and it is lost: every point on the same ray lands on the same pixel
(@fig:pinhole). Real lenses add distortion on top, which is undone in the normalised image plane so the same
model still applies.

```figure
id: pinhole
type: scene
tag: pinhole projection
title: Slide the point along its ray and the pixel does not move
view: {azimuth: -62, elevation: 18}
center: [2.8, 0, 0.1]
radius: 3.4
zoom: 2.6
height: 330
params: {mx: 0.24, my: -0.13}
controls:
  - {name: s, label: Depth along the ray, unit: m, min: 1.5, max: 7, step: 0.05, value: 4.5}
  - {name: dx, label: Move off the ray, unit: m, min: -1, max: 1, step: 0.02, value: 0}
derived: {X: "s*mx + dx", Y: "s*my", u: "X/s", v: "Y/s"}
frames:
  - {name: cam, rpy: [-90, 0, -90], labels: [x_c, y_c, z_c], length: 0.8, label: C}
quads:
  - {in: cam, corners: [[-0.75, -0.55, 1], [0.75, -0.55, 1], [0.75, 0.55, 1], [-0.75, 0.55, 1]]}
lines:
  - {in: cam, from: [0, 0, 0], to: ["=7.5*mx", "=7.5*my", 7.5], dashed: true}
  - {in: cam, from: [0, 0, 0], to: ["=X", "=Y", "=s"], highlight: true}
points:
  - {in: cam, at: ["=X", "=Y", "=s"], label: '\mathbf{X}', label_offset: [12, 10]}
  - {in: cam, at: ["=u", "=v", 1], label: '\mathbf{x}', highlight: true, label_offset: [-4, 16]}
readouts:
  - {label: "u (px, f = 500)", expr: "500*u + 320", digits: 1}
  - {label: "v (px)", expr: "500*v + 240", digits: 1}
source: "Drawn from the pinhole model"
caption: "The dashed line is the ray through the pixel $\\mathbf{x}$. Moving $\\mathbf{X}$ along it leaves $u$ and $v$ unchanged; moving it off the ray changes them. Drag to rotate."
```

### One pixel becomes a line in the other image {#epipolar}

Give a second camera a known relative pose and the unknown depth stops being free: the point must lie on
its ray, so its image in camera 2 must lie on that ray's projection, the **epipolar line**. A 2D search
becomes a 1D search, and the constraint $\mathbf{x}_2^{\top}\mathbf{E}\,\mathbf{x}_1 = 0$ with
$\mathbf{E} = [\mathbf{t}]_\times\mathbf{R}$ is what 2D–2D solvers use.

The handbook adds a useful way to read the line. Its far end, $\mathbf{x}_\infty$, is where a point at
infinite depth appears: only the rotation matters there. As the depth shrinks the point slides towards the
**epipole**, the image of camera 1's centre, and it slides *evenly in inverse depth* $1/z$, not in depth
(@fig:epipolar). This is why many systems store depth as inverse depth: its uncertainty is far closer to
Gaussian, and points at infinity are just $1/z = 0$.

```figure
id: epipolar
type: plane
tag: epipolar geometry
title: The match slides along a line, evenly in inverse depth
subtitle: Five pixels in image 1 and their epipolar lines in image 2, with depth marks along the blue one
equal: true
axes: false
flip_y: true
xrange: [-12, 1352]
yrange: [-48, 500]
params: {f: 400, cx: 320, cy: 240, ox: 700, ty: 0, mx0: 0.6, my0: 0.25, rmax: 1.6}
controls:
  - {name: rho, label: "Inverse depth 1/z", unit: "1/m", min: 0, max: 1.6, step: 0.01, value: 0.3}
derived:
  ca: "cos(rad(-8))"
  sa: "sin(rad(-8))"
  den: "-sa*mx0 + ca + tz*rho"
  bu: "ox + f*(ca*mx0 + sa + tx*rho)/den + cx"
  bv: "f*(my0 + ty*rho)/den + cy"
  iu: "ox + f*(ca*mx0 + sa)/(-sa*mx0 + ca) + cx"
  iv: "f*my0/(-sa*mx0 + ca) + cy"
  eu: "ox + f*tx/max(tz, 0.000001) + cx"
  ev: "f*ty/max(tz, 0.000001) + cy"
marks: &epimarks
  - {kind: polygon, points: [[0, 0], [640, 0], [640, 480], [0, 480]], cls: paper}
  - {kind: polygon, points: [[700, 0], [1340, 0], [1340, 480], [700, 480]], cls: paper}
  - {kind: text, at: [320, -24], text: image 1}
  - {kind: text, at: [1020, -24], text: image 2}
  - {kind: points, data: epi_rays.csv, x: u1, y: v1, shape: cross, size: 5, cls_if: {expr: "k < 0.5", true: hl, false: ink}}
  - {kind: segments, data: epi_rays.csv, x1: "ox + f*(ca*mx + sa)/(-sa*mx + ca) + cx", y1: "f*my/(-sa*mx + ca) + cy", x2: "ox + f*(ca*mx + sa + tx*rmax)/(-sa*mx + ca + tz*rmax) + cx", y2: "f*(my + ty*rmax)/(-sa*mx + ca + tz*rmax) + cy", cls_if: {expr: "k < 0.5", true: hl, false: muted}, clip_box: [700, 0, 1340, 480]}
  - {kind: points, data: epi_ticks.csv, x: "ox + f*(ca*mx0 + sa + tx/z)/(-sa*mx0 + ca + tz/z) + cx", y: "f*(my0 + ty/z)/(-sa*mx0 + ca + tz/z) + cy", shape: dot, size: 2.4, cls: ink, tip: "depth z = {z} m"}
  - {kind: points, data: epi_ticks.csv, filter: lab, x: "ox + f*(ca*mx0 + sa + tx/z)/(-sa*mx0 + ca + tz/z) + cx", y: "f*(my0 + ty/z)/(-sa*mx0 + ca + tz/z) + cy", shape: dot, size: 0.1, cls: ink, label_col: zlab, label_off: [0, 18], label_size: 12}
  - {kind: point, at: ["iu", "iv"], shape: ring, size: 4.5, cls: ink, label: '\mathbf{x}_\infty', label_off: [14, -14]}
  - {kind: point, at: ["bu", "bv"], shape: dot, size: 5, cls: hl}
views:
  - view: Sideways motion
    params: {tx: -0.5, tz: 0}
  - view: Forward motion
    params: {tx: -0.3, tz: 0.6}
    marks:
      - {kind: polygon, points: [[0, 0], [640, 0], [640, 480], [0, 480]], cls: paper}
      - {kind: polygon, points: [[700, 0], [1340, 0], [1340, 480], [700, 480]], cls: paper}
      - {kind: text, at: [320, -24], text: image 1}
      - {kind: text, at: [1020, -24], text: image 2}
      - {kind: points, data: epi_rays.csv, x: u1, y: v1, shape: cross, size: 5, cls_if: {expr: "k < 0.5", true: hl, false: ink}}
      - {kind: segments, data: epi_rays.csv, x1: "ox + f*(ca*mx + sa)/(-sa*mx + ca) + cx", y1: "f*my/(-sa*mx + ca) + cy", x2: "eu", y2: "ev", cls_if: {expr: "k < 0.5", true: hl, false: muted}, clip_box: [700, 0, 1340, 480]}
      - {kind: points, data: epi_ticks.csv, x: "ox + f*(ca*mx0 + sa + tx/z)/(-sa*mx0 + ca + tz/z) + cx", y: "f*(my0 + ty/z)/(-sa*mx0 + ca + tz/z) + cy", shape: dot, size: 2.4, cls: ink, tip: "depth z = {z} m"}
      - {kind: points, data: epi_ticks.csv, filter: lab, x: "ox + f*(ca*mx0 + sa + tx/z)/(-sa*mx0 + ca + tz/z) + cx", y: "f*(my0 + ty/z)/(-sa*mx0 + ca + tz/z) + cy", shape: dot, size: 0.1, cls: ink, label_col: zlab, label_off: [0, 18], label_size: 12}
      - {kind: point, at: ["iu", "iv"], shape: ring, size: 4.5, cls: ink, label: '\mathbf{x}_\infty', label_off: [14, -14]}
      - {kind: point, at: ["eu", "ev"], shape: dot, size: 4, cls: ink, label: '\mathbf{e}', label_off: [-14, -12]}
      - {kind: point, at: ["bu", "bv"], shape: dot, size: 5, cls: hl}
readouts:
  - {label: "Depth z", expr: "1/rho", unit: m, digits: 2}
  - {label: "Shift from x∞", expr: "hypot(bu - iu, bv - iv)", unit: px, digits: 1}
source: "Two synthetic cameras, f = 400 px, camera 2 turned 8°; sideways: moved 0.5 m; forward: 0.3 m sideways and 0.6 m along its axis"
caption: "The blue cross in image 1 constrains its match to the blue line in image 2, starting at $\\mathbf{x}_\\infty$ (infinite depth). **Sideways motion:** the dot moves exactly in proportion to $1/z$, while the metre marks bunch up towards $\\mathbf{x}_\\infty$. **Forward motion:** all five lines meet at the epipole $\\mathbf{e}$, the image of camera 1's centre; the spacing is no longer exactly even, but far points still crowd near $\\mathbf{x}_\\infty$."
```

### Two rays meet at a point, and the angle between them sets the accuracy {#triangulation}

With two known poses, two rays fix a 3D point. Pixel noise turns each ray into a thin wedge, and the point
can be anywhere in the overlap. When the rays meet at a wide angle the overlap is small. When the baseline
is short or the point is far, the rays are nearly parallel and the overlap stretches into a long sliver
along the viewing direction (@fig:tri). For a stereo pair the depth error is roughly

$$\sigma_Z \approx \frac{Z^2}{f\,b}\,\sigma_{\mathrm{px}},$$

so it grows with the *square* of the depth. Systems therefore discard points whose rays meet at less than
about 1–2°.

```figure
id: tri
type: plane
tag: triangulation
title: Short baselines stretch the uncertainty into a long sliver
subtitle: Top view; each wedge is a ray with angular noise (exaggerated so it is visible)
equal: true
xrange: [-0.6, 10.6]
yrange: [-2.4, 2.4]
xlabel: 'Z\ (\mathrm{m})'
controls:
  - {name: b, label: Baseline b, unit: m, min: 0.1, max: 3, step: 0.05, value: 1.2}
  - {name: Z, label: Depth Z, unit: m, min: 2, max: 9, step: 0.1, value: 6}
  - {name: dd, label: Angular noise, unit: "°", min: 0.2, max: 3, step: 0.1, value: 1}
derived:
  h: "b/2"
  d: "rad(dd)"
  p1: "atan2(-h, Z)"
  p2: "atan2(h, Z)"
  Lr: "1.6*Z"
  nA: "p1 - d"
  nB: "p2 + d"
  nS: "2*h*cos(nB)/sin(nB - nA)"
  nx: "nS*cos(nA)"
  ny: "h + nS*sin(nA)"
  fA: "p1 + d"
  fB: "p2 - d"
  fS: "2*h*cos(fB)/sin(fB - fA)"
  fx: "if(fB - fA > 0.0001, fS*cos(fA), 40)"
  fy: "if(fB - fA > 0.0001, h + fS*sin(fA), 0)"
  aA: "p1 - d"
  aB: "p2 - d"
  aS: "2*h*cos(aB)/sin(aB - aA)"
  ax_: "aS*cos(aA)"
  ay: "h + aS*sin(aA)"
  bA: "p1 + d"
  bB: "p2 + d"
  bS: "2*h*cos(bB)/sin(bB - bA)"
  bx_: "bS*cos(bA)"
  by: "h + bS*sin(bA)"
marks:
  - {kind: polygon, points: [[0, "h"], ["Lr*cos(p1 + d)", "h + Lr*sin(p1 + d)"], ["Lr*cos(p1 - d)", "h + Lr*sin(p1 - d)"]], cls: hatch}
  - {kind: polygon, points: [[0, "-h"], ["Lr*cos(p2 + d)", "-h + Lr*sin(p2 + d)"], ["Lr*cos(p2 - d)", "-h + Lr*sin(p2 - d)"]], cls: hatch}
  - {kind: polygon, points: [["nx", "ny"], ["ax_", "ay"], ["fx", "fy"], ["bx_", "by"]], cls: hl}
  - {kind: line, from: [0, "h"], to: ["Z", 0], cls: ink thin}
  - {kind: line, from: [0, "-h"], to: ["Z", 0], cls: ink thin}
  - {kind: point, at: ["Z", 0], shape: dot, size: 3, cls: hl, label: '\mathbf{X}', label_off: [0, -16]}
  - {kind: point, at: [0, "h"], shape: square, size: 4, cls: ink, label: 'C_1', label_off: [-10, 0], label_anchor: end}
  - {kind: point, at: [0, "-h"], shape: square, size: 4, cls: ink, label: 'C_2', label_off: [-10, 0], label_anchor: end}
readouts:
  - {label: "Parallax angle", expr: "deg(p2 - p1)", unit: "°", digits: 1}
  - {label: "Length of the overlap", expr: "fx - nx", unit: m, digits: 2}
  - {label: "σ_Z for f = 500 px, 1 px noise", expr: "Z*Z/(500*b)", unit: m, digits: 3}
source: "Drawn from the triangulation geometry"
caption: "Hatched wedges are the two noisy rays; the blue diamond is where both agree. Shrink the baseline or push the point away and the diamond stretches along $Z$ far faster than it widens."
```

### Reprojection error: the number everything minimises {#reprojection}

Take the estimated point, project it with the estimated pose, and compare with where the feature was
actually seen. That pixel distance is the **reprojection error**. Pose refinement and bundle adjustment
minimise its sum over all observations:

$$\min_{\mathbf{R},\mathbf{t},\mathbf{X}}\; \sum_{i,j} \rho\Bigl(\bigl\lVert \mathbf{x}_{ij} - \pi(\mathbf{K},\mathbf{R}_i,\mathbf{t}_i,\mathbf{X}_j)\bigr\rVert^2\Bigr).$$

A useful picture is a set of springs, one per observation, pulling predictions towards measurements; the
optimiser lets them relax. The function $\rho$ is a robust cost, and the bad match in @fig:reproj shows why
it is needed.

```figure
id: reproj
type: plane
tag: reprojection error
title: Get the pose right and every residual shrinks, except the bad match
subtitle: Measured features (crosses) and the points projected with your pose guess (rings)
equal: true
flip_y: true
xrange: [0, 640]
yrange: [0, 480]
xlabel: 'u\ (\mathrm{px})'
ylabel: 'v\ (\mathrm{px})'
params: {f: 400, cx: 320, cy: 240}
controls:
  - {name: dpsi, label: Yaw error, unit: "°", min: -6, max: 6, step: 0.1, value: 3}
  - {name: dtx, label: Sideways error, unit: m, min: -0.4, max: 0.4, step: 0.01, value: -0.15}
derived: {c: "cos(rad(dpsi))", sn: "sin(rad(dpsi))"}
sums:
  - {name: n, data: reproj.csv, expr: "1"}
  - {name: e2, data: reproj.csv, expr: "(f*(c*X + sn*Z + dtx)/(-sn*X + c*Z) + cx - um)^2 + (f*Y/(-sn*X + c*Z) + cy - vm)^2"}
  - {name: e2g, data: reproj.csv, filter: "bad < 0.5", expr: "(f*(c*X + sn*Z + dtx)/(-sn*X + c*Z) + cx - um)^2 + (f*Y/(-sn*X + c*Z) + cy - vm)^2"}
  - {name: hub, data: reproj.csv, expr: "if(hypot(f*(c*X + sn*Z + dtx)/(-sn*X + c*Z) + cx - um, f*Y/(-sn*X + c*Z) + cy - vm) < 5, 0.5*(f*(c*X + sn*Z + dtx)/(-sn*X + c*Z) + cx - um)^2 + 0.5*(f*Y/(-sn*X + c*Z) + cy - vm)^2, 5*(hypot(f*(c*X + sn*Z + dtx)/(-sn*X + c*Z) + cx - um, f*Y/(-sn*X + c*Z) + cy - vm) - 2.5))"}
legend:
  - {label: Measured, cls: ink, shape: dot}
  - {label: Predicted from the pose guess, cls: hl, shape: dot}
  - {label: Residual, cls: ink, shape: ln}
marks:
  - {kind: segments, data: reproj.csv, x1: um, y1: vm, x2: "f*(c*X + sn*Z + dtx)/(-sn*X + c*Z) + cx", y2: "f*Y/(-sn*X + c*Z) + cy", cls_if: {expr: "bad", true: muted dash, false: ink}}
  - {kind: points, data: reproj.csv, x: um, y: vm, shape: cross, size: 4, cls_if: {expr: "bad", true: muted, false: ink}, tip: "measured feature"}
  - {kind: points, data: reproj.csv, x: "f*(c*X + sn*Z + dtx)/(-sn*X + c*Z) + cx", y: "f*Y/(-sn*X + c*Z) + cy", shape: ring, size: 4, cls: hl, tip: "predicted, residual {hypot(f*(c*X + sn*Z + dtx)/(-sn*X + c*Z) + cx - um, f*Y/(-sn*X + c*Z) + cy - vm)} px"}
  - {kind: polygon, points: [[0, 0], [640, 0], [640, 480], [0, 480]], cls: ink}
  - {kind: text, at: [334, 188], text: "bad match", anchor: end, cls: small}
readouts:
  - {label: "RMS error, all", expr: "sqrt(e2/n)", unit: px, digits: 1}
  - {label: "RMS error, good matches", expr: "sqrt(e2g/(n - 1))", unit: px, digits: 1}
  - {label: "Huber cost (k = 5 px)", expr: "hub", digits: 0}
source: "Synthetic camera with 12 features, 1 px measurement noise, one wrong match"
caption: "Move both sliders to zero to recover the true pose: the good residuals drop to about a pixel, but the bad match stays tens of pixels long. With a squared cost that one spring dominates the sum; the Huber cost grows only linearly for it (@fig:robust)."
```

### RANSAC: fit from a few, vote with the rest {#ransac}

Some matches are always wrong. RANSAC repeatedly fits a model to a minimal random sample and keeps the
model that most matches agree with. The number of samples needed to find one clean sample with
confidence $p$, at inlier ratio $w$ and sample size $s$, is

$$N = \frac{\log(1-p)}{\log\bigl(1-w^{s}\bigr)}.$$

The sample size sits in the exponent, which is why minimal solvers matter so much (@fig:ransac). At 50%
inliers, a 5-point sample needs about 145 iterations and an 8-point sample about 1,177. When the gyroscope
already gives the rotation, a 2-point sample is enough, and 16 iterations do.

```figure
id: ransac
type: line
tag: ransac
title: Each extra point in the sample multiplies the work at low inlier ratios
subtitle: Iterations needed for 99% confidence of one outlier-free sample
data: ransac.csv
x: inliers
y: iterations
series: sample
highlight: 5-point sample
ylog: true
xlabel: Inlier ratio (%)
ylabel: Iterations
height: 300
source: "Computed from the RANSAC iteration formula, p = 0.99"
caption: "The 5-point solver for the essential matrix needs about 145 iterations at 50% inliers, the 8-point solver about 1,177. A 2-point solver (rotation known from the IMU) needs 16. Hover to read values."
```

### One camera cannot measure size {#scale}

Doubling the whole scene and the camera motion produces exactly the same images. A single camera recovers
shape and motion only up to an unknown scale, so monocular systems fix it by convention (the first
translation has length 1) and then slowly drift in scale. A stereo pair with a known baseline, a depth
sensor, an IMU or a known object fixes it (@fig:scale). The handbook notes the flip side: scale freedom also
lets a monocular system move from a door handle to a street without retuning.

```figure
id: scale
type: plane
tag: scale ambiguity
title: Scale the whole scene and a moving camera sees the same pixels
subtitle: Top view; the scene and the camera motion are scaled together, the stereo baseline is not
equal: true
xrange: [-0.8, 10.6]
yrange: [-2.8, 5.2]
xlabel: '\text{depth}\ (\mathrm{m})'
params: {base: 0.6, sb: 0.3, x1: 3.0, y1: -1.2}
controls:
  - {name: k, label: Scale of the world, min: 0.5, max: 2, step: 0.01, value: 1}
legend:
  - {label: "Moving camera, two views", cls: ink, shape: ln}
  - {label: "Stereo partner, fixed 0.3 m", cls: hl, shape: ln}
marks:
  - {kind: segments, data: scale_pts.csv, x1: 0, y1: 0, x2: "k*y", y2: "k*x", cls: muted thin}
  - {kind: segments, data: scale_pts.csv, x1: 0, y1: "k*base", x2: "k*y", y2: "k*x", cls: muted thin}
  - {kind: segments, data: scale_pts.csv, x1: 0, y1: "sb", x2: "k*y", y2: "k*x", cls: hl thin}
  - {kind: points, data: scale_pts.csv, x: "k*y", y: "k*x", shape: dot, size: 3.5, cls: ink}
  - {kind: point, at: ["k*x1", "k*y1"], shape: ring, size: 6, cls: hl, label: '\mathbf{X}_1', label_off: [12, 10], label_anchor: start}
  - {kind: point, at: [0, 0], shape: square, size: 4, cls: ink, label: 'C_1', label_off: [-10, 4], label_anchor: end}
  - {kind: point, at: [0, "k*base"], shape: square, size: 4, cls: ink, label: 'C_2', label_off: [-10, 4], label_anchor: end}
  - {kind: point, at: [0, "sb"], shape: square, size: 3, cls: hl}
readouts:
  - {label: "X₁ seen from C₁", expr: "500*y1/x1 + 320", unit: px, digits: 1}
  - {label: "in C₂", expr: "500*(k*y1 - k*base)/(k*x1) + 320", unit: px, digits: 1}
  - {label: "in the stereo partner", expr: "500*(k*y1 - sb)/(k*x1) + 320", unit: px, digits: 1}
source: "Drawn from the pinhole model, f = 500 px"
caption: "Grey rays: a camera seen at two positions $C_1$ and $C_2$. Scaling the world scales the motion too, and the pixel readouts for $C_1$ and $C_2$ stay fixed. The blue rays come from a stereo partner bolted 0.3 m from $C_1$; its pixel changes with scale, which is how a known baseline fixes metric size."
```

## The pipeline, step by step {#pipeline}

A vision-only, feature-based system in the style of ORB-SLAM runs seven steps. Two run once at start-up;
the rest repeat for every frame or keyframe (@fig:pipeline).

```figure
id: pipeline
type: stack
tag: pipeline
title: The problem type changes as the system learns more about the world
cols: 4
row_height: 112
top: 26
bottom: 44
legend: false
nodes:
  - {id: s1, at: [0, 0], size: [140, 54], title: 1 · Features, sub: "detect, describe, match", tip: "FAST / ORB / BRISK / SuperPoint, or KLT tracking; grid bucketing"}
  - {id: s2, at: [1, 0], size: [140, 54], title: 2 · Bootstrap, sub: "2D–2D", style: plain, tip: "5-point E in RANSAC (and a homography for flat scenes); cheirality check; set the scale"}
  - {id: s3, at: [2, 0], size: [140, 54], title: 3 · First map, sub: "triangulation", style: plain, tip: "Linear triangulation, parallax threshold, two-view BA"}
  - {id: s4, at: [0, 1], size: [140, 54], title: 4 · Track, sub: "3D–2D (PnP)", tip: "Predict the pose, guided matching, P3P/EPnP in RANSAC, motion-only BA"}
  - {id: s5, at: [1, 1], size: [140, 54], title: 5 · Keyframes, sub: "2D–2D + triangulation", tip: "New keyframe when tracking weakens; epipolar search for new points; cull bad points"}
  - {id: s6, at: [2, 1], size: [140, 54], title: 6 · Optimise, sub: "BA or filter", tip: "Local bundle adjustment over a window, or an EKF / MSCKF"}
  - {id: s7, at: [3, 1], size: [140, 54], title: 7 · Loop closure, sub: "3D–2D or 3D–3D", tip: "Place recognition, geometric check, pose-graph optimisation"}
groups:
  - {label: Once, nodes: [s2, s3], pad: 10}
  - {label: Every frame / keyframe, nodes: [s4, s5, s6, s7], pad: 10}
wires:
  - {from: s1, to: s2}
  - {from: s2, to: s3}
  - {from: s3, to: s4, from_side: b, to_side: t, to_off: 34, mid: 132, text: first map, label_seg: 1}
  - {from: s1, to: s4, from_off: -34, to_off: -34, text: features, label_side: left}
  - {from: s4, to: s5}
  - {from: s5, to: s6}
  - {from: s6, to: s7}
  - {from: s7, to: s4, from_side: b, to_side: b, mid: 252, style: dashed, text: corrected map}
source: "Following the ORB-SLAM structure"
caption: "Steps 2 and 3 run once to create the first map; steps 4 to 7 repeat. Hover a step for its usual methods."
```

1. **Features and matching.** Detect well-spread corners (FAST, ORB, BRISK, SuperPoint), bucketed on a grid
   so they cover the whole image. Match binary descriptors by Hamming distance with Lowe's ratio test, or
   track patches with KLT optical flow.
2. **Bootstrap (2D–2D).** Wait for enough parallax, estimate $\mathbf{E}$ with the 5-point solver in RANSAC
   (ORB-SLAM also fits a homography and picks the better model), decompose it into four candidate poses, and
   keep the one that puts the points in front of both cameras. Set $\lVert\mathbf{t}\rVert = 1$. Stereo or
   RGB-D skips this step.
3. **First map.** Triangulate every inlier, drop points with too little parallax, polish with a two-view
   bundle adjustment.
4. **Track (3D–2D).** Predict the pose (constant velocity or IMU), project map points into the new image and
   search only in small windows, solve P3P or EPnP in RANSAC, then refine with motion-only bundle adjustment
   under a Huber cost. Tracking against the map, rather than frame to frame, keeps one consistent scale.
5. **Keyframes.** Save a keyframe when the tracked fraction drops (for example below 90% of the reference
   keyframe) or enough motion has passed. Triangulate new points along epipolar lines; cull points that are
   rarely re-observed.
6. **Optimise.** Refine recent poses and points together: local bundle adjustment, or a filter (@sec:backend).
7. **Loop closure.** Recognise a revisited place (DBoW2 bag of words or NetVLAD), verify it geometrically
   (PnP, or a Sim(3) alignment so scale drift is corrected too), then spread the correction with pose-graph
   optimisation (@fig:loop).

## The back end: least squares, done carefully {#backend}

### Optimising on the manifold {#manifold}

Poses are not vectors: rotations live on a curved space, and adding two rotation matrices does not give a
rotation. The standard trick is to keep the estimate as a pose $\hat{\mathbf{T}}$ and solve for a small
6-vector correction $\boldsymbol{\xi}$ in its tangent space, then apply it with the exponential map:

$$\mathbf{T} = \hat{\mathbf{T}} \oplus \boldsymbol{\xi} = \hat{\mathbf{T}}\,\mathrm{Exp}(\boldsymbol{\xi}).$$

Each Gauss–Newton step linearises the residuals in $\boldsymbol{\xi}$, solves the normal equations, applies
the correction and repeats. Gauss–Newton trusts its quadratic model fully; Levenberg–Marquardt adds a damping
term $\lambda\,\mathrm{diag}(\mathbf{A}^\top\mathbf{A})$ that shortens the step when the model is poor, and
accepts a step only if the cost drops. Neither can escape a wrong basin (@fig:gnlm).

```figure
id: gnlm
type: plane
tag: nonlinear least squares
title: Where you start decides which minimum you reach
subtitle: "Range-only localisation: three landmarks, three noisy ranges, two minima"
equal: true
xrange: [-1.5, 10.5]
yrange: [-4.5, 5]
xlabel: 'x\ (\mathrm{m})'
ylabel: 'y\ (\mathrm{m})'
params: {r1: 5.334, r2: 2.048, r3: 4.31}
controls:
  - {name: x0, label: Start x, unit: m, min: -1, max: 10, step: 0.1, value: 2.0}
  - {name: y0, label: Start y, unit: m, min: -4, max: 4.5, step: 0.1, value: -0.6}
legend:
  - {label: Levenberg–Marquardt, cls: hl, shape: ln}
  - {label: Gauss–Newton, cls: ink, shape: dash}
  - {label: Landmark, cls: ink, shape: sq}
marks:
  - {kind: field, f: "(hypot(x, y) - r1)^2 + (hypot(x - 4, y - 0.6) - r2)^2 + (hypot(x - 8, y) - r3)^2", log: true, res: 72, levels: 10}
  - {kind: curve, t: [0, 6.2832], x: "r1*cos(t)", y: "r1*sin(t)", cls: muted dash thin}
  - {kind: curve, t: [0, 6.2832], x: "4 + r2*cos(t)", y: "0.6 + r2*sin(t)", cls: muted dash thin}
  - {kind: curve, t: [0, 6.2832], x: "8 + r3*cos(t)", y: "r3*sin(t)", cls: muted dash thin}
  - {kind: solver, method: gn, as: gn, start: ["x0", "y0"], iters: 12, residuals: ["hypot(x, y) - r1", "hypot(x - 4, y - 0.6) - r2", "hypot(x - 8, y) - r3"], cls: ink dash}
  - {kind: solver, method: lm, as: lm, start: ["x0", "y0"], iters: 20, lambda: 1, residuals: ["hypot(x, y) - r1", "hypot(x - 4, y - 0.6) - r2", "hypot(x - 8, y) - r3"], cls: hl}
  - {kind: point, at: [0, 0], shape: square, size: 4, cls: ink, label: 'l_1', label_off: [0, 16]}
  - {kind: point, at: [4, 0.6], shape: square, size: 4, cls: ink, label: 'l_2', label_off: [0, 16]}
  - {kind: point, at: [8, 0], shape: square, size: 4, cls: ink, label: 'l_3', label_off: [0, 16]}
  - {kind: point, at: [4.6, 2.6], shape: cross, size: 5, cls: ink, label: '\text{true}', label_off: [12, -10], label_anchor: start}
readouts:
  - {label: "LM final cost", expr: "lm_cost", digits: 3}
  - {label: "LM steps", expr: "lm_n", digits: 0}
  - {label: "GN final cost", expr: "gn_cost", digits: 3}
source: "After the range-localisation example in Haavardsholm's handbook (Fig. 7.4–7.5)"
caption: "Darker shading means lower cost; dashed circles are the measured ranges. The landmarks are nearly in a line, so a mirror-image minimum appears below them. Start above the line and both solvers find the true position; start below and both settle confidently in the wrong one. Real systems avoid this with a good initial guess: the previous pose, the IMU, or a minimal solver."
```

Two more details matter in practice. Each residual is **whitened** by its noise, $\boldsymbol{\Sigma}^{-1/2}\mathbf{e}$,
so a precise sensor counts for more than a noisy one, and measurements are often pre-converted to normalised
image coordinates so the Jacobians do not carry $\mathbf{K}$ around.

### Robust costs: let bad matches stop pulling {#robust}

RANSAC removes most outliers, but not all. With a squared cost the pull of a residual grows with its size, so
one wrong match can drag the solution. A robust kernel caps that pull: Huber is quadratic near zero and linear
beyond a threshold, Cauchy flattens out further. Solvers implement this as iteratively reweighted least
squares, giving each residual a weight that falls as it grows (@fig:robust).

```figure
id: robust
type: line
tag: robust kernels
title: A robust cost stops large residuals from dominating the sum
data: robust.csv
x: r
series: kernel
highlight: "Huber, k = 1"
xlabel: Residual r (in units of the noise)
height: 280
views:
  - {view: Cost, y: cost, ylabel: Cost ρ(r), ymax: 8}
  - {view: Weight, y: weight, ylabel: Weight in reweighted least squares}
source: "Standard kernel definitions"
caption: "Cost view: how much each residual adds. Weight view: how strongly each residual pulls in iteratively reweighted least squares. Beyond the threshold, Huber's weight falls as $k/|r|$ and Cauchy's as $1/(1+r^2)$."
```

### Factor graphs, windows and marginalisation {#factors}

The back end is easiest to picture as a **factor graph**: variables (keyframe poses $\mathbf{x}_i$ and
landmarks $\mathbf{l}_j$) joined by factors, one per measurement. Full bundle adjustment optimises everything.
Real-time systems keep a **sliding window** of recent keyframes; older ones are not just dropped but
**marginalised** into a prior factor that keeps what they knew. An IMU adds a factor between consecutive
keyframes that summarises hundreds of samples (preintegration). A filter (EKF / MSCKF) is the extreme case: it
keeps only a mean and covariance, and past states vanish instead of folding into a prior.

```figure
id: factors
type: stack
tag: factor graph
title: A sliding window keeps the problem small without forgetting the past
cols: 6
row_height: 96
top: 22
legend: false
views:
  - view: Full bundle adjustment
    nodes: &kf
      - {id: l1, at: [0.5, 0], size: [30, 30], tex: '\mathbf{l}_1'}
      - {id: l2, at: [1.5, 0], size: [30, 30], tex: '\mathbf{l}_2'}
      - {id: l3, at: [2.5, 0], size: [30, 30], tex: '\mathbf{l}_3'}
      - {id: l4, at: [3.5, 0], size: [30, 30], tex: '\mathbf{l}_4'}
      - {id: l5, at: [4.5, 0], size: [30, 30], tex: '\mathbf{l}_5'}
      - {id: x1, kind: sum, at: [0, 1], size: [34, 34], tex: '\mathbf{x}_1'}
      - {id: x2, kind: sum, at: [1, 1], size: [34, 34], tex: '\mathbf{x}_2'}
      - {id: x3, kind: sum, at: [2, 1], size: [34, 34], tex: '\mathbf{x}_3'}
      - {id: x4, kind: sum, at: [3, 1], size: [34, 34], tex: '\mathbf{x}_4'}
      - {id: x5, kind: sum, at: [4, 1], size: [34, 34], tex: '\mathbf{x}_5'}
      - {id: x6, kind: sum, at: [5, 1], size: [34, 34], tex: '\mathbf{x}_6'}
    wires: &obs
      - {from: x1, to: l1, straight: true, arrow: false}
      - {from: x1, to: l2, straight: true, arrow: false}
      - {from: x2, to: l1, straight: true, arrow: false}
      - {from: x2, to: l2, straight: true, arrow: false}
      - {from: x2, to: l3, straight: true, arrow: false}
      - {from: x3, to: l2, straight: true, arrow: false}
      - {from: x3, to: l3, straight: true, arrow: false}
      - {from: x4, to: l3, straight: true, arrow: false}
      - {from: x4, to: l4, straight: true, arrow: false}
      - {from: x5, to: l3, straight: true, arrow: false}
      - {from: x5, to: l4, straight: true, arrow: false}
      - {from: x5, to: l5, straight: true, arrow: false}
      - {from: x6, to: l4, straight: true, arrow: false}
      - {from: x6, to: l5, straight: true, arrow: false}
    note: "Each line is one reprojection factor: keyframe xᵢ observed landmark lⱼ."
  - view: Sliding window
    nodes:
      - {id: l1, at: [0.5, 0], size: [30, 30], tex: '\mathbf{l}_1', style: muted}
      - {id: l2, at: [1.5, 0], size: [30, 30], tex: '\mathbf{l}_2', style: muted}
      - {id: l3, at: [2.5, 0], size: [30, 30], tex: '\mathbf{l}_3'}
      - {id: l4, at: [3.5, 0], size: [30, 30], tex: '\mathbf{l}_4'}
      - {id: l5, at: [4.5, 0], size: [30, 30], tex: '\mathbf{l}_5'}
      - {id: x1, kind: sum, at: [0, 1], size: [34, 34], tex: '\mathbf{x}_1', style: muted}
      - {id: x2, kind: sum, at: [1, 1], size: [34, 34], tex: '\mathbf{x}_2', style: muted}
      - {id: pr, kind: sum, at: [2, 1], dx: -46, size: [14, 14], title: " ", style: prior, tip: "Prior factor: what the marginalised keyframes and landmarks knew"}
      - {id: x3, kind: sum, at: [2, 1], size: [34, 34], tex: '\mathbf{x}_3'}
      - {id: x4, kind: sum, at: [3, 1], size: [34, 34], tex: '\mathbf{x}_4'}
      - {id: x5, kind: sum, at: [4, 1], size: [34, 34], tex: '\mathbf{x}_5'}
      - {id: x6, kind: sum, at: [5, 1], size: [34, 34], tex: '\mathbf{x}_6'}
    groups:
      - {label: Active window, nodes: [x3, x6, l3, l5], pad: 14, label_right: true}
    wires:
      - {from: pr, to: x3, straight: true, arrow: false}
      - {from: pr, to: l3, straight: true, arrow: false}
      - {from: x4, to: l3, straight: true, arrow: false}
      - {from: x4, to: l4, straight: true, arrow: false}
      - {from: x3, to: l3, straight: true, arrow: false}
      - {from: x5, to: l3, straight: true, arrow: false}
      - {from: x5, to: l4, straight: true, arrow: false}
      - {from: x5, to: l5, straight: true, arrow: false}
      - {from: x6, to: l4, straight: true, arrow: false}
      - {from: x6, to: l5, straight: true, arrow: false}
    note: "x₁, x₂, l₁ and l₂ are marginalised: the black prior factor carries their information into the window."
  - view: With IMU factors
    nodes: *kf
    wires:
      - {from: x1, to: x2, style: hl, arrow: false, sig: '\Delta\mathbf{R},\Delta\mathbf{v},\Delta\mathbf{p}', label_side: below, label_dy: 16}
      - {from: x2, to: x3, style: hl, arrow: false}
      - {from: x3, to: x4, style: hl, arrow: false}
      - {from: x4, to: x5, style: hl, arrow: false}
      - {from: x5, to: x6, style: hl, arrow: false}
      - {from: x1, to: l1, straight: true, arrow: false}
      - {from: x1, to: l2, straight: true, arrow: false}
      - {from: x2, to: l1, straight: true, arrow: false}
      - {from: x2, to: l2, straight: true, arrow: false}
      - {from: x2, to: l3, straight: true, arrow: false}
      - {from: x3, to: l2, straight: true, arrow: false}
      - {from: x3, to: l3, straight: true, arrow: false}
      - {from: x4, to: l3, straight: true, arrow: false}
      - {from: x4, to: l4, straight: true, arrow: false}
      - {from: x5, to: l3, straight: true, arrow: false}
      - {from: x5, to: l4, straight: true, arrow: false}
      - {from: x5, to: l5, straight: true, arrow: false}
      - {from: x6, to: l4, straight: true, arrow: false}
      - {from: x6, to: l5, straight: true, arrow: false}
    note: "Blue: one preintegrated IMU factor per keyframe pair, summarising all samples between them."
source: "Drawn from the standard factor-graph formulation"
caption: "Circles are keyframe poses, squares landmarks, lines factors. Switch views to see the window and marginalisation, and the IMU factors."
```

### Sparsity, and the Schur complement {#sparsity}

Each factor touches only one pose and one point, so the normal-equation matrix $\mathbf{A}^\top\mathbf{A}$ is
almost empty (@fig:sparsity). The point block is block-diagonal, because points do not see each other, and
block-diagonal matrices are cheap to invert. The **Schur complement** eliminates all points first, leaving a
small system in the poses alone; the points are then recovered one at a time. Marginalisation uses the same
operation to fold old states into a prior.

```figure
id: sparsity
type: plane
tag: ba sparsity
title: Eliminate the points first and a large problem becomes a small one
equal: true
axes: false
flip_y: true
max_width: 420
views:
  - view: Full system
    xrange: [-1, 49]
    yrange: [-4, 49]
    marks:
      - {kind: rects, data: hess.csv, x: x, y: y, w: w, h: h, cls_col: kind, tip: "{w}×{h} block"}
      - {kind: polygon, points: [[0, 0], [48, 0], [48, 48], [0, 48]], cls: ink}
      - {kind: line, from: [24, 0], to: [24, 48], cls: muted dash thin}
      - {kind: line, from: [0, 24], to: [48, 24], cls: muted dash thin}
      - {kind: text, at: [12, -2], text: "4 poses (6 each)", cls: big}
      - {kind: text, at: [36, -2], text: "8 points (3 each)", cls: big}
  - view: After the Schur complement
    xrange: [-1, 49]
    yrange: [-4, 49]
    marks:
      - {kind: rects, data: schur.csv, x: "x*2", y: "y*2", w: "w*2", h: "h*2", cls_col: kind, tip: "pose–pose block"}
      - {kind: polygon, points: [[0, 0], [48, 0], [48, 48], [0, 48]], cls: ink}
      - {kind: text, at: [24, -2], text: "4 poses only (24 × 24, drawn enlarged)", cls: big}
source: "Synthetic: 4 keyframes, 8 points, each keyframe sees 4–5 points"
caption: "Dark: pose blocks; mid: point blocks; light: a pose and a point linked by an observation. After eliminating the points, two poses are linked if they saw a common point."
```

### Gauge freedom {#gauge}

Bundle adjustment from images alone cannot decide where the world origin is, which way it faces, or (for one
camera) how big it is. Any similarity transform of all poses and points leaves every residual unchanged, so the
system has no unique solution and its Hessian is singular. The fix is to pin the gauge: hold the first pose fixed
and, for monocular, fix one distance or point. An IMU makes roll, pitch and scale observable, leaving four
free directions (position and yaw).

### Uncertainty lives on the manifold too {#banana}

Pose uncertainty is not an ellipse in $x, y$. Drive forward with an uncertain heading and the possible end
positions spread along an arc, a "banana". The handbook's point is that this banana *is* Gaussian, in the
tangent space of the pose: draw $\boldsymbol{\xi}\sim\mathcal{N}(\bar{\boldsymbol{\xi}},\boldsymbol{\Sigma})$ and map it
through $\mathrm{Exp}$ (@fig:banana). A Gaussian fitted directly in $x, y$ puts probability where no pose can be.

```figure
id: banana
type: plane
tag: pose uncertainty
title: An uncertain heading bends the spread of positions into an arc
subtitle: "160 poses from a Gaussian in the tangent space of SE(2): a 4 m step up the page from the origin, with heading error at the start"
equal: true
xrange: [-3.1, 3.1]
yrange: [1.9, 4.6]
xlabel: 'x\ (\mathrm{m})'
ylabel: 'y\ (\mathrm{m})'
params: {N: 160}
controls:
  - {name: sth, label: Heading std., unit: "°", min: 0, max: 25, step: 0.5, value: 15}
  - {name: sr, label: Distance std., unit: m, min: 0, max: 0.6, step: 0.01, value: 0.1}
sums:
  - {name: sx, data: banana.csv, expr: &bx "4*cos(rad(sth)*n3) + if(abs(rad(sth)*n3) < 0.000001, 1, sin(rad(sth)*n3)/(rad(sth)*n3))*sr*n1 - if(abs(rad(sth)*n3) < 0.000001, 0, (1 - cos(rad(sth)*n3))/(rad(sth)*n3))*0.04*n2"}
  - {name: sy, data: banana.csv, expr: &by "4*sin(rad(sth)*n3) + if(abs(rad(sth)*n3) < 0.000001, 0, (1 - cos(rad(sth)*n3))/(rad(sth)*n3))*sr*n1 + if(abs(rad(sth)*n3) < 0.000001, 1, sin(rad(sth)*n3)/(rad(sth)*n3))*0.04*n2"}
  - {name: sxx, data: banana.csv, expr: "(4*cos(rad(sth)*n3) + if(abs(rad(sth)*n3) < 0.000001, 1, sin(rad(sth)*n3)/(rad(sth)*n3))*sr*n1 - if(abs(rad(sth)*n3) < 0.000001, 0, (1 - cos(rad(sth)*n3))/(rad(sth)*n3))*0.04*n2)^2"}
  - {name: syy, data: banana.csv, expr: "(4*sin(rad(sth)*n3) + if(abs(rad(sth)*n3) < 0.000001, 0, (1 - cos(rad(sth)*n3))/(rad(sth)*n3))*sr*n1 + if(abs(rad(sth)*n3) < 0.000001, 1, sin(rad(sth)*n3)/(rad(sth)*n3))*0.04*n2)^2"}
  - {name: sxy, data: banana.csv, expr: "(4*cos(rad(sth)*n3) + if(abs(rad(sth)*n3) < 0.000001, 1, sin(rad(sth)*n3)/(rad(sth)*n3))*sr*n1 - if(abs(rad(sth)*n3) < 0.000001, 0, (1 - cos(rad(sth)*n3))/(rad(sth)*n3))*0.04*n2)*(4*sin(rad(sth)*n3) + if(abs(rad(sth)*n3) < 0.000001, 0, (1 - cos(rad(sth)*n3))/(rad(sth)*n3))*sr*n1 + if(abs(rad(sth)*n3) < 0.000001, 1, sin(rad(sth)*n3)/(rad(sth)*n3))*0.04*n2)"}
defs_banana: {neg: &byneg "-(4*sin(rad(sth)*n3) + if(abs(rad(sth)*n3) < 0.000001, 0, (1 - cos(rad(sth)*n3))/(rad(sth)*n3))*sr*n1 + if(abs(rad(sth)*n3) < 0.000001, 1, sin(rad(sth)*n3)/(rad(sth)*n3))*0.04*n2)"}
after:
  mxx: "sx/N"
  myy: "sy/N"
  cxx: "sxx/N - mxx^2"
  cyy: "syy/N - myy^2"
  cxy: "sxy/N - mxx*myy"
  l1: "(cxx + cyy)/2 + sqrt(((cxx - cyy)/2)^2 + cxy^2)"
  l2: "(cxx + cyy)/2 - sqrt(((cxx - cyy)/2)^2 + cxy^2)"
  ang: "deg(0.5*atan2(2*cxy, cxx - cyy))"
legend:
  - {label: Pose samples, cls: hl, shape: ln}
  - {label: "Gaussian fitted in x, y (2σ)", cls: ink, shape: dash}
marks:
  - {kind: curve, t: [-1.2, 1.2], x: "-4*sin(t)", y: "4*cos(t)", cls: muted dash thin}
  - {kind: poses, data: banana.csv, x: *byneg, y: *bx, th: "rad(sth)*n3 + pi/2", len: 0.16, cls: hl thin}
  - {kind: ellipse, at: ["-myy", "mxx"], rx: "2*sqrt(max(l1, 0))", ry: "2*sqrt(max(l2, 0))", angle: "ang + 90", cls: ink dash}
readouts:
  - {label: "Mean distance travelled", expr: "mxx", unit: m, digits: 2}
  - {label: "Fitted ellipse, long axis (2σ)", expr: "2*sqrt(max(l1, 0))", unit: m, digits: 2}
source: "After the banana-distribution example in Haavardsholm's handbook (Example 6.18)"
caption: "Each dot with a tick is one possible end pose and its heading. The samples follow the dashed circle of radius 4 m around the start (below the view); the ellipse a Gaussian in $x, y$ would use spills into the inside of the arc, where no pose lands. Set the heading noise to zero and the arc collapses to a short line."
```

## What an IMU changes {#imu}

An IMU is fast but drifts within seconds; vision is slower but stable. Fused tightly, each covers the other's
weak spot, and several steps get simpler:

- **Start-up:** gravity fixes roll and pitch, and a short excited motion gives metric scale, so 2D–2D
  bootstrapping is largely replaced by IMU initialisation (static or dynamic).
- **Matching:** the gyroscope gives the rotation between frames, so RANSAC needs only 2 points per sample.
- **Tracking:** IMU propagation predicts the next pose better than a constant-velocity model, so search
  windows can be smaller.
- **Back end:** preintegration turns all IMU samples between two keyframes into one factor
  (@fig:factors, third view).

## Implementation tricks in one table {#tricks}

| Trick | What it fixes | Where |
|---|---|---|
| Grid bucketing of features | Clustered features give a badly conditioned pose | Front end |
| Lowe's ratio test, mutual best match | Ambiguous matches on repeated texture | Matching |
| Minimal solvers inside RANSAC | Outliers; iteration count grows as $w^{-s}$ | 2D–2D, 3D–2D, 3D–3D |
| Cheirality check | Four solutions from decomposing $\mathbf{E}$ | Bootstrap |
| Parallax threshold (about 1–2°) | Points with near-parallel rays have huge depth error | Triangulation |
| Guided matching from a predicted pose | Slow, error-prone global matching | Tracking |
| Normalised image coordinates | Simpler Jacobians, distortion handled once | Everywhere |
| Whitening by $\boldsymbol{\Sigma}^{-1/2}$ | Mixing sensors and measurements of different quality | Back end |
| Perturbations $\hat{\mathbf{T}} \oplus \boldsymbol{\xi}$ on the manifold | Rotations are not vectors | Back end |
| Inverse depth $1/z$ | Far points, non-Gaussian depth error | Map points, direct methods |
| Huber or Cauchy kernel | Outliers that survive RANSAC | Back end |
| Levenberg–Marquardt damping | Gauss–Newton overshooting on poor linearisations | Back end |
| Schur complement | Solving for thousands of points at once | Bundle adjustment |
| Keyframes and a sliding window | Cost growing with every frame | Back end |
| Marginalisation into a prior | Losing information when dropping old states | Sliding window |
| First-estimate Jacobians (FEJ) | A filter becoming overconfident in unobservable directions | Filters (MSCKF) |
| Gauge fixing | Singular Hessian from free origin and scale | Bundle adjustment |
| Sim(3) for monocular loop closure | Scale drift | Loop closure |

## Direct or indirect, sparse or dense {#direct}

The pipeline above is *sparse and indirect*: it extracts features and minimises a geometric (pixel) error.
The handbook places it in a wider map. **Direct** methods skip features and minimise a photometric error
on image intensities, which copes better with blur and low texture but suffers under lighting changes.
**Dense** methods reconstruct every pixel, usually assuming the surface is locally smooth, which makes joint
real-time optimisation hard.

| | Sparse | Dense |
|---|---|---|
| **Indirect (features)** | PTAM, ORB-SLAM | — |
| **Direct (intensities)** | DSO | DTAM, LSD-SLAM (semi-dense) |

SVO is a hybrid: it aligns directly, then optimises with an indirect error.

## Two visual-inertial systems compared {#systems}

OKVIS and OpenVINS use the same geometry and differ at the back end. OKVIS solves a keyframe sliding-window
least-squares problem and tracks with explicit 3D–2D matching; OpenVINS runs an MSCKF filter in which the IMU
predicts the pose and feature tracks only correct it, so it never solves PnP for tracking.

| Step | OKVIS / OKVIS2 (optimisation) | OpenVINS (filter, MSCKF) |
|---|---|---|
| Estimator | Keyframe sliding-window nonlinear least squares (Ceres) | Sliding-window EKF (MSCKF) on the manifold |
| Features | BRISK keypoints and descriptors | FAST + KLT tracking, or ORB matching |
| Start-up | Stereo triangulation; IMU fixes gravity | Static or dynamic initialiser |
| Tracking | 3D–2D: IMU-guided matching with P3P RANSAC | No PnP: IMU predicts, vision corrects |
| Points | Part of the state, refined in every solve | Triangulated per track, used, then discarded |
| Back end | Reprojection + IMU residuals; Schur marginalisation | Residuals projected onto the left nullspace; old clones marginalised |
| Outliers | RANSAC + robust (Cauchy) cost | RANSAC + chi-squared gating |
| Loop closure | OKVIS2: DBoW2, 3D–2D check, pose graph | Not in the core estimator |

## Appendix: solver cheat sheet {#cheatsheet .collapsed}

| Problem | Solver | Min. points | Output | Libraries |
|---|---|---|---|---|
| 2D–2D | 5-point (Nistér) | 5 | $\mathbf{E}$ → $\mathbf{R}$, $\mathbf{t}$ direction | OpenCV `findEssentialMat`, OpenGV |
| 2D–2D | 8-point (normalised) | 8 | $\mathbf{F}$ or $\mathbf{E}$ | OpenCV `findFundamentalMat` |
| 2D–2D | Homography (DLT) | 4 | $\mathbf{H}$ → $\mathbf{R}$, $\mathbf{t}$, plane | OpenCV `findHomography` |
| 2D–2D, known rotation | 2-point | 2 | $\mathbf{t}$ direction | OpenGV |
| Triangulation | Linear DLT / midpoint / optimal | 2 views | 3D point | OpenCV `triangulatePoints` |
| 3D–2D | P3P (Kneip, Gao) | 3 (+1) | 6-DoF pose | OpenCV `solvePnPRansac`, OpenGV |
| 3D–2D | EPnP | 4 | 6-DoF pose | OpenCV `SOLVEPNP_EPNP` |
| 3D–2D | Motion-only BA (LM) | many | Refined pose | Ceres, g2o, OpenCV `solvePnPRefineLM` |
| 3D–3D | Horn / Umeyama | 3 | $\mathbf{R}$, $\mathbf{t}$ (and scale) | Eigen `umeyama`, Open3D |
| 3D–3D, dense | ICP | many | $\mathbf{R}$, $\mathbf{t}$ | Open3D, PCL |
| Back end | Bundle adjustment (GN / LM) | — | Poses + points | Ceres, g2o, GTSAM |
| Back end | EKF / MSCKF | — | Mean + covariance | OpenVINS |
| Loop closure | Bag of words, then pose graph | — | Corrected trajectory | DBoW2, g2o, GTSAM |

Sources: T. V. Haavardsholm, *A handbook in Visual SLAM*, v0.2.2 (2025); the presentation script
*vSLAM geometry from 2D-2D to PnP* (2026). OKVIS and OpenVINS details follow that script and should be checked
against the OKVIS2 and OpenVINS papers.
