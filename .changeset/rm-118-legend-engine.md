---
"@elabs-ai/components-charts": minor
---

Legend engine (RM-118). `ChartLegend` gains toggle interactivity — `hiddenKeys`/`onToggleKey`
turn each item into a real `<button aria-pressed>` (dimmed with both opacity and a line-through,
never colour alone), and a new `hideAtDensity` prop lets a caller opt an instance out of the
density `sm` legend-hiding default without touching it for direct `ChartLegend` callers. Two new
ramp keys land: `RampLegend` (continuous/stepped `--chart-seq-*`/`--chart-div-*` ramps, ruler/
range/custom labels, an optional hover marker, horizontal or vertical) and `SizeLegend` (sqrt-
scaled sample circles for a bubble radius scale). `useContainerLegend` is the new hook a container
mounts to read `legend` (`boolean | { position, layout, interactive, values, title }`) and place a
`ChartLegend` in the measured box next to the plot. `HeatmapChart`'s stepped key
(`HeatmapLegend`) gains `hover` (moves a marker to that value's position, sharing `RampLegend`'s
positioning math) and `labelMode: "ranges"` (one from–to label per swatch instead of the lo/hi
bookends) — both additive and off by default. `ChartSpec.legend` widens to also accept the
`useContainerLegend` config object (containers that wire the hook read it; `AutoChart` still
reads only the boolean form for now).

`BarChart` mounts the engine with full toggle interactivity (`legend`, hiding a series on click).
`PieChart`, `ScatterChart`, `TreemapChart` and `DumbbellChart` mount it too, capped at hover-only
(`maxInteractive: "hover"`) — a legend row highlights on hover/focus but never hides anything,
since none of these families has a per-item show/hide. `ScatterChart` lists a `colorBy`-resolved
colour key in place of the plain per-series rows when one is set. `TreemapChart` lists one row per
top-level group for `palette="categorical"` (real hover-dim on the group's tiles) and renders
`RampLegend` instead for `palette="sequential"` (nothing for `"mono"`). `DumbbellChart` lists one
row per `valueKeys` entry for `variant="dots"` (real hover-dim on that key's dots across every
row), replacing its own pre-existing, always-on corner colour-key badge when `legend` is set (that
badge is unchanged when `legend` stays unset). `AutoChart` forwards `spec.legend` to all five
families, retiring its own `AutoLegend` fallback for them — `AutoLegend` itself stays, since
`radar`/`funnel`/`waterfall` and the other families outside this wave can still reach it through a
multi-series spec.
