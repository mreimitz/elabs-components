---
"@elabs-ai/components-charts": patch
---

Charts look and behave exactly as before; this is internal tidying of shared plumbing.

- Refs on chart roots (including `Sparkline`) are combined the same way everywhere; nothing changes about which ref you can pass or what it points to.
- Generated ids used for chart SVG defs (gradients, clip paths, masks) are produced the same way everywhere.
- Matching a mounted child by component name (used by faceted grids and composed charts to find things like a gradient/pattern definition or a post-overlay layer) uses one shared check everywhere, including a child wrapped in `memo` or `forwardRef` — a child named like a gradient or pattern definition is recognised and not painted directly, and a child named like a post-overlay layer (for example a brush) still paints above the pointer layer, whether or not it is wrapped.
- Whether a chart mounts its click/keyboard datapoint layer is now decided in one place instead of by each chart individually. The default is unchanged: a layer appears only when you pass `onDatapointClick` or `copyValueOnActivate`. Two things do change, both for the better: adding `onDatapointClick` (or `copyValueOnActivate`) to a chart after it has already mounted no longer rebuilds the whole chart; and a chart nested inside another chart's own enabled datapoint layer no longer inherits that outer handler — it stays isolated.
- Dumbbell and Bump space their end-of-line labels with the same shared logic; Bullet and Gauge look up their threshold band with the same shared logic; Pie and Treemap fold their smallest items into an "Other"/long-tail bucket using the same shared bookkeeping (each keeps its own rule for which items fold); Heatmap's dot size now shares its math with every other radius-encoded mark in the package.
- `PieChart` and `RingChart` share one sizing branch for fixed-size vs. auto-measured layouts, and now render their loading/empty/ready states through that same branch instead of a separate one — a ref you pass in is no longer torn down and recreated (and keyboard focus no longer lost) the moment loading finishes.
