---
id: RM-204
title: "Wiring dedupe: ui `mergeRefs`, one `useId` helper, `displayName`, warn-once sets, the datapoint gate seam, cross-family helpers"
status: done
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
  - packages/charts/src/charts/pie-chart.tsx, ring-chart.tsx (the two datapoint-target builders and the duplicated fixed-size / `ParentSize` branches; handed on from RM-202)
  - .changeset/*.md (patch — internal)
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
- PieChart and RingChart share one datapoint-target builder and one sizing branch (the rest of F28 RM-202 left out). The `displayName`/`name` matching copies (`chart-defs.ts`, `facet-scope.tsx`, `pie-ring-engine.ts`) use one helper that matches either name.

## Acceptance

- `pnpm check --rule charts-reuse` green.
- The duplicate list reaches zero: no `useId().replace`, no `typeof ref === "function"` merge and no `displayName || name` outside the helpers (a count in the PR, or a rule fixture).

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule charts-reuse`, `pnpm test:stories` on the touched families.

## Outcome

Every item in `touches` landed except the one explicitly handed back below. 72 files
changed under `packages/charts/src`, net -255 lines (750 insertions, 1005 deletions).

- **Ref merging**: every hand-rolled ref merge (including `Sparkline`'s private copy)
  now calls ui `mergeRefs` — 32 files. `grep 'typeof ref === "function"'` outside the ui
  helper: 0.
- **`useId` helper**: `useSvgId()` (`svg-id.ts`) replaces all 28 `useId().replace(/:/g,
"")` sites (now 27 call sites + the hook itself). `grep 'useId().replace'`: 0.
- **Child-name matching**: `getChartChildComponentName`/`isNamedChartChild`
  (`chart-defs.ts`) is the one place that reads `displayName`/`name` off a child's
  `type`. `facet-scope.tsx`, `pie-ring-engine.ts`, `composed-chart.tsx` and the test
  double (`src/test/doubles.tsx`) all call it now. One copy is deliberately left:
  `chart-context.tsx`'s `seriesSlotOf` — that file is RM-203's (the chart-context split
  landed in parallel on the same base commit), out of this item's `touches`.
- **Warn-once**: `warnChartOnce` (module-level, `chart-breakpoint.ts`) replaces 7 Set +
  4 WeakSet module-level caches — 19 call sites across 12 files. `warnChartOnceFor`
  (the per-instance variant) covers the 3 WeakSet-per-instance users the brief called
  out — Sankey, Dumbbell, Bump — 3 call sites (plus the helper's own tests). Two more
  local (function-scoped, not module-level) `Set`s near a `console.warn`
  (`tree-chart-layout.ts`, `x-axis.tsx`) were left alone: they warn per-call, not
  once-ever, a different contract migrating them would silently change.
- **Datapoint gate**: `ChartDatapointProvider` computes its own `disabled` default
  (`!onDatapointClick && !copyValueOnActivate`); the 15 per-family hand-rolled gates
  are gone. Mutation-tested earlier in this item's work (flipping the default made the
  provider's own test fail).
- **Cross-family helpers**:
  - `spaceSlopeLabels` (`labels/space-slope-labels.ts`) — shared by Dumbbell and Bump,
    byte-identical output verified by both families' existing tests.
  - `findThresholdBand` (`threshold-band.ts`) — shared by Bullet's `findBulletBand` and
    Gauge's `resolveThresholdBand`.
  - `foldTail` (`tail-fold.ts`) — Pie's `groupSmallSlices` and Treemap's `mergeLongTail`
    share the partition/sum/build bookkeeping for their "Other"/long-tail bucket. Their
    SELECTION rules stay separate on purpose: Treemap's threshold stage has a min-count
    floor and its cap stage re-sorts survivors descending, Pie's does neither and never
    folds every slice away — forcing one selection algorithm would have changed either
    family's real output.
  - Heatmap's `dotRadius` now delegates its ratio+sqrt+scale math to the shared
    `areaRadius` (`marks/area-radius.ts`); its own zero/negative guard clause is
    untouched.
- **PieChart/RingChart (handed on from RM-202)**: `RadialChartSizing` unifies the
  fixed-size vs. `ChartParentSize`-measured branch and the `ChartPlotRoot` chrome both
  charts used to duplicate. The other half of that item — one shared datapoint-target
  builder — is **not done**: `pieDatapointTarget`/`ringDatapointTarget` live in
  `pie-context.tsx`/`ring-context.tsx`, which are RM-203's files on this same base
  commit and were left alone as agreed. A follow-up can pick this up once both land.

**Proof**: markup-diff harness (temporary, deleted before the final commit) rendered
every story of every touched family — 547 stories, both themes, base (`origin/main`
@ `4004efd3`) vs. head. 547/547 identical in both themes except a known-noise set (27
light, 21 dark): `Loading`-state shimmer widths, `live-line-chart`'s live timer,
`canvas-layer`/`density-scatter-chart` perf-timing text, and a hover `cursor:
crosshair`/`default` race in the harness's own cleanup step — confirmed by hand on a
sample of each (byte diffs shown are exactly one of those four things, nothing else).
Screenshots (380/600/900px, light+dark, before/after) for one story per touched-family
cluster (Pie, Ring, Bullet, Gauge, Dumbbell, Bump, Treemap, Heatmap) are pixel-identical
and saved to `apps/diagram/.evidence/rm-204/` in the main checkout. `dist/**/*.d.ts`
(chunk-hash-normalized) is unchanged by this item's own commits. `pnpm
--filter @elabs-ai/components-charts typecheck lint test`, `pnpm check` (full, 98/98)
and `pnpm check:changed` all pass; lint stays at the pre-existing 72 warnings / 0
errors.
