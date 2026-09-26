---
"@elabs-ai/components-charts": minor
"@elabs-ai/components-ui": minor
---

Charts now print every number and date in the locale of the surrounding `LocaleProvider`, and the words they show or announce come from the same message catalogue as the rest of the app. Before, some labels, axis ticks and tooltips used the browser's own locale and fixed English text. Without a `LocaleProvider`, or with an English one, charts print exactly what they printed before, with the two exceptions below.

- The ui message catalogue gains `charts.*` keys for chart words that used to be fixed English: empty-state text, tooltip row labels (Value, Share, Path, Members, IQR, Range, Records, Density, Period, Rank, Start, End, Before, After), the network and heatmap summaries, the heatmap colour key, the Sankey node value, the Gantt link announcements, and the chart frame's summary and footer words. Pass German (or any) text for these keys to `LocaleProvider` `messages` to translate them.
- `TreeChart`, `TreemapChart`, `NetworkChart`, `HeatmapChart`, `ChoroplethChart`, `SankeyChart`, `DistributionChart`, `BumpChart`, `WaterfallChart`, `DumbbellChart` and `Gantt` gain `messages`: replacement words for that one chart, keyed by the same `charts.*` keys. A word set here wins over the `LocaleProvider` for that chart only; a chart next to it is not affected.
- `PieChart`, `FunnelChart`, `BulletChart` and `RadarChart` gain `locale`, which formats that chart's numbers in the given locale instead of the provider's. `RadarChart` also gains `maxFractionDigits`. On `PieChart` and `RadarChart`, both settings now also reach the legend's value column; `ChartLegend` gains `locale` and `maxFractionDigits` for the same purpose.
- Two English outputs change on purpose, so that one chart never mixes "1K" with "800": `WaterfallChart` bar labels and the `DistributionChart` value axis now print "1,000" beside smaller values instead of "1K". The dumbbell, heatmap colour key, parallel-coordinates extremes and density-scatter axes follow the same one-style-per-axis rule, and their default output did not change.
