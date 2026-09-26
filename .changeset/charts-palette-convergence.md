---
"@elabs-ai/components-charts": minor
---

Every chart family now takes the same `palette` prop (`"categorical"`, `"sequential"`, `"diverging"`, `"mono"` or `"accent"`), and the colours it names come from one place. With no `palette` set, every chart draws exactly the colours it drew before.

- `LineChart`, `AreaChart`, `ComposedChart`, `ScatterChart`, `LiveLineChart`, `PieChart`, `RingChart`, `RadarChart`, `SankeyChart`, `ChoroplethChart`, `DensityScatterChart`, `BulletChart`, `FunnelChart`, `CandlestickChart` and `WaterfallChart` gain `palette`. On a series chart it colours each series that has no colour of its own, in order; a series with its own `stroke` or `fill` keeps it. `LineChart` and `AreaChart` keep their single lead-line colour when `palette` is unset.
- On `CandlestickChart` and `WaterfallChart`, `palette="diverging"` draws gains and losses with the two ends of the diverging ramp; any other palette uses its first two colours. An explicit `positiveFill` or `negativeFill` on `WaterfallChart` still wins.
- `resolveColorBy` takes an optional third argument, `ResolveColorByOptions`, and its result now also carries the colour-key `items` beside `legend`. Called with two arguments it behaves exactly as before. `ResolveColorByOptions` and `ResolvedColorBy` are exported.
