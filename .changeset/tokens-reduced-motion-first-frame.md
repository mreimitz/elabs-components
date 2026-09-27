---
"@elabs-ai/components-tokens": patch
---

Motion settings now apply from the very first render in the browser, instead of one frame later. An animation no longer starts for a frame before a reduced-motion setting takes effect, and a person who saved "full motion" is no longer treated as "reduced" while the page loads.

- `useReducedMotion` reads the operating system setting while rendering. The person's own motion setting from `ThemeProvider` still wins over it.
- `ThemeProvider` reads the saved motion setting while rendering, not in an effect after it. If storage cannot be read, it falls back to `defaultMotionPreference`. A change saved in another tab now reaches the page too.
- `useMotionPreference().prefersReducedMotion` reads the same operating system value as `useReducedMotion`, so the two agree from the first render.
- Server rendering still assumes the default setting and full motion. Hydration renders what the server did and then settles on the browser's values, without a mismatch.
