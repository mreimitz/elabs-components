---
"@elabs-ai/components-ai": minor
"@elabs-ai/components-charts": minor
"@elabs-ai/components-cli": minor
"@elabs-ai/components-data": minor
---

The A2UI catalog (`brand-ui a2ui catalog`, `<A2uiSurface>`) now describes every chart prop from the same source as the rest of the docs, instead of falling back to `any` for anything shaped `Responsive<T>`. `AutoChart`'s `plotHeight` (and every other responsive chart prop the catalog covers) now carries a real schema — the plain value, or the per-breakpoint `{ base, medium?, narrow? }` object — so a generated surface using it is actually checked, not waved through.

Props renamed ahead of 6.0.0 (`AutoChart.height` → `plotHeight`, `Sparkline.label` → `accessibleLabel`, …) stay in the catalog: an agent-emitted surface that still names the old prop keeps validating and keeps rendering, exactly like the rest of brand-ui's pre-6.0 deprecation policy. `brand-ui a2ui validate`/`validateA2uiSurface` now flag it as a warning (`deprecated-prop`, not an error) instead of staying silent — `result.ok` is unaffected, so nothing that already checks `.ok` changes behavior.

`catalog.source.json` also gains `choropleth` to `AutoChart`'s chart-type prose.
