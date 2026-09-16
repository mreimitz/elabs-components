---
"@elabs-ai/components-charts": patch
---

HeatmapChart: the empty state now renders inside the chart's plot box (no layout jump when data arrives) with a title, message and optional `emptyAction`; a measured zero and a missing value draw different marks with separate legend keys; in-cell value labels pick their ink from the step they sit on instead of one fixed ink.
