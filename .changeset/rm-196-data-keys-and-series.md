---
"@elabs-ai/components-charts": minor
---

ADR 0042 Appendix A.6–A.8, the last rename item of the rename wave: `HeatmapChart` and
`DensityScatterChart` take the shared `xDataKey`/`yDataKey` names for their data columns,
`RadarChart` takes the shared motion names, `ComposedChart` takes `groupGap` for the pixel gap
between grouped bars, and `series`/curve props widen without a name change.

- `HeatmapChart`: `x` → `xDataKey`, `y` → `yDataKey`. The old names keep compiling and working,
  unchanged, for the rest of this major (`docs/DEPRECATION.md` §2) — passing neither `xDataKey`
  nor `x` (or neither `yDataKey` nor `y`) now warns once in development, naming the new prop,
  instead of failing to compile; it never throws.
- `DensityScatterChart`: `xKey` → `xDataKey`, `yKey` → `yDataKey`.
- `RadarChart`: `enterDurationMs` → `animationDuration`, `staggerScale` → `enterStaggerScale`,
  `motionReplayKey` → `revealSignature` — the same three names every other animated family
  already uses.
- `ComposedChart`: `barGap` → `groupGap`, the pixel gap between grouped bars (the Bar part
  already called it `groupGap`). `BarChart`'s own `barGap` — a 0–1 band fraction, a different
  prop entirely — is unchanged.

All four: units and defaults are unchanged, the old name keeps working exactly as before, logs
one warning in development naming the replacement, and never warns in production; when a caller
sets both, the new name wins.

### Type changes without a rename (no alias, no warning — ADR 0042 §A.7)

- `Bar` and `Scatter` gain `name`, falling back to `dataKey` when unset — the same
  legend/tooltip label the `Line`, `Area` and `SeriesBar` parts already had.
- `Area`'s `labelPeaks` widens from `boolean` to `Line`'s `number | { count; minGap? }` shape
  (`boolean` still works).
- `PatternArea`, `ProfitLossLine` and `LiveLine`'s `curve` widens from a raw `CurveFactory` to
  also accept the named `CurveAlias` vocabulary (`"linear"` / `"monotone"` / `"natural"` /
  `"step"` / `"step-before"` / `"step-after"`) `Line`/`Area` already take — a factory keeps
  working unchanged.

### Candlestick (ADR 0042 §A.8)

`CandlestickChartProps` redeclares the inherited `maxVisibleItems` and `windowDomain` as
`@deprecated` — they have no effect on `CandlestickChart` (it never read them) and the TSDoc
says to remove the prop. This one is TSDoc-only, on purpose: neither prop is read anywhere in
the component, so there is no runtime path left to warn from (the same shape as `Scatter`'s
already-deprecated `trend`).

This is the last item of the rename wave: the codemod map (`chart-codemod-map.generated.json`)
now holds all 39 rows of ADR 0042 Appendix A.

### Deprecated

- `HeatmapChart` `x` → `xDataKey`.
- `HeatmapChart` `y` → `yDataKey`.
- `DensityScatterChart` `xKey` → `xDataKey`.
- `DensityScatterChart` `yKey` → `yDataKey`.
- `RadarChart` `enterDurationMs` → `animationDuration`.
- `RadarChart` `staggerScale` → `enterStaggerScale`.
- `RadarChart` `motionReplayKey` → `revealSignature`.
- `ComposedChart` `barGap` → `groupGap`.
- `CandlestickChart` `maxVisibleItems` — has no effect, remove the prop.
- `CandlestickChart` `windowDomain` — has no effect, remove the prop.
