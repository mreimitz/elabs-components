# DataTable vs AG Grid — gap analysis and the path to best-in-class

Date: 2026-09-25 · Subject: `@elabs-ai/components-data` 5.5.0 (`DataTable` and companions, `main` @ 24597dcc) vs AG Grid 36.2.0 (released 16 Sep 2026), Community and Enterprise.

## Implementation status — branch `feat/datagrid` (added 2026-09-25)

The roadmap in §8 was built, phase by phase, and every phase was checked in real Chromium (Storybook + Playwright), jsdom tests, `pnpm check` and dependent typechecks.

| Phase              | Shipped                                                                                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Foundation       | TanStack Table v9 engine (row-model memory ÷≈3), virtualization-over-pagination fix, row-height calibration (long frames 143 → ~10), localized sort/pager, `grid-bench` fixture vs AG Grid                      |
| 1 Grid interaction | `DataGrid` preset: WAI-ARIA grid (one tab stop), cell ranges (drag / Shift / Ctrl), TSV copy, column menu, drag reorder, autosize / fit, cell context menu, status bar with range stats                         |
| 2 Filtering        | JSON filter models (text / number / date with relative ranges / set with counts / boolean, AND/OR), header filter panels, floating filter row, filter chips, Ctrl/⌘+F find with Custom-Highlight-API highlights |
| 3 Editing          | In-place editors (text, number, date, select, checkbox), validation, TSV paste with fill/tile rules, Delete, Ctrl+X, Ctrl+D, undo/redo — all as one `onCellEdit` batch; `applyCellChanges`                      |
| 4 Analytics        | Row grouping with aggregates, totals row, tree data, master/detail, `pivotData`, "Chart selection" → `onChartRange`                                                                                             |
| 5 Scale            | `flashChanges`, infinite loading (`onLoadMore`), column virtualization (200 × 5,000 mounts in ~0.5 s)                                                                                                           |
| 6 Agent-native     | `AutoGrid` from one JSON `DataGridSpec` + the A2UI data catalog, versioned `GridState` (+ JSON Schema), dependency-free `.xlsx` export                                                                          |

**Final head-to-head, 100,000 rows, 4× CPU throttle, same harness:**

|                                | DataTable (branch) | AG Grid 36.2 Community |
| ------------------------------ | ------------------ | ---------------------- |
| Mount                          | 961 ms             | 1,207 ms               |
| JS heap                        | 118 MB             | 79 MB                  |
| Sort asc / desc                | 2,069 / 1,716 ms   | 2,516 / 2,328 ms       |
| Filter / clear                 | 1,820 / 1,804 ms   | 2,690 / 2,533 ms       |
| Scroll avg / p95 frame         | 25 / 44 ms         | 36 / 60 ms             |
| Long frames / blank frames     | 29 / 0             | 90 / 26                |
| Bundle (gzip, excl. React DOM) | ≈264 KB            | ≈491 KB                |

Horizontal scroll with column virtualization (200 columns, 40 px/frame, 4×): ours ≈30 ms avg frame vs AG ≈26 ms — the one budget where AG still leads; heap is the other.

**Still open:** server-side row model with server grouping, worker-backed row models, integrated chart rendering (deliberately left to `charts` via `onChartRange`), print layout, a CI job for the bench, and a per-row memo boundary to close the horizontal-scroll and heap gaps.

---

## 0. How this was done

- **AG Grid.** About 150 React docs pages read in full (AG Grid now publishes every page as Markdown), plus What's New, the modules table, pricing and the per-version upgrade notes. Community vs Enterprise is taken from the docs' own metadata, not memory. Detailed inventories: §A1 in the appendix.
- **Ours.** `data-table.tsx` (3,448 lines), `column-meta.ts`, `cell-scales.ts`, the five in-cell visuals, `sticky-rows`, `ranks-column`, `card-layout`, `use-table-breakpoint`, `to-csv`, `FacetFilter`, `ColumnPicker`, `SearchInput`, `FilterBar`, the 45 DataTable stories, the CHANGELOG, the A2UI catalog.
- **Real runtime.** A Vite + React 19 harness built both grids from npm (`@elabs-ai/components-data@5.5.0` with virtualization; `ag-grid-react@36.2.0` with `AllCommunityModule`, defaults) on the same 20-column dataset, then drove them with Playwright in Chromium: mount, header-click sort, quick/global filter, scripted scrolling, DOM size, JS heap, keyboard traversal, and a production bundle build. Runs at 1× CPU (fast desktop) and 4× CPU throttle (a mid-range laptop proxy). A Node micro-benchmark measured TanStack Table v8 vs v9 row-model memory. An independent review pass then checked every claim about our code against the source; its corrections are folded in.

Legend used throughout: **✅** parity · **◐** partial · **✗** missing · **★** we are ahead · **C / E** = AG Grid Community (MIT) / Enterprise ($999 per developer; Integrated Charts need the $1,498 bundle).

---

## 1. Verdict

**DataTable is a very good _presentation table_. AG Grid is a _data workbench_.** Those are different products, and "best in class" means we need the second without losing the first.

What we already do better than AG Grid (keep and amplify):

1. **Weight.** 77.6 KB gz JS for DataTable and its UI dependencies vs 317.7 KB gz for AG Grid `AllCommunityModule` in the same build (React excluded from both). Enterprise is ~740 KB gz.
2. **React-native state.** Eight slices (sorting, filters, global filter, visibility, pagination, pinning, sizing, selection), each controlled _or_ uncontrolled, plus `initialView`. AG Grid is configured with objects and an imperative API, and resets state when props lose referential stability.
3. **Editorial cell visuals** that AG Grid does not have at all, or only in Enterprise: bar (regular / slim, track, diverging, colour by category), sparkline, mini columns, heatmap with stepped / continuous / quantile / Jenks scales, categorical `colorBy` on cell or row, markdown cells, ranks, sticky total rows via props.
4. **Responsive design.** `layout="auto"` card layout under 450 px plus per-column `showAt` from a container-measured breakpoint. AG Grid has no responsive mode.
5. **Token theming across brand families**, and accessibility craft on the features that exist (keyboard column resize with localized `aria-valuetext`, localized drag-reorder announcements in a polite live region, focus-not-obscured `scroll-padding` for pinned columns, WCAG 2.5.8 target sizes, virtual `aria-rowcount` / `aria-rowindex`).
6. **Speed at 10k rows.** Faster than AG Grid Community on sort, filter and throttled mount in our measurements (§2).
7. **MIT for everything**, where AG Grid charges for grouping, aggregation, clipboard, range selection, set filter, menus, Excel export and sparklines.

