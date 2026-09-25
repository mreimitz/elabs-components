---
"@elabs-ai/components-ai": patch
---

`Tool`'s `ToolInput` and `ToolOutput` now render their internal `CodeBlock` with `wrap` on by default, so a long tool parameter or result soft-wraps instead of scrolling horizontally inside a container a keyboard couldn't reach — fixing an axe `scrollable-region-focusable` violation for any long payload.
