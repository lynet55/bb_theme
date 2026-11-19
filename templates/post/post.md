---
title: "A new report"
date: 2026-01-01
summary: One sentence that says what the reader will learn.
findings:
  - "State the main result as a claim, and point to the figure that shows it (@fig:example)."
---

## The result {#result}

Write the text in Markdown. Maths works inline, $\sigma_Z \approx Z^2/(f\,b)$, and in display:

$$\mathbf{x} = \mathbf{K}\,[\mathbf{R}\mid\mathbf{t}]\,\mathbf{X}.$$

```figure
id: example
type: line
tag: example
title: A title that states what the figure shows
data: example.csv
x: step
y: value
series: method
highlight: Ours
xlabel: Step
ylabel: Value
source: "Where the numbers came from"
caption: "Say what to look at first. Hover to read values."
```

```figure
id: knob
type: plane
tag: interactive
title: Drag the slider and the curve follows
xrange: [0, 6.3]
yrange: [-2.2, 2.2]
controls:
  - {name: a, label: Amplitude, min: 0, max: 2, step: 0.05, value: 1}
marks:
  - {kind: curve, t: [0, 6.3], x: "t", y: "a*sin(t)", cls: hl}
readouts:
  - {label: Peak, expr: "a", digits: 2}
```
