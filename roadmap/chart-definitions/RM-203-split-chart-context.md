---
id: RM-203
title: "Split `ChartContextValue` per family; unify the 5 legend item types and 3 hover contexts"
status: planned
priority: P2
effort: M–L (3 days)
wave: 6
depends_on: [RM-182, RM-183, RM-184, RM-185]
blocks: []
agent: brand-ui-component-builder
model: opus
touches:
  - packages/charts/src/charts/chart-context.tsx (composed-only fields to a Composed sub-provider; bar-private state to a Bar sub-provider; band fields stay as a typed x-scale variant)
  - packages/charts/src/charts/series-bar.tsx, series-bar-layout.ts, composed-chart.tsx, time-series-chart-shell.tsx, bar-chart.tsx (read the sub-providers)
  - packages/charts/src/charts/chart-legend.tsx, legend/legend-context.tsx, pie-grouping.ts, scatter-encodings.ts (one legend item type; the old names stay as type aliases)
  - packages/charts/src/charts/chart-legend-hover.tsx, legend/shared-legend-hover.tsx, profit-loss-legend-hover.tsx (one hover context)
  - .changeset/*.md (minor — internal; public type names kept as aliases)
source: docs/review/2026-09-25-charts-unification-review.md F38, F04
---

# RM-203 Split `ChartContextValue` per family; unify the 5 legend item types and 3 hover contexts

## Finding

- `ChartContextValue` (`chart-context.tsx:403`) carries a bar block (:509-537) and a composed block (:539-554). Only the composed fields are truly family-owned; the bar band-scale fields are read by 12 shared non-test files (tooltip, gesture layer, grid, annotations, analytics, waterfall), so they act as a categorical-x variant of the commons (F38).
- The legend has five item types (`LegendItem`, `LegendItemData`, `PieLegendItem`, `ScatterEncodingLegendItem`, `ChartLegendEntry`) and three hover contexts (F04).

## Change

- Composed-only fields move to a Composed sub-provider; bar-private state (`barColorOf`, `barCrossInset`, `categoryAxisPlan`) to a Bar sub-provider; the band fields stay in the commons as a typed x-scale variant.
- One legend item type and one hover context; old type names remain exported as aliases.

## Acceptance

- Dist `.d.ts` diff: no public change.
- Charts tests green, baselines unchanged.

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm build` (dist `.d.ts` diff attached).
