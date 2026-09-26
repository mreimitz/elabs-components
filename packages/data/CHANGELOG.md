# @elabs-ai/components-data

## 5.6.0

### Minor Changes

- 3ad62fe: New `DataGrid` — the spreadsheet-grade preset of `DataTable` (`interaction="grid"`):
  - **WAI-ARIA grid:** one tab stop; arrow keys across header and body cells (mirrored under RTL), Home / End, Ctrl/⌘+Home / End, Page Up / Down (virtualized rows scroll into view), ↑ from the first row to the header, Enter / Space on a header sorts, Enter on a cell activates the row, Space toggles row selection.
  - **Cell ranges:** drag, Shift+click / Shift+arrows to extend, Ctrl/⌘+click to add (or carve out of) a range, Ctrl/⌘+A, Escape; Ctrl/⌘+C copies what the cells display as tab-separated text. Ranges are a controllable `cellSelection` slice keyed by row / column id.
  - **Columns:** a column menu (sort, pin, move, auto-size, fit, hide, reset, custom items; Alt+↓ opens it), drag-to-reorder and Shift+←/→ (`columnOrder` slice), Alt+←/→ resize, double-click-free auto-size to content, and `autoSizeStrategy="fit"`.
  - **Context menu** on cells: Copy, Copy with headers, Export to CSV, custom items. **Status bar**: row / filtered / selected counts and Count / Sum / Average / Min / Max of the range.
  - `DataTable` gains the same capabilities as opt-in props (`interaction`, `enableColumnMenu`, `enableColumnReorder`, `enableContextMenu`, `showStatusBar`, `autoSizeStrategy`, `columnOrder`, `cellSelection`); a table that opts into none renders exactly as before. Row checkboxes select a run with Shift+click.
  - New `tableToCsv(table)` exports what a table shows (filtered, sorted, visible columns, labels; raw numbers by default).

