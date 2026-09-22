---
paths:
  - "packages/charts/src/dashboard/**"
---

# Dashboard surface (@elabs-ai/components-charts/dashboard)

Binding for everything under `packages/charts/src/dashboard/`. Decision record: ADR 0037
(`docs/ADR/0037-dashboard-surface-in-charts-subpath.md`). Source: analysis §5.4
(`docs/review/2026-09-16-dashboard-surface-analysis.md`). Machine check:
`pnpm check --rule dashboard-reuse`. Everything in `charts.md` still applies.

## Boundaries

- **Imports:** `dashboard/` imports `@elabs-ai/components-charts` code (relatively, inside the
  package), `@elabs-ai/components-ui`, `@elabs-ai/components-tokens` and
  `@elabs-ai/components-icons` — nothing else from `@elabs-ai/components-*`. Never `data`, `ai`,
  `flow`, `maps`, `process`, `viewer`, `terminal`, `editor` or `marketing`.
- **Tiles from other packages are host-registered.** A `table`/`chat`/`process-map` tile is a
  `DashboardTileKind` the host registers on `DashboardProvider`, or a copy-own registry block (D4).
  The tile-kind registry is the ONLY channel through which other packages' content reaches a sheet.
- **`core/` is framework-free:** no `react`, `react-dom`, `@dnd-kit/*`, zustand React bindings
  (`zustand`, `zustand/react`, `zustand/traditional`) or `@elabs-ai/components-*`. Only
  `zustand/vanilla` and `zustand/middleware` are allowed.
- **Barrel discipline:** the main `@elabs-ai/components-charts` barrel never re-exports from
  `dashboard/`; `dashboard/index.ts` re-exports only the dashboard surface. There is no public
  `/dashboard/core` subpath — core is re-exported from `/dashboard`.
- **Compose, never re-author:** no local component named like a `ui`/`charts` export, no raw
  `<svg|path|rect|circle|line|polygon|polyline|ellipse>` — marks come from chart families.
  One-line escape hatch: `// dashboard-reuse-exempt: <reason>`.
- **No tile owns fetching, timers or routing (D5).** `onRefresh`, `navigate` and `onChange` are
  host callbacks.

## Encoding

- **Selection is one tri-state vocabulary:** `selected | associated | excluded`, surfaced as a
  `data-selection` attribute — the encoding `@elabs-ai/components-process` ships. Never a fourth
  state or ink, and **no `--selection-*` tokens** (ADR 0037 §6). Excluded is ghosted at the shared
  ghost opacity PLUS a non-colour channel — a dashed frame at FULL opacity, never inside the ghost
  and never a hatch (decoration owns fill patterns) — and the state word in the accessible name.
  Selected is a compound `--chart-foreground`/`--chart-background` outline, never one series-like
  ink such as `--ring`.
- **Edit-mode chrome** (handles, ghost, marquee) paints in `--ring`/`--accent` at full opacity,
  one weight. The ghost is a dashed `CHART_HAIRLINE_WIDTH` outline, never a translucent fill over
  live charts. The cell grid (`ui.showGrid`) is one dot per cell corner in `--border-strong`,
  painted in the gap. The gesturing tile follows the pointer 1:1 (`session.pointer`); the ghost
  shows the snapped landing cell. Handles show on a SINGLE selection only.
- **Placement pushes, never merely rejects.** `editStrategy()` is `push` for both grid models:
  `flow` moves colliders down and compacts; `fit` moves each collider to the nearest free cells
  biased away from the drag (`nearestFreeSpot`), then tries `swap`, then grows an `extendable`
  sheet (`extendRows`, committed with `density: "custom"`). A drop is refused only when a
  collider has nowhere to go or is `static` — and the refused tile still previews where it
  would land, under the red ghost.
- **`TileLayout.static`** locks a tile: never moved/resized by the edit layer, never relocated
  by a push, an obstacle for `flow` compaction; it keeps focus, context menu and properties.
