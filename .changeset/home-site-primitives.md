---
"@elabs-ai/components-tokens": minor
"@elabs-ai/components-ui": minor
---

Browser-only primitives for the new elabs-ai.com site (`apps/home`, ADR 0038). `@elabs-ai/components-tokens`: `ThemeProvider` takes an optional `transition?: (apply: () => void) => void` so an app can wrap a theme change (for example in a view transition). `@elabs-ai/components-ui` gains `ThemeFamilySwitch` (theme-family chips plus a light/dark toggle), `AmbientField`, `ParallaxPlane`, `RevealOnEnter` and `useScrollProgress` (with `MOTION_FACTOR_FLOOR`, `isMotionAtFloor`, `readMotionFactor`, `supportsScrollTimeline`). `motion` is an optional peer of ui, loaded only by dynamic `import()`; ui now ships `dist/index.css` (`sideEffects: ["**/*.css"]`). `@elabs-ai/components-marketing` stays server-safe.
