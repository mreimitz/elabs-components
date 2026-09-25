---
"@elabs-ai/components-charts": patch
---

- `DumbbellChart` `variant="arrow"`: a row's delta label now sits above its own arrow head, its bottom edge derived from the head's width, so a short row's label never paints over the head at narrow widths (#547).
- `PieSlice`: under reduced motion the entrance skips the per-slice stagger and the sweep, so every slice mounts whole instead of taking about a second (#549). Fixed a regression this introduced: the hover/focus glow (`drop-shadow`) stopped updating once the entrance became effectively instant, because Motion only reliably re-applies a `style` value that is also part of the `animate` target — the glow now moves through `animate`/`transition` on every slice render path (mount-complete, in-flight entrance, and the non-animated `animate={false}` slice), so it updates on every hover/focus change regardless of motion preference.
- `Scatter`: the default animated point path now carries `data-slot="scatter-point"` and `data-index` on each point, like the static path; `SeriesMarkers` gains an opt-in `pointSlot` so line/area markers stay unnamed (#549).
