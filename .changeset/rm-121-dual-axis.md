---
"@elabs-ai/components-charts": minor
"@elabs-ai/components-ui": minor
---

Dual-axis `ComposedChart`. New `yAxes={{ align, proportional, zero }}` prop: `align: "ticks"` (the default once `yAxes` is set) gives both value axes the same tick count on the same pixel rows and draws the grid on those rows; `proportional` makes both scales grow by the same factor from one shared origin; `zero: "both" | "auto"` applies the "both or neither" baseline rule. Columns and areas stay zero-based whatever is asked. `YAxis` gains `matchSeriesColor` (tick labels and title in the axis' series colour when it carries exactly one series) and `sideLabel` (`"auto"` reads "Left scale" / "Right scale" from the new `charts.axis.leftScale` / `charts.axis.rightScale` messages in `@elabs-ai/components-ui`). The container legend gains `layout: "split"`, one row per axis led by its side label (side by side at medium and wide widths, stacked at narrow), and `ChartTooltip variant="table"` groups its columns under the same side headers. `ComposedChart stacked="percent"` stacks each x's columns to 100 %, pins the primary `YAxis` to 0–100 % and prints percent unless the axis sets its own format; the tooltip keeps the raw values.

No default changes: a `ComposedChart` without `yAxes`, `stacked="percent"` or the new `YAxis` props renders as before.
