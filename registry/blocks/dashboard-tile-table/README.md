# `dashboard-tile-table` — a `DataTable` dashboard tile

A `DashboardTileKind` wrapping `DataTable` (`@elabs-ai/components-data`) so a dashboard sheet
(`@elabs-ai/components-charts/dashboard`) can show a live, selectable table of records — the
`table` kind the dashboard playbook (`docs/playbooks/dashboard.md` § 2 "Cross-package tile
kinds") routes to. Copy-owned, not a package import: the dashboard subpath itself never imports
`@elabs-ai/components-data` (`dashboard-reuse` rule, D6) — this block is the sanctioned way to
put one inside a sheet.

## What it wraps

`DataTable` inside a `DashboardTileKind`'s `component` (the contract every tile kind
implements — `dashboard-sheet/tile-registry.ts`). The sheet hands the tile its
`DashboardTileProps`: `tile.content` (this kind's own, versioned config — column set, row
source), `selection` (a `SelectionSnapshot`), `interactions`, and `emit`.

## Selection → row dimming

`DataTable` has no `selectionStates` prop of its own — this block computes each row's tri-state
(`selected | associated | excluded`) from the tile's `selection` snapshot against its own
selection field, and applies it through `DataTable`'s `rowClassName={(row) => string}` prop
(`packages/data/src/data-table/data-table.tsx`), the same tri-state vocabulary and ink rules
`.claude/rules/dashboard.md` binds for every other tile kind (ghosted at the shared ghost
opacity plus a non-colour channel for excluded; a compound outline for selected — never a
`--selection-*` token).

## Row click → selection

`DataTable`'s `onRowClick` fires `emit.select(field, [rowValue])`, publishing through the same
interaction graph every built-in tile publishes through (`resolveInteractions`,
`.claude/rules/dashboard.md` § "Interaction routing"). A click never mutates a driver directly —
`emit.select` is the one write path, so the selection bar, other consumer tiles and a host
engine driver all see it the same way regardless of which tile kind produced it.

## Config form

`configForm` (a `FormSpec`, `@elabs-ai/components-ui`) is what the properties panel
(`DashboardPropertiesPanel`) renders when this tile is selected in edit mode. This block ships
it with an empty `fields: []` — a seam, not a finished form; add fields for column
visibility/order and which field the row-click selection writes to, and keep them in sync with
`defaultContent`'s shape.

## No fetching in the tile

Per D5, this block never fetches rows itself — `tile.content` names _what_ to show (a query id,
a field/column set) and the host supplies the actual rows, either inline in `content` for a
small/static table or through a host cache the block reads by reference. `emit.refresh()` is
how the tile asks the host to refetch; it makes no network call on its own.

## Dependencies

`@elabs-ai/components-data` (`DataTable`), `@elabs-ai/components-charts/dashboard` (the tile
contract types). Declared in `registry/registry.items.json`; `pnpm gen` regenerates
`registry.json`'s `dependencies[]`/`files[]` — never hand-edit `registry.json`.

## Smoke story

`apps/docs/stories/blocks/dashboard-tile-table.stories.tsx`, "Dashboard / Recipes" — selects a
value and asserts the dimmed-row count; installs into `fixtures/consumer-smoke` via
`npx shadcn add dashboard-tile-table`.

## Related

- `docs/playbooks/dashboard.md` § 2 — the archetype and the cross-package tile-kind table.
- `packages/charts/src/dashboard/dashboard-sheet/tile-registry.ts` — the `DashboardTileKind`
  contract this block implements.
- `packages/data/src/data-table/data-table.tsx` — `rowClassName`/`onRowClick`.
