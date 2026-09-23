---
"@elabs-ai/components-charts": patch
---

Hover-only chart legend items (Pie, Scatter, Treemap, Dumbbell, and any `ChartLegend`/container legend left at the default `interactive: "hover"`) are now real, focusable buttons instead of plain unfocusable rows. Tab reaches every legend item and focusing one applies the same highlight hovering it with a mouse does; these items are not toggles, so they still carry no `aria-pressed` and no click behaviour.