What stands between us and best-in-class, in priority order:

1. **No cell-level interaction model.** Verified in the browser: the table is `role="table"`, Tab visits the 20 header sort buttons and then leaves the table, arrow keys do nothing, and data cells cannot be reached by keyboard at all. There is no focused cell, no range selection, no clipboard. This is the foundation every grid feature below sits on.
2. **No editing** of any kind.
3. **No grouping, aggregation, tree data, master/detail or pivot**, although TanStack ships the row models for most of it headlessly.
4. **Filtering has state but no UI**: no per-column filter menus, no floating filter row, no set filter with search and counts, no date or number conditions, no Find.
5. **No column menu, context menu, tool panel or status bar**, and no column reordering or auto-size.
6. **Scale.** At 100k rows we use 4.8× AG Grid's JS heap (325 MB vs 68 MB), mount 2× slower, and produce ~3× more long frames while scrolling on a throttled CPU. Root cause is TanStack v8's per-row closures (measured: v9 cuts row-model memory 4.7×) plus a render path with no row/cell memo boundary.
7. **Export** is a raw-rows CSV helper; nothing grid-aware, no Excel.

**Recommendation.** Do not clone AG Grid's object-config architecture. Rebuild DataTable's engine on **TanStack Table v9** (released 4 Aug 2026; prototype-based rows, and it now ships headless _cell range selection_, _cell spanning_ and an experimental _worker row-model pipeline_), split the 3,448-line component into a small grid engine with memoized row and cell components, add a real `role="grid"` keyboard model, then layer the workbench features in the order in §8. Positioning: **"AG Grid Enterprise capability, MIT, one-tenth the weight, React-native, token-themed, responsive, agent-native."**

---

## 2. Measured head-to-head (real Chromium)

Same data: 20 columns (7 text/date, 11 numeric, 1 boolean, 1 notes), deterministic generator. DataTable: `enableRowVirtualization`, `getRowId`, global filter. AG Grid: defaults (`animateRows` on), `getRowId`, `quickFilterText`. Time = action to first changed row painted (double rAF). Single runs, repeated where marked; treat ±15 % as noise.

### 10,000 rows

| Metric                               | DataTable 1×   | AG Grid 1×     | DataTable 4× CPU     | AG Grid 4× CPU   |
| ------------------------------------ | -------------- | -------------- | -------------------- | ---------------- |
| Mount to first paint                 | 272–312 ms     | 273–283 ms     | **742 ms**           | 959 ms           |
| Sort (header click)                  | **92–139 ms**  | 209–338 ms     | **326–369 ms**       | 557–618 ms       |
| Global / quick filter                | **106–125 ms** | 479–491 ms     | **377–407 ms**       | 623–630 ms       |
| Scroll 120 px/frame: avg / p95 frame | 16.7 / 19.6 ms | 16.8 / 22.2 ms | **25.3 / 45.5 ms**   | 30.0 / 51.6 ms   |
| Long frames (>34 ms) of 180          | 0              | 0              | **27**               | 47               |
| Scroll 3,000 px/frame: avg / p95     | —              | —              | **104.6 / 229.7 ms** | 132.0 / 238.5 ms |
| DOM elements                         | **515**        | 776            |                      |                  |
| JS heap                              | 35 MB          | **17 MB**      |                      |                  |

### 100,000 rows

| Metric                           | DataTable 1×   | AG Grid 1×     | DataTable 4× CPU | AG Grid 4× CPU       |
| -------------------------------- | -------------- | -------------- | ---------------- | -------------------- |
| Mount to first paint             | 776 ms         | **396 ms**     | 2,034 ms         | **1,135 ms**         |
| Sort asc / desc                  | 558 / 530 ms   | 579 / 441 ms   | 2,942 / 2,576 ms | **2,227 / 2,253 ms** |
| Global / quick filter            | **648 ms**     | 831 ms         | 2,463 ms         | **2,028 ms**         |
| Clear filter                     | 585 ms         | **343 ms**     | 2,971 ms         | **1,844 ms**         |
| Scroll 120 px/frame: avg / p95   | 16.6 / 19.3 ms | 16.6 / 18.7 ms | 33.9 / 57.3 ms   | **25.9 / 40.7 ms**   |
| Long frames of 180               | 0              | 0              | 70               | **25**               |
| Scroll 3,000 px/frame: avg / p95 | —              | —              | 164.7 / 347.5 ms | 180.2 / 250.2 ms     |
| JS heap                          | 307–325 MB     | **68 MB**      |                  |                      |

AG Grid with `animateRows=false` and `cacheQuickFilter=true` measured the same (sort 2,259 ms, filter 2,246 ms at 4×), so its defaults were not handicapping it.

### Bundle (production build, gzip -9)

|                                      | JS          | CSS                                                 |
| ------------------------------------ | ----------- | --------------------------------------------------- |
| DataTable + ui/tokens deps           | **77.6 KB** | 29.6 KB (Tailwind output for the data + ui sources) |
| AG Grid `AllCommunityModule` + theme | 317.7 KB    | in JS                                               |
| Shared React 19 + data generator     | 68.5 KB     |                                                     |

AG Grid's own minimal build (core + Quartz theme, no feature modules) is ~202 KB gz; `AllEnterpriseModule` ~738 KB gz.

### TanStack Table v8 vs v9 memory (Node, 100k × 20, after GC)

|                                      | v8.21.3 (what we ship) | v9.2.4                 |
| ------------------------------------ | ---------------------- | ---------------------- |
| Core row model built                 | 521 MB                 | **110 MB** (4.7× less) |
| After every row's cells materialized | 1,884 MB               | **321 MB** (5.9× less) |

Raw data was 54 MB in both. v9 moved row, cell and column APIs onto shared prototypes; v8 attaches closures per instance.

### Keyboard (1,000 rows, Tab ×25 then ArrowDown ×2, ArrowRight)

- **DataTable:** `table` role. Tab stops: scroll region, then `Sort by id…` … `Sort by notes…` (20 buttons), then focus leaves to `<body>`. Arrow keys: focus stays on the header button. Data cells: unreachable.
- **AG Grid:** `grid` role. Tab stops: 20 `columnheader`s, then `gridcell`s. After the arrows, focus was on `gridcell` column 6 of the second row.

### What the numbers say

