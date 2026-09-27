---
"@elabs-ai/components-charts": minor
---

- `CandlestickChart`: a rising candle now draws a hollow body (an outline in the rising colour, no fill) and a falling candle a solid one, so up and down differ by shape as well as colour, under every palette. An unchanged candle (open equals close) counts as rising. Wicks are unchanged, and a `bodyPatternPositive` you pass still fills rising bodies.
- `CandlestickChart` at high decoration: only falling (solid) bodies take the series pattern; rising bodies stay hollow.
- `LineChart`, `AreaChart`, `ComposedChart` and `BarChart` now announce “Loading chart…” (`charts.chart.loading`, localisable) to screen readers while loading, like every other chart family. Nothing new is shown on screen, and your own `loadingLabel` still replaces it.
- `ParallelCoordinatesChart` takes a `messages` prop to override its built-in wording for one chart, like the other chart containers.
- Charts now follow the person's own motion setting from the theme (`ThemeProvider`'s motion preference) before the operating system's: “reduced” stops chart entrances even when the system allows motion, and “full” keeps them even when the system asks for less. This covers funnel, gauge, treemap, pie, line draw-in, shimmering text, the loading grid shimmer, y-axis rescaling, canvas marks, Gantt and the density scatter's zoom.
- `RadarChart` areas and `RingChart` rings now respect reduced motion: they appear whole, with no sweep, fade or stagger.
