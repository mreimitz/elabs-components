---
"@elabs-ai/components-charts": minor
---

`ChoroplethChart`, `HeatmapChart`, `Gantt`, `DumbbellChart`, `BumpChart`, `DistributionChart` and
`DensityScatterChart` now resolve their defaults through their own definition (`ADR 0042`), matching
`LineChart`/`BarChart`/`WaterfallChart` and the rest of the family — no default value changed.

`margin` now also accepts a single number (one value for every side) on `ChoroplethChart`,
`HeatmapChart`, `DumbbellChart`, `BumpChart` and `DensityScatterChart` — each already took a
`Partial<Margin>`. `DistributionChart` gains `margin` and `plotHeight` (px, or `{ aspect }`,
optionally per breakpoint) for the first time. `Gantt` has no margin or aspect-ratio concept, so it
is unchanged here.

`ChoroplethChart`, `DumbbellChart`, `BumpChart`, `DistributionChart` and `DensityScatterChart` gain a
`status?: "loading" | "ready"` prop: `"loading"` shows a skeleton in the plot box the chart will
fill, with one polite status announcement, until the data is ready. Default `"ready"` — no visual
change for an existing caller. `HeatmapChart` and `Gantt` keep their own pre-existing `loading`
boolean for now; renaming it to the shared `status` name is a follow-up (`ADR 0042` Appendix A,
row 18–19).

`DistributionChart` and `WaterfallChart` gain `selectionStates`/`dimExcluded`: a host can now paint
a selection's tri-state (selected / associated / excluded) back onto a distribution's groups or a
waterfall's steps, the same seam `BarChart`/`DumbbellChart` already have. Unset, both charts render
exactly as before. `WaterfallChart`'s selection is typed against a new exported `WaterfallRow` type.

`Gantt`'s loading announcement now reads the shared "Loading chart…" text (`charts.chart.loading`)
instead of a generic `"loading"` key, matching `ChartCard`/`ChartFrame`/`AutoChart`.

`DensityScatterChart`'s axis-range selection is now built on the same primitives the rest of the
package uses: selection-mode resolution (plain / Shift / Ctrl-Cmd) goes through the shared gesture
engine's `resolveMode`, and the keyboard range thumbs render on the shared `RangeThumbs` widget in a
new always-live "immediate" mode (no arm step, every key commits at once) rather than a private
copy of the same interaction. The keyboard behaviour is unchanged, including Escape on one axis'
thumb clearing only that axis; the two thumbs' accessible names now follow the shared "Range
start/end, {axis}" wording by default, and at rest their grip is invisible (as it always was on
this chart) until a thumb is focused. The pair sits in the axis gutter, unchanged from before. Its
old `density-scatter-chart-x-sliders`/`density-scatter-chart-y-sliders` data-slots are gone; a
consumer selecting on them should target `RangeThumbs`' own `chart-selection-range-thumbs` slot
instead.

Deprecated: `DensityScatterLabels.xRange`, `yRange`, `from` and `to` no longer drive the range
thumbs by default, but still compose their old name when set (a one-time dev warning), so a caller
that localised them keeps working; unset, the shared "Range start/end, {axis}" strings apply.
Removed in 6.0.0.