- Up to ~10k rows we are **faster than AG Grid Community** on every interactive operation and lighter in DOM. That is a real, marketable result.
- From ~50k rows we lose on **memory (4.8×), mount (2×) and scroll smoothness under CPU pressure**. Sort and filter cost is comparable; both grids are single-threaded and do O(n log n) work on the main thread, so neither is great at 100k on a slow CPU. This is where v9 prototype rows, a memo boundary and worker row models give us a way to beat AG Grid rather than match it.

---

## 3. Feature matrix

Each row: AG Grid capability → tier → our status → note. "TanStack" in the note means the headless engine already provides the logic, so the gap is UI and wiring only.

### 3.1 Columns

| Capability                                                                                                                                      | AG                       | Ours | Note                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Column definitions, nested column groups (multi-row headers)                                                                                    | C                        | ✅   | TanStack groups; `mergeEmptyHeaders` spans placeholders ★                                                                                                        |
| Collapsible column groups (`columnGroupShow` open/closed), sticky group labels while scrolling                                                  | C                        | ✗    |                                                                                                                                                                  |
| Default column def / reusable column types                                                                                                      | C                        | ◐    | TanStack `defaultColumn` not exposed as a prop                                                                                                                   |
| Cell data types (text, number, bigint, boolean, date, dateTime, object) inferred, each wiring parser + formatter + editor + filter + comparator | C                        | ✗    | We have `meta.numeric` + a number `format` spec only; no date type                                                                                               |
| Value getter                                                                                                                                    | C                        | ✅   | `accessorFn`                                                                                                                                                     |
| Value formatter                                                                                                                                 | C                        | ◐    | Number formats only (`meta.format`, shared shape with charts) ★ for numbers; no date/time formats; formatter not used by export                                  |
| Value parser / setter                                                                                                                           | C                        | ✗    | No editing                                                                                                                                                       |
| Resize by drag                                                                                                                                  | C                        | ✅   | Live or on-end                                                                                                                                                   |
| Resize by keyboard                                                                                                                              | C (Alt+←/→ on header)    | ★    | Focusable separator, localized value text, RTL-correct                                                                                                           |
| Double-click resize edge                                                                                                                        | C (auto-size to content) | ◐    | Ours resets to declared size                                                                                                                                     |
| Flex columns, fit to grid, auto-size to content / header, continuous auto-size that respects user-sized columns                                 | C                        | ✗    | `meta.width` (%) and `meta.minWidth` (px) only                                                                                                                   |
| Shift-resize (take width from neighbour)                                                                                                        | C                        | ✗    |                                                                                                                                                                  |
| Column reordering by drag, keyboard (Shift+←/→) and API; lock position                                                                          | C                        | ✗    | TanStack `columnOrder`; not wired, not in view state                                                                                                             |
| Pin columns left/right                                                                                                                          | C                        | ✅   | Controlled; seam survives shadowless themes ★                                                                                                                    |
| Pin UI (menu, drag-to-edge-and-hold), auto-unpin when pinned area overflows                                                                     | C/E                      | ✗    | Pinned columns must declare `size` (auto-layout `<table>` limitation) ◐                                                                                          |
| Column spanning (`colSpan`)                                                                                                                     | C                        | ✗    | TanStack v9 `cellSpanningFeature`                                                                                                                                |
| Row spanning (merge equal adjacent cells)                                                                                                       | C                        | ✗    | TanStack v9 `cellSpanningFeature`                                                                                                                                |
| Column visibility                                                                                                                               | C                        | ✅   | + `ColumnPicker` ◐ (lists `column.id`, not the header label; group columns instead of leaves; checked state not exposed to assistive tech; no search or reorder) |
| Breakpoint visibility (`showAt`)                                                                                                                | —                        | ★    | AG has none                                                                                                                                                      |
| Column state save / restore                                                                                                                     | C                        | ✅   | `DataTableViewState`; lacks order, expansion, grouping, version                                                                                                  |
| Header tooltips, wrapped header text with auto header height                                                                                    | C                        | ✗    |                                                                                                                                                                  |
| Custom header content                                                                                                                           | C                        | ✅   | Any ReactNode via `flexRender`                                                                                                                                   |
| Column hover highlight                                                                                                                          | C                        | ✗    |                                                                                                                                                                  |
| Auto-generate columns from data, drop-a-file overlay                                                                                            | C                        | ✗    | Useful for AI/agent surfaces                                                                                                                                     |
| Column menu (sort, pin, autosize, group, filter, reset, choose columns)                                                                         | E                        | ✗    |                                                                                                                                                                  |
| Column chooser dialog, Columns tool panel                                                                                                       | E                        | ✗    |                                                                                                                                                                  |
| User-authored calculated columns (expression editor)                                                                                            | E                        | ✗    |                                                                                                                                                                  |
| User-editable header names                                                                                                                      | E                        | ✗    |                                                                                                                                                                  |

### 3.2 Rows and data updates

| Capability                                                             | AG                  | Ours | Note                                                                                                             |
| ---------------------------------------------------------------------- | ------------------- | ---- | ---------------------------------------------------------------------------------------------------------------- |
| Stable row ids                                                         | C                   | ✅   | `getRowId`, with dev warnings for the paging footgun ★                                                           |
| Fixed / per-row / auto row height                                      | C                   | ◐    | Natural height; virtualizer measures rows. No `getRowHeight`, no user row resize                                 |
| Pinned top/bottom rows                                                 | C                   | ✅   | `stickyRows` stays out of sort, paging and search ★                                                              |
| User pin / unpin rows                                                  | C (UI needs E menu) | ✗    |                                                                                                                  |
| Full-width rows                                                        | C                   | ✗    | Needed for group rows and detail panels                                                                          |
| Row drag reorder                                                       | C                   | ◐    | dnd-kit with full keyboard + announcements ★, but disabled with virtualization, in cards, and fights active sort |
| Drag to another grid / external drop zone / OS drag                    | C                   | ✗    |                                                                                                                  |
| Row animation on sort/filter/insert                                    | C                   | ✗    |                                                                                                                  |
| Delta updates keep selection, scroll, expansion (`rowData` diff by id) | C                   | ◐    | TanStack keeps selection by id; no diff-driven animation or flash                                                |
| Transactions (`add/update/remove`), async batching (50 ms), delta sort | C                   | ✗    | Every update rebuilds the whole row model                                                                        |
| Cell change flash, delta renderers (↑/↓ with fade)                     | C                   | ✗    | Important for live / ops dashboards                                                                              |
| Row numbers column (with row resize)                                   | E                   | ◐    | `showRanks` (data-order rank) ★; not a row header                                                                |
| Row class rules                                                        | C                   | ✅   | `rowClassName`                                                                                                   |
| Row activation (click / Enter)                                         | —                   | ★    | Hidden-button proxy keeps table semantics, guards nested controls and text selection                             |

