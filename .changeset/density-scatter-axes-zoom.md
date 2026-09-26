---
"@elabs-ai/components-charts": minor
---

`DensityScatterChart` axes and zoom.

- **Auto gutters**: unless `margin.left` / `margin.right` / `margin.bottom` are given, the left gutter fits the widest y tick label plus the y title, the right gutter fits half of the last x label, and the bottom gutter shrinks when labels or the title are off. Long numbers are no longer clipped, and the y title no longer sits on the tick labels.
- **`xAxis` / `yAxis`**: `{ labels?: boolean; tickSpacing?: number }`. Hide the tick labels (the grid stays), or set how far apart ticks and grid lines are.
- **Zoom controls**: `+` / `−` / reset buttons (`ChartZoomControls`, the package convention) appear while the chart is zoomed.
- **Minimap**: while zoomed, a small overview in the plot's bottom-right corner shows every point at the home window and the current window as a frame. Drag in it to pan. Turn it off with `minimap={false}`.
- **Re-homing**: an uncontrolled window resets to the new home when the home window changes (`domain`, or the data's extent). Before, a zoom made before a selection could leave the new data off-screen.

- **Steady zoom**: fitted gutters snap to 8 px steps and only grow while zoomed, so the plot, the zoom controls and the minimap no longer shake as labels change width.
- **Axis ranges, BI-suite style**: dragging along an axis draws a strip on the axis, an edge line across the plot at each bound, and a bound bubble at each edge (theme it with `--chart-range`). The grey band over the plot is gone.
- **Sizes**: `sizeKey` + `sizeRange` scale each dot by a value column (by area), on WebGL and the Canvas-2D fallback.
- **Visibility**: `pointOpacity` multiplies the dots' opacity; `densityFloor` sets how light a lone dot may get (raise it to keep sparse and outside dots visible).
- **Host tools**: `selectionTool` controls the active tool (for a host with its own selection toolbar); `onPointClick(index)` reports a click on a dot; `selection.points` picks rows one by one, unioned with the other constraints.

Fix: the wheel-zoom listener now follows the plot element. Before, a plot that re-mounted after the first render (for example when the selection toolbar or legend wrapper appeared later) lost wheel zoom.
