---
"@elabs-ai/components-charts": minor
"@elabs-ai/components-ui": minor
"@elabs-ai/components-ai": patch
---

RM-138 / RM-139: `analytics[]` on the chart containers (ADR 0040 §1). `LineChart`, `AreaChart`, `BarChart`, `ComposedChart`, `DumbbellChart`, `WaterfallChart`, `CandlestickChart`, `ScatterChart` (both axes) and `DistributionChart` accept `analytics`:

- **Computed lines and bands** — `{ kind: "line", value: "mean" | "median" | "min" | "max" | "sum" | number | { percentile } | { stddev } | (rows, key) => number }` and `{ kind: "band", from, to }` / `{ kind: "band", spread: { percentiles } | { stddev } | { ci } }`, resolved with the RM-137 maths and drawn through the annotation layer (a dashed `--chart-foreground` line; a band under the series). `of` names a series or `"all"` (pooled); `axis` the drawn axis; `when(rows)` is a show-condition; `ifOverflow: "extend"` widens the value domain, `"clip"` (default) keeps it. Labels: `"computation"` ("Average 73.8", localised), `"value"`, `"none"` or your own text; the axis' own `valueFormat`/`unit` formats the value.
- **Derived series** — `trend` (linear, log, exp, pow, `{ poly }`, `{ loess }`, optional `ci` band, `extent`), `window` (mean, median, sum, min, max, ewm; `replace: true` stands in for its measure in the series token), `forecast` (additive Holt-Winters, `horizon`, `season`, `interval`; the time-series x domain grows to show the horizon) and `errorBars` (from fields or `{ percent }`; whiskers, or `band: true` on lines). Model paths are dashed in `--chart-foreground-muted`, each with its own dash rhythm; bands wash under the marks. Each derived series joins the container legend (dashed marker, "Trend (r² 0.82)", toggleable), adds a muted tooltip row, and adds one sentence to the figure description (appended after the auto summary, never replacing it).
- `ReferenceLine value` and `DistributionReferenceLine value` (plus a new `to` for a band) accept an `AnalyticValue`; `ChartSpec.analytics` carries the serialisable form and `AutoChart` renders it; the A2UI catalog describes the kinds and the value union.
- `<Scatter trend>` is now a deprecated alias of a `trend` analytic: it keeps its painted output and gains the legend entry; a dev warning names the replacement.
- New exports: `resolveAnalytics`, `widenDomainForAnalytics`, `derivedSeries`, `deriveAllSeries`, `describeAnalytics`, the label helpers, `AnalyticSeriesLayer`, `ErrorBars`, `useChartAnalytics`, `resolveDistributionReferenceLines`. `LegendItem.marker: "dashed"` and `TooltipRow.muted` / `dashed` support the new entries. `@elabs-ai/components-ui` registers the `charts.analytics.*` messages.

With `analytics` unset every container renders exactly as before.