### 3.3 Sorting

| Capability                                        | AG  | Ours      | Note                                                                                                      |
| ------------------------------------------------- | --- | --------- | --------------------------------------------------------------------------------------------------------- |
| Single sort, custom comparator, custom sort cycle | C   | ✅        | TanStack `sortingFn`, `sortDescFirst`                                                                     |
| Multi-sort (Shift+click)                          | C   | ◐         | Works on accessor columns (TanStack default); no sort-order index in the header or in the accessible name |
| Absolute sort                                     | C   | ✗         |                                                                                                           |
| Locale / accent-aware text sort                   | C   | ◐         | Possible via `sortingFn`; not the default                                                                 |
| Sort animation                                    | C   | ✗         |                                                                                                           |
| Delta sort after updates                          | C   | ✗         |                                                                                                           |
| Server sort                                       | C   | ✅        | `manualSorting` + `onServerChange`                                                                        |
| Sort button accessible name                       | C   | ◐ **bug** | `Sort by ${label}, ascending` is hard-coded English, bypassing the locale seam (ADR 0017)                 |

### 3.4 Filtering

| Capability                                                                       | AG  | Ours | Note                                                                                                                                                   |
| -------------------------------------------------------------------------------- | --- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Column filter state, controlled                                                  | C   | ✅   | TanStack `columnFilters`                                                                                                                               |
| Per-column filter UI in the header                                               | C   | ✗    | Caller must build it                                                                                                                                   |
| Text / number / date / bigint condition filters with AND/OR                      | C   | ✗    |                                                                                                                                                        |
| Relative date ranges (today, last 30 days, YTD …)                                | C   | ✗    |                                                                                                                                                        |
| Set filter: checklist, search, select all, (Blanks), counts, tree list for dates | E   | ◐    | `FacetFilter` needs caller-supplied options; no search, counts, blanks or faceting; not wired to a column; checked state not exposed to assistive tech |
| Multi filter (condition + set on one column)                                     | E   | ✗    |                                                                                                                                                        |
| Floating filter row under the header                                             | C   | ✗    |                                                                                                                                                        |
| Quick / global filter                                                            | C   | ✅   | + `searchMode="exact"` ★                                                                                                                               |
| External filter                                                                  | C   | ✅   | App filters `data`                                                                                                                                     |
| Advanced filter: expression bar + visual builder                                 | E   | ✗    | components-ui `ViewToolbar` / `FilterChip` / `ResultCount` are usable building blocks                                                                  |
| Filter tool panel                                                                | E   | ✗    |                                                                                                                                                        |
| Find (Ctrl+F, highlight all matches, next/prev, expands groups)                  | E   | ✗    |                                                                                                                                                        |
| "No matching rows" distinct from "no rows"                                       | C   | ◐    | One `emptyMessage` for both                                                                                                                            |

### 3.5 Selection, focus, keyboard

| Capability                                                                   | AG  | Ours | Note                                                                                                   |
| ---------------------------------------------------------------------------- | --- | ---- | ------------------------------------------------------------------------------------------------------ |
| Row selection single / multi, header checkbox with indeterminate             | C   | ✅   | `createSelectionColumn`                                                                                |
| Shift+click row range, click-to-select row, Ctrl+A                           | C   | ✗    |                                                                                                        |
| Select-all modes (all / filtered / page)                                     | C   | ◐    | Current page when paginated, otherwise all filtered rows; not configurable; hidden under single-select |
| Server-side "select all + exceptions"                                        | E   | ✗    |                                                                                                        |
| Grid ARIA pattern (`role="grid"`/`treegrid`), focused cell, roving tabindex  | C   | ✗    | **Verified: data cells unreachable by keyboard**                                                       |
| Arrow / Home / End / PageUp / PageDown / Ctrl+Home navigation, header ↔ body | C   | ✗    |                                                                                                        |
| Cell range selection (multi-range, Ctrl-subtract, Shift-extend)              | E   | ✗    | TanStack v9 `cellSelectionFeature` provides include/exclude ranges                                     |
| Column selection from header                                                 | E   | ✗    |                                                                                                        |
| Range handle / fill handle (series, double-click fill)                       | E   | ✗    |                                                                                                        |
| Status bar aggregates of the selected range                                  | E   | ✗    |                                                                                                        |

### 3.6 Editing

| Capability                                                                            | AG  | Ours |
| ------------------------------------------------------------------------------------- | --- | ---- |
| Cell editing (double-click, Enter / F2, type-to-edit, Backspace)                      | C   | ✗    |
| Full-row editing                                                                      | C   | ✗    |
| Editors: text, large text, number, date / time, checkbox, select                      | C   | ✗    |
| Rich select (virtual list, async pages, multi-select pills)                           | E   | ✗    |
| Validation (built-in + custom, error tooltip, cross-field, revert / block, announced) | C   | ✗    |
| Undo / redo                                                                           | C   | ✗    |
| Batch editing (pending styling, commit/cancel, one undo step)                         | E   | ✗    |
| Read-only edit mode (emit edit requests, never mutate)                                | C   | ✗    |
| Range edit ops: Ctrl+D fill down, Ctrl+Enter bulk edit, Delete clears                 | E   | ✗    |
| Formulas with a range-highlighting editor                                             | E   | ✗    |
| Cell notes / comments                                                                 | E   | ✗    |

### 3.7 Cell rendering

| Capability                                      | AG                 | Ours | Note                                                                   |
| ----------------------------------------------- | ------------------ | ---- | ---------------------------------------------------------------------- |
| Custom cell components                          | C                  | ✅   | `flexRender`                                                           |
| In-cell bar                                     | —                  | ★    |                                                                        |
| Sparkline / mini columns                        | E                  | ★    | MIT, token colours                                                     |
| Heatmap with classed scales + legend            | —                  | ★    |                                                                        |
| Categorical colour on cell or row + legend      | —                  | ★    |                                                                        |
| Markdown cells                                  | —                  | ★    |                                                                        |
| Number format spec                              | C (valueFormatter) | ✅   | Shared with charts ★                                                   |
| Cell style / class rules                        | C                  | ◐    | `meta.style` is static; no value-driven rules beyond heatmap / colorBy |
| Tooltips (truncation-only, interactive, delays) | C                  | ✗    |                                                                        |
| Loading skeleton rows + busy overlay            | C                  | ✅   | Mirrors real column alignment ★                                        |
| Defer expensive renderers while scrolling       | C                  | ✗    |                                                                        |

