---
"@elabs-ai/components-charts": minor
---

`TreemapChart` gains `showValues` (default `false`): each labelled tile prints its formatted value under its name when it is tall and wide enough for the whole number, with one notation shared across the tiles — fixes #247. `ChartSpec` gains `palette` (`"mono"` | `"sequential"` | `"categorical"`, default `"mono"`) so a spec-driven `AutoChart` treemap can colour leaves by value or by group; an unknown value renders mono, and the `/test` double rejects an unknown palette or a palette on a non-treemap spec. New exports: `ChartSpecPalette`, `CHART_SPEC_PALETTES`, `isChartSpecPalette` — fixes #306.
