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

## State persistence

D5 (`docs/DECISIONS.md`, ADR 0007): brand-ui renders models — it never owns storage,
transport or routing. Every persistence seam here is a prop the host drives; nothing in
`dashboard/` reads `localStorage`, calls `fetch`, or touches `window.history` itself.

- **Spec edits** (`DashboardProvider`'s `onChange(spec, meta)`): the host owns saving. `meta.conflict`
  says a new `spec` prop arrived while the store was dirty (`meta.incoming` is what lost);
  `meta.reason` says WHY when the store itself knows — currently only `"bookmark"`
  (`saveBookmark` with `bookmarks.storage === "spec"`). `autosaveMs` (default `0`, immediate)
  debounces `onChange` trailing-edge, so a host writing on every call does not thrash storage
  during a drag; a pending call is flushed on unmount, never dropped.
- **Selection + variables** (`DashboardProvider`'s `onSelectionChange(selection, variables)`):
  fires on either changing. Selection/variable changes never touch history and never call
  `onChange` on their own — wire this separately when a host wants to react to them (write a
  URL, say) without listening for spec edits too.
- **A share link** (`core/url.ts`, `encodeDashboardState`/`decodeDashboardState`): pure,
  versioned (`v1`), URL-safe, never throws — bad or oversized (> 8 kB) input decodes to `null`.
  `dashboard-sheet/use-dashboard-url-state.ts`'s `useDashboardUrlState()` reads the live
  `{ encoded, apply }` off the store; it never touches `window`/a router itself — a host wires
  `encoded` to `URLSearchParams`, nuqs or TanStack Router's search-param state (all three read
  the same way: `apply(value)` on mount/navigation, write `encoded` on every render).
  `DashboardProvider`'s `initialState` prop applies a decoded value once, after the selection
  driver is ready (`SelectionDriver.ready`, optional — the bundled local driver resolves it
  immediately; a host engine driver with async setup can defer it).
- **Bookmarks** (`BookmarkSpec`: selection + variables + optional sheet — never layout, matching
  Qlik's own bookmark model): `applyBookmark(id)` restores one from `spec.bookmarks`.
  `saveBookmark(label)` (`core/store.ts`) always returns the new `BookmarkSpec`;
  `DashboardProvider`'s `bookmarks?: { storage: "spec" | "host" }` decides whether it is ALSO
  appended to `spec.bookmarks` (`"spec"`, one history entry, `onChange` reason `"bookmark"`) or
  left for the host to persist itself (`"host"`, the default) — `DashboardSelectionBar`'s "Save
  bookmark…" calls `onSaveBookmark(snapshot, variables)` either way; the host decides what that
  callback does with it.
- **The recipe, not a feature:** `dashboard-sheet.stories.tsx`'s "Persist to localStorage
  (recipe)" story shows the shape — `onChange` writes, the initial `spec` prop reads, every
  `localStorage` access wrapped in try/catch (it can be disabled or full) — copy it, brand-ui
  ships no storage adapter.

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
