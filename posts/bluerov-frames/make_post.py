"""Write post.md: BlueROV2 Heavy render with body and NED axes in Fossen / SNAME notation.

The render is an orthographic view. Its projection is recovered from measurements in the
render's own pixel coordinates (x right, y down):
  - a vertical-thruster duct rim, a horizontal circle, is an ellipse of 394 x 181 px with its
    major axis horizontal: the view has no roll and its elevation is asin(181/394) = 27.4 deg;
  - spinner tips of the four vertical thrusters, at one height:
      back-left (1125, 405), front-left (545, 805), back-right (2640, 905), front-right (2050, 1300).
Back-to-front and port-to-starboard then fix the azimuth of the body x and y axes. The two
measured directions come out 88.5 deg apart in the horizontal plane, a check on the model.
"""
import math
from pathlib import Path

E = math.asin(181 / 394)                                  # elevation of the view
tips = {"bl": (1125, 405), "fl": (545, 805), "br": (2640, 905), "fr": (2050, 1300)}


def azim(d):
    """Azimuth in the horizontal plane of a measured screen direction (screen y down)."""
    return math.atan2(-d[1] / math.sin(E), d[0])


fwd = [((tips["fl"][0] - tips["bl"][0] + tips["fr"][0] - tips["br"][0]) / 2,
        (tips["fl"][1] - tips["bl"][1] + tips["fr"][1] - tips["br"][1]) / 2)]
stb = [((tips["bl"][0] - tips["br"][0] + tips["fl"][0] - tips["fr"][0]) / 2,
        (tips["bl"][1] - tips["br"][1] + tips["fl"][1] - tips["fr"][1]) / 2)]
ax_, ay_ = azim(fwd[0]), azim(stb[0])
gap = math.degrees((ax_ - ay_) % (2 * math.pi))
# make them exactly perpendicular: split the small error evenly (angles wrapped, so work on the gap)
err = math.radians(gap - 90)
ax_ -= err / 2
ay_ = ax_ - math.radians(90)


def P(v):
    """Screen projection (pixels per metre = 1) of a body-frame vector [x fwd, y stbd, z down]."""
    hx = v[0] * math.cos(ax_) + v[1] * math.cos(ay_)
    hy = v[0] * math.sin(ax_) + v[1] * math.sin(ay_)
    return (hx, -math.sin(E) * hy + math.cos(E) * v[2])


S = 197 / 0.05                    # px per metre: the duct rim's semi-major axis is about 50 mm
cx = sum(t[0] for t in tips.values()) / 4
cy = sum(t[1] for t in tips.values()) / 4
O = (cx, cy + P((0, 0, 0.10))[1] * S)                     # body origin 0.10 m below the thruster tops


def at(o, v, k=S):
    p = P(v)
    return (round(o[0] + k * p[0], 1), round(o[1] + k * p[1], 1))


def arc(c, a, b, r, t0, t1, cls="hl thin", n=60):
    """Rotation arrow: c + r (cos t a + sin t b), t from t0 to t1 (deg); a -> b is the positive sense."""
    pa, pb = P(a), P(b)
    t0, t1 = math.radians(t0), math.radians(t1)
    return ("  - {kind: curve, t: [%.4f, %.4f], n: %d, x: \"%.1f + %.1f*cos(t) + %.1f*sin(t)\", "
            "y: \"%.1f + %.1f*cos(t) + %.1f*sin(t)\", cls: %s, arrow: true, halo: true}"
            % (t0, t1, n, c[0], r * pa[0], r * pb[0], c[1], r * pa[1], r * pb[1], cls))


def pt_on_arc(c, a, b, r, t):
    pa, pb = P(a), P(b); t = math.radians(t)
    return (round(c[0] + r * (math.cos(t) * pa[0] + math.sin(t) * pb[0]), 1),
            round(c[1] + r * (math.cos(t) * pa[1] + math.sin(t) * pb[1]), 1))


X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
L = {"x": 0.76, "y": 0.62, "z": 0.36}                      # arrow lengths, metres
tipx, tipy, tipz = at(O, (L["x"], 0, 0)), at(O, (0, L["y"], 0)), at(O, (0, 0, L["z"]))
R = 0.055 * S                                              # rotation-arrow radius
cxr, cyr, czr = at(O, (0.80 * L["x"], 0, 0)), at(O, (0, 0.80 * L["y"], 0)), at(O, (0, 0, 0.84 * L["z"]))

