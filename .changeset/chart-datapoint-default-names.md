---
"@elabs-ai/components-charts": patch
"@elabs-ai/components-ui": minor
---

Charts: every keyboard datapoint target now has a real accessible name even when no `datapointLabel` is passed. The shared default (localised through `t()`) drops an absent part instead of announcing a dangling `:` (`"Revenue, Jan"`, `"Engineering"`), names a target with no category by position (`"Data point 3"`), formats values with locale grouping (`"Visitors: 12,000"`, previously `"Visitors: 12000"`), formats date categories with the active locale (year included, and time when present), and never repeats a group that is both series and category. A `datapointLabel` that returns an empty string now falls back to the default. `DumbbellChart` targets announce both ends (`"Verify email: 82 to 94"`). New `DEFAULT_MESSAGES` keys: `charts.datapoint.labelNoValue`, `charts.datapoint.labelNoSeriesNoValue`, `charts.datapoint.position`, `charts.datapoint.labelRange`.
