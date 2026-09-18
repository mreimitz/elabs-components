---
"@elabs-ai/components-charts": minor
"@elabs-ai/components-ui": minor
---

Chart and metric value formatting now accepts an object spec, not just the 4 preset strings: `valueFormat={{ decimals: 1, abbreviate: true, sign: "always", suffix: "%" }}` works anywhere a `ChartValueFormat` was accepted before (`YAxis`, `ChartLegend`, `AutoChart`'s `ChartSpec`, tooltip values) and on `MetricCard`'s `valueFormat` in `@elabs-ai/components-ui`. The 4 preset strings (`"number" | "compact" | "currency" | "percent"`) are unchanged and render byte-identically.

`YAxis` gains `unit`/`unitOn` to paint a unit suffix on one, or every, tick.

`XAxis` date labels now pick their granularity from the series' own time span and tick count (year down to minute) instead of always rendering the same "Mon d" shape — a 36-hour series now reads hours, a decade-long one reads years. This is a visible default change for any chart with a very short or very long time domain; pass the new `dateFormat` prop (or `ChartSpec.dateFormat`) to pin a specific rung.