# NED inset: same view, heading psi between x_n and x_b
PSI = 30.0
psi = math.radians(PSI)
xn = (math.cos(-psi), math.sin(-psi), 0)                   # x_n written in body axes (z_n = z_b here)
yn = (-math.sin(-psi), math.cos(-psi), 0)
On = (3360, 1800)
Ln = 0.15
tipxn, tipyn, tipzn = at(On, tuple(Ln * c for c in xn)), at(On, tuple(Ln * c for c in yn)), at(On, (0, 0, 0.12))
tipxb_n = at(On, (Ln * 0.8, 0, 0))

lines = []
add = lines.append
add("  - {kind: image, src: media/bluerov2_heavy.png, at: [240, 240], w: 2770, h: 1940}")
# body axes: axis name at the tip, translational velocity beside the shaft
for tip, lab, off in [(tipx, "x_b", [-16, 16]), (tipy, "y_b", [-14, -14]), (tipz, "z_b", [0, 22])]:
    add("  - {kind: line, from: [%.1f, %.1f], to: [%.1f, %.1f], cls: hl thick, arrow: true, halo: true, "
        "label: '%s', label_pos: 1, label_off: [%d, %d], label_size: 18, label_halo: true}" % (O[0], O[1], tip[0], tip[1], lab, off[0], off[1]))
for tip, tex, off in [(tipx, "\\text{surge}\\ u", [-16, 36]), (tipy, "\\text{sway}\\ v", [-14, -34]), (tipz, "\\text{heave}\\ w", [0, 42])]:
    add("  - {kind: point, at: [%.1f, %.1f], shape: dot, size: 0.01, cls: hl, label: '%s', label_off: [%d, %d], label_size: 13, label_cls: aux, label_halo: true}" % (tip[0], tip[1], tex, off[0], off[1]))
add("  - {kind: point, at: [%.1f, %.1f], shape: dot, size: 4.5, cls: hl, label: 'o_b', label_off: [16, -12], label_size: 16, label_halo: true}" % O)
# rotation arrows (right-hand rule): roll p about x (y -> z), pitch q about y (z -> x), yaw r about z (x -> y)
Rz = 0.042 * S
for c, a2, b2, r, t0, t1, tl, tex in [(cxr, Y, Z, R, -50, 230, 168, "p"), (cyr, Z, X, R, -40, 240, 262, "q"), (czr, X, Y, Rz, -150, 130, 228, "r")]:
    add(arc(c, a2, b2, r, t0, t1, cls="hl"))
    m = pt_on_arc(c, a2, b2, r * 1.5, tl)
    add("  - {kind: text, at: [%.1f, %.1f], tex: '%s', size: 17, halo: true}" % (m[0], m[1], tex))
# NED inset
add("  - {kind: line, from: [%.1f, %.1f], to: [%.1f, %.1f], cls: ink, arrow: true, label: 'x_n', label_pos: 1, label_off: [-6, 16], label_size: 16}" % (On + tipxn))
add("  - {kind: line, from: [%.1f, %.1f], to: [%.1f, %.1f], cls: ink, arrow: true, label: 'y_n', label_pos: 1, label_off: [-16, -8], label_size: 16}" % (On + tipyn))
add("  - {kind: line, from: [%.1f, %.1f], to: [%.1f, %.1f], cls: ink, arrow: true, label: 'z_n', label_pos: 1, label_off: [14, 8], label_size: 16}" % (On + tipzn))
add("  - {kind: line, from: [%.1f, %.1f], to: [%.1f, %.1f], cls: hl dash, label: 'x_b', label_pos: 1, label_off: [-16, 4], label_size: 15}" % (On + tipxb_n))
add(arc(On, xn, yn, 0.16 * S, 0, PSI, cls="hl thin", n=24).replace(", halo: true", ""))
pm = pt_on_arc(On, xn, yn, 0.16 * S * 1.3, PSI / 2)
add("  - {kind: text, at: [%.1f, %.1f], tex: '\\psi', size: 16}" % (pm[0] - 4, pm[1] + 8))
add("  - {kind: point, at: [%.1f, %.1f], shape: dot, size: 3.5, cls: ink, label: '\\{n\\}', label_off: [16, -14], label_size: 16}" % On)

xr = [min(tipy[0], tipx[0]) - 120, On[0] + 230]
yr = [190, max(tipz[1], tipx[1], tipzn[1]) + 230]

post = f'''---
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
xrange: [{xr[0]:.0f}, {xr[1]:.0f}]
yrange: [{yr[0]:.0f}, {yr[1]:.0f}]
marks:
''' + "\n".join(lines) + '''
```
'''
(Path(__file__).parent / "post.md").write_text(post, encoding="utf-8")
print(f"elevation {math.degrees(E):.1f} deg; measured x-y gap {gap:.1f} deg (90 ideal)")
print("origin", tuple(round(v) for v in O), "tips x/y/z", tipx, tipy, tipz)
print("ranges", xr, yr)
