---
title: "Underwater navigation stack: depth, sonar and a recurrent policy"
date: November 2026
summary: >
  The full actor–critic stack for the underwater navigation policy, from the simulated sensors to the
  thrusters and back through the reward into recurrent PPO. Every wire carries its signal and size.
---

## The stack {#stack}

@fig:auv reads top to bottom. The depth image goes through a frozen DeFM encoder; the sonar and the
navigation sensors are reduced to a 30-number state. A cross-attention module lets the state pick out what
matters in the image, an LSTM-SRU carries memory between decisions, and an MLP outputs four velocity
commands. The critic on the right sees privileged true values and is only used in training.

```figure
id: auv
type: stack
tag: control stack
title: A frozen depth encoder and 30 state numbers become four velocity commands
subtitle: Actor, critic and training loop, with the size of every signal
width: 900
cols: 3
row_height: 124
legend: {learned: "Trained with PPO", frozen: "DeFM, pretrained and frozen", plant: "Vehicle and low-level control", dashed: "Feedback or training update"}
nodes:
  - {id: cam, kind: io, at: [0, 0], size: [170, 54], title: Depth camera, sub: "90° FOV, upright|walls + goal hidden"}
  - {id: nav, kind: io, at: [1, 0], size: [190, 54], title: Nav sensors, sub: "IMU, pressure, DVL|+ noise"}
  - {id: sonar, kind: io, at: [2, 0], size: [170, 54], title: Sonar, sub: "64 rays, 360°, max 12 m"}
  - {id: prep, at: [0, 1], size: [170, 54], title: Planar depth, sub: "range → depth, resize", style: plain}
  - {id: base, at: [1, 1], size: [200, 70], title: Base state, sub: "goal /10 m 3 · sin, cos yaw 2|u, v, w 3 · yaw rate 1|depth 1 · roll, pitch 2", style: plain}
  - {id: sect, at: [2, 1], size: [190, 70], title: Sector features, sub: "16 sector minima /12 m|front min ±30°|front TTC risk", style: plain}
  - {id: enc, at: [0, 2], size: [190, 62], title: EfficientNet-B0 + BiFPN, sub: "DeFM, encoder only|level P4, 1/16 scale", style: frozen}
  - {id: cat1, at: [1, 2], size: [84, 30], title: concat, style: plain}
  - {id: fuse, at: [0, 3], size: [236, 84], title: Cross-attention fuse, sub: "4 heads · 48 tokens × 64 + 3D pos-enc|LayerNorm → self-attn → LayerNorm|→ FFN 64→128→64|query = MLP(state 30→128→64)", style: learned}
  - {id: obs, kind: note, at: [2, 2], dy: 44, text: "Actor observation: B × 3102|= state 30 + P4 map 3072"}
  - {id: cat2, at: [1, 4], size: [84, 30], title: concat, style: plain}
  - {id: lstm, at: [1, 5], size: [170, 54], title: LSTM-SRU memory, sub: "94 → 256", style: learned}
  - {id: hid, kind: note, at: [2, 5], text: "hidden (h, c): 2 × (1 layer, B, 256)|carried over decisions,|zeroed on reset"}
  - {id: head, at: [1, 6], size: [190, 62], title: Dropout + MLP head, sub: "LinearConstDropout 256→256, ELU|MLP 256→256→256→4, ELU", style: learned}
  - {id: drop, kind: note, at: [2, 6], dy: -6, text: "dropout p 0.2, one mask per rollout,|off in eval · log_std 4 (learned)"}
  - {id: samp, at: [1, 7], size: [190, 62], title: Sample + tanh, sub: "train: a ~ N(μ, σ) → tanh|eval: tanh(μ)", style: plain}
  - {id: lim, at: [1, 8], size: [190, 62], title: Scale by limits, sub: "u 0.45, v 0.30, w 0.25 m/s|r 0.5 rad/s", style: plain}
  - {id: ctrl, at: [1, 9], size: [170, 54], title: Velocity controller, sub: simple_block_4d, style: plant}
  - {id: env, at: [0, 9], size: [170, 54], title: Thrusters + physics, sub: "8 × 0.02 s per decision", style: plant}
  - {id: rew, at: [0, 10], size: [224, 70], title: Reward + done, sub: "progress, depth, success, penalties|done: success, collision, TTC,|out of tank, 750 decisions", style: plain}
  - {id: roll, at: [1, 10], size: [170, 54], title: Rollout buffer, sub: "16 envs × 64 decisions|+ hidden states", style: plain}
  - {id: ppo, at: [2, 10], size: [216, 82], title: Recurrent PPO, sub: "GAE γ 0.995, λ 0.95|4 epochs × 4 minibatches|of whole trajectories|clip 0.2 · lr 3e-4 · entropy 0.003", style: plain}
  - {id: priv, kind: io, at: [2, 7], dy: 14, size: [216, 70], title: Privileged state, sub: "base 12 + clean sonar 18 + position 3|3 obstacles 18 + 3 walls 15|+ time left 1"}
  - {id: crit, at: [2, 8], dy: 14, size: [216, 62], title: Critic, sub: "LayerNorm 67 → LSTM-SRU 67→256|→ Dropout 256→256 → MLP → 1", style: learned}
groups:
  - {label: DeFM · frozen, nodes: [enc], pad: 10}
  - {label: Actor · trained with PPO, nodes: [fuse, cat2, lstm, head, samp], pad: 12, label_right: true}
  - {label: Critic · training only, nodes: [priv, crit], pad: 10}
wires:
  - {from: cam, to: prep, sig: 'R_t', shape: "72×128", note: "range, m"}
  - {from: prep, to: enc, sig: 'D_t', shape: "1×96×128"}
  - {from: enc, to: fuse, sig: 'P^{(4)}_t', shape: "64×6×8", note: "= 3072", sig_dx: 28}
  - {from: nav, to: base, text: measured}
  - {from: sonar, to: sect, sig: 'r_t', shape: "64", note: "σ 5 cm, 2% lost"}
  - {from: base, to: cat1, sig: 'b_t', shape: "12"}
  - {from: sect, to: cat1, from_side: b, to_side: r, sig: 'f_t', shape: "18", label_seg: 1}
  - {from: cat1, to: fuse, from_side: b, from_off: -14, to_side: r, sig: 's_t', shape: "30", note: query, label_seg: 1}
  - {from: cat1, to: cat2, from_off: 14, to_off: 14, sig: 's_t', shape: "30"}
  - {from: fuse, to: cat2, from_side: b, to_side: l, sig: 'm_t', shape: "64", note: image summary, label_seg: 1}
  - {from: cat2, to: lstm, sig: 'x_t', shape: "94"}
  - {from: lstm, to: head, sig: 'h_t', shape: "256"}
  - {from: head, to: samp, sig: '\mu_t', shape: "4"}
  - {from: samp, to: lim, sig: 'a_t', shape: "4 ∈ [−1, 1]"}
  - {from: lim, to: ctrl, sig: 'v^{cmd}_t', shape: "4", note: "u, v, w, r", sig_dx: 26, style: hl}
  - {from: ctrl, to: env, text: thrust}
  - {from: env, to: rew, text: next state}
  - {from: rew, to: roll, sig: 'r_t, d_t', shape: scalars}
  - {from: roll, to: ppo, text: trajectories}
  - {from: priv, to: crit, sig: 'o^{priv}_t', shape: "67", sig_dx: 30}
  - {from: crit, to: roll, from_side: b, from_off: -60, to_side: t, mid: 1262, sig: 'V_t', shape: "1", label_seg: 0, label_side: left}
  - {from: ppo, to: crit, from_off: 50, to_off: 50, style: dashed, text: updates actor, note: "and critic"}
  - {from: env, to: cam, from_side: l, to_side: l, mid: 16, style: dashed, text: the vehicle moves and the sensors see a new scene, rotate: true}
note: "Sizes are per environment; B is the batch of environments. Simulation: Isaac Sim / MarineGym. PPO updates attention, SRU, MLPs, log_std and the critic; DeFM stays frozen."
source: "From the author's stack description"
caption: "Blue spines are trained with recurrent PPO, the hatched spine is the frozen DeFM encoder, dotted spines are the vehicle and its velocity controller. Dashed wires are feedback and training updates. Hover a block or wire to isolate it."
```
