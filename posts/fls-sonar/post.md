---
title: "Forward-looking sonar: sixteen rays and a range vector"
date: November 2026
summary: >
  How the simulated forward-looking sonar turns the vehicle's pose and the obstacles around it into
  a 16-number observation, and where that model reports something other than the nearest obstacle.
findings:
  - "Each beam returns the distance to the first surface it meets, clipped to the sensor's range (@fig:fls)."
  - "Anything closer than r_min is reported as r_max, so an obstacle inside the blind zone reads as open water (@fig:fls)."
  - "The beams lie in the body plane, so pitching or rolling the vehicle tilts them into the seabed (@fig:fls)."
---

## The beams {#beams}

The forward-looking sonar is modelled as $N = 16$ beams with fixed angles

$$\beta_j = -\frac{\alpha}{2} + (j-1)\frac{\alpha}{N-1}, \qquad j = 1, \dots, N,$$

spread uniformly over the field of view $\alpha = 180^\circ$ in the body $x_b y_b$-plane, which puts the
beams $12^\circ$ apart (@fig:beams). Each beam has the direction
$\mathbf{d}^b_j = [\cos\beta_j,\, \sin\beta_j,\, 0]^\top$ in $\{b\}$, which is rotated into the NED frame
by the vehicle's attitude, $\mathbf{d}^n_j = \mathbf{R}^n_b(\boldsymbol{\Theta})\,\mathbf{d}^b_j$.

```figure
id: beams
type: plane
tag: beam geometry
title: Sixteen beams, 12° apart, cover the half-plane ahead of the vehicle
equal: true
axes: false
xrange: [-1.45, 1.45]
yrange: [-0.32, 1.38]
max_width: 520
marks:
  - {kind: segments, data: beams.csv, x1: 0, y1: 0, x2: "sin(rad(beta))", y2: "cos(rad(beta))", cls_if: {expr: ex, true: hl thick, false: muted}, tip: "beam {j}: β = {beta}°"}
  - {kind: points, data: beams.csv, x: "sin(rad(beta))", y: "cos(rad(beta))", shape: dot, size: 2.4, cls_if: {expr: ex, true: hl, false: ink}, tip: "beam {j}: β = {beta}°"}
  - {kind: curve, t: [-1.5708, 1.5708], x: "1.12*sin(t)", y: "1.12*cos(t)", cls: ink thin, arrow: true}
  - {kind: text, at: [-0.86, 0.98], tex: '\alpha = 180^\circ'}
  - {kind: curve, t: [0, 0.5236], x: "0.42*sin(t)", y: "0.42*cos(t)", cls: hl, arrow: true}
  - {kind: text, at: [0.15, 0.56], tex: '\beta_j', cls: hl}
  - {kind: line, from: [0, 0], to: [0, 1.3], cls: ink, arrow: true, label: 'x_b', label_pos: 1, label_off: [14, 0], label_anchor: start}
  - {kind: line, from: [0, 0], to: [1.38, 0], cls: ink, arrow: true, label: 'y_b', label_pos: 1, label_off: [0, 14]}
  - {kind: text, at: [0.62, 0.96], tex: '\mathbf{d}^b_j', cls: hl}
  - {kind: text, at: [-1.12, -0.1], tex: '\beta_1 = -90^\circ'}
  - {kind: text, at: [1.12, -0.1], tex: '\beta_{16} = 90^\circ'}
  - {kind: point, at: [0, 0], shape: square, size: 4.5, cls: ink, label: 'o_b', label_off: [-12, 14], label_anchor: end}
source: "Drawn from the beam equation, N = 16, α = 180°"
caption: "Beams in the body frame, seen from above with $x_b$ forward. The highlighted beam is $j = 11$, at $\\beta_{11} = 30^\\circ$. Hover a beam for its angle."
```

## Ranges {#ranges}

The measured range of beam $j$ is the distance to the first intersection of the ray with the set of
obstacle surfaces $\mathcal{O}$:

$$\begin{aligned}
d_j &= \min \left\{ s > 0 \;:\; \mathbf{p}^n + s\,\mathbf{d}^n_j \in \mathcal{O} \right\}, \\
r_j &= \begin{cases} d_j, & r_{\min} \le d_j \le r_{\max}, \\ r_{\max}, & \text{otherwise}, \end{cases}
\end{aligned}$$

