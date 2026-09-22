---
"@elabs-ai/components-charts": patch
"@elabs-ai/components-ui": patch
---

Gantt: switching the scale (Day / Week / Month / Quarter) now switches the density too. A `defaultPixelsPerDay` seed or an earlier wheel-zoom no longer pins the bars while only the header relabels — uncontrolled density drops back to the new scale's preset, controlled density receives it through `onPixelsPerDayChange`. The preset is floored at "the whole domain fits the timeline pane" (the pane is measured), so a coarse scale fills the width instead of a 600 px strip, and the first header cell of a scale that starts before the domain is clamped into view (its label was off-canvas). `ui` exports `mergeRefs`.
