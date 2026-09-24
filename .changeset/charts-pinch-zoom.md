---
"@elabs-ai/components-charts": minor
"@elabs-ai/components-ui": minor
---

Charts support pinch-to-zoom by default. You can spread two fingers on a touch screen, pinch a trackpad, or hold Ctrl/⌘ and scroll the wheel. This zooms the x axis of `LineChart`, `AreaChart`, `ComposedChart` and `CandlestickChart` (time x or band x), vertical `BarChart` and matrix `HeatmapChart`. A two-finger drag pans. With the chart focused, `+` / `−` / `0` zoom and reset. Zoom-in, zoom-out and reset buttons appear while zoomed. Zoom moves the same window as the navigator strip and reports through `onWindowChange` (`null` when zoomed back out). `zoom={false}` turns it off. Zoom stays off while you drive `xDomain` yourself.

Charts no longer block the page's own touch gestures. A vertical swipe over any chart now scrolls the page, and one finger still scrubs the tooltip horizontally. Plots with selection gestures, density-scatter and choropleth keep `touch-action: none`.

`@elabs-ai/components-ui` adds the `charts.zoom.*` locale messages.
