# Dashboard pack rebuild — what users expect from a BI sheet editor, and what changed

Date: 2026-09-22 · Scope: `packages/charts/src/dashboard/` (+ `ui/Toolbar`, `ChartFrame`)
· Branch: `feat/dashboard-pack-rebuild`

## 1. Why

The dashboard surface (ADR 0037) shipped with a solid data model — `DashboardSpec`, the
framework-free engine, one store, undo/redo, drivers, interactions — but the authoring
experience was rated "barely works": placement failed, resizing was clumsy, edit mode
looked unfinished, toolbar and menus were flat lists. This pass drove the real Storybook
in a browser (Playwright) before touching code, and found the causes below.

### What was actually broken (observed, not guessed)

| Symptom                                                                        | Root cause                                                                                                                                                            | Fix                                                                                                                                                                       |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Placement doesn't work" — almost every drop on a full `fit` sheet was refused | `editStrategy()` returned `reject` for `fit` grids; `resolveCollisions`' `fit` push scanned right-then-down from the collider's own cell and rarely found room        | `push` for both grid models; a new direction-aware `nearestFreeSpot` displacement for bounded grids; swap fallback; auto-extend of `extendable` sheets during the gesture |
| The dragged tile never moved — only a dashed ghost                             | The tile drew at its snapped preview cell, which equalled its origin while the drop was rejected                                                                      | The tile follows the pointer 1:1 (`session.pointer`); resize edges follow the pointer; the ghost shows the snapped landing cell                                           |
| Resizing "ugly to use"                                                         | 8 px squares centred inside the tile edge, no live feedback, no size cue                                                                                              | Figma/Qlik-style grips (corner squares, edge bars) centred ON the edge with 24 px hit targets, hover/active fill, live pixel resize, size badge only while a gesture runs |
| Toolbar separators rendered as long dashes                                     | `ui/Toolbar`'s `ToolbarSeparator` had its `data-orientation` classes inverted (Radix flips the separator's orientation relative to the toolbar)                       | Fixed in `ui` — every toolbar in the library benefits                                                                                                                     |
| Edit mode "looks terrible"                                                     | No grid, no hover affordance, a boxed toolbar with disabled grey labels, kebab hiding every edit action behind "Tile actions…"                                        | Dotted cell grid (toggle), hover ring, new toolbar grammar, edit hover chrome (Duplicate · Delete · ⋮) opening the full context menu with icons and shortcuts             |
| Asset panel clipped after ~8 rows, tabs overflowed                             | `cmdk`'s default 300 px list height; a flex `TabsList`                                                                                                                | Full-height scrolling list, equal-width tabs, rows with icon + one-line description + grip                                                                                |
| Untitled two-row tiles showed no number (KPI) and one-row headings were blank  | `ChartFrame chrome="tile"` spent a whole header row on the kebab even with no title; metric tile used the `md` card at `sm` density; heading/divider had card padding | Floating menu on header-less frames (a generic `ChartFrame` seam), `sm` metric card at `sm` density, `capabilities.padding` / `capabilities.surface` for banner tiles     |

## 2. What users expect (research summary)

Sources: Qlik Sense, Tableau, Power BI, Looker Studio, Metabase, Apache Superset, Grafana
docs and their community/idea forums; react-grid-layout and Retool as React baselines.
Full source list at the end.

**Two layout families exist.** Cell grids with compaction (Grafana 24 columns ~30 px rows,
Superset 12 columns, Metabase, react-grid-layout 12 columns/150 px) and absolute canvases
with guides (Power BI 1280×720 with gridlines + snap + smart guides + align/distribute,
Tableau tiled/floating with pixel x/y/w/h and arrow = 1 px / Shift+arrow = 10 px, Qlik's
responsive 24-ish grid with Wide/Medium/Narrow spacing and "extend sheet" in 50 % steps).
brand-ui's `fit`/`flow` union already covers both; what was missing was the _behaviour_
users associate with either.

**Interaction patterns rated "good":**

