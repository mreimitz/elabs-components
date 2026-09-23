# Density scatter (200k–500k points, zoned axes, zoom-dependent LOD) — analysis

Date: 2026-09-23 · Status: analysis, nothing built · Package: `@elabs-ai/components-charts`

## The ask

A cartesian point plot that (a) carries 200k–500k individual values, (b) has
zones defined on the axes (min/max per axis, and in the reference screenshot an
envelope that varies along x — the red "funnel"), (c) colours each point by the
zone it falls in or by any continuous/categorical column, and (d) renders as a
density shape where points are dense and as individual dots where they are
sparse — dissolving into dots on zoom-in, packing into the shape on zoom-out.

## Verdict: new chart, built on the existing canvas path — not an extension of `ScatterChart`

`ScatterChart` / `Scatter` (`charts/scatter.tsx`, 764 lines) is an SVG chart:
one DOM node per point through `SeriesMarkers`, `motion` enter transitions,
`PointLabels`, `PeakRing`, per-point `ChartSelectionMark`. That is the right
design up to a few thousand points and the wrong one past ~20k — its own
sibling `CanvasLayer` docblock (RM-046) draws that line. Bolting a `renderer:
"canvas"` switch onto it would fork almost every prop (`labels`, `labelExtremes`,
`jitter`, `shapeBy`, `trend`, `dropLines` are all per-node) into "works in SVG
only" — exactly the kind of half-surface the library's `audit --strict` bar is
meant to keep out.

What IS reused, and it is most of the chart:

| Need                                                                                                                      | Existing piece                                                                                                 | Reuse                                                                               |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Frame, title, legend slot, footer, export                                                                                 | `chart-frame/`                                                                                                 | as is                                                                               |
| Linear x + y axes, domains, `XAxis domain` overrides (RM-108)                                                             | `scatter-chart-shell.tsx` (`resolveScatterXScaleType`, `buildYScalesFromDomains`, `niceYDomain`)               | extract the numeric-x path; the time-x path is not needed                           |
| Canvas mark path with the a11y contract (summary + one virtual cursor + SVG focus ring), dpr handling, theme-aware redraw | `canvas-layer/` (`CanvasLayer`, `useCanvasDraw`, `canvasTokenColor`)                                           | as the mark layer                                                                   |
| Constant thresholds on either axis (`kind: "line"`/`"band"`, literal `value`)                                             | `analytics/` (ADR 0040)                                                                                        | for the flat min/max case, and for the legend/tooltip/a11y wiring they already have |
| Sequential ink ramps, bucket legends                                                                                      | `heatmap/heatmap-scale.ts` (`continuousInk`, `buildHeatmapBuckets`), `scatter-encodings.ts` (`resolveColorBy`) | colour stops + legend entries                                                       |
| Rect / lasso / radial selection over canvas                                                                               | `canvas-layer/canvas-selection.tsx` (RM-144)                                                                   | see the open point below — it registers one geometry per datum                      |
| Tooltip box, hover-linked legend                                                                                          | `tooltip/`, `chart-legend-hover`                                                                               | as is                                                                               |

What does not exist yet and is new work (all generic seams, none of it
zone-specific):

1. **Cartesian zoom/pan.** Only `choropleth` zooms today (`@visx/zoom`, already a
   dependency). No cartesian chart has a wheel-zoom / drag-pan transform. This is
   the piece the LOD behaviour hangs on, and it is useful for `LineChart` /
   `ScatterChart` later, so it should be a chart-level seam (`zoom` prop +
   context exposing the rescaled x/y scales), not something private to this chart.
2. **Columnar data.** 500k `Record<string, unknown>` rows is ~100–200 MB of
   objects and a GC problem before a single pixel is drawn. The chart takes
   `{ x: Float64Array | number[], y: …, [column]: … }` (and accepts rows by
   converting once, with a console warning past ~50k rows). Every hot loop runs
   over typed arrays.
3. **The binned LOD renderer** — below.
4. **Zones** — below.

## The rendering model

The trick that makes "dissolves on zoom-in, packs on zoom-out" fall out for
free: **bin in screen space, not data space.** Bin cells are a fixed size in CSS
pixels (≈ 4–6 px). Zooming in makes each screen cell cover less data space, so
counts per cell drop, so cells cross the dot threshold and dissolve. No mode
switch, no "zoom level 3 = dots" table — one rule evaluated per cell per frame.

Per frame (on data change, resize, zoom, pan — coalesced to one rAF):

1. Project every point through the current (zoomed) scales into cell indices.
   O(n) over typed arrays; ~5–15 ms at 500k on a laptop, which fits a frame.
   Points outside the visible window are skipped early.
