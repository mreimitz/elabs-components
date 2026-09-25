---
"@elabs-ai/components-charts": minor
---

`ChartBrush` now honours its `selection` prop. Pass a `{ start, end }` window (or `null`) and the brush draws exactly that window; hand back the value `onSelectionChange` reports and a drag keeps going, while any other value (a reset button, a linked chart) moves the window there. Before, `selection` was accepted but ignored.

The package now exports the types its chart props already use: `WaterfallLabelsConfig`, `WaterfallDataFormat`, `WaterfallSort`, `WaterfallEndpointOptions`, `DumbbellDeltaConfig`, `DumbbellValueAxisConfig`, `GaugeThreshold` and `GaugeLabels`.

`MetricGrid` forwards a `ref` to its grid element, the same element that receives `className`.

Deprecated: `<Scatter trend>` is now marked `@deprecated` in its type docs, not only by its one-time runtime warning. Pass `analytics={[{ kind: "trend", of: dataKey, model }]}` on `ScatterChart` instead, which also adds the legend entry and the tooltip row. The `trend` prop keeps working until its removal in 6.0.0.
