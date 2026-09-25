---
"@elabs-ai/components-data": minor
"@elabs-ai/components-ui": patch
---

DataGrid / DataTable filtering: `enableFilterUI` adds a filter button to every filterable header (text / number / date conditions with AND / OR and relative date ranges, a value checklist with counts and search, yes / no), `floatingFilters` adds a type-to-filter row (`>100`, `10..20`), `showFilterChips` lists active filters as removable chips, and `enableFind` gives grids Ctrl/⌘+F find across every row with Custom-Highlight-API highlights. Filters are plain JSON models in `columnFilters`; legacy filter values keep TanStack's semantics. `meta.filter` picks or disables a column's filter kind. `DataGrid` turns all of it on except the floating row. New locale keys under `data.table.filter*` / `data.table.find*`. Date conditions use the browser's native date field, so the filter panel adds no calendar library to the bundle.
