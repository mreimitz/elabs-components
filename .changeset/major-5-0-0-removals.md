---
"@elabs-ai/components-charts": major
"@elabs-ai/components-ai": major
---

**BREAKING.** Two exports deprecated in the 4.x line are gone, on the schedule `docs/DEPRECATION.md` sets: deprecate in a minor, remove in the next major.

1. **`YAxis`'s `formatLargeNumbers` prop is removed.** Use `valueFormat`, which knows about millions as well as thousands — the old boolean rendered 1 500 000 as `1500k`. `formatLargeNumbers={false}` becomes `valueFormat="number"` (every digit). `formatLargeNumbers` or `formatLargeNumbers={true}` is simply deleted: compact formatting is the default, so `1.5M` is what you already get.
2. **`@elabs-ai/components-ai`'s `Toolbar` and `ToolbarProps` are removed.** They were aliases of `NodeToolbar` / `NodeToolbarProps`, renamed because `Toolbar` is the WAI-ARIA toolbar in `@elabs-ai/components-ui` and two different components under one name in one import line is a trap. Rename the import; nothing else changes.

Both are type-level or prop-level, so TypeScript points at every call site. Nothing in this release is deprecated AND removed: `height` on `ChartFrame`, `AutoChart` and `WaterfallChart`, and the numeric `scale` on `ChoroplethChart`, are deprecated here and stay working until the next major.

The **shadcn registry** also moves: it is served by the website at `https://elabs-ai.com/r/<item>.json` (and identically on `https://elabs-components.vercel.app`). The `gh-pages` copy under `/r/<version>/` and `/r/latest/` is gone — it was never reachable, so no working URL changes, but a `components.json` that registered the old base needs the new one.
