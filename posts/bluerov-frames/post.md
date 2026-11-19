---
title: "BlueROV2 Heavy: body and NED frames"
date: November 2026
summary: Body axes, motion components and the NED frame, in Fossen / SNAME notation.
---

```figure
id: frames
type: plane
bare: true
legend: false
equal: true
axes: false
flip_y: true
width: 900
xrange: [-535, 3590]
yrange: [190, 2694]
marks:
  - {kind: image, src: media/bluerov2_heavy.png, at: [240, 240], w: 2770, h: 1940}
  - {kind: line, from: [1590.0, 1203.7], to: [-121.3, 2332.5], cls: hl thick, arrow: true, halo: true, label: 'x_b', label_pos: 1, label_off: [-16, 16], label_size: 18, label_halo: true}
  - {kind: line, from: [1590.0, 1203.7], to: [-414.6, 562.4], cls: hl thick, arrow: true, halo: true, label: 'y_b', label_pos: 1, label_off: [-14, -14], label_size: 18, label_halo: true}
  - {kind: line, from: [1590.0, 1203.7], to: [1590.0, 2463.6], cls: hl thick, arrow: true, halo: true, label: 'z_b', label_pos: 1, label_off: [0, 22], label_size: 18, label_halo: true}
  - {kind: point, at: [-121.3, 2332.5], shape: dot, size: 0.01, cls: hl, label: '\text{surge}\ u', label_off: [-16, 36], label_size: 13, label_cls: aux, label_halo: true}
  - {kind: point, at: [-414.6, 562.4], shape: dot, size: 0.01, cls: hl, label: '\text{sway}\ v', label_off: [-14, -34], label_size: 13, label_cls: aux, label_halo: true}
  - {kind: point, at: [1590.0, 2463.6], shape: dot, size: 0.01, cls: hl, label: '\text{heave}\ w', label_off: [0, 42], label_size: 13, label_cls: aux, label_halo: true}
  - {kind: point, at: [1590.0, 1203.7], shape: dot, size: 4.5, cls: hl, label: 'o_b', label_off: [16, -12], label_size: 16, label_halo: true}
  - {kind: curve, t: [-0.8727, 4.0143], n: 60, x: "221.0 + -177.8*cos(t) + -0.0*sin(t)", y: "2106.8 + -56.9*cos(t) + 192.5*sin(t)", cls: hl, arrow: true, halo: true}
  - {kind: text, at: [481.9, 2250.3], tex: 'p', size: 17, halo: true}
  - {kind: curve, t: [-0.6981, 4.1888], n: 60, x: "-13.7 + -0.0*cos(t) + -123.8*sin(t)", y: "690.6 + 192.5*cos(t) + 81.7*sin(t)", cls: hl, arrow: true, halo: true}
  - {kind: text, at: [170.3, 529.1], tex: 'q', size: 17, halo: true}
  - {kind: curve, t: [-2.6180, 2.2689], n: 60, x: "1590.0 + -94.6*cos(t) + -135.8*sin(t)", y: "2262.0 + 62.4*cos(t) + -43.4*sin(t)", cls: hl, arrow: true, halo: true}
  - {kind: text, at: [1836.3, 2247.8], tex: 'r', size: 17, halo: true}
  - {kind: line, from: [3360.0, 1800.0], to: [3310.0, 2070.5], cls: ink, arrow: true, label: 'x_n', label_pos: 1, label_off: [-6, 16], label_size: 16}
  - {kind: line, from: [3360.0, 1800.0], to: [2771.1, 1777.0], cls: ink, arrow: true, label: 'y_n', label_pos: 1, label_off: [-16, -8], label_size: 16}
  - {kind: line, from: [3360.0, 1800.0], to: [3360.0, 2220.0], cls: ink, arrow: true, label: 'z_n', label_pos: 1, label_off: [14, 8], label_size: 16}
  - {kind: line, from: [3360.0, 1800.0], to: [3089.8, 1978.2], cls: hl dash, label: 'x_b', label_pos: 1, label_off: [-16, 4], label_size: 15}
  - {kind: curve, t: [0.0000, 0.5236], n: 24, x: "3360.0 + -53.4*cos(t) + -628.1*sin(t)", y: "1800.0 + 288.6*cos(t) + -24.5*sin(t)", cls: hl thin, arrow: true}
  - {kind: text, at: [3077.7, 2162.1], tex: '\psi', size: 16}
  - {kind: point, at: [3360.0, 1800.0], shape: dot, size: 3.5, cls: ink, label: '\{n\}', label_off: [16, -14], label_size: 16}
```