2. Per cell accumulate `count`, and per zone/category `countByClass[k]` (or
   `sum` for a continuous colour column, so the cell can show the mean).
3. **Dense cells** (`count ≥ T`, T ≈ 3–4 by default, prop-tunable) paint into a
   low-resolution offscreen canvas — one pixel per cell — with colour = the
   cell's dominant class hue and lightness/alpha from the density ramp
   (`sqrt` or `log` scaled against the frame's max, otherwise the core washes
   out everything). That offscreen canvas is then `drawImage`d onto the main
   canvas scaled up with `imageSmoothingEnabled = true`. Bilinear upscaling is
   what turns blocky cells into the smooth "cluster shape" — it costs one
   drawImage, no blur filter, no KDE pass, and works in every browser that has
   canvas.
4. **Sparse cells** (`count < T`) draw their individual points as dots, in the
   point's own class colour. A short blend window (`T−1 … T+2`) draws both the
   cell fill at rising alpha and the dots at falling alpha, so a cell never pops
   from "3 dots" to "solid" in one wheel notch.
5. Zone outlines (the red/blue lines) and any `analytics` lines draw on top, in
   the SVG overlay `CanvasLayer` already has for the focus ring — crisp, themed,
   exportable, not part of the raster.

Why square cells and not hexbins: hex reads nicer as _cells_, but here the cells
are never shown as cells — the upscale smoothing hides the grid — and the square
index maths is what keeps step 1 inside a frame at 500k. Hex can be an opt-in
`bin: "hex"` later if a story wants visible tiles.

Hover / tooltip follow the same LOD: hovering a dense cell shows the aggregate
(count, share per zone, mean of the colour column); hovering a sparse dot shows
the point. That also removes the need to rebuild a 500k-entry `createSpatialGrid`
on every zoom — the bin structure IS the hit index.