### 3.8 Grouping and analytics (all Enterprise in AG Grid)

| Capability                                                                                       | Ours | Note                                                                  |
| ------------------------------------------------------------------------------------------------ | ---- | --------------------------------------------------------------------- |
| Row grouping, multi-level, group column / group rows                                             | ✗    | TanStack `getGroupedRowModel` + `getExpandedRowModel`                 |
| Drag-to-group panel                                                                              | ✗    |                                                                       |
| Aggregation (sum/min/max/count/avg/first/last/custom), group and grand totals, sticky group rows | ◐    | Only a precomputed `stickyRows` total. TanStack aggregation fns exist |
| Date-part grouping (year → month)                                                                | ✗    |                                                                       |
| Tree data                                                                                        | ✗    | TanStack `getSubRows`                                                 |
| Master / detail (nested detail panel per row)                                                    | ✗    | Needs full-width rows                                                 |
| Pivot mode with generated columns and totals                                                     | ✗    | Not in TanStack; build on grouped model                               |
| "Show values as" % of total / parent                                                             | ✗    |                                                                       |
| Integrated charts from a range                                                                   | ✗    | We own `@elabs-ai/components-charts` — a natural advantage            |

### 3.9 Chrome and accessories

| Capability                                                                | AG                       | Ours | Note                                                                              |
| ------------------------------------------------------------------------- | ------------------------ | ---- | --------------------------------------------------------------------------------- |
| Toolbar slot                                                              | E (Quick Access Toolbar) | ✅   | `toolbar` render prop + `FilterBar`, `SearchInput`, `FacetFilter`, `ColumnPicker` |
| Context menu (copy, copy with headers, export, pin, custom nested items)  | E                        | ✗    |                                                                                   |
| Side bar with tool panels                                                 | E                        | ✗    |                                                                                   |
| Status bar (row counts, selection counts, range aggregates)               | E                        | ✗    |                                                                                   |
| Pagination: page-size selector, row summary, page numbers, auto page size | C                        | ◐    | Previous / Next and "Page X of Y" only; **hard-coded English**                    |
| Overlays: loading, no rows, no matches, exporting                         | C                        | ◐    |                                                                                   |

### 3.10 Clipboard and export

| Capability                                                             | AG  | Ours | Note                                                                                                                                             |
| ---------------------------------------------------------------------- | --- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| CSV export                                                             | C   | ◐    | `toCsv` over raw objects; ignores column order, visibility, header labels and formatters unless the caller re-states them; CSV-injection guard ★ |
| Excel export (styles, outlines, multiple sheets, freeze panes, images) | E   | ✗    |                                                                                                                                                  |
| PDF export                                                             | E   | ✗    |                                                                                                                                                  |
| Print layout                                                           | C   | ✗    |                                                                                                                                                  |
| Copy range / rows as TSV, copy with headers                            | E   | ✗    | Native text selection only                                                                                                                       |
| Paste into range                                                       | E   | ✗    |                                                                                                                                                  |

### 3.11 State, API and row models

| Capability                                                                        | AG  | Ours | Note                                                                  |
| --------------------------------------------------------------------------------- | --- | ---- | --------------------------------------------------------------------- |
| Controlled / uncontrolled per slice                                               | —   | ★    | AG has state get/set, not controlled props                            |
| One serialisable, versioned grid state (incl. scroll, focus, expansion, grouping) | C   | ◐    | Eight slices; no version, order, scroll, focus                        |
| Imperative API (scroll to row, focus cell, autosize, export, refresh)             | C   | ◐    | TanStack instance only via `toolbar`; no ref API                      |
| Event surface (cell click / double-click / context menu / key down / edit)        | C   | ◐    | `onRowClick`, `onRowReorder`, `onServerChange`                        |
| Client row model                                                                  | C   | ✅   |                                                                       |
| Server paging / sort / filter                                                     | C   | ✅   | Page-based only                                                       |
| Infinite scroll with block cache                                                  | C   | ✗    |                                                                       |
| Server-side grouping / lazy children                                              | E   | ✗    |                                                                       |
| Row virtualization                                                                | C   | ✅   | Dynamic measurement                                                   |
| Column virtualization                                                             | C   | ✗    | All columns render; wide tables pay per column                        |
| Virtualization together with pagination / reorder / sticky header                 | C   | ◐    | With pagination it truncates to page 1 (bug, §4); reorder is disabled |

### 3.12 Theming, layout, accessibility, i18n, DX

| Capability                                           | AG                                  | Ours | Note                                                                      |
| ---------------------------------------------------- | ----------------------------------- | ---- | ------------------------------------------------------------------------- |
| Theme system                                         | C (~300 params, Theme Builder)      | ★    | Semantic tokens and brand families shared with the whole library          |
| Density                                              | C (continuous `spacing`)            | ◐    | `default` / `compact`                                                     |
| Responsive / mobile layout                           | —                                   | ★    | Cards + `showAt`                                                          |
| Fill-parent height / auto height                     | C                                   | ◐    | Virtualized mode needs `maxBodyHeight` (default 32rem)                    |
| RTL                                                  | C                                   | ✅   | Resize math direction-aware ★                                             |
| Screen-reader semantics                              | C (grid/treegrid)                   | ◐    | Table semantics are careful ★; no grid pattern                            |
| Locale                                               | C (31 packs)                        | ◐    | Seam exists; leaks in sort label, pager, default empty message            |
| Coding-agent tooling                                 | C (`ag-mcp`, skills, Markdown docs) | ✅   | `brand-ui` CLI, MCP, plugin                                               |
| Natural language → grid state (JSON schema of state) | E (AI Toolkit)                      | ✗    | DataTable is not in the A2UI catalog (only static `Table` primitives are) |
| Test ids                                             | C                                   | ◐    | Some `data-slot` attributes                                               |

### Tally

Across the 137 capability rows above: **★ 11 ahead, ✅ 25 parity, ◐ 27 partial, ✗ 74 missing.** 35 of the 74 missing are Enterprise-only in AG Grid, which leaves **39 gaps against the free Community edition alone**. For about a dozen gaps (column reordering, column and row spanning, range selection, grouping, aggregation, expansion, tree data, a faceted set filter) the headless logic already exists in TanStack v8 or v9 and only the UI and wiring are missing. Many ✅ rows also carry a ★ detail in their note (e.g. controlled state, shadowless-safe pinned seams).

