---
"@elabs-ai/components-charts": minor
---

`RingChart` now honours `animationDuration`. The prop was accepted but ignored; it now sets how long each ring takes to grow in and sweep its progress arc. Leaving it unset keeps the same 1100 ms enter as before, and an explicit `enterTransition` still wins over it. The gaps between rings stay under `enterStaggerScale`.

Every chart that animates by duration now takes its default from one shared value, so nothing changes on screen: 1100 ms for line, area, composed, bar, scatter, candlestick, sankey, ring and radar charts, and 800 ms for the choropleth map.

Several prop descriptions now match what the code already does; no behaviour changes. `CandlestickChart` `animationDuration` defaults to 1100 ms, not 1500. `WaterfallChart` `valueFormat` defaults to `"compact"`. `BumpChart` `palette` also colours the `"lines"` variant unless `highlightKey` is set. `pieLegendItems` sorts largest first by default, while `PieChart` keeps data order unless you pass `sort`. `Line` `loadingStroke` defaults to `var(--chart-foreground)`. `Sparkline` `formatValue` defaults to compact notation for the text it shows. The `aspectRatio` descriptions on `LineChart` and `ParallelCoordinatesChart` now say that narrow containers default to "1.25 / 1".
