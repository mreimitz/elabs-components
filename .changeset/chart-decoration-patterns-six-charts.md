---
"@elabs-ai/components-charts": patch
---

CandlestickChart, ChoroplethChart, TreemapChart, WaterfallChart, DumbbellChart and DistributionChart now join the high-decoration pattern channel: at `--decoration` 8–10 their palette-filled marks (candle bodies, regions, leaf tiles, step bars, filled dumbbell markers, histogram bars / box capsules / violin bodies) draw a series hatch/dot pattern, so marks that differ by hue also differ by texture. Author literal or `url()` fills are left as drawn, and nothing changes at decoration 0–7.
