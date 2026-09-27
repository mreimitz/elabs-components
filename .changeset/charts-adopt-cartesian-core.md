---
"@elabs-ai/components-charts": minor
---

The cartesian charts — `LineChart`, `AreaChart`, `ComposedChart`, `BarChart`, `ScatterChart`, `CandlestickChart`, `LiveLineChart` and `WaterfallChart` — now share one set of sizing, loading, legend, tooltip and value-format props, and take their defaults from one place. With no new props set, every chart except `LiveLineChart` inside a `ChartFrame` or host draws exactly as before (see below).

- `ScatterChart`, `CandlestickChart`, `LiveLineChart` and `WaterfallChart` gain `status`. `status="loading"` shows a skeleton in the plot box the chart will fill, with one polite "Loading chart…" message, so nothing moves when the data arrives. The default is `"ready"`.
- `LiveLineChart` gains `plotHeight`: pixels, `{ aspect }`, or a value per breakpoint, and a caller's `style.height` still wins. Standalone it stays 300 px. Inside a host or a `ChartFrame`, a live line chart now follows the frame's plot height, or fills a tile, like every other cartesian chart. A `ChartFrame` with no plot height of its own no longer holds its 260 px body around a live line chart: the frame is as tall as the chart's 300 px plot plus its title and footer.
- `margin` on all eight charts also takes a single number for every side, beside the per-side object it took before.
