---
"@elabs-ai/components-charts": minor
---

`ChoroplethChart`, `HeatmapChart`, `Gantt`, `DumbbellChart`, `BumpChart`, `DistributionChart` and
`DensityScatterChart` now resolve their defaults through their own definition (`ADR 0042`), matching
`LineChart`/`BarChart`/`WaterfallChart` and the rest of the family — no default value changed.

The same seven charts gain a consistent `margin` prop: one number for every side, or a
`Partial<Margin>` per side (`ChoroplethChart`, `DumbbellChart`, `BumpChart` and `DensityScatterChart`
already took `margin`; it now also accepts a single number). `DistributionChart` gains `margin` and
`plotHeight` (px, or `{ aspect }`, optionally per breakpoint) for the first time.

`ChoroplethChart`, `Gantt`, `DumbbellChart`, `BumpChart`, `DistributionChart` and `DensityScatterChart`
gain a `status?: "loading" | "ready"` prop: `"loading"` shows a skeleton in the plot box the chart
will fill, with one polite status announcement, until the data is ready. Default `"ready"` — no
visual change for an existing caller. (`HeatmapChart` keeps its own pre-existing `loading` boolean
prop rather than gaining a second, equivalent switch.)

`DistributionChart` and `WaterfallChart` gain `selectionStates`/`dimExcluded`: a host can now paint
a selection's tri-state (selected / associated / excluded) back onto a distribution's groups or a
waterfall's steps, the same seam `BarChart`/`DumbbellChart` already have. Unset, both charts render
exactly as before.

`Gantt`'s loading announcement now reads the shared "Loading chart…" text (`charts.chart.loading`)
instead of a generic `"loading"` key, matching `ChartCard`/`ChartFrame`/`AutoChart`.

`DensityScatterChart`'s selection-mode resolution (plain / Shift / Ctrl-Cmd) now goes through the
shared gesture engine's `resolveMode` instead of a private copy — same behaviour, one fewer
implementation to keep in sync. Its own range-thumb keyboard interaction (an always-visible,
immediate-commit control) is unchanged; migrating it onto the shared `RangeThumbs` widget — built for
an arm-then-commit gesture — is left for a follow-up, tracked in the roadmap item.
