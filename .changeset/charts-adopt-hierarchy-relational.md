---
"@elabs-ai/components-charts": minor
---

`TreemapChart`, `TreeChart`, `SankeyChart`, `NetworkChart` and `ParallelCoordinatesChart` all gain `status="loading"` for the skeleton, the same as the rest of the package. `TreemapChart`, `SankeyChart`, `NetworkChart` and `ParallelCoordinatesChart` also gain `empty={{ title, message, action }}` for the nothing-to-plot state (`TreeChart` has no such state: its `data` is always one real root node, never an empty list). `TreeChart` also gains `plotHeight` (a fixed or responsive plot height, matching the other families) and its tooltip now keeps clear of the hovered node the same way every other chart's tooltip does.

`SankeyChart` gains `accessibleLabel` and `accessibleDescription`: set a label with no description and the chart announces a generated summary ("Sankey diagram, 5 nodes, 8 links") through the same screen-reader seam `LineChart`, `AreaChart`, `BarChart`, `ScatterChart` and `PieChart` already use, so a Sankey diagram is no longer silent to assistive technology.

No default values changed. Two behaviours did change, new props or not: an empty `Treemap`/`Sankey`/`Network`/`ParallelCoordinates` now shows a "No data" panel where it used to render blank (pass `empty` to override its title and message; `TreeChart` has no `empty` state — a tree's root is always one real node, never "nothing to plot"), and `TreeChart`'s tooltip now moves off the hovered node instead of covering it.

A `TreemapChart` counts as empty only when its data has no positive value to draw, decided from the data rather than the drawn layout: a one-level hierarchy at the default `depth` of 2 still draws its top-level groups, as before, and a root with `children: []` shows the "No data" panel instead of throwing a development error. While `status="loading"`, a `TreeChart` with no `plotHeight` reserves the shared default plot box (2:1, 1.25:1 when narrow) for its skeleton instead of collapsing to no height.
