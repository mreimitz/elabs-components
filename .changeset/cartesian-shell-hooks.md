---
"@elabs-ai/components-charts": patch
---

Bar, scatter and candlestick charts now run on the line chart's shared reveal, hover and axis code. They draw the same as before, with these fixes:

- BarChart: the hover readout sits on grouped bars when `<Bar groupGap>` is not 4.
- BarChart: a `ChartBrush` child paints above bars, overlays and labels, so it stays draggable wherever it is listed.
- BarChart: `onPhaseChange` no longer reports "loading" twice.
- ScatterChart: a tap shows the readout at once, so tap-to-pin works on a quick tap. The readout clears when a scroll takes over the touch, and it follows the data when the chart updates under the pointer. The passive-listener console warning is gone.
- CandlestickChart: gradient and pattern children go into `<defs>` by the same rule as the other charts.