---

## 4. Defects and debt found in the current code

1. **Keyboard access to data (a11y, severity high).** No roving focus, no grid role, cells unreachable. Anyone building an ops console on DataTable fails WCAG 2.1.1 for any cell content that is not itself a control.
2. **Pagination + virtualization hides data (bug, severity high).** The docs say pagination is "silently ignored" when both are set, but the pagination row model is still attached and the pager is hidden. Verified in the browser with 1,000 rows: only rows 1–10 render, the scroll region ends at row 10, and there is no pager. Rows 11–1,000 are unreachable.
3. **Locale leaks (severity medium).** `renderSortButton` builds `Sort by ${headerLabel}, ascending|descending|not sorted` in English; the pager renders literal `Page`, `of`, `Previous`, `Next` (and page numbers skip `formatNumber`); `emptyMessage` defaults to `"No results."`. components-ui's message catalogue already has `previous`, `next` and `noResults` keys. Everything else goes through `t()`.
4. **Accessible names from ids (medium).** When a header isn't a plain string, the sort button's `aria-label` falls back to `column.id`, and because the `aria-label` replaces the visible header content this also breaks WCAG 2.5.3 (Label in Name). `ColumnPicker` items show `column.id` with CSS `capitalize`, so `m1`, `created_at`, `accountId` leak to users; it also lists top-level group columns instead of leaves. Both should use the header label (or a `meta.label`).
5. **Checked state invisible to assistive tech (medium).** `ColumnPicker` and `FacetFilter` render plain menu items with an `aria-hidden` ✓ glyph instead of checkbox items, so screen-reader users can't tell which columns or values are on (WCAG 4.1.2).
6. **Memory at scale (high for data apps).** v8 per-row closures: 307–325 MB heap at 100k rows vs 68 MB for AG Grid.
7. **No render boundary (medium).** Header, rows and cells are rendered by closures (`renderRow`, `renderThead`, `cellPresentation`) inside one 3,448-line component. Any state change (a virtualizer scroll frame, a selection toggle, a live column resize, a reorder announcement) re-renders every visible row and cell. There is no `React.memo`'d `Row`/`Cell`.
8. **Feature exclusivity (medium).** Virtualization can't be combined with pagination (see 2) and disables row reorder; reorder is disabled in cards; pinned columns require an explicit `size`. Each is documented and dev-warned, but each is a limitation users will hit.
9. **View state gaps (low).** `DataTableViewState` has no `columnOrder`, `expanded`, `grouping` or `version`, so saved views can't survive schema changes or carry the features we will add.
10. **Export not grid-aware (low).** `toCsv` doesn't know about the table.
11. **Size of the file (maintainability).** Much of the 3,448 lines is careful rationale comments. That is valuable history, but a feature-per-module layout will let the grid grow to AG Grid's scope without a 15,000-line component.

---

## 5. Where we should deliberately differ from AG Grid

- **No object-config DSL.** Keep `ColumnDef` + `meta` + JSX composition; add features as _table features_ and _slots_, not as 400 grid options.
- **No imperative-first API.** Every new state (focus, ranges, grouping, expansion, editing drafts, column order, filters UI state) is a controlled slice with an uncontrolled default. A ref API is a convenience on top.
- **No per-feature paywall, no watermark.** Ship everything MIT, tree-shakeable by subpath (`@elabs-ai/components-data/grid`, `/editing`, `/grouping`, `/export-xlsx`) so the presentation-table user still pays ~80 KB.
- **No bespoke theme parameter language.** Grid visuals come from the same semantic tokens as the rest of brand-ui; add grid-specific tokens (range fill, focus ring on cell, edited cell, flash) to the token contract.
- **Keep editorial features first-class.** Editorial-grade visuals are something AG Grid users cannot get; make them work _with_ grouping (bars in group rows, heatmap over aggregates).

---

## 6. Optimization potential (engineering)

| #   | Change                                                                                                                                                    | Expected effect                                                                                                                                       | Evidence                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| O1  | Migrate to **TanStack Table v9**                                                                                                                          | Row-model memory ÷4.7; all-cells memory ÷5.9; unlocks headless cell range selection, cell spanning, atom-based reactivity for fine-grained re-renders | Node benchmark §2; v9.0.0 released 2026-08-04, 9.2.4 current |
| O2  | Split into `GridRoot` → `HeaderRow` → `Row` (memo) → `Cell` (memo) with row-level props that change only when that row's data, selection or focus changes | Scroll re-render cost from O(visible cells) per frame to O(new rows); target ≤ 8 long frames per 180 at 100k/4×                                       | Frames: 70 long vs AG 25                                     |
| O3  | Drop `measureElement` for fixed-height rows (`rowHeight` known from density) and measure only `autoHeight` columns                                        | Removes forced layouts during fast scroll                                                                                                             | Fast-scroll p95 347 ms at 100k                               |
| O4  | **Column virtualization** (TanStack Virtual horizontal) with pinned columns kept mounted                                                                  | Wide tables (50–500 columns) render in constant time                                                                                                  | AG virtualizes columns with no buffer                        |
| O5  | CSS-grid or absolutely positioned rows instead of `<table>` auto layout in grid mode                                                                      | Deterministic widths (no "pinned column must declare size"), pinned offsets without measuring, cheaper layout                                         | Current pinned-size warning                                  |
| O6  | **Worker row models** (v9 experimental) for sort, filter, group at ≥ 50k rows, with a `pending` state painted as a thin progress bar                      | Main thread free during 2–3 s operations; AG Grid has no worker path at all                                                                           | 100k/4×: sort 2.9 s, filter 2.5 s on main thread             |
| O7  | Transactions + delta updates keyed by `getRowId` (apply add/update/remove to the existing model; re-sort only changed rows)                               | Live data at thousands of updates/second without rebuilding 100k rows                                                                                 | AG `applyTransactionAsync` 50 ms batching                    |
| O8  | Precompute a lower-cased search string per row lazily (quick-filter cache) and debounce input at 150 ms                                                   | Filter at 100k/4× under 1 s                                                                                                                           | Filter 2.5 s now                                             |
| O9  | `content-visibility: auto` for off-screen grids; `deferRender` for heavy cells (sparklines, markdown) while scrolling                                     | Cheaper dashboards with many tables                                                                                                                   | AG `deferRender`, `enableContentVisibilityAuto`              |
| O10 | Performance budgets in CI: this benchmark harness as a Playwright job (10k and 100k, 1× and 4×) failing on regressions                                    | Keeps "faster than AG Grid" true                                                                                                                      | Harness exists (§A2)                                         |

