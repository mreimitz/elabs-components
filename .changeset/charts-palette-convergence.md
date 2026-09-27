---
"@elabs-ai/components-charts": minor
---

Every chart family except `Gantt` now takes the same `palette` prop (`"categorical"`, `"sequential"`, `"diverging"`, `"mono"` or `"accent"`), and the colours it names come from one place. With no `palette` set, every chart draws the colours it drew before; the one exception is the `BarChart` colour-key boundary described below.

- `LineChart`, `AreaChart`, `ComposedChart`, `ScatterChart`, `LiveLineChart`, `PieChart`, `RingChart`, `RadarChart`, `SankeyChart`, `ChoroplethChart`, `DensityScatterChart`, `BulletChart`, `FunnelChart`, `CandlestickChart` and `WaterfallChart` gain `palette`. On a series chart it colours each series that has no colour of its own, in order; a series with its own `stroke` or `fill` keeps it. `LineChart` and `AreaChart` keep their single lead-line colour when `palette` is unset.
- On `CandlestickChart` and `WaterfallChart`, `palette="diverging"` draws gains and losses with the two ends of the diverging ramp; any other palette uses its first two colours. On `CandlestickChart` this includes the patterns its candles get at high decoration. An explicit `positiveFill` or `negativeFill` on `WaterfallChart` still wins.
- `chartCssVars` gains `signPositive` and `signNegative`, the colours of a gain and a loss. They point at the two ends of the existing diverging ramp, so no new token is needed. The two share one lightness, so a chart using them needs a second cue beside colour, such as an arrow's direction.
- On a `BarChart` with a numeric `colorBy`, a value that lies exactly on a colour-key boundary now falls into the upper bucket, the same as on `ScatterChart`. Before, some such values fell one bucket lower.
- `resolveColorBy` takes an optional third argument, `ResolveColorByOptions`, and its result now also carries the colour-key `items` beside `legend`. Called with two arguments it behaves exactly as before. `ResolveColorByOptions` and `ResolvedColorBy` are exported.
