---
"@elabs-ai/components-ui": patch
---

`SpecPlayground`'s click-to-line now locates a line for Chromium's position-free `JSON.parse` errors too ("Unexpected token …" and "Unexpected end of JSON input"), not just messages that carry a `line`/`position`. Its error-list id now falls back to `useId()` instead of a shared literal, so two `id`-less instances on the same page no longer collide, and the last-valid spec it keeps on screen while the current text is invalid is no longer written to a ref during render.