---

## 7. Target architecture

```
@elabs-ai/components-data
├─ DataTable            ← unchanged public API; now a preset over <Grid>
├─ grid/                ← engine: TanStack v9 table + features, virtualizers, focus model
│   ├─ GridRoot, GridHeader, GridBody, GridRow (memo), GridCell (memo)
│   ├─ features/focus         roving tabindex, role=grid|treegrid, key map (overridable)
│   ├─ features/range         v9 cellSelection + clipboard (TSV) + fill handle
│   ├─ features/columns       order (drag + keyboard), autosize, flex, menu, chooser
│   ├─ features/filters       column filter UIs, floating row, set filter on faceting, Find
│   ├─ features/editing       editors, validation, undo/redo, batch, read-only edit mode
│   ├─ features/grouping      group/aggregate/tree/master-detail/pivot, group panel
│   ├─ features/data          transactions, flash, infinite + server-group datasources, worker
│   └─ features/chrome        context menu, status bar, tool panel, pager
├─ export/              csv (grid-aware), xlsx (lazy chunk), print
└─ state/               GridState (versioned, migratable) + JSON Schema for agents
```

Rules: every feature is opt-in and tree-shakeable; every state slice is controllable; `DataTable` keeps rendering byte-identical markup for today's props (the existing 3,564-line test suite is the guard) until a consumer opts into `mode="grid"`.

---

## 8. Roadmap

Effort: S ≤ 3 days · M ≤ 2 weeks · L ≤ 5 weeks (one engineer plus agents). Acceptance criteria always include stories, tests, `audit --strict`, and for interaction work, a real-browser Playwright test.

### Phase 0 — Foundation (L)

| Item                     | Scope                                                                                                                                                                     | Done when                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| F1 TanStack v9 migration | Port `DataTable` to v9 features / row models; keep public types                                                                                                           | All 3,564 lines of tests green; 100k heap ≤ 120 MB                                                       |
| F2 Engine split          | `grid/` modules; memoized row and cell                                                                                                                                    | 100k/4× slow scroll ≤ 25 long frames of 180                                                              |
| F3 GridState v1          | Versioned state incl. order, expansion, grouping, focus, scroll; migration hook                                                                                           | Saved view round-trips across a schema change                                                            |
| F4 Perf harness in CI    | §A2 harness, budgets for 10k and 100k                                                                                                                                     | CI fails on > 15 % regression                                                                            |
| F5 Correctness fixes     | Pagination + virtualization bug; sort label, pager, empty text via `t()`; header labels (not ids) in sort names and picker; checkbox semantics in picker and facet filter | Pseudo-locale story shows no English; axe clean; 1,000-row paginated+virtualized story reaches row 1,000 |

### Phase 1 — Grid interaction core (L)

| Item                           | Scope                                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| G1 `role="grid"` focus model   | Roving tabindex; arrows, Home/End, Ctrl+Home/End, PageUp/Down, header ↔ body, Tab out; overridable key map; `treegrid` when grouped |
| G2 Range selection + clipboard | v9 `cellSelection`: drag, Shift-extend, Ctrl add/subtract; Ctrl+C as TSV with formatted values, optional headers; Ctrl+A            |
| G3 Column reordering           | Drag (dnd-kit), Shift+←/→, lock position; `columnOrder` slice                                                                       |
| G4 Auto-size and flex          | Double-click to fit content, fit to grid, `flex`, continuous mode that respects user-sized columns                                  |
| G5 Column menu                 | Sort, pin, autosize, hide, reset, filter entry; built on `DropdownMenu`                                                             |
| G6 Context menu + status bar   | Copy, copy with headers, export, pin row; status bar with total / filtered / selected counts and range sum/avg/min/max              |
| G7 Row selection polish        | Shift+click ranges, click-to-select option, select-all modes                                                                        |

### Phase 2 — Filtering (M)

| Item                    | Scope                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| FL1 Column filter UIs   | Text / number / date (+ relative ranges) / boolean conditions with AND/OR; header filter button with active state              |
| FL2 Set filter          | Faceted unique values with counts, search, select all, (Blanks), date tree; replaces manual `FacetFilter` options              |
| FL3 Floating filter row | Inline inputs under headers                                                                                                    |
| FL4 Find                | Ctrl+F in grid, highlight all, next/prev, match count, expands groups                                                          |
| FL5 Filter builder      | Expression builder on components-ui `FilterChip` / `ViewToolbar` over the same filter model (the "Advanced filter" equivalent) |

### Phase 3 — Editing (L)

| Item                            | Scope                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1 Cell editing                 | Start on Enter / F2 / typing / double-click; commit on Enter / Tab; cancel on Esc; `onCellEdit` in read-only-edit style by default (controlled, React-native) |
| E2 Editors                      | Text, textarea, number, date / time, checkbox, select, combobox (async, virtualized, multi) using brand-ui inputs                                             |
| E3 Validation                   | Per-cell and per-row, inline error with `aria-invalid` and announcement, revert or block                                                                      |
| E4 Undo / redo                  | Edit, paste, fill, clear                                                                                                                                      |
| E5 Paste, fill handle, bulk ops | Paste into range with tiling; fill series; Ctrl+D, Ctrl+Enter, Delete                                                                                         |
| E6 Batch mode                   | Pending-value styling, commit / cancel all                                                                                                                    |

### Phase 4 — Analytics (L)

| Item                               | Scope                                                                                                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1 Grouping + aggregation          | Multi-level, group column, sticky group rows, group and grand totals (top / bottom / pinned), date-part grouping, drag-to-group panel                                   |
| A2 Tree data                       | `getSubRows` / parent-id; tri-state selection                                                                                                                           |
| A3 Master / detail                 | Full-width detail rows (any component, including a nested grid) with virtualization                                                                                     |
| A4 Pivot                           | Pivot columns with generated headers, row / column totals, "show values as"                                                                                             |
| A5 Integrated charts               | Chart a range or a group with `@elabs-ai/components-charts` in a popover or dashboard tile — where we can clearly beat AG Grid (their charts cost $1,498 per developer) |
| A6 Editorial visuals on aggregates | Bars, heatmaps and sparklines in group rows                                                                                                                             |

### Phase 5 — Data scale and live data (M)

