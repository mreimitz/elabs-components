---
paths:
  - "packages/data/**"
  - "packages/process/**"
---

# Data (@elabs-ai/components-data) + process mining (@elabs-ai/components-process)

## Data components

- **TanStack Table v9 is the engine** — `DataTable` owns the `useTable` instance; its feature
  set is built once (`createDataTableFeatures`, `data-table/tanstack.ts`). Import TanStack
  names ONLY through `data-table/tanstack.ts`, which keeps the v8-shaped public types
  (`ColumnDef<TData, TValue>`, `{ left, right }` pinning, `Record<string, boolean>` selection,
  v8 `sortingFn` → v9 `sortFn`). Every
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
- Virtualization (`enableRowVirtualization`, >~50 rows) wins over `enablePagination` (all rows
  stay reachable). The virtualizer calibrates its estimate from its own first measurements;
  `rowHeight` (fixed px) skips measurement for the fastest large-data path.
- Performance budget: `fixtures/grid-bench` renders DataTable from source next to AG Grid
  Community in real Chromium (`node bench.mjs ours|ag <rows> <cpuThrottle> <px/frame>`).
- Accessibility: real `<table>` semantics, sortable headers are `<button>`s with `aria-sort`;
  virtualized rows carry `aria-rowcount`/`aria-rowindex`, spacer rows `aria-hidden`.

## DataTable presentation layer (per-column `meta`)

- **Cell visuals live in `data` and never import `charts`.** `meta.visual` (`bar`,
  `sparkline`, `columns`, `heatmap`), `meta.format`, `meta.colorBy`, `meta.markdown` are
  drawn by `data`'s own cells (`cells/`); colours come from `colorScaleFor`
  (`@elabs-ai/components-ui`, shared with `charts`/`maps`) as `var(--chart-…)` tokens.
  Scales are computed once over ALL rows (never the page), so a colour or bar length
  means the same thing on every page and after every sort.
- Every visual cell keeps its value in the accessible tree (printed, or `sr-only` with
  `hideValue`); the SVG/bar is `aria-hidden`. Sort reads the raw value, never the visual.
- **One printed-label box per COLUMN, never per row** (`labelBoxCh`, in `ch`, over all
  rows). A visual draws in what its value text leaves over, so a per-row box gives the row
  with the shorter number the longer track — it then draws a longer bar for a smaller
  value, and a diverging column's zero rule lands on a different x in every row.
- **The table breakpoint is a deliberate copy** of charts' `useMeasuredChartBreakpoint`
  (`use-table-breakpoint.ts`), because `data` may not import `charts`: it measures the
  table's OWN box — `narrow < 450 ≤ wide` — and `meta.showAt` / `layout="auto"` (cards
  under `narrow`) read it. `layout` defaults to `"table"`; keep the number here and in the
  file equal.
- Cards (`layout="cards"`/`"auto"`) are a `<ul>` of `<li><dl>` rows on the SAME TanStack
  instance: sorting (a sort bar), selection and row click keep working; row reorder is
  table-only.
- `stickyRows` pins rows through TanStack row pinning and takes them out of the
  sorted/paged/filtered flow; `showRanks` numbers the other rows 1…n in data order.
- **The charts `Sparkline` in a cell is a registry block** (`table-with-sparklines`), not
  a `data` feature: copy-own blocks may compose sibling packages, `data` may not.

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
- `pnpm check --rule process-reuse` fails a name collision with `ui`/`flow`/`charts`/`data`, a raw
  SVG primitive, an unwrapped `@xyflow/react` export, a sideways import, or an engine in
  `/core`. Escape hatch: `// process-reuse-exempt: <reason>`.
- `pnpm check --rule process-test-double` guards `/test`: double completeness, engine isolation,
  `exports`/`publishConfig.exports`/`tsup.config.ts` wiring, manifest exclusion.
- **Primitive home, by kind** (a `process-reuse` failure points here, not at a local copy):
  edges/self-loops/layout → `flow` (`FlowWeightedEdge`/`FlowSelfLoopEdge`/`layoutGraph`);
  marks/scales/canvas mark layer → `charts` (`resolvePalette`/`Legend`); tables/filters →
  `data` (`Table`, `FilterBar`); controls (toggles, selects, locks) → `ui`; colour ramps →
  `tokens` (`--chart-1`…`--chart-12`).
- **§5.4 encoding, as shipped** (`ProcessMap`): edge weight = stroke width `[1.5, 8]px` per
  `scaleGroup` + a printed label pill, never colour alone (a second `value`/`valueDomain`
  channel tints the stroke between `--flow-edge-weak`/`-strong` only as a third, redundant
  cue); node metric = the meter's saturation against the surface→primary ramp, plus its
  printed value; a self-loop is `FlowSelfLoopEdge` (arc above the node); a back-edge is
  `FlowWeightedEdge variant="back"` (dashed); start/end are `Play`/`Flag`/`CircleDot` glyphs
  in `FlowNode`'s own tone-glyph idiom, plus a word in the accessible name, never colour
  alone; `tableView` (a boolean prop, not a separate component) renders the identical model
  as `Table` rows — the accessible twin every canvas keeps; `ActivityColorScale` ranks
  activities by case count and assigns `--chart-1`…`--chart-11` by rank, the rest share a
  hatched "other" swatch; `MetricLayerSwitch`'s Performance layer defaults to `median`,
  `mean`/`p90`/other aggregates are opt-in. `PerformanceSpectrum` is the one surface with a
  true sequential ramp: its duration quartiles use `resolvePalette("sequential")` (charts),
  lightness-monotonic so they separate in greyscale too.

History: `docs/rules-history/data-components.md`, `process-components.md`.
