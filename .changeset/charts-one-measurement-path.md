---
"@elabs-ai/components-charts": patch
---

Charts now measure their box with one shared, built-in routine, so the package no longer installs `react-use-measure` or `@visx/responsive`. A chart reads nothing from its parent elements when it mounts, and a window resize or orientation change that leaves its box the same size no longer redraws it. The zoomable `TreeChart`, `Gantt` and a `Sparkline` with `fit="fill"` now follow the same resize timing as every other chart: they redraw at once when their box changes, then at most every 100 ms while it keeps changing, and settle on the final size within 100 ms after it stops. Their sizes are unchanged. `Gantt` now draws its very first frame at its timeline's real width, not briefly at a 600 px placeholder.
