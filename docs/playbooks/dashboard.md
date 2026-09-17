---
archetype: dashboard
intent: "KPI overview screen (static) or a drag-and-drop, user-editable grid of tiles (sheet) — metrics, charts and records in one screen"
keywords:
  [
    dashboard,
    kpi,
    metrics,
    overview,
    analytics,
    charts,
    reporting,
    summary,
    drill-down,
    sheet,
    editable dashboard,
    tiles,
    BI,
  ]
packages: ["@elabs-ai/components-ui", "@elabs-ai/components-charts", "@elabs-ai/components-data"]
---

# Playbook — Dashboard

Two different things share the name "dashboard" in this system, and picking the wrong one
wastes a day:

| You want…                                                                                                    | Archetype                    | Section                           |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------- | --------------------------------- |
| A fixed, developer-laid-out overview screen — KPI tiles, a couple of charts, a table                         | **Static dashboard**         | [§1](#1-static-dashboard)         |
| A drag-and-drop grid of tiles an END USER arranges, filters and selects across, with edit mode and bookmarks | **Editable dashboard sheet** | [§2](#2-editable-dashboard-sheet) |

A static dashboard is a layout you write once in JSX. A sheet is a **spec** — a serializable
`DashboardSpec` — that a store owns, a grid renders, and a person can rearrange at runtime; if
your screen has an Edit-mode toggle, drag handles, or a "the user builds their own view" story,
you want the sheet.

## 1. Static dashboard

Metrics-first overview screen: KPI tiles on top, charts in the middle,
a records table below. Template source: `templates/dashboard.tsx` (generated from
`templates-dashboard.stories.tsx` by `pnpm gen`).

### Building blocks

| Layer  | Components                                                                                | From                          |
| ------ | ----------------------------------------------------------------------------------------- | ----------------------------- |
| Shell  | `SidebarProvider` + `Sidebar` + `SidebarInset`                                            | `@elabs-ai/components-ui`     |
| KPIs   | `MetricGrid` + `MetricCard` (×3–5)                                                        | `@elabs-ai/components-charts` |
| Charts | `ChartFrame` wrapping `BarChart` / `LineChart` / `AreaChart` (or `AutoChart` from a spec) | `@elabs-ai/components-charts` |
| Table  | `DataTable` + `FilterBar` + `SearchInput`                                                 | `@elabs-ai/components-data`   |
| States | `Skeleton` (loading) · `EmptyState` (no results)                                          | `@elabs-ai/components-ui`     |

### Wiring diagram

```
SidebarProvider
├── Sidebar (nav items)
└── SidebarInset
    ├── header (SidebarTrigger + title)
    └── main  (flex-col gap-6 p-6)
        ├── MetricGrid columns={4} → MetricCard ×4      ← KPI hook
        ├── grid lg:grid-cols-2
        │   ├── ChartFrame → BarChart                    ← series hook
        │   └── ChartFrame → LineChart                   ← series hook
        └── DataTable + FilterBar (optional)             ← rows hook
```

Order matters: KPIs answer "how are we doing", charts answer "what's the
trend", the table answers "which records" — top to bottom, summary to detail.

### Minimal example (chart row)

```tsx
import {
  Bar,
  BarChart,
  BarXAxis,
  ChartFrame,
  ChartTooltip,
  Grid,
  Line,
  LineChart,
  XAxis,
} from "@elabs-ai/components-charts";

<div className="grid gap-6 lg:grid-cols-2">
  <ChartFrame title="Revenue by quarter" data={revenue}>
    <BarChart data={revenue} xDataKey="quarter">
      <Grid horizontal />
      <Bar dataKey="thisYear" fill="var(--chart-1)" />
      <Bar dataKey="lastYear" fill="var(--chart-2)" />
      <BarXAxis />
      <ChartTooltip />
    </BarChart>
  </ChartFrame>
  <ChartFrame title="Win rate trend" data={winRate}>
    <LineChart data={winRate} xDataKey="month">
      <Grid horizontal />
      <Line dataKey="rate" stroke="var(--chart-1)" />
      <XAxis />
      <ChartTooltip />
    </LineChart>
  </ChartFrame>
</div>;
```

`ChartFrame` adds expand / table-view / CSV-download for free when you pass
`data`. Series colors are `var(--chart-1..12)` only — they retheme with the app.

KPI tiles:

```tsx
<MetricGrid columns={4}>
  <MetricCard label="Pipeline value" value="$4.2M" delta="+8.2%" deltaDirection="up" />
  <MetricCard
    label="Cycle time"
    value="32d"
    delta="+2d"
    deltaDirection="up"
    positiveIsGood={false}
  />
</MetricGrid>
```

### Decisions you own

Theme · nav sections · which 3–5 KPIs · chart types per question
(comparison → bar, trend → line/area, share → ring/pie) · table columns,
default sort, page size.

### Decisions already made — don't re-make

Shell composition (`SidebarProvider` wraps everything) · spacing rhythm
(`gap-6 p-6`) · chart colors (`--chart-N` tokens) · `ChartFrame` for any
chart a user might want to expand/export · `tabular-nums` on numeric cells ·
loading = `Skeleton` per tile, never a blank grid.

### Common mistakes

- Charts without `ChartFrame` — you lose expand/CSV and the card chrome.
- Raw hex series colors — breaks both themes; use `var(--chart-N)`.
- Hand-rolling the KPI tile — `MetricCard` is the canonical tile (ADR 0012).
- Skipping the empty state when filters return zero rows.
- Reaching for this archetype when what you actually need is an END-USER-editable grid — that
  is §2, not a bigger version of this one.

## 2. Editable dashboard sheet

A spec-driven grid of tiles (KPIs, charts, filters, text, and host-registered kinds like a
table or a chat panel) that a person rearranges, resizes, selects across and saves — the
building block behind a Qlik/Power-BI-shaped "my dashboard" screen. Ships as its own subpath,
`@elabs-ai/components-charts/dashboard` (ADR 0037), so the plain `charts` barrel stays free of
the drag/selection machinery a static dashboard never needs. Template source:
`templates/dashboard-sheet.tsx` (generated from `templates-dashboard-sheet.stories.tsx` by
`pnpm gen`) — the canonical full-screen composition: `SidebarProvider`/`Sidebar`/`SidebarInset`
app chrome (the same shell §1's static dashboard uses) + toolbar + selection bar +
asset/properties panels + the sheet itself.

### Building blocks

| Slot                                 | Component                                                                                                   | From                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| App chrome                           | `SidebarProvider` + `Sidebar` + `SidebarInset`                                                              | `@elabs-ai/components-ui`                                |
| State owner (wraps everything below) | `DashboardProvider`                                                                                         | `@elabs-ai/components-charts/dashboard`                  |
| Mode switch, undo/redo, Save         | `DashboardToolbar`                                                                                          | `@elabs-ai/components-charts/dashboard`                  |
| Active selection chips, bookmarks    | `DashboardSelectionBar`                                                                                     | `@elabs-ai/components-charts/dashboard`                  |
| The grid itself                      | `DashboardSheet`                                                                                            | `@elabs-ai/components-charts/dashboard`                  |
| Left dock — drag tiles onto the grid | `DashboardAssetPanel`                                                                                       | `@elabs-ai/components-charts/dashboard`                  |
| Right dock — edit the selected tile  | `DashboardPropertiesPanel`                                                                                  | `@elabs-ai/components-charts/dashboard`                  |
| Built-in tile kinds                  | `kpi`/`metric`, `chart`, `filter`, `text`, `heading`, `image`, `button`, `divider`, `container`, `variable` | `@elabs-ai/components-charts/dashboard` (`builtInTiles`) |
| Cross-package tile kinds             | `table`, `chat`, `process-map`                                                                              | copy-own registry blocks (see below)                     |

### Wiring diagram

```
SidebarProvider
├── Sidebar (nav items)
└── SidebarInset
    ├── header (SidebarTrigger + title)
    └── DashboardProvider spec={spec} tiles={registry} onChange={...}  ← owns ONE store for this sheet
        └── div (flex-col, min-h-0 flex-1)
            ├── DashboardToolbar        (mode switch · undo/redo · Add · Save)
            ├── DashboardSelectionBar   (selection chips · Step back/forward · Bookmarks)
            └── div (flex, min-h-0 flex-1)
                ├── DashboardAssetPanel        (open={ui.assets} — drag a kind onto the grid)
                ├── div (min-w-0 flex-1 overflow-auto)
                │   └── DashboardSheet renderAll   ← renders every visible tile at its cellRect
                └── DashboardPropertiesPanel   (open={ui.properties} — edits the selected tile's `configForm`)
```

`DashboardAssetPanel`/`DashboardPropertiesPanel`'s `open`/`onOpenChange` are wired to the
store's own `ui.assets`/`ui.properties` slice (`useDashboard`/`useDashboardActions`,
the SAME `actions.setPanel` the toolbar's Add button and a tile's "Edit" menu item call) — a
consumer screen keeps both docks in sync with the toolbar/tile actions by reading that slice
itself, not by inventing separate open/close state.

`DashboardProvider` is the one state owner: every hook (`useDashboard`, `useDashboardActions`,
`useSelection`, `useTile`, `useVariable`, `useHover`) and every chrome piece
(`DashboardToolbar`, `DashboardSelectionBar`, the two panels) reads the SAME store through
context — nothing above is prop-drilled past `DashboardProvider` itself. Give the sheet's host
element a **definite height** (`h-dvh`, `flex-1 min-h-0`, a fixed panel) or it falls back to a
scrolling, square-celled layout (`data-fill="host"` vs. `"square"` on the sheet says which
applied — `packages/charts/src/dashboard/README.md` § Rendering).

### Minimal example

```tsx
import {
  DashboardProvider,
  DashboardSheet,
  DashboardToolbar,
  DashboardSelectionBar,
  builtInTiles,
} from "@elabs-ai/components-charts/dashboard";

<DashboardProvider spec={spec} tiles={builtInTiles} onChange={saveSpec}>
  <DashboardToolbar onSave={saveSpec} />
  <DashboardSelectionBar />
  <div className="h-dvh min-h-0 flex-1">
    <DashboardSheet />
  </div>
</DashboardProvider>;
```

Registering a cross-package kind (a `table` tile wrapping `DataTable`) merges it with the
built-ins instead of replacing them:

```tsx
import { createTileRegistry, builtInTiles } from "@elabs-ai/components-charts/dashboard";
import { dashboardTileTable } from "./registry/dashboard-tile-table";

const tiles = createTileRegistry([...builtInTiles, dashboardTileTable]);
```

### Decisions you own

- **Grid mode:** `fit` (a Qlik-style sheet that always fills its host, no scrolling) vs. `flow`
  (a fixed `rowHeight`, the sheet grows and the page scrolls). Default: `fit`, `24` columns,
  `12` rows.
- **Density:** the tier thresholds (`xs`/`sm`/`md`/`lg`) are fixed — what you choose is which
  tile kinds you ship at which `defaultSize`/`minSize`, since a kind that never fits `md` never
  shows its richer layout.
- **Which tile kinds** a sheet needs: the built-ins cover KPI/chart/filter/text/layout; a
  `table`/`chat`/`process-map` tile is a deliberate, per-app choice (copy-own, not a package
  dependency — see "already made" below).
- **The selection driver:** the bundled `createLocalSelectionDriver()` (in-memory intersection,
  prototype scale) vs. your own `SelectionDriver` over a host's associative engine (`core/
selection.ts`; worked example: `packages/charts/src/dashboard/examples/engine-driver/`).
- **Persistence:** `DashboardProvider`'s `onChange`/`onSelectionChange`/`initialState` are all
  host-driven props (D5) — where the spec, the URL share-state and bookmarks are actually
  stored is entirely yours. See `packages/charts/src/dashboard/README.md` § State persistence
  for the shape of each seam.

### Decisions already made — don't re-make

- **Import from the `/dashboard` subpath, never the `charts` root** — the drag/selection
  machinery does not belong in every chart consumer's bundle.
- **Selection is one tri-state vocabulary** (`selected | associated | excluded`), surfaced as
  `data-selection` — never a fourth state, never a bespoke `--selection-*` token.
- **Tile chrome belongs to the sheet, not the tile kind.** `DashboardTile` wraps a kind's
  component in `ChartFrame chrome="tile"` and supplies the header/menu — a kind only opts into
  owning its own `ChartFrame` via `capabilities.frame` when it genuinely needs to (e.g. it
  wants "View data"/"Download" scoped to something other than the tile's raw content).
- **≤ 12 tiles per sheet** — the same "max 6 charts per page" discipline (`.claude/rules/
charts.md`) widened for a sheet; past it, a dev-only console warning fires.
- **No tile fetches its own data, owns a timer, or routes** (D5) — `onRefresh`, `emit.navigate`
  and `emit.action` are host callbacks the tile calls, never an effect the tile runs itself.
- **A `table`/`chat`/`process-map` tile kind is host-registered or copy-own, never an import
  inside `dashboard/`** (`dashboard-reuse` rule) — the package composes `charts`/`ui`/`tokens`/
  `icons` only.

### Cross-package tile kinds (copy-own)

A `DashboardTileKind` wrapping a component from `data`, `ai` or `process` cannot live inside
`@elabs-ai/components-charts/dashboard` itself (D6, the one-way dependency graph) — it is a
copy-own registry block (D4) your app installs and can edit. Three ship as blocks:

| Block                        | Wraps                                         | Selection → dimming                                                                                                                                                       | Row/node click                               |
| ---------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `dashboard-tile-table`       | `DataTable` (`@elabs-ai/components-data`)     | The block computes each row's tri-state from `SelectionSnapshot` and passes it through `DataTable`'s `rowClassName` — `DataTable` itself has no `selectionStates` prop.   | `onRowClick` → `emit.select(field, [value])` |
| `dashboard-tile-chat`        | `ChatShell` (`@elabs-ai/components-ai`)       | N/A — gates the composer instead: `interactions.active` false → the input is `aria-disabled`.                                                                             | —                                            |
| `dashboard-tile-process-map` | `ProcessMap` (`@elabs-ai/components-process`) | `ProcessMap` already has a real `selectionStates` prop (`ProcessSelectionStates`) — the block maps the tile's `SelectionSnapshot` straight onto it, same tri-state names. | `onSelect` → `emit.select(field, values)`    |

Install one with the repo's registry path (`npx shadcn add dashboard-tile-table`, per
`docs/REGISTRY_GUIDELINES.md`), then register it alongside the built-ins as shown above. Each
block's own `README.md` documents its `configForm` fields and the exact selection field it
reads.

### Common mistakes

- Registering a `data`/`ai`/`process` tile kind **inside** the dashboard package instead of
  reaching for the block — it fails the `dashboard-reuse` gate and, worse, drags a whole
  package's dependency tree into every consumer of `/dashboard`.
- Hand-rolling a filter tile instead of using the built-in `filter` kind — filtering already
  goes through the selection driver; a bespoke one bypasses `SelectionSnapshot` and the
  selection bar stops seeing it.
- Storing ROWS (or any fetched data) inside `TileSpec.content` — a spec is meant to be small and
  shareable (it round-trips through a URL, `core/url.ts`). Pass rows through the kind's own
  content shape as a reference (a query id, a field name) or a host-provided cache, never the
  raw dataset.
- Passing a `selectionStates`-shaped prop straight through to `DataTable` expecting it to
  exist — it doesn't; the table block computes the per-row class itself (see the table above).
- Skipping `driver={...}` on `DashboardSelectionBar` when you already swapped
  `DashboardProvider`'s own `driver` — the bar's Step back/forward flags come from ITS OWN
  driver prop, not the provider's; pass the SAME instance to both.
- Giving the sheet's host element no definite height and being surprised it scrolls with
  square cells instead of filling the viewport — see "Wiring diagram" above.

### Presentation mode, conditions, theme override, workbook (RM-087)

Four more `@elabs-ai/components-charts/dashboard` surfaces sit alongside the editing
experience above — none of them change the editing wiring diagram, they compose around it:

- **Presentation mode:** `DashboardPresentation` is a kiosk wrapper for an audience view —
  full-bleed, no toolbar/asset/properties chrome. Pass one already-composed sheet (typically
  `DashboardProvider` wrapping `DashboardSheet chrome={false}`, no `DashboardSelectionBar`) as
  `children`, or several as `sheets` to auto-advance/step through with `cycleMs`. Real OS
  fullscreen is requested only from its "Present" button (a user gesture), never on mount.
- **Conditional visibility:** a sheet's `showCondition` and a tile's `visibleWhen` (both the
  `visibleWhen` expression grammar, `core/expression.ts`) hide a sheet or tile without deleting
  it from the spec — evaluated wherever the spec is rendered (`DashboardSheet`, `DashboardWorkbook`).
- **Theme override:** `DashboardThemeScope` applies a sheet's own `DashboardSpec.theme` to its
  subtree through a nested, scoped `ThemeProvider` (not the page's own provider) — wrap a
  sheet's rendered content in it when that sheet's `theme` should differ from the host app's
  active theme. No `theme` set: children render unwrapped, inheriting the page theme.
- **Workbook (multi-sheet):** `DashboardWorkbook` hosts several sheets with tab navigation
  (`WorkbookNav`) and `useWorkbook`, keeping one store per sheet alive for the workbook's
  lifetime so edits on an inactive sheet survive switching away and back.

## References

`packages/charts/src/dashboard/README.md` (full API, state-persistence seams, drivers, BI-host
embedding) · `.claude/rules/dashboard.md` (binding rules, encoding, density tiers, interaction
routing) · ADR 0037 (`docs/ADR/0037-dashboard-surface-in-charts-subpath.md`) ·
`docs/CONSUMING.md` § 6 (install + peer setup) · `docs/REGISTRY_GUIDELINES.md` (copy-own
blocks).
