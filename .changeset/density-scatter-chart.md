---
"@elabs-ai/components-charts": minor
"@elabs-ai/components-cli": patch
---

`DensityScatterChart` — a point plot for 10⁵–10⁶ rows. Every point is always drawn (WebGL point sprites, Canvas-2D fallback); its colour is the density around it, binned in screen pixels so zooming in resolves the shape into individual dots with no mode switch; `zones` on the axes (a per-axis `min`/`max` or an `upper`/`lower` envelope along x) classify each point and feed the legend, the tooltip and the accessible summary. Selection is an intersection: an x range (drag the bottom axis, or `role="slider"` thumbs by keyboard), a y range, a lasso (`selectionTool="lasso"`) and a zone pick (a Shift/Ctrl-click on a legend entry, or the zone's in-plot tag) — each gesture also emits a `ChartSelectionIntent`. Columnar input (`{ x, y, values, categories }`) or rows; `colorBy` a zone, a continuous column (cell means on the sequential ramp) or a category. `useContainerLegend` gains an `onItemClick` pass-through (unset: unchanged). Registry: `density-scatter-01` — a flight-test envelope, a wafer probe map and an order-fill latency plot.
