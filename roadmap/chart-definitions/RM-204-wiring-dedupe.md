---
id: RM-204
title: "Wiring dedupe: ui `mergeRefs`, one `useId` helper, `displayName`, warn-once sets, the datapoint gate seam, cross-family helpers"
status: planned
priority: P2
effort: M–L (3 days)
wave: 6
depends_on: [RM-182, RM-183, RM-184, RM-185]
blocks: []
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/chart-defs.ts (`getChartChildComponentName` matches `memo()` components; the 20+ inline `displayName || name` copies use it)
  - packages/charts/src/charts/svg-id.ts (one hook for the 28 `useId().replace(/:/g, "")` sites)
  - packages/charts/src/charts/chart-datapoint-layer.tsx (`ChartDatapointProvider` computes `disabled` itself; the 15 hand-rolled gates go)
  - packages/charts/src/charts/chart-breakpoint.ts (`warnChartOnce` gains a per-instance variant for the WeakSet users: Sankey, Dumbbell, Bump)
  - packages/charts/src/charts/dumbbell-chart.tsx, bump-chart.tsx (`spaceSlopeLabels` moves to a shared labels module)
  - packages/charts/src/charts/bullet-chart.tsx, gauge.tsx (one threshold-band lookup)
  - packages/charts/src/charts/pie-grouping.ts, packages/charts/src/charts/treemap/treemap-layout.ts (one other-folding helper)
  - packages/charts/src/charts/heatmap/heatmap-scale.ts (dot radius through `areaRadius`)
  - packages/charts/src/sparkline/sparkline.tsx (its private `mergeRefs` copy goes)
  - the ~28 files that hand-roll ref merging (ui `mergeRefs`); the 13 module-level warn-once sets
  - .changeset/*.md (minor — internal)
source: docs/review/2026-09-25-charts-unification-review.md F13, F31, F34
---

# RM-204 Wiring dedupe: ui `mergeRefs`, one `useId` helper, `displayName`, warn-once sets, the datapoint gate seam, cross-family helpers

## Finding

- Container wiring is copy-pasted: the datapoint gate in 15 families, navigator re-packing (10 / 9 / 8 fields), gesture re-packing twice per cartesian family, hand-rolled `mergedRef` while ui `mergeRefs` exists (F13).
- `getChartChildComponentName` is exported but used only inside `chart-defs.ts` and misses `memo()` components, so 20+ inline `displayName || name` copies exist; 28 `useId().replace` sites; about 28 files hand-roll ref merging; 13 module-level warn-once sets, three of them per-instance `WeakSet`s (F31).
- Cross-family helpers live inside one family: `spaceSlopeLabels` in Dumbbell (imported by Bump), threshold-band lookup twice (Bullet, Gauge), other-folding twice (Pie, Treemap), a near-copy of `areaRadius` in Heatmap (F34).

## Change

- Each duplicate goes to the one existing helper (or a small new one next to it), and the copies are deleted.
- The datapoint gate becomes the provider's own `disabled` computation.

## Acceptance

- `pnpm check --rule charts-reuse` green.
- The duplicate list reaches zero: no `useId().replace`, no `typeof ref === "function"` merge and no `displayName || name` outside the helpers (a count in the PR, or a rule fixture).

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule charts-reuse`, `pnpm test:stories` on the touched families.
