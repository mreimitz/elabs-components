---
"@elabs-ai/components-tokens": minor
"@elabs-ai/components-charts": patch
---

Hairline rails become corner marks, and a new striped header ground.

- **tokens** — `hairline-rails` now inks its rails and seam rules only near the corners where they cross (`--hairline-rail-reach`, default `7rem`) and fades to nothing in between and toward the viewport edge; `hairline-rails-full` restores the whole lines. New `bg-hairline-stripes`: diagonal stripes that stream out of one corner (`--hairline-stripe-origin`, top-right by default) and thin as they fade — heavy at the corner, a hairline by the end of their reach — as the structured ground of a hero or header band (`--hairline-stripe-ink | -pitch | -weight | -angle | -reach`).
- **charts** — `LiveLine` pins its live dot, guide line and value badge to the plot. While the smoothed y-domain had not caught up (first frames, or paused off-screen) the badge could paint thousands of pixels above its chart.
