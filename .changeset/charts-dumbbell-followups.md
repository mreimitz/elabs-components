---
"@elabs-ai/components-charts": patch
---

- `DumbbellChart` `variant="arrow"`: a row's delta label now sits above its own arrow head, its bottom edge derived from the head's width, so a short row's label never paints over the head at narrow widths (#547).
- `PieSlice`: under reduced motion the entrance skips the per-slice stagger and the sweep, so every slice mounts whole instead of taking about a second (#549).
- `Scatter`: the default animated point path now carries `data-slot="scatter-point"` and `data-index` on each point, like the static path; `SeriesMarkers` gains an opt-in `pointSlot` so line/area markers stay unnamed (#549).
