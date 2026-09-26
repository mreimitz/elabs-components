---
"@elabs-ai/components-charts": minor
---

Bar charts can now title their axes: `BarXAxis` and `BarYAxis` accept `title` and `titlePlacement`, drawn the same way `XAxis` and `YAxis` draw theirs.

Reference lines, trend fits and computed lines are now drawn by one shared painter with one set of dash patterns, so they look the same on every chart. Nothing changes on screen.

`ScatterChart` and `CandlestickChart` now declare the `annotations` prop they already honoured, so it is typed and documented.

`CandlestickChart`, `DumbbellChart` and `DistributionChart` now honour `ifOverflow: "extend"` on their analytics: a computed line outside the data grows the value axis to include it, as it already did on bar and line charts. The default (`"clip"`) is unchanged. `CandlestickChart` also now widens its price axis to fit its derived series — a trend, moving window, forecast or error bars (including their upper and lower bounds) — so a fit that runs past the highest high or lowest low is no longer cut off at the plot edge.

Every zoomable chart now draws its zoom buttons with one shared component. A zoomed time series, `ChoroplethChart`, `TreeChart` and `Gantt` each keep their own look, and every button is a real button with a spoken name, reached with Tab and pressed with Enter or Space. Choropleth's buttons are now announced as a labelled "Chart zoom" group. TreeChart's zoom buttons are now left out of exported images, as the time-series and Choropleth zoom buttons already were, and their focus ring is no longer clipped by the button pill.
