---
"@elabs-ai/components-charts": minor
---

Nothing looks different: `RingChart` now renders through the same internals as `PieChart`
(RM-202, review finding F28). `PieChart`, `PieCenter`, `PieSlice`, `Ring`, `RingCenter` and
`RingChart` keep every public prop, type name, `data-slot` and default.

Internally, the two families now share one arc-path generator, one ~100ms mount-load timer,
one named-child predicate (`isNamedChartChild`, replacing four near-identical
`isPieCenter`/`isPieSlice`/`isRing`/`isRingCenter` copies), and one generic center-rendering
engine (`ChartCenterEngine`) behind `PieCenter`/`RingCenter`'s own prop shapes. `ring-chart.tsx`
drops from 813 to 757 lines and `pie-chart.tsx` from 1408 to 1357; three new internal modules
(`pie-ring-engine.ts`, `use-arc-chart-loaded.ts`, `pie-ring-center-engine.tsx`) hold the shared
logic and are not exported.
