---
id: RM-194
title: "Rename: Heatmap `showLegend` → `legend`; Heatmap and Gantt `loading` → `status`; Heatmap and Choropleth `empty*` → `empty`"
status: planned
priority: P1
effort: M (2 days)
wave: 4
depends_on: [RM-185, RM-190]
blocks: [RM-197, RM-205]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/heatmap/heatmap-chart.tsx (`showLegend` :247, `loading` :280, `emptyMessage` :282, `emptyTitle` :284, `emptyAction` :289)
  - packages/charts/src/gantt/gantt.tsx (`loading` :744)
  - packages/charts/src/charts/choropleth/choropleth-chart.tsx (`emptyTitle` :187, `emptyMessage` :189)
  - packages/charts/src/definitions/heatmap-chart.definition.ts, gantt.definition.ts, choropleth-chart.definition.ts (alias rows 17–24)
  - packages/charts/src/charts/heatmap/heatmap-chart.stories.tsx, packages/charts/src/charts/choropleth/choropleth-chart.stories.tsx (autodocs notes)
  - packages/charts/src/gantt/gantt.stories.tsx (autodocs note)
  - packages/charts/src/charts/heatmap/heatmap-chart.test.tsx, packages/charts/src/charts/choropleth/choropleth-chart.test.tsx (per-alias tests)
  - packages/charts/src/gantt/gantt.test.tsx (per-alias tests)
  - .changeset/*.md (minor — `### Deprecated`: `showLegend`, chart-kind `loading`, `empty*`)
source: docs/review/2026-09-25-charts-unification-review.md F04, F11; ADR 0042 Appendix A.4 (rows 17–24), §9
---

# RM-194 Rename: Heatmap `showLegend` → `legend`; Heatmap and Gantt `loading` → `status`; Heatmap and Choropleth `empty*` → `empty`

## Finding

- Heatmap alone uses `showLegend` (default true) where 11 containers take `legend` (F04).
- Among chart kinds, `status` exists on Line, Area, Composed and Bar; Heatmap and Gantt take `loading` (F11). AutoChart, ChartFrame, ChartCard and MetricGrid are not chart kinds and keep the canonical `loading` (ADR §9, A.9).
- Heatmap's `emptyTitle` / `emptyMessage` / `emptyAction` and Choropleth's `emptyTitle` / `emptyMessage` are the only empty states of their own; they fit the `chart-state` group's `empty: { title?, message?, action? }` (F11).

## Change

Ship ADR 0042 Appendix A.4 exactly:

| #   | Component       | Old            | New             | Transform           | Precedence |
| --- | --------------- | -------------- | --------------- | ------------------- | ---------- |
| 17  | HeatmapChart    | `showLegend`   | `legend`        | `identity`          | new-wins   |
| 18  | HeatmapChart    | `loading`      | `status`        | `loading-to-status` | new-wins   |
| 19  | Gantt           | `loading`      | `status`        | `loading-to-status` | new-wins   |
| 20  | HeatmapChart    | `emptyTitle`   | `empty.title`   | `identity`          | new-wins   |
| 21  | HeatmapChart    | `emptyMessage` | `empty.message` | `identity`          | new-wins   |
| 22  | HeatmapChart    | `emptyAction`  | `empty.action`  | `identity`          | new-wins   |
| 23  | ChoroplethChart | `emptyTitle`   | `empty.title`   | `identity`          | new-wins   |
| 24  | ChoroplethChart | `emptyMessage` | `empty.message` | `identity`          | new-wins   |

- Heatmap keeps its legend default `true`; each family keeps its empty-state defaults. `empty.action` is a `ReactNode`, so it is `codeOnly`.
- A caller who sets only `empty.message` keeps the default title (dotted `to` paths merge per key, RM-170).
- `loading` stays on AutoChart, ChartFrame, ChartCard, MetricGrid and the Line / Area parts (ADR A.9); no fourth loading alias is minted. Gantt's `GanttTask.status` is task data, not a prop, and the ui tone group is never applied here.

## Acceptance

- Per-alias test: the old name renders identically to the new one (DOM equal), warns once in dev and never in production, and the test double stays silent under the default `deprecatedProps: "ignore"`.
- Both names given → the row's precedence decides (test).
- `pnpm check --rule charts-deprecated-usage` green: no internal caller, story, doc or template uses an old name.
- Each renamed prop carries `@deprecated` TSDoc naming the replacement, an autodocs note, and a `### Deprecated` bullet in the changeset (`docs/DEPRECATION.md` in full).
- `loading={true}` and `status="loading"` show the same skeleton at the same time on Heatmap and Gantt (test).

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule charts-deprecated-usage,charts-group-drift,chart-default-prose`, `pnpm gen && pnpm gen:check` (the codemod map gains the rows), Storybook autodocs notes checked in Chromium.
