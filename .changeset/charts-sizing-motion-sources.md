---
"@elabs-ai/components-charts": minor
---

Charts measure their size, wait out a resize and decide on reduced motion the same way everywhere. With no new props set, every chart draws at the same size as before.

- `LineChartLoading` and `AreaChartLoading` gain `plotHeight`: pixels, `{ aspect }`, or a value per breakpoint, as on the chart they stand in for. It wins over `aspectRatio`, so the placeholder holds the box the loaded chart will fill.
- A `DumbbellChart` with `groupBy` inside a `ChartFrame` or host with a fixed plot height now starts from that plot height and adds the room its group headers need, instead of starting from the default 2:1 box. The chart is therefore taller than the plot height by its header rows.
- Charts redraw as soon as their box changes size. A run of changes, such as dragging a panel edge, ends with one more redraw 100 ms after it stops; in between, the chart keeps the size of the first step. `AreaChart`, `BarChart` and `RadarChart` already worked this way, and `SankeyChart` waited 300 ms. Every other chart, including `CanvasLayer` and `DensityScatterChart`, used to follow each step of a drag within about 10 ms and now waits for the drag to pause.
- `NetworkChart` nodes, the chart reveal clip and `LiveLineChart` now follow the person's motion setting from the theme before the operating system's, like the other charts.
- A non-default `enterStaggerScale` on `PieChart`, `RingChart` and `Gauge` now only changes the gap between items. It no longer stretches the delay before the first item starts. The defaults are unchanged.
- `RadarChart` changes only with a non-default `enterDurationMs`: the wait before the series appear now grows once with the duration, not twice. At the default duration nothing changes, whatever `staggerScale` is.
