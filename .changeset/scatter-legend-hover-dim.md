---
"@elabs-ai/components-charts": patch
---

`ScatterChart`'s legend now dims non-matching series on hover, matching `BarChart`/`LineChart`/`AreaChart`: hovering (or keyboard-focusing) a legend row fades every other series' points via the existing `ChartLegendHoverProvider` seam.