Colour discipline (`.claude/rules/theming.md`, canvas-layer #283): the zone hues
are categorical ink used as a ramp _with each other_ (Core / Expanded / Outside
always co-occur), the density dimension rides on lightness/alpha inside each hue
(`continuousInk` already floors that at `CONTINUOUS_MIN_OPACITY`), and a
single-zone dataset falls back to the neutral `--chart-mono-*` rung so 100% of
the ink is never one series token.

## Zones

Generic, not aviation-specific: an ordered list of regions, inner to outer; a
point's class is the first region containing it, else `outside`.

```ts
zones: [
  { id: "core", label: "Core", bounds: { y: [-50, 50], x: [-2200, 3400] } },
  {
    id: "expanded",
    label: "Expanded EIS",
    bounds: {
      upper: [
        [-1500, 200],
        [-200, 15],
        [3500, 15],
      ],
      lower: [
        [-1300, -200],
        [-200, -15],
        [3500, -15],
      ],
    },
  },
];
```

`bounds` is either per-axis `min/max` (a rectangle — matches "define on axis
level") or an `upper`/`lower` polyline in data units (the funnel in the
screenshot, which is not expressible as a constant band). Classification is a
point-in-band test between two piecewise-linear functions of x — O(log m) per
point with a binary search over the vertices, computed once per data/zones
change into a `Uint8Array`, not per frame. Rectangles are the degenerate
two-vertex case of the same code, so there is one path.

The same list draws the outlines, feeds the legend (`ChartLegendEntry` per
zone plus `outside`), the tooltip rows, and the accessible summary ("412,380
points: 71% Core, 24% Expanded EIS, 5% outside").

`colorBy` (from `scatter-encodings.ts`) stays available as an alternative to
zone colouring: a categorical column colours by its stops; a continuous column
colours dense cells by the cell's mean through the sequential ramp and sparse
dots by their own value — a 2-D binned-mean map at no extra cost. One colour
key per chart, same rule as RM-118.

## Open points that need a decision before building

1. **Drag ownership.** Today drag inside a plot is a selection gesture (RM-144).
   With zoom, drag must also pan. Options: (a) wheel zooms, drag pans, selection
   only via the toolbar's explicit lasso/rect mode; (b) drag selects, pan on
   space+drag / middle button; (c) pan as a toolbar mode next to lasso. (a) is
   what every map and every mainstream plotting library do and what users expect
   on a 500k-point canvas; it is the recommendation, with `ChartSelectionToolbar` switching to
   (c) when a selection session is active.
2. **Selection at 500k.** `canvasSelectionMarks` registers one geometry per
   datum; a lasso over 500k registered marks is not viable. Either register the
   dense cells as marks (a lasso selects cells → resolves to their point ids in
   the chart, not in the engine) or add a predicate path to the engine
   (`ChartMarkGeometry` provider returns a polygon test instead of a mark
   list). The first is cheaper and consistent with the tooltip LOD.
3. **Keyboard cursor.** `CanvasLayer`'s virtual cursor walks `points`; walking
   500k is meaningless. Walk the sparse dots + dense cells in reading order,
   announcing the aggregate for a cell. This is a `CanvasLayer` seam
   (`cursorItems` separate from `points`), not a fork.
4. **Where the threshold lives.** `T` (dots→shape) and cell size as props with
   defaults, plus a `density: "auto"` that picks cell size from
   `points / plotArea` so a 20k chart doesn't start out as a blob.
5. **Name.** `DensityScatterChart` reads as what it is; `PointCloudChart` is
   the term people coming from BI suites and big-data plotting tools search for. Recommendation:
   `DensityScatterChart`, with "point cloud" in the docs description.

## Proposed shape of the work

- `charts/density-scatter/` — `density-scatter-chart.tsx`, `bin.ts` (typed-array
  binning + LOD split, framework-free, unit-tested at 500k for time budget),
  `zones.ts` (classification + outline paths, unit-tested), `use-cartesian-zoom.ts`
  (the generic seam; lives outside the folder if a second chart adopts it),
  stories: 200k synthetic funnel dataset mirroring the screenshot, zone
  colouring, `colorBy` continuous, zoom in/out (play function asserting the
  dot/shape split flips), reduced-motion, dark theme.
- `CanvasLayer`: `cursorItems` seam; `canvas-selection`: cell-level marks.
- Storybook measured budget like the existing `CanvasLayer` story: bin + draw
  under 50 ms at 500k on the CI runner, asserted, not eyeballed.
- Registry block + A2UI catalog entry after the chart lands, not with it.
- Roadmap: a `roadmap/density-scatter/` track (RM-xxx…) with an ADR for the
  cartesian zoom seam, since it changes the drag contract of RM-144.

Not in scope for v1: hexbins as visible tiles, WebGL (canvas 2D handles 500k
within budget with the binned approach; revisit past ~2M), server-side
pre-binning (the API could accept pre-binned input later without changing the
render path).

## Outcome (2026-09-23, branch `feat/density-scatter`)

Built as `DensityScatterChart` in `packages/charts/src/charts/density-scatter/`
with two changes to the model above, both from looking at the prototype:

- **Paint is one rule, not two.** The "dense cell = fill, sparse cell = dots"
  split made the transition visible (a blurred fill next to crisp discs). Every
  point is now always a dot; its colour is the smoothed local density (light →
  deep on the class hue); dots are slightly translucent so they fuse into a
  solid shape at low zoom and separate at high zoom. The cell split survives as
  the tooltip's level of detail (aggregate on a dense cell, point on a sparse
  one) and as the faint opacity-capped underlay.
- **WebGL, not Canvas 2D, for the dots.** 200k `drawImage` calls was the 2D
  ceiling. Positions and class upload once; one byte per point per frame
  (density level) and one per selection change (selected flag); the vertex
  shader projects, looks up the ramp and dims. Measured in the real Storybook
  build (headless Chromium, software GL): 200k points bin + upload in 7–11 ms,
  1M in ~50 ms; the draw itself is off the JS thread. Canvas-2D fallback keeps
  the same picture where WebGL is unavailable (`data-renderer` says which).

Decisions taken on the open points: (1) wheel zooms, drag pans, lasso is the
`selectionTool`; (2) the intersection selection is the chart's own state and
each gesture emits a `ChartSelectionIntent` — cells are not registered in the
engine's mark registry; (3) no virtual cursor over 10⁵ points — the keyboard
path is the two axis-range slider pairs (APG multi-thumb) plus the zone tags,
and the parallel summary carries the shares; (4) `cellSize` / `underlay` are
props with defaults; (5) named `DensityScatterChart`.

Legend: hide/show through the engine's `interactive: "toggle"`; a modifier-click
selects the zone via the new `onItemClick` pass-through on `useContainerLegend`
(today's behaviour when unset). Gates that caught real defects during the
build: the WebGL precision mismatch (link failure on some drivers), the slider
group swallowing the gutter drag, ±Infinity outline coordinates for unbounded
rectangle zones, and a stale frame after a selection-to-selection change —
all found in the browser, not in jsdom. Registry block `density-scatter-01`
carries three use cases (flight-test envelope, wafer probe map, fill latency).
