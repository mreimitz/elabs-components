---
"@elabs-ai/components-cli": minor
---

`brand-ui chart-for` and the `chart_for` MCP tool now print a `binds:` line under each
candidate — the prop each data role binds to, not just the role, e.g.
`binds: Column → xDataKey (dimension), Row → yDataKey (dimension), Value → valueKey
(measure)` for `HeatmapChart`. The ranking itself still works the way it always has, parsing
each container's `@dataShape`/`@avoidWhen` JSDoc docblocks straight from source at the CLI's
base; only this new `binds:` line (and the two doc-table cells below) additionally read the
committed definitions snapshot, so no new file ships and the ranking itself gets no slower.

The `skills/brand-ui/reference/chart-selection.md` and `components.md` reference docs are
now partly generated: the "Container → key props" / "Key props", Shape, and Avoid-when cells
in the two chart-selection tables are read from each chart's own definition instead of
hand-typed, so they can no longer claim a prop, a data shape or an avoid-when a container
doesn't actually have. Six rows in the shape tables now list the container's real props
(`RingChart`, `ChoroplethChart`, `Gauge`, `ParallelCoordinatesChart`, `NetworkChart`,
`Gantt`).

Separately, the chart-type count in `components.md` and the two-table split summary in
`chart-selection.md` are now their own generated line each, counted straight from the
registry instead of hand-typed — so a new or removed chart container can no longer leave a
stale count behind in either file.
