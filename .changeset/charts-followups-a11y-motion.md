---
"@elabs-ai/components-charts": minor
---

Candlestick charts now show a rise and a fall by shape as well as colour, four more chart families announce that they are loading, and every chart takes its reduced-motion setting from one place: the person's own motion setting from the theme, and otherwise the operating system's. Reduced motion now stops every chart entrance it covers, and switching it off again never replays an entrance already shown.

- `CandlestickChart`: a rising candle now draws a hollow body, an outline in the rising colour over the chart's own ground (`--chart-background`), and a falling candle a solid one, under every palette. An unchanged candle (open equals close) counts as rising. The outline is 2 px, or 1 px on a candle narrower than 4 px, so a candle 3 px wide keeps a 2 px hole; at 1 px or narrower there is no room for a hole, and only colour tells a rise from a fall. Wicks are unchanged, and a `bodyPatternPositive` you pass still fills rising bodies.
- `CandlestickChart` at high decoration: only falling (solid) bodies take the series pattern; rising bodies stay hollow.
- `LineChart`, `AreaChart`, `ComposedChart` and `BarChart` now announce “Loading chart…” (`charts.chart.loading`, localisable) to screen readers while loading, like every other chart family. Nothing new is shown on screen, and your own `loadingLabel` still replaces it.
- `ParallelCoordinatesChart` takes a `messages` prop to override its built-in wording for one chart, like the other chart containers.
- The person's own motion setting from the theme (`ThemeProvider`'s motion preference) now wins over the operating system's: “reduced” stops the animation even when the system allows motion, and “full” keeps it even when the system asks for less. This now covers the `FunnelChart` segment and label entrance, `Gauge` notches, `TreemapChart` transitions, `PieChart` slices, the `DrawPath` mark's draw-in, the loading label's shimmer, the loading grid's shimmer, the value-axis rescale on time-series charts, `CanvasLayer` marks, `Gantt` zoom and its bar and milestone entrances, and `DensityScatterChart`'s animated zoom. (`LineChart`'s own reveal already followed it.)
- Under reduced motion, `Gauge` notches no longer stagger in and `FunnelChart` segments no longer grow in: both appear at rest at once.
- `RadarChart` areas and `RingChart` rings now respect reduced motion: they appear whole, with no sweep, fade or stagger.
- Switching reduced motion off again no longer replays an entrance a chart has already shown (`Gauge`, `FunnelChart`, `PieChart`, `RadarChart`, `RingChart`, `Gantt` and `DrawPath`); the setting applies to the next chart that mounts.
