---
"@elabs-ai/components-charts": minor
---

Charts show a tooltip on hover by default. `LineChart`, `AreaChart`, `BarChart`, `ScatterChart`, `ComposedChart` and `CandlestickChart` used to show one only when you added a `<ChartTooltip />` child. Now a chart without one adds a default `<ChartTooltip />` itself. A `<ChartTooltip>` child you pass (for `variant`, `rows`, `content`, …) still replaces the default, and `tooltip={false}` turns it off. If your own component renders `<ChartTooltip>` inside it, pass `tooltip={false}` next to it, or you will see two tooltips. `ChartFrame`/`ChartConfigProvider` `interactions={{ passive: false }}` still silences all hover feedback.

A `BarChart`'s default tooltip also lists its `overlays` and `comparison` column: a range reads as "lo–hi", a value marker as one figure, each with its legend colour. Before this, a chart drawn only in overlays (a range plot) hovered to an empty box.

`Sparkline` now shows its values on hover and keyboard focus. A small box names the point and gives its value, plus the baseline, target and normal range when the sparkline draws them. With the sparkline focused, arrow keys step through the points, Home/End jump to the ends, and Escape closes the box. New props: `interactive` (default `true`; pass `false` for a sparkline inside a link or button, or one used as decoration) and `pointLabels` (index-aligned names such as `"Week 34"`). `labels.value` renames the value row.