- 9a200ab: DataGrid / DataTable filtering: `enableFilterUI` adds a filter button to every filterable header (text / number / date conditions with AND / OR and relative date ranges, a value checklist with counts and search, yes / no), `floatingFilters` adds a type-to-filter row (`>100`, `10..20`), `showFilterChips` lists active filters as removable chips, and `enableFind` gives grids Ctrl/⌘+F find across every row with Custom-Highlight-API highlights. Filters are plain JSON models in `columnFilters`; legacy filter values keep TanStack's semantics. `meta.filter` picks or disables a column's filter kind. `DataGrid` turns all of it on except the floating row. New locale keys under `data.table.filter*` / `data.table.find*`. Date conditions use the browser's native date field, so the filter panel adds no calendar library to the bundle.
- 6e54152: DataGrid editing: with `onCellEdit`, columns marked `meta.editable` edit in place (Enter / F2 / typing / double-click; text, number, date, select and checkbox editors, inferred or set with `meta.editor` / `meta.options`), validate with `meta.validate`, accept pasted TSV blocks from spreadsheets (fill / tile rules), clear with Delete, cut with Ctrl/⌘+X, fill down with Ctrl/⌘+D and undo / redo with Ctrl/⌘+Z / Ctrl/⌘+Y. Every action arrives as one batch of changes; `applyCellChanges` applies it to key columns. The package now also exports `DataTableCellSelection`, `DataTableCellChange`, the column / context menu item types and the filter-model helpers. Copy now keys off the focused cell rather than the event target.
- fd51c5a: DataTable / DataGrid analytics: row grouping (`grouping` / `expanded` view slices, `enableGrouping` for "Group by" in the column menu and a removable grouping bar with expand / collapse all), aggregates per column via `meta.aggregate` on group rows and in a `showTotals` totals row over every filtered row, tree data via `getSubRows`, master / detail via `renderDetail`, a pure `pivotData` helper producing rows and grouped `ColumnDef`s with row and column totals, and "Chart selection" in the grid context menu that hands the selected block to `onChartRange`. New locale keys for expanders, totals and grouping.
- edb95d8: DataTable / DataGrid at scale: `flashChanges` flashes cells whose value changed when `data` updates (green up, red down, amber otherwise; only changed row objects are compared), `onLoadMore` / `hasMore` / `loadingMore` load rows as the end scrolls into view with skeleton rows while loading, and `enableColumnVirtualization` renders only the unpinned columns in view (200 × 5,000 grids mount in ~0.5 s; keyboard navigation and find scroll hidden columns in). Fixes a grid-mode bug where the active cell of a pinned column stopped being sticky.
- dbcc5a8: Agent-native data grids and export: `AutoGrid` renders a DataGrid (or table) from one serialisable `DataGridSpec` (rows, optional column specs inferred with `inferColumnSpecs`, a saved view, grouping, totals) and joins the A2UI catalog as its `@elabs-ai/components-data` half (`DATA_A2UI_BINDINGS`, `DATA_A2UI_CATALOG_SCHEMA`; the published surface schema now includes it). Saved views become versioned `GridState` documents (`serializeGridState`, `parseGridState` with migration and validation, `GRID_STATE_JSON_SCHEMA`). Real `.xlsx` export with no dependency (`toXlsx`, `tableToXlsx`; "Export to Excel" in the grid context menu, loaded on demand).
- 13161b8: `DataTable` now runs on TanStack Table v9 — ~2.8× less JS heap at 100k rows (325 → 115 MB), about 2× faster mount, and ~9× fewer long scroll frames on a throttled CPU (measured with the browser benchmark in `fixtures/grid-bench`).
  - **Public types keep their v8 shape.** `ColumnDef<TData, TValue>`, `Row`, `Table`, `CellContext`, `{ left, right }` column pinning and `Record<string, boolean>` row selection are unchanged; a v8 `sortingFn` is still honoured (v9 calls it `sortFn`). Import them from `@elabs-ai/components-data`, not from `@tanstack/react-table`.
  - **Breaking for code that calls TanStack directly on the `toolbar` table:** v9 pins to logical edges — `column.pin("start" | "end")`, not `"left" | "right"`.
  - **Fix:** `enablePagination` together with `enableRowVirtualization` rendered only page 1 with no pager; virtualization now wins and every row stays reachable.
  - **Fix:** sort-button names, the pager and the default empty message went out in English regardless of locale; they now use the locale seam (`data.table.sortBy`, `data.table.pageStatus`, `previous`, `next`, `noResults`).
  - **New:** `meta.label` names a column whose `header` is a render function (sort buttons, `ColumnPicker`); multi-sort shows and announces each column's sort priority; `rowHeight` gives a virtualized table a fixed row height and skips measurement.
  - **Accessibility:** `ColumnPicker` and `FacetFilter` items are checkbox items, so their on/off state reaches assistive tech; `ColumnPicker` lists leaf columns by their header label, never by id.

### Patch Changes

- 4e98497: DataGrid: fit-to-width and auto-size no longer count a table nested in a master / detail row, so an expanded detail table can't crush the parent grid's columns.
- Updated dependencies [8cdcd91]
- Updated dependencies [26cef85]
- Updated dependencies [67db2cd]
- Updated dependencies [8f34fc8]
- Updated dependencies [3ad62fe]
- Updated dependencies [9a200ab]
- Updated dependencies [6e54152]
- Updated dependencies [fd51c5a]
- Updated dependencies [dbcc5a8]
- Updated dependencies [13161b8]
- Updated dependencies [382acd3]
- Updated dependencies [fb6a14e]
- Updated dependencies [59c241f]
- Updated dependencies [7737be6]
- Updated dependencies [6f74a30]
- Updated dependencies [fcb884f]
- Updated dependencies [3dcc396]
- Updated dependencies [12955fb]
- Updated dependencies [5c8f488]
- Updated dependencies [e667eb2]
  - @elabs-ai/components-tokens@5.6.0
  - @elabs-ai/components-ui@5.6.0
  - @elabs-ai/components-icons@5.6.0

## 5.5.0

### Patch Changes

- 597f05b: `DataTable`'s client `getFilteredRowModel`/`getSortedRowModel` used to attach unconditionally on every mount — even for a purely virtualized table that never filters or sorts — which did a redundant per-row pass over the whole dataset. They now attach lazily, only once filtering/sorting is actually used (or `stickyRows` needs the filtered model to exclude pinned rows), removing that unconditional per-row work for a table that never sorts/filters. This is a correctness/efficiency cleanup, not a measured mount-time speed-up — real-browser timing at 50,000 rows showed no improvement (see #602).
- Updated dependencies [d0a075d]
- Updated dependencies [d0a075d]
- Updated dependencies [144375d]
  - @elabs-ai/components-ui@5.5.0
  - @elabs-ai/components-icons@5.5.0
  - @elabs-ai/components-tokens@5.5.0

