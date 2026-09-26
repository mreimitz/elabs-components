# @elabs-ai/components-ui

## 5.6.0

### Minor Changes

- 26cef85: Charts now print every number and date in the locale of the surrounding `LocaleProvider`, and the words they show or announce come from the same message catalogue as the rest of the app. Before, some labels, axis ticks and tooltips used the browser's own locale and fixed English text. Without a `LocaleProvider`, or under an English one, most charts print what they printed before; the last two items below list the outputs that change.
  - The ui message catalogue gains `charts.*` keys for chart words that used to be fixed English: empty-state text, tooltip row labels (Value, Share, Path, Members, IQR, Range, Records, Density, Period, Rank, Start, End, Before, After), the network and heatmap summaries, the heatmap colour key, the Sankey node value, the Bump chart's "rank" in datapoint names (`charts.bump.datapointRank`), the Gantt link announcements, and the chart frame's summary and footer words. `NetworkChart` and `ParallelCoordinatesChart` now read their empty-state text from the existing `charts.chart.emptyTitle` and `charts.chart.emptyMessage` keys. Pass German (or any) text for these keys to `LocaleProvider` `messages` to translate them.
  - `TreeChart`, `TreemapChart`, `NetworkChart`, `HeatmapChart`, `ChoroplethChart`, `SankeyChart`, `DistributionChart`, `BumpChart`, `WaterfallChart`, `DumbbellChart` and `Gantt` gain `messages`: replacement words for that one chart, keyed by the same `charts.*` keys. A word set here wins over the `LocaleProvider` for that chart only, including the shared parts it renders (datapoint-layer name, legend label, loading and fallback text, tree toggles, Gantt timeline and task list); a chart next to it is not affected. The loading text of `TreemapChart`, `TreeChart`, `SankeyChart`, `NetworkChart`, `ParallelCoordinatesChart` and `HeatmapChart` reads `charts.chart.loading` ("Loading chart…"), so both a chart's `messages` and the `LocaleProvider` reach it; `HeatmapChart` announced a fixed "Loading" before. `ChartLoadingLabel` rendered on its own still defaults to "Loading".
  - `PieChart`, `FunnelChart`, `BulletChart` and `RadarChart` gain `locale`, which formats that chart's numbers in the given locale instead of the provider's. `RadarChart` also gains `maxFractionDigits`. On `PieChart` and `RadarChart`, both settings now also reach the legend's value column; `ChartLegend` gains `locale` and `maxFractionDigits` for the same purpose. `PieChart`'s `locale` also reaches its centre value, through a new `locale` prop on `ChartStatFlow`.
  - Some English outputs change on purpose, so that one chart never mixes "1K" with "800" or "1" with "0.20". Every number on one axis, key or tooltip now shares one style:
    - `WaterfallChart` bar labels, datapoint names and the tooltip's Value, Before and After rows print "1,000" beside smaller values instead of "1K".
    - The `DistributionChart` value axis prints "1,000" instead of "1K" beside smaller ticks.
    - The `DumbbellChart` value axis prints "500 1,000 …" instead of "500 1K …".
    - `DensityScatterChart` axis ticks print "0.00 0.20 … 1.00 1.20" instead of "0 0.20 … 1 1.2".
    - The `HeatmapChart` colour key in `legendLabels="ranges"` mode prints "900–1,200" instead of "900–1.2K", and its screen-reader sentence follows. The default `"endpoints"` key is unchanged.
    - The parallel-coordinates extremes follow the same rule.
  - A chart with no `LocaleProvider` above it, in a browser set to a language other than English, now prints English (US) dates and times where it used to print the browser's own: Date category names in datapoint names (for example "Mar 9"), the weekday date in a time-axis tooltip title, and `LiveXAxis` time labels. Wrap the app in a `LocaleProvider` with the user's locale to keep local formats.

- 67db2cd: Charts support pinch-to-zoom by default. You can spread two fingers on a touch screen, pinch a trackpad, or hold Ctrl/⌘ and scroll the wheel. This zooms the x axis of `LineChart`, `AreaChart`, `ComposedChart` and `CandlestickChart` (time x or band x), vertical `BarChart` and matrix `HeatmapChart`. A two-finger drag pans. With the chart focused, `+` / `−` / `0` zoom and reset. Zoom-in, zoom-out and reset buttons appear while zoomed. Zoom moves the same window as the navigator strip and reports through `onWindowChange` (`null` when zoomed back out). `zoom={false}` turns it off. Zoom stays off while you drive `xDomain` yourself.

  Charts no longer block the page's own touch gestures. A vertical swipe over any chart now scrolls the page, and one finger still scrubs the tooltip horizontally. Plots with selection gestures, density-scatter and choropleth keep `touch-action: none`.

  `@elabs-ai/components-ui` adds the `charts.zoom.*` locale messages.

- fb6a14e: The Pages templates now stand on real components instead of hand-rolled markup.
  - **`SiteShell`** (new, `Layout/SiteShell`): the website counterpart to `AppShell` — skip link, `SiteShellHeader` (sticky by default; `asChild` for a navbar that renders its own `<header>`), `SiteShellMain` (the skip target) and `SiteShellFooter`. The `site-frame` block is built on it, so every page template gets a pinned header.
  - **`TableOfContents`** + **`useScrollSpy`** (new, `Navigation/TableOfContents`): the “On this page” list. Follows the reader’s scroll position (last heading past the reading line; last entry once the document is scrolled to its end), one accent marker that slides between entries, smooth-scroll on click with the hash updated and focus handed to the section; `activeId` for a controlled list, `title={null}` to drop the eyebrow, `offset` to match your sticky chrome. Localized via `ui.tableOfContents.title`.
  - **`Timeline`** grows a `variant="plain"` (a chronology with no status vocabulary; `current` marks the step you are on, `aria-current="step"`), an `orientation` (`vertical` | `horizontal` | `responsive` — horizontal once the container passes `@3xl`), a `label` slot (a date, a version) that becomes a left column from `@2xl` (`--timeline-label-width`), and per-item `nodeSize` / `node` for a custom marker. The root and items now carry `data-slot="timeline"` / `timeline-item`. The `about-story-01` milestones and the `changelog-01` release rail are built on it.
  - **`Tabs`** grows a `variant="rail"` for `TabsList` / `TabsTrigger`: a vertical list of full-width triggers with an accent rail on the active one, for feature tabs and settings-style side navigation (`orientation="vertical"` on the root). Used by `marketing-features-03`.
  - **`Avatar`**: new `AvatarGroup` (overlapping stack with an overflow count), `AvatarFallback` takes a `name` and derives the initials, and `initialsOf()` is exported so consumers stop writing their own.
  - **`Carousel`**: new `CarouselDots` (localized via `ui.carousel.dots` / `ui.carousel.goToSlide`) and `useCarouselPosition()` for a custom position indicator.
  - **`TagInput`**: `normalize`, `addOnBlur`, `renderTag`, `tagVariant`, `inputMode` and `aria-describedby` pass-through, so an email list can validate and tint each address.
  - `NavUser` uses `AvatarFallback name` instead of its own initials rule.
  - **`@elabs-ai/components-marketing`**: `LogoStrip` grows `layout="marquee"` (`marqueeSeconds`, pauses on hover/focus and under reduced motion, play/pause control with `labels`) and `muted` for greyscale logos; `lucide-react` is now a dependency of the package.
  - `@elabs-ai/components-editor`: the markdown-outline TOC is now `MarkdownTableOfContents`; `TableOfContents` stays as a deprecated alias so nothing breaks.

