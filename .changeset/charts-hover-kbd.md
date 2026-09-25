---
"@elabs-ai/components-charts": patch
---

`Legend`'s `LegendItem` is now a real, Tab-reachable `<button>` (was a plain `<div>` with only mouse hover, so a keyboard user could never reach it). Focusing an item highlights it the same way hovering it does.

`LineChart`/`AreaChart`'s `focusOnHover` spotlight already gets a keyboard path when a legend is on screen — the container legend's hover-highlight rows are real, focusable buttons, and focusing one dims every other series exactly like hovering it does. That wiring is now covered by a regression test, and `series-hover-dim.tsx`'s doc comment is corrected: the legend-driven spotlight is keyboard-operable; only hovering a series' own rendered shape directly stays pointer/touch-only, since a keyboard target there would need `tabIndex` on the SVG mark itself, which this package's chart rules forbid.
