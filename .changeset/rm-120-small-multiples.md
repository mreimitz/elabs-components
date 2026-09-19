---
"@elabs-ai/components-charts": minor
---

Add `ChartMultiples` (small multiples): one chart per facet value (`by` column, `{ series: true }` or explicit `panels`) in a responsive grid, with shared or range-rounded independent y scales, panel sort (start / end / delta / % change / range / title), a muted repeated baseline, synced hover with the hovered value in each panel title (Line, Area and Composed panels), and per-breakpoint panel visibility (`showAt`). `ChartSpec.facet` renders the same grid through `AutoChart` (split bars: `facet.by = { series: true }`; multiple pies: `facet.by = "region"`), and a line spec with six or more series logs a dev hint suggesting `facet`. Nothing is deprecated; charts outside a `ChartMultiples` panel render unchanged.
