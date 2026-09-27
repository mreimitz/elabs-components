---
"@elabs-ai/components-charts": minor
---

Nothing looks different: `BarChart`, `ScatterChart` and `CandlestickChart` now share the line and area charts' reveal, phase-report, value-axis and nearest-row hooks, and `ScatterChart` uses the same pointer hook as every other cartesian chart instead of its own copy.

Two fixes come with it:

- `BarChart`'s hover readout now finds a grouped bar where it is painted when a `<Bar groupGap>` other than 4 is set. It used to assume 4 px, so with `groupGap={12}` the tooltip dots sat a few pixels beside the bars.
- `BarChart` now paints a `ChartBrush` child above its bars, overlays and labels, as the line and area charts do, so the brush stays draggable wherever it is listed among the children.

`ScatterChart`'s touch handling now matches the line chart's: a tap shows the readout at once rather than on the next frame, and it no longer calls `preventDefault()` on touch events (the browser ignored those calls and logged a console warning).
