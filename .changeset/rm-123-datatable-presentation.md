---
"@elabs-ai/components-data": minor
---

`DataTable` gains a presentation layer (RM-123), all opt-in per column through `meta` or per table through new props:

- **In-cell visuals** (`meta.visual`): `bar` (with `track`, `range: "column" | "table" | [min, max]`, a `slim` style, a category `colorBy`, negatives drawn left of zero in the negative token), `sparkline` and `columns` (a row's series from `keys`; `range: "column"` shares one y scale down the column), and `heatmap` (a ramp colour from the shared `colorScaleFor` scale; columns with the same `scale` spec share one scale; `hideValue`; a `legend` key). Every visual keeps its value readable to screen readers, and sorting always uses the raw value.
- **`meta.format`** (the charts `valueFormat` object shape), **`meta.colorBy`** (tint a cell or row by a category), **`meta.markdown`** (a safe inline subset, never HTML), **`meta.width` / `minWidth` / `style`**, and **`meta.showAt`** (`{ base: true, narrow: false }` hides a column when the table is under 450 px wide).
- **Table props:** `layout` (`"table"` default, `"cards"`, or `"auto"` = cards under 450 px), `stickyRows` (rows kept at the top or bottom of every page, outside sorting, paging and search), `showRanks`, `density="compact"`, `mergeEmptyHeaders`, `searchMode="exact"` and `hideHeader`.
- New exports: the cell components (`BarCell`, `SparklineCell`, `ColumnsCell`, `HeatmapCell`, `HeatmapLegend`, `MarkdownCell`), the card parts (`DataTableCardList`, `DataTableCard`), the rank parts, `useTableBreakpoint` and the pure scale helpers.

`DataTableColumnMeta` now lives in its own module and is still exported from the package under the same name; it only gained optional fields.

Deprecated: nothing.

Migration: none needed. With no new prop or `meta` field set, the table renders exactly as before. The breakpoint is measured on the table's own box (not the viewport), so a table in a narrow sidebar switches at 450 px of its own width.
