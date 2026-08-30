---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. See `.claude/rules/quality-gates.md` "Enforcement over reminders" and
# the `rules:scoping:check` gate (scripts/check-rule-scoping.mjs).
paths:
  - "packages/data/**"
---

# Data components (@elabs-ai/components-data)

- **TanStack Table is the engine.** `DataTable` owns the table instance
  (`useReactTable`) with core/sorted/filtered row models, optional client
  pagination, optional row virtualization, and an opt-in server-side data model.
  Every slice (sorting / columnVisibility / columnFilters / globalFilter /
  pagination / columnPinning / rowSelection) is independently controllable;
  uncontrolled slices are managed internally and can be seeded once via
  `initialView`.
- **Toolbar via render-prop.** `DataTable`'s `toolbar={(table) => …}` hands the
  instance to `SearchInput`, `FacetFilter` and `ColumnPicker` so filtering and
  column visibility drive the same table. Don't fork table state.
- **Columns are typed.** Use `ColumnDef<TData>`; render cells with `cell:` and
  brand components (e.g. `Badge` for status). Re-export common TanStack types
  from the package so consumers don't add a direct dependency.
- **Controlled filters.** `SearchInput`/`FacetFilter` are controlled
  (`value`/`selected` + change handlers). Keep external filter state in the app
  and reflect it into the table.
