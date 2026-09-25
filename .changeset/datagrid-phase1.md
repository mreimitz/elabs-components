---
"@elabs-ai/components-data": minor
"@elabs-ai/components-ui": patch
---

New `DataGrid` — the spreadsheet-grade preset of `DataTable` (`interaction="grid"`):

- **WAI-ARIA grid:** one tab stop; arrow keys across header and body cells (mirrored under RTL), Home / End, Ctrl/⌘+Home / End, Page Up / Down (virtualized rows scroll into view), ↑ from the first row to the header, Enter / Space on a header sorts, Enter on a cell activates the row, Space toggles row selection.
- **Cell ranges:** drag, Shift+click / Shift+arrows to extend, Ctrl/⌘+click to add (or carve out of) a range, Ctrl/⌘+A, Escape; Ctrl/⌘+C copies what the cells display as tab-separated text. Ranges are a controllable `cellSelection` slice keyed by row / column id.
- **Columns:** a column menu (sort, pin, move, auto-size, fit, hide, reset, custom items; Alt+↓ opens it), drag-to-reorder and Shift+←/→ (`columnOrder` slice), Alt+←/→ resize, double-click-free auto-size to content, and `autoSizeStrategy="fit"`.
- **Context menu** on cells: Copy, Copy with headers, Export to CSV, custom items. **Status bar**: row / filtered / selected counts and Count / Sum / Average / Min / Max of the range.
- `DataTable` gains the same capabilities as opt-in props (`interaction`, `enableColumnMenu`, `enableColumnReorder`, `enableContextMenu`, `showStatusBar`, `autoSizeStrategy`, `columnOrder`, `cellSelection`); a table that opts into none renders exactly as before. Row checkboxes select a run with Shift+click.
- New `tableToCsv(table)` exports what a table shows (filtered, sorted, visible columns, labels; raw numbers by default).
