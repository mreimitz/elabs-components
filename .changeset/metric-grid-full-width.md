---
"@elabs-ai/components-charts": patch
---

`MetricGrid` now fills the width it is given inside a centered or flex parent. Before, the grid's container-query wrapper had no width of its own there, so the whole grid collapsed to 0 px wide and its tiles and charts drew nothing. The published Storybook showed this on five MetricGrid stories.
