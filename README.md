# Quiet Report: interactive figures for technical writing

Write a report in Markdown, put figures in fenced `figure` blocks, run `python build.py`. Each post
becomes one self-contained HTML page (no server, no JavaScript build step). `export.py` turns any
figure into a PNG or a vector PDF for LaTeX. The look is set in `theme/`; the site name in `site.yaml`.

```
pip install -r requirements.txt          # markdown, pyyaml; playwright only for export.py
python build.py                          # build every post into dist/
python build.py posts/slam-basics        # build one post
python build.py new my-post              # start a post from templates/post
python export.py dist/slam-basics/index.html --fig tri --format pdf --diagram-only --transparent
```

## Repository layout

| Path | What it is |
|---|---|
| `build.py` | Markdown + figure blocks → `dist/<post>/index.html` |
| `export.py` | Figures from a built page → PNG / PDF |
| `theme/` | `template.html`, `report.css`, `charts.js` (all figure types) |
| `templates/post/` | Starter post copied by `build.py new` |
| `posts/` | Example posts: SLAM basics, DeFM control stack, two AUV navigation stacks |
| `latex/` | Hand-written TikZ figures (VAE, convolutional encoder, RNN / LSTM / GRU cells), each with a standalone build |
| `site.yaml` | Site name, author, footer |

## Using it from another repository

Keep this library in its own repository and pull it into the others. Your own posts, data and site.yaml
live in the host repository; the library stays untouched, so you can update it in one place.

### In a code or work repository: git submodule

```
git submodule add <url-of-this-repo> tools/quietreport
git commit -m "Add Quiet Report figures library"
```

Keep your posts next to it, for example in `figures/posts/`, and build from the repository root:

```
python tools/quietreport/build.py --posts figures/posts --out figures/html
python tools/quietreport/export.py figures/html/my-post/index.html --format pdf --diagram-only --out figures/pdf
```

A `site.yaml` in the folder you run from overrides the library's own. Update the library later with
`git submodule update --remote tools/quietreport`. Collaborators clone with `git clone --recursive`.

### In a LaTeX repository synced with Overleaf

Overleaf's git integration does not fetch submodules, so a submodule would show up as an empty folder
there. Two options:

**A. Commit only the exported figures (simplest).** Keep the library in your code repository, export
PDFs, and commit those into the LaTeX repository, for example `figures/`. Overleaf only needs the PDFs:

```
python tools/quietreport/export.py figures/html/my-post/index.html --fig tri gnlm \
    --format pdf --diagram-only --transparent --out ../thesis/figures
```

**B. Vendor the library with git subtree** if you want the TikZ sources in `latex/` inside the thesis.
A subtree is a plain copy in the history, so Overleaf sees every file:

```
git subtree add --prefix=vendor/quietreport <url-of-this-repo> main --squash
git subtree pull --prefix=vendor/quietreport <url-of-this-repo> main --squash   # to update
```

Then, in the thesis, point the figure at its images before including it:

```latex
\newcommand{\vaeimgdir}{vendor/quietreport/latex/vae-canonical/img}
\begin{figure}[H]\centering
  \input{vendor/quietreport/latex/vae-canonical/vae.tex}
  \caption{...}\label{fig:vae}
\end{figure}
```

The TikZ figures need `tikz` (with `\usetikzlibrary{arrows.meta, positioning}`, plus `shapes.geometric` for `latex/rnn`), `graphicx`,
`amsmath` and `amssymb`. Overleaf compiles them like any other source; nothing here runs Python there.

## RNN, LSTM and GRU cells (`latex/rnn/`)

The diagrams from C. Olah's *Understanding LSTM Networks* (2015), redrawn in this style. All cells are
macros in `rnn-style.tex`; each figure file loads it, so several can share one document.
`./build.sh` writes every variant to `latex/rnn/pdf/`:

| PDF | Figure file and options |
|---|---|
| `rnn-rolled`, `rnn-unrolled`, `rnn-short-term`, `rnn-long-term` | `rnn-unrolled.tex`, `\def\rnnunrolled{rolled\|full\|short\|long}` |
| `rnn-chain`, `lstm-chain` | three repeating modules (the LSTM chain is about 25 cm wide: wrap it in `\resizebox`) |
| `lstm-notation`, `lstm-gate` | legend, and a single gate |
| `lstm-cell`, `lstm-cline`, `lstm-focus-{f,i,c,o}` | `lstm-cell.tex`, `\def\rnnfocus{none\|cline\|f\|i\|c\|o}` |
| `lstm-peephole`, `lstm-coupled` | `lstm-cell.tex`, `\def\rnnvariant{peephole\|coupled}` |
| `gru-cell` | `gru-cell.tex` |

