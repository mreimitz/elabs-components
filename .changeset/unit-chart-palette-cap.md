---
"@elabs-ai/components-charts": minor
---

`UnitChart` now honours the six-colour limit when you leave `palette` unset. With seven or more series and no `palette` prop, it draws the neutral grey ladder and logs one development warning, the same as `BarChart` and the other chart families. Before, it always drew twelve category colours, as if you had asked for them. Passing `palette="categorical"` yourself still gives one colour per series at any count, with no warning. Charts with six or fewer series look the same as before.
