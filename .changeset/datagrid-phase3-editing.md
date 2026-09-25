---
"@elabs-ai/components-data": minor
"@elabs-ai/components-ui": patch
---

DataGrid editing: with `onCellEdit`, columns marked `meta.editable` edit in place (Enter / F2 / typing / double-click; text, number, date, select and checkbox editors, inferred or set with `meta.editor` / `meta.options`), validate with `meta.validate`, accept pasted TSV blocks from spreadsheets (fill / tile rules), clear with Delete, cut with Ctrl/⌘+X, fill down with Ctrl/⌘+D and undo / redo with Ctrl/⌘+Z / Ctrl/⌘+Y. Every action arrives as one batch of changes; `applyCellChanges` applies it to key columns. The package now also exports `DataTableCellSelection`, `DataTableCellChange`, the column / context menu item types and the filter-model helpers. Copy now keys off the focused cell rather than the event target.
