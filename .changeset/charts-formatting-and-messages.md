---
"@elabs-ai/components-charts": minor
"@elabs-ai/components-ui": minor
---

Charts now print every number and date in the locale of the surrounding `LocaleProvider`, and the words they show or announce come from the same message catalogue as the rest of the app. Before, some labels, axis ticks and tooltips used the browser's own locale and fixed English text. Without a `LocaleProvider`, or under an English one, most charts print what they printed before; the last two items below list the outputs that change.

- The ui message catalogue gains `charts.*` keys for chart words that used to be fixed English: empty-state text, tooltip row labels (Value, Share, Path, Members, IQR, Range, Records, Density, Period, Rank, Start, End, Before, After), the network and heatmap summaries, the heatmap colour key, the Sankey node value, the Bump chart's "rank" in datapoint names (`charts.bump.datapointRank`), the Gantt link announcements, and the chart frame's summary and footer words. `NetworkChart` and `ParallelCoordinatesChart` now read their empty-state text from the existing `charts.chart.emptyTitle` and `charts.chart.emptyMessage` keys. Pass German (or any) text for these keys to `LocaleProvider` `messages` to translate them.
- `TreeChart`, `TreemapChart`, `NetworkChart`, `HeatmapChart`, `ChoroplethChart`, `SankeyChart`, `DistributionChart`, `BumpChart`, `WaterfallChart`, `DumbbellChart` and `Gantt` gain `messages`: replacement words for that one chart, keyed by the same `charts.*` keys. A word set here wins over the `LocaleProvider` for that chart only, including the shared parts it renders (datapoint-layer name, legend label, loading and fallback text, tree toggles, Gantt timeline and task list); a chart next to it is not affected.
- `PieChart`, `FunnelChart`, `BulletChart` and `RadarChart` gain `locale`, which formats that chart's numbers in the given locale instead of the provider's. `RadarChart` also gains `maxFractionDigits`. On `PieChart` and `RadarChart`, both settings now also reach the legend's value column; `ChartLegend` gains `locale` and `maxFractionDigits` for the same purpose. `PieChart`'s `locale` also reaches its centre value, through a new `locale` prop on `ChartStatFlow`.
- Some English outputs change on purpose, so that one chart never mixes "1K" with "800" or "1" with "0.20". Every number on one axis, key or tooltip now shares one style:
  - `WaterfallChart` bar labels, datapoint names and the tooltip's Value, Before and After rows print "1,000" beside smaller values instead of "1K".
  - The `DistributionChart` value axis prints "1,000" instead of "1K" beside smaller ticks.
  - The `DumbbellChart` value axis prints "500 1,000 …" instead of "500 1K …".
  - `DensityScatterChart` axis ticks print "0.00 0.20 … 1.00 1.20" instead of "0 0.20 … 1 1.2".
  - The `HeatmapChart` colour key in `legendLabels="ranges"` mode prints "900–1,200" instead of "900–1.2K", and its screen-reader sentence follows. The default `"endpoints"` key is unchanged.
  - The parallel-coordinates extremes follow the same rule.
- A chart with no `LocaleProvider` above it, in a browser set to a language other than English, now prints English (US) dates and times where it used to print the browser's own: Date category names in datapoint names (for example "Mar 9"), the weekday date in a time-axis tooltip title, and `LiveXAxis` time labels. Wrap the app in a `LocaleProvider` with the user's locale to keep local formats.
