---
"@elabs-ai/components-charts": minor
---

`TreemapChart`, `TreeChart`, `SankeyChart`, `NetworkChart` and `ParallelCoordinatesChart` now share the same loading/empty machinery as the rest of the package: pass `status="loading"` for the skeleton, or `empty={{ title, message, action }}` for the nothing-to-plot state. `TreeChart` also gains `plotHeight` (a fixed or responsive plot height, matching the other families) and its tooltip now keeps clear of the hovered node the same way every other chart's tooltip does.

`SankeyChart` gains `accessibleLabel` and `accessibleDescription`: set a label with no description and the chart announces a generated summary ("Sankey diagram, 5 nodes, 8 links") through the same screen-reader seam `LineChart`, `AreaChart`, `BarChart`, `ScatterChart` and `PieChart` already use, so a Sankey diagram is no longer silent to assistive technology.

No default changes and no behaviour changes for a chart that does not use these new props.
