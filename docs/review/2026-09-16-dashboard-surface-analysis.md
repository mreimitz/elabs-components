# Dashboard surface for brand-ui — market analysis, requirements and decision

Date: 2026-09-16
Question: `@elabs-ai/components-charts` gains a **dashboard sheet surface** — a grid users place charts (and later other components) on, with an edit mode (place, move, resize, replace, reorganise) and a view mode, and with one shared state for every object on it. What exactly gets built, where does each part live, and what do the hosted components need in return?
Decision (proposed for the maintainer, 2026-09-16): **the surface is a new `dashboard/` area inside `packages/charts`, published on a subpath `@elabs-ai/components-charts/dashboard` (ADR 0006), with a framework-free `core/` (spec, layout engine, history, store) and a React layer (`DashboardSheet`, tiles, edit chrome). Tiles are a host-registered renderer map, so the surface never imports `data` or `ai` and the one-way dependency graph is untouched. Shared state is one zustand vanilla store per sheet, created in a provider and driven either by a local reducer or by an external associative engine through a `SelectionDriver` seam. The layout engine is written, not imported (~400 lines of pure TypeScript), and drag/resize ride `@dnd-kit/core`'s sensors, which the workspace already depends on.** Roadmap: `roadmap/dashboard-surface/` (RM-069 … RM-088).
Packages inspected: `packages/charts` (`ChartFrame` + `ChartFrameProvider`, `AutoChart`/`ChartSpec`, `ChartDatapoint` drill-down contract #349, `MetricCard`/`MetricGrid`, `Sparkline`, `Gantt`, marks, ramps, `templates-dashboard.stories.tsx`, `export-svg.ts`), `packages/ui` (`BentoGrid`, `Resizable`, `SchemaForm`/`FormSpec`, `ContextRail`/`SideDock` ADR 0035, `Toolbar`/`ViewToolbar`, `ExpandDialog`, `ConfirmDialog`, `KeyboardShortcuts`, `Tabs`, `Command`, `Sidebar`, `useIsMobile`, `downloadBlob`), `packages/data` (`FilterBar`, `FacetFilter`, `DataTable` with `@dnd-kit/sortable`), `packages/process` (`useProcessExplorer` tri-state selection and the R22 external-selection seam, `/core` subpath), `packages/flow` (React Flow, which itself ships on zustand 4.5.7 — already in `pnpm-lock.yaml`), ADR 0006/0007/0012/0019/0026/0031/0032/0034/0035/0036, `docs/playbooks/dashboard.md`, `.claude/rules/charts.md`.

Method: web survey of the sheet/dashboard editors of Qlik Sense (Cloud), Grafana 11/12 (classic grid and Scenes/dynamic dashboards), Apache Superset, Metabase, Power BI, Tableau, Looker Studio, Lightdash, Databricks AI/BI, ThoughtSpot; the grid-engine libraries react-grid-layout 2.x, gridstack.js 13, `@dnd-kit`, pragmatic-drag-and-drop, react-rnd, muuri, dockview; the state libraries zustand 5, zundo, nuqs; and the tile contracts of Superset plugins, Grafana `PanelProps` and nebula.js `stardust`. Every claim about the repo was checked against source. Sources are at the end; claims that could only be confirmed from secondary sources are marked _(secondary)_, and premises that the survey could **not** confirm are called out rather than carried forward.

## 1. Executive summary

1. **A sheet is a spec, a store and a renderer — in that order.** Every product surveyed that is usable by code (Grafana dashboard JSON, Lightdash dashboards-as-code, Superset YAML export, Metabase dashcards, Qlik sheet objects) is a flat list of tiles with grid coordinates, typed content, a filter graph and named saved states. For brand-ui — whose audience is AI coding agents as much as humans, and which already has a serializable `ChartSpec` that an LLM tool-call emits — the serializable `DashboardSpec` is the product; the editor is one of two ways to produce it (the other is an agent). Every feature below is specified as "what it adds to the spec, what it adds to the store, what it draws".
2. **Placement: inside `charts`, on a subpath, with host-registered tiles.** The surface composes `ChartFrame`, `AutoChart`, `MetricCard`, `Sparkline` and `ui` chrome — everything it needs is at or below `charts`. What it does _not_ own is the set of things a tile can be: `chart`, `metric`, `text`, `image`, `heading`, `divider`, `container`, `filter` and `button` ship built in; a `table` tile (`data`), a `chat` tile (`ai`), a `process-map` tile (`process`) are registered by the host or shipped as copy-own registry blocks (D4), never imported. That keeps `charts → ui` the only arrow. The subpath keeps zustand and `@dnd-kit/core` out of the main barrel for consumers who only want a bar chart (ADR 0006 condition 2; ADR 0032's reasoning about not taxing every consumer).
3. **Two grid models, one engine.** Qlik's sheet is a fixed `columns × rows` cell grid that scales to the viewport and can be _extended_ by 50 % increments; Grafana/Metabase/Superset are `N` columns with a fixed pixel row height, vertical compaction and a page that scrolls. Both are the same data model (`{x, y, w, h}` in cells) with a different resolver: `fit` (cells scale, no compaction, collisions are rejected or swapped) and `flow` (rows are 30-ish px, gravity pulls tiles up). The engine is ~400 lines of pure TypeScript — `resolveCollisions`, `compact`, `correctBounds`, `findEmptySlot`, `stackForNarrow` — and is **written, not imported**: react-grid-layout 2.x is React-coupled and shipped its v2 rewrite in Dec 2025 with an open React 19 issue; gridstack's `GridStackEngine` is the best headless reference but its React story is a DOM-manipulating wrapper; `@dnd-kit` has no grid or resize logic at all but has the keyboard sensor and live-region announcements the repo's accessibility bar requires — and it is already a dependency. Read gridstack, borrow dnd-kit's sensors, own the algorithm.
4. **State: one vanilla zustand store per sheet, with a driver seam.** Zustand's `createStore` is framework-free (no React import), `useStore(store, selector)` rides `useSyncExternalStore`, `subscribeWithSelector` gives non-React listeners per-slice subscriptions, and the store instance is handed down through context — one sheet, one store, many sheets on one page do not collide. Selections are the one slice that a host may own: a `SelectionDriver` interface (`getState / subscribe / select / clear / back / forward`) with a bundled local implementation, exactly the tri-state pattern `useProcessExplorer` established for R22 — components render `selected | associated | excluded`, emit intents, and never filter on their own. A Qlik mashup plugs its associative engine in; a prototype uses the local driver. Hover is an ephemeral channel outside history and persistence. Undo/redo is a hand-rolled snapshot history over the `spec` slice only (zundo does the same in 700 bytes but is one more dependency for forty lines of code).
5. **The tile contract is the interface that matters.** Grafana's `PanelProps` (data, size, options, `eventBus`, `replaceVariables`, `onChangeTimeRange`), Superset's `metadata.behaviors` (`INTERACTIVE_CHART`, `DRILL_TO_DETAIL`, `DRILL_BY`) and nebula.js's `Interactions` (`{ passive, active, select, edit }`) converge on one shape: a tile receives its spec, its pixel size, the current mode and interaction permissions, the shared state slices it declared it consumes, and a small set of emitters; a tile _kind_ declares its capabilities, default and minimum size, and a `FormSpec` for its properties panel (brand-ui already has `SchemaForm`). `DashboardTileProps` and `DashboardTileKind` are that shape.
6. **The hosted components need five enhancements, all of which are good for them anyway.** `ChartFrame` needs a `chrome="tile"` variant (the sheet owns the header), an `interactions` prop (nebula's four booleans, so edit mode can switch tooltips and selections off without unmounting), and **density tiers** (a 4×3-cell tile cannot show a legend, two axes and a source row — `size` drives which furniture survives, the same way `MetricCard` already compacts). The chart families need a **selection-state input** (`selectionStates` per category/series, rendering excluded marks dimmed — the input half of the #349 drill-down output) and a **shared-hover input** (`hoverCategory`, Grafana's shared crosshair). `MetricCard` needs size tiers and an optional sparkline. `AutoChart` needs nothing — its `ChartSpec` is already the chart tile's content.
7. **Five waves, twenty items.** Wave 0 (ADR + scaffold, core spec + layout engine, store + driver seam, the two `ChartFrame`/chart-family enhancements) is the foundation; wave 1 ships a viewable sheet from a spec with built-in tiles, filter tile, selection bar, fixtures and stories; wave 2 is edit mode (drag/resize with keyboard parity, toolbar, undo, asset and properties panels, tile operations); wave 3 is the interaction graph, bookmarks and URL state, responsive stacking and sheet export, and the external-driver example; wave 4 is the agent-facing spec tooling (JSON schema, auto-layout, `brand-ui dashboard-spec`), presentation mode, conditions and theme overrides, and the closure (playbook, registry block, rule file).

## 2. What the market actually shows

### 2.1 Grid models

| Product                                                                          | Columns                                                                                                                                           | Row unit                                                                                                                                                                | Compaction                                                                                | Mobile                                                                          | Notes                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Qlik Sense (Cloud) — **verified live against the maintainer's tenant, see §2.0** | sheet property `columns`: **24** at the default `gridResolution: "small"` (or empty), **84** at `"customrows"` (the "Custom" grid-spacing slider) | `rows`: **12** default, **42** at `customrows`; the sheet scales to the viewport ("Responsive", `pxWidth`/`pxHeight` empty) or has a fixed 300–4,000 px size ("Custom") | none — free placement, snap to grid, collisions prevented                                 | `layoutOptions.mobileLayout: "LIST"` — objects stack as a list on small screens | "Extend sheet" adds 50 % of the original height per step (the engine's `height` scale factor goes 100 → 150 → 200); custom-size sheets cannot be extended; each cell stores `name, type, col, row, colspan, rowspan` and percentage `bounds {x, y, width, height}` where `x = col / columns · 100` and `width = colspan / columns · 100` |
| Grafana (classic grid)                                                           | `GRID_COLUMN_COUNT = 24`                                                                                                                          | `GRID_CELL_HEIGHT = 30` px, `GRID_CELL_VMARGIN = 8`; `MIN_PANEL_HEIGHT = 3` cells                                                                                       | vertical (react-grid-layout)                                                              | single column stack                                                             | Scenes/dynamic dashboards (12.x) add rows, tabs, conditional rendering and an "auto grid" that sizes panels to available space                                                                                                                                                                                                           |
| Apache Superset                                                                  | 12                                                                                                                                                | rows are containers; charts have a pixel height                                                                                                                         | tree layout (`position_json`: ROOT → GRID → ROW → CHART, TABS, MARKDOWN, HEADER, DIVIDER) | stacks                                                                          | native filters may now sit **on the canvas** as tiles (PR #44216)                                                                                                                                                                                                                                                                        |
| Metabase                                                                         | 18 (proposal to move to 24 in #6218)                                                                                                              | `row/col/size_x/size_y` on each dashcard                                                                                                                                | vertical                                                                                  | 1 column                                                                        | `parameter_mappings` per card decide which cards a dashboard filter reaches                                                                                                                                                                                                                                                              |
| Power BI / Looker Studio / Tableau "floating"                                    | free canvas                                                                                                                                       | pixels                                                                                                                                                                  | none                                                                                      | separate mobile layout                                                          | Tableau's "tiled" mode is a nested split layout, not a grid                                                                                                                                                                                                                                                                              |
| Lightdash (dashboards-as-code)                                                   | 36                                                                                                                                                | `x/y/w/h` per tile in YAML, tile `type` (saved chart, markdown, SQL chart), `filters[]` with `tileTargets`, `tabs`                                                      | vertical                                                                                  | stacks                                                                          | the closest published analogue to the spec this document proposes                                                                                                                                                                                                                                                                        |

The official Cloud help describes the sheet only in terms of Responsive/Custom size and a grid-spacing slider (Wide/Medium/Narrow/Custom); the engine object is what settles the numbers. Read live from the maintainer's tenant (§2.0): the default responsive sheet is **24 × 12** (`gridResolution: "small"`) and the "Custom" spacing setting the Demo Banking app uses is **84 × 42** (`gridResolution: "customrows"` — 3.5× the default in both axes, so every default-grid position is still representable). The design below carries `columns`/`rows`/`density` as spec fields with `24 × 12` as the default and lets `density` map to the finer grids.

### 2.0 Reference walkthrough — the maintainer's Qlik Cloud tenant (2026-09-16)

Read in the maintainer's own browser on `mreimitz.eu.qlikcloud.com`, app "Demo Banking" (`a5aff609-…`), 16 sheets. Engine facts were pulled over the app's websocket with a `SheetList` session object; UX facts were observed in edit and analysis mode on sheet "Home (5)".

**Sheet object (engine).** `qData` per sheet: `title`, `columns`, `rows`, `gridResolution` (`"small"` | `""` | `"customrows"`), `layoutOptions: { mobileLayout: "LIST" }`, `height`, `pxWidth`, `pxHeight`, `gridMode`, `cells[]`. Distribution across the 16 sheets: 12 × `84×42/customrows`, 2 × `24×12/small`, 2 × `24×12/""`. A cell on "Home (3)":

```json
{
  "name": "…",
  "type": "combochart",
  "col": 1,
  "row": 1,
  "colspan": 40,
  "rowspan": 16,
  "bounds": { "x": 1.19, "y": 2.38, "width": 47.62, "height": 38.1 }
}
```

— `bounds` is redundant with `col/row/colspan/rowspan` (percent of the sheet), kept for renderers that never learn the grid. Object `type`s seen on sheets: `combochart`, `barchart`, `treemap`, `sn-table`, `sn-shape` (a vertical divider), `sn-layout-container`, `sn-tabbed-container`, `qixMarkdownViewer`, `pipeline-bleed`, `qix-hierarchy-select` — i.e. exactly the kind set the requirements below ship built in (chart, table, divider, container/tabs, text/markdown) plus extensions registered by name, which is what the host-registered tile map models.

**Edit mode ("Edit sheet" toggle, top right).** A dotted cell grid appears; the left **asset panel** has three tabs (Assets, Sheets, Bookmarks) plus cut/copy/paste/delete, a searchable object list grouped by bundle ("Custom objects → Extensions / Qlik Smart bundle / AnyChart …"), and an **icon rail** (Fields, Master items, Charts, Bookmarks, Sheets, Insight triggers). The right **properties panel** shows _sheet_ properties when nothing is focused — Title, Title expression, Show condition, Description, thumbnail, Styling, **Grid spacing** (Wide/Medium/Narrow/Custom + slider), **Sheet size** (Responsive/Custom), **Small screen layout** (List view/…), **Extend sheet** toggle, Alternate states, Actions (sheet-level actions on open) — and _object_ properties when a tile is focused (a "Chart suggestions" toggle, then Data / Sorting / Add-ons / Appearance → General, Alternate states, Presentation, Colors and legend, X-axis, Y-axis, Tooltip). A focused tile paints a green outline with **eight resize handles** (corners + edge midpoints) and a **badge at its bottom-right corner reading `(1,1) ⤢ 40 × 16`** — position and size in cells, which is precisely the live-region wording the keyboard resize announcer needs. Top toolbar in edit mode: undo, redo, Source table, Properties, Edit sheet. Tile context menu: Full screen, Create insight trigger, Add to master items, Cut, Copy, Paste and replace, Copy style, Paste style, Delete.

**Analysis (view) mode.** No grid, no panels; the sheet fills the viewport. A **selections bar** across the top: selections tool, smart search, step back, step forward, clear all, then one green chip per selected field (`Year` / `2025`, with an × to clear that field). Hovering a tile reveals a mini toolbar (download, full screen, more); the tile context menu is Full screen, Show details, Exploration menu, View data, Alerts, Download. The Markdown/text tile and the chart tiles have the same chrome, which confirms "tile chrome belongs to the sheet, not to the object".

What this changes in the plan: `density` gains a `"custom"` value carrying an explicit `columns × rows` (R3); the tile badge and its wording become the keyboard-resize announcement (R32); "Paste and replace" / "Copy style / Paste style" join the tile operations (R36); sheet-level `actions` on open and `showCondition` on the sheet itself join the spec (R31 widened); "Show details" (the tile's description/footnote) and "View data" (the table flip `ChartFrame` already has) are the view-mode menu's baseline (R26).

### 2.2 Grid engines

| Library                                    | Version / licence                                                                                                                             | Headless algorithm?                                                                                                                                                                                                                                | Resize?                          | Keyboard + SR?                                                                                                                              | Verdict                                                                                                                                         |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| react-grid-layout                          | 2.2.x, MIT; v2 TypeScript rewrite 2025-12-09 with pluggable `compactor`, `positionStrategy`, `useGridLayout` hooks; `width` prop now required | partially — the v2 RFC splits a React-free core but the packages are React-coupled                                                                                                                                                                 | yes (react-resizable, 8 handles) | none documented; an open React 19 issue (#2045) and a community `react-grid-layout-19` fork exist                                           | reference for compaction semantics; do not adopt                                                                                                |
| gridstack.js                               | 13.x, MIT                                                                                                                                     | **yes** — `GridStackEngine` is "the core engine that performs grid manipulation without any DOM operations": `collide`, `compact('compact' \| 'list')`, `float`, `findEmptyPosition`, `moveNodeCheck`, `nodeBoundFix`, nested grids, `batchUpdate` | yes                              | pointer-first                                                                                                                               | best algorithm reference; its React integration manipulates the DOM outside React — incompatible with the repo's forwardRef/cn/Radix discipline |
| `@dnd-kit/core` 6.3 (+ `sortable`)         | MIT, already in `ui` and `data`                                                                                                               | no grid logic; collision strategies are for drop targets, not layout                                                                                                                                                                               | **no**                           | **yes** — `KeyboardSensor` (Enter/Space to lift, arrows to move, Escape to cancel), `announcements` live region, `screenReaderInstructions` | use its sensors and announcements; write the grid                                                                                               |
| pragmatic-drag-and-drop                    | Atlassian, MIT                                                                                                                                | no                                                                                                                                                                                                                                                 | no                               | explicitly **opt-in** ("no one pattern works for all situations")                                                                           | weaker default a11y than dnd-kit; no reason to add a second drag engine                                                                         |
| react-rnd / interact.js / muuri / dockview | —                                                                                                                                             | rnd/interact: single-box drag+resize; muuri: masonry packing; dockview: IDE docking                                                                                                                                                                | —                                | —                                                                                                                                           | different problem shapes; dockview is worth remembering for a future "workspace" archetype, not for a sheet                                     |

### 2.3 Editors — interaction patterns that recur

- **Mode is explicit and global.** Qlik (Edit sheet / Done), Grafana (Edit / Save / Discard / Exit edit), Superset (Edit dashboard), Metabase (pencil). View mode never shows handles; edit mode shows a handle set on the focused tile only, a placeholder ghost while dragging, and auto-scroll near the container edge.
- **Assets on the left, properties on the right.** Qlik's asset panel (sheets, bookmarks, fields, master items, charts, custom objects, navigation links, variables, with search) and a resizable properties panel; Grafana 12's right-side edit pane with an outline; Superset's component palette. brand-ui already has the chrome for both: `ContextRail` + `SideDock` (ADR 0035) and `SchemaForm`.
- **Replace keeps the binding.** Qlik "paste and replace", Metabase "replace card", Superset chart swap: the tile's position, size, title and filter wiring survive a change of visualisation kind.
- **Tile menu in view mode.** Expand/full-screen, table view, export data, snapshot, and (Grafana) "explore", "inspect", "more" — `ChartFrame`'s five features are already this menu; the sheet only has to host it.
- **Selection history is a bar, not a dialog.** Qlik's selections bar (chips per field, clear one, clear all, lock, back, forward, bookmarks) is the single most-copied BI interaction; Grafana's ad-hoc filters and variables bar plays the same role for a time-series product.
- **Interactions are configured per tile pair, coarsely.** Power BI "edit interactions" (filter / highlight / none per target visual), Tableau actions (source → target, filter/highlight/URL), Metabase click behaviour (drill, cross-filter into a dashboard filter, custom destination), Superset per-chart "emit cross-filter" toggle plus filter scoping to tabs/charts.

### 2.4 Design ideas worth borrowing (and what to skip)

Borrow: a serializable spec with a `version` field (Grafana's v1 → v2 migration is the cautionary tale); tile kinds that self-declare capabilities (Superset `behaviors`); four interaction booleans rather than a mode enum inside tiles (nebula `Interactions`); library/master tiles defined once and placed many times (Grafana library panels, Qlik master visualisations); collapsed rows and off-screen tiles that do not render (Grafana lazy loading, since 2019, with an explicit opt-out for PDF export); density-aware tiles; a filter that is itself a tile on the grid (Superset PR #44216, Qlik filter pane); bookmarks as _named selection + optional sheet_ rather than full layout snapshots (Qlik); `visibleWhen` show conditions (Qlik); a "repeat by variable" tile (Grafana) — later, only with a driving use case.

Skip: free-canvas absolute positioning as the default (Power BI, Looker Studio) — it is the reason those tools have separate mobile layouts; nested grids-in-grids beyond one level of container; Grafana's news/dashboard-list panels; storytelling/snapshot slides (Qlik) — a different surface, possibly a later `presentation` archetype.

### 2.5 What the accessibility literature adds

WAI-ARIA has no drag-and-drop pattern; both dnd-kit and Atlassian frame the answer as _a keyboard-operable equivalent of the outcome plus live-region announcements plus focus restoration_. The repo's own rule ("keyboard targets live OUTSIDE the `<svg>`", `ChartDatapointLayer`) is the same principle. Resize has no library-level keyboard story anywhere surveyed: it has to be built here — a focusable resize handle, arrows grow/shrink by one cell, Shift+arrows by four, announcements of the new size in cells — the same shape as dnd-kit's move.

## 3. Where it lives — the package decision

### The constraint

`charts → ui` is the only allowed arrow out of `charts` (`.claude/rules/charts.md`: "charts → ui ONLY; never import `@elabs-ai/components-data`"). A dashboard that can host a `DataTable` or a `ChatShell` looks like it needs `data` and `ai`, which would be sideways imports; a layer-3 package like `process` (ADR 0034) would be the escape hatch — but that is the wrong answer for two reasons: the maintainer wants this in `charts`, and the surface does not _need_ the other packages, it needs a **renderer for a tile kind**, which is an object the host passes in.

### Options considered

| Option                                                                                                                   | Verdict                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A. New layer-3 package `@elabs-ai/components-dashboard` importing `charts`, `data`, `ai`                                 | rejected — ADR 0034 made `process` "the one layer-3 package" for a domain that _is_ a coordinated set across packages; a dashboard is a container, not a domain, and a second layer-3 package invites every future composite to ask for the same                                                                                                                                                 |
| B. Grid engine as a `ui` primitive (`GridLayout`), sheet in `charts`                                                     | attractive — `ui` already has `@dnd-kit/core`; but a layout engine that knows about tiles, selections and specs is not a `ui` primitive, and a generic `GridLayout` with no consumer besides the sheet is speculative generality. If a second consumer appears (a flow workspace, a settings page builder), the pure core moves down at that point — ADR 0012's rule, applied later, on evidence |
| **C. `packages/charts/src/dashboard/` on subpath `@elabs-ai/components-charts/dashboard`, tiles registered by the host** | **chosen** — everything the surface composes is at or below `charts`; the subpath keeps zustand/dnd-kit out of the main barrel (`sideEffects: false` tree-shakes, but a subpath is the documented answer, ADR 0006 condition 2, precedent `./test` and `process/core`); host registration keeps `data`/`ai`/`process` tiles possible without an arrow                                            |
| D. Sheet in `ui`                                                                                                         | rejected — it composes `ChartFrame`, `AutoChart`, `MetricCard`; `ui` cannot import `charts`                                                                                                                                                                                                                                                                                                      |

### What goes where

```
packages/charts/src/dashboard/
  core/                     framework-free (no React import; the `process/core` precedent)
    spec.ts                 DashboardSpec, TileSpec, GridSpec, InteractionSpec, BookmarkSpec, versioning
    validate.ts             validateDashboardSpec → typed errors (no zod; hand-written like ChartSpec)
    layout.ts               grid engine: resolveCollisions, compact, correctBounds, findEmptySlot, stackForNarrow, cellRect
    history.ts              snapshot history over the spec slice (past/future, limit, batch)
    store.ts                createDashboardStore (zustand/vanilla), slices, actions
    selection.ts            SelectionDriver interface + createLocalSelectionDriver (tri-state)
    url.ts                  encode/decode of selection + variables + sheet for share links
    auto-layout.ts          autoLayout(tiles, grid) heuristic (wave 4)
  dashboard-sheet/          DashboardProvider, DashboardSheet, DashboardTile, useDashboard, useTile
  tiles/                    built-in kinds: chart, metric, text, heading, divider, image, container, filter, button
  edit/                     DashboardEditLayer (dnd-kit), resize handles, keyboard, announcements
  chrome/                   DashboardToolbar, DashboardSelectionBar, DashboardAssetPanel, DashboardPropertiesPanel
  index.ts                  subpath barrel
```

`packages/charts/package.json` gains `"./dashboard"` in `exports` and `publishConfig.exports`, `zustand` and `@dnd-kit/core` as regular dependencies (both MIT, both already resolved in the lockfile — zustand 4.5.7 via `@xyflow/react`, `@dnd-kit/core` 6.3.1 via `ui`/`data`; the surface pins zustand `^5`, so the workspace will carry two majors until React Flow moves — acceptable, the stores are instances, not singletons). `tsup.config.ts` gains the entry.

### Primitives that go into the base packages first

The rule from the process track holds: anything a tile needs that another consumer could also need is added to `charts`/`ui` as a general enhancement, not authored inside `dashboard/`.

| Need                                                                                                                                                                             | Where                              | Item                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------ |
| `ChartFrame chrome="tile"`, `interactions`, density tiers (`size` → furniture)                                                                                                   | `charts/chart-frame`               | RM-072                         |
| Selection-state input (`selectionStates`) and shared-hover input (`hoverCategory`) on bar/line/area/pie/ring/scatter/heatmap/treemap containers; `AutoChart` passes them through | `charts/charts`                    | RM-073                         |
| `MetricCard` size tiers + `sparkline` slot                                                                                                                                       | `ui/metric-card` (ADR 0012 home)   | RM-072                         |
| `SchemaForm` used as the properties panel — needs `FormSpec` to accept a `readOnly` group and a `section` layout                                                                 | `ui/schema-form`                   | RM-080 (small, inside touches) |
| Whole-sheet SVG/PNG export composes per-tile `export-svg.ts` output                                                                                                              | `charts/chart-frame/export-svg.ts` | RM-084                         |

## 4. Requirements catalogue

Numbered so roadmap items can cite them. **T** = table stakes, **D** = differentiator.

### Spec

- **R1 (T)** `DashboardSpec` is a versioned, JSON-serialisable object: `version`, `id`, `title`, `grid`, `tiles[]`, `containers[]?`, `filters[]?`, `variables[]?`, `interactions[]?`, `bookmarks[]?`, `view?`, `theme?`. An LLM tool-call can emit it the way it emits `ChartSpec` today.
- **R2 (T)** A tile is `{ id, kind, layout: { x, y, w, h, minW?, minH?, maxW?, maxH?, aspect?, z? }, title?, subtitle?, footnote?, source?, content, visibleWhen?, consumes?, emits? }`. `content` is opaque to the surface and typed by the kind (a `ChartSpec` for `chart`).
- **R3 (T)** `grid` is `{ mode: "fit" | "flow", columns, rows?, rowHeight?, gap, density?: "wide" | "medium" | "narrow" | "custom", extendable?: boolean }` — Qlik's model and Grafana's model in one union. `density` presets resolve to `columns × rows` (`wide` 24×12, `medium` 48×24, `narrow` 72×36); `custom` keeps whatever `columns`/`rows` say (the maintainer's tenant uses 84×42, which is 3.5× and therefore only reachable as `custom`). Presets are integer multiples of 24×12 so a layout authored on a coarser grid converts losslessly to a finer one; `normalizeDashboardSpec` rescales layouts when `density` changes.
- **R4 (D)** The spec validates with typed errors (`validateDashboardSpec`) and normalises (`normalizeDashboardSpec` fills defaults, clamps layouts, drops unknown kinds with a warning).
- **R5 (D)** A JSON Schema for the spec is generated and shipped (`dashboard-spec.schema.json`) so agents can validate before rendering and so `brand-ui dashboard-spec` can print it.

### Layout

- **R6 (T)** `fit` mode: the sheet fills its container, cells scale proportionally, no compaction; a move or resize that would overlap is resolved by _push_ (if there is room) or _reject_ (snap back) — never by silent overlap. `extendable` adds rows in 50 % steps and the sheet scrolls.
- **R7 (T)** `flow` mode: fixed `rowHeight` px, vertical compaction after every change, page scrolls (Grafana/Metabase behaviour).
- **R8 (T)** Below a narrow breakpoint (`useIsMobile`), tiles stack in one column ordered by `y` then `x`, height derived from `h`; edit mode is disabled there.
- **R9 (D)** Optional per-breakpoint layout overrides (`layouts: { md?: …, sm?: … }`) for authors who want a hand-tuned tablet layout; absent overrides fall back to R8.
- **R10 (T)** Off-screen tiles do not render their content (IntersectionObserver, root margin one viewport); a `renderAll` flag forces everything (export, print, tests).
- **R11 (D)** One level of `container` tiles (tabs or stack) hosting child tile ids; children use the container's inner grid.

### State

- **R12 (T)** One store per sheet, created by `DashboardProvider`, exposed via `useDashboard(selector)`; slices: `spec`, `mode`, `selection`, `variables`, `hover`, `tileState`, `focus`, `history`, `dirty`.
- **R13 (T)** Selection is a tri-state per field value (`selected | associated | excluded`, plus `locked` per field) with `clear(field?)`, `back()`, `forward()`, exposed through a `SelectionDriver`; the bundled local driver computes associations by intersecting the rows every consuming tile declares; an external driver replaces it wholesale (R22 pattern from `process`).
- **R14 (T)** Tiles never filter data themselves; they receive `selectionStates` and paint excluded marks dimmed, and they emit `select(field, values, { toggle })` intents.
- **R15 (D)** Hover is a channel `{ field, value } | null`, ephemeral, not persisted, not in history; consuming tiles show a crosshair/highlight (Grafana shared crosshair).
- **R16 (T)** Variables are named scalars (`string | number | boolean | Date | null`) with a declared type and default; tiles read them via `useVariable(name)`; a `variable` tile kind (select/slider/date) writes them.
- **R17 (T)** Undo/redo over the `spec` slice in edit mode, limit 50, batched per gesture; `dirty` flips on the first change and `discard()` restores the entry snapshot.
- **R18 (D)** `onChange(spec)` debounced autosave seam and `onSelectionChange(state)`; persistence is the host's (D5).
- **R19 (D)** Bookmarks: named `{ selection, variables, sheetId? }` snapshots stored in the spec or supplied by the host; `applyBookmark(id)`.
- **R20 (D)** URL codec: `encodeDashboardState` / `decodeDashboardState` for selection + variables + bookmark (compact, URL-safe); the host wires it to its router (nuqs, TanStack Router, `URLSearchParams`).

### Tiles

- **R21 (T)** A tile kind is `{ kind, label, icon, component, defaultSize, minSize, maxSize?, aspect?, capabilities: { emitsSelection, consumesSelection, consumesHover, emitsHover, resizable, exportable }, configForm: FormSpec, defaultContent, migrate?(content, fromVersion) }`; kinds are registered through the provider's `tiles` map; unknown kinds render a `ui/StatePanel` fallback with the kind name.
- **R22 (T)** `DashboardTileProps` = `{ tile, size: { w, h, width, height }, mode, interactions: { passive, active, select, edit }, selection, hover, variables, emit: { select, hover, setVariable, navigate, openBookmark }, density }` — the nebula/Grafana union.
- **R23 (T)** Built-in kinds: `chart` (`ChartSpec` inside `ChartFrame chrome="tile"`), `metric` (`MetricCard`, optional sparkline), `text` (plain + minimal inline markup), `heading`, `divider`, `image`, `container` (tabs/stack), `filter` (field values list with search, single/multi, shows tri-state colours), `button` (navigate / apply bookmark / clear selections / set variable / host action), `variable` (select, slider, date).
- **R24 (D)** `table` (`data/DataTable`), `chat` (`ai/ChatShell`) and `process-map` are **registry blocks** (`dashboard-tile-table`, …) the host copies in — the package cannot import them.
- **R25 (D)** Master tiles: `spec.library[]` of tile definitions; a tile with `ref: libraryId` inherits content and config, overriding only layout/title.

### View mode

- **R26 (T)** Tile header with title/subtitle, kebab menu (expand, table view, CSV, SVG/PNG, copy link to tile, and host-supplied actions); footnote/source row per `ChartFrame`'s card contract.
- **R27 (T)** `DashboardSelectionBar`: chips per field (values, count), clear one, clear all, lock/unlock, back/forward, bookmark menu.
- **R28 (T)** Expand a tile to a modal (`ui/ExpandDialog` via `ChartFrame`'s existing expand); keyboard reachable.
- **R29 (D)** Presentation mode: hide chrome, optional cycle through sheets every _n_ seconds, optional auto-refresh seam (`onRefresh` callback, the surface never fetches).
- **R30 (D)** Sheet export to PNG/SVG/PDF-ready SVG composing every tile's export at its layout rect, with title and source rows; `renderAll` forced.
- **R31 (D)** `visibleWhen`: a small safe expression over variables and selection counts (`selection.count('Region') > 0 && variables.showDetail`), no `eval`.

### Edit mode

- **R32 (T)** Drag to move (handle = tile header), resize from corner/edge handles, both snapping to cells, with a placeholder ghost, auto-scroll, `motion-reduce` respected; pointer, touch and **keyboard** (Enter/Space lifts, arrows move by one cell, Shift+arrows by four, Escape cancels; resize handle focusable with the same keys); live-region announcements in cells ("Revenue by quarter moved to column 5, row 2, 8 by 4").
- **R33 (T)** Toolbar: mode switch, undo, redo, add tile (opens asset panel), grid settings, save/discard with dirty prompt (`ui/ConfirmDialog`), keyboard-shortcut sheet (`ui/KeyboardShortcuts`).
- **R34 (T)** Asset panel (left, `SideDock`): registered tile kinds and master tiles, searchable, drag onto the grid or click to place in the first empty slot (`findEmptySlot`).
- **R35 (T)** Properties panel (right, `SideDock`): the focused tile's `configForm` rendered by `SchemaForm`, plus common fields (title, subtitle, footnote, source, `visibleWhen`, consumes/emits toggles, min/max size); sheet properties when nothing is focused (grid mode, columns, rows, density, theme).
- **R36 (T)** Tile operations: duplicate, delete (with undo), replace kind (keeps layout, title, wiring; migrates content when the kinds share a `ChartSpec`), bring forward/back (z, `fit` mode only), copy/paste within and across sheets (clipboard JSON), multi-select with Shift-click and marquee, align/distribute for multi-select.
- **R37 (D)** Interactions editor: per tile, which fields it emits into and which it consumes; per pair, `filter | highlight | none` (Power BI); drill-through target (sheet id + carry fields); shown as a matrix when the sheet has ≤ 12 tiles, as a list otherwise.

### Agent-facing

- **R38 (D)** `autoLayout(tiles, grid)`: place unpositioned tiles by kind (metrics in the top row at 4×2, filters in a left column, charts in 8×4 or 12×4 by data shape, tables full-width at the bottom), deterministic, tested against golden layouts.
- **R39 (D)** `brand-ui dashboard-spec` (CLI) prints the schema, validates a file, and lists registered kinds; the skill's `chart-for` reference gains a "sheet-for" sibling (which tiles for which questions).
- **R40 (D)** Test double: `@elabs-ai/components-charts/dashboard/test` asserts the spec contract the way `assertChartContract` does (invalid spec throws `DashboardSpecError`), never a no-op mock.

## 5. Architecture

### 5.1 Core (`dashboard/core`, framework-free)

```ts
// spec.ts
export interface DashboardSpec {
  version: 1;
  id: string;
  title?: string;
  description?: string;
  grid: GridSpec;
  tiles: TileSpec[];
  containers?: ContainerSpec[];
  library?: LibraryTileSpec[];
  filters?: FilterSpec[]; // author-defined filter fields (label, field, kind, default)
  variables?: VariableSpec[];
  interactions?: InteractionSpec[];
  bookmarks?: BookmarkSpec[];
  view?: { mode?: "view" | "edit"; presentation?: { cycleMs?: number }; refreshMs?: number };
  theme?: { family?: string; mode?: "light" | "dark"; overrides?: Record<string, string> }; // ADR 0031/0036
  layouts?: Partial<Record<"md" | "sm", TileLayout[]>>; // R9
}

export interface GridSpec {
  mode: "fit" | "flow";
  columns: number; // default 24
  rows?: number; // fit: default 12
  rowHeight?: number; // flow: default 30 (px)
  gap?: number; // cells gap in px, default from --spacing token
  density?: "narrow" | "medium" | "wide";
  extendable?: boolean; // fit only
}

export interface TileLayout {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  aspect?: number;
  z?: number;
}

export interface TileSpec<TContent = unknown> {
  id: string;
  kind: string;
  layout: Omit<TileLayout, "id">;
  ref?: string; // library tile id (R25)
  title?: string;
  subtitle?: string;
  footnote?: string;
  source?: string;
  content: TContent;
  visibleWhen?: string; // R31
  consumes?: { selection?: string[] | true; hover?: boolean; variables?: string[] };
  emits?: { selection?: string[]; hover?: boolean };
  container?: { id: string; slot?: string };
}

export interface InteractionSpec {
  from: string; // tile id
  to: string | "*"; // tile id or all
  effect: "filter" | "highlight" | "none" | { drill: { sheetId: string; carry?: string[] } };
}
```

```ts
// layout.ts — every function is pure and returns new arrays
export function correctBounds(layout: TileLayout[], grid: GridSpec): TileLayout[];
export function resolveCollisions(
  layout: TileLayout[],
  moved: TileLayout,
  grid: GridSpec,
  strategy: "push" | "reject" | "swap",
): { layout: TileLayout[]; ok: boolean };
export function compact(layout: TileLayout[], grid: GridSpec): TileLayout[]; // no-op in fit
export function findEmptySlot(
  layout: TileLayout[],
  size: { w: number; h: number },
  grid: GridSpec,
): { x: number; y: number } | null;
export function stackForNarrow(layout: TileLayout[]): TileLayout[]; // one column, y-then-x order
export function cellRect(
  cell: TileLayout,
  grid: GridSpec,
  container: { width: number; height: number },
): DOMRectReadOnly;
export function extendRows(grid: GridSpec): GridSpec; // +50 %
```

```ts
// selection.ts — the seam
export type SelectionState = "selected" | "associated" | "excluded";
export interface SelectionSnapshot {
  fields: Record<string, { values: Array<string | number>; locked?: boolean }>;
  states(field: string, value: unknown): SelectionState;
  count(field?: string): number;
}
export interface SelectionDriver {
  getSnapshot(): SelectionSnapshot;
  subscribe(listener: () => void): () => void;
  select(
    field: string,
    values: Array<string | number>,
    opts?: { toggle?: boolean; replace?: boolean },
  ): void;
  clear(field?: string): void;
  lock(field: string, locked: boolean): void;
  back(): void;
  forward(): void;
  canBack(): boolean;
  canForward(): boolean;
  register?(tileId: string, rows: Record<string, unknown>[], fields: string[]): () => void; // local driver only
}
export function createLocalSelectionDriver(): SelectionDriver;
```

```ts
// store.ts
export interface DashboardState {
  spec: DashboardSpec;
  mode: "view" | "edit";
  selection: SelectionSnapshot;     // mirrored from the driver
  variables: Record<string, VariableValue>;
  hover: { field: string; value: unknown; tileId: string } | null;
  tileState: Record<string, Record<string, unknown>>;   // per-tile view state (tab, sort, expanded)
  focus: string[];                  // edit-mode selected tile ids
  dirty: boolean;
  history: { past: number; future: number };
  actions: {
    setMode(mode): void; setSpec(spec): void; patchTile(id, patch): void; moveTile(id, xy): void; resizeTile(id, wh): void;
    addTile(tile, at?): string; removeTile(id): void; duplicateTile(id): string; replaceTile(id, kind, content?): void;
    setFocus(ids): void; undo(): void; redo(): void; discard(): void; markSaved(): void;
    select(...): void; clearSelection(field?): void; setHover(h): void; setVariable(name, value): void; applyBookmark(id): void;
  };
}
export function createDashboardStore(init: { spec: DashboardSpec; driver?: SelectionDriver; mode?: "view" | "edit" }): StoreApi<DashboardState>;
```

Why zustand and not `useReducer` + `useSyncExternalStore`: the store must be readable by non-React code (the URL codec, the export routine, a host's engine adapter, the CLI's validator tests), must support per-slice subscriptions so a hover event does not re-render forty tiles (`subscribeWithSelector`), and must be an _instance_ a host can create and hand in. Zustand vanilla is exactly that in ~1 kB; a hand-rolled equivalent is the same code with fewer tests. It is a regular dependency, not a peer: two majors coexisting is harmless because nothing is global.

### 5.2 Components (React)

- `DashboardProvider({ spec, driver?, tiles, mode?, onChange?, onSelectionChange?, children })` — creates the store once, provides it and the kind registry.
- `DashboardSheet({ className, renderAll?, chrome?: boolean })` — measures its container (`react-use-measure`, already a dependency), computes `cellRect` per tile, renders `DashboardTile`s, mounts `DashboardEditLayer` in edit mode; `role="region"` with the sheet title, tiles are `role="group"` with `aria-labelledby` the header; a roving tab stop across tiles in view mode.
- `DashboardTile` — header, body (`IntersectionObserver`-gated), footer, menu; resolves `interactions` from mode (view: `{ passive: true, active: true, select: true, edit: false }`; edit: `{ passive: false, active: false, select: false, edit: true }`), and `density` from cell size (`xs` < 4×2 cells, `sm`, `md`, `lg`).
- `DashboardEditLayer` — `DndContext` with `PointerSensor`, `TouchSensor`, `KeyboardSensor` (custom `coordinateGetter` moving in cell units), `DragOverlay` for the ghost, `announcements` composed from tile titles and cell positions; resize handles are separate focusable `<button>`s per tile with their own key handling and the same announcer.
- `DashboardToolbar`, `DashboardSelectionBar`, `DashboardAssetPanel`, `DashboardPropertiesPanel` — `ui/Toolbar`, `ui/Badge`, `ui/SideDock`, `ui/SchemaForm`.
- Hooks: `useDashboard(selector)`, `useTile(id)`, `useSelection(field?)`, `useVariable(name)`, `useHover()`, `useDashboardActions()`.

### 5.3 Selection and filtering model

Identical in spirit to `process`'s §5.3 and R22, generalised: a tile that `consumes.selection` receives `selectionStates(field, value)` and paints; a tile that `emits.selection` calls `emit.select`. In the local driver, each consuming tile registers its rows and fields once (`register`), and the driver computes `associated`/`excluded` by intersection across registered tiles when a selection changes — good enough for prototype-scale data (≤ 100 k rows across tiles; measured in the fixture tests), and swapped out wholesale by an engine driver for anything larger. `InteractionSpec` narrows the default "every emitter reaches every consumer": `effect: "highlight"` maps to hover-style dimming without filtering; `"none"` disconnects; `drill` navigates.

### 5.4 Encoding rules (to be written into `.claude/rules/dashboard.md`)

- The selection colours are the tri-state tokens the process track introduced (`--selection-selected`, `--selection-associated`, `--selection-excluded` — verify names in `themes.css` at RM-069; if they are process-scoped, promote them); never a fourth ink.
- Edit-mode chrome (handles, ghost, marquee) paints in `--ring`/`--accent` at full opacity, one weight; the ghost is a dashed hairline (`CHART_HAIRLINE_WIDTH`), never a translucent fill over live charts.
- Density tiers are the only way a tile adapts: a tile never measures its own text to decide what to hide.
- No tile owns fetching, timers or routing; `onRefresh`, `navigate` and `onChange` are host callbacks (D5).
- A sheet with more than 12 tiles gets a dev warning (the charts rule's "max 6 charts/page" widened to a sheet).

### 5.5 Archetype

`docs/playbooks/dashboard.md` is rewritten around the sheet: the existing hand-composed template stays as "static dashboard" (a page the developer lays out), and the sheet becomes "user-editable dashboard" (a spec the user or an agent lays out). The registry gains `dashboard-sheet-app` (shell + sheet + selection bar + asset/properties panels wired) and `dashboard-tile-table` / `dashboard-tile-chat` (the two cross-package tiles as copy-own blocks).

## 6. Enhancements the hosted components need

| Component                                                                              | Enhancement                                                                                                                                                                                                | Why the sheet needs it                                                                                             | Who else benefits                                            |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `ChartFrame`                                                                           | `chrome="card" \| "tile" \| "bare"` — `tile` renders no outer card and takes `headerSlot`/`menuSlot` from the sheet                                                                                        | the sheet owns the header (drag handle, focus ring, kebab) and must not double-wrap                                | any host embedding a chart in its own card                   |
| `ChartFrame`                                                                           | `interactions: { passive, active, select, edit }` propagated through `ChartConfigProvider` to tooltips, brush, datapoint layer                                                                             | edit mode must switch tooltips and selections off without unmounting; a screenshot/export must switch them off too | Storybook screenshots, PDF export, kiosk                     |
| `ChartFrame` + families                                                                | density tiers `density="xs" \| "sm" \| "md" \| "lg"` — `xs`: no axes labels/legend/source, title only; `sm`: one axis, legend hidden; `md`: default; `lg`: default + values                                | a 4×2-cell chart today draws a legend over its own bars                                                            | `MetricGrid`, `BentoGrid`, mobile layouts                    |
| Chart families (bar, line, area, pie, ring, scatter, heatmap, treemap, unit, dumbbell) | `selectionStates?: (category, seriesKey?) => SelectionState` + `dimExcluded` rendering (opacity via token, plus a non-hue channel per the diverging rule)                                                  | R14 — the input half of #349's output contract                                                                     | `process` (the same tri-state), any cross-filtered page      |
| Chart families with a category axis                                                    | `hoverCategory?: string \| number \| Date \| null` + `onHoverCategory` (shared crosshair)                                                                                                                  | R15                                                                                                                | small multiples, `BumpChart` rank strips                     |
| `AutoChart`                                                                            | passes `selectionStates`, `hoverCategory`, `density`, `interactions` through; `ChartSpec` gains optional `fields: { category?: string; series?: string }` naming which spec fields map to selection fields | the chart tile is `AutoChart`                                                                                      | agents emitting cross-filterable charts                      |
| `MetricCard` (ui)                                                                      | `size="sm" \| "md" \| "lg"` tiers; `sparkline` slot (rendered by charts' `Sparkline` through a render prop, so `ui` does not import `charts`)                                                              | the metric tile in a 4×2 cell                                                                                      | KPI strips everywhere (`ProcessKpiStrip` already fakes this) |
| `SchemaForm` (ui)                                                                      | `FormSpec` sections + `readOnly` fields                                                                                                                                                                    | properties panel                                                                                                   | any settings screen                                          |
| `export-svg.ts`                                                                        | `composeSvg(parts: { svg, rect }[])`                                                                                                                                                                       | sheet export                                                                                                       | report generation                                            |
| `SideDock` / `ContextRail`                                                             | verify a left + right dock can coexist in one `AppShell` (ADR 0035 describes one)                                                                                                                          | asset panel left, properties right                                                                                 | IDE-like archetypes                                          |

## 7. Embedding in BI platforms

A Qlik Cloud mashup renders the same `DashboardSheet` with an engine driver: `select` calls `selectValues` on the field, `subscribe` listens to the app's selection object (`SessionObject` with `qSelectionObjectDef`), `states` reads `qState` per value — the surface never learns what enigma is. Tiles that are nebula.js visualisations are registered as a `qlik-object` kind whose `component` mounts `embed.render({ element, id })` and forwards `interactions` as nebula `interactions` one-to-one (the field names were chosen to match). Grafana-style hosts map `variables` to template variables and `hover` to the shared crosshair. The URL codec's output is what a host puts behind a share button.

## 8. Roadmap

Twenty items, RM-069 … RM-088, five waves; the item table, waves diagram, protocol and orchestrator prompt are in `roadmap/dashboard-surface/README.md` and `ORCHESTRATOR-PROMPT.md`. Critical path: RM-069 (ADR + scaffold) → RM-070 (core spec + layout) → RM-071 (store + driver) → RM-074 (`DashboardSheet` view) → RM-078 (edit layer) → RM-082 (interaction graph) → RM-086 (agent spec tooling) → RM-088 (closure), about 14–16 agent-days. RM-072 and RM-073 (the `charts` enhancements) run beside wave 0 and are consumed by RM-075.

## 9. Risks and open questions

1. **Two zustand majors in the workspace** (4.5.7 under `@xyflow/react`, 5.x here). Harmless at runtime; `pnpm dedupe` will not collapse them. Revisit when React Flow bumps.
2. **`fit` mode and text.** Scaling cells with the viewport means a 24-column sheet at 1024 px has 42 px cells; a metric tile at 4×2 is 168×84 px. Density tiers must be honest about the floor (`xs` shows a value and a label, nothing else) — the `charts-honesty` gate should gain a "no furniture below density floor" rule.
3. **Local selection driver at scale.** Intersection across tiles is O(rows) per change; the fixture test caps it at 100 k rows and 12 tiles under 16 ms on the CI runner; above that the docs say "bring a driver".
4. **Keyboard resize has no prior art** in any surveyed library; the announcement wording and the handle focus order need the accessibility reviewer in the wave-2 review lane before the API freezes.
5. **`visibleWhen` expressions** are a tiny language; keep it to `&& || ! > < >= <= == !=`, identifiers and literals, evaluated by a hand-written parser, no `Function`. The CSP rule (`docs/CSP-AND-NETWORK.md`) forbids `eval` anyway.
6. **Subpath + Storybook.** The docs app imports `@elabs-ai/components-charts/dashboard`; `pnpm gen:check` and the manifest generator must learn the subpath (the `process/core` precedent shows how).
7. **Density tiers are a `charts`-wide API change** touching ten containers (RM-073); land it behind an optional prop with the default equal to today's rendering, gated by the existing visual-regression stories.
8. **Containers (R11)** add a second grid level; ship them as `tabs` only in wave 1, `stack` later, and never nest a container in a container (validator error).
9. **Text tile rich text.** `charts` cannot import `ai`'s markdown renderer; the built-in `text` tile supports bold/italic/link/line breaks through a 60-line inline-markup parser; anything richer is a host-registered kind.
10. **Undo granularity.** Batch per gesture (drag, resize, form edit blur), not per keystroke; the properties panel commits on blur/Enter.

## Sources

Product docs and code:

- Qlik Cloud help, Changing sheet layouts — Responsive vs Custom (300–4,000 px), grid spacing Wide/Medium/Narrow/Custom, Extend sheet (+50 % per step), PDF sizes 1680×1120: https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Sheets/changing-sheet-layout.htm
- Qlik help, Sheet view (asset panel, properties panel, cut/copy/paste-and-replace): https://help.qlik.com/en-US/sense/May2026/Subsystems/Hub/Content/Sense_Hub/Sheets/sheet-view.htm
- Qlik Community, Engine API sheet height for extended sheets — `columns`, `rows`, `gridResolution`, `cells[].col/row/colspan/rowspan/bounds`, `height` scale factor, `pxWidth/pxHeight` _(secondary)_: https://community.qlik.com/t5/Integration-Extension-APIs/Engine-API-get-sheet-height-for-extended-sheets/m-p/2009896
- Qlik help, Associative selection model (selected / possible / alternative / excluded): https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Selections/associative-selection-model.htm
- Qlik help, Layout container and Tab container: https://help.qlik.com/en-US/sense/May2026/Subsystems/Hub/Content/Sense_Hub/Visualizations/DashboardBundle/layout-container.htm · https://help.qlik.com/en-US/sense/November2025/Subsystems/Hub/Content/Sense_Hub/Visualizations/Container/container-object.htm
- Qlik nebula.js stardust API — hooks (`useLayout`, `useSelections`, `useConstraints`, `useInteractionState`, `useOptions`, `useEmitter`, `useKeyboard`, `useRenderState`, …), `Constraints` and `Interactions` `{ passive, active, select, edit }`: https://qlik.dev/apis/javascript/nebula-js/
- Qlik nebula.js bookmarks (selection state + optional sheet): https://qlik.dev/embed/nebula/customize/bookmarks/interacting-with-bookmarks/
- Grafana `public/app/core/constants.ts` — `GRID_COLUMN_COUNT = 24`, `GRID_CELL_HEIGHT = 30`, `GRID_CELL_VMARGIN = 8`, `MIN_PANEL_HEIGHT = GRID_CELL_HEIGHT * 3`: https://github.com/grafana/grafana/blob/main/public/app/core/constants.ts
- Grafana `DashboardGrid.tsx` (react-grid-layout host): https://github.com/grafana/grafana/blob/main/public/app/features/dashboard/dashgrid/DashboardGrid.tsx
- Grafana Scenes layouts (24 columns, CSS grid, responsive collapse below `md`): https://grafana.com/developers/scenes/scene-layout
- Grafana panel overview (library panels, rows, repeat by variable, text/news/canvas panels): https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/panel-overview/
- Grafana dashboard JSON model and schema v2 work: https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/view-dashboard-json-model/ · https://github.com/grafana/grafana/issues/123320
- Grafana variables and URL sync (`var-<name>=`): https://grafana.com/docs/grafana/latest/visualizations/dashboards/variables/
- Grafana lazy loading of panels (2019) and the reporting opt-out (#98065): https://grafana.com/blog/2019/07/08/a-closer-look-at-lazy-loading-grafana-dashboards/ · https://github.com/grafana/grafana/pull/98065
- Grafana `PanelProps` type: https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/types/panel.ts
- Grafana 12.4 dynamic dashboards (outline, tabs, conditional rendering, auto grid) _(secondary)_: https://alternativeto.net/news/2026/2/grafana-12-4-brings-dynamic-dashboards-git-sync-and-faster-dashboard-setup
- Apache Superset grid layout components (12 columns): https://github.com/apache/superset/blob/master/docs/components/layout-components/grid.md · native filters on the canvas PR #44216: https://github.com/apache/superset/pull/44216 · cross-filter architecture _(secondary)_: https://www.padiso.co/blog/apache-superset-cross-filter-architecture-patterns/ · plugin `behaviors` (Preset): https://preset.io/blog/enhancing-superset-visualization-plugins-part-1/ · export/import as code: https://superset.apache.org/admin-docs/configuration/importing-exporting-datasources/
- Metabase 18-column grid discussion (#6218): https://github.com/metabase/metabase/issues/6218 · dashboard filters and click behaviour: https://www.metabase.com/docs/latest/dashboards/filters · https://www.metabase.com/learn/metabase-basics/querying-and-dashboards/dashboards/cross-filtering · actions: https://www.metabase.com/docs/latest/dashboards/actions
- Power BI edit interactions: https://learn.microsoft.com/en-us/power-bi/create-reports/service-reports-visual-interactions · bookmarks and navigators: https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-bookmarks · https://learn.microsoft.com/en-us/power-bi/create-reports/button-navigators
- Tableau actions and tiled vs floating: https://help.tableau.com/current/pro/desktop/en-us/actions.htm · https://www.tableau.com/blog/dashboard-design-tiled-vs-floating-layouts
- Lightdash dashboards as code (tiles `x/y/w/h`, `filters[].tileTargets`, `tabs`): https://docs.lightdash.com/guides/developer/dashboards-as-code
- Databricks AI/BI Genie Code dashboard authoring: https://docs.databricks.com/aws/en/dashboards/manage/dashboard-agent
- Vega-Lite selection parameters (point/interval, `bind`, `resolve`): https://vega.github.io/vega-lite/docs/selection.html

Libraries:

- react-grid-layout CHANGELOG (2.0.0 2025-12-09 rewrite, 2.1.0 compactors, 2.2.x) and README: https://github.com/react-grid-layout/react-grid-layout/blob/master/CHANGELOG.md · https://github.com/react-grid-layout/react-grid-layout/blob/master/README.md · v2 RFC: https://github.com/react-grid-layout/react-grid-layout/blob/master/rfcs/0001-v2-typescript-rewrite.md · React 19 issue #2045 and fork: https://github.com/react-grid-layout/react-grid-layout/issues/2045 · https://github.com/Censkh/react-grid-layout-19
- gridstack.js `GridStackEngine` API: https://gridstackjs.com/doc/html/classes/GridStackEngine.html · repo: https://github.com/gridstack/gridstack.js/
- dnd-kit accessibility (KeyboardSensor, announcements, screen-reader instructions): https://dndkit.com/legacy/guides/accessibility/ · grid discussion #1560: https://github.com/clauderic/dnd-kit/discussions/1560
- pragmatic-drag-and-drop accessibility guidelines (opt-in): https://atlassian.design/components/pragmatic-drag-and-drop/accessibility-guidelines
- dockview (docking layouts, adjacent problem): https://github.com/dockview/dockview
- zustand `package.json` (5.0.x, MIT, `react >= 18`): https://github.com/pmndrs/zustand/blob/main/package.json · `subscribeWithSelector`: https://zustand.docs.pmnd.rs/reference/middlewares/subscribe-with-selector · store-per-instance via context (TkDodo): https://tkdodo.eu/blog/zustand-and-react-context · React 19 discussion #2842: https://github.com/pmndrs/zustand/discussions/2842
- zundo (temporal middleware, < 700 B): https://github.com/charkour/zundo
- nuqs (URL state): https://github.com/47ng/nuqs
- Brushing and linking (Observable): https://observablehq.com/blog/linked-brushing

Repo (checked against source on 2026-09-16): `packages/charts/src/chart-frame/chart-frame.tsx` (`ChartFrameProps`, `features`, `onExport`, `source`), `packages/charts/src/charts/chart-datapoint.ts` (#349 contract), `packages/charts/src/auto-chart/chart-spec.ts`, `packages/charts/package.json` (exports `.`/`./test`, deps), `packages/ui/src/components/{bento-grid,schema-form,side-dock,context-rail,resizable,expand-dialog,keyboard-shortcuts}`, `packages/ui/src/index.ts` (`useIsMobile`, `downloadBlob`), `roadmap/process-mining/RM-052-*.md` (tri-state, R22), `docs/ADR/0034-process-package-third-layer.md`, `docs/ADR/0032-optional-peer-dependency-policy.md`, `docs/ADR/0035-context-rail-and-side-dock.md`, `docs/playbooks/dashboard.md`, `pnpm-lock.yaml` (zustand 4.5.7, `@dnd-kit/core` 6.3.1).
