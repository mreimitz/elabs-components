---
"@elabs-ai/components-charts": patch
"@elabs-ai/components-ai": patch
---

- charts: `SeriesBar` takes `yAxisId` and `name`, so a `ComposedChart` column can sit on the right axis and show its display name in the legend and tooltip; `AutoChart` `type: "dual-axis"` now draws a right-axis column instead of the unsupported fallback (#610).
- charts: hovering a `ComposedChart` legend item now dims the other series' columns (#610).
- ai: the A2UI catalog documents `ChartSpec.legend`'s object form (`position`, `layout`, `interactive`, `values`, `title`) and that a dual-axis column may sit on either axis (#610).
