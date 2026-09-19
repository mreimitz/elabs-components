---
"@elabs-ai/components-charts": minor
---

`ChartFrame` now carries the editorial chrome a published chart needs, and its image export is the whole frame, not just the plot.

- **Notes, byline and a linked source.** `notes` renders an italic line above the footer. `byline={{ kind: "chart" | "map" | "table", author }}` reads "Chart: Author". `source` also accepts `{ name, href }`, rendered as "Source: Name" with a link. With any of these (or `actions`), the footer becomes one row, "Chart: Author • Source: Name • Get the data • Download image", which wraps on a narrow frame without changing the plot height. The footer words come from `footerLabels`, with English defaults. A frame that sets only a plain `source` keeps its current all-caps source row.
- **Footer actions.** `actions={["data", "svg", "png", <YourLink />]}` adds footer links in Datawrapper order: data, your own nodes, SVG, then PNG.
- **`altText`.** Describes the chart for screen readers. A labelled chart takes it as its description ahead of its generated summary; the chart's own `accessibleDescription` still wins. A chart with no figure of its own gets the frame body as a described figure.
- **`InlineChip`.** Put `<InlineChip series="ram">short-term RAM</InlineChip>` in a `description` and it takes the series' colour from the chart inside the frame, so the prose can stand in for a legend. The swatch is named by `label`, else the chart's series name, else the key. It is exported, with a stand-in in `@elabs-ai/components-charts/test`.
- **Complete export.** Download SVG/PNG now draws the title, description, axis tick labels, axis titles, legend labels, notes and footer text into the file, at the positions and colours shown on screen. The footer's action links are not drawn. The export is built from measured positions, not a screenshot. `exportOptions={{ scale: 1 | 2 | 3 | 4, plain }}` sets the PNG pixel ratio (default 2; scale 3 gives 3× the frame's CSS width), and `plain` exports the chart body with no header or footer text. `ChartFrameMenuApi.exportSvg` and `exportPng` also accept `{ scale, plain }`. `onExport(kind, blob, filename)` is unchanged.
- **Dashboard export.** Each chart tile in a dashboard sheet export now includes its tick and legend text. The tile's size and marks are unchanged.
- **`ChartSpec`** gains `notes`, `byline`, `source` and `altText`. An `AutoChart` inside a `ChartFrame` hands the first three to the frame, and uses `altText` as the chart description when `description` is unset.

Deprecated: nothing. Visible change: a `ChartFrame` SVG/PNG export used to contain the chart `<svg>` plus an optional source row, and is now frame-sized with the header and footer text. If you need the old plot-only file, use `exportOptions={{ plain: true }}`; `plain` still includes axis and legend text.
