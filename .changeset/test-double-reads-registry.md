---
"@elabs-ai/components-charts": minor
---

`configureChartTestDouble` gains a `deprecatedProps` option: `"ignore"` (default, unchanged), `"warn"` (reports every deprecated prop found on a render via `console.warn`, once per prop name), or `"throw"` (fails the render), for a test double that receives a chart prop mid-rename. `resetChartTestDoubleConfig` resets it back to `"ignore"`. Until a prop's rename lands, this has no effect on any chart.
