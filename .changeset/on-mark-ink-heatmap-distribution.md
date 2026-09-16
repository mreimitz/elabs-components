---
"@elabs-ai/components-tokens": patch
"@elabs-ai/components-charts": patch
---

Tokens: add `--chart-ink-on-light` and `--chart-ink-on-dark` (every theme), the anchor inks for text and ticks printed on a filled chart mark.

Charts: HeatmapChart value labels and the DistributionChart box/violin median tick now pick their ink from the fill they actually sit on, resolved from the rendered theme (semi-transparent bodies composited over the chart ground), so every ramp step clears 4.5:1 in light and dark and in consumer themes. Before the DOM is readable (SSR, first paint) they fall back to a foreground/background estimate.