- 6f74a30: `TreeChart` branches now open and close. The tree still starts fully expanded, so a chart you already render looks the same on first paint. Click a branch to close or open it; with an `onDatapointClick` handler, a click on the node drills in as before and the dot does the toggling. From the keyboard, Tab into the tree (the tree itself adds one Tab stop, even without a handler) and use the arrow keys, Space and Enter as in any tree view. A closed branch shows its direct-child count as `Platform (3)` and gets a ring around its dot, so it does not rely on colour alone. Every change animates: nodes grow out of their parent and fold back into it, and opening a branch scrolls its new children into view. Orientation, data and size changes animate the same way, and reduced motion snaps straight to the new layout.

  To keep the old static chart, pass `collapsible={false}`. It draws exactly as before, including the `+k` pill from `collapseDepth`, and its click payload keeps `index` as the node's depth. One correction reaches it: with `collapseDepth`, member counts in accessible names, tooltips and the click payload's `descendantLeafCount` now count the real leaves under a node; before, each `+k` pill counted as a single leaf. `renderNode` needs the collapsible chart: with `collapsible={false}` it is ignored (with a warning in development) and the default dots are drawn.

  `collapseDepth` is deprecated. On a collapsible chart it now means the same as `defaultExpandedDepth`: branches at that depth start closed and show `(n)`, instead of being replaced by a `+k` pill.

  New props:
  - `renderNode` draws each node as your own content, such as a small card, inside a fixed `nodeWidth` × `nodeHeight` box (default 160 × 72). Links attach to the box edges and the chart adds its own open/close pill. The content is presentational: keep it free of focusable elements and restate what it shows through `datapointLabel`.
  - `expandedIds` with `onExpandedChange` control which branches are open. `defaultExpandedIds` or `defaultExpandedDepth` set the starting state instead.
  - `align="center"` centres the tree in a larger container. A tree bigger than its container scrolls, never clips, and opens centred on its root; "Expand all" and orientation switches stay centred on it.
  - `TreeNode` accepts an optional `id` (a stable identity for expand state and animation) and a `data` payload that is handed back to `renderNode` and, on the collapsible chart, to `datapointLabel` and `onDatapointClick`.

  The default accessible name of a branch now states its direct children, plus its leaf count when that is different: `Engineering, 2 children, 5 members` instead of `Engineering, 5 members`. Open or closed is announced through `aria-expanded`, not the name. `collapsible={false}` keeps the old wording.

  `ChartDatapointProvider` takes a new `disabled` prop: it provides nothing, exactly as if it were absent, so a chart can keep one element tree whether or not a handler is set. `TreeChart` uses it, so adding `onDatapointClick` later no longer resets the open branches.

  `@elabs-ai/components-ui` adds the `charts.treeChart.expand` and `charts.treeChart.collapse` locale messages. They name the pointer toggle, which appears when the chart also has an `onDatapointClick` handler.

