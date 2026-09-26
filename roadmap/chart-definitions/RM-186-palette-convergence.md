---
id: RM-186
title: "Palette convergence: one union, one `resolveColorBy`, the hard-coded cycles and AutoChart `CHART_PALETTE`"
status: done
priority: P1
effort: M–L (3 days)
wave: 3
depends_on: [RM-166, RM-182, RM-183, RM-184, RM-185]
blocks: []
agent: brand-ui-component-builder
model: opus
touches:
  - packages/charts/src/charts/chart-context.tsx (one `ChartPalette`; one `resolveColorBy`; the sign pair on `chartCssVars`)
  - packages/charts/src/charts/scatter-encodings.ts (its `resolveColorBy` folds into the one implementation; size and shape encodings stay)
  - packages/charts/src/charts/tree-chart.tsx, heatmap/heatmap-context.tsx, treemap/treemap-layout.ts (family palettes as `Extract<ChartPalette, …>`)
  - packages/charts/src/charts/pie-context.tsx, ring-context.tsx, radar-context.tsx, sankey/sankey-link.tsx, sankey/sankey-node.tsx, choropleth/choropleth-context.tsx (hard-coded cycles go through `resolvePalette`)
  - packages/charts/src/auto-chart/auto-chart.tsx (`CHART_PALETTE` removed), packages/charts/src/auto-chart/chart-spec.ts (`ChartSpecPalette` as an `Extract`)
  - packages/charts/src/charts/scatter-chart.tsx, scatter.tsx, series-markers.tsx (index through `resolvePalette`, not `defaultScatterColors`)
  - packages/charts/src/charts/area-chart.tsx, line-chart.tsx, composed-chart.tsx, bullet-chart.tsx, candlestick-chart.tsx, funnel-chart.tsx, live-line-chart.tsx, pie-chart.tsx, radar-chart.tsx, ring-chart.tsx, scatter-chart.tsx, waterfall-chart.tsx (the `palette` group; defaults unchanged)
  - packages/charts/src/charts/choropleth/choropleth-chart.tsx, packages/charts/src/charts/density-scatter/density-scatter-chart.tsx, packages/charts/src/charts/sankey/sankey-chart.tsx (the `palette` group; defaults unchanged)
  - packages/charts/src/charts/live-line.tsx, dumbbell-chart.tsx, profit-loss-line.tsx (gain / loss colours from the sign pair)
  - packages/charts/src/charts/resolve-palette.test.ts, packages/charts/src/charts/palette-group.test.tsx (new — loop over the palette group)
  - .changeset/*.md (minor — `palette` on every family; one `resolveColorBy`)
source: docs/review/2026-09-25-charts-unification-review.md F06, F26, F32; ADR 0042 (palette group)
---

# RM-186 Palette convergence: one union, one `resolveColorBy`, the hard-coded cycles and AutoChart `CHART_PALETTE`

## Finding

- Four palette unions in `charts/` plus `ChartSpecPalette`; 16 of 26 containers have no `palette` prop; seven hard-coded colour cycles bypass `resolvePalette` (Pie, Ring, Radar, two Sankey lists, Choropleth, AutoChart's `CHART_PALETTE`, a verbatim copy of `defaultScatterColors`) (F06).
- Two functions named `resolveColorBy` resolve differently: diverging domain symmetric about zero or not, steps clamped to 2..7 or not, empty legend or a 0..1 fallback when no numeric values, `explicit: false` or not for categorical. The barrel exports only the scatter one (F26).
- Gain and loss colours come in five pairs across Candlestick, LiveLine, Waterfall, Dumbbell, ProfitLossLine and Scatter (F32).

## Change

- One `ChartPalette`; family palettes are `Extract<ChartPalette, …>`, assignable one way only.
- One `resolveColorBy` with the four differences reconciled as ADR 0042 states. The public `resolveColorBy` export keeps its signature and return shape.
- The seven cycles and `CHART_PALETTE` go through `resolvePalette`.
- Every family gains the `palette` group; each default stays as it is today (Line and Area keep `linePrimary` when no `palette` is passed).
- Gain and loss colours read one sign pair on `chartCssVars` over existing tokens; no new token.

## Acceptance

- A loop over the palette group: changing `palette` recolours every family in it (test).
- Families rendered without `palette` are DOM-identical to today; baselines move only under review.
- `resolveColorBy` tests pin the reconciled semantics.

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule charts-honesty,charts-group-drift` (once RM-190 lands), `pnpm test:stories` palette stories, Chromium light and dark, greyscale check for the sign pair.

## Open follow-ups (final review at ab266a24 — passed, minor only)

- Candlestick shows gain and loss by colour alone (default pair and diverging); it needs a non-colour channel, such as hollow rising bodies.
- Gantt has no `palette`.
- The maintainer decided on 2026-09-26: the five separate gain/loss default pairs (LiveLine, ProfitLossLine, Candlestick, Waterfall, Scatter y-gradient) stay until 6.0.0, when they converge on the sign pair.
- Widths 380/600/900 are not proven by a story mechanism.
