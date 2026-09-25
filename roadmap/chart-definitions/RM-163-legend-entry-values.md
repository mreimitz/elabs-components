---
id: RM-163
title: "Legend values: `ChartLegendEntry.value`, filled by every legend caller"
status: in-progress
priority: P0
effort: M (2 days)
wave: 1
depends_on: []
blocks: [RM-182, RM-183, RM-184, RM-185]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/chart-context.tsx (`ChartLegendEntry.value?: number`)
  - packages/charts/src/charts/legend/use-container-legend.ts (forward `entry.value`; the hard-coded `value: 0` at :228 goes)
  - packages/charts/src/charts/chart-legend.tsx (an item with no value renders no value cell, :265-268)
  - packages/charts/src/charts/line-chart.tsx, area-chart.tsx, composed-chart.tsx, bar-chart.tsx, scatter-chart.tsx, pie-chart.tsx, funnel-chart.tsx, radar-chart.tsx, dumbbell-chart.tsx (fill `value`)
  - packages/charts/src/charts/treemap/treemap-chart.tsx, packages/charts/src/charts/density-scatter/density-scatter-chart.tsx (fill `value`)
  - packages/charts/src/charts/time-series-chart-shell.tsx (series figures for Line, Area and Composed)
  - packages/charts/src/charts/selection/container-selection.tsx, packages/charts/src/charts/analytics/analytics-context.tsx (the entries they add carry `value` or none)
  - packages/charts/src/charts/legend/use-container-legend.test.tsx, packages/charts/src/charts/chart-legend.test.tsx (value-column tests)
  - .changeset/*.md (minor — adds `ChartLegendEntry.value`)
source: docs/review/2026-09-25-charts-unification-review.md F09
---

# RM-163 Legend values: `ChartLegendEntry.value`, filled by every legend caller

## Finding

- `useContainerLegend` builds every legend item with a hard-coded `value: 0` (`use-container-legend.ts:228`) yet sets `showValue: configProp?.values === true` (:266).
- `ChartLegendEntry` (`chart-context.tsx:336-348`) has no value field; neither has the analytics overlay entry.
- So `legend={{ values: true }}` renders `formatValue(0)` — "0" — in every item's value column (`chart-legend.tsx:265-268`). The prop's own doc (`use-container-legend.ts:62`) admits most containers' items carry no value.

## Change

- `ChartLegendEntry` gains `value?: number`: the figure the legend row stands for (a series total over the plotted rows for series families; the slice or stage value for part-to-whole families). A caller with no single figure leaves it `undefined`.
- The 11 `useContainerLegend` callers (Line, Area, Composed, Bar, Scatter, Pie, Funnel, Radar, Dumbbell, Treemap, DensityScatter), `time-series-chart-shell`, `container-selection` and `analytics-context` fill it.
- `useContainerLegend` forwards `entry.value`. An item whose `value` is `undefined` renders no value cell — never "0".
- The values in one legend form one scale, so they are formatted with the set formatter (`useChartValueSetFormatter`, rule #250), not per value.

## Acceptance

- Bar, Line and Pie with `legend={{ values: true }}` show non-zero formatted values that match the data; the tests assert the exact strings.
- A family whose entries carry no `value` renders no value cell.
- One legend never mixes notations (no "1K" beside "400").
- `legend` without `values` is DOM-identical to today.

## Test / gate

`pnpm --filter @elabs-ai/components-charts test` (legend, chart-legend and the three family tests), `pnpm check --rule locale-formatting,charts-responsive`, Storybook legend-values stories in Chromium, light and dark.

## Orchestrator notes

`use-container-legend.ts` is also touched by RM-173 (types move to a pure leaf); merge this item first.
