---
"@elabs-ai/components-maps": patch
---

`MapGeoJSON`'s `fillPaint`/`linePaint` (and their hover/selected variants) now resolve a semantic token colour — `var(--chart-1)` or the bare `--chart-1` form — to a concrete colour before handing it to MapLibre's WebGL paint, the same way the component's own theme-aware defaults already did. Previously a token reference passed in one of these props reached MapLibre's paint validator unresolved (WebGL cannot read CSS custom properties) and was silently rejected, so a token-coloured line or fill layer failed to draw.
