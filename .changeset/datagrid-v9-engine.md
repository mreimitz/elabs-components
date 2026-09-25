---
"@elabs-ai/components-data": minor
"@elabs-ai/components-ui": patch
---

`DataTable` now runs on TanStack Table v9 — ~2.8× less JS heap at 100k rows (325 → 115 MB), about 2× faster mount, and ~9× fewer long scroll frames on a throttled CPU (measured against AG Grid Community in `fixtures/grid-bench`).

- **Public types keep their v8 shape.** `ColumnDef<TData, TValue>`, `Row`, `Table`, `CellContext`, `{ left, right }` column pinning and `Record<string, boolean>` row selection are unchanged; a v8 `sortingFn` is still honoured (v9 calls it `sortFn`). Import them from `@elabs-ai/components-data`, not from `@tanstack/react-table`.
- **Breaking for code that calls TanStack directly on the `toolbar` table:** v9 pins to logical edges — `column.pin("start" | "end")`, not `"left" | "right"`.
- **Fix:** `enablePagination` together with `enableRowVirtualization` rendered only page 1 with no pager; virtualization now wins and every row stays reachable.
- **Fix:** sort-button names, the pager and the default empty message went out in English regardless of locale; they now use the locale seam (`data.table.sortBy`, `data.table.pageStatus`, `previous`, `next`, `noResults`).
- **New:** `meta.label` names a column whose `header` is a render function (sort buttons, `ColumnPicker`); multi-sort shows and announces each column's sort priority; `rowHeight` gives a virtualized table a fixed row height and skips measurement.
- **Accessibility:** `ColumnPicker` and `FacetFilter` items are checkbox items, so their on/off state reaches assistive tech; `ColumnPicker` lists leaf columns by their header label, never by id.
