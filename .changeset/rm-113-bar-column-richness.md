---
"@elabs-ai/components-charts": minor
---

`BarChart` gains Datawrapper's bar/column vocabulary: `stacked="percent"` (each category normalised to 100 %, a format-less `YAxis` prints percent) and `stacked="diverging"` with `divergingCenter` for Likert rows; `stackOrder` and `showTotals`; `sort` / `reverse`; `groupBy` with group headers and separators; `colorBy` (categorical, sequential or diverging, with a colour key); `track` background bars; value and range `overlays`; and `comparison` columns with `comparisonLabel`. `Bar showValues` also accepts `{ position, visibility: "hover" }`. The chart context exposes `legendItems` (series, colour key, comparison, overlays). `ChartSpec` gains the `stacked` union plus `divergingCenter`, `sort`, `groupBy`, `colorBy`, `overlays` and `comparison`, and AutoChart infers `diverging-bar` for a Likert spec with a named middle series.

Deprecated: nothing. No existing default changes — a chart that sets none of the new props renders as before.
