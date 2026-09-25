---
"@elabs-ai/components-charts": minor
---

Every chart now follows the `interactions` you set on `ChartConfigProvider` or `ChartFrame`. Before, only `ChartTooltip`, `ChartBrush` and the keyboard datapoint targets listened. The other charts kept their own tooltips, zoom and drag whatever the host said.

- `passive: false` hides every hover tooltip. That now includes the heatmap, treemap, tree, network, sankey, choropleth, unit, bump, dumbbell, parallel-coordinates, distribution, density-scatter and Gantt tooltips, the canvas layer's hover, the `Sparkline` hover and keyboard readout (as if you had set `interactive={false}`), and any `ChartTooltipBox` you mount yourself.
- `active: false` turns off direct manipulation. The navigator strip stays as a read-only overview with no handles, drag or wheel pan. Pinch, Ctrl/⌘-wheel and `+` / `−` / `0` zoom stop, and the zoom buttons are not shown. Pan and zoom stop on the density scatter, the choropleth and the tree (a zoomable tree also stops scrolling under the wheel, trackpad or touch), and so do the tree's minimap clicks, network node drag, Gantt bar drag, Gantt zoom, the Gantt keyboard moves, resizes and dependency links, Gantt column resizing, and the selection gestures (range, rectangle, lasso, radial).
- `select: false` stops a click or Enter on the canvas layer from activating a point, stops the density scatter's zone tags from selecting, and stops the selection gestures from emitting.

New: `useChartInteractionPolicy()` returns the resolved switches, `{ passive, active, select, edit }`, so your own chart parts can follow the same policy.
