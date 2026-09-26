---
"@elabs-ai/components-charts": minor
---

Bar charts can now title their axes: `BarXAxis` and `BarYAxis` accept `title` and `titlePlacement`, drawn the same way `XAxis` and `YAxis` draw theirs.

Reference lines, trend fits and computed lines are now drawn by one shared painter with one set of dash patterns, so they look the same on every chart. Nothing changes on screen.

`ScatterChart` and `CandlestickChart` now declare the `annotations` prop they already honoured, so it is typed and documented.
