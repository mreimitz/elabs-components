---
"@elabs-ai/components-charts": minor
"@elabs-ai/components-ai": patch
"@elabs-ai/components-cli": patch
---

Legends: a faceted `AutoChart`'s shared legend now drives every panel — hovering an item dims the other series (pie: slices) in each panel, and `legend: { interactive: "toggle" }` hides a series from all of them. Radar and funnel charts (and `AutoChart` specs of those types) now use the same container legend as every other chart, via a new `legend` prop on `RadarChart` and `legend` + `seriesLabel` on `FunnelChart`. `ChartSpec` gains an optional `valueKeys` (dumbbell `variant: "dots"`), so an `AutoChart` dots dumbbell draws those keys and gets the shared legend.