- fcb884f: Two neutral seams, and the KPI Tree block rebuilt on them.
  - `TreeChart` gains `renderLink`: draw something at the midpoint of every link — the operator a child enters its parent with (`+`, `−`, `×`), a weight, a share. It receives the parent and child nodes (with their `data`), the child's index among its siblings, the depth and the orientation, and it rides along when branches open, close or the tree reorients (`TreeChartLinkRenderProps`; new `Charts/TreeChart/Link Decorations` story).
  - `TreeChart` gains a canvas viewport, the way `CanvasShell` has one in the flow package: `zoomable` (the wheel zooms around the pointer, dragging pans — from the empty canvas or from a node, with a click still opening the node — and the tree can be dragged around even when it fits, since the box leaves room around it; a trackpad pinch zooms, and zoom in / out / fit controls sit in the corner in the flow package's chrome; `zoomRange`, `defaultZoom`, `onZoomChange`) and `minimap` (every node as a box, the part in view as a window; click or drag it to move the view — the `--flow-minimap-*` tokens). Zoom is a `scale()` on the canvas inside the chart's own scroll box, so the scroll-edge fade, the flights, the pills and the keyboard tree keep working at every zoom. Both are off by default. New `Charts/TreeChart/Viewport` story; the controls are localised (`charts.treeChart.zoom*`, `fitView`, `minimap`).
  - `TreeChart` links are visible in dark themes now: they were a `--chart-grid` hairline (0.65px, drawn to disappear behind marks — ~2:1 on dark), and a tree's links are structure, not gridlines. They take the design system's edge token, `--flow-edge`, at 1px, so a tree and a flow canvas draw their connections the same way in every theme.
  - `MetricCard` gains `comparisons`: several named changes side by side as a row of chips under the tile body (month over month beside year over year, actual vs target vs last year). Each chip carries an arrow, the sign and a tone, and a bad-news chip also differs in shape (a dashed outline) so the row survives greyscale; `delta` stays the one headline change beside the value. Default: none; hidden at `size="sm"` (`MetricCardComparison`; new `Core/MetricCard/Comparisons` story).
  - The `infographic-kpi-tree-01` block no longer hand-rolls its cards or its change chips: every node is `MetricCard` with a `Sparkline` and the two `comparisons`, and every connecting line now carries the operator — Revenue **+** and Operating costs **−** (dashed) visibly make Operating profit, Customers **×** ARPU make Revenue — spoken in each tree item's name too ("subtracts from operating profit"). New story `Operators On The Lines` locks it. The block is also a canvas now (`zoomable` + `minimap`), story `Zoom And Minimap`.

- 3dcc396: A new entry point, `@elabs-ai/components-ui/definition`, describes a component's props as plain data. It has no React in it, so it works in a server component, a Node script or a build step.

  With it you can:
  - list a component's props with `field.*` (text, numbers with limits and units, choices, colours, per-breakpoint values, objects, lists), group shared props with `definePropGroup`, and declare the whole component with `defineComponent`. The compiler checks the list against the component's props type.
  - fill in defaults with `resolveProps`, keep renamed props working with `applyAliases`, and check untrusted input (an agent's JSON, a saved spec) with `validateProps`, which reports problems instead of throwing.
  - turn a definition into JSON Schema with `toJsonSchema`, or into a stable JSON snapshot with `toSnapshot`.
  - share the ready-made `header` (title, subtitle, description), `a11y` (accessible label and description) and `status` (tone) groups.

  Nothing existing changes. `STATUS_TONES` and `StatusTone` are still exported from the main entry.

### Patch Changes

- 8f34fc8: `CommandChip`'s root element now renders `role="group"`, so a consumer-supplied `aria-label`
  attaches validly instead of tripping axe's `aria-prohibited-attr` rule on the implicit
  `generic` role of a bare `<div>`. Its host-picker menu now opens with `modal={false}`, so it
  no longer `aria-hide`s the rest of the page (nav, hero CTAs, footer, …) while open, fixing a
  WCAG 4.1.2 mismatch and the related Storybook axe flake on `display-commandchip--switch-host`.
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
- dbcc5a8: Agent-native data grids and export: `AutoGrid` renders a DataGrid (or table) from one serialisable `DataGridSpec` (rows, optional column specs inferred with `inferColumnSpecs`, a saved view, grouping, totals) and joins the A2UI catalog as its `@elabs-ai/components-data` half (`DATA_A2UI_BINDINGS`, `DATA_A2UI_CATALOG_SCHEMA`; the published surface schema now includes it). Saved views become versioned `GridState` documents (`serializeGridState`, `parseGridState` with migration and validation, `GRID_STATE_JSON_SCHEMA`). Real `.xlsx` export with no dependency (`toXlsx`, `tableToXlsx`; "Export to Excel" in the grid context menu, loaded on demand).
- 13161b8: `DataTable` now runs on TanStack Table v9 — ~2.8× less JS heap at 100k rows (325 → 115 MB), about 2× faster mount, and ~9× fewer long scroll frames on a throttled CPU (measured with the browser benchmark in `fixtures/grid-bench`).
  - **Public types keep their v8 shape.** `ColumnDef<TData, TValue>`, `Row`, `Table`, `CellContext`, `{ left, right }` column pinning and `Record<string, boolean>` row selection are unchanged; a v8 `sortingFn` is still honoured (v9 calls it `sortFn`). Import them from `@elabs-ai/components-data`, not from `@tanstack/react-table`.
  - **Breaking for code that calls TanStack directly on the `toolbar` table:** v9 pins to logical edges — `column.pin("start" | "end")`, not `"left" | "right"`.
  - **Fix:** `enablePagination` together with `enableRowVirtualization` rendered only page 1 with no pager; virtualization now wins and every row stays reachable.
  - **Fix:** sort-button names, the pager and the default empty message went out in English regardless of locale; they now use the locale seam (`data.table.sortBy`, `data.table.pageStatus`, `previous`, `next`, `noResults`).
  - **New:** `meta.label` names a column whose `header` is a render function (sort buttons, `ColumnPicker`); multi-sort shows and announces each column's sort priority; `rowHeight` gives a virtualized table a fixed row height and skips measurement.
  - **Accessibility:** `ColumnPicker` and `FacetFilter` items are checkbox items, so their on/off state reaches assistive tech; `ColumnPicker` lists leaf columns by their header label, never by id.

- 382acd3: Links that leave the page now open in a new tab, with `rel="noopener noreferrer"`. `SurfaceTourActions` opens its "Open in Storybook" link in a new tab. `TrustStrip` facts and `IntegrationMatrix` link actions do the same when their `href` is an http(s) address, the rule `ProseLink` already follows. An on-site path such as `/docs` still opens in place.
- 59c241f: App shells no longer rubber-band. Scrolling past the top or bottom of `AppShell`'s `<main>`, a `PageShell` with `scroll="content"`, or a `SidebarContent` rail used to hand the leftover scroll to the page, and on macOS and iOS the elastic bounce then dragged the whole frame, top bar included. Each of these scroll areas now sets `overscroll-behavior: contain`, so the leftover scroll stays inside it. The copy-own shell blocks (`app-shell`, `sidebar-02`, `sidebar-04`, `sidebar-05`, `workspace-shell`) do the same for their own scroll areas. A scroll that starts outside every scroll area, such as over the top bar, can still reach the page. To stop that too, set `html { overscroll-behavior-y: none }` in a viewport-locked app.
- 7737be6: `TokenSpotlight`'s match outline is now drawn with the compound ring (`--ring-contour` outline plus `--ring` box-shadow) instead of a single `--ring` outline, so the mark clears contrast in every theme instead of measuring as low as ~1.35:1.

  Each chip's accessible name is now just its label (e.g. "Primary"), never led by the resolved colour value. The resolved value moved to the chip's own `aria-describedby`, and the repeated hint sentence is now given once, as the chip row's own description, instead of being duplicated inside every chip.

- 12955fb: `InstallTabs`' Prompt tab "Copy prompt" button now carries an always-mounted `role="status" aria-live="polite"` region next to its visible label, both driven from the same successful-copy state, so a screen-reader user is told the copy worked — previously nothing announced it, mirroring the pattern `CommandChip` already used.
- 5c8f488: `IntegrationMatrix` and `CommandChip` accessibility and visual fixes:
  - Every row's copy button in `IntegrationMatrix` now gets its own accessible name (the row's action label appended to `CommandChip`'s copy label), instead of every row sharing the identical "Copy command" name.
  - `IntegrationMatrix`'s rows now expose `role="list"`/`"listitem"` with per-cell `sr-only` column labels, so assistive tech gets a row/column association for Unit / Gives you / Actions.
  - The routine step's explanation now opens from a real button via a Popover (not a hover-only Tooltip on a non-interactive span), so it's reachable on tap.
  - `IntegrationMatrix`'s data-row divider now uses the strong border rung (`border-border-strong`), matching the header row, since it's the only cue separating same-surface rows.
  - `CommandChip`'s command text and `IntegrationMatrix`'s routine-step tokens now carry `translate="no"`, so browser page-translation can't mangle a command before it's copied.

- e667eb2: `SpecPlayground`'s click-to-line now locates a line for Chromium's position-free `JSON.parse` errors too ("Unexpected token …" and "Unexpected end of JSON input"), not just messages that carry a `line`/`position`. Its error-list id now falls back to `useId()` instead of a shared literal, so two `id`-less instances on the same page no longer collide, and the last-valid spec it keeps on screen while the current text is invalid is no longer written to a ref during render.
- Updated dependencies [8cdcd91]
  - @elabs-ai/components-tokens@5.6.0

## 5.5.0

### Minor Changes

- d0a075d: Added `Image`: token-styled `<img>` with `fit`, reserved-box skeleton, cached-image guard and an accessible fallback.
- d0a075d: Added `Audio`, `Video` and the `MediaPlayer*` compound parts (own controls from ui primitives, no media engine), plus `useMediaState` and `formatMediaTime`.

### Patch Changes

- 144375d: Harden `TokenSpotlight`: `scanForConsumers`'s JSDoc now documents that an SVG consumer is
  returned as its `<svg>` root (an `SVGSVGElement`) even though `onDone` stays typed
  `HTMLElement[]` for compatibility; unhovering or switching chips now clears
  `data-token-consumer` marks in the same idle-time slices used to write them, instead of one
  synchronous pass, so clearing a large consumer set is never a long task either; and a new
  opt-in `maxMarks` prop caps how many elements a token spotlight will mark (unset by default,
  matching `scanLimit`'s existing opt-in shape) for hosts where a token like `--foreground` or
  `--border` would otherwise flood the page with hundreds of marks.
- @elabs-ai/components-tokens@5.5.0

## 5.4.0

### Minor Changes

- be8ddcf: RM-138 / RM-139: `analytics[]` on the chart containers (ADR 0040 §1). `LineChart`, `AreaChart`, `BarChart`, `ComposedChart`, `DumbbellChart`, `WaterfallChart`, `CandlestickChart`, `ScatterChart` (both axes) and `DistributionChart` accept `analytics`:
  - **Computed lines and bands** — `{ kind: "line", value: "mean" | "median" | "min" | "max" | "sum" | number | { percentile } | { stddev } | (rows, key) => number }` and `{ kind: "band", from, to }` / `{ kind: "band", spread: { percentiles } | { stddev } | { ci } }`, resolved with the RM-137 maths and drawn through the annotation layer (a dashed `--chart-foreground` line; a band under the series). `of` names a series or `"all"` (pooled); `axis` the drawn axis; `when(rows)` is a show-condition; `ifOverflow: "extend"` widens the value domain, `"clip"` (default) keeps it. Labels: `"computation"` ("Average 73.8", localised), `"value"`, `"none"` or your own text; the axis' own `valueFormat`/`unit` formats the value.
  - **Derived series** — `trend` (linear, log, exp, pow, `{ poly }`, `{ loess }`, optional `ci` band, `extent`), `window` (mean, median, sum, min, max, ewm; `replace: true` stands in for its measure in the series token), `forecast` (additive Holt-Winters, `horizon`, `season`, `interval`; the time-series x domain grows to show the horizon) and `errorBars` (from fields or `{ percent }`; whiskers, or `band: true` on lines). Model paths are dashed in `--chart-foreground-muted`, each with its own dash rhythm; bands wash under the marks. Each derived series joins the container legend (dashed marker, "Trend (r² 0.82)", toggleable), adds a muted tooltip row, and adds one sentence to the figure description (appended after the auto summary, never replacing it).
  - `ReferenceLine value` and `DistributionReferenceLine value` (plus a new `to` for a band) accept an `AnalyticValue`; `ChartSpec.analytics` carries the serialisable form and `AutoChart` renders it; the A2UI catalog describes the kinds and the value union.
  - `<Scatter trend>` is now a deprecated alias of a `trend` analytic: it keeps its painted output and gains the legend entry; a dev warning names the replacement.
  - New exports: `resolveAnalytics`, `widenDomainForAnalytics`, `derivedSeries`, `deriveAllSeries`, `describeAnalytics`, the label helpers, `AnalyticSeriesLayer`, `ErrorBars`, `useChartAnalytics`, `resolveDistributionReferenceLines`. `LegendItem.marker: "dashed"` and `TooltipRow.muted` / `dashed` support the new entries. `@elabs-ai/components-ui` registers the `charts.analytics.*` messages.

  With `analytics` unset every container renders exactly as before.

### Patch Changes

- @elabs-ai/components-tokens@5.4.0

## 5.3.1

### Patch Changes

- @elabs-ai/components-tokens@5.3.1

## 5.3.0

### Patch Changes

- @elabs-ai/components-tokens@5.3.0

## 5.2.0

### Minor Changes

- 04be140: Dashboard pack rebuild — the sheet editor now behaves like a BI authoring surface.
  - Engine: `fit` placement pushes neighbours to the nearest free cells (biased away from the drag), swaps a same-size neighbour, and grows an `extendable` sheet without shrinking its cells; new `TileLayout.static` locks a tile (never moved, never pushed, an obstacle for compaction).
  - Edit layer: the dragged tile follows the pointer 1:1 and a resize edge follows the cursor while a dashed ghost shows the snapped cell; dotted cell grid (`ui.showGrid`); corner/edge grips centred on the tile edge; size badge only during a gesture; lock badge; handles on single selections only; align toolbar flips inside the selection when there is no room above.
  - Chrome: rebuilt `DashboardToolbar` (segmented View/Edit, undo/redo, Add, Grid with Show-grid switch and live density summary, Layout menu with Tidy up / Select all / selection actions / layout target, save state, Assets and Properties toggles, Export, shortcuts; new `features.layout|panels|export`), edit-mode tile hover chrome (Duplicate · Delete · ⋮ → full context menu with icons, shortcut hints, Properties, Lock), `DashboardSelectionBar` empty state and right-aligned actions, `DashboardAssetPanel` rows with icon + description and a full-height list, `DashboardPropertiesPanel` Layout section (column/row/width/height, lock), empty-sheet state.
  - Tiles: `DashboardTileKind.description`, `capabilities.padding`, `capabilities.surface: "plain"` (heading, divider); built-ins ship icons and descriptions; metric tiles show the number on two-row tiles; untitled tiles get a muted placeholder title in edit mode.
  - `ChartFrame chrome="tile"` floats the menu over the top-end corner when a frame has no header content instead of spending a header row on it.
  - `ui/Toolbar`: `ToolbarSeparator` was rendered as a horizontal dash inside horizontal toolbars (Radix flips the separator's orientation); fixed.
  - Filter tile: hierarchies — `levels` (2–6 fields, `rows` → Country → Region → City) or a `parentChild` table (org chart, bill of materials) render as a tri-state tree (`selected | associated | excluded` per node, counts, match-highlighting search that auto-expands, Expand all / Collapse all, `expandLevel`, `leafOnly`, `selectWithChildren`, `dense`); `confirm` turns clicks into a pending session with Confirm/Cancel; under 100 px tall (`xs`) the tile collapses to a bar that opens the full list in a popover. `filter-tree.ts` (`buildLevelTree`, `buildParentChildTree`, `filterTree`, `expandedToLevel`, `descendantsOf`) is exported. `useDashboardContext` is exported from `/dashboard`.
  - `ui/Tree`: `expandOn="row" | "chevron"` — `"chevron"` makes a row click select only, so a branch value is selectable in its own right (expanding stays on the chevron and ArrowRight/ArrowLeft).
  - `editor/MarkdownEditor`: inline `word:Word` text (a `${{msr:id:Title}}` placeholder, a ratio, an emoji shortcode) no longer crashes the editor or serializes as `word\:Word` — only the block directive forms (`::leaf`, `:::container`) are parsed; `insertAtCursor` with a one-line fragment now lands inline at the caret instead of as a new block.
  - Registry: new `dashboard-tile-markdown` block — a `DashboardTileKind` rendering GFM markdown (`MarkdownView`) and editing it in a full-screen rail + `MarkdownEditor` + live-preview dialog with `${{variables.x}}`, `${{selection.Field}}`, `${{selection.count('Field')}}`, `${{=expression}}` and `${{msr:ID:Title}}`/`${{dim:ID:Title}}` placeholders resolved locally or through `host.markdown.evaluate`; `dashboard-sheet-app` registers it as its `text` tile.

### Patch Changes

- 71aa69e: Gantt: switching the scale (Day / Week / Month / Quarter) now switches the density too. A `defaultPixelsPerDay` seed or an earlier wheel-zoom no longer pins the bars while only the header relabels — uncontrolled density drops back to the new scale's preset, controlled density receives it through `onPixelsPerDayChange`. The preset is floored at "the whole domain fits the timeline pane" (the pane is measured), so a coarse scale fills the width instead of a 600 px strip, and the first header cell of a scale that starts before the domain is clamped into view (its label was off-canvas). `ui` exports `mergeRefs`.
- 3ac9678: Gantt: a real zoom model and the schedule-insight layers the leading Gantt products ship.
  - Zoom: `actions.zoomTo / zoomBy / zoomToFit / scrollToDate`, `meta.zoom`; toolbar Zoom out · Zoom in · Fit to width · Today. Every zoom step and scale-preset switch is anchored (the date at the pane centre, or under the pointer for Ctrl/⌘ + wheel, stays put) and animated — bars, milestones, baselines, gaps, markers, time ranges and timescale cells morph to their new place (off under reduced motion, never during a drag). Uncontrolled density can always zoom; controlled density needs `onPixelsPerDayChange`.
  - `showCriticalPath` (CPM over finish-to-start links; solid destructive ring + "on the critical path" in the name; solid critical links), `progressLine` (status date or `true`; bends to each task's reached point), `timeRanges` (labelled spans behind the bars), `rollups` (child marks on collapsed summaries), and a scroll-to-task button when the selected bar is off-screen.
  - Sticky inside labels while a bar's start is scrolled out; day/week/month tick labels drop to their short form in narrow cells.
  - `gantt-schedule.ts` exports `computeCriticalPath` / `progressPointAt`.

- @elabs-ai/components-tokens@5.2.0

## 5.1.0

### Minor Changes

- 2be575f: Header-band design elements for the hairline family.
  - **ui** — `DraftingMarks`: a quiet construction drawing (two guides crossing at a station point, the arcs struck from it, a dot field, a dimension tick, registration crosses, two small token-inked accents) pinned to one corner of a hero or header band and faded away from it. Decorative and inert; `anchor` picks the corner, `accent={false}` keeps it in rule ink, `--drafting-marks-fade` swaps the falloff.
  - **tokens** — `hairline-rails` draws a solid registration cross where a rail meets a seam rule (`--hairline-cross-size`); new `--deco-fade-corner` / `--deco-fade-corner-tight` masks.

- b45250c: `SectionHeader` gains `size`.
  - **ui** — `size="lg"` sets the title on the display rung (`text-display`) and keeps the description at a readable measure, for the sections of a long page a reader scans by its headings (a landing page, a docs overview). `"default"` is today's `text-title` and stays the default, so every existing caller is unchanged. Visual only: the heading level is still `as`.

### Patch Changes

- a9613ea: First-user journey, wave 1 (from the 2026-09-21 new-user test).
  - **ui** — `cn()` keeps the chart type roles (`text-chart-source`, `text-chart-value`) beside a text colour; a `ChartCard`/`ChartFrame` source row renders at its footer size again. `SidebarInset` carries `min-w-0`, so a wide table or chart scrolls inside its card instead of pushing the page wider than the viewport.
  - **charts** — `ChartCard` and `ChartFrame` carry `min-w-0` as grid items (same overflow at phone width).
  - **cli** — `docs <Name>` resolves a re-exported name to its owner package (`MetricCard` → ui, `Text` → ui), accepts `<pkg>/<Name>`, prints "also exported from", and in a consumer project points at the installed `.d.ts` instead of a monorepo path. The props extractor follows barrel re-exports, merges declaration-merged interfaces and reads `forwardRef<El, Props>` generics — 200 more components record an API (HeatmapChart, ChartAnnotations, ChartTooltip, ToggleGroup, Toaster, Text, Heading …), and `LineChart` lists `annotations`. `create --title` names the sidebar brand slot; the generated CLAUDE.md points at the downloadable theme families instead of "two shipped themes". `map` classifies per (name, source library): a same-name export from another domain is a `gap` with a "name coincidence" note, shell/layout/chart-library elements have curated aliases, and the migration plan decides the theme in phase 1 and names the shell parts in phase 4.
  - **all packages** — internal peer dependencies are published as `^<version>` instead of an exact pin.

- Updated dependencies [2be575f]
- Updated dependencies [a9613ea]
- Updated dependencies [2be575f]
  - @elabs-ai/components-tokens@5.1.0

## 5.0.0

### Minor Changes

- 5646c7f: Components for agent-operations surfaces. `@elabs-ai/components-ui` gains `Meter` — a word-sized read-only quantity with the ARIA `meter` role (not a `progressbar`): `foreground` ink by default, the status tones for a quantity that is a verdict, `size` xs/sm/md, a `marker` reference tick (same construction as `Progress.marker`) and `segments` for a countable "4 of 5" strip. `Descriptions` takes `labelWidth` (`"1/3"` default, `"1/4"`, `"1/5"`). `@elabs-ai/components-tokens` adds three additive type rungs — `kpi-sm` (24px tile values, pair with `tabular-nums`), `eyebrow` (meta size, 500, +0.06em; pair with `uppercase`) and `display-lg` (48px hero/deck headline) — exposed as `text-<role>` utilities, `Text variant="kpi-sm" | "eyebrow"` and `Heading size="display-lg"`; `SectionHeader`'s eyebrow slot now reads the `eyebrow` rung (tracking +0.025em → +0.06em). `@elabs-ai/components-charts` gains `ReferenceLine`, a labelled horizontal threshold that composes inside `LineChart`/`AreaChart`/`ComposedChart` on the series' own y-scale (dashed `--chart-foreground`, haloed label, outside the reveal clip like `Grid`; a value outside the y-domain draws nothing rather than stretching it). The registry adds an `agent-ops` category: `agent-ops-parts` plus twelve copy-own blocks (provenance KPI strip, insight feed, provenance record, score explanation, spend against limit, escalation boundary, decision record, audit log, agent trace waterfall, finding cards, verdict side by side, handoff inspector), four of which are also published as A2UI agent-designed surfaces.
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

- f0155e5: Charts: every keyboard datapoint target now has a real accessible name even when no `datapointLabel` is passed. The shared default (localised through `t()`) drops an absent part instead of announcing a dangling `:` (`"Revenue, Jan"`, `"Engineering"`), names a target with no category by position (`"Data point 3"`), formats values with locale grouping (`"Visitors: 12,000"`, previously `"Visitors: 12000"`), formats date categories with the active locale (year included, and time when present), and never repeats a group that is both series and category. A `datapointLabel` that returns an empty string now falls back to the default. `DumbbellChart` targets announce both ends (`"Verify email: 82 to 94"`). New `DEFAULT_MESSAGES` keys: `charts.datapoint.labelNoValue`, `charts.datapoint.labelNoSeriesNoValue`, `charts.datapoint.position`, `charts.datapoint.labelRange`.
- 431e9a2: Hero pieces for a landing page. `@elabs-ai/components-ui` gains `CommandChip`: an install/connect command with a host menu (one command per coding-agent host) and a copy button that announces "Copied" in a status region. `@elabs-ai/components-marketing` gains `TrustStrip`, a server-safe row of generated facts with an optional counters slot; marketing stays free of `"use client"`.
- fc40636: Browser-only primitives for a marketing or landing surface. `@elabs-ai/components-tokens`: `ThemeProvider` takes an optional `transition?: (apply: () => void) => void` so an app can wrap a theme change (for example in a view transition). `@elabs-ai/components-ui` gains `ThemeFamilySwitch` (theme-family chips plus a light/dark toggle), `AmbientField`, `ParallaxPlane`, `RevealOnEnter` and `useScrollProgress` (with `MOTION_FACTOR_FLOOR`, `isMotionAtFloor`, `readMotionFactor`, `supportsScrollTimeline`). `motion` is an optional peer of ui, loaded only by dynamic `import()`; ui now ships `dist/index.css` (`sideEffects: ["**/*.css"]`). `@elabs-ai/components-marketing` stays server-safe.
- 817dd16: `@elabs-ai/components-ui` gains `SurfaceTour` (a sticky tab list over a fixed-height frame that keeps its height across tabs, crossfades content, deep-links through the URL hash and lazy-loads each tab's surface on hover, focus or click), `SurfaceTourActions` (Open in Storybook, Copy prompt and Scaffold, built on `CommandChip`) and `AffordanceHint` (a one-time, `aria-hidden` hint pill that shows once per tab per session and hides on the first interaction). All copy, links and prompts come in as props or `labels`.
- e52e84c: UI gains three new components: `SpecPlayground` is a live JSON spec editor that validates, renders, shows path/code/message errors that jump to the line, displays the last valid render when the spec is incomplete, offers an examples menu, and accepts a pluggable `editor` slot (Textarea by default); all strings are configurable via `labels`. `IntegrationMatrix` is a table of agent integration routes selectable by host, with copy and link actions for each. `InstallTabs` includes a package-install tab (`pnpm add …`, which switches by app archetype), a copy-own tab (registry block via `shadcn add`), one tab per agent host, and a prompt tab; all text is configurable. CLI: `createMcpHttpHandler` and the `llms` renderer accept a `siteRoutes` option (default `false`). With `siteRoutes: true`, story links point to `https://elabs-ai.com/storybook/?path=…` and the registry endpoint is `https://elabs-ai.com/r`; with it off (default), output is unchanged.
- dbee30e: Add `TokenSpotlight` (ui): a row of semantic-token chips that show each token's resolved value in the current theme and, on hover or focus, outline every element on the page that uses that token. Add `GatesBand` (marketing): a server-safe list of checks or guarantees, grouped by category and rendered from data you pass in.
- f024c7a: Add the `maps.*` microcopy keys the map controls and the map loading state now read through `t()`: `maps.canvas.loading` and `maps.controls.zoomIn` / `zoomOut` / `resetBearing` / `locate` / `locating` / `fullscreen` / `fit`.

  They shipped as hardcoded English inside `@elabs-ai/components-maps`, which meant a localized app had no way to translate a zoom button. Every key keeps its old English wording as the default, so nothing changes for an app that does not translate.

- 8a807dc: Chart and metric value formatting now accepts an object spec, not just the 4 preset strings: `valueFormat={{ decimals: 1, abbreviate: true, sign: "always", suffix: "%" }}` works anywhere a `ChartValueFormat` was accepted before (`YAxis`, `ChartLegend`, `AutoChart`'s `ChartSpec`, tooltip values) and on `MetricCard`'s `valueFormat` in `@elabs-ai/components-ui`. The 4 preset strings (`"number" | "compact" | "currency" | "percent"`) are unchanged and render byte-identically.

  `YAxis` gains `unit`/`unitOn` to paint a unit suffix on one, or every, tick.

  `XAxis` date labels now pick their granularity from the series' own time span and tick count (year down to minute) instead of always rendering the same "Mon d" shape — a 36-hour series now reads hours, a decade-long one reads years. This is a visible default change for any chart with a very short or very long time domain; pass the new `dateFormat` prop (or `ChartSpec.dateFormat`) to pin a specific rung.

- a2aff19: Dual-axis `ComposedChart`. New `yAxes={{ align, proportional, zero }}` prop: `align: "ticks"` (the default once `yAxes` is set) gives both value axes the same tick count on the same pixel rows and draws the grid on those rows; `proportional` makes both scales grow by the same factor from one shared origin; `zero: "both" | "auto"` applies the "both or neither" baseline rule. Columns and areas stay zero-based whatever is asked. `YAxis` gains `matchSeriesColor` (tick labels and title in the axis' series colour when it carries exactly one series) and `sideLabel` (`"auto"` reads "Left scale" / "Right scale" from the new `charts.axis.leftScale` / `charts.axis.rightScale` messages in `@elabs-ai/components-ui`). The container legend gains `layout: "split"`, one row per axis led by its side label (side by side at medium and wide widths, stacked at narrow), and `ChartTooltip variant="table"` groups its columns under the same side headers. `ComposedChart stacked="percent"` stacks each x's columns to 100 %, pins the primary `YAxis` to 0–100 % and prints percent unless the axis sets its own format; the tooltip keeps the raw values.

  No default changes: a `ComposedChart` without `yAxes`, `stacked="percent"` or the new `YAxis` props renders as before.

- 87e58d7: New `colorScaleFor(values, spec)` in `@elabs-ai/components-ui`: one pure value → colour decision for thematic encodings, shared by charts, data tables and maps. Continuous scales place the ramp by `linear`, `median`, `quartiles`, `quintiles`, `deciles` or `natural` (Jenks) stops; stepped scales cut classes by `equidistant`, `rounded`, `quantile`, `jenks` or `custom` breaks. A `[min, center, max]` domain pins the ramp's middle colour; `palette` picks `sequential`, `diverging` or `categorical`. Every colour it returns is a `var(--chart-…)` token reference, so fills follow the active theme. The result lists its classes (`steps`), gradient stops and categories for a legend, and answers `colorOf`, `indexOf` and `positionOf` for any value. Nothing existing changes.

  `ChoroplethChart` becomes a thematic map. A colour `scale` (`{ key?, type, method?, steps?, domain?, palette? }`, resolved by `colorScaleFor`) fills each region from the theme's ramps; `getFeatureColor` still wins when given. `legend` draws the matching `RampLegend` (or category swatches), titled, with `ruler`, `ranges` or `custom` labels, in a plot corner at wide and medium and below the map at narrow; its marker follows the hovered or focused region. `fitToData` frames the regions that carry data (`hideNoData` removes the rest), `inset` adds a locator map, `labels` places up to 30 region names through the label solver (none at narrow), `overlayBy` stripes regions by a category, `symbols` draws proportional symbols (area encodes the value; they shrink on plots narrower than 700 px) with a size key, `zoomControls` adds real zoom-in / zoom-out / reset buttons, and `annotations` pins text notes by longitude / latitude (a numbered key at narrow). With `hideNoData` and no data left, the chart shows an empty state. A chart that sets none of these renders exactly as before.

  `AutoChart` gains `type: "choropleth"`: a spec names its map with `geo` (a GeoJSON FeatureCollection, or the bundled `"world"` / `"us-states"`), joins its rows to regions with `match` (`row` defaults to `x`, `feature` to the region id), colours them with `scale`, names them with `labels.places` and sizes proportional symbols with `symbols`. The type is explicit only — no data shape is ever inferred as a map — and a spec with no `geo` renders the unsupported fallback. A bundled map is fetched only when a spec asks for one, so specs that draw other charts carry none of it.

  Deprecated: `ChoroplethChart`'s numeric `scale` (the projection zoom) — use `projectionScale`. `scale` now takes a colour-scale object; a number keeps working as the projection scale until the next major.

  Migration: replace `scale={560}` with `projectionScale={560}`; nothing else changes.

- 3a3b59a: Created apps download less and install cleanly. `ui`, `icons`, `ai`, `data`, `flow`, `maps`, `charts`, `marketing`, `viewer` and `terminal` now build one output file per source module (entry points, `exports` and type declarations are unchanged), so an app's bundler keeps only the components it imports: the `dashboard` template's first JavaScript download drops from 609 KB to 147 KB gzip. `@elabs-ai/components-charts` moves `@visx/brush` to 4.0.1-alpha.0 like the rest of visx, which ends the `ERESOLVE` peer warnings npm printed for React 19 apps. `brand-ui create` writes the app's CI workflow for the package manager that ran it: `npm ci` for an app created with `npx`, otherwise `pnpm/action-setup` pinned to the pnpm major that created it (the old workflow failed for npm apps, and for pnpm apps without a `packageManager` field). The app's CLAUDE.md lists that package manager's commands and says to commit the lockfile, and `create --install` under pnpm now installs with pnpm (it picked npm).
- a514030: App shell headers now share one height in every theme. `SideDock`'s header is a fixed `h-header` band (its `description` moves to the top of the body), and `ChatShell`'s header and `ContextPanelHeader` use `h-header` too, so they line up with the top bar even when a theme retunes `--header-size`. `ContextRail` no longer draws an edge line or a leading bar on the active switcher icon, and its count badge is no longer clipped. `NavUser` is now the standard sidebar footer: the user row opens an account menu with Settings (`settingsHref` or `onSettings`) and Sign out (`onSignOut`), plus any extra items passed as `children`; its previous placeholder items (Upgrade to Pro, Account, Billing, Notifications) are gone. A collapsed `Sidebar` no longer clips `lg` menu buttons: the icon-rail padding now lives per size, so the footer avatar sits whole in its 32px square.
- fb04bc5: The hairline decoration family: the quiet line-work of a calm product page, as opt-in, token-driven gestures that work in every theme.
  - **tokens** — new `--hairline-*` tokens and utilities: `bg-hairline-hatch` (a faded diagonal hatch well), `hairline-stack` (two sheet edges stacked behind a card), `hairline-slot` (dashed placeholder), `hairline-frame` (dashed rails that run past a box's corners and fade), `hairline-rails` (rails down the content column of a full-bleed section), `hairline-corners` (crop marks), `hairline-ticks-x` / `hairline-ticks-y` (a tick ruler) and `hairline-rule` / `hairline-rule-y` (a dashed separator). Lines take the theme's own `--rule` / `--rule-strong`; the hatch is a translucent tint of `--foreground`. Like the paper grounds they are not on the decoration dial, paint only on inert pseudo-element layers, and never touch a control.
  - **ui** — `CardMedia`, the card's media well (faded hairline hatch by default; `ground="dots" | "none"`, `fade`), and `<Card stacked>`.
  - **charts** — `fillStyle="hatch"` on `Bar` and `SeriesBar` draws a series as an outlined hairline hatch in its own colour at any decoration level (default `"solid"` is unchanged), plus `makeHairlineHatch` / `hairlineHatchId` / `isHatchableFill` and the scale-free `Ruler` mark.
  - **marketing** — `FeatureGrid ruled` rules the grid with dashed hairline dividers (default `false`). The Marketing starter template adopts `hairline-rails`, `hairline-frame` and the ruled grid.

### Patch Changes

- 3951d51: A2UI — the generative-UI path — ships. `@elabs-ai/components-ai` gains `<A2uiSurface>`: an agent describes a screen as JSON (`{ "a2ui": "1", "root": node }` of catalog types), the surface validates it against the catalog and renders it with the real components; `on.<event>` bindings reach the host's `onAction`, streaming prefixes build up node by node, and a settled invalid surface reports every problem with its path. The shipped catalog (`uiCatalog`, 62 ui types + `Stack`/`Grid`) is generated from the manifest; apps extend it with `createA2uiCatalog`/`defineA2uiType`. `@elabs-ai/components-charts` exports its half (`CHARTS_A2UI_BINDINGS`, `CHARTS_A2UI_CATALOG_SCHEMA`: `AutoChart`, `ChartCard`, `MetricGrid`, `Sparkline`, `BulletChart`, `Gauge`). The CLI adds `brand-ui a2ui catalog | schema | validate | example`, the MCP server the `a2ui` tool, and the JSON Schema is published as `@elabs-ai/components-ai/a2ui/schema.json`. `CardHeader` now lays a `CardAction` out top-right (it rendered below the description before).
- 015b988: `Command`'s inline list no longer scrolls the whole page. cmdk auto-highlights an item on mount, on every keystroke and on every arrow-key press, and calls the browser's native `scrollIntoView({ block: "nearest" })` on it — which walks every scrollable ancestor, the window included, so a `Command` mounted below the fold used to jump the page to it. Selection scrolling now stays inside the list: keyboard navigation still brings the active item into view, but only by scrolling the list itself.
- 94f1e0e: Accessibility fixes behind the blocking axe gate, across the screens the generative-surface merge brought in. `AccordionTrigger` gains `headingLevel` (2–6, default 3): Radix hardcodes its header as an `h3`, which skips a level whenever an accordion sits directly under the page heading. An outline `Button` now pins its own `text-foreground`, so it stays legible on a coloured band instead of inheriting that band's ink against its own `bg-background` plate (1.06:1 before). `ProcessKpiStrip`'s inline ribbon keeps its label/value pairs one element deep inside the list, with the trend inside the value, so the definition list is well-formed. Faint ANSI output (SGR 2) moves from 0.5 to 0.7 opacity — 4.2:1 was under AA on the terminal surface.

  Registry blocks: section headings under a page title are `h2` (office insight feed, trace waterfall, score explanation, dependency web, project cards, kanban board, product detail, run review), a `Select` inside a field carries its label as an accessible name (contact, profile, market desk), a tooltip'd toolbar toggle self-provides its tooltip provider (process explorer), the cart total rule is a border instead of a separator inside the list, and marketing copy on a coloured plate, faded wordmarks and team roles use ink rungs that reach 4.5:1.

- 18f063e: **`SurfaceTour`** no longer makes the page scroll sideways when it spans the full width of the viewport. The sticky tab strip used to reach 8 px past the tour on each side (`-mx-2 px-2`), so a tour mounted without a page gutter was 8 px wider than the screen at every width. The strip now lines up with the frame under it. In a page with a gutter nothing visible changes: the strip still covers the frame's edges while the tour scrolls under it.
- 6271b00: `TokenSpotlight` marks only the elements that really paint a token, without a long task, and shows readable values. A border colour counts only on a side whose width is above 0, the text colour counts only on an element with its own text, and an SVG shape's fill or stroke is reported once as its `<svg>`. The `data-token-consumer` marks are written in idle slices, and are cleared on unhover, unmount and theme change. Chip values show colours as a rounded `oklch(L C H)` (never a build-transpiled `lab()`) and lengths such as `--radius` as resolved px (never a raw `calc()`). They are re-read when `data-decoration` changes as well as `data-theme`. No prop changes.
- Updated dependencies [5646c7f]
- Updated dependencies [779c040]
- Updated dependencies [fc40636]
- Updated dependencies [4386ae3]
- Updated dependencies [4e07999]
  - @elabs-ai/components-tokens@5.0.0

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
  - @elabs-ai/components-tokens@4.2.0