1. Ghost placeholder at the snapped destination while the tile itself follows the cursor.
2. Push/displace that is predictable: neighbours move _away from the arriving tile_, into
   the nearest free cells; compaction is a choice (`flow`), not a law (`fit`).
3. Alignment guides / align + distribute for multi-selections; keyboard nudging with a
   coarse step (Shift); Escape cancels; one undo entry per gesture.
4. Multi-select (Shift-click, marquee) with group move, duplicate, delete.
5. Lock (`static`) tiles that never move and are never pushed.
6. Auto-derived mobile layout with author override, kept as named breakpoint layouts.

**The chrome BI tools converge on:** `[View | Edit]` · undo/redo · Add · Grid · Layout
(tidy up, align, breakpoint target) · save state · panel toggles · export · help. Tile
hover chrome differs by mode: view = expand/export/menu; edit = duplicate/delete/menu.
Properties panels are Data → Appearance → Interactions → Advanced accordions, plus a
Layout block with numeric x/y/w/h and a lock.

**Recurring complaints a component library can fix:** grid too coarse (12 columns —
Retool, Superset #6776/#16140); inconsistent resize semantics (Superset #13240); no
multi-select / bulk edit (Grafana #7261, #4100); copy/paste across dashboards (Grafana
#1004, #23762, #10248); alignment precision (Fabric Ideas); compaction moving tiles the
author never touched (react-grid-layout builders); fixed canvas vs modern monitors
(Metabase #10364); mobile as an afterthought; no annotations.

**Table stakes vs differentiators (2025/26)** — see §4 for the coverage table.

## 3. What changed

### Engine (`core/`)

- `TileLayout.static` — locked tiles: never moved/resized by the edit layer, never
  relocated by a push (a move that would overlap one is rejected), obstacles for `flow`
  compaction. In the JSON Schema and the validator's passthrough.
- `resolveCollisions` `push` for `fit`: `nearestFreeSpot` — Manhattan distance from the
  collider's own cell (vertical steps ×1.25), +3 for moving against the drag direction,
  down-then-right when there is no direction (a resize). Deterministic ties.
- `baseRowsOf(grid)` — the rows one viewport of a `fit` sheet is divided into, so
  `extendRows` never shrinks cells: the sheet grows past its host and scrolls (Qlik's
  "extend sheet").
- `DashboardUiState.showGrid` (default `true`).

### Edit layer (`edit/`)

- `editStrategy()` → `push` for both models; `previewPlacement` tries push → swap →
  (extendable) extend rows, twice; a refused drop still previews the tile where it would
  land, with the red ghost.
- `DashboardEditSession.pointer` (raw pixel delta) and `.grid` (grown grid): the tile
  follows the cursor, a resize edge follows the cursor, the grown grid commits with the drop
  (with `density: "custom"` so the normaliser keeps the rows).
- `gestureBounds()` lets a drag reach one extension band below an extendable sheet.
- Dotted cell grid painted from `--border-strong` in the gaps; resize grips restyled and
  centred on the edge; size badge only during a gesture; lock badge for `static` tiles;
  handles only on a single selection (a group shows outlines and the align toolbar);
  align toolbar flips inside the selection when there is no room above.
- `useTileOps(tileId)` — the ONE set of edit operations shared by the context menu, the
  header hover chrome and the toolbar's selection actions; new ops: `toggleLock`,
  `openProperties`. Context menu got icons, shortcut hints (`aria-hidden`), Properties,
  Lock/Unlock.

### Tile (`dashboard-sheet/`)

- `movable` vs `editable`: a locked tile keeps focus, context menu and properties.
- Edit-mode visuals: `select-none`, hover ring, the gesturing tile lifted (`shadow-lg`,
  no transition, pointer-events off so the drop lands on the sheet).
- Untitled tiles show a muted "Untitled … tile" placeholder header in edit mode only.
- `DashboardTileKind.description`, `capabilities.padding` (`default | compact | none`),
  `capabilities.surface` (`card | plain`; plain tiles get a dashed hairline in edit mode).
  Built-ins: icons + descriptions everywhere; heading/divider are `plain`.
- Empty-sheet state (`StatePanel`) in both modes.

### Chrome (`chrome/`)

- `DashboardToolbar` rebuilt: `[View | Edit]` segmented · undo/redo · (edit) Add · Grid
  (with a Show grid switch and a live "24 × 12 cells" summary) · Layout menu (Tidy up via
  `autoLayout`, Select all, Duplicate/Delete selection, Layout for Desktop/Tablet/Phone,
  Show grid) · flexible gap · "● Unsaved changes" / "✓ All changes saved" · Discard · Save
  (primary) · Assets / Properties toggles (pressed state) · Export (icon-only while editing)
  · ?. New `features` flags: `layout`, `panels`, `export`.
- `DashboardSelectionBar`: a flat row under the toolbar with a filter glyph, chips, a
  "No selections" empty state, Clear all / step back-forward / Bookmarks right-aligned.
- `DashboardAssetPanel`: equal-width tabs, full-height scrolling list, rows with icon,
  label, description (`aria-description`) and a grip; icon in the drag overlay; auto-scroll
  off (the drop is resolved by the pointer's viewport point).
- `DashboardPropertiesPanel`: a Layout section (Column/Row/Width/Height as 1-based cells,
  routed through `moveTile`/`resizeTile` with a "No room" toast) and a Lock switch.

### Shared

- `ui/Toolbar` separator orientation fix.
- `ChartFrame chrome="tile"`: floating menu when there is no header content.
- Locale keys under `charts.dashboard.edit.*`, `.toolbar.*`, `.properties.*`.

## 4. Coverage against the research

| Feature                                                                         | Status                                                                                  |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Grid placement with snap, ghost, 8 handles, min sizes                           | ✅ (rebuilt)                                                                            |
| Tile follows cursor; live resize                                                | ✅ new                                                                                  |
| Push away from the drag; swap; auto-extend                                      | ✅ new                                                                                  |
| Lock / static tiles                                                             | ✅ new                                                                                  |
| View/Edit separation, dirty-state save/discard                                  | ✅                                                                                      |
| Undo/redo over the spec, one entry per gesture                                  | ✅                                                                                      |
| Duplicate, delete (undo toast), copy/cut/paste (cross-dashboard JSON clipboard) | ✅                                                                                      |
| Multi-select (Shift, marquee), group move, align/distribute                     | ✅ (handles now only on single selection)                                               |
| Keyboard everything (arrows, Shift ×4, Enter/Escape, Shift+F10) + live region   | ✅                                                                                      |
| Tabs/pages (workbook), containers (tabs/stack, one level)                       | ✅                                                                                      |
| Text/markdown, heading, divider, image, button, variable, filter tiles          | ✅ (banner tiles now `plain`)                                                           |
| Shared filter bar, per-tile scoping, URL state, bookmarks                       | ✅                                                                                      |
| Tile hover chrome per mode                                                      | ✅ new                                                                                  |
| Properties: General/Visibility/Interactions + Layout + Lock                     | ✅ Layout/Lock new                                                                      |
| Asset/library panel with drag-to-canvas and click-to-add                        | ✅ (rebuilt)                                                                            |
| Tidy up (auto-layout) from the toolbar                                          | ✅ new                                                                                  |
| Breakpoint layouts (md/sm) with author override                                 | ✅ (now switchable from the Layout menu)                                                |
| Export PNG/SVG; presentation mode                                               | ✅                                                                                      |
| Empty state                                                                     | ✅ new                                                                                  |
| Alignment smart guides on a grid                                                | ◻︎ not needed while snapping is whole-cell; revisit for `flow` with sub-cell drags       |
| Copy styling between tiles                                                      | ◻︎ follow-up (needs a per-tile appearance block first)                                   |
| Conditional rendering by no-data                                                | ◻︎ `visibleWhen` covers variables/selection; a `noData` signal from tiles is a follow-up |
| Annotations / comment pins                                                      | ◻︎ follow-up                                                                             |
| Library (master) tiles edited once, reflected everywhere                        | ◻︎ `ref` exists; a "edit master" flow is a follow-up                                     |

## 5. Verification

- `pnpm --filter @elabs-ai/components-charts exec vitest run src/dashboard` — 36 files,
  379 tests green (fixtures updated for the new push semantics, tab order, kebab name).
- Storybook interaction tests (`vitest --project storybook`) for every dashboard story +
  the `dashboard-sheet-app` block: green, except `Dashboard/Chrome/DashboardPresentation ›
Presentation`, which fails identically on `main` (cycle-timing flake in headless).
- ESLint clean on `src/dashboard`; `tsc` clean for `charts`.
- Driven in headless Chromium against the running Storybook: drag with push, pixel
  resize, undo, context menu, properties, asset drag-and-drop and click-add, dark theme,
  multi-select — screenshots reviewed at every step.

## Sources

- Qlik: [Changing sheet layouts](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Sheets/changing-sheet-layout.htm) · [Navigating sheets in edit mode](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Sheets/navigating-sheets.htm) · [Properties panel](https://help.qlik.com/en-US/sense/November2025/Subsystems/Hub/Content/Sense_Hub/Properties/properties-panel.htm) · [Layout container](https://help.qlik.com/en-US/sense/May2025/Subsystems/Hub/Content/Sense_Hub/Visualizations/DashboardBundle/layout-container.htm) · Community: [App Sheet GRID Size](https://community.qlik.com/t5/Suggest-an-Idea/App-Sheet-GRID-Size-to-be-customized/idi-p/1729126), [Move objects per pixel](https://community.qlik.com/t5/Visualization-and-Usability/Move-Objects-per-pixel-in-the-sheet/td-p/2001822)
- Tableau: [Size and Lay Out Your Dashboard](https://help.tableau.com/current/pro/desktop/en-us/dashboards_organize_floatingandtiled.htm) · [Device layouts](https://help.tableau.com/current/pro/desktop/en-us/dashboards_dsd_create.htm) · [Tiled vs floating](https://www.tableau.com/blog/dashboard-design-tiled-vs-floating-layouts)
- Power BI: [Gridlines and snap-to-grid](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-gridlines-snap-to-grid) · [Page size](https://learn.microsoft.com/en-us/power-bi/create-reports/power-bi-report-display-settings) · Fabric Ideas: [Alignment Precision](https://community.fabric.microsoft.com/t5/Fabric-Ideas/Alignment-Precision/idc-p/4441177), [Snap to grid increments](https://community.fabric.microsoft.com/t5/Fabric-Ideas/Snap-to-Grid-and-Visual-Sizing-Increments-Customizable-and-Tied/idi-p/4840978), [Annotating visualizations](https://community.fabric.microsoft.com/t5/Fabric-Ideas/Annotating-visualizations/idc-p/4495831)
- Grafana: [Dynamic dashboards (Grafana 12)](https://grafana.com/blog/2025/05/07/dynamic-dashboards-grafana-12/) · [12.4 release](https://grafana.com/blog/grafana-12-4-release-all-the-latest-features/) · issues [#1004](https://github.com/grafana/grafana/issues/1004), [#4100](https://github.com/grafana/grafana/issues/4100), [#7261](https://github.com/grafana/grafana/issues/7261), [#10248](https://github.com/grafana/grafana/issues/10248), [#23762](https://github.com/grafana/grafana/issues/23762)
- Superset: [Dashboard system](https://deepwiki.com/apache/superset/3.3-dashboard-system) · [#6776](https://github.com/apache/superset/issues/6776), [#16140](https://github.com/apache/superset/issues/16140), [#13240](https://github.com/apache/superset/issues/13240)
- Metabase: [Dashboards](https://www.metabase.com/docs/latest/dashboards/introduction) · [Fixed width #10364](https://github.com/metabase/metabase/issues/10364)
- Looker Studio: [Report and page layout](https://support.google.com/looker-studio/answer/7355651) · [Responsive reports](https://docs.cloud.google.com/data-studio/create-a-responsive-report)
- React side: [react-grid-layout README](https://github.com/react-grid-layout/react-grid-layout/blob/master/README.md) · [Retool: more granular grid](https://community.retool.com/t/ideas-for-a-more-granular-layout-grid-aka-more-columns/5609)