## 5.4.0

### Patch Changes

- Updated dependencies [be8ddcf]
  - @elabs-ai/components-ui@5.4.0
  - @elabs-ai/components-icons@5.4.0
  - @elabs-ai/components-tokens@5.4.0

## 5.3.1

### Patch Changes

- @elabs-ai/components-icons@5.3.1
  - @elabs-ai/components-tokens@5.3.1
  - @elabs-ai/components-ui@5.3.1

## 5.3.0

### Patch Changes

- @elabs-ai/components-icons@5.3.0
  - @elabs-ai/components-tokens@5.3.0
  - @elabs-ai/components-ui@5.3.0

## 5.2.0

### Patch Changes

- Updated dependencies [04be140]
- Updated dependencies [71aa69e]
- Updated dependencies [3ac9678]
  - @elabs-ai/components-ui@5.2.0
  - @elabs-ai/components-icons@5.2.0
  - @elabs-ai/components-tokens@5.2.0

## 5.1.0

### Patch Changes

- a9613ea: First-user journey, wave 1 (from the 2026-09-21 new-user test).
  - **ui** — `cn()` keeps the chart type roles (`text-chart-source`, `text-chart-value`) beside a text colour; a `ChartCard`/`ChartFrame` source row renders at its footer size again. `SidebarInset` carries `min-w-0`, so a wide table or chart scrolls inside its card instead of pushing the page wider than the viewport.
  - **charts** — `ChartCard` and `ChartFrame` carry `min-w-0` as grid items (same overflow at phone width).
  - **cli** — `docs <Name>` resolves a re-exported name to its owner package (`MetricCard` → ui, `Text` → ui), accepts `<pkg>/<Name>`, prints "also exported from", and in a consumer project points at the installed `.d.ts` instead of a monorepo path. The props extractor follows barrel re-exports, merges declaration-merged interfaces and reads `forwardRef<El, Props>` generics — 200 more components record an API (HeatmapChart, ChartAnnotations, ChartTooltip, ToggleGroup, Toaster, Text, Heading …), and `LineChart` lists `annotations`. `create --title` names the sidebar brand slot; the generated CLAUDE.md points at the downloadable theme families instead of "two shipped themes". `map` classifies per (name, source library): a same-name export from another domain is a `gap` with a "name coincidence" note, shell/layout/chart-library elements have curated aliases, and the migration plan decides the theme in phase 1 and names the shell parts in phase 4.
  - **all packages** — internal peer dependencies are published as `^<version>` instead of an exact pin.

- Updated dependencies [2be575f]
- Updated dependencies [a9613ea]
- Updated dependencies [2be575f]
- Updated dependencies [b45250c]
  - @elabs-ai/components-ui@5.1.0
  - @elabs-ai/components-tokens@5.1.0
  - @elabs-ai/components-icons@5.1.0

## 5.0.0

### Minor Changes

