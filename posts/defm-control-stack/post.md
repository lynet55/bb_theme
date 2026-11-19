---
title: "DeFM as a control stack: from a depth image to joint commands"
date: November 2026
summary: >
  A drawing of the control stacks in *DeFM: Learning Foundation Representations from Depth for Robotics*
  (Patel et al., arXiv:2601.18923), with every signal named and every tensor shape written on its wire.
  Shapes the paper states are upright; shapes worked out from them are marked †; typical values the
  paper does not give are marked ‡.
findings:
  - "The whole perception side is one fixed function: a 64×40 depth image becomes three log-scaled channels and passes through a frozen encoder (@sec:nav)."
  - "Only the small policy after the encoder is trained with RL: cross-attention, a recurrent unit and an MLP (@sec:nav)."
  - "The same pattern (depth, normalise, pretrained encoder, recurrent policy) repeats for grasping and ladder climbing (@sec:tasks)."
  - "Most interface sizes between blocks are not stated in the paper; the drawings say so instead of guessing (@sec:gaps)."
---

## The input {#input}

### Depth is turned into three channels {#channels}

DeFM takes one depth image $D$ in metres and builds three channels from $\log(1 + D)$. The first is
stretched to the nearest and farthest pixel of that image, so it only carries relative shape. The other two
divide by fixed scales, $\log(1+10)$ and $\log(1+100)$, so they keep metric distance at room scale and at
outdoor scale (@fig:norm).

```figure
id: norm
type: line
tag: input normalisation
title: Two channels keep metric depth, one keeps only the shape of the scene
subtitle: Channel value against depth, for an example image that spans 0.5 m to 20 m
data: norm.csv
x: depth
y: value
series: channel
highlight: C2 (10 m scale)
xlog: true
xlabel: Depth D (m)
ylabel: Channel value
height: 300
source: "Computed from the formulas in Sec. IV-C of the paper"
caption: "$C_1 = (\\ell(D) - \\ell(D_{min})) / (\\ell(D_{max}) - \\ell(D_{min}))$, $C_2 = \\ell(D)/\\ell(10)$ and $C_3 = \\ell(D)/\\ell(100)$ with $\\ell(D) = \\log(1 + D)$. $C_2$ reaches 1 at 10 m and $C_3$ at 100 m. Hover to read values."
```

### Shapes shrink as the encoder strides {#shapes}

@fig:shapes draws each tensor as a slab whose grid shows its size: the front face is height by width and
the thickness grows with the number of channels. The first view follows the small encoder used on the
navigation robot. The second follows the large teacher model at its training resolution.

```figure
id: shapes
type: stack
tag: tensor shapes
title: A 64×40 depth image is down to a handful of cells by stride 32
cols: 5
row_height: 168
top: 34
views:
  - view: Navigation encoder
    nodes:
      - {id: d, kind: tensor, at: [0, 0], dims: [1, 40, 64], sig: 'D_t', sub: depth in metres, tip: "Depth image from the front camera, downsampled to 64×40 (stated)"}
      - {id: x, kind: tensor, at: [1, 0], dims: [3, 40, 64], sig: 'X_t', sub: log channels, tip: "Three log-depth channels, then dataset mean/std (stated)"}
      - {id: f8, kind: tensor, at: [2, 0], dims: [64, 5, 8], sig: 'F^{(8)}_t', basis: derived, sub: stride 8, tip: "40/8 × 64/8 cells; 64 channels is the RegNetX-400MF stage width"}
      - {id: f16, kind: tensor, at: [3, 0], dims: [160, 3, 4], sig: 'F^{(16)}_t', basis: derived, sub: stride 16, tip: "Rounded up from 2.5 × 4; 160 channels is the RegNetX-400MF stage width"}
      - {id: f32, kind: tensor, at: [4, 0], dims: [384, 2, 2], sig: 'F^{(32)}_t', basis: derived, sub: stride 32, tip: "384 channels is the RegNetX-400MF stage width"}
    wires:
      - {from: d, to: x, text: normalise}
      - {from: x, to: f8, text: stages 1–2}
      - {from: f8, to: f16, text: stage 3}
      - {from: f16, to: f32, text: stage 4}
    note: "† worked out from the stated 64×40 input and the standard RegNetX-400MF layout (stage widths 32, 64, 160, 384). The paper does not print these sizes."
  - view: DeFM-L/14 teacher
    nodes:
      - {id: d, kind: tensor, at: [0, 0], dims: [1, 224, 224], sig: 'D', sub: global crop, tip: "Global crops are 224×224 during pretraining (stated)"}
      - {id: x, kind: tensor, at: [1, 0], dims: [3, 224, 224], sig: 'X', sub: log channels}
      - {id: p, kind: tensor, at: [2.5, 0], dims: [1024, 16, 16], sig: 'Z_{patch}', basis: derived, sub: patch tokens, tip: "224/14 = 16 patches a side (stated); width 1024 is the standard ViT-L size"}
      - {id: c, kind: tensor, at: [4, 0], dims: [1024, 1, 1], shape: "1024", sig: 'z_{cls}', basis: derived, sub: class token, tip: "One global token; width 1024 is the standard ViT-L size"}
    wires:
      - {from: d, to: x, text: normalise}
      - {from: x, to: p, text: "ViT-L, patch 14", note: "304 M parameters"}
      - {from: p, to: c, text: "+ CLS"}
    note: "† the 16×16 patch grid is stated; the token width 1024 is the standard ViT-L value, not printed in the paper."
source: "Sizes from Sec. IV and VI-A of the paper; † derived"
caption: "Tensors as wire-grid slabs, written channels × height × width. Grid lines are capped at eight a side, so large tensors show a coarser grid than they have. Switch views to compare the on-robot encoder with the pretraining teacher."
```