```latex
\newcommand{\rnndir}{vendor/quietreport/latex/rnn}   % where the folder lives
\begin{figure}[H]\centering
  \def\rnnfocus{f}                                     % optional, local to the figure
  \input{\rnndir/lstm-cell.tex}
  \caption{...}\label{fig:lstm-forget}
\end{figure}
```

Symbols are macros, so a document can rename them to fit its notation: `\rnnx`, `\rnnh`, `\rnnc`
(input, hidden state, LSTM cell state; bold x, h, c) and `\rnnzg`, `\rnnrg` (GRU update and reset
gates; bold z, r), e.g. `\renewcommand{\rnnzg}{\mathbf{u}}` after the first figure, or
`\newcommand` before it.

## Exporting figures

`export.py` opens a built page in a headless browser and saves each figure:

| Option | Effect |
|---|---|
| `--fig tri gnlm` | Only these figures (ids from the figure blocks) |
| `--format png pdf` | PNG (3× pixel density by default, `--scale`) and/or vector PDF |
| `--diagram-only` | Only the drawing and legend: no tag, title, sliders, readouts or source line |
| `--transparent` | No background panel or grain |
| `--view "Forward motion"` | Pick a view of a figure that has several |
| `--out DIR` | Where to write (default: `export/` next to the page) |
| `--chrome PATH` | Use an installed Chrome instead of Playwright's Chromium |

Equations and fonts come from the web when the page opens. To build pages that use a local MathJax,
set `QR_MATHJAX=file:///path/to/mathjax/es5/tex-svg.js` when running `build.py`.

## Figure types

| Type | Use |
|---|---|
| `line`, `bar`, `vbar`, `scatter`, `table` | Data charts from CSV, with series, highlight, views and hover |
| `loop` | Block diagrams of feedback loops |
| `frames` | Coordinate frames and rotations in 2-D |
| `scene` | 3-D scenes: frames, cameras, points, rays, trajectories, wire-grid surfaces; sliders |
| `warp` | Image-plane distortion grids from formulas |
| `sim` | Live simulations (bicycle model on a racetrack) |
| `stack` | Signal-flow diagrams of control and learning stacks (below) |
| `plane` | 2-D geometry from formulas and data, cost maps, least-squares solver paths (below) |
| `image`, `video`, `filmstrip`, `svg` | Media grids with labels and lazy-loaded video |

The example posts use most of them; copying a block from there is the quickest start. The full guide
to the first group of types is in the README of the earlier `quietreport.zip`, and still applies.

## stack: control and learning stacks as signal-flow diagrams

Blocks sit on a grid. Wires carry a named signal and, underneath, its shape. Tensors can be
drawn as wire-grid slabs. Hovering a block or wire fades the rest and shows its `tip`.

```figure
id: stack
type: stack
title: Only the policy is trained
cols: 3                      # grid columns; a block's `at` is [column, row], fractions allowed
row_height: 104              # pixels per row
nodes:
  - {id: cam,  kind: io, at: [0, 0], title: Depth camera, sub: front-facing}       # io = rounded input/output
  - {id: enc,  at: [1, 0], title: Encoder, sub: frozen, style: frozen, tip: "Shown on hover"}
  - {id: pol,  at: [2, 0], title: Policy, style: learned}
  - {id: bot,  at: [2, 1], title: Robot, style: plant}
  - {id: t,    kind: tensor, at: [0, 1], dims: [64, 5, 8], sig: 'F_t', basis: derived}   # channels, height, width
  - {id: n,    kind: note, at: [1, 1], text: "First line|second line"}
wires:
  - {from: cam, to: enc, sig: 'D_t', shape: "1×40×64", note: metres}
  - {from: enc, to: pol, sig: 'z_t', shape: "n.s."}
  - {from: pol, to: bot, sig: 'a_t', shape: "12 joints", basis: assumed, style: hl}
  - {from: bot, to: cam, from_side: l, to_side: b, style: dashed, text: measured}
groups:
  - {label: Perception, nodes: [cam, enc]}
note: "† derived · ‡ typical, not stated · n.s. not stated"
```

Block `style`: `learned` (blue spine), `frozen` (hatched spine), `plant` (dotted spine), `plain`.
A legend is drawn for the styles used; rename entries with `legend: {learned: "...", frozen: "..."}`.

