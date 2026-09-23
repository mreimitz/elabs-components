---
"@elabs-ai/components-ai": patch
---

`CodeBlock` no longer bundles Shiki's syntax-highlighting engine into your entry chunk. It now loads Shiki lazily on first use — code still renders immediately via a plain fallback, then highlights once the engine loads, with no layout shift.
