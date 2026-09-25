---
"@elabs-ai/components-charts": patch
---

`LegendItem` (the standalone `Legend`/`LegendItem` compound, e.g. `ProfitLossLegend`) now
renders a real, focusable `<button>` with `onFocus`/`onBlur` mirroring its existing
`onMouseEnter`/`onMouseLeave` — a keyboard user can now reach `focusOnHover`'s spotlight/dim
state the same way a mouse user already could. `LineChart`'s and `AreaChart`'s own "Focus on
hover" stories now mount a legend so Tab has a legend item to reach at all.