- 779c040: Theme seams for brand fidelity. Every addition is opt-in: each new token defaults to today's rendering, so existing themes look the same.

  `@elabs-ai/components-tokens` adds 30 contract tokens, which every `[data-theme]` block now has to define:
  - Sidebar active bar: `--sidebar-indicator`, `--sidebar-indicator-width` (`0` = no bar), `--sidebar-indicator-radius`, `--sidebar-indicator-inset`.
  - App shell: `--shell-secondary-width`.
  - Buttons: `--button-outline-border`, `--secondary-border`, `--secondary-text`.
  - Table header: `--table-header-background`, `--table-header-foreground`, `--table-header-size`, `--table-header-transform`, `--table-header-tracking`.
  - Surfaces: `--card-shadow`, `--card-border`, `--card-title-leading`, `--popover-shadow`, `--dialog-shadow`.
  - Badges: `--badge-radius`, `--badge-appearance` (`auto` | `tint` | `solid` | `outline` | `neutral`).
  - Tabs: `--tabs-variant` (`segmented` | `underline`), `--tabs-indicator-width`, `--tabs-active-weight`.
  - Focus: `--focus-ring-width`, `--focus-ring-offset` (a negative value pulls the ring inside the edge), `--input-focus-border`.
  - Icons: `--icon-fill` (`outline` | `solid`).
  - Selection: `--selection`, `--selection-foreground`, `--selection-muted`.

  It also adds a `heading-xs` type role (`text-heading-xs`, caption size at 600), the utilities these tokens drive (`bg-sidebar-indicator`, `bg-table-header-background`, `text-table-header`, `shadow-card`, `shadow-popover`, `shadow-dialog`, `rounded-badge`, `font-tabs-active`, `border-input-focus`, `bg-selection`, …), and the `badge-*` and `tabs-underline` custom variants. Keyword tokens are read with container style queries. A browser without style queries renders the default.

  `@elabs-ai/components-ui`:
  - `AppShell` gains `brandPlacement` (`"sidebar"` | `"topbar"`), `topBar={{ start, center, end }}`, `navigation` (`"sidebar"` | `"topbar"`) and `secondaryPanel`. `TopNav` gains `center`, which keeps its slot truly centred.
  - `Badge` and `StatusBadge` gain `appearance` (`"tint"` | `"solid"` | `"outline"` | `"neutral"`); the prop is named `appearance`, not `tone`, because `StatusBadge` already has a `tone`. Leave it unset and `--badge-appearance` decides. A custom-tone `StatusBadge` never goes solid.
  - `TabsList` without a `variant` follows `--tabs-variant`, and it no longer renders `data-variant="segmented"` when the prop is unset.
  - Sidebar, buttons, cards, menus, dialogs, form fields, tables and trees now read the tokens above.
  - `cn()` now recognises the `eyebrow`, `kpi-sm`, `display-lg` and `heading-xs` type roles, the new token utilities, and the `leading-(--x)` / `tracking-(--x)` shorthand. Before this, `cn("text-eyebrow", "text-muted-foreground")` silently dropped the role.

  `@elabs-ai/components-icons`: `Icon` gains `variant` (`"outline"` | `"solid"`), and `createIcon(node, name, { solid })` takes an optional filled glyph. Leave `variant` unset and `--icon-fill` picks the glyph. An icon without a solid glyph always draws its outline.

  `@elabs-ai/components-data`: `DataTable` headers read the `--table-header-*` tokens, and selected rows read `--selection`.

  `@elabs-ai/components-ai`, `-charts`, `-editor`, `-marketing`: hand-rolled uppercase labels now use the `eyebrow` role. Their letter spacing moves to the role's `0.06em`.

