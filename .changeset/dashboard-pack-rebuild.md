---
"@elabs-ai/components-charts": minor
"@elabs-ai/components-ui": patch
---

Dashboard pack rebuild — the sheet editor now behaves like a BI authoring surface.

- Engine: `fit` placement pushes neighbours to the nearest free cells (biased away from the drag), swaps a same-size neighbour, and grows an `extendable` sheet without shrinking its cells; new `TileLayout.static` locks a tile (never moved, never pushed, an obstacle for compaction).
- Edit layer: the dragged tile follows the pointer 1:1 and a resize edge follows the cursor while a dashed ghost shows the snapped cell; dotted cell grid (`ui.showGrid`); corner/edge grips centred on the tile edge; size badge only during a gesture; lock badge; handles on single selections only; align toolbar flips inside the selection when there is no room above.
- Chrome: rebuilt `DashboardToolbar` (segmented View/Edit, undo/redo, Add, Grid with Show-grid switch and live density summary, Layout menu with Tidy up / Select all / selection actions / layout target, save state, Assets and Properties toggles, Export, shortcuts; new `features.layout|panels|export`), edit-mode tile hover chrome (Duplicate · Delete · ⋮ → full context menu with icons, shortcut hints, Properties, Lock), `DashboardSelectionBar` empty state and right-aligned actions, `DashboardAssetPanel` rows with icon + description and a full-height list, `DashboardPropertiesPanel` Layout section (column/row/width/height, lock), empty-sheet state.
- Tiles: `DashboardTileKind.description`, `capabilities.padding`, `capabilities.surface: "plain"` (heading, divider); built-ins ship icons and descriptions; metric tiles show the number on two-row tiles; untitled tiles get a muted placeholder title in edit mode.
- `ChartFrame chrome="tile"` floats the menu over the top-end corner when a frame has no header content instead of spending a header row on it.
- `ui/Toolbar`: `ToolbarSeparator` was rendered as a horizontal dash inside horizontal toolbars (Radix flips the separator's orientation); fixed.