| Item                     | Scope                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| D1 Transactions + flash  | `applyTransaction` equivalent keyed by id, async batching, changed-cell flash and delta renderer |
| D2 Infinite datasource   | Block cache, LRU, debounce during fast scroll, skeleton rows, retry                              |
| D3 Server grouping       | Lazy group children, server aggregates, select-all with exceptions                               |
| D4 Column virtualization | With pinned columns and grouped headers                                                          |
| D5 Worker row models     | Opt-in at a row-count threshold                                                                  |

### Phase 6 — Export and agent-native (M)

| Item                                | Scope                                                                                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| X1 Grid-aware CSV                   | Visible columns, order, labels, formatters, selection-only                                                                                                  |
| X2 XLSX                             | Lazy-loaded chunk: types, number formats, header styles, grouping outline, freeze panes                                                                     |
| X3 Print / PDF via print stylesheet |                                                                                                                                                             |
| AI1 `DataTable` in the A2UI catalog | Agent emits columns + data + view state, validated against the catalog                                                                                      |
| AI2 GridState JSON Schema           | Narrowed to what the current columns allow; the same contract AG Grid charges for as the "AI Toolkit", free and wired to A2UI and the `brand-ui` MCP server |
| AI3 Auto-generate columns           | From data (types, formats, visuals inferred), for agent-built surfaces                                                                                      |

**Existing building blocks.** components-ui already has `context-menu`, `tooltip`, `pagination`, `virtual-select`, `tree` / `tree-select` and `view-toolbar` (`FilterChip`, `ResultCount`), so the context menu, tooltips, rich pager, set filter and status bar are cheaper than their effort sizes suggest.

**Sequencing logic.** Phase 0 is non-negotiable: every later feature multiplies the render and memory costs we measured. Phase 1 (focus + ranges) is the platform for editing, clipboard, Find, charts-from-range and fill. Filtering comes before editing because every data app needs it and it is cheaper. Analytics before scale because TanStack already provides the client models.

---

## 9. What "best in class" means, measurably

| Dimension                                                      | AG Grid today                         | Target                                                                      |
| -------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| Bundle, full-featured                                          | ~740 KB gz (Enterprise)               | ≤ 200 KB gz for everything, ≤ 90 KB for the presentation table              |
| 100k rows, 4× CPU                                              | mount 1.1 s, 68 MB, 25 long frames    | mount ≤ 1.0 s, ≤ 80 MB, ≤ 15 long frames; sort / filter off the main thread |
| Price of grouping, pivot, clipboard, ranges, Excel, sparklines | $999–$1,498 per developer             | MIT                                                                         |
| Responsive / mobile                                            | none                                  | cards + `showAt` + touch ranges                                             |
| Keyboard + screen reader                                       | grid / treegrid, WCAG 2.0 AA          | grid / treegrid, WCAG 2.2 AA, announcements for sort, filter, edit, range   |
| Theming                                                        | ~300 grid-only params                 | brand-ui tokens shared with charts, maps and app shell                      |
| AI                                                             | schema toolkit (Enterprise), `ag-mcp` | A2UI catalog + state schema + MCP, free                                     |

---

## Appendix

### A1. AG Grid release timeline (last 16 months)

| Version | Date        | Headline features                                                                          |
| ------- | ----------- | ------------------------------------------------------------------------------------------ |
| 36.2.0  | 16 Sep 2026 | PDF export; Set Filter in Advanced Filter; continuous column auto-sizing                   |
| 36.1.0  | 5 Aug 2026  | Column header name editing; AI coding skill; Markdown docs                                 |
| 36.0.0  | 24 Jun 2026 | Calculated Columns; Show Values As; auto-generated columns; single native scroll container |
| 35.3.0  | 12 May 2026 | Quick Access Toolbar; Cell Notes; SSRM grand total                                         |
| 35.2.0  | 25 Mar 2026 | Aggregation editing; compact group column; deferred column tool panel                      |
| 35.1.0  | 11 Feb 2026 | Relative date filters; Formula Editor; BigInt                                              |
| 35.0.0  | 10 Dec 2025 | Formulas; row group dragging; absolute sort; column selection                              |
| 34.3.0  | 22 Oct 2025 | MCP server; AI Toolkit; date/time pivoting                                                 |
| 34.2.0  | 10 Sep 2025 | Date/time grouping; tool panels outside the grid                                           |
| 34.0.0  | 25 Jun 2025 | New Filters Tool Panel; cell editor validation; batch editing                              |
| 33.3.0  | 13 May 2025 | User row pinning; row height resizing                                                      |

The cadence (a minor every ~6 weeks, heavy spreadsheet-style features since 35.0) tells us where they are heading: Excel inside the grid. Formulas, notes and calculated columns are worth watching but belong after Phase 4.

### A2. Benchmark harness

Vite + React 19 + Tailwind v4 pages `ours.html` and `ag.html` (`?rows=N`), Playwright script measuring mount (from module-evaluation to double rAF after first cell), header-click sort, programmatic filter, 180-frame scripted scroll at 120 and 3,000 px/frame, DOM element count, `performance.memory`, with CDP CPU throttling. The scripts are saved beside this review in `docs/review/datatable-vs-ag-grid/bench/` (run `npm i` with the package list in §0, `vite build`, `vite preview`, then `node bench.mjs ours|ag <rows> <cpuThrottle> <px/frame>`; the two `mem-*.mjs` files contain absolute paths from the sandbox and need adjusting). F4 turns this into a CI job.

### A3. Sources

- AG Grid docs (v36.2.0): https://www.ag-grid.com/react-data-grid/ — including /grid-state/, /keyboard-navigation/, /accessibility/, /cell-selection/, /clipboard/, /grouping/, /pivoting/, /server-side-model/, /filter-set/, /find/, /formulas/, /calculated-columns/, /ai-toolkit/, /mcp-server/, /modules/, /theming-api/, /dom-virtualisation/, /data-update-high-frequency/
- What's new: https://www.ag-grid.com/whats-new/ · Pricing: https://www.ag-grid.com/license-pricing/
- TanStack Table v9 (npm `@tanstack/table-core@9.2.4`, features `cellSelectionFeature`, `cellSpanningFeature`, `experimental-worker-plugin`)
- Third-party context: https://www.1771technologies.com/blog/performance-benchmarks (vendor benchmark, treat as biased) · https://www.simple-table.com/blog/react-data-grid-bundle-size-comparison · https://mui.com/x/react-data-grid/ai-assistant/
