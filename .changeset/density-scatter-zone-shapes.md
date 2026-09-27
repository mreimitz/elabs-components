---
"@elabs-ai/components-charts": minor
---

`DensityScatterChart` zones can take more shapes, and hosts can draw on top of the plot.

- **Polygon zones**: `bounds: { polygon: [[x, y], …] }` accepts any closed shape.
- **Line zones**: `bounds: { line, side: "above" | "below" }` covers everything on one side of a polyline.
- **Open ends**: `extend: { start, end }` on an envelope or a line lets it continue past its first or last vertex without end, instead of stopping there. A rectangle does the same with `x: [-Infinity, max]`.
- **Negative zones**: `invert: true` makes a zone cover everything outside its shape. Its outline is drawn dashed. First match still wins, inner to outer.
- **Outside class**: `outside={{ legend: false }}` leaves it out of the legend, and `outside={{ selectable: false }}` stops a legend modifier-click from picking it.
- **`zoneTags={false}`** hides the in-plot zone tags.
- **`renderOverlay(ctx)`** mounts a host layer over the plot, such as a zone editor. `ctx` carries the current view, the plot box, and the `toPixel` / `toData` projections.

Fix: the WebGL points renderer now follows the `<canvas>` element itself. Before, when the plot re-mounted (for example when a legend appeared after changing `zones` or `colorBy` once the data was loaded), the dots disappeared.
