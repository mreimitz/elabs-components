---
"@elabs-ai/components-charts": minor
---

`DumbbellChart` — the `"dumbbell"`, `"slope"` and `"arrow"` variants now take the shared container legend too: two entries keyed by marker shape (hollow start, filled end) in neutral ink, labelled by the new `startLabel` / `endLabel` props (default: `startKey` / `endKey`). `AutoChart` routes every dumbbell variant through the shared legend, using each series' `label`, and retires its old before/after list for dumbbell. `LegendItem.marker` and `ChartLegendEntry.marker` gain `"hollow"` (a ring swatch, `data-marker="hollow"`), so a hollow/filled pair stays distinguishable in greyscale.
