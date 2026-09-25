---
"@elabs-ai/components-ai": patch
---

`ToolInput`/`ToolOutput` now pass `wrap` to their internal `CodeBlock`, so long
input/output payloads with no natural line breaks soft-wrap instead of overflowing
into a horizontally scrollable region with nothing keyboard-focusable inside it
(axe `scrollable-region-focusable`).
