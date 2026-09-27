---
"@elabs-ai/components-charts": minor
---

Four charts take their own words through `messages` now, and `Sparkline` takes its accessible name through `accessibleLabel`, the same names every other chart uses. Before, `labels` meant a bag of words on these four and value labels on Pie, Ring and Waterfall, and `Sparkline` alone called its accessible name `label`. The old names keep working, unchanged, until 6.0.0.

- `BulletChart`, `Gauge`, `Sparkline` and `DensityScatterChart` gain `messages`. It takes the same object `labels` took, with the same keys (`value`, `target`, `comparative`, `baseline`, `band`, `outside`, …).
- On `BulletChart`, `Gauge` and `DensityScatterChart`, `messages` also takes the chart's own words from the message catalogue, keyed by their `charts.*` keys, for that chart only. Examples: `charts.bulletChart.valueOfTarget` in the bullet's accessible name, `charts.gauge.defaultLabel` under the gauge's value, and the density plot's legend and loading text. A catalogue key always starts with `charts.`, so it never collides with a word-bag key. `Sparkline` prints no catalogue words, so only its word-bag keys apply.
- `Sparkline` gains `accessibleLabel` and `accessibleDescription`. The description is read after the name, from a visually hidden element, as on the other charts.
- The A2UI catalogue lists `Sparkline`'s `accessibleLabel` and `accessibleDescription` and still accepts `label`. A stored surface that sends `label` renders as before, with no warning.

### Deprecated

- `BulletChart` `labels` → `messages`. Removed in 6.0.0.
- `Gauge` `labels` → `messages`. Removed in 6.0.0.
- `Sparkline` `labels` → `messages`. Removed in 6.0.0.
- `DensityScatterChart` `labels` → `messages`. Removed in 6.0.0.
- `Sparkline` `label` → `accessibleLabel`. Removed in 6.0.0.

Each old name logs one development warning per page and is ignored when the new name is also set. The `./test` double accepts both names and stays silent unless `configureChartTestDouble({ deprecatedProps })` says otherwise.
