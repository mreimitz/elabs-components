---
"@elabs-ai/components-cli": minor
"@elabs-ai/components-charts": minor
---

`brand-ui chart-for` and the `chart_for` MCP tool now print a `binds:` line under each
candidate — the data roles (dimension/measure) that container's props bind to, e.g.
`binds: Column (dimension), Row (dimension), Value (measure)` for `HeatmapChart`. It reads the
same committed definitions snapshot the ranking already used, so no new file ships and no
command gets slower.

The `skills/brand-ui/reference/chart-selection.md` and `components.md` reference docs are
now partly generated: the "Container → key props" / "Key props" cells in the two
chart-selection tables, and the "KPIs / charts" chart-type count, are read from each chart's
own definition instead of hand-typed, so they can no longer claim a prop a container doesn't
have or a stale chart count. Six rows in the shape tables now list the container's real props
(`RingChart`, `ChoroplethChart`, `Gauge`, `ParallelCoordinatesChart`, `NetworkChart`, `Gantt`).

`@elabs-ai/components-charts` gains an internal `argTypesFromDefinition(def)` helper
(`definitions/arg-types.ts`, stories-only — it never ships in a runtime bundle): turns a
chart definition's own fields into Storybook `argTypes`, grouped by prop group and with a
deprecated field routed to its own "Deprecated" category and control disabled, so a story no
longer hand-keeps an `argTypes` block that can drift from the real props.
