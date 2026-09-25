---
"@elabs-ai/components-charts": minor
---

`BarChart`'s `stackGap` now works. Before, setting it on the chart did nothing, and a `Bar`'s own `stackGap` pushed each segment further up the stack, so the top of a stack sat above its real total and the bottom lifted off the baseline.

The gap is now cut only out of the boundaries between segments, half from each side. Every stack still starts on the baseline and ends exactly at its total, in plain, percent and diverging stacks alike, and positive and negative stacks never get a gap at zero. A `Bar`'s own `stackGap` overrides the chart's value for that series, `ComposedChart` stacks follow the same rule, and the tooltip dots sit on the ends the bars draw.

The default stays 0, and at 0 every chart draws exactly as before.
