---
paths:
  - "packages/data/**"
  - "packages/process/**"
---

# Data (@elabs-ai/components-data) + process mining (@elabs-ai/components-process)

## Data components

- **TanStack Table is the engine** — `DataTable` owns the `useReactTable` instance. Every
  slice of `DataTableViewState` is independently controllable; uncontrolled ones seed once
  via `initialView`, never TanStack `initialState`.
- Toolbar via render-prop: `toolbar={(table) => …}` hands the instance to `SearchInput`/
  `FacetFilter`/`ColumnPicker`. `SearchInput`/`FacetFilter` are controlled.
- Pinning/resizing/selection are LAYOUT, not queries — never in `DataTableServerArgs`; they
  DO join the saved-view snapshot. Column pinning: `columnPinning`/`onColumnPinningChange`,
  never a per-`ColumnDef` `pin` field; every pinned column declares an explicit `size`.
- Row selection: `createSelectionColumn<TData>()` for the checkbox column — never hand-roll
  one. `getRowId` guards against `data` reference replacement — required under
  `manualPagination`.
- Server-side: `manualSorting`/`manualFiltering`/`manualPagination` delegate a slice;
  re-fetch in `onServerChange`. Controlled ≠ manual — a controlled slice with `manual*`
  unset still sorts/filters/pages locally. The component never fetches.
- Virtualization (`enableRowVirtualization`, >~50 rows) is exclusive with `enablePagination`.
- Accessibility: real `<table>` semantics, sortable headers are `<button>`s with `aria-sort`;
  virtualized rows carry `aria-rowcount`/`aria-rowindex`, spacer rows `aria-hidden`.

## Process mining (`@elabs-ai/components-process`) — the one layer-3 package (ADR 0034)

- **Primitives go DOWN, compositions go UP.** The package never contains a generic
  edge/mark/table/scale/control — only domain model + coordinated behaviour + compositions
  meaningful solely as process-mining views. A missing primitive is an architectural finding
  routed to the base package (`flow`/`charts`/`data`/`ui`/`tokens`/`icons`), never a local copy.
- May import `-tokens`/`-icons`/`-ui`/`-flow`/`-charts`/`-data`; may NOT import `-ai`/`-maps`/
  `-marketing`/`-editor`/`-viewer`/`-terminal`. Nothing depends on `process`. Process map
  builds on `flow`'s `CanvasShell`, never ai's `Canvas`.
- `/core` (event-log model, DFG derivation, variant grouping, conformance math) is
  framework-free: no React/React Flow/visx/`@elabs-ai/components-*` import, pure and
  deterministic (no `Date.now()`/randomness/I/O).
- `pnpm process:reuse:check` fails a name collision with `ui`/`flow`/`charts`/`data`, a raw
  SVG primitive, an unwrapped `@xyflow/react` export, a sideways import, or an engine in
  `/core`. Escape hatch: `// process-reuse-exempt: <reason>`.
- `pnpm process:test-double:check` guards `/test`: double completeness, engine isolation,
  `exports`/`publishConfig.exports`/`tsup.config.ts` wiring, manifest exclusion.

History: `docs/rules-history/data-components.md`, `process-components.md`.
