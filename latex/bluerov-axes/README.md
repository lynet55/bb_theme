# BlueROV2 Heavy silhouettes with body axes

Top view (bow up) and side view from starboard (bow right), with the body frame {b} in Fossen /
SNAME notation: x_b forward (surge u), y_b starboard (sway v), z_b down (heave w), and the rotation
rate about the out-of-page axis (yaw r in the top view, pitch q in the side view). Black only.

The origin o_b sits on the centre line, midway between the vertical thrusters along the vehicle
(0.478 of the length from the bow, measured on the top silhouette), and at mid-height in the side
view. Move it by editing the `\coordinate (O)` line, in fractions of the image width and height.

Two ways to use it:

```latex
% 1. TikZ source: labels in the thesis font (needs tikz, arrows.meta, calc, graphicx, amsmath)
\newcommand{\rovstyledir}{vendor/quietreport/latex/bluerov-axes}
\newcommand{\rovimgdir}{vendor/quietreport/latex/bluerov-axes/img}
\newcommand{\rovfigwidth}{0.7\linewidth}
\begin{figure}[H]\centering
  \input{vendor/quietreport/latex/bluerov-axes/top.tex}
  \caption{...}\label{fig:bluerov-top}
\end{figure}

% 2. Compiled PDF (Computer Modern labels)
\includegraphics[width=0.7\linewidth]{bluerov2_heavy_top_axes.pdf}
```

Rebuild the PDFs with `pdflatex top_standalone.tex` and `pdflatex side_standalone.tex`.
