---
id: RM-187
title: "Formatting and messages: `useChartFormatters` as the one path; strings onto the ui `charts.*` keys"
status: planned
priority: P1
effort: L (3–4 days)
wave: 3
depends_on: [RM-182, RM-183, RM-184, RM-185]
blocks: [RM-191]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/chart-formatters.ts (module-level `intFmt`, `shortDateFmt`, `weekdayDateFmt`, `hmsTimeFmt` retired behind `useChartFormatters()`)
  - packages/charts/src/charts/bar-chart.tsx, funnel-chart.tsx, unit-chart.tsx, live-line-chart.tsx, x-scale-mode.ts, live-x-axis.tsx, bump-chart.tsx, candlestick-chart.tsx, scatter-chart-shell.tsx, x-axis.tsx (host-locale importers)
  - packages/charts/src/charts/legend/legend-value.tsx, packages/charts/src/charts/tooltip/chart-tooltip.tsx, packages/charts/src/charts/sankey/sankey-threads.tsx, packages/charts/src/charts/sankey/sankey-node.tsx, packages/charts/src/charts/sankey/sankey-tooltip.tsx, packages/charts/src/charts/choropleth/choropleth-tooltip.tsx (host-locale importers)
  - packages/charts/src/charts/chart-stat-flow.tsx, density-scatter/density-scatter-chart.tsx (module-level `Intl`)
  - packages/charts/src/charts/dumbbell-chart.tsx, heatmap/heatmap-legend.tsx, distribution/distribution-value-axis.tsx, parallel-coordinates/parallel-coordinates-chart.tsx, waterfall-chart.tsx (#250: set formatter)
  - packages/charts/src/charts/tree-chart.tsx, treemap/treemap-chart.tsx, network/network-layout.ts, heatmap/heatmap-scale.ts, choropleth/zoom-controls.tsx, canvas-layer/canvas-layer.tsx, gauge.tsx, sankey/sankey-chart.tsx (English strings onto `charts.*` keys)
  - packages/charts/src/charts/distribution/kinds/box.tsx, violin.tsx, histogram.tsx (tooltip row labels onto `charts.*` keys)
  - packages/charts/src/gantt/gantt.tsx ("Link cancelled" onto a `charts.*` key)
  - packages/charts/src/chart-frame/chart-frame.tsx (the `footerLabels` words onto `charts.*` keys, :622)
  - packages/ui/src/components/locale-provider/messages.ts (new `charts.*` keys appended; no second English table)
  - packages/charts/src/charts/chart-formatters.test.tsx, packages/charts/src/charts/locale-de.test.tsx (new — de-DE across five families)
  - scripts/check/baseline.json (`locale-formatting` and `i18n-strings` shrink)
  - .changeset/*.md (minor — `messages` overrides; locale-correct formatting)
source: docs/review/2026-09-25-charts-unification-review.md F07, F29; ADR 0042 (messages group; skeptic major: no second catalogue)
---

# RM-187 Formatting and messages: `useChartFormatters` as the one path; strings onto the ui `charts.*` keys

## Finding

- The module-level host-locale formatters are imported in 16 files; DensityScatter has a module-level `new Intl.NumberFormat()` and ChartStatFlow calls `new Intl.NumberFormat(undefined)`. A LocaleProvider-bound `useChartFormatters()` already exists (`chart-formatters.ts:230`) with zero consumers (F07).
- Rule #250 per-value violations: Dumbbell value-axis ticks, heatmap-legend, distribution-value-axis, Parallel extremes, DensityScatter ticks, and Waterfall's bar labels and tooltip rows (F07).
- RM-183 review (fix3) deliberately narrowed the radial/part-to-whole families' `valueFormat`-group adoption to only the members that change printed output TODAY, dropping `locale` everywhere (the formatter always reads ambient `useLocale()`, so an accepted `locale` prop would silently do nothing — see each `*-chart.definition.ts` docblock). RM-187 is where that seam should actually open, scoped per family rather than blanket: `PieChart`/`FunnelChart`/`BulletChart` would gain `locale` alongside their existing `valueFormat`/`currency`/`maxFractionDigits`; `RadarChart` would gain `locale` and `maxFractionDigits` (today it exposes only `valueFormat`/`currency` on `useContainerLegend`'s value column, which has no seam for the other two). `RingChart` and `UnitChart` have no printed-value seam at all today — they would need one grown first before `locale`/`currency`/`maxFractionDigits` mean anything, out of scope for a formatting-only pass.
- User-visible English is hard-coded in tooltip rows (Treemap, Tree, Sankey, Waterfall, Dumbbell, Bump, Distribution), summaries (Network, Heatmap, Tree), empty states and control labels (F29). The ui catalogue already holds about 277 `charts.*` keys; a second English table would drift.

## Change

- Every call site formats through `useChartFormatters()` / `useChartValueSetFormatter`; the module-level formatters are retired from the call sites (kept exported until 6.0 if public).
- Sets use the set formatter (one unit per scale).
- Hard-coded strings move onto `charts.*` keys in the ui `LocaleProvider`; the `messages` group overrides them per chart.

## Acceptance

- The `locale-formatting` and `i18n-strings` baselines shrink (numbers in the PR).
- A de-DE test across five families asserts localised numbers, dates and labels.
- No new English table outside `messages.ts`.

## Test / gate

`pnpm --filter @elabs-ai/components-charts test`, `pnpm --filter @elabs-ai/components-ui test`, `pnpm check --rule locale-formatting,i18n-strings`, `pnpm check:update` reviewed, Storybook locale stories in Chromium, light and dark.
