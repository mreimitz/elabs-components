---
"@elabs-ai/components-charts": minor
---

Chart selection now follows the editorial rules it documents, and the River recipes ship as stories.

`AutoChart`'s type inference changed in two ways when you omit `type`:

- **A pie is capped at five wedges**, counted after `groupSmall` folds its "Other" slice. A share table with six or more categories and no `groupSmall` now infers `bar` instead of `pie`. Migration: if you want the pie back, either pass `type: "pie"` explicitly (an explicit type always wins and is never capped) or add `groupSmall: { max: 4 }`, which folds the tail and reads as a pie again.
- **`area` is now inferred**, but only for two or more temporal series that compose one total — either `stacked: "percent"`, or values that sum to ~100 on every row. Everything else stays `line`. Migration: none for a single series or for series that do not add up; a percent-stacked temporal spec that used to draw as a line now draws as an area, which is the honest reading. Pass `type: "line"` to keep the old picture.

No published story's inferred type changes.

Also: `brand-ui chart-for "many overlapping lines over time"` now returns `ChartMultiples` first and `"two measures per category with a direction"` returns `DumbbellChart` first; every `ChartSpec` field added in the Datawrapper-parity waves carries a "when to use" paragraph; and five River recipes ship as stories under `Charts/Recipes/River`.

Deprecated: nothing.
