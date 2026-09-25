---
"@elabs-ai/components-charts": minor
---

Chart tooltips never cover the pointer or the thing you are looking at.

- `ChartTooltipBox` places itself with a keep-out engine instead of flip-then-clamp. The box is always placed wholly beside the pointer (or a keyboard-focused target) and the hovered mark, never clamped back over them. On a chart too small to hold it (a small multiple, a sparkline-sized panel) it steps outside the chart, beside it, over nearby page content, and stays there while you scrub. If nothing fits, it hides rather than cover the pointer. A finger gets the box above it. It follows reading direction (right-to-left starts on the left).
- The box renders in the browser's top layer (`popover="manual"`), so a `ChartFrame`, `Card` or dialog that clips its overflow no longer cuts it off. It stays in the chart's own DOM (theme, `data-slot`, export exclusion unchanged). `Esc` hides it until the hover moves on. Under reduced motion the box jumps instead of sliding and has no entrance animation (it used to replay its scale-in on every hover). A side change never slides across the pointer.
- New optional `ChartTooltipBox` props: `avoid` (the hovered mark(s) to keep clear of: a rect, an element or a ref), `track` (`"x"` crosshair, `"y"` rows, `"free"`) and `pinned`. `left`/`top`/`flipped` are deprecated: they bypass placement and keep the old behaviour. `ChartTooltip` and every chart family with its own box (dumbbell, bump, unit, network, heatmap, treemap, density scatter, sankey, choropleth, distribution, canvas layer, parallel coordinates) pass their hovered mark.
- The crosshair date pill (and the live chart's time pill) shows only when it fits in the gutter under the plot (bottom margin ≥ 36px); the x-axis labels no longer fade for a pill that is not there. `showDatePill` still forces it either way.
- `Sparkline`'s readout uses the same placement, above the line first. `ChartTooltip variant="inline"` moves its label below the point when the pointer sits where the label would be.
- `ChartMultiples` matches a numeric x value to the label a non-time panel reports, so synced panel titles show the hovered reading on a linear or band x axis.
- The `infographic-small-multiples-01` block plots its weeks as "Week 1"…"Week 13" (the tooltip title read "Thu, Jan 1" before) and shows the tooltip value as a percentage, like the panel title.