- **Column pinning (shipped, #333).** Freeze columns against either edge with the
  `columnPinning` / `onColumnPinningChange` slice — the SAME controlled/uncontrolled
  shape as the five slices above, never a per-`ColumnDef` `pin` field. Two rules the
  component can't enforce for you:
  - **Every pinned column declares an explicit `size`.** Sticky offsets come from
    TanStack's `getStart("left")` / `getAfter("right")`, which sum the DECLARED sizes;
    an auto-width pinned column renders at a width that contradicts its own offset. A
    dev-only warning fires, but the fix is yours.
  - **Pinning is LAYOUT, not a query.** It never joins `DataTableServerArgs` /
    `onServerChange`. It DOES join the saved-view snapshot (as an optional key), because
    a view that silently drops the frozen columns is a broken view.
  - **A sticky cell owns every layer it paints — never a `border`, never the row's fill.**
    Three consequences, all measured, all easy to get wrong:
    - **Opaque fill, composited.** A pinned cell sits above scrolling content, so it paints
      `bg-card` as the background-COLOR and re-applies the row's zebra/hover/selected wash on
      a `::before` layer (`pinnedCellFillClass`, kept in sync with `rowSeparationClass`).
      Never "fix" a seam by making the fill one flat opaque colour, and never make the wash a
      background-IMAGE: at high decoration / `data-decoration`, `decoration.css` gives every
      `.bg-card` the ambient grid AS `background-image`, so a gradient overwrites it and
      punches a flat ungridded rectangle where the frozen column is (measured: the grid's
      per-pixel spread across the cell falls 124 → 1).
    - **The seam is a `::after`, not `border-e`/`border-s`.** Preflight puts the table in the
      COLLAPSED border model, where a cell border is painted by the `<table>` at the cell's
      STATIC position — it does not travel with the sticky cell, and the cell's own opaque
      fill then covers it. The border read correctly at `scrollLeft: 0` and disappeared the
      moment the table scrolled, i.e. exactly when the freeze mattered. Same rung
      (`bg-border-strong` — sole structural cue between two same-surface regions), never a
      shadow (a shadowless theme would delete the cue — ADR 0020).
    - **The pinned HEADER corner composites too.** Match the header row it sits in, don't
      pick a tone: opaque `bg-surface-muted` in the virtualized (sticky-thead) branch, and
      `bg-card` + a `before:bg-surface-muted/60` wash in the plain branch — a flat
      `bg-surface-muted` there read 4-5/255 off its neighbours in every theme.
  - **`scroll-padding` keeps focus out from under the frozen block.** The scroll region
    carries `scrollPaddingInline{Start,End}` equal to the frozen widths. Without it,
    tabbing to a control in a scrolled-under centre column parks the focus ring behind the
    frozen columns — the browser scrolls to the scrollport edge and knows nothing about
    sticky occluders (WCAG 2.2 SC 2.4.11).
- **Row selection (shipped, #11).** The `rowSelection` / `onRowSelectionChange` slice is
  the SAME controlled/uncontrolled shape as the others, seedable once via
  `initialView.rowSelection`. `enableRowSelection`, `enableMultiRowSelection` and
  `getRowId` pass straight through to `useReactTable`.
  - **`getRowId` protects against a `data` array REPLACEMENT, not a sort/filter
    (corrected — the original prose here overclaimed).** TanStack's default row
    id is assigned ONCE per row object when the core row model is built, then
    reused by reference through sorting/filtering — a client-side sort or
    filter never disturbs selection identity, with or without `getRowId`. The
    real hazard is a `data` array replaced with NEW object references (a
    re-fetch, an optimistic update): the core row model rebuilds and
    reassigns default (index-based) ids from scratch, so a row that moved
    position silently inherits whatever selection belonged to the id now
    sitting at its old index. This is unavoidable under `manualPagination` —
    each page IS a fresh `data` array, so the default id restarts at `0` per
    page and a selection can collide across pages. Supply `getRowId` whenever
    `data` can be replaced with new object references (every server-paginated
    table, in particular). A dev-only warning fires when `rowSelection` looks
    wired up under `manualPagination` with no `getRowId` (#11 I3).
  - **`createSelectionColumn<TData>()`** returns a ready-made checkbox column
    (header select-all with a real `indeterminate` state for a partial page
    selection, plus a per-row checkbox) built on `@elabs-ai/components-ui`'s
    `Checkbox` — never hand-roll one. It declares an explicit `size` so it plays
    nicely if pinned (#333's dev warning stays silent). Under
    `enableMultiRowSelection={false}` the header renders nothing: TanStack's
    `toggleAllPageRowsSelected` wipes-then-sets per row when multi-select is
    off, so a select-all click would otherwise leave only the LAST row selected
    and pin the header at `indeterminate` forever (#11 C1). Each row checkbox's
    accessible name is derived from the row's own first DATA column (skipping
    a non-accessor column like the selection checkbox itself), so screen-reader
    users hear "Select Alpha", not an identical "Select row" on every checkbox
    (#11 I4) — the same "first data cell" lookup the row-activation name
    (#337) uses, so a leading selection column can't degrade either one.
  - Selection is LAYOUT/UI, not a query — like `columnPinning`, it never joins
    `DataTableServerArgs` / `onServerChange`.
- **Saved views (shipped).** A view is the serializable `DataTableViewState`
  snapshot
  `{ sorting, columnVisibility, columnFilters, globalFilter?, pagination?, columnPinning?, rowSelection? }`.
  Persist the JSON; rehydrate uncontrolled slices once via the `initialView` prop, or
  keep slices fully controlled in the app and re-pass on remount. Do **not** reach for
  TanStack `initialState` — the component drives every slice through `state`, so an
  `initialState` would be dead/misleading. The component owns no storage (value/onChange
  only), matching the presentation-layer scope (D5).
- **Server-side model (shipped).** Pass `manualSorting` / `manualFiltering` /
  `manualPagination` to delegate that slice to the server (the local row model is
  omitted) and handle `onServerChange((args: DataTableServerArgs) => …)` —
  `{ pagination, sorting, columnFilters, globalFilter }` — to re-fetch; supply
  `rowCount` (or `pageCount`) so page math works. The component never fetches (the app
  computes, same philosophy as the editor's `resolve*` hooks). **Invariant — controlled
  ≠ manual:** a controlled slice with its `manual*` flag unset still sorts/filters/pages
  **locally**; only `manual*` delegates to the server.
- **Virtualization (shipped).** For large lists (>~50 rows;
  see @.claude/rules/interaction-guidelines.md) set `enableRowVirtualization` (tune
  `estimateRowHeight` / `overscan` / `maxBodyHeight`) — DataTable owns windowing via
  `@tanstack/react-virtual`; don't hand-roll. It is **mutually exclusive** with
  `enablePagination`: virtualization wins and the pagination controls are suppressed.
- **Styling:** token classes only (`bg-surface-muted`, `border-border`,
  `hover:bg-surface-muted/50`). Tables must read well in all themes.
- **Accessibility:** real `<table>` semantics; sortable headers are `<button>`s
  with a clear sort indicator (`aria-sort` on the `<th>`). **Virtualized mode** must
  keep AT honest: the windowed `<table>` carries `aria-rowcount` (the true total,
  header rows included) and each mounted data row an absolute `aria-rowindex`, the
  scroll region is keyboard-focusable (`tabIndex={0}` + a visible focus ring), and
  spacer/skeleton rows are `aria-hidden` so they don't perturb the count.
- **Story coverage & verification:** cover the key states (sorted, filtered,
  paginated, loading, empty, **virtualized**, **server-side**). When the Storybook dev
  server is running, validate
  interaction + a11y/contrast across both themes via `mcp__storybook__run-story-tests`
  - `mcp__storybook__preview-stories` (`globals=theme:<slug>`); otherwise
    `pnpm --filter @elabs-ai/components-docs test-storybook`. See @.claude/rules/storybook-mcp.md.
