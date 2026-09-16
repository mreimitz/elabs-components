# `dashboard/` — the dashboard sheet surface

Public entry points (ADR 0037, `docs/ADR/0037-dashboard-surface-in-charts-subpath.md`):

- `@elabs-ai/components-charts/dashboard` — the sheet surface (`index.ts`).
- `@elabs-ai/components-charts/dashboard/test` — the engine-free test double (`test/index.ts`).

The main `@elabs-ai/components-charts` barrel never re-exports anything from this folder.

## Layout

| Folder             | Holds                                                                                      | Item           |
| ------------------ | ------------------------------------------------------------------------------------------ | -------------- |
| `core/`            | framework-free spec, validator, layout engine, store, history, selection driver, URL codec | RM-070, RM-071 |
| `dashboard-sheet/` | `DashboardProvider`, `DashboardSheet`, `DashboardTile`, hooks                              | RM-074         |
| `tiles/`           | built-in tile kinds (content at or below `charts` only)                                    | RM-075         |
| `edit/`            | edit layer (`@dnd-kit/core`), resize handles, keyboard, announcements                      | RM-078         |
| `chrome/`          | toolbar, selection bar, asset and properties panels                                        | RM-076 onward  |
| `test/`            | engine-free test double                                                                    | RM-077         |

## Rendering

`DashboardProvider` creates one store per sheet (normalised spec) and provides
`{ store, registry }`. When the `spec` prop changes identity and the store is clean, the new
spec replaces it and becomes the saved baseline; when the store is dirty the edits win and
`onChange(spec, { conflict: true, incoming })` fires. Hooks: `useDashboard(selector, equality?)`,
`useDashboardActions()`, `useTile(id)`, `useSelection(field?)`, `useVariable(name)`, `useHover()`,
`useCellRect(cell)`.

`DashboardSheet` measures its width and positions every visible tile (`visibleWhen` via
`compileCondition`) at `cellRect` with absolute transforms. Height: `fit` fills its host like a
Qlik sheet — the sheet is `h-full`, so a host with a definite height is split into `rows` (row
height = host height ÷ rows, column width = host width ÷ columns, no scrolling). **Fallback:** a
host with no definite height (auto-sized, so the sheet measures 0) gets square cells
(`rows × cell width`) drawn by an in-flow spacer, and the page scrolls; `data-fill="host" |
"square"` on the sheet says which applied. Give the host a height (`h-dvh`, `flex-1 min-h-0`, a
fixed panel) to get the no-scroll sheet. `flow` is the lowest tile bottom. Containers render as `ui/Tabs` over an inner
grid `layout.w` columns wide. One roving tab stop spans the tiles (arrow keys, Home, End, reading
order). Tile bodies mount once they enter a one-viewport band around the nearest scroller
(`renderAll` mounts all).

`DashboardTile` composes `ChartFrame chrome="tile"`: `DashboardTileHeader` goes into `headerSlot`
and `DashboardTileMenu` (hover toolbar + kebab) into `menuSlot`, so there is one header. A kind
with `capabilities.frame` renders its own `ChartFrame` and spreads `props.frame`. Density: `xs` <
200×100 px, `sm` < 400×200, `md` < 800×400, else `lg`. Interactions: view mounts
passive/active/select; edit mounts only edit. An unknown kind renders a `ui/StatePanel` naming it.

## Rules

Binding rules: `.claude/rules/dashboard.md`. Machine check: `pnpm check --rule dashboard-reuse`
(imports only `charts`, `ui`, `tokens`, `icons`; no raw SVG; no local component named like a
`ui`/`charts` export; `core/` imports no React, zustand React bindings or dnd-kit).

A `table`, `chat` or `process-map` tile is registered by the host or shipped as a copy-own registry
block — never imported here.

## Interactions (RM-082)

`resolveInteractions(spec)` (`core/interactions.ts`, whose JSDoc is the binding text) resolves
`spec.interactions[]` into the effective emitter → consumer map. Precedence:

1. Tile-level `consumes`/`emits` gate, `interactions[]` refines. Only a tile declaring
   `consumes.selection` is a consumer; a pair to any other tile is dropped, and such a tile keeps
   seeing every driver selection. Only a tile declaring `emits.selection` publishes through the
   graph.
