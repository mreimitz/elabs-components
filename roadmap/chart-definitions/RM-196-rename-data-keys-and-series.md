---
id: RM-196
title: "Rename: data keys, Radar motion names, Composed `groupGap`; series and curve type widening; Candlestick category-only members deprecated"
status: planned
priority: P1
effort: M–L (3 days)
wave: 4
depends_on: [RM-182, RM-183, RM-185, RM-189, RM-190]
blocks: [RM-197, RM-205]
agent: brand-ui-component-builder
model: sonnet
touches:
  - packages/charts/src/charts/heatmap/heatmap-chart.tsx (`x` :168, `y` :170; one of each pair stays required)
  - packages/charts/src/charts/density-scatter/density-scatter-chart.tsx (`xKey` :176, `yKey` :178)
  - packages/charts/src/charts/radar-chart.tsx (`enterDurationMs` :48, `staggerScale` :50, `motionReplayKey` :54)
  - packages/charts/src/charts/composed-chart.tsx (`barGap` :126 → `groupGap`)
  - packages/charts/src/charts/bar.tsx, series-bar.tsx, scatter.tsx (gain the `series` group's `name`)
  - packages/charts/src/charts/area.tsx (`labelPeaks` :299 widens to Line's type)
  - packages/charts/src/charts/pattern-area.tsx (:14), profit-loss-line.tsx (:36), live-line.tsx (:67) (`curve` widens to `CurveFactory | CurveAlias`)
  - packages/charts/src/charts/candlestick-chart.tsx (`maxVisibleItems`, `windowDomain` omitted from the inherited props and redeclared `@deprecated`, :53)
  - packages/charts/src/definitions/heatmap-chart.definition.ts, density-scatter-chart.definition.ts, radar-chart.definition.ts, composed-chart.definition.ts (alias rows 32–39)
  - packages/cli/lib/chart-codemod-map.generated.json (regenerated — all 39 rows)
  - packages/charts/src/charts/radar-chart.stories.tsx, composed-chart.stories.tsx, candlestick-chart.stories.tsx, heatmap/heatmap-chart.stories.tsx, density-scatter/density-scatter-chart.stories.tsx (autodocs notes)
  - packages/charts/src/charts/radar-chart.test.tsx, composed-chart.test.tsx, heatmap/heatmap-chart.test.tsx, density-scatter/density-scatter-chart.test.tsx (per-alias tests)
  - .changeset/*.md (minor — `### Deprecated`: the eight rows and the two Candlestick members)
source: docs/review/2026-09-25-charts-unification-review.md F14, F15, F16, F18, F25; ADR 0042 Appendix A.6 (rows 32–39), A.7, A.8
---

# RM-196 Rename: data keys, Radar motion names, Composed `groupGap`; series and curve type widening; Candlestick category-only members deprecated

## Finding

- `xDataKey` is the x column on Line, Area, Composed, Scatter, Candlestick and Bar; Heatmap says `x` / `y` and DensityScatter `xKey` / `yKey` (F15).
- Radar is the only family with its own motion names: `enterDurationMs`, `staggerScale`, `motionReplayKey` for what others call `animationDuration`, `enterStaggerScale`, `revealSignature` (F18).
- `barGap` is a 0–1 band fraction on BarChart but the pixel gap between grouped bars on ComposedChart, which the Bar part calls `groupGap` (F14).
- Series `name` exists only on the Line and Area parts; Area's `labelPeaks` is `boolean` where Line's is `number | { count, minGap }`; PatternArea, ProfitLossLine and LiveLine take `CurveFactory` only (F16).
- `CandlestickChartProps` extends the full `ChartNavigatorProps` (:53) and silently accepts the category-only `maxVisibleItems` and `windowDomain`, which it never reads (F25).

## Change

Ship ADR 0042 Appendix A.6 exactly:

| #   | Component           | Old               | New                 | Transform  | Precedence |
| --- | ------------------- | ----------------- | ------------------- | ---------- | ---------- |
| 32  | HeatmapChart        | `x`               | `xDataKey`          | `identity` | new-wins   |
| 33  | HeatmapChart        | `y`               | `yDataKey`          | `identity` | new-wins   |
| 34  | DensityScatterChart | `xKey`            | `xDataKey`          | `identity` | new-wins   |
| 35  | DensityScatterChart | `yKey`            | `yDataKey`          | `identity` | new-wins   |
| 36  | RadarChart          | `enterDurationMs` | `animationDuration` | `identity` | new-wins   |
| 37  | RadarChart          | `staggerScale`    | `enterStaggerScale` | `identity` | new-wins   |
| 38  | RadarChart          | `motionReplayKey` | `revealSignature`   | `identity` | new-wins   |
| 39  | ComposedChart       | `barGap`          | `groupGap`          | `identity` | new-wins   |

- Units and defaults are unchanged. Heatmap's type still requires one of each pair, so a caller who passes neither still fails to compile. After the rename, `barGap` means only BarChart's fraction.
- A.7 widenings (no alias, no warning): the Bar, SeriesBar and Scatter parts gain `name`; Area `labelPeaks` widens to Line's type plus `boolean`; PatternArea, ProfitLossLine and LiveLine `curve` accept `CurveAlias`.
- A.8: Candlestick's `maxVisibleItems` and `windowDomain` are redeclared `@deprecated` with the text "has no effect on CandlestickChart; remove the prop" — a deprecation with no replacement, which `docs/DEPRECATION.md` §2 allows only when the text names the migration.
- This is the last rename item: after it, the codemod map holds all 39 rows of Appendix A.

## Acceptance

- Per-alias test: the old name renders identically to the new one (DOM equal), warns once in dev and never in production, and the test double stays silent under the default `deprecatedProps: "ignore"`.
- Both names given → the row's precedence decides (test).
- `pnpm check --rule charts-deprecated-usage` green: no internal caller, story, doc or template uses an old name.
- Each renamed prop carries `@deprecated` TSDoc naming the replacement, an autodocs note, and a `### Deprecated` bullet in the changeset (`docs/DEPRECATION.md` in full).
- The codemod map equals ADR 0042 Appendix A (a test compares the two).
- Heatmap without `x` / `xDataKey` fails to type-check (type test).

## Test / gate

`pnpm --filter @elabs-ai/components-charts typecheck lint test`, `pnpm check --rule charts-deprecated-usage,charts-group-drift,chart-default-prose`, `pnpm gen && pnpm gen:check` (the codemod map gains the rows), Storybook autodocs notes checked in Chromium.

## Orchestrator notes

Ship at least one full minor before 6.0.0, so every alias lives through a release.
