---
"@elabs-ai/components-charts": patch
---

Charts look and behave exactly as before; this is internal tidying of shared plumbing.

- Refs on chart roots (including `Sparkline`) are combined the same way everywhere; nothing changes about which ref you can pass or what it points to.
- Generated ids used for chart SVG defs (gradients, clip paths, masks) are produced the same way everywhere.
- Matching a mounted child by component name (used by faceted grids, composed charts, pie/ring engines) uses one shared check everywhere, including components wrapped in `memo`/`forwardRef`.
- A console warning that used to fire once per chart type now reliably fires once per chart type everywhere it appears, including in Sankey, Dumbbell and Bump, which track it per instance instead of globally.
- Whether a chart mounts its click/keyboard datapoint layer is now decided in one place instead of by each chart individually; the observable default (a layer appears only when you pass `onDatapointClick` or `copyValueOnActivate`) is unchanged.
- Dumbbell and Bump space their end-of-line labels with the same shared logic; Bullet and Gauge look up their threshold band with the same shared logic; Pie and Treemap fold their smallest items into an "Other"/long-tail bucket using the same shared bookkeeping (each keeps its own rule for which items fold); Heatmap's dot size now shares its math with every other radius-encoded mark in the package.
- `PieChart` and `RingChart` share one sizing branch for fixed-size vs. auto-measured layouts; both still render pixel-identical output.
