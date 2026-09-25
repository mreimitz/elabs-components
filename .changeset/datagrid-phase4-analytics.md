---
"@elabs-ai/components-data": minor
"@elabs-ai/components-ui": patch
---

DataTable / DataGrid analytics: row grouping (`grouping` / `expanded` view slices, `enableGrouping` for "Group by" in the column menu and a removable grouping bar with expand / collapse all), aggregates per column via `meta.aggregate` on group rows and in a `showTotals` totals row over every filtered row, tree data via `getSubRows`, master / detail via `renderDetail`, a pure `pivotData` helper producing rows and grouped `ColumnDef`s with row and column totals, and "Chart selection" in the grid context menu that hands the selected block to `onChartRange`. New locale keys for expanders, totals and grouping.