2. Explicit pair > `from → "*"` wildcard > default `filter`; the last entry of equal specificity
   wins. No `interactions` = today's behaviour.
3. No self-interaction: `"*"` skips `from`, `from === to` is ignored; the emitter always sees its
   own click.
4. A write without a source tile (`select(field, values, opts)` — filter tile, selection bar,
   external driver, bookmark) is global and always `filter`.

Effects: `filter` goes through the driver (a chip); `highlight` paints `selected`/`excluded`
through the same `selectionStates` tri-state from the store's ephemeral `highlight` slice, with no
driver selection (no history, not persisted); `none` shields the target from that emitter's
selection and highlight; `drill` calls the host's `onNavigate(sheetId, { carry })` (D5).
`DashboardTile` computes each tile's view with `tileSelectionView` and marks a highlight target
with `data-highlighted` (a test/host hook; nothing is styled off it). Edit pairs with
`DashboardInteractionsEditor` (a matrix up to 12 tiles, a list above) or
`DashboardInteractionsDialog`.

## Drivers (RM-085)

`DashboardProvider`'s `driver` prop (default `createLocalSelectionDriver()`) is the ONLY thing
that computes selection state — the sheet reads `SelectionDriver.getSnapshot()` and never
intersects rows itself. The bundled local driver is synchronous, owns no history beyond a plain
selection ring, and needs `register(tileId, rows, fields)` to know which tiles share which field.
A host with its own associative engine (a Qlik-shaped `SelectionObject`, or any BI platform's
selection API) replaces the driver wholesale instead: implement `SelectionDriver`
(`core/selection.ts`) over your engine's own client, same as
`examples/engine-driver/create-engine-driver.ts` does over a mock one.

That example exists specifically to prove the seam against the HARD case: a driver that is
**asynchronous** (an engine answers `select` later, through its own event) and **owns its own
history** (an associative engine's `back`/`forward` are not the local driver's selection ring, and
neither is the store's OWN `history` — that field is the layout/edit undo stack, and a selection
made through any driver never pushes a step onto it). Read
`examples/engine-driver/mock-engine.ts` and `create-engine-driver.ts` for the worked adapter, and
`examples/engine-driver/engine-driver.stories.tsx` ("Dashboard/Recipes/External engine driver")
for it driving `DashboardSheet` and `DashboardSelectionBar` end to end, with a side panel proving
the sheet renders the engine's own `getStates()` output unmodified.

`DashboardSelectionBar`'s Step back/forward buttons need the SAME driver instance passed as their
own `driver` prop to reflect `canBack()`/`canForward()` correctly (`SelectionBarDriver`,
`chrome/dashboard-selection-bar.tsx`) — the store itself does not mirror those two flags.

## Embedding in a BI host (RM-085)

Two seams let a sheet sit inside a larger BI platform's mashup rather than only a standalone
prototype:

- **Selection** — swap the `driver` prop, as above. Every built-in tile kind (`filter`, `chart`,
  the selection bar) already reads/writes through `SelectionSnapshot`/`SelectionDriver`, never a
  concrete engine, so nothing else in the sheet changes.
- **Rendering a host's own object** — `DashboardProvider`'s optional `host?: Record<string,
unknown>` prop (`dashboard-sheet/dashboard-provider.tsx`) passes opaque, host-defined values down
  to a tile kind through context; the sheet itself never reads or interprets `host` (D5). This is
  how `examples/qlik-object-tile/` mounts a nebula.js visualisation: its `qlik-object` tile kind
  reads `host.renderObject` and calls it with the mounted element, the tile's `objectId`, and
  `{ interactions }` — `DashboardTileProps.interactions` (`Required<ChartInteractions>`,
  `{ passive, active, select, edit }`) is IDENTICAL in shape to nebula.js's own `Interactions`
  type, so the mapping is the identity function, not a translation layer. See
  `examples/qlik-object-tile/README.md` for the worked `host` object and the view/edit interaction
  split.

Neither seam adds a runtime dependency to this package: no `@nebula.js/*` import anywhere, and
the associative-engine example's `MockEngine` is a fixture, not an SDK (`.claude/rules/
dashboard.md`'s import boundary — `dashboard/` imports only `charts`/`ui`/`tokens`/`icons`).
