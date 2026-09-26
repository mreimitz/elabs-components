---
"@elabs-ai/components-charts": minor
---

Internal only: eight charts now each have one written-down description: `LineChart`, `AreaChart`, `ComposedChart`, `BarChart`, `ScatterChart`, `CandlestickChart`, `LiveLineChart` and `WaterfallChart`. Their axis, grid, series and reference-line parts have one too. A description lists every prop the component takes, the values each accepts, a short explanation, and the defaults the component already uses. A test renders each chart and part with its defaults passed in and with none, and the two come out identical. Another test checks that each description agrees with the checks the package's test double already runs. No chart reads these descriptions yet, nothing new is exported from the package, and every chart renders and behaves exactly as before. They are groundwork for building charts from a spec, forms and agent catalogs from one source in a later release.
