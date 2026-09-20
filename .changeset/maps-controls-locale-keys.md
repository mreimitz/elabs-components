---
"@elabs-ai/components-ui": patch
---

Add the `maps.*` microcopy keys the map controls and the map loading state now read through `t()`: `maps.canvas.loading` and `maps.controls.zoomIn` / `zoomOut` / `resetBearing` / `locate` / `locating` / `fullscreen` / `fit`.

They shipped as hardcoded English inside `@elabs-ai/components-maps`, which meant a localized app had no way to translate a zoom button. Every key keeps its old English wording as the default, so nothing changes for an app that does not translate.
