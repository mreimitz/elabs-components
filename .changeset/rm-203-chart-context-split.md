---
"@elabs-ai/components-charts": patch
---

Charts look and behave exactly as before; this is internal tidying of how chart parts share state.

- Bar and composed charts keep their own layout state apart from the state every chart shares. `useChart()` and `useChartStable()` still return every field they did, including the bar and composed ones.
- `useChart()` now returns the same object from one render to the next while nothing in the chart changed; before, it returned a new object every render. `useChartStable()` keeps the same guarantee as before. A hook that lists either value as an effect dependency no longer re-runs on unrelated renders.
- The legend row types (`LegendItem`, `LegendItemData`, `PieLegendItem`, `ScatterEncodingLegendItem`) are now defined in one place. They keep their names, their fields and whether each field is required, and they are still interfaces you can extend or merge into.
- Series legend hover, the shared legend hover of a faceted chart and the profit/loss legend hover now share one mechanism. `ChartLegendHoverProvider`, `useChartLegendHover`, `ProfitLossLegendHoverProvider` and `useProfitLossLegendHover` work as before, and nesting them still keeps each one separate.
- `PieChart` and `RingChart` now build their contexts from the same shape. `defaultPieColors` and `defaultRingColors` still hold the same twelve colours in two separate arrays, so changing one never changes the other.
