---
"@elabs-ai/components-charts": minor
---

`ChoroplethChart`, `HeatmapChart`, `Gantt`, `DumbbellChart` and `BumpChart` now resolve their
defaults through their own definition (`ADR 0042`), matching `LineChart`/`BarChart`/`WaterfallChart`
and the rest of the family — no default value changed.

`DistributionChart` and `WaterfallChart` gain `selectionStates`/`dimExcluded`: a host can now paint
a selection's tri-state (selected / associated / excluded) back onto a distribution's groups or a
waterfall's steps, the same seam `BarChart`/`DumbbellChart` already have. Unset, both charts render
exactly as before.

`Gantt`'s loading announcement now reads the shared "Loading chart…" text (`charts.chart.loading`)
instead of a generic `"loading"` key, matching `ChartCard`/`ChartFrame`/`AutoChart`.

`DensityScatterChart`'s selection-mode resolution (plain / Shift / Ctrl-Cmd) now goes through the
shared gesture engine's `resolveMode` instead of a private copy — same behaviour, one fewer
implementation to keep in sync.
