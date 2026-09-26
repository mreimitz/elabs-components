---
"@elabs-ai/components-charts": minor
---

Charts measure their size, wait out a resize and decide on reduced motion the same way everywhere. With no new props set, every chart draws at the same size as before.

- `LineChartLoading` and `AreaChartLoading` gain `plotHeight`: pixels, `{ aspect }`, or a value per breakpoint, as on the chart they stand in for. It wins over `aspectRatio`, so the placeholder holds the box the loaded chart will fill.
- A `DumbbellChart` with `groupBy` inside a `ChartFrame` or host with a fixed plot height now fills that height, instead of sizing itself to the default 2:1 box plus its group headers.
- Every chart now redraws 100 ms after a resize settles, the pause `AreaChart`, `BarChart` and `RadarChart` already used. Charts that redrew sooner, or on every resize step, now wait for the same pause.
- `NetworkChart` nodes, the chart reveal clip and `LiveLineChart` now follow the person's motion setting from the theme before the operating system's, like the other charts.
- A non-default `enterStaggerScale` on `PieChart`, `RingChart` and `Gauge`, or `staggerScale` on `RadarChart`, now only changes the gap between items. It no longer stretches the delay before the first item starts. The defaults are unchanged.