where $\mathbf{p}^n$ is the vehicle position, $r_{\max} = 10$ m is the maximum range and
$r_{\min} = 0.2$ m models the sensor's blind zone. The sonar observation is the range vector
$\mathbf{r} = [r_1, \dots, r_N]^\top \in \mathbb{R}^N$ (@fig:fls).

```figure
id: fls
type: plane
tag: fls simulation
title: The range vector is what the policy sees of the scene
subtitle: Top view in NED (north up, east right) with three pillars, a quay wall and a seabed at 6 m depth
equal: true
xrange: [-12.5, 32]
yrange: [-8, 12.5]
width: 900
xlabel: 'y^n\ \text{(east, m)}'
ylabel: 'x^n\ \text{(north, m)}'
xticks: 6
axis_xmax: 12.5
controls:
  - {name: pn, label: "North xⁿ", unit: m, min: -6, max: 6, step: 0.1, value: -2}
  - {name: pe, label: "East yⁿ", unit: m, min: -9, max: 9, step: 0.1, value: 0.5}
  - {name: pd, label: "Depth zⁿ", unit: m, min: 0.5, max: 5.8, step: 0.1, value: 3}
  - {name: psi, label: "Yaw ψ", unit: "°", min: -180, max: 180, step: 1, value: 20}
  - {name: theta, label: "Pitch θ", unit: "°", min: -40, max: 40, step: 1, value: 0}
  - {name: phi, label: "Roll φ", unit: "°", min: -40, max: 40, step: 1, value: 0}
legend:
  - {label: Return from an obstacle, cls: hl, shape: dot}
  - {label: Return from the seabed, cls: ink, shape: dot}
  - {label: "No return (r = r_max)", cls: cx, shape: dash}
  - {label: "Inside the blind zone (r = r_max)", cls: s2, shape: sq}
marks:
  - kind: rays
    as: r
    n: 16
    fov: 180
    rmin: 0.2
    rmax: 10
    at: ["pn", "pe", "pd"]
    att: ["phi", "theta", "psi"]
    size: 0.7
    obstacles:
      - {circle: [4.0, -3.0, 0.8]}
      - {circle: [5.5, 4.5, 1.3]}
      - {circle: [0.5, 6.0, 0.6]}
      - {segment: [10.0, -12.0, 10.0, 3.0]}
      - {floor: 6.0}
  - {kind: rangebars, from: r, at: [16.5, -3.5], w: 14.5, h: 11, label: '\mathbf{r}\in\mathbb{R}^{16}\ \ \text{(beams } j = 1 \dots 16)'}
  - {kind: text, at: [23.75, 9.0], text: "range vector, live"}
readouts:
  - {label: "Obstacle returns", expr: "r_hits", digits: 0}
  - {label: "Seabed returns", expr: "r_floor", digits: 0}
  - {label: "Blind-zone hits", expr: "r_blind", digits: 0}
  - {label: "Nearest return", expr: "r_min", unit: m, digits: 2}
source: "Ray casting in the browser with the equations above; MarineGym does the same with PhysX ray casts"
caption: "Each beam is drawn as its horizontal projection, dashed out to $r_{\\max}$ and solid up to its return. Bars on the right are $\\mathbf{r}$ in beam order, from $\\beta_1 = -90^\\circ$ (port) to $\\beta_{16} = 90^\\circ$ (starboard). Try three things: steer a pillar into the dashed $r_{\\min}$ circle and its beam jumps to $r_{\\max}$; pitch the nose down and the forward beams hit the seabed; roll and one side follows. Hover a beam or bar for its value."
```

The ray intersections are computed with the ray-casting functionality of the PhysX engine in MarineGym,
following the ray-based approach commonly used in real-time sonar simulation
(DeMarco et al., 2015; Choi et al., 2021).

## What the model leaves out {#limits}

The model returns one range per beam: the first surface along an infinitely thin ray. A real
forward-looking sonar returns echo intensity over range and bearing, so the simulation leaves out
beam width, so a thin obstacle between two beams is missed; acoustic noise and multipath; and the
angle-dependent strength of the echo. The rule that a hit closer than $r_{\min}$ reads as $r_{\max}$
also means the policy cannot tell "very close" from "nothing there" on that beam.
