---
"@elabs-ai/components-charts": minor
---

`legend={{ values: true }}` now prints real numbers. Before, every entry showed 0. What the number means depends on the chart. `BarChart`, `RadarChart` and `DumbbellChart` show each series' total. `LineChart`, `AreaChart` and `ComposedChart` show each series' last value inside the visible window, and it updates as you move the navigator, zoom or set `xDomain`. `PieChart` shows each slice's value, `TreemapChart` each group's total, and `FunnelChart` the first stage. `ScatterChart` and `DensityScatterChart` show how many points each entry covers.

Values use the chart's own number format: the value axis `valueFormat`, or the chart's `valueFormat` or `formatValue`. An entry with no number of its own, such as a bar overlay or a computed trend line, leaves its value blank instead of showing 0.

`ChartLegendEntry` has a new optional `value` field. `ChartLegend` leaves the value blank for an item whose `value` is `NaN`.
