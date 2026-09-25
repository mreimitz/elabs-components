---
id: RM-195
title: "Rename: interaction names (`zoom`, `windowSeconds`, Sankey hover, `plotAlign`); `highlightKey` type widening"
status: planned
priority: P1
effort: M–L (3 days)
wave: 4
depends_on: [RM-182, RM-183, RM-184, RM-185, RM-188, RM-190]
blocks: [RM-197, RM-205]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/choropleth/choropleth-chart.tsx (`zoomEnabled` :195; `zoomControls` still turns zoom on)
  - packages/charts/src/charts/tree-chart.tsx (`zoomable` :284, `align` :307)
  - packages/charts/src/charts/live-line-chart.tsx (`window` :50)
  - packages/charts/src/charts/sankey/sankey-chart.tsx (`hoveredNodeIndex` :73, `onNodeHoverChange` :75; the controlled check :242 runs after alias resolution)
  - packages/charts/src/charts/pie-chart.tsx (`align` :200)
  - packages/charts/src/charts/bump-chart.tsx (`highlightKey` :106), parallel-coordinates/parallel-coordinates-chart.tsx (`highlightKey` :127) (type widened to Bar's; no alias)
  - packages/charts/src/definitions/choropleth-chart.definition.ts, tree-chart.definition.ts, live-line-chart.definition.ts, sankey-chart.definition.ts, pie-chart.definition.ts (alias rows 25–31)
  - packages/charts/src/charts/tree-chart.stories.tsx, live-line-chart.stories.tsx, pie-chart.stories.tsx, choropleth/choropleth-chart.stories.tsx, sankey/sankey-chart.stories.tsx (autodocs notes)
  - packages/charts/src/charts/tree-chart.test.tsx, live-line-chart.test.tsx, pie-chart.test.tsx, choropleth/choropleth-chart.test.tsx, sankey/sankey-chart.test.tsx (per-alias tests)
  - .changeset/*.md (minor — `### Deprecated`: `zoomEnabled`, `zoomable`, LiveLine `window`, Sankey node hover names, Pie / Tree `align`)
source: docs/review/2026-09-25-charts-unification-review.md F21; ADR 0042 Appendix A.5 (rows 25–31), A.7
---

# RM-195 Rename: interaction names (`zoom`, `windowSeconds`, Sankey hover, `plotAlign`); `highlightKey` type widening

## Finding

- Zoom is `zoom` on the navigator commons and DensityScatter, `zoomEnabled` on Choropleth and `zoomable` on Tree (F21).
- `window` is a `NavigatorWindow` object on the navigator commons but a number of seconds on LiveLineChart (F21).
- Controlled hover is `hoveredIndex` / `onHoverChange` on Pie, Ring, Radar, Funnel and `Legend`; Sankey alone uses `hoveredNodeIndex` / `onNodeHoverChange` (F21).
- `align` is a navigator member (where the first window sits) but plot placement on Pie and Tree — a different concept and value set.
- `highlightKey` has four shapes; Bump and Parallel take a narrower type than Bar although a string or number is a key value on all three (F21).

## Change

Ship ADR 0042 Appendix A.5 exactly:

| #   | Component       | Old                 | New             | Transform  | Precedence |
| --- | --------------- | ------------------- | --------------- | ---------- | ---------- |
| 25  | ChoroplethChart | `zoomEnabled`       | `zoom`          | `identity` | new-wins   |
| 26  | TreeChart       | `zoomable`          | `zoom`          | `identity` | new-wins   |
| 27  | LiveLineChart   | `window`            | `windowSeconds` | `identity` | new-wins   |
| 28  | SankeyChart     | `hoveredNodeIndex`  | `hoveredIndex`  | `identity` | new-wins   |
| 29  | SankeyChart     | `onNodeHoverChange` | `onHoverChange` | `identity` | new-wins   |
| 30  | PieChart        | `align`             | `plotAlign`     | `identity` | new-wins   |
| 31  | TreeChart       | `align`             | `plotAlign`     | `identity` | new-wins   |

- Defaults stay per kind (Choropleth and Tree zoom `false`; LiveLine 30 s).
- Sankey resolves aliases before its controlled check, so either name controls hover.
- A.7: Bump and Parallel `highlightKey` widen to Bar's `string | number | ((datum, index) => boolean)` — a type widening with no alias row and no warning.
- Not renamed (ADR A.9): Heatmap `highlight`, Network `emphasis`, Scatter `highlightKey`, Choropleth `zoomMin` / `zoomMax` / `initialZoom` / `zoomControls`, Tree `zoomRange` / `defaultZoom`.

## Acceptance

- Per-alias test: the old name renders identically to the new one (DOM equal), warns once in dev and never in production, and the test double stays silent under the default `deprecatedProps: "ignore"`.
- Both names given → the row's precedence decides (test).
- `pnpm check --rule charts-deprecated-usage` green: no internal caller, story, doc or template uses an old name.
- Each renamed prop carries `@deprecated` TSDoc naming the replacement, an autodocs note, and a `### Deprecated` bullet in the changeset (`docs/DEPRECATION.md` in full).
- Choropleth `zoomControls` alone still turns zoom on (test).
- Keyboard zoom and hover paths are exercised in play functions on Choropleth, Tree and Sankey.

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule charts-deprecated-usage,charts-group-drift,chart-default-prose`, `pnpm gen && pnpm gen:check` (the codemod map gains the rows), Storybook autodocs notes checked in Chromium. `pnpm test:stories` on the five families (keyboard paths).
