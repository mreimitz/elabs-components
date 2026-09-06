---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. See `.claude/rules/quality-gates.md` "Enforcement over reminders" and
# the `rules:scoping:check` gate (scripts/check-rule-scoping.mjs).
paths:
  - "packages/data/**"
---

# Data components (@elabs-ai/components-data)

- **TanStack Table is the engine.** `DataTable` owns the `useReactTable` instance. Every slice (each `DataTableViewState` key) is independently controllable; uncontrolled ones are internal, seeded once via `initialView`.
- **Toolbar via render-prop.** `toolbar={(table) => …}` hands the instance to `SearchInput`, `FacetFilter`, `ColumnPicker`. Don't fork table state.
- **Columns are typed.** `ColumnDef<TData>`; render cells with `cell:` + brand components (`Badge` for status). Re-export common TanStack types from the package.
- **Controlled filters.** `SearchInput`/`FacetFilter` are controlled (`value`/`selected` + change handlers); keep filter state in the app, reflect it into the table.
- **Pinning, resizing, selection are LAYOUT, not queries** — never in `DataTableServerArgs`/`onServerChange`; they DO join the saved-view snapshot; each is a slice of the SAME controlled/uncontrolled shape.
- **Column pinning** — `columnPinning`/`onColumnPinningChange`; never a per-`ColumnDef` `pin` field.
  - Every pinned column declares an explicit `size` (sticky offsets sum DECLARED sizes; dev warning only).
  - A sticky cell owns every layer it paints — never a `border`, never the row's fill: `bg-card` as background-COLOR + the row wash on `::before` (`pinnedCellFillClass`, in sync with `rowSeparationClass`) — never one flat colour, never a background-IMAGE. Seam = `::after` in `bg-border-strong`, never `border-e`/`border-s`, never a shadow (ADR 0020). Pinned HEADER corner: opaque `bg-surface-muted` (sticky-thead), `bg-card` + `before:bg-surface-muted/60` (plain).
  - Scroll region: `scrollPaddingInline{Start,End}` = frozen widths (focus never under the frozen block, WCAG 2.2 SC 2.4.11).
- **Column resizing** — `enableColumnResizing` = drag handle per resizable header (TanStack `ColumnSizing`); `columnSizing`/`onColumnSizingChange`. Pointer → `header.getResizeHandler()`; keyboard (ArrowLeft/Right on the handle, WAI-ARIA separator-as-slider) → `table.setColumnSizing()` — never internal state directly. Pinned offsets read `column.getSize()`.
- **Row selection** — `rowSelection`/`onRowSelectionChange`; `enableRowSelection`, `enableMultiRowSelection`, `getRowId` pass through to `useReactTable`.
  - `getRowId` guards against `data` REPLACEMENT with new object references (not sort/filter): supply it whenever that can happen — every server-paginated table; dev warning under `manualPagination` without it.
  - `createSelectionColumn<TData>()` = the checkbox column (select-all header, real `indeterminate`, per-row `Checkbox` from `@elabs-ai/components-ui`, explicit `size`) — never hand-roll one. Header empty under `enableMultiRowSelection={false}`; row checkboxes are named from the row's first DATA column (non-accessor columns skipped, as row activation is).
- **Saved views.** `DataTableViewState` = `{sorting, columnVisibility, columnFilters, globalFilter?, pagination?, columnPinning?, columnSizing?, rowSelection?}`. Persist the JSON; rehydrate once via `initialView` or keep slices controlled and re-pass on remount. Never TanStack `initialState`. No storage — value/onChange only (D5).
- **Server-side model.** `manualSorting`/`manualFiltering`/`manualPagination` delegate a slice (no local row model); re-fetch in `onServerChange((args: DataTableServerArgs) => …)` = `{pagination, sorting, columnFilters, globalFilter}`; supply `rowCount` (or `pageCount`). The component never fetches. **Controlled ≠ manual:** a controlled slice with `manual*` unset still sorts/filters/pages locally.
- **Virtualization.** >~50 rows → `enableRowVirtualization` (tune `estimateRowHeight`/`overscan`/`maxBodyHeight`); DataTable windows via `@tanstack/react-virtual` — don't hand-roll. Exclusive with `enablePagination`: virtualization wins, pagination controls suppressed.
- **Styling:** token classes only (`bg-surface-muted`, `border-border`, `hover:bg-surface-muted/50`), legible in all themes.
- **Accessibility:** real `<table>` semantics; sortable headers are `<button>`s with a sort indicator, `aria-sort` on the `<th>`. Virtualized: `aria-rowcount` (true total incl. header rows), absolute `aria-rowindex` per mounted data row, focusable scroll region (`tabIndex={0}` + visible focus ring), spacer/skeleton rows `aria-hidden`.
- **Stories:** sorted, filtered, paginated, loading, empty, virtualized, server-side. Verify: `mcp__storybook__run-story-tests` + `mcp__storybook__preview-stories` (`globals=theme:<slug>`) in both themes, else `pnpm --filter @elabs-ai/components-docs test-storybook` (@.claude/rules/storybook-mcp.md).

History and measurements: docs/rules-history/data-components.md
