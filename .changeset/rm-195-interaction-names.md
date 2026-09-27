---
"@elabs-ai/components-charts": minor
---

`ChoroplethChart`, `TreeChart`, `LiveLineChart`, `SankeyChart` and `PieChart` now take the ADR
0042 Appendix A.5 names for their zoom, window and hover interaction props. The old names keep
working, unchanged, until 6.0.0, and each logs one warning in development naming the
replacement. A caller who passes an old name and its new name together keeps the new value.

- `ChoroplethChart`: `zoomEnabled` → `zoom`. `zoomControls` alone still turns zoom on.
- `TreeChart`: `zoomable` → `zoom`; `align` → `plotAlign`.
- `LiveLineChart`: `window` → `windowSeconds`.
- `SankeyChart`: `hoveredNodeIndex` → `hoveredIndex`; `onNodeHoverChange` → `onHoverChange`.
  Either name still drives the controlled hover callback end to end.
- `PieChart`: `align` → `plotAlign`.

`BumpChart` and `ParallelCoordinatesChart` `highlightKey` widen to accept a `number` alongside
their existing `string` form (ParallelCoordinatesChart keeps its predicate form too), matched
`==`-free via `String(...)` — the same rule `Bar`'s `highlightKey` already uses. This is a type
widening only: there is no alias row and no warning, since every existing call site still
type-checks and behaves exactly as before.

### Deprecated

- `ChoroplethChart` `zoomEnabled` → `zoom`.
- `TreeChart` `zoomable` → `zoom`.
- `TreeChart` `align` → `plotAlign`.
- `LiveLineChart` `window` → `windowSeconds`.
- `SankeyChart` `hoveredNodeIndex` → `hoveredIndex`.
- `SankeyChart` `onNodeHoverChange` → `onHoverChange`.
- `PieChart` `align` → `plotAlign`.
