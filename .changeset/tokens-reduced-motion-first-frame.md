---
"@elabs-ai/components-tokens": patch
---

`useReducedMotion` now knows the operating system's reduced-motion setting from the very first render in the browser, instead of one frame later. An animation no longer starts for a frame before a reduced-motion setting takes effect.

- `useReducedMotion` reads the operating system setting while rendering. The person's own motion setting from `ThemeProvider` still wins over it, server rendering still assumes full motion, and hydration settles on the browser's value without a mismatch.
