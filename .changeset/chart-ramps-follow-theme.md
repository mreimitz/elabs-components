---
"@elabs-ai/components-tokens": minor
"@elabs-ai/components-charts": minor
---

Heatmaps, colour-scale legends and waterfalls now draw in the active theme's own chart colours.

The sequential ramp (`--chart-seq-1` … `-7`) takes the hue of each theme's lead series colour (`--chart-1`), so a heatmap, calendar, treemap or choropleth reads in the same colour as that theme's bars and lines. In the default light and dark themes it moves from muted blue to the brand lime. The lightness steps are unchanged, so every contrast and spacing guarantee still holds. Downloadable theme families whose ramp did not match their lead colour were re-derived the same way.

`WaterfallChart` now paints rises in `--chart-1` and falls in `--chart-2`, the same pair a two-series `BarChart` uses. Totals stay on `--chart-foreground`. Pass `positiveFill="var(--chart-seq-6)"` and `negativeFill="var(--chart-seq-3)"` to keep the previous look.