- c2d1a19: `DataTable` gains a presentation layer, all opt-in per column through `meta` or per table through new props:
  - **In-cell visuals** (`meta.visual`): `bar` (with `track`, `range: "column" | "table" | [min, max]`, a `slim` style, a category `colorBy`, negatives drawn left of zero in the negative token), `sparkline` and `columns` (a row's series from `keys`; `range: "column"` shares one y scale down the column). A column reserves ONE box for its printed values, so every track in it is the same length: bar lengths compare down the column, a diverging column's zero rule keeps one x, and printed sparkline end labels leave every row the same drawing width, and `heatmap` (a ramp colour from the shared `colorScaleFor` scale; columns with the same `scale` spec share one scale; `hideValue`; a `legend` key). Every visual keeps its value readable to screen readers, and sorting always uses the raw value.
  - **`meta.format`** (the charts `valueFormat` object shape), **`meta.colorBy`** (tint a cell or row by a category), **`meta.markdown`** (a safe inline subset, never HTML), **`meta.width` / `minWidth` / `style`**, and **`meta.showAt`** (`{ base: true, narrow: false }` hides a column when the table is under 450 px wide).
  - **Table props:** `layout` (`"table"` default, `"cards"`, or `"auto"` = cards under 450 px), `stickyRows` (rows kept at the top or bottom of every page, outside sorting, paging and search), `showRanks`, `density="compact"`, `mergeEmptyHeaders`, `searchMode="exact"` and `hideHeader`.
  - New exports: the cell components (`BarCell`, `SparklineCell`, `ColumnsCell`, `HeatmapCell`, `HeatmapLegend`, `MarkdownCell`), the card parts (`DataTableCardList`, `DataTableCard`), the rank parts, `useTableBreakpoint` and the pure scale helpers.

  `DataTableColumnMeta` now lives in its own module and is still exported from the package under the same name; it only gained optional fields.

  Deprecated: nothing.

  Migration: none needed. With no new prop or `meta` field set, the table renders exactly as before. The breakpoint is measured on the table's own box (not the viewport), so a table in a narrow sidebar switches at 450 px of its own width.

- 7c3815d: Closure fixes for the chart, table and map parity track.

  **`DataTable` — pinned rows are placed for screen readers.** A virtualised table with
  `stickyRows` mounted its pinned rows outside the virtual window with no `aria-rowindex`,
  and built `aria-rowcount` from the centre row model only. Before: a screen reader heard
  unplaced extra rows and an under-reported total ("row — of 98" beside 100 real rows).
  After: a top-pinned row takes the first index slots, a bottom-pinned row the last, and both
  join the count. No opt-out and none needed — the DOM, the visual order and the spoken order
  now agree. A table without `stickyRows`, or without virtualisation, is unchanged.

  **`DataTable` — row reorder in the card layout says so.** `enableRowReorder` has always been
  table-only: a card list has no grip column and no row to drop onto, so `onRowReorder` never
  fires there. Before: silence. After: one development warning per mount naming the limit, and
  the prop's documentation says it. Production is unchanged. To reorder, keep `layout="table"`,
  or offer the move as a row action in cards.

  **`MapControls` — a static map shows no zoom chrome.** Before: `showZoom` defaulted to `true`
  everywhere, so an editorial map with `interactive={false}` painted zoom buttons that invite a
  gesture the map will not answer. After: `showZoom` defaults to the map's own interactivity —
  zoom on an interactive map, nothing on a static one — and a control cluster with no enabled
  group renders no box at all. Pass `showZoom` explicitly to get either behaviour back; an
  interactive map is unchanged, and no shipped story rendered both.

  **`ChartLegend` — the root is named.** Its root now carries `data-slot="chart-legend"`, so the
  frame's image export roles a bare legend's labels as legend text rather than plain chart
  labels. Classes, layout and accessible name are unchanged.

  **Registry blocks — two infographics now compose the new chart props.** Both are copy-own
  items, so an existing copy is untouched until you re-run `npx shadcn add`.

  `infographic-annotated-trend-01`: before, a `Card` with a hand-drawn `Leader` + `HaloText`
  per event and a fixed 288 px plot. After, a `ChartFrame` (the finding as the title, the
  method note, a byline and the source row, plus flip-to-table and CSV of the same weeks)
  around a `LineChart` whose events are declarative `annotations` — so under 480 px the notes
  become numbered markers with a key under the plot, and every note is restated in the
  figure's description. The value axis is now framed around the series instead of including
  zero, which is what makes the outage week read as a drop rather than a ripple; pass your own
  `domain` to change it.

  `infographic-small-multiples-01`: before, a bespoke grid of inline-SVG mini charts. After, a
  `ChartMultiples` grid — same shared y-axis and same ringed outlier, plus the value in every
  panel title, swapped for the hovered week's reading so one hover reads the same week across
  all twelve panels. Two columns on a phone, packed to the container above that.

  Also: the bundled choropleth world fixture now credits Natural Earth (public domain) and
  `world-atlas` (ISC) in the attribution panel.

- 3a3b59a: Created apps download less and install cleanly. `ui`, `icons`, `ai`, `data`, `flow`, `maps`, `charts`, `marketing`, `viewer` and `terminal` now build one output file per source module (entry points, `exports` and type declarations are unchanged), so an app's bundler keeps only the components it imports: the `dashboard` template's first JavaScript download drops from 609 KB to 147 KB gzip. `@elabs-ai/components-charts` moves `@visx/brush` to 4.0.1-alpha.0 like the rest of visx, which ends the `ERESOLVE` peer warnings npm printed for React 19 apps. `brand-ui create` writes the app's CI workflow for the package manager that ran it: `npm ci` for an app created with `npx`, otherwise `pnpm/action-setup` pinned to the pnpm major that created it (the old workflow failed for npm apps, and for pnpm apps without a `packageManager` field). The app's CLAUDE.md lists that package manager's commands and says to commit the lockfile, and `create --install` under pnpm now installs with pnpm (it picked npm).

### Patch Changes

- Updated dependencies [3951d51]
- Updated dependencies [5646c7f]
- Updated dependencies [779c040]
- Updated dependencies [f0155e5]
- Updated dependencies [015b988]
- Updated dependencies [431e9a2]
- Updated dependencies [fc40636]
- Updated dependencies [817dd16]
- Updated dependencies [e52e84c]
- Updated dependencies [dbee30e]
- Updated dependencies [f024c7a]
- Updated dependencies [4386ae3]
- Updated dependencies [8a807dc]
- Updated dependencies [a2aff19]
- Updated dependencies [87e58d7]
- Updated dependencies [3a3b59a]
- Updated dependencies [a514030]
- Updated dependencies [4e07999]
- Updated dependencies [94f1e0e]
- Updated dependencies [18f063e]
- Updated dependencies [6271b00]
  - @elabs-ai/components-ui@5.0.0
  - @elabs-ai/components-tokens@5.0.0
  - @elabs-ai/components-icons@5.0.0

## 4.2.0

### Minor Changes

- a3a69f7: Security, streaming-performance, form-control and consistency fixes from the 2026-09-15 review.

  **Security:** `SchemaDisplayPath` no longer injects model or tool paths as HTML. `JSXPreview` blocks `script`, `style`, `iframe`, `form`, `object`, `embed`, `link`, `meta`, `base` and unknown elements. `WebPreviewBody` leaves `allow-same-origin` out of the iframe sandbox unless you set `allowSameOrigin`.

  **Check your app when upgrading:**
  - **Monaco export moved.** Import `monaco` from `@elabs-ai/components-editor/monaco` instead of the root import. Monaco now loads only when an editor mounts.
  - **`NumberInput` changed.** It renders a locale-aware text spinbutton, and its `ref` (and `BoundedNumber`'s) now points at the `<input>` instead of the wrapper.
  - **Pickers fill their column.** `Combobox`, `DatePicker`, `DateRangePicker`, `VirtualSelect` and `TreeSelect` triggers default to full width. Pass a width class to narrow one.
  - **Some styles changed.**
    - Disabled `Button` and `Input` fade to 50% opacity.
    - Dropdown and context menus are at least `12rem` wide.
    - Sheet, AlertDialog and Drawer titles match `DialogTitle`.

  **Added:**
  - `FileUpload`:
    - `onFilesRejected` reports files rejected by `accept`, size, count or `multiple`. These rules now also apply to dropped files.
    - A `describeFileRejection` helper.
  - `Conversation`: `isStreaming`.
  - `MessageTable`, `MessageForm` and `MessageFormProvider`: `isStreaming`. The old `streaming` prop still works but is deprecated.
  - `ResizableHandle`: `hitAreaMargins`.
  - The `--scrim` theme token (`bg-scrim`), used for the Gantt progress fill. `THEME_TOKEN_NAMES` now has 209 names, so add `--scrim` to any custom theme that is checked against it.
  - About 250 locale keys replace hard-coded English across ui, data, ai, charts, maps, flow, terminal and editor.

  **Fixed, ai:**
  - `CodeBlock` no longer shows stale code or grows its cache without limit.
  - `DiffView` tokenizes the old and new sides separately.
  - `PromptInput` restores your text when a submit fails and ignores double submits.
  - `SpeechInput` releases the microphone on unmount.
  - `Tool` survives output it can't serialize.
  - `AssetPreview` parses quoted CSV fields.
  - The math and CJK plugins load lazily.

  **Fixed, ui:**
  - `Tree` no longer jumps while you scroll.
  - `Combobox` and the date pickers handle controlled and uncontrolled values correctly.
  - `FileUpload` custom drop zones work from the keyboard.
  - `SchemaForm` re-renders only the field you edit.
  - Sheet and AlertDialog scroll tall content.
  - `useIsMobile` returns the right value on first render.
  - `Carousel` no longer leaks a listener and no longer blocks arrow keys inside inputs.

  **Fixed, other packages:**
  - data: `SearchInput` forwards refs.
  - charts: charts skip recalculating when their data hasn't changed, and `LiveLineChart` pauses while off-screen.
  - maps: `MapMarker` is safe to render on the server.
  - editor: `CodeEditor` follows `path` and `options` changes and keeps undo history. `MermaidDiagram` renders one diagram at a time.

### Patch Changes

- Updated dependencies [a3a69f7]
  - @elabs-ai/components-ui@4.2.0
  - @elabs-ai/components-tokens@4.2.0
  - @elabs-ai/components-icons@4.2.0
