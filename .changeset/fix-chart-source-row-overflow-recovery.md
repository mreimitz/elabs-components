---
"@elabs-ai/components-charts": patch
---

`ChartCard`'s and `ChartFrame`'s `source` row no longer truncates a long string with no way to read the rest: a string `source` now gets a native `title` and, once the row measurably overflows, a keyboard-reachable tooltip. `ChartFrame`'s expand modal now places the source row with the chart (matching the inline card) instead of appended under the summary statistics, and both containers share the same truncate-and-recover behaviour — fixes #184.
