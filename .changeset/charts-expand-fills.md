---
"@elabs-ai/components-charts": minor
---

An expanded chart now fills the expand dialog. `ChartFrame`'s expand view used to draw the chart at the size it was given inline — its own `plotHeight`, or 2 : 1 of the pane's width — leaving much of the pane empty. The chart now takes the pane's full height, over its own `plotHeight`.

New host setting: `ChartConfigProvider value={{ plotHeight }}` forces the plot height of every chart inside it — a px number, `{ aspect }`, or `"fill"` (the full height of a parent whose height is definite; where the parent has no height of its own, the chart keeps its own size). It overrides each chart's own `plotHeight`/`aspectRatio`; a fixed `size` on a pie, ring or radar still wins. Nested providers inherit it unless they set their own. New type: `ChartHostPlotHeight`.
