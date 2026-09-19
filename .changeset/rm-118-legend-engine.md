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
