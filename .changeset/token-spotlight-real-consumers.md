---
"@elabs-ai/components-ui": patch
---

`TokenSpotlight` marks only the elements that really paint a token, without a long task, and shows readable values. A border colour counts only on a side whose width is above 0, the text colour counts only on an element with its own text, and an SVG shape's fill or stroke is reported once as its `<svg>`. The `data-token-consumer` marks are written in idle slices, and are cleared on unhover, unmount and theme change. Chip values show colours as a rounded `oklch(L C H)` (never a build-transpiled `lab()`) and lengths such as `--radius` as resolved px (never a raw `calc()`). They are re-read when `data-decoration` changes as well as `data-theme`. No prop changes.
