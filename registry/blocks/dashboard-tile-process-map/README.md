# `dashboard-tile-process-map` — a `ProcessMap` dashboard tile

A `DashboardTileKind` wrapping `ProcessMap` (`@elabs-ai/components-process`) so a dashboard
sheet (`@elabs-ai/components-charts/dashboard`) can show a live, selectable directly-follows
graph — the `process-map` kind the dashboard playbook (`docs/playbooks/dashboard.md` § 2
"Cross-package tile kinds") routes to. Copy-owned, not a package import: the dashboard subpath
itself never imports `@elabs-ai/components-process` (`dashboard-reuse` rule, D6) — this block is
the sanctioned way to put one inside a sheet.

## What it wraps

`ProcessMap` inside a `DashboardTileKind`'s `component` (the contract every tile kind
implements — `packages/charts/src/dashboard/dashboard-sheet/tile-registry.ts`). The sheet hands
the tile its `DashboardTileProps`: `tile.content` (which graph/log this tile shows), `selection`
(a `SelectionSnapshot`), `interactions`, and `emit`.

## Selection → node/edge dimming

Unlike the table tile, `ProcessMap` already ships its own `selectionStates?:
ProcessSelectionStates` prop (`packages/process/src/process-map/process-map.tsx`) using the
SAME tri-state vocabulary (`selected | associated | excluded`) the dashboard sheet's own
`selection`/highlight model uses — this block's mapping is close to the identity function: it
derives `ProcessSelectionStates` from the tile's `SelectionSnapshot` (which activities/edges are
selected vs. excluded by the sheet's active selection) and passes it straight through. Applying
or clearing a selection never adds or removes a node or edge — it only re-inks them, matching
`ProcessMap`'s own selection-vs-filter distinction.

## Node click → selection

`ProcessMap`'s `onSelect` fires `emit.select(field, values)`, publishing through the same
interaction graph every built-in tile publishes through (`resolveInteractions`,
`.claude/rules/dashboard.md` § "Interaction routing") — a click never mutates a driver directly.

## Config form

`configForm` (a `FormSpec`, `@elabs-ai/components-ui`) is what the properties panel
(`DashboardPropertiesPanel`) renders when this tile is selected in edit mode. This block ships
it with an empty `fields: []` — a seam, not a finished form; add fields for which metric layer
to draw by default, layout direction (`ProcessMap`'s own `direction`, `"TB"`/`"LR"`) or which
field the selection is keyed on, as your app needs.

## No discovery in the tile

Per D5, this block never runs `discoverGraph` on raw events itself — `tile.content` names which
already-discovered graph/log the host supplies (a query id, a dataset reference); a host that
wants live discovery runs `useProcessExplorer`/`discoverGraph` itself and feeds the result in,
same as `docs/examples/process-explorer-external-selection` does outside a sheet.

## Dependencies

`@elabs-ai/components-process` (`ProcessMap`), `@elabs-ai/components-charts/dashboard` (the
tile contract types). Declared in `registry/registry.items.json`; `pnpm gen` regenerates
`registry.json`'s `dependencies[]`/`files[]` — never hand-edit `registry.json`.

## Smoke story

`apps/docs/stories/blocks/dashboard-tile-process-map.stories.tsx`, "Dashboard / Recipes" —
selects a node and asserts the selected/excluded node counts; installs into
`fixtures/consumer-smoke` via `npx shadcn add dashboard-tile-process-map`.

## Related

- `docs/playbooks/dashboard.md` § 2 — the archetype and the cross-package tile-kind table.
- `packages/charts/src/dashboard/dashboard-sheet/tile-registry.ts` — the `DashboardTileKind`
  contract this block implements.
- `packages/process/src/process-map/process-map.tsx` — the real `selectionStates` prop.