Wire options:
- `sig` is LaTeX for the signal name; `text` is a plain label instead; `shape` and `note` go underneath.
- `basis: derived` adds † and `basis: assumed` adds ‡, so readers can tell stated sizes from worked-out ones.
- `style: hl` (signal blue) or `dashed` (measurement, supervision).
- Routing is automatic with right-angle wires. Override with `from_side` / `to_side` (`l r t b`),
  `from_off` / `to_off` (pixels along that side), and `mid` (pixel position of the middle run).
- Label placement: `label_seg` (which run), `label_pos` (0 to 1 along it), `label_side: left`,
  `sig_dx`, and `rotate: true` for text along a vertical run.

A block's `sub` can hold several small lines separated by `|`, and `size: [w, h]` makes it larger.
`width: 900` widens the drawing canvas for big stacks (text is then smaller on the page, but sharp in an exported PNG).

Use `views:` to switch between several stacks in one figure, as in `posts/defm-control-stack`.

## plane: 2-D geometry from formulas and data

For image planes, top views and small optimisation demos. Sliders work as in `scene`.
Plain-string formulas see the slider values; curves also see `t`, fields see `x` and `y`,
and data marks see the row's columns.

```figure
id: example
type: plane
xrange: [0, 10]          # data coordinates
yrange: [-3, 3]
equal: true              # same scale on both axes
flip_y: false            # true for image coordinates (v downwards)
axes: true               # false hides axes and grid
xlabel: 'x\ (\mathrm{m})'
controls:
  - {name: b, label: Baseline, min: 0.1, max: 3, value: 1}
derived: {h: "b/2"}       # computed before drawing
sums:                     # sums over data rows, usable in readouts and marks
  - {name: n, data: pts.csv, expr: "1", filter: "x > 0"}
after: {mean: "n/2"}      # computed after the sums
marks:                    # drawn in order
  - {kind: field, f: "(x - 5)^2 + y^2", log: true}                 # shaded cost map, darker = lower
  - {kind: curve, t: [0, 6.28], x: "5 + 2*cos(t)", y: "2*sin(t)", cls: muted dash}
  - {kind: line, from: [0, "h"], to: [5, 0], cls: hl, arrow: true, label: 'r_1'}
  - {kind: point, at: [5, 0], shape: dot, cls: hl, label: '\mathbf{X}'}   # shapes: dot, ring, cross, square
  - {kind: points, data: pts.csv, x: x, y: y, cls_if: {expr: "bad", true: muted, false: ink}, tip: "residual {r} px"}
  - {kind: segments, data: pts.csv, x1: x, y1: y, x2: "x + 1", y2: y}
  - {kind: path, data: traj.csv, x: x, y: y}                       # polyline through rows
  - {kind: poses, data: traj.csv, x: x, y: y, th: heading, len: 0.2}
  - {kind: polygon, points: [[0, 0], [1, 0], [1, 1]], cls: hatch}  # fills: hl, muted, hatch, dots, paper
  - {kind: ellipse, at: [5, 0], rx: 1, ry: 0.5, angle: 30}
  - {kind: rects, data: blocks.csv, x: x, y: y, w: w, h: h, cls_col: kind}
  - {kind: text, at: [5, 2.5], text: "a note"}                      # or tex: '...'
  - {kind: solver, method: lm, as: lm, start: [1, 2], residuals: ["hypot(x, y) - 3", "hypot(x - 4, y) - 2"]}
readouts:
  - {label: "LM final cost", expr: "lm_cost", digits: 3}          # a solver sets <as>_x, _y, _cost, _n
```

Annotating a picture (a CAD render, a photo): put it in as the first mark and draw on top in its
own pixel coordinates (`flip_y: true`, `equal: true`, `axes: false`). The image is inlined into the page.

```
  - {kind: image, src: media/render.png, at: [240, 240], w: 2770, h: 1940}   # top-left corner and size
  - {kind: line, from: [1590, 1204], to: [194, 2124], cls: hl thick, arrow: true, halo: true,
     label: 'x_b', label_pos: 1, label_halo: true}
```

`halo: true` draws a white outline under a line or curve, `label_halo` / `halo` on text keeps labels
readable over the picture. `posts/bluerov-frames` shows the full case, including how its
`make_post.py` recovers the view's projection from the render so the axes line up with the vehicle.

Range sensors: a `rays` mark ray-casts N beams over a field of view from a pose in NED against vertical
cylinders, wall segments and a flat seabed, and a `rangebars` mark draws the resulting range vector
(see `posts/fls-sonar`). `axis_xmax` stops the axes short of the right edge, to leave room for a panel.

Line classes: `ink`, `hl`, `muted`, `faint`, plus `dash`, `thin`, `thick`.
`clip_box: [x0, y0, x1, y1]` clips a single mark. Use `filter:` (a formula) to skip rows.