## The navigation stack {#nav}

The most complete stack in the paper is point-goal navigation on a Unitree B2W wheeled-legged robot
(@fig:stack, first view). Read it from the top left: the camera image is normalised and encoded by a
frozen DeFM network, then a small policy fuses those features with the goal and the robot's own state
and outputs a velocity command. A separate low-level locomotion policy turns that command into motion.

```figure
id: stack
type: stack
tag: control stack
title: Perception comes pretrained; only a small policy is trained for each task
cols: 3
row_height: 104
legend: {learned: "Trained for the task", frozen: "DeFM, pretrained", plant: "Robot and low-level control", dashed: "Measurement or supervision"}
views:
  - view: Navigation
    nodes:
      - {id: cam, kind: io, at: [0, 0], title: Depth camera, sub: front-facing, tip: "One front-facing depth camera on the Unitree B2W"}
      - {id: norm, at: [1, 0], title: Log-depth channels, sub: "C₁ C₂ C₃, mean/std", style: plain, tip: "Fixed transform, no weights: three log-scaled channels, then dataset mean and std"}
      - {id: enc, at: [2, 0], title: RegNetX-400MF, sub: DeFM distilled, style: frozen, tip: "Compact CNN distilled from DeFM-L/14; frozen during RL"}
      - {id: goal, kind: io, at: [0, 1], title: Point goal, tip: "Target position for the robot; size not stated"}
      - {id: xattn, at: [1, 1], title: Cross-attention, sub: fuses state + image, style: learned, tip: "Proprioception and goal attend to the image features"}
      - {id: fpn, at: [2, 1], title: Feature pyramid, sub: FPN, style: frozen, tip: "Feature Pyramid Network on the encoder stages; frozen with the encoder"}
      - {id: prop, kind: io, at: [0, 2], title: Proprioception, tip: "The robot's own measured state; contents and size not stated"}
      - {id: sru, at: [1, 2], title: SRU, sub: recurrent memory, style: learned, tip: "Spatially-enhanced Recurrent Unit: carries memory between steps"}
      - {id: mlp, at: [1, 3], title: MLP head, sub: a few layers, style: learned, tip: "Maps the recurrent state to a velocity command"}
      - {id: loco, at: [1, 4], title: Locomotion policy, sub: low-level, style: plant, tip: "Separate low-level policy that tracks the velocity command"}
      - {id: robot, at: [0, 4], title: Unitree B2W, sub: wheeled-legged, style: plant, tip: "Four legs with wheels: 12 leg joints and 4 wheels"}
      - {id: info, kind: note, at: [2, 3], dy: 18, text: "Evaluation: Gazebo, three unseen|environments, 100 start–goal pairs|each, 10–80 m, 120 s timeout.|Policy and control rates: n.s."}
    groups:
      - {label: DeFM · frozen, nodes: [enc, fpn]}
      - {label: Policy · RL-trained, nodes: [xattn, sru, mlp], pad: 10}
    wires:
      - {from: cam, to: norm, sig: 'D_t', shape: "1×40×64", note: metres, name: Depth image}
      - {from: norm, to: enc, sig: 'X_t', shape: "3×40×64", name: Normalised input}
      - {from: enc, to: fpn, sig: 'F^{(s)}_t', shape: "5×8 3×4 2×2", basis: derived, sig_dx: 30, tip: "Feature maps at strides 8, 16, 32: 64×5×8, 160×3×4, 384×2×2 (derived, see Fig. 2)"}
      - {from: fpn, to: xattn, sig: 'P_t', shape: "n.s.", name: Pyramid features}
      - {from: goal, to: xattn, sig: 'g_t', shape: "n.s.", from_off: -14, to_off: -14, name: Goal}
      - {from: prop, to: xattn, sig: 'p_t', shape: "n.s.", to_side: l, to_off: 14, mid: 218, label_side: left, name: Proprioception}
      - {from: xattn, to: sru, sig: 'c_t', shape: "n.s.", name: Fused features}
      - {from: sru, to: mlp, sig: 'h_t', shape: "n.s.", name: Recurrent state}
      - {from: mlp, to: loco, sig: 'v^{cmd}_t', shape: "(vx, vy, ω)", basis: assumed, sig_dx: 26, label_pos: 0.66, name: Velocity command, style: hl}
      - {from: loco, to: robot, sig: 'q^{\star}_t', shape: "16 joints", basis: assumed, name: Joint commands}
      - {from: robot, to: prop, text: measured, style: dashed, tip: "The robot's measured state closes the loop"}
      - {from: robot, to: cam, from_side: l, to_side: l, mid: 16, style: dashed, text: the scene moves past the camera, rotate: true, tip: "Moving the robot changes what the camera sees"}
    note: "† worked out from the stated input size and the standard RegNetX-400MF layout · ‡ typical for this robot, not stated in the paper · n.s. not stated in the paper"
  - view: Grasping
    row_height: 112
    nodes:
      - {id: cam, kind: io, at: [0, 0], title: Depth camera, tip: "The student policy sees depth instead of stereo RGB"}
      - {id: norm, at: [1, 0], title: Log-depth channels, sub: "C₁ C₂ C₃, mean/std", style: plain}
      - {id: enc, at: [2, 0], title: ResNet-18, sub: DeFM distilled, style: frozen, tip: "Evaluated both frozen and fine-tuned"}
      - {id: prop, kind: io, at: [0, 1], title: Proprioception}
      - {id: pol, at: [1, 1], title: LSTM + MLP, sub: student policy, style: learned, tip: "Trained by distillation from the teacher"}
      - {id: robot, at: [1, 2], title: KUKA + Allegro, sub: arm and hand, style: plant, tip: "7-joint arm with a 16-joint hand"}
      - {id: teach, at: [2, 2], title: Teacher policy, sub: state-based RL, style: plain, tip: "Trained first with privileged state, then distilled into the student"}
      - {id: priv, kind: io, at: [2, 3], title: Object state, sub: + one-hot object ID, tip: "Privileged information only the teacher sees"}
    groups:
      - {label: DeFM · frozen or fine-tuned, nodes: [enc]}
    wires:
      - {from: cam, to: norm, sig: 'D_t', shape: "n.s.", name: Depth image}
      - {from: norm, to: enc, sig: 'X_t', shape: "3×H×W", name: Normalised input}
      - {from: enc, to: pol, sig: 'z_t', shape: "n.s.", from_side: b, to_side: r, to_off: -15, label_seg: 1, name: Image features}
      - {from: prop, to: pol, sig: 'p_t', shape: "n.s.", name: Proprioception}
      - {from: pol, to: robot, sig: 'a_t', shape: "23 joints", basis: assumed, sig_dx: 18, name: Action, style: hl}
      - {from: teach, to: pol, from_side: t, to_side: r, to_off: 15, style: dashed, text: distillation target, label_seg: 0, label_side: left, tip: "The student is trained to match the teacher's actions"}
      - {from: priv, to: teach, sig: 's_t', shape: "n.s.", name: Privileged state}
      - {from: robot, to: prop, from_side: l, to_side: b, style: dashed, text: measured, label_seg: 1, tip: "The robot's measured state closes the loop"}
    note: "‡ 7 arm joints plus 16 hand joints, not stated in the paper · n.s. not stated in the paper · Isaac Lab, 8 GPUs × 256 environments"
  - view: Ladder climbing
    row_height: 112
    nodes:
      - {id: cam, kind: io, at: [0, 0], title: 4 depth cameras, tip: "Four depth cameras on the ANYmal quadruped; resolution not stated"}
      - {id: norm, at: [1, 0], title: Log-depth channels, sub: "C₁ C₂ C₃, mean/std", style: plain}
      - {id: enc, at: [2, 0], title: RegNetX-400MF, sub: DeFM distilled, style: frozen}
      - {id: prop, kind: io, at: [0, 1], title: Proprioception}
      - {id: pol, at: [1, 1], title: RNN policy, sub: student, style: learned, tip: "Recurrent policy trained by teacher–student distillation"}
      - {id: robot, at: [1, 2], title: ANYmal, sub: quadruped, style: plant, tip: "Four legs, three joints each"}
      - {id: teach, at: [2, 2], title: Teacher policy, sub: privileged, style: plain}
    groups:
      - {label: DeFM · frozen, nodes: [enc]}
    wires:
      - {from: cam, to: norm, sig: 'D^{1..4}_t', shape: "4 × n.s.", name: Depth images}
      - {from: norm, to: enc, sig: 'X^{1..4}_t', shape: "3×H×W", name: Normalised input}
      - {from: enc, to: pol, sig: 'z_t', shape: "n.s.", from_side: b, to_side: r, to_off: -15, label_seg: 1, name: Image features}
      - {from: prop, to: pol, sig: 'p_t', shape: "n.s.", name: Proprioception}
      - {from: pol, to: robot, sig: 'a_t', shape: "12 joints", basis: assumed, sig_dx: 18, name: Action, style: hl}
      - {from: teach, to: pol, from_side: t, to_side: r, to_off: 15, style: dashed, text: distillation target, label_seg: 0, label_side: left}
      - {from: robot, to: prop, from_side: l, to_side: b, style: dashed, text: measured, label_seg: 1}
    note: "‡ three joints on each of four legs, not stated in the paper · n.s. not stated in the paper · IsaacGym, 1,024 environments"
source: "Drawn from Sec. VI of arXiv:2601.18923"
caption: "Each wire carries a named signal and, underneath, its shape. Blocks with a blue spine are trained for the task, hatched spines are DeFM networks pretrained on depth, dotted spines are the robot and its low-level control. Hover a block or wire for detail; switch views for the other two tasks."
```

