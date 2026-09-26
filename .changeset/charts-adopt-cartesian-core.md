---
"@elabs-ai/components-charts": minor
---

The cartesian charts — `LineChart`, `AreaChart`, `ComposedChart`, `BarChart`, `ScatterChart`, `CandlestickChart`, `LiveLineChart` and `WaterfallChart` — now share one set of sizing, loading, legend, tooltip and value-format props, and take their defaults from one place. With no new props set, every chart draws exactly as before.

- `ScatterChart`, `CandlestickChart`, `LiveLineChart` and `WaterfallChart` gain `status`. `status="loading"` shows a skeleton in the plot box the chart will fill, with one polite "Loading chart…" message, so nothing moves when the data arrives. The default is `"ready"`.
- `LiveLineChart` gains `plotHeight`: pixels, `{ aspect }`, or a value per breakpoint. The default stays 300 px, and a caller's `style.height` still wins. Inside a host or a `ChartFrame` that sets a plot height, a live line chart now follows it, like every other cartesian chart.
- `margin` on all eight charts also takes a single number for every side, beside the per-side object it took before.
