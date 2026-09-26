---
"@elabs-ai/components-charts": minor
"@elabs-ai/components-ui": patch
---

`DensityScatterChart` gives host apps more control:

- `zoomControlsPlacement="bottom-end"` stacks the zoom buttons above the minimap, clear of a host's own hover menu. The default is still `"top-end"`.
- `showLassoShape={false}` removes the lasso outline once the selection is committed.
- `onBackgroundClick` fires when you click the plot without hitting a point, so a host can open its own selection mode.
- `describePoint` adds rows to the hover tooltip for the point under the pointer.
- An envelope zone with an open end no longer collapses to half its height on that side. It keeps the full band.
- Zone outlines keep their slope while you zoom in. A slanted edge that ran far outside the window used to bend as the view narrowed.
- Axis-range value bubbles sit on their edge lines: x bubbles along the plot's top, y bubbles along its far side, as BI suites draw them.
- Zone tags stay a few pixels inside the plot, so they no longer blink in and out at the plot edge while you zoom.
- `statLines` draws average, median and standard-deviation lines, over all points or one per zone or category. Each line is tagged in the plot and restated in the chart's description.
- `legend={{ toggleControl: "checkbox" }}` puts a small checkbox after each legend entry. It shows on hover or focus and hides or shows the class; a click on the entry itself selects the zone, or goes to the new `onLegendItemClick` when the host sets it. The option works on every container legend with `interactive: "toggle"`.
- Legends no longer flicker while the pointer moves between entries. Hover now clears when the pointer leaves the legend, not each entry.
- The minimap stays blank instead of throwing when the canvas context has no pixel access.

`@elabs-ai/components-ui` adds the `charts.legend.showItem` message ("Show {label}").

- `categories` also takes a column that is already encoded, `{ codes: Uint16Array, labels }`. The chart uses it as it is, so a host that streams a million rows no longer builds a million strings per update.
- Pan and zoom cost less at large point counts. The per-point density pass now reads the cell each point landed in, instead of projecting every point a second time (about 40 ms down to 4 ms per frame at 1M points). Zone classification is also faster.
- Without WebGL (graphics acceleration off, or a locked-down browser), dots are now rasterised into one pixel buffer instead of one canvas call per point. Points on the same pixel are stamped once. Zooming 1M points goes from over a second per frame to well under 100 ms.