### The same pattern in the other two tasks {#tasks}

The other views of @fig:stack show dexterous grasping with a KUKA arm and Allegro hand, and ladder
climbing with an ANYmal quadruped. Both keep the first row unchanged and swap what follows:

- **Grasping** uses a ResNet-18 distilled from DeFM and an LSTM with an MLP. A teacher trained on
  privileged object state supervises the depth-based student.
- **Ladder climbing** uses four depth cameras, the same frozen RegNetX-400MF as navigation, and a
  recurrent policy, again trained by teacher–student distillation.

## What it buys {#results}

@fig:results gives the reported results for each stack, comparing DeFM with other ways of pretraining
the same encoder.

```figure
id: results
type: vbar
tag: reported results
title: DeFM is the best frozen encoder in all three tasks
series: model
facet: panel
y: value
ylabel_column: ylabel
highlight: DeFM
height: 220
views:
  - view: Navigation
    data: nav.csv
    columns: 4
    share_y: true
    ymax: 100
  - view: Grasping
    data: grasp.csv
    columns: 4
    share_y: true
    ymax: 1
  - view: Ladder climbing
    type: bar
    data: ladder.csv
    label: model
    value: value
    unit: "%"
    highlight: DeFM
source: "Tables in Sec. VI of arXiv:2601.18923"
caption: "Navigation: success rate over 100 start–goal pairs per environment. Grasping: success relative to the teacher over 2,000 episodes; a from-scratch encoder (not shown) scores 0.78 and 0.72 in the fine-tuned columns. Ladder climbing: climb success; here an encoder trained from scratch is marginally ahead of DeFM. Hover a bar for its value."
```

## What the paper leaves out {#gaps}

Drawing the stack with shapes on every wire shows which interfaces the paper pins down:

- **Stated:** the 64×40 policy input, the three-channel normalisation, the encoder family for each task,
  the order of the navigation policy blocks, and the 224×224 crops and 16×16 patch grid of the teacher.
- **Derived here (†):** feature-map sizes at strides 8, 16 and 32, from the input size and the standard
  RegNetX-400MF layout.
- **Typical, not stated (‡):** the action sizes, taken from the robots' joint counts and the usual
  three-number velocity command.
- **Not stated (n.s.):** the size of the proprioception and goal vectors, the width of the fused features
  and recurrent state, and the policy and control rates.
