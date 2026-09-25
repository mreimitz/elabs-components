---
"@elabs-ai/components-data": minor
"@elabs-ai/components-ai": patch
"@elabs-ai/components-ui": patch
"@elabs-ai/components-cli": patch
---

Agent-native data grids and export: `AutoGrid` renders a DataGrid (or table) from one serialisable `DataGridSpec` (rows, optional column specs inferred with `inferColumnSpecs`, a saved view, grouping, totals) and joins the A2UI catalog as its `@elabs-ai/components-data` half (`DATA_A2UI_BINDINGS`, `DATA_A2UI_CATALOG_SCHEMA`; the published surface schema now includes it). Saved views become versioned `GridState` documents (`serializeGridState`, `parseGridState` with migration and validation, `GRID_STATE_JSON_SCHEMA`). Real `.xlsx` export with no dependency (`toXlsx`, `tableToXlsx`; "Export to Excel" in the grid context menu, loaded on demand).
