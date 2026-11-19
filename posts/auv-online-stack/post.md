---
title: "Online navigation loop"
date: November 2026
summary: Deployed policy with MarineGym in the loop.
---

```figure
id: online
type: stack
bare: true
legend: false
width: 1100
cols: 4
row_height: 108
top: 50
nodes:
  # MarineGym: sensor models and task
  - {id: j0, kind: dot, at: [0.3, -0.5], dy: -12}
  - {id: j1, kind: dot, at: [1.3, -0.5], dy: -12}
  - {id: j3, kind: dot, at: [3, -0.5], dy: -12}
  - {id: cam, kind: io, at: [0.3, 0], size: [200, 52], title: Depth camera, math: '90^\circ\ \mathrm{FOV}'}
  - {id: nav, kind: io, at: [1.3, 0], size: [210, 52], title: IMU · pressure · DVL}
  - {id: goal, kind: io, at: [2.15, 0], size: [110, 44], title: Goal}
  - {id: son, kind: io, at: [3, 0], size: [250, 70], title: Sonar, math: ['N_r=64,\ r_{\max}=12\,\mathrm{m}', '\sigma_r=5\,\mathrm{cm},\ p_{\mathrm{drop}}=0.02,\ p_{\mathrm{spur}}=0.005']}
  # observation processing
  - {id: plan, at: [0.3, 1], size: [220, 52], title: Planar depth, math: 'D_t=\mathrm{resize}\bigl(\mathrm{planar}(R^{\mathrm{img}}_t)\bigr)', style: plain}
  - {id: navs, at: [1.3, 1], size: [230, 70], title: Navigation state, math: ['\mathbf{p}^{b}_{\mathrm{goal}}/10,\ \sin\Delta\psi_{\mathrm{goal}},\ \cos\Delta\psi_{\mathrm{goal}}', 'u,\ v,\ w,\ r,\ z,\ \phi,\ \theta'], style: plain}
  - {id: sect, at: [3, 1], size: [240, 70], title: Sector features, math: ['\min_{i\in\mathcal{S}_k}\tilde r_{t,i}/r_{\max},\ k=1,\dots,16', '\min_{|\alpha_i|\le 30^\circ}\tilde r_{t,i},\ \ \mathrm{TTC}_t'], style: plain}
  - {id: enc, at: [0.3, 2], dy: -8, size: [220, 62], title: DeFM encoder, math: 'E^{\mathrm{DeFM}}\bigl(\Gamma(D_t)\bigr)', sub: "EfficientNet-B0 + BiFPN, P4", style: frozen}
  - {id: cat1, at: [2, 2], size: [84, 30], title: concat, style: plain}
  # policy
  - {id: fuse, at: [0.3, 3], dy: 8, size: [270, 84], title: Cross-attention fuse, math: ['\mathrm{query}=\mathrm{MLP}(\mathbf{s}_t):\ 30\to128\to64', '48\ \text{tokens}\times 64,\ \ 4\ \text{heads}', '\mathrm{FFN}:\ 64\to128\to64'], style: learned}
  - {id: cat2, at: [2, 4], size: [84, 30], title: concat, style: plain}
  - {id: lstm, at: [2, 5], size: [160, 52], title: LSTM-SRU, math: '94\to256', style: learned}
  - {id: dly, at: [3, 5], size: [110, 44], title: Unit delay, style: plain}
  - {id: head, at: [2, 6], size: [230, 52], title: MLP head, math: '256\to256\to256\to256\to4', style: learned}
  - {id: act, at: [2, 7], size: [190, 52], title: Deterministic action, math: '\mathbf{a}_t=\tanh(\boldsymbol{\mu}^{\pi}_t)', style: plain}
  - {id: lim, at: [2, 8], dy: -10, size: [270, 62], title: Command limits, math: ['\boldsymbol{\nu}^{\mathrm{cmd}}_t=\boldsymbol{\Lambda}\,\mathbf{a}_t', '\boldsymbol{\Lambda}=\operatorname{diag}(0.45,\,0.30,\,0.25,\,0.5)'], style: plain}
  # MarineGym: vehicle
  - {id: ctrl, at: [2, 9], size: [170, 52], title: Velocity controller, sub: simple_block_4d, style: plant}
  - {id: thr, at: [1.2, 9], size: [140, 52], title: Thrusters, math: '\boldsymbol{\tau}=\mathbf{T}\mathbf{K}\mathbf{u}', style: plant}
  - {id: dyn, at: [0.3, 9], size: [210, 82], title: 6-DOF dynamics, math: ['\mathbf{M}\dot{\boldsymbol{\nu}}+\mathbf{C}(\boldsymbol{\nu})\boldsymbol{\nu}+\mathbf{D}(\boldsymbol{\nu})\boldsymbol{\nu}', '+\,\mathbf{g}(\boldsymbol{\eta})=\boldsymbol{\tau}', '\dot{\boldsymbol{\eta}}=\mathbf{J}_\Theta(\boldsymbol{\eta})\,\boldsymbol{\nu}'], math_size: 11.5, math_line: 17, style: plant}
groups:
  - {label: MarineGym · sensors and task, nodes: [cam, nav, goal, son], pad: 10}
  - {label: DeFM · frozen, nodes: [enc], pad: 6}
  - {label: Policy · online, nodes: [fuse, cat2, lstm, head, act], pad: 12, label_right: true}
  - {label: MarineGym · vehicle, nodes: [dyn, thr, ctrl], pad: 10}
wires:
  # loop closure: vehicle state drives every sensor model
  - {from: dyn, to: j0, from_side: l, to_side: l, mid: 14, arrow: false}
  - {from: j0, to: j1, arrow: false, sig: '(\boldsymbol{\eta}_t,\,\boldsymbol{\nu}_t)'}
  - {from: j1, to: j3, arrow: false}
  - {from: j0, to: cam}
  - {from: j1, to: nav}
  - {from: j3, to: son}
  # observations
  - {from: cam, to: plan, sig: 'R^{\mathrm{img}}_t\in\mathbb{R}_{\ge 0}^{72\times128}'}
  - {from: plan, to: enc, label_pos: 0.3, sig: 'D_t\in\mathbb{R}_{\ge 0}^{96\times128}'}
  - {from: enc, to: fuse, label_pos: 0.25, sig: '\mathbf{z}^{\mathrm{DeFM}}_t\in\mathbb{R}^{64\times6\times8}'}
  - {from: nav, to: navs, sig: '\tilde{\boldsymbol{\eta}}_t,\ \tilde{\boldsymbol{\nu}}_t'}
  - {from: goal, to: navs, from_side: b, to_side: r, sig: '\mathbf{p}^{n}_{\mathrm{goal}}\in\mathbb{R}^{3}', label_seg: 1}
  - {from: son, to: sect, sig: '\tilde{\mathbf{r}}_t\in[0,r_{\max}]^{64}'}
  - {from: navs, to: cat1, from_side: b, to_side: l, sig: '\mathbf{s}^{\mathrm{nav}}_t\in\mathbb{R}^{12}', label_seg: 1}
  - {from: sect, to: cat1, from_side: b, to_side: r, sig: '\mathbf{f}_t\in\mathbb{R}^{18}', label_seg: 1}
  # policy
  - {from: cat1, to: fuse, from_side: b, from_off: -16, to_side: r, sig: '\mathbf{s}_t\in\mathbb{R}^{30}', label_seg: 1}
  - {from: cat1, to: cat2, from_off: 16, to_off: 16, sig: '\mathbf{s}_t'}
  - {from: fuse, to: cat2, from_side: b, to_side: l, sig: '\bar{\mathbf{z}}_t\in\mathbb{R}^{64}', label_seg: 1}
  - {from: cat2, to: lstm, sig: '\mathbf{x}^{\mathrm{DeFM}}_t\in\mathbb{R}^{94}'}
  - {from: lstm, to: dly, from_off: -9, to_off: -9, sig: '(\mathbf{h}_t,\mathbf{c}_t)'}
  - {from: dly, to: lstm, from_off: 9, to_off: 9, sig: '(\mathbf{h}_{t-1},\mathbf{c}_{t-1})', label_side: below}
  - {from: lstm, to: head, sig: '\mathbf{h}_t\in\mathbb{R}^{256}'}
  - {from: head, to: act, sig: '\boldsymbol{\mu}^{\pi}_t\in\mathbb{R}^{4}'}
  - {from: act, to: lim, sig: '\mathbf{a}_t\in[-1,1]^{4}'}
  - {from: lim, to: ctrl, sig: '\boldsymbol{\nu}^{\mathrm{cmd}}_t\in\mathbb{R}^{4}', style: hl, label_pos: 0.22}
  - {from: ctrl, to: thr, sig: '\mathbf{u}_t\in\mathbb{R}^{n_u}'}
  - {from: thr, to: dyn, sig: '\boldsymbol{\tau}_t\in\mathbb{R}^{6}'}
```
