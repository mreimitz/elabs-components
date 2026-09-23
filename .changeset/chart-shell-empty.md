---
"@elabs-ai/components-charts": patch
---

Fix two chart-shell bugs: a narrow tile (e.g. a 390px tile, or any box smaller than the chart's own margins) could render an SVG `<rect>` with a negative height/width, logging a console error (`innerWidth`/`innerHeight` are now clamped to `>= 0` in `grid.tsx` and in every chart shell that computes them: `time-series-chart-shell`, `bar-chart`, `candlestick-chart`, `scatter-chart-shell`, `sankey-chart`); and hiding every series through an `interactive: "toggle"` legend used to leave a blank, unexplained axis grid — it now shows the shared "nothing to show" empty state while the legend stays usable to bring a series back.