- **Banner tiles are `plain`.** A kind whose body is not a card (heading, divider) declares
  `capabilities.surface: "plain"` (+ `padding: "compact" | "none"`); edit mode outlines it with
  a dashed hairline. A header-less tile keeps its menu floating over the top-end corner
  (`ChartFrame`'s `chart-frame-menu-floating`), never a header row.
- **One set of tile operations.** Every edit action (duplicate, replace, library, clipboard,
  z-order, lock, properties, delete-with-undo) lives in `edit/tile-ops.ts` (`useTileOps`); the
  context menu, the header hover chrome and the toolbar's Layout menu call it — never a second
  copy of an action.
- **Density tiers are the only adaptation mechanism.** A tile never measures its own text to
  decide what to hide.
- **More than 12 tiles on a sheet → a dev-only console warning** (the charts "max 6 charts per
  page" guidance widened to a sheet).
- **Every tile root carries `data-tile-kind` and `data-tile-id`.**

## Defaults

`GridSpec`: `mode: "fit"`, `columns: 24`, `rows: 12` (fit), `rowHeight: 30` px (flow).
`DashboardSpec.version` is the literal `1` (ADR 0037 §7).

## Density tiers

The only adaptation mechanism (see Encoding above) — a tile's rendered pixel box picks its
tier, never its own text measurement: `xs` < 200×100 px, `sm` < 400×200, `md` < 800×400,
else `lg` (`DashboardTile`, `packages/charts/src/dashboard/dashboard-sheet/dashboard-tile.tsx`).
A tile kind reads its tier off `DashboardTileProps.density` (`ChartDensity`) — never
re-derives it from `size.width`/`size.height` itself.

## Edit-layer announcements

Every edit announcement (pick-up, move, drop, reject, resize, cancel, and the silent-clamp
and cancel-mid-gesture cases) goes to **one** polite live region per sheet
(`DashboardEditLayer`), so a screen reader hears one voice — never a second `role="status"`
region from a tile or a host. dnd-kit's own announcements are silenced
(`SILENT_ANNOUNCEMENTS`, `edit/announcer.ts`); its screen-reader drag instructions are kept
and localized. Every string routes through `t()` (`editMessages(t)`) — no literal English in
`edit/`.

## Presentation, conditions, theme override, workbook (RM-087)

- **`DashboardPresentation`** is the kiosk wrapper for an audience view — never fetches or
  routes itself (D5): `onRefresh`/`onExit` are host callbacks. Real OS fullscreen is requested
  only from a user gesture (its own "Present" button), never on mount. Auto-advance
  (`cycleMs`) is pausable (WCAG 2.2.2: hover or focus inside the surface stops it) and Escape
  is never the only way out.
- **`showCondition`** (sheet) and **`visibleWhen`** (tile) both evaluate through the one
  `visibleWhen` expression grammar (`core/expression.ts`) — no second condition syntax.
- **`DashboardThemeScope`** scopes `DashboardSpec.theme` via a nested `ThemeProvider` whose
  `attributeTarget` is its own root, never the page's provider — a sheet's theme never leaks
  onto the host app, and a lone `overrides` map falls back to the page's own active theme
  rather than silently reverting to `light`.
- **`DashboardWorkbook`** is the one multi-sheet container — one `useWorkbook` store per
  sheet, kept alive for the workbook's lifetime; only the active sheet's `DashboardSheet` is
  visible, others stay mounted `hidden` so edits survive switching away and back.

## Interaction routing (`fromTileId`)

`resolveInteractions(spec)` (`core/interactions.ts`, whose JSDoc is the binding text)
resolves `spec.interactions[]` into the effective emitter → consumer map: a tile-level
`consumes`/`emits` gate first, then explicit pair > `from → "*"` wildcard > default `filter`
(last entry of equal specificity wins), no self-interaction (`"*"` skips `from`,
`from === to` is ignored), and a write with **no** `fromTileId` (the filter tile, the
selection bar, an external driver, a bookmark) is global and always `filter`. A
`DashboardTileKind` never inspects `fromTileId` itself — it reads the resolved
`tile.selection`/`tile.hover` the sheet already scoped for it.
