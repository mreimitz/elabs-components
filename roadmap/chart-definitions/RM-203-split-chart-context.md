---
id: RM-203
title: "Split `ChartContextValue` per family; unify the 5 legend item types and 3 hover contexts"
status: done
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
  - packages/charts/src/charts/pie-chart.tsx, ring-chart.tsx (their two contexts, each carrying a 12-colour list; handed on from RM-202)
  - .changeset/*.md (patch — internal; public type names kept as aliases)
source: docs/review/2026-09-25-charts-unification-review.md F38, F04
---

# RM-203 Split `ChartContextValue` per family; unify the 5 legend item types and 3 hover contexts

## Finding

- `ChartContextValue` (`chart-context.tsx:403`) carries a bar block (:509-537) and a composed block (:539-554). Only the composed fields are truly family-owned; the bar band-scale fields are read by 12 shared non-test files (tooltip, gesture layer, grid, annotations, analytics, waterfall), so they act as a categorical-x variant of the commons (F38).
- The legend has five item types (`LegendItem`, `LegendItemData`, `PieLegendItem`, `ScatterEncodingLegendItem`, `ChartLegendEntry`) and three hover contexts (F04).

## Change

- Composed-only fields move to a Composed sub-provider; bar-private state (`barColorOf`, `barCrossInset`, `categoryAxisPlan`) to a Bar sub-provider; the band fields stay in the commons as a typed x-scale variant.
- One legend item type and one hover context; old type names remain exported as aliases.
- PieChart and RingChart contexts converge on one shape, with one colour list (the part of F28 RM-202 left out).

## Acceptance

- Dist `.d.ts` diff: no public change.
- Charts tests green, baselines unchanged.

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm build` (dist `.d.ts` diff attached).

## Outcome

Built on `charts/rm-203-split-chart-context` (from `2dbd7910`, `origin/main` merged in after;
RM-204 had not landed on `main` when this finished, so there was nothing of it to reconcile).

**What moved.**

- `chart-context.tsx` (993 → 977 lines): `ChartContextValue` is now the commons plus a named
  `ChartBandXScaleFields` block (the categorical x-scale variant — `barScale`, `bandWidth`,
  `stacked`, `stackOffsets`, …, still read by the shared layers) and extends two new internal
  shapes. `bar-chart-context.tsx` (53 lines) holds `categoryAxisPlan`, `barColorOf` and
  `barCrossInset`; `composed-chart-context.tsx` (81 lines) holds the seven `composed*` fields.
  Families still hand `ChartProvider` one value; the provider routes those ten fields into the
  two sub-providers, and `Bar`, `BarXAxis`, `BarYAxis` and `SeriesBar` read their sub-context
  directly. `useChart()` and `useChartStable()` merge the sub-contexts back in, memoised, so
  every field a consumer read before is still there.
- One legend row type, `legend/chart-legend-item.ts` (77 lines, internal). `LegendItem`,
  `LegendItemData`, `PieLegendItem`, `ScatterEncodingLegendItem` and `ChartLegendEntry` stay
  exported **interfaces** (not the type aliases this file first planned), each extending a
  projection of the one type with exactly its old required/optional fields, so declaration
  merging still works.
- One hover context, `legend/legend-hover.tsx` (114 lines), with three slots (`series`,
  `sharedKey`, `profitLoss`); each provider sets its own slot and passes the others through.
  Deleted: `chart-legend-hover.tsx` (41), `legend/shared-legend-hover.tsx` (44),
  `profit-loss-legend-hover.tsx` (28).
- `arc-chart-context.tsx` (139 lines, internal): the one stable/hover shape, providers and
  guarded hooks for `PieChart` and `RingChart`. `pie-context.tsx` 238 → 173, `ring-context.tsx`
  218 → 155; every public name, guard message and signature kept. `defaultPieColors` and
  `defaultRingColors` are two separate arrays spread from one list, so mutating one never
  changes the other.
- Diff against `main`: 33 files, +1597 / −518. Of the additions, 894 are tests (a 613-line
  compile-time compatibility test captured before any change, and an 11-test runtime file);
  production code is +703 / −518. This item added seams, not savings: the source is
  about 185 lines longer.

**Proof.**

- Compile-time: `legend/legend-and-context-compat.test-d.ts` holds verbatim copies of every
  old public shape (the five legend types, the chart/pie/ring context, stable and hover types)
  and asserts mutual assignability, hook return types, provider props, narrow marker unions,
  and a declaration-merge probe into each legend interface.
- Runtime: `chart-family-contexts.test.tsx`, 11 tests (field routing, identity stability, a
  nested provider shadowing the outer one, hover slot independence, separate colour arrays,
  guard messages).
- Markup, every story of Bar, Composed, Line, Area, Pie, Ring, Scatter, Waterfall,
  ChartLegend, AutoChart, Candlestick, DensityScatter, Dumbbell, Funnel, Radar, Treemap and
  Unit, light and dark, after the entrance settles: base against head 562 of 592 identical;
  base against a second base run 566 of 592. Of the 30 that differ, 25 also differ between
  the two base runs or never settle (loading stories); the other 5 were each traced: two
  print a measured timing readout (`bin + upload 2.4 ms` vs `2.3 ms`), three differ only in
  `cursor: crosshair` vs `cursor: default`, which flips run to run in 6 stories between the
  two base runs as well.
- Screenshots (11 stories × 380/600/900 px × light/dark, after settle): 66 of 66 pixel-
  identical base against head, kept in `apps/diagram/.evidence/rm-203/`.
- Dist `.d.ts`: the export lists are identical (1286 names in the main entry, 224 in
  `./test`). The `./test` entry has exactly the same lines in a different order. In the main
  entry 1493 of 1527 declarations are textually identical; of the other 34: 8 are the
  intended rewrites (`ChartContextValue`, `ChartLegendEntry`, `LegendItem`, `LegendItemData`,
  `PieLegendItem`, `ScatterEncodingLegendItem`, `PieStableContextValue`,
  `RingStableContextValue`), 4 are `PieHoverContextValue`/`RingHoverContextValue` turning
  from interfaces into aliases of the shared hover shape (neither is exported from the entry,
  so nothing can merge into them), 9 are new unexported helper types the declarations now
  reference, and 13 differ only in a doc comment that belongs to the next declaration (the
  rewritten legend-type docs, the rewritten `defaultPieColors`/`defaultRingColors` docs,
  which now say the two are separate arrays, or a module comment that moved when the
  bundler reordered modules). The two import lines name the same symbols in a different order.
  Two module header comments that had leaked into the published declarations while this was
  built were turned into line comments before the final build.
- Mutation checks, each failing as expected and then restored: removing either merge memo,
  aliasing the two colour arrays, dropping the sub-contexts from the merge, a hover provider
  replacing the outer slots, and turning a legend interface back into a type alias.
- Bytes (published dist, minified, dependencies external), base → head: BarChart-only
  298,723 → 299,221 B (+498, the two nested providers and their memos), PieChart-only
  79,408 → 79,319 B, RingChart-only 46,255 → 46,147 B.
- Gates: charts typecheck and lint (0 errors, 72 warnings, none in touched files), charts
  tests 195 files / 4,176 passed / 8 skipped, the six charts check rules at baseline,
  `pnpm build` 15/15, tree-shake check, `pnpm gen:check`, `pnpm check:changed` (charts, ai,
  process, home). The generated component count drops from 105 to 104 for charts because
  two public hover modules became one; the export list does not change.

**Left as it is, on purpose.**

- The shared layers (gesture layer, analytics) still read `barCrossInset` through the merged
  `useChartStable()`; moving them onto the Bar sub-context would widen this item.
- The band-field readers were not converted to a narrowing helper; the fields are grouped and
  typed as one variant, but readers still check `barScale` themselves.
- Families still hand `ChartProvider` one value and let it route the family fields, rather
  than mounting their own sub-provider, which keeps the family shells untouched.
- `useChart()` now keeps its identity between renders when nothing changed. Before, it
  returned a new object every render; this is a stricter guarantee, disclosed in the
  changeset.
