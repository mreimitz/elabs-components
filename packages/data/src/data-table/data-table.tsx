"use client";

import { forwardRef, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnPinningState,
  type ColumnSizingState,
  type OnChangeFn,
  type PaginationState,
  type Row,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type Table as TanstackTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button, Checkbox, Skeleton, Spinner, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

// ─── Column meta seam (#69) ─────────────────────────────────────────────────────
// `columnDef.meta` is where TanStack lets a caller attach column-specific,
// renderer-agnostic data — `DataTable` reads exactly two keys from it so
// numeric-column styling (interaction-guidelines.md § Micro-typography:
// "tabular-nums for any number column … DataTable numeric cells") is the
// component's job, not a per-caller convention rediscovered at every call
// site. Exported (not just declared) so a consumer's own `ColumnDef` literal
// type-checks against a NAMED type, per component-api.md § Types.

/**
 * `DataTable`'s `columnDef.meta` contract, read by the header/body/skeleton
 * cell renderers. Set `numeric: true` on a column to get `tabular-nums` +
 * end-alignment on both the `<th>` and every `<td>` (including the loading
 * skeleton) for free.
 */
export interface DataTableColumnMeta {
  /** Numeric column: tabular figures + end alignment on header and cells. */
  numeric?: boolean;
  /**
   * Explicit alignment override for when `numeric` isn't the right cue (or
   * to align a non-numeric column). Independent of `numeric` — `numeric`
   * alone still drives `tabular-nums` even when `align` overrides the
   * alignment away from `"end"`.
   */
  align?: "start" | "center" | "end";
}

declare module "@tanstack/react-table" {
  // `TData`/`TValue` must stay in the signature to match the interface being
  // augmented, even though `DataTableColumnMeta` (deliberately) doesn't use
  // them; the empty extends-body is how TanStack's own module-augmentation
  // pattern for `ColumnMeta` is documented.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type
  interface ColumnMeta<TData extends RowData, TValue> extends DataTableColumnMeta {}
}

/**
 * `<th>`/`<td>`/skeleton-`<td>` className for a column's `meta.numeric`/`meta.align`
 * (#69). A pure, module-level helper (no component state) so all three call
 * sites — header, body cell, loading skeleton — stay in lockstep; a drift
 * between them is exactly the "skeleton doesn't mirror the real layout" bug
 * loading-states.md warns about. `meta` is typed as the exported
 * `DataTableColumnMeta` (structurally satisfied by TanStack's augmented
 * `ColumnMeta<TData, TValue>`) so the helper doesn't need the table's generic
 * row type.
 */
function numericColumnClasses(meta: DataTableColumnMeta | undefined) {
  if (!meta?.numeric && !meta?.align) return undefined;
  const alignClass =
    meta?.align === "start"
      ? "text-start"
      : meta?.align === "center"
        ? "text-center"
        : meta?.align === "end"
          ? "text-end"
          : meta?.numeric
            ? "text-end"
            : undefined;
  return cn(alignClass, meta?.numeric && "tabular-nums");
}

// ─── Public types ─────────────────────────────────────────────────────────────

/** Snapshot of table slice state — used for saved-view serialise/rehydrate. */
export interface DataTableViewState {
  sorting: SortingState;
  columnVisibility: VisibilityState;
  columnFilters: ColumnFiltersState;
  globalFilter?: string;
  pagination?: PaginationState;
  /**
   * Which columns are frozen to the left/right edge (#333). OPTIONAL on purpose:
   * the other members predate it, and a required key would break every consumer
   * that already constructs a `DataTableViewState` literal.
   */
  columnPinning?: ColumnPinningState;
  /**
   * Which rows are checked (#11), keyed by row id — see `getRowId`. OPTIONAL
   * like `columnPinning`, for the same reason: the other members predate it.
   */
  rowSelection?: RowSelectionState;
  /**
   * Per-column widths after resizing (#12), keyed by column id. OPTIONAL like
   * `columnPinning`/`rowSelection`, for the same reason: the other members
   * predate it.
   */
  columnSizing?: ColumnSizingState;
}

/**
 * Argument object fired by `onServerChange` whenever a manual slice changes.
 * The consuming app should re-fetch with these params and update `data`.
 */
export interface DataTableServerArgs {
  pagination: PaginationState;
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  globalFilter: string;
}

/**
 * Fires when a row is activated (#337).
 *
 * Both activation paths deliver a `click`: a pointer click on the row body, and
 * a keyboard Enter/Space on the row's hidden activation `<button>` (which the
 * browser dispatches as a click). So the handler takes ONE event type — there is
 * nothing for the caller to branch on.
 */
export type DataTableRowClickHandler<TData> = (
  row: Row<TData>,
  event: React.MouseEvent<HTMLElement>,
) => void;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DataTableProps<TData, TValue> extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Render a toolbar above the table; receives the table instance. */
  toolbar?: (table: TanstackTable<TData>) => ReactNode;
  /** Enable client-side pagination. */
  enablePagination?: boolean;
  pageSize?: number;
  /**
   * Hide the pager once there's genuinely only one page
   * (`table.getPageCount() <= 1`). Default `true`. When `manualPagination` is
   * set without `rowCount`/`pageCount`, the page count isn't knowable (TanStack
   * falls back to the current page's row count) — in that ambiguous case the
   * pager still renders regardless of this flag, so the existing dev warning
   * (#227) stays the diagnostic instead of a silently-hidden pager. Set to
   * `false` to always show the pager (e.g. while a server total is still
   * loading and you'd rather show a disabled pager than none).
   */
  hidePaginationWhenSingle?: boolean;

  /**
   * Controlled global filter value. When provided, the table reflects this
   * value and the component manages no internal filter state. Keep the source
   * of truth in the app and pass it down — never mutate the filter during
   * render (e.g. `table.setGlobalFilter()` in `toolbar`), which loops.
   */
  globalFilter?: string;
  /** Fires when the table requests a global-filter change (e.g. from typeahead). */
  onGlobalFilterChange?: (value: string) => void;

  // ── Controlled slices for saved views ─────────────────────────────────────
  /** Controlled sorting state. When provided the component is sorted-controlled. */
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;

  /** Controlled column-visibility state. */
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;

  /** Controlled column-filters state. */
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;

  /** Controlled pagination state. */
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;

  /**
   * Controlled column-pinning state (#333) — the columns frozen against the
   * left and/or right edge while the rest of the table scrolls horizontally.
   * When provided the component is pinning-controlled; otherwise it manages the
   * slice internally and can be seeded once via `initialView.columnPinning`.
   *
   * A pinned column MUST declare an explicit `size` in its `ColumnDef`: the
   * sticky offset is computed from TanStack's `column.getStart("left")` /
   * `getAfter("right")`, which sum the DECLARED sizes, so an auto-width column
   * would render at a width that doesn't match its own offset. A dev-only
   * warning fires for a pinned column with no `size`.
   *
   * Pinning is a LAYOUT concern, not a query concern — it is client-only and
   * never joins `DataTableServerArgs` / `onServerChange`.
   */
  columnPinning?: ColumnPinningState;
  onColumnPinningChange?: OnChangeFn<ColumnPinningState>;

  /**
   * Opt in to column resizing (#12): a drag handle renders on every
   * resizable column's trailing edge — pointer-draggable (TanStack's own
   * `header.getResizeHandler()`) and keyboard-operable (ArrowLeft/ArrowRight
   * on the focused handle, per the WAI-ARIA separator-as-slider practice).
   * Default `false` so a table that doesn't opt in renders byte-identical
   * markup to before this feature existed — no handle, no per-cell width
   * styling.
   */
  enableColumnResizing?: boolean;
  /**
   * When `columnSizing` updates: `"onChange"` (default here — TanStack's own
   * default is `"onEnd"`) live-updates while dragging; `"onEnd"` updates once
   * on release. Only meaningful when `enableColumnResizing` is set.
   */
  columnResizeMode?: "onChange" | "onEnd";
  /**
   * Controlled column-widths state (#12), keyed by column id — the SAME
   * controlled/uncontrolled shape as `columnPinning`/`rowSelection`.
   * Uncontrolled sizing can be seeded once via `initialView.columnSizing`.
   *
   * A pinned column's sticky offset (`getStart("left")`/`getAfter("right")`)
   * already sums `column.getSize()`, which folds in a `columnSizing`
   * override automatically — so pinning and resizing compose with no extra
   * wiring once this state reaches the table.
   *
   * Sizing is a LAYOUT concern, like `columnPinning`/`rowSelection` — it is
   * client-only and never joins `DataTableServerArgs` / `onServerChange`.
   */
  columnSizing?: ColumnSizingState;
  onColumnSizingChange?: OnChangeFn<ColumnSizingState>;

  /**
   * Controlled row-selection state (#11) — which rows are checked, keyed by
   * row id (see `getRowId`). When provided the component is
   * selection-controlled; otherwise it manages the slice internally and can
   * be seeded once via `initialView.rowSelection`. Pair it with a selection
   * column built by `createSelectionColumn` (or drive it yourself off the
   * `table` instance handed to `toolbar`).
   *
   * Selection is a LAYOUT/UI concern, not a query concern — like
   * `columnPinning`, it is client-only and never joins `DataTableServerArgs` /
   * `onServerChange`.
   */
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  /**
   * Which rows can be selected: `true`/`false` for all rows, or a predicate
   * evaluated per row. Passed straight through to `useReactTable`. Default
   * (TanStack's own): `true`.
   */
  enableRowSelection?: boolean | ((row: Row<TData>) => boolean);
  /**
   * Allow more than one row to be selected at once. Default (TanStack's own):
   * `true`. Set `false` for single-select (radio-style) behaviour.
   */
  enableMultiRowSelection?: boolean;
  /**
   * Stable row id, independent of row INDEX. TanStack's default id is set
   * ONCE per row object when the core row model is built, then reused by
   * reference through sorting/filtering — so a client-side sort or filter
   * does NOT disturb selection identity even without this prop. The real
   * hazard is a `data` array replacement: when the app passes NEW object
   * references (a re-fetch, an optimistic update), TanStack rebuilds the
   * core row model from scratch and reassigns default (index-based) ids, so a
   * row that kept its position but got a new object still keeps its
   * selection — but one that MOVED position silently inherits whatever
   * selection belonged to the id now sitting at its old index. This is
   * unavoidable under `manualPagination`: each page IS a fresh `data` array,
   * so the default index-based id restarts at `0` on every page and a
   * selection made on one page can collide with a different record on the
   * next. Supply `getRowId` whenever `data` can be replaced with new object
   * references (including every server-paginated table) so identity survives
   * the replacement instead of falling back to index.
   */
  getRowId?: (row: TData, index: number) => string;

  /**
   * One-shot rehydrate for uncontrolled slices only (ignored for any slice
   * whose corresponding controlled prop is set). Maps to `useReactTable`'s
   * `initialState`.
   */
  initialView?: Partial<DataTableViewState>;

  // ── Server-side data model ──────────────────────────────────────────────────
  /**
   * When true, sorting is handled by the server. Pass `sorting` (controlled)
   * and handle `onServerChange` to re-fetch with the new sort params.
   * NOTE: controlled ≠ manual — a controlled `sorting` with `manualSorting:false`
   * still sorts locally.
   */
  manualSorting?: boolean;
  /**
   * When true, filtering is handled by the server.
   * NOTE: a controlled `columnFilters` with `manualFiltering:false` still
   * filters locally.
   */
  manualFiltering?: boolean;
  /** When true, pagination is handled by the server. */
  manualPagination?: boolean;

  /**
   * Total row count — used by the server model so TanStack can derive
   * page count. Required when `manualPagination` is true and `pageCount` is
   * not provided.
   */
  rowCount?: number;
  /**
   * Total page count — alternative to `rowCount` for server pagination. When
   * both are provided, `pageCount` wins.
   */
  pageCount?: number;

  /**
   * Fired after any manual-slice change with the current {pagination, sorting,
   * columnFilters, globalFilter}. The component never fetches; the app must
   * re-fetch and update `data`.
   */
  onServerChange?: (args: DataTableServerArgs) => void;

  /** When true: overlay spinner; on empty+loading show skeleton rows instead of empty message. */
  loading?: boolean;

  // ── Virtualization ─────────────────────────────────────────────────────────
  /**
   * Opt-in to row virtualization (for very large lists). Mutually exclusive
   * with enablePagination in practice — if both are set, virtualization wins
   * and pagination is silently ignored.
   */
  enableRowVirtualization?: boolean;
  /** Estimated row height in px (used by the virtualizer). Default: 40. */
  estimateRowHeight?: number;
  /** Virtualizer overscan (rows rendered above/below the visible window). Default: 8. */
  overscan?: number;
  /** CSS max-height of the scroll container in virtualized mode. Default: "32rem". */
  maxBodyHeight?: string;

  /**
   * Number of skeleton placeholder rows to render while loading.
   * Defaults to `pageSize` (non-virtualized) or `min(10, pageSize)` (virtualized).
   */
  loadingRows?: number;

  /**
   * Gentle alternating row stripes ("zebra") as the row-separation cue, instead
   * of a hairline divider between every row. Default `true` — the stripe is the
   * single separation gesture, so rows carry no divider (a divider on a striped
   * row would be a redundant boundary). Set `false` for the classic line model
   * (a `border-border-strong` divider between rows, no stripes).
   */
  zebra?: boolean;

  /**
   * Fires when a row is activated (#337). Setting it adds ONE activation
   * target per row: a visually-hidden `<button>` rendered inside the row's
   * first cell. That button is the row's keyboard tab stop and its accessible
   * name; a pointer click anywhere else in the row resolves to the same
   * handler, so mouse and keyboard converge on one control instead of two
   * competing ones (a focusable `<tr>` cannot carry an activation role without
   * destroying `row` table semantics).
   *
   * Guarded: a click that originates on a nested interactive control
   * (button/link/input/checkbox/…) or is the tail end of a text-selection drag
   * does NOT fire it. Optional; omitting it renders rows exactly as before.
   */
  onRowClick?: DataTableRowClickHandler<TData>;
  /**
   * Accessible name for the row's hidden activation button (#337). Only read
   * when `onRowClick` is set. Defaults to the row's first visible cell value
   * when that is a string/number (the row's primary identifier — the same
   * naming a link in that cell would get), else the localized
   * `data.table.rowAction` fallback. Supply it whenever the first cell isn't a
   * good name for the row.
   */
  rowActionLabel?: (row: Row<TData>) => string;
  /**
   * Per-row className, merged alongside the existing zebra/line/hover/selected
   * classes via `cn()` (so it can't accidentally clobber them) (#337).
   */
  rowClassName?: (row: Row<TData>) => string;

  /**
   * Accessible name for the table, rendered as a visually-hidden (`sr-only`)
   * `<caption>` — the first child of `<table>`. Screen readers announce it as
   * the table's name and it makes column-header navigation meaningful.
   * Optional; omit it only when the surrounding page already labels the table
   * unambiguously (e.g. an adjacent heading) (#338).
   */
  caption?: ReactNode;

  /** Message shown when there are no rows and not loading. */
  emptyMessage?: ReactNode;
  className?: string;
}

// ─── Row-click guards (module-level — shared by every renderRow call) ────────

/**
 * CSS selector for anything inside a row that owns its own click/keyboard
 * behavior. A row click must not fire when the user actually meant to
 * activate one of these — the row is the activation target for everything
 * ELSE in the row, not a second competing target (#337).
 */
const ROW_CLICK_GUARD_SELECTOR =
  'button, a[href], input, select, textarea, label, summary, [role="button"], [role="link"], [role="menuitem"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [contenteditable="true"]';

function isInteractiveEventTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(ROW_CLICK_GUARD_SELECTOR) !== null;
}

/**
 * True while the user is completing a text-selection drag — a row click must
 * not fire for the mouseup/click that ends a selection (#337).
 */
function isActiveTextSelection(): boolean {
  if (typeof window === "undefined" || typeof window.getSelection !== "function") return false;
  return window.getSelection()?.type === "Range";
}

// ─── Pinning helpers (module-level) ──────────────────────────────────────────

/**
 * The 1px seam between the frozen block and the scrolling block (#333), minus
 * the side — `pinnedCellGeometry` appends `after:end-0` or `after:start-0`.
 *
 * A pseudo-element rather than a `border-e`/`border-s` on purpose: see the note
 * in `pinnedCellGeometry`. Token-backed (`bg-border-strong`, the strong rung per
 * ADR 0010) and no shadow, so a shadowless surface (
 * `data-decoration="8|9|10"`) cannot delete it.
 */
const PINNED_SEAM_CLASS =
  "after:pointer-events-none after:absolute after:inset-y-0 after:w-px after:bg-border-strong after:content-['']";

/**
 * Ids of leaf columns whose ORIGINAL `ColumnDef` declares no `size` (#333).
 *
 * Deliberately reads the raw `columns` prop rather than `column.columnDef`:
 * TanStack merges its `defaultColumnSizing` (`size: 150`) into every resolved
 * column def, so the resolved def can never distinguish "the author sized this"
 * from "the author left it to the default" — and the whole point of the pinned
 * `size` warning is to catch the second case.
 *
 * Mirrors TanStack's own id resolution: `columnDef.id`, else the `accessorKey`
 * with `.` → `_`, else a string `header`.
 */
function unsizedColumnIds<TData, TValue>(defs: readonly ColumnDef<TData, TValue>[]): Set<string> {
  const out = new Set<string>();
  const walk = (list: readonly ColumnDef<TData, TValue>[]) => {
    for (const def of list) {
      const group = def as { columns?: ColumnDef<TData, TValue>[] };
      if (group.columns) {
        walk(group.columns);
        continue;
      }
      if (def.size !== undefined) continue;
      const accessorKey = (def as { accessorKey?: string | number }).accessorKey;
      const id =
        def.id ??
        (accessorKey !== undefined
          ? String(accessorKey).replace(/\./gu, "_")
          : typeof def.header === "string"
            ? def.header
            : undefined);
      if (id) out.add(id);
    }
  };
  walk(defs);
  return out;
}

// ─── Column resizing (#12) ────────────────────────────────────────────────────

/**
 * Explicit width/min/max triad for one column at its CURRENT size.
 *
 * The table is auto-layout (see the note on `pinnedCellGeometry` below), so
 * without an explicit width an unpinned column is pure browser auto-layout —
 * `column.getSize()` can change (via a drag or a keyboard resize) with
 * nothing rendering differently. A pinned cell already gets this triad from
 * `pinnedCellGeometry`'s own `style`; this is the same triad for the
 * UNPINNED case, so every call site can compute it once and use it in both
 * the pinned-or-not branches (`geometry?.style ?? resizeWidthStyle(size)`).
 * Every call site gates this behind `enableColumnResizing`, so a table that
 * doesn't opt in renders byte-identical markup to before this feature
 * existed.
 */
function resizeWidthStyle(size: number): React.CSSProperties {
  return { width: size, minWidth: size, maxWidth: size };
}

// ─── Row-selection column (#11) ──────────────────────────────────────────────
//
// `flexRender` mounts a function `header`/`cell` as a real React component
// (`React.createElement(Comp, props)`, not a bare function call — see
// `@tanstack/react-table`'s `flexRender`), so these are ordinary components:
// hooks (`useLocale`) are safe inside them.

/**
 * The row's own "primary identifier" — the first visible DATA column's value,
 * skipping display columns that carry no `accessorKey`/`accessorFn` (e.g. a
 * leading `createSelectionColumn()` checkbox, or a decorative avatar column).
 * `column.accessorFn` is public TanStack API, populated for any
 * `accessorKey`/`accessorFn` column and `undefined` for a pure display column
 * (`core/column.ts`) — so this is a reliable "is this a data column" test.
 * Shared by `rowActionName` (#337) and the selection column's per-row
 * accessible name (#11 I4/I6), so a leading selection column can't silently
 * degrade either one to its generic fallback.
 */
function firstDataCellValue<TData>(row: Row<TData>): string | undefined {
  for (const cell of row.getVisibleCells()) {
    if (!cell.column.accessorFn) continue;
    const value = cell.getValue();
    if (typeof value === "string" && value.trim() !== "") return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

/**
 * Select-all header cell. Radix `Checkbox` renders a genuinely distinct
 * `indeterminate` glyph + `aria-checked="mixed"` for a partial page
 * selection (see `checkbox.tsx`), so the visual and the accessible state
 * agree without any extra wiring here.
 */
function SelectAllHeaderCell<TData>({ table }: { table: TanstackTable<TData> }) {
  const { t } = useLocale();
  const allSelected = table.getIsAllPageRowsSelected();
  const someSelected = table.getIsSomePageRowsSelected();
  return (
    <Checkbox
      data-slot="data-table-select-all"
      checked={allSelected ? true : someSelected ? "indeterminate" : false}
      onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
      aria-label={t("data.table.selectAllRows")}
    />
  );
}

/**
 * Per-row checkbox cell — disabled when `enableRowSelection` excludes the
 * row. Names each checkbox from the row's own data (#11 I4) instead of the
 * identical generic label every row previously shared, using the same
 * "first data cell" lookup `rowActionName` (#337) already uses.
 */
function SelectRowCell<TData>({ row }: { row: Row<TData> }) {
  const { t } = useLocale();
  const name = firstDataCellValue(row);
  return (
    <Checkbox
      data-slot="data-table-select-cell"
      checked={row.getIsSelected()}
      disabled={!row.getCanSelect()}
      onCheckedChange={(checked) => row.toggleSelected(checked === true)}
      aria-label={name ? t("data.table.selectRowNamed", { name }) : t("data.table.selectRow")}
    />
  );
}

/**
 * Ready-made checkbox selection column (#11): header select-all (with a real
 * `indeterminate` state for a partial page selection) + a per-row checkbox,
 * both built on `@elabs-ai/components-ui`'s `Checkbox` — never hand-roll one.
 *
 * Add it to `columns` and pair it with `rowSelection` / `onRowSelectionChange`
 * (or leave both uncontrolled and read `table.getSelectedRowModel()` from a
 * `toolbar` render-prop to build a bulk-action bar).
 *
 * Declares an explicit `size` (40px) so it plays nicely if a caller pins it —
 * every pinned column must declare one (#333) — without the dev warning.
 */
export function createSelectionColumn<TData>(): ColumnDef<TData> {
  return {
    id: "select",
    size: 40,
    enableSorting: false,
    enableHiding: false,
    header: ({ table }) =>
      // #11 C1: `toggleAllPageRowsSelected` wipes-then-sets on every row when
      // `enableMultiRowSelection` is off (TanStack's `mutateRowIsSelected`), so
      // a select-all header under single-select leaves only the LAST row
      // selected and pins the header at indeterminate forever. Suppress it.
      table.options.enableMultiRowSelection === false ? null : (
        <SelectAllHeaderCell table={table} />
      ),
    cell: ({ row }) => <SelectRowCell row={row} />,
  };
}

// ─── Component (inner, generic) ───────────────────────────────────────────────

/**
 * Branded TanStack Table wrapper with sorting, global filtering, column
 * visibility and optional pagination. The toolbar render-prop hands you the
 * table instance so SearchInput / FacetFilter / ColumnPicker can drive it.
 *
 * Every slice (sorting / columnVisibility / columnFilters / pagination) is
 * independently controllable. Uncontrolled slices are managed internally.
 * Pass `manualSorting` / `manualFiltering` / `manualPagination` to opt into
 * server-driven data; `onServerChange` fires after each slice change so the
 * app can re-fetch.
 *
 * Accepts a forwarded `ref` to the outermost wrapper `<div>` and spreads any
 * additional HTML div props (e.g. `id`, `aria-*`, `data-*`) onto that element.
 */
function DataTableInner<TData, TValue>(
  {
    columns,
    data,
    toolbar,
    enablePagination = false,
    pageSize = 10,
    hidePaginationWhenSingle = true,

    // Global filter
    globalFilter: globalFilterProp,
    onGlobalFilterChange,

    // Controlled slices
    sorting: sortingProp,
    onSortingChange: onSortingChangeProp,
    columnVisibility: columnVisibilityProp,
    onColumnVisibilityChange: onColumnVisibilityChangeProp,
    columnFilters: columnFiltersProp,
    onColumnFiltersChange: onColumnFiltersChangeProp,
    pagination: paginationProp,
    onPaginationChange: onPaginationChangeProp,
    columnPinning: columnPinningProp,
    onColumnPinningChange: onColumnPinningChangeProp,
    enableColumnResizing = false,
    columnResizeMode = "onChange",
    columnSizing: columnSizingProp,
    onColumnSizingChange: onColumnSizingChangeProp,
    rowSelection: rowSelectionProp,
    onRowSelectionChange: onRowSelectionChangeProp,
    enableRowSelection,
    enableMultiRowSelection,
    getRowId,

    // Saved views rehydration
    initialView,

    // Server-side model
    manualSorting = false,
    manualFiltering = false,
    manualPagination = false,
    rowCount,
    pageCount,
    onServerChange,

    // Loading
    loading = false,
    loadingRows,

    // Virtualization
    enableRowVirtualization = false,
    estimateRowHeight = 40,
    overscan = 8,
    maxBodyHeight = "32rem",

    zebra = true,
    onRowClick,
    rowActionLabel,
    rowClassName,
    caption,
    emptyMessage = "No results.",
    className,
    ...rest
  }: DataTableProps<TData, TValue>,
  ref: React.Ref<HTMLDivElement>,
) {
  // Component microcopy goes through the locale seam (ADR 0017) — a screen-reader
  // user in a non-English locale has no workaround for a hardcoded accessible name.
  // `dir` also drives column-resize direction below (#12 review, P1): the resize
  // handle already sits at the column's logical `end` edge (`end-0`, which
  // Tailwind's logical properties flip to the physical LEFT under RTL), so both
  // TanStack's own pointer-drag math and the hand-rolled keyboard path must be
  // told the active direction too, or dragging/pressing an arrow moves the width
  // opposite the visible boundary.
  const { t, dir, formatNumber } = useLocale();

  // ── Controlled/uncontrolled detection ────────────────────────────────────
  const isSortingControlled = sortingProp !== undefined;
  const isColumnVisibilityControlled = columnVisibilityProp !== undefined;
  const isColumnFiltersControlled = columnFiltersProp !== undefined;
  const isPaginationControlled = paginationProp !== undefined;
  const isFilterControlled = globalFilterProp !== undefined;
  const isColumnPinningControlled = columnPinningProp !== undefined;
  const isColumnSizingControlled = columnSizingProp !== undefined;
  const isRowSelectionControlled = rowSelectionProp !== undefined;

  // ── Internal state (only drives a slice when uncontrolled) ───────────────
  const [internalSorting, setInternalSorting] = useState<SortingState>(
    () => initialView?.sorting ?? [],
  );
  const [internalColumnVisibility, setInternalColumnVisibility] = useState<VisibilityState>(
    () => initialView?.columnVisibility ?? {},
  );
  const [internalColumnFilters, setInternalColumnFilters] = useState<ColumnFiltersState>(
    () => initialView?.columnFilters ?? [],
  );
  const [internalPagination, setInternalPagination] = useState<PaginationState>(
    () =>
      initialView?.pagination ?? {
        pageIndex: 0,
        pageSize,
      },
  );
  const [internalGlobalFilter, setInternalGlobalFilter] = useState<string>(
    () => initialView?.globalFilter ?? "",
  );
  const [internalColumnPinning, setInternalColumnPinning] = useState<ColumnPinningState>(
    () => initialView?.columnPinning ?? { left: [], right: [] },
  );
  const [internalColumnSizing, setInternalColumnSizing] = useState<ColumnSizingState>(
    () => initialView?.columnSizing ?? {},
  );
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>(
    () => initialView?.rowSelection ?? {},
  );

  // ── Resolved state (controlled wins over internal) ───────────────────────
  const sorting = isSortingControlled ? sortingProp : internalSorting;
  const columnVisibility = isColumnVisibilityControlled
    ? columnVisibilityProp
    : internalColumnVisibility;
  const columnFilters = isColumnFiltersControlled ? columnFiltersProp : internalColumnFilters;
  const pagination = isPaginationControlled ? paginationProp : internalPagination;
  const globalFilter = isFilterControlled ? globalFilterProp : internalGlobalFilter;
  const columnPinning = isColumnPinningControlled ? columnPinningProp : internalColumnPinning;
  const columnSizing = isColumnSizingControlled ? columnSizingProp : internalColumnSizing;
  const rowSelection = isRowSelectionControlled ? rowSelectionProp : internalRowSelection;

  // ── Refs for post-change server callback ─────────────────────────────────
  // We need the current values of ALL slices when any one fires; use refs to
  // avoid stale closures without adding them as deps.
  const sortingRef = useRef(sorting);
  sortingRef.current = sorting;
  const columnFiltersRef = useRef(columnFilters);
  columnFiltersRef.current = columnFilters;
  const paginationRef = useRef(pagination);
  paginationRef.current = pagination;
  const globalFilterRef = useRef(globalFilter);
  globalFilterRef.current = globalFilter;
  const columnVisibilityRef = useRef(columnVisibility);
  columnVisibilityRef.current = columnVisibility;
  const columnPinningRef = useRef(columnPinning);
  columnPinningRef.current = columnPinning;
  const columnSizingRef = useRef(columnSizing);
  columnSizingRef.current = columnSizing;
  const rowSelectionRef = useRef(rowSelection);
  rowSelectionRef.current = rowSelection;

  // ── Dev-only guard: manualPagination needs a total to compute page count ──
  // Without `rowCount` (or `pageCount`), TanStack's `getPageCount()` falls back
  // to the CURRENT PAGE's row count (manual mode has no full row model), so the
  // pager silently reads "Page 1 of 1" with Next permanently disabled. Warn
  // once per mount so the missing prop is diagnosable instead of silent (#227).
  const warnedMissingRowCountRef = useRef(false);
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      manualPagination &&
      rowCount === undefined &&
      pageCount === undefined &&
      !warnedMissingRowCountRef.current
    ) {
      warnedMissingRowCountRef.current = true;
      console.warn(
        "[DataTable] `manualPagination` is true but neither `rowCount` nor `pageCount` was " +
          'provided — the pager will appear stuck ("Page 1 of 1", Next disabled). Pass ' +
          "`rowCount` (or `pageCount`) so the pager can compute the total.",
      );
    }
  }, [manualPagination, rowCount, pageCount]);

  // ── Dev-only guard: manualPagination + rowSelection with no getRowId ──────
  // Under `manualPagination` each page IS a fresh `data` array, so TanStack's
  // default index-based row id restarts at `0` on every page — a selection
  // made on page 1's row 0 can silently apply to page 2's row 0 too (#11 I3).
  // Warn once per mount so this footgun is diagnosable instead of silent (same
  // idiom as the #227 warning above). Heuristic, not full usage tracing: fires
  // whenever selection LOOKS wired up (controlled, or a change handler was
  // passed) — it cannot see an uncontrolled table that never renders a
  // selection column at all.
  const warnedManualSelectionRef = useRef(false);
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      manualPagination &&
      getRowId === undefined &&
      (isRowSelectionControlled || onRowSelectionChangeProp !== undefined) &&
      !warnedManualSelectionRef.current
    ) {
      warnedManualSelectionRef.current = true;
      console.warn(
        "[DataTable] `rowSelection` is wired up under `manualPagination` with no `getRowId` " +
          "— each page is a fresh `data` array, so the default index-based id restarts at " +
          '"0" per page and a selection made on one page can silently apply to a different ' +
          "record on the next. Pass `getRowId` so selection is keyed to a stable identity " +
          "instead of position.",
      );
    }
  }, [manualPagination, getRowId, isRowSelectionControlled, onRowSelectionChangeProp]);

  /** Fire onServerChange with the LATEST slice values (post-update). */
  function fireServerChange(overrides: Partial<DataTableServerArgs> = {}) {
    if (!onServerChange) return;
    onServerChange({
      pagination: paginationRef.current,
      sorting: sortingRef.current,
      columnFilters: columnFiltersRef.current,
      globalFilter: globalFilterRef.current,
      ...overrides,
    });
  }

  // ── Updater helpers — all five slices resolve a functional updater against
  // their *Ref.current (the post-update value), never the render-closure
  // variable, so the resolution stays correct once these callbacks are
  // memoized (a useCallback wrap or the React Compiler) ──────────────────────
  function resolveSorting(updater: Parameters<OnChangeFn<SortingState>>[0]): SortingState {
    return typeof updater === "function" ? updater(sortingRef.current) : updater;
  }
  function resolveColumnVisibility(
    updater: Parameters<OnChangeFn<VisibilityState>>[0],
  ): VisibilityState {
    return typeof updater === "function" ? updater(columnVisibilityRef.current) : updater;
  }
  function resolveColumnFilters(
    updater: Parameters<OnChangeFn<ColumnFiltersState>>[0],
  ): ColumnFiltersState {
    return typeof updater === "function" ? updater(columnFiltersRef.current) : updater;
  }
  function resolvePagination(updater: Parameters<OnChangeFn<PaginationState>>[0]): PaginationState {
    return typeof updater === "function" ? updater(paginationRef.current) : updater;
  }
  function resolveGlobalFilter(updater: Parameters<OnChangeFn<string>>[0]): string {
    return typeof updater === "function" ? updater(globalFilterRef.current) : updater;
  }
  function resolveColumnPinning(
    updater: Parameters<OnChangeFn<ColumnPinningState>>[0],
  ): ColumnPinningState {
    return typeof updater === "function" ? updater(columnPinningRef.current) : updater;
  }
  function resolveColumnSizing(
    updater: Parameters<OnChangeFn<ColumnSizingState>>[0],
  ): ColumnSizingState {
    return typeof updater === "function" ? updater(columnSizingRef.current) : updater;
  }
  function resolveRowSelection(
    updater: Parameters<OnChangeFn<RowSelectionState>>[0],
  ): RowSelectionState {
    return typeof updater === "function" ? updater(rowSelectionRef.current) : updater;
  }

  // ── Row models — omit client model for manual slices ─────────────────────
  const sortedRowModel = manualSorting ? {} : { getSortedRowModel: getSortedRowModel() };
  const filteredRowModel = manualFiltering ? {} : { getFilteredRowModel: getFilteredRowModel() };
  // Only attach the client pagination row model when we actually paginate locally.
  // Under `manualPagination`, TanStack ignores a supplied `getPaginationRowModel`
  // (it returns the pre-pagination rows — i.e. the page the app already fetched),
  // so attaching it there is dead per-render work. `(A && !B) || B === A || B`,
  // but the honest single-branch form documents that manual mode needs no model.
  const paginationRowModel =
    enablePagination && !manualPagination ? { getPaginationRowModel: getPaginationRowModel() } : {};

  // ── Table instance ────────────────────────────────────────────────────────
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      globalFilter,
      pagination,
      columnPinning,
      columnSizing,
      rowSelection,
    },

    // Sorting
    onSortingChange: (updater) => {
      const next = resolveSorting(updater);
      if (!isSortingControlled) setInternalSorting(next);
      onSortingChangeProp?.(updater);
      if (manualSorting) {
        sortingRef.current = next;
        fireServerChange({ sorting: next });
      }
    },

    // Column visibility
    onColumnVisibilityChange: (updater) => {
      const next = resolveColumnVisibility(updater);
      if (!isColumnVisibilityControlled) setInternalColumnVisibility(next);
      onColumnVisibilityChangeProp?.(updater);
      // column visibility is never a "manual" server concern
    },

    // Column filters
    onColumnFiltersChange: (updater) => {
      const next = resolveColumnFilters(updater);
      if (!isColumnFiltersControlled) setInternalColumnFilters(next);
      onColumnFiltersChangeProp?.(updater);
      if (manualFiltering) {
        columnFiltersRef.current = next;
        fireServerChange({ columnFilters: next });
      }
    },

    // Global filter
    onGlobalFilterChange: (updater) => {
      const next = resolveGlobalFilter(updater);
      if (!isFilterControlled) setInternalGlobalFilter(next);
      onGlobalFilterChange?.(next);
      if (manualFiltering) {
        globalFilterRef.current = next;
        fireServerChange({ globalFilter: next });
      }
    },

    // Pagination
    onPaginationChange: (updater) => {
      const next = resolvePagination(updater);
      if (!isPaginationControlled) setInternalPagination(next);
      onPaginationChangeProp?.(updater);
      if (manualPagination) {
        paginationRef.current = next;
        fireServerChange({ pagination: next });
      }
    },

    // Column pinning — a LAYOUT slice, so unlike sorting/filtering/pagination it
    // never fires `onServerChange`: freezing a column changes nothing the server
    // would need to re-query.
    onColumnPinningChange: (updater) => {
      const next = resolveColumnPinning(updater);
      if (!isColumnPinningControlled) setInternalColumnPinning(next);
      onColumnPinningChangeProp?.(updater);
    },

    // Column resizing (#12) — a LAYOUT slice, like column pinning: a column's
    // width changes nothing the server would need to re-query, so this never
    // fires onServerChange either. Routed through by BOTH the pointer path
    // (TanStack's own `header.getResizeHandler()`, wired below) and the
    // keyboard path (`handleResizeKeyDown`, via `table.setColumnSizing`) so
    // the two input modes can never diverge in controlled/uncontrolled
    // behaviour.
    columnResizeMode,
    // RTL fix (#12 review, P1): TanStack's pointer-drag math hardcodes LTR
    // unless told otherwise — `deltaDirection = columnResizeDirection ===
    // 'rtl' ? -1 : 1` internally — so under `dir="rtl"` (the resize handle's
    // own edge already flips via `end-0`, see the `useLocale()` call above)
    // dragging would otherwise move the column's width opposite the visible
    // boundary. `handleResizeKeyDown` below mirrors this for the keyboard path.
    columnResizeDirection: dir,
    enableColumnResizing,
    onColumnSizingChange: (updater) => {
      const next = resolveColumnSizing(updater);
      if (!isColumnSizingControlled) setInternalColumnSizing(next);
      onColumnSizingChangeProp?.(updater);
    },

    // Row selection (#11) — also a LAYOUT/UI slice, so it never fires
    // onServerChange: which rows are checked changes nothing the server
    // would need to re-query.
    onRowSelectionChange: (updater) => {
      const next = resolveRowSelection(updater);
      if (!isRowSelectionControlled) setInternalRowSelection(next);
      onRowSelectionChangeProp?.(updater);
    },
    enableRowSelection,
    enableMultiRowSelection,
    getRowId,

    getCoreRowModel: getCoreRowModel(),
    ...sortedRowModel,
    ...filteredRowModel,
    ...paginationRowModel,

    // Server-side options
    manualSorting,
    manualFiltering,
    manualPagination,
    ...(rowCount !== undefined ? { rowCount } : {}),
    ...(pageCount !== undefined ? { pageCount } : {}),
    // No `initialState`: every slice is driven explicitly via `state` above
    // (internal slices are seeded from `initialView` at useState init), so a
    // TanStack `initialState` would be dead/misleading.
  });

  const rows = table.getRowModel().rows;
  // colSpan for spacer / empty / skeleton cells must match the number of cells a
  // real data row renders (`row.getVisibleCells()`) — use VISIBLE leaf columns so a
  // hidden column (a first-class slice here via columnVisibility + ColumnPicker)
  // doesn't make those rows over-span.
  const colCount = table.getVisibleLeafColumns().length;
  // Virtualized-table ARIA: only a window of rows is mounted, so assistive tech
  // can't infer the true size from the DOM. aria-rowcount counts the header row(s)
  // plus every data row; rendered data rows carry an absolute 1-based aria-rowindex
  // (header rows occupy 1..headerRowCount). Falls back to rows.length for the
  // client path; uses the server `rowCount` total when provided.
  const headerRowCount = table.getHeaderGroups().length;
  const ariaRowCount = (rowCount ?? rows.length) + headerRowCount;

  // ── Pinning (#333) ────────────────────────────────────────────────────────
  // Are there any pinned columns at all? Everything pinning-related is gated on
  // this so a table with no pinning renders byte-identical markup to before.
  const hasLeftPinned = (columnPinning.left?.length ?? 0) > 0;
  const hasRightPinned = (columnPinning.right?.length ?? 0) > 0;

  // Keep keyboard focus out from UNDER the frozen block (WCAG 2.2 SC 2.4.11,
  // "Focus Not Obscured"). Tabbing to a control in a centre column that is
  // currently scrolled under the frozen columns makes the browser scroll it to
  // the SCROLLPORT edge — and the browser has no idea a sticky column is parked
  // there, so the focused control lands behind it, invisibly. Measured on
  // `PinnedColumns`: at scrollLeft 295 the "Latency (ms)" / p50 / p95 sort
  // buttons focused at viewport x 15 / 100 / 183, all inside the 17…297 frozen
  // block. `scroll-padding` is the platform's answer — it is exactly the "don't
  // scroll content to here" inset that `scrollIntoView` honours. Emitted only
  // when something IS pinned, so an unpinned table keeps its previous DOM.
  const pinnedScrollPadding: React.CSSProperties = {
    ...(hasLeftPinned ? { scrollPaddingInlineStart: table.getLeftTotalSize() } : {}),
    ...(hasRightPinned ? { scrollPaddingInlineEnd: table.getRightTotalSize() } : {}),
  };

  // Dev-only guard: a pinned column's sticky offset is `getStart("left")` /
  // `getAfter("right")`, i.e. the SUM OF DECLARED SIZES of the columns beside
  // it. The table is auto-layout, so a pinned column with no `size` renders at
  // whatever width its content wants while its neighbours are offset by
  // TanStack's 150px default — the pinned block then overlaps or gaps. Warn
  // once per mount so that mismatch is diagnosable instead of silent (same
  // idiom as the #227 warning above).
  //
  // Read off the RAW `columns` prop, not `column.columnDef`: TanStack merges a
  // default `size: 150` into every resolved column def, so the merged def can
  // never tell us whether the author actually declared one.
  const warnedUnsizedPinnedRef = useRef(false);
  const pinnedIds = [...(columnPinning.left ?? []), ...(columnPinning.right ?? [])];
  const unsizedIds =
    process.env.NODE_ENV === "production" || pinnedIds.length === 0
      ? null
      : unsizedColumnIds(columns);
  const pinnedWithoutSizeKey = unsizedIds
    ? pinnedIds.filter((id) => unsizedIds.has(id)).join(",")
    : "";
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      pinnedWithoutSizeKey !== "" &&
      !warnedUnsizedPinnedRef.current
    ) {
      warnedUnsizedPinnedRef.current = true;
      console.warn(
        "[DataTable] Pinned column(s) without an explicit `size` in their `ColumnDef`: " +
          `${pinnedWithoutSizeKey}. Sticky offsets are computed from the declared sizes, so an ` +
          "auto-width pinned column will render at a width that doesn't match its own offset. " +
          "Give every pinned column a `size`.",
      );
    }
  }, [pinnedWithoutSizeKey]);

  /**
   * Sticky positioning for one pinned header/body cell (#333).
   *
   * Returns `null` for an unpinned column so the caller emits no `style`, no
   * `data-pinned` and no extra classes — that is what keeps a table with no
   * pinning identical to how it rendered before this feature existed.
   *
   * The offset comes from TanStack (`getStart("left")` sums the widths of the
   * left-pinned columns before this one; `getAfter("right")` sums the
   * right-pinned columns after it), and the same declared `size` is forced onto
   * the cell as `width`/`min`/`max` so the rendered width and the offset agree
   * under the table's auto layout.
   */
  function pinnedCellGeometry(column: Column<TData, unknown>) {
    const pinned = column.getIsPinned();
    if (pinned === false) return null;
    const size = column.getSize();
    const style: React.CSSProperties = {
      width: size,
      minWidth: size,
      maxWidth: size,
      ...(pinned === "left"
        ? { left: column.getStart("left") }
        : { right: column.getAfter("right") }),
    };
    return {
      pinned,
      style,
      // The seam between the frozen block and the scrolling block is the SOLE
      // structural cue between two regions that share one row fill and one
      // zebra stripe — delete it and a sighted user cannot tell them apart — so
      // it takes the strong rung (ADR 0010 decision test). No shadow: ADR 0020's
      // `--shadow-strength: 0` (`data-decoration="8|9|10"`) would
      // erase a shadow-only cue entirely.
      //
      // It is drawn as a 1px `::after` INSIDE the cell, NOT as `border-e` /
      // `border-s`. A real border cannot work here: Tailwind's Preflight puts
      // the table in the COLLAPSED border model, and a collapsed border is
      // painted by the <table> at the cell's STATIC position — it does not
      // travel with a `position: sticky` cell, and the cell's own opaque fill
      // (which it needs, see `pinnedCellFillClass`) then paints over it. Measured
      // in Chromium on `Data/DataTable → PinnedColumns`: with `border-e` the
      // seam pixel read `143,143,143` (light `--border-strong`) at
      // scrollLeft 0 and `245,245,245` (the plain cell fill — i.e. GONE) once
      // scrolled, in all three themes and on both edges. So the one cue vanished
      // exactly when the freeze was doing something. The `::after` lives in the
      // sticky cell's own stacking context, so it moves with it.
      edgeClass:
        pinned === "left"
          ? column.getIsLastColumn("left")
            ? PINNED_SEAM_CLASS + " after:end-0"
            : ""
          : column.getIsFirstColumn("right")
            ? PINNED_SEAM_CLASS + " after:start-0"
            : "",
    };
  }

  // ── Column resizing keyboard path (#12) ───────────────────────────────────
  // TanStack's own `header.getResizeHandler()` is pointer/touch-only — no
  // keyboard path exists in the library — so the WAI-ARIA separator-as-slider
  // practice (drag handle operable via ArrowLeft/ArrowRight when focused)
  // needs one small hand-rolled step. It goes through `table.setColumnSizing`
  // (`table.setColumnSizing = updater => table.options.onColumnSizingChange
  // ?.(updater)`, TanStack's own `ColumnSizing` feature), which is the SAME
  // `onColumnSizingChange` handler passed to `useReactTable` above — so
  // keyboard and pointer resizing share one controlled/uncontrolled code path
  // and can never diverge in behaviour.
  const RESIZE_STEP = 10;
  // ARIA fallback ceiling for the resize separator's `aria-valuemax` when the
  // column declares no explicit `maxSize` — a `ColumnDef` with no `maxSize`
  // resolves through TanStack's own default to `Number.MAX_SAFE_INTEGER`,
  // which is not a value any AT should announce, so the header below omits
  // `aria-valuemax` entirely in that case. Per the WAI-ARIA separator-as-
  // widget pattern, an ELEMENT WITH NO `aria-valuemax` is read with an
  // IMPLICIT default of 100 — so a column at its ordinary starting width
  // (150) already announces as "150 of 100", out of its own stated range
  // (#12 review, P2). `Math.max` with the live size at the call site below
  // keeps this always containing the current value: a column dragged past
  // this floor simply raises its own announced ceiling instead of going out
  // of range again.
  const RESIZE_UNBOUNDED_ARIA_MAX = 2000;
  function handleResizeKeyDown(event: React.KeyboardEvent, column: Column<TData, unknown>) {
    let delta = 0;
    if (event.key === "ArrowRight") delta = RESIZE_STEP;
    else if (event.key === "ArrowLeft") delta = -RESIZE_STEP;
    else return;
    event.preventDefault();
    // Mirror TanStack's own `columnResizeDirection` reversal (passed to
    // `useReactTable` above) for the keyboard path: the handle sits at the
    // column's logical `end` edge, which `end-0` renders on the physical
    // LEFT under `dir="rtl"` — so ArrowRight (physical right, toward the
    // column's own body) must SHRINK the column and ArrowLeft must GROW it,
    // the mirror image of LTR. Without this the keyboard path would diverge
    // from the now-direction-aware pointer path.
    if (dir === "rtl") delta = -delta;
    const minSize = column.columnDef.minSize ?? 20;
    const maxSize = column.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER;
    const nextSize = Math.min(maxSize, Math.max(minSize, column.getSize() + delta));
    table.setColumnSizing((old) => ({ ...old, [column.id]: nextSize }));
  }

  // #51 — double-click resets a resize handle's column back to its declared
  // `ColumnDef.size`, falling back to TanStack's own default (150, the same
  // fallback idiom as `minSize ?? 20`/`maxSize ?? MAX_SAFE_INTEGER` above) when
  // the author left it unset — by REMOVING any explicit `columnSizing` entry
  // for the column, not by writing the size back in as a literal (PR #81
  // review, "Remove the sizing override when resetting a column"). `columnSizing`
  // only ever carries EXPLICIT per-column overrides; a column absent from it
  // always tracks its live `ColumnDef.size` (or the 150 default). Writing the
  // CURRENT declared size back in as a value looks identical today but turns
  // the default into a permanent override: if the `columns` prop later
  // changes this column's authored `size` (e.g. switching table
  // configurations), a column that was never resized follows the new
  // definition for free, while a double-click-reset column would stay pinned
  // to the OLD number forever. Deleting the entry keeps it dynamic, exactly
  // like a column that was never touched. Still goes through the SAME
  // `table.setColumnSizing` dispatch path as `handleResizeKeyDown` — never
  // `column.resetSize()` — so a controlled `columnSizing` consumer observes
  // the reset via `onColumnSizingChange` exactly like every other resize.
  function handleResizeDoubleClick(column: Column<TData, unknown>) {
    table.setColumnSizing((old) => {
      if (!(column.id in old)) return old;
      const { [column.id]: _removed, ...rest } = old;
      return rest;
    });
  }

  // ── Scroll container ref for virtualizer ─────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Virtualizer (only active in virtualized branch) ───────────────────────
  const virtualizer = useVirtualizer({
    count: enableRowVirtualization ? rows.length : 0,
    getScrollElement: () => (enableRowVirtualization ? scrollRef.current : null),
    estimateSize: () => estimateRowHeight,
    overscan,
    enabled: enableRowVirtualization,
  });

  const virtualItems = enableRowVirtualization ? virtualizer.getVirtualItems() : [];
  const totalSize = enableRowVirtualization ? virtualizer.getTotalSize() : 0;
  const paddingTop = virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom =
    totalSize > 0 ? totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0) : 0;

  // ── Plain-branch scroll container: overflow measurement ────────────────────
  // #330: the non-virtualized branch's scroll box is `overflow-auto` (it used to
  // clip). Everything that box exposes is gated on MEASURED overflow, because a
  // table that fits must stay exactly as it was:
  //   - the keyboard tab stop + its accessible name (WCAG 2.1.1 / axe
  //     `scrollable-region-focusable`) — a table that doesn't scroll must NOT
  //     gain a focus stop that does nothing and announces "scrollable" falsely;
  //   - the edge fades, which only make sense when content continues off-edge.
  // So a desktop-width table is a total no-op: no tab stop, no label, no fade.
  const plainScrollRef = useRef<HTMLDivElement>(null);
  const [scrollOverflows, setScrollOverflows] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollAffordance = useCallback(() => {
    const el = plainScrollRef.current;
    if (!el) return;
    // 1px tolerance absorbs sub-pixel layout rounding, which would otherwise
    // report a permanent 0.5px overflow on a table that visually fits.
    setScrollOverflows(
      el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
    );
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = plainScrollRef.current;
    if (!el) return;
    updateScrollAffordance();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateScrollAffordance);
    // Observe the CONTAINER (viewport changes) and the <table> inside it
    // (content changes its intrinsic width without resizing the container).
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
    // Column/row-count changes can also change the table's intrinsic width.
  }, [updateScrollAffordance, colCount, rows.length]);

  // ─── Empty / loading state ───────────────────────────────────────────────
  const showEmpty = !loading && rows.length === 0;
  const showSkeletons = loading && rows.length === 0;

  // Number of skeleton rows to show — caller can override via `loadingRows`.
  const skeletonRowCount = loadingRows ?? pageSize;

  // ─── Render helpers ───────────────────────────────────────────────────────

  /**
   * thead — sticky in virtualized mode, normal otherwise.
   * `withRowIndex` (virtualized only) sets the header row's `aria-rowindex` so the
   * windowed `aria-rowcount` on the table stays internally consistent with the
   * absolute indices on the data rows.
   */
  function renderThead(sticky: boolean, withRowIndex = false) {
    return (
      <thead
        className={cn(
          // #173: header bottom is the only cue between header and first data row → border-strong
          "border-b border-border-strong",
          // A sticky header scrolls OVER the body, so its fill must be opaque or data
          // rows bleed through the labels; the non-sticky header keeps the /60 wash.
          // z-20 (raised from z-10 for #333) puts the header row above the pinned
          // body cells (z-10) and below the pinned header corner (z-30). No visual
          // delta: nothing else in the table sits between those rungs.
          sticky ? "sticky top-0 z-20 bg-surface-muted" : "bg-surface-muted/60",
        )}
      >
        {table.getHeaderGroups().map((headerGroup, groupIndex) => (
          <tr key={headerGroup.id} aria-rowindex={withRowIndex ? groupIndex + 1 : undefined}>
            {headerGroup.headers.map((header) => {
              const geometry = pinnedCellGeometry(header.column);
              const canSort = header.column.getCanSort();
              const sorted = header.column.getIsSorted();
              // String-header fallback (`column.id`) so an icon-only / non-text
              // header still yields a named button (#230).
              const headerLabel =
                typeof header.column.columnDef.header === "string"
                  ? header.column.columnDef.header
                  : header.column.id;
              const sortStateLabel =
                sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "not sorted";
              const SortIcon =
                sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
              // #12: every column gets the same explicit width triad a pinned
              // column already has, gated behind `enableColumnResizing` so a
              // table that doesn't opt in stays byte-identical to before.
              const resizeStyle = enableColumnResizing
                ? resizeWidthStyle(header.getSize())
                : undefined;
              const canResize =
                enableColumnResizing && !header.isPlaceholder && header.column.getCanResize();
              const resizeMax = header.column.columnDef.maxSize;
              return (
                <th
                  key={header.id}
                  scope="col"
                  aria-sort={
                    canSort
                      ? sorted === "asc"
                        ? "ascending"
                        : sorted === "desc"
                          ? "descending"
                          : "none"
                      : undefined
                  }
                  data-pinned={geometry?.pinned ?? undefined}
                  style={geometry?.style ?? resizeStyle}
                  className={cn(
                    "h-10 px-3 text-start align-middle font-medium text-muted-foreground",
                    // #69: a numeric column's `meta` overrides the default
                    // `text-start` — placed right after the base string so
                    // tailwind-merge lets it win over that default.
                    numericColumnClasses(header.column.columnDef.meta),
                    // `sticky`/pinned already establishes a positioning context
                    // for the resize handle's `absolute`; an unpinned resizable
                    // header needs its own.
                    !geometry && canResize && "relative",
                    // A pinned HEADER cell is the corner where both freezes meet,
                    // so it stacks above the sticky header row (z-20) which is
                    // above the pinned body cells (z-10). It needs an OPAQUE
                    // fill (scrolled header cells pass underneath it), and that
                    // fill has to composite to exactly what its unpinned
                    // neighbours show — same problem, same two-layer answer as
                    // `pinnedCellFillClass`:
                    //   sticky branch   → the row is already opaque `surface-muted`, so match it.
                    //   plain branch    → the row is `surface-muted/60` over the
                    //                     container's `card`, so paint `card` and
                    //                     re-apply the /60 wash on `::before`.
                    // Painting the plain branch's corner solid `surface-muted`
                    // read 4-5/255 darker than the header beside it in every
                    // theme (measured: 242 vs 247 light, 43 vs 40
                    // dark) — the same "floating pill"
                    // artefact #333 was filed about, moved into the header.
                    geometry && "sticky z-30",
                    geometry &&
                      (sticky
                        ? "bg-surface-muted"
                        : "bg-card before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-surface-muted/60 before:content-['']"),
                    // Separate cn() argument on purpose: the seam is the sole
                    // structural cue between the frozen and scrolling blocks, so
                    // it must not read as a "boundary + fill in one class string"
                    // redundancy (separation:check).
                    geometry?.edgeClass,
                  )}
                >
                  {header.isPlaceholder ? null : canSort ? (
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      aria-label={`Sort by ${headerLabel}, ${sortStateLabel}`}
                      className="inline-flex items-center gap-1 rounded-sm transition-colors duration-fast ease-standard hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <SortIcon
                        aria-hidden="true"
                        className="size-3 shrink-0 transition-colors duration-fast ease-standard"
                      />
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                  {canResize && (
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-valuenow={Math.round(header.getSize())}
                      aria-valuemin={header.column.columnDef.minSize}
                      aria-valuemax={
                        resizeMax !== undefined && resizeMax < Number.MAX_SAFE_INTEGER
                          ? resizeMax
                          : Math.max(header.getSize(), RESIZE_UNBOUNDED_ARIA_MAX)
                      }
                      // #51: a bare number reads to AT as a dimensionless
                      // ordinal ("150") rather than a size — aria-valuetext
                      // supplies the unit while aria-valuenow (above) stays
                      // the plain numeric value TanStack/AT expect. PR #81
                      // review, "Format the announced resize value for the
                      // active locale": `count` (the raw number) drives
                      // PluralMessage category selection so a locale whose
                      // plural rules pick something other than "other" is
                      // reachable, and `size` goes through `formatNumber` so
                      // an overriding locale renders its own digits/grouping
                      // instead of a raw Latin-digit JS number.
                      aria-valuetext={t("data.table.resizeColumnValue", {
                        count: Math.round(header.getSize()),
                        size: formatNumber(Math.round(header.getSize())),
                      })}
                      aria-label={t("data.table.resizeColumn", { name: headerLabel })}
                      tabIndex={0}
                      data-slot="data-table-resize-handle"
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      onKeyDown={(event) => handleResizeKeyDown(event, header.column)}
                      // #51: double-click resets the column to its declared
                      // (or default) size — see `handleResizeDoubleClick`.
                      // Pointer-only; it doesn't touch the keyboard path above.
                      onDoubleClick={() => handleResizeDoubleClick(header.column)}
                      className={cn(
                        // #51: the hit box is a literal 24px (clamped to half
                        // the header cell so it can never overlap a neighbour,
                        // even at `minSize=20`) rather than the `w-2` Tailwind
                        // spacing-scale utility. `w-2` compiles to
                        // `calc(var(--spacing) * 2)`, and `--spacing` is what
                        // `data-density="compact"` rescales — so the old 8px
                        // hit box shrank further under compact density
                        // (~7.1px). A literal px value is density-independent
                        // by construction, which is the actual defect the
                        // maintainer's review corrected (NOT `--type-factor`,
                        // which this handle never used). Do not widen via
                        // overhang into the neighbouring cell instead — on the
                        // last column that lands inside the `overflow-auto`
                        // box (#330 false positive) and a pinned neighbour
                        // paints over/hit-tests away the extra area.
                        "absolute inset-y-0 end-0 w-[min(24px,50%)] cursor-col-resize touch-none select-none",
                        // #51: the focus ring moves to the `after:` pseudo-
                        // element (the drawn seam) rather than the box itself
                        // — the box is now a 24px hit target, and a 24px focus
                        // rectangle would replace the deliberately slim ring
                        // already reviewed/approved as the #12 a11y fix
                        // (da9b29e). `focus-visible:after:*` targets the
                        // pseudo-element the same way `hover:after:w-2` /
                        // `focus-visible:after:w-2` below already do.
                        "focus-visible:outline-none",
                        // a11y fix (#12 review, blocking): this handle is the
                        // SOLE boundary between two adjacent header cells once
                        // resizing is on — no fill/elevation change separates
                        // them otherwise — so per the border/border-strong
                        // decision test (styling-and-tokens.md) it needs a
                        // rung that clears WCAG 1.4.11's 3:1 on its OWN, in
                        // EVERY state, including rest (a control with no
                        // affordance until hover is unusable without a
                        // pointer). `border-strong` measures only 2.86-2.96:1
                        // against this `bg-surface-muted` header — that rung
                        // is guaranteed only vs `--card`/`--background`, not a
                        // same-tone surface, which is the exact trap the rule
                        // warns about. `muted-foreground` is guaranteed AA
                        // text contrast against `--surface-muted`
                        // (TEXT_SURFACES), so it clears the 3:1 non-text
                        // minimum with wide margin (measured ~5.3-6.4:1 in
                        // both themes, unaffected by density) and is already
                        // the header's own label color. A slim persistent
                        // `after:` seam (not just a hover reveal) gives the
                        // real resting boundary; hover/focus widen the drawn
                        // seam to 8px (`after:w-2`) using the same compliant
                        // color — a separate width from the 24px pointer hit
                        // box below (#51), which the seam does not fill.
                        // Dragging keeps the pre-existing full-fill
                        // `bg-primary` treatment — a separate, already-
                        // accepted `--ring`/`--primary` light-theme exemption
                        // (see `.claude/rules/theming.md`), not something
                        // this fix changes.
                        header.column.getIsResizing()
                          ? "after:absolute after:inset-y-0 after:end-0 after:w-2 after:bg-primary after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
                          : "after:absolute after:inset-y-0 after:end-0 after:w-px after:bg-muted-foreground after:content-[''] hover:after:w-2 focus-visible:after:w-2 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring",
                      )}
                    />
                  )}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
    );
  }

  /**
   * Row separation cue, keyed off the absolute row index so it stays stable
   * under virtualization (a CSS `even:`/`odd:` variant would "swim" as the
   * windowed `<tr>`s recycle).
   *
   * - zebra (default): a gentle `foreground/5` wash on alternate rows is the ONE
   *   separation gesture; rows carry NO divider (#173's strong divider was the cue
   *   only because nothing else was — the stripe replaces it, so a border would now
   *   be redundant per the surface-separation rule).
   * - lines (`zebra={false}`): the classic `border-border-strong` divider between
   *   rows; `last:border-b-0` so the final divider doesn't double with the
   *   container's own bottom border (which reads as a heavy edge / shadow).
   */
  function rowSeparationClass(rowIndex: number): string {
    if (!zebra) return "border-b border-border-strong last:border-b-0";
    return rowIndex % 2 === 1 ? "bg-foreground/5" : "";
  }

  /**
   * Fill for a PINNED body cell (#333) — the twin of `rowSeparationClass` above,
   * and the fix for the bug this issue reports.
   *
   * A pinned cell sits above horizontally-scrolling content, so it needs an
   * OPAQUE paint or the scrolled columns read straight through its text. But the
   * row's own cues — the zebra stripe, hover, selected — are TRANSLUCENT washes
   * that live on the `<tr>`, and a single opaque `background-color` on the
   * `<td>` hides all three: that is the "seam / floating pill" the issue
   * describes.
   *
   * So the cell paints the opaque `bg-card` base and re-applies the row's wash on
   * a decorative `::before` layer at a NEGATIVE stack level. Inside the cell's own
   * stacking context (it has one — `sticky` + a `z-` rung) that layer paints
   * ABOVE the cell's background and BELOW its text, which is exactly the order an
   * unpinned cell gets from the `<tr>`'s translucent background.
   *
   * The wash must NOT be a background-IMAGE gradient on the cell itself: under
   * `[data-decoration]`, `decoration.css` gives every
   * `.bg-card` element the ambient grid AS a `background-image`, so a gradient
   * would overwrite it and punch a flat, ungridded rectangle into the sheet
   * exactly where the frozen column is.
   *
   * Hover and selected stay in CSS (`group-hover/row:` / `group-data-…/row:`
   * against the `group/row` on the `<tr>`) because only the browser knows the
   * pointer is over a SIBLING cell of the same row.
   *
   * Keep this in sync with `rowSeparationClass`. Known limit: a caller's own
   * `rowClassName` background is NOT mirrored here — the component can't know
   * which part of an arbitrary class string is a fill.
   */
  function pinnedCellFillClass(rowIndex: number): string {
    return cn(
      "bg-card",
      "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:content-['']",
      zebra && rowIndex % 2 === 1 && "before:bg-foreground/5",
      "group-hover/row:before:bg-foreground/10",
      "group-data-[state=selected]/row:before:bg-accent",
    );
  }

  /**
   * Accessible name for a row's hidden activation button (#337). Prefers the
   * caller's `rowActionLabel`, then the row's first DATA column value (via
   * `firstDataCellValue` — skips a leading display column with no accessor,
   * e.g. `createSelectionColumn()`'s own checkbox column, #11 I6), then the
   * localized generic fallback.
   */
  function rowActionName(row: (typeof rows)[number]): string {
    const explicit = rowActionLabel?.(row);
    if (explicit) return explicit;
    const name = firstDataCellValue(row);
    if (name !== undefined) return name;
    return t("data.table.rowAction");
  }

  /** A single data row */
  function renderRow(
    row: (typeof rows)[number],
    rowIndex: number,
    extras?: React.HTMLAttributes<HTMLTableRowElement>,
  ) {
    // #337: `onRowClick` adds exactly ONE activation target per row — a
    // visually-hidden <button> in the first cell. The <tr> stays a plain `row`
    // (a focusable <tr> would be a tab stop with no activation semantics: it
    // can't take role="button" without breaking the table's row/rowgroup
    // structure, so AT would announce a row and never that Enter does anything).
    const clickable = Boolean(onRowClick);

    function handleRowClick(event: React.MouseEvent<HTMLTableRowElement>) {
      // The hidden activation button matches this guard too, so a keyboard
      // Enter/Space — which the browser dispatches as a click that bubbles to
      // the row — is handled once, by the button, not twice.
      if (isInteractiveEventTarget(event.target)) return;
      if (isActiveTextSelection()) return;
      onRowClick?.(row, event);
    }

    return (
      <tr
        key={row.id}
        data-state={row.getIsSelected() ? "selected" : undefined}
        onClick={clickable ? handleRowClick : undefined}
        // Hover/selected are foreground-tint washes so they read more prominent than
        // the zebra stripe in the SAME direction across light/dark themes (the old
        // surface-muted/50 hover went the wrong way over a striped row).
        className={cn(
          // Color-only feedback (no transform/movement) → per
          // docs/MOTION_GUIDELINES.md item 3 this stays under OS reduced-motion
          // (only movement is neutralized); the gated duration-fast/ease-standard
          // pair already collapses toward ~0ms via --motion-factor when the user
          // or OS asks for reduced motion, matching the header sort button.
          "transition-colors duration-fast ease-standard hover:bg-foreground/10 data-[state=selected]:bg-accent",
          // Named group (#333) so a PINNED cell can re-apply the row's hover /
          // selected wash on top of its own opaque fill — only CSS knows the
          // pointer is over a sibling cell. Purely a selector hook: `group/row`
          // emits no style of its own.
          "group/row",
          rowSeparationClass(rowIndex),
          // `<tr>` isn't in the global auto-cursor-pointer role list (button/
          // menuitem/tab/…), so a clickable row needs its own cursor. The focus
          // ring is driven off the hidden button's `:focus-visible` (same
          // `has-[[data-slot=…]:focus-visible]` pattern as InputGroup) so the
          // ring paints on the ROW the user is about to activate, even though
          // focus lives on the sr-only control inside it.
          clickable &&
            "cursor-pointer has-[[data-slot=data-table-row-action]:focus-visible]:outline-2 has-[[data-slot=data-table-row-action]:focus-visible]:-outline-offset-2 has-[[data-slot=data-table-row-action]:focus-visible]:outline-ring",
          rowClassName?.(row),
        )}
        {...extras}
      >
        {row.getVisibleCells().map((cell, cellIndex) => {
          const geometry = pinnedCellGeometry(cell.column);
          // #12: same width triad as the header cell — see `resizeWidthStyle`.
          const resizeStyle = enableColumnResizing
            ? resizeWidthStyle(cell.column.getSize())
            : undefined;
          return (
            <td
              key={cell.id}
              data-pinned={geometry?.pinned ?? undefined}
              style={geometry?.style ?? resizeStyle}
              className={cn(
                "px-3 py-2 align-middle",
                // #69: same numeric-column seam as the header — see
                // `numericColumnClasses`.
                numericColumnClasses(cell.column.columnDef.meta),
                // z-10: above the normal (unpositioned) cells it scrolls over,
                // below the sticky header row (z-20) and the pinned corner (z-30).
                geometry && "sticky z-10",
                geometry && pinnedCellFillClass(rowIndex),
                // Separate cn() argument — see pinnedCellGeometry's edgeClass.
                geometry?.edgeClass,
              )}
            >
              {clickable && cellIndex === 0 && (
                <button
                  type="button"
                  data-slot="data-table-row-action"
                  className="sr-only"
                  onClick={(event) => onRowClick?.(row, event)}
                >
                  {rowActionName(row)}
                </button>
              )}
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          );
        })}
      </tr>
    );
  }

  /**
   * Skeleton placeholder `<tr>`s — shared by the normal and virtualized tbody
   * renderers so a markup/token/a11y fix only needs to be made once (#231).
   */
  function renderSkeletonBody(count: number) {
    // #69: iterate the real leaf columns (not just a count) so each skeleton
    // `<td>` can read the same `meta.numeric`/`meta.align` as the loaded
    // header/body cells — a loading table whose skeleton didn't mirror the
    // real alignment is exactly the column-shift-on-load bug
    // loading-states.md § "CLS / space reservation" warns about.
    const visibleColumns = table.getVisibleLeafColumns();
    return Array.from({ length: count }).map((_, i) => (
      <tr key={`skeleton-${i}`} aria-hidden="true" className={rowSeparationClass(i)}>
        {visibleColumns.map((column) => (
          <td
            key={column.id}
            className={cn("px-3 py-2 align-middle", numericColumnClasses(column.columnDef.meta))}
          >
            <Skeleton className="h-4 w-full" />
          </td>
        ))}
      </tr>
    ));
  }

  /**
   * Empty-state `<tr>` — shared by the normal and virtualized tbody renderers
   * (#231).
   */
  function renderEmptyBody() {
    return (
      <tr>
        <td colSpan={colCount} className="h-24 px-3 text-center text-muted-foreground">
          {emptyMessage}
        </td>
      </tr>
    );
  }

  // ─── Non-virtualized tbody ────────────────────────────────────────────────
  function renderTbodyNormal() {
    if (showSkeletons) {
      return <tbody>{renderSkeletonBody(skeletonRowCount)}</tbody>;
    }

    return <tbody>{showEmpty ? renderEmptyBody() : rows.map((row, i) => renderRow(row, i))}</tbody>;
  }

  // ─── Virtualized tbody ────────────────────────────────────────────────────
  function renderTbodyVirtualized() {
    if (showSkeletons) {
      // For virtualized mode, cap the visible skeleton rows at 10 unless caller
      // has explicitly set loadingRows.
      const virtualSkeletonCount = loadingRows ?? Math.min(10, pageSize);
      return <tbody>{renderSkeletonBody(virtualSkeletonCount)}</tbody>;
    }

    return (
      <tbody>
        {showEmpty ? (
          renderEmptyBody()
        ) : (
          <>
            {/* Top spacer — real <tr> so table layout is preserved */}
            {paddingTop > 0 && (
              <tr aria-hidden="true">
                <td style={{ height: paddingTop }} colSpan={colCount} />
              </tr>
            )}
            {virtualItems.map((virtualRow) => {
              const row = rows[virtualRow.index];
              // row is guaranteed present because virtualizer.count === rows.length,
              // but TypeScript doesn't know array indexing is safe here.
              if (!row) return null;
              return renderRow(row, virtualRow.index, {
                ref: virtualizer.measureElement as React.Ref<HTMLTableRowElement>,
                "data-index": virtualRow.index,
                // Absolute 1-based row position; header row(s) occupy 1..headerRowCount.
                "aria-rowindex": headerRowCount + virtualRow.index + 1,
              } as React.HTMLAttributes<HTMLTableRowElement>);
            })}
            {/* Bottom spacer */}
            {paddingBottom > 0 && (
              <tr aria-hidden="true">
                <td style={{ height: paddingBottom }} colSpan={colCount} />
              </tr>
            )}
          </>
        )}
      </tbody>
    );
  }

  // ─── Pagination controls ──────────────────────────────────────────────────
  function renderPagination() {
    // Virtualization wins over pagination per spec — don't render controls
    if (enableRowVirtualization) return null;
    if (!enablePagination && !manualPagination) return null;

    // #342: a genuinely single-page table renders a permanently-disabled
    // pager ("Page 1 of 1", both buttons disabled) — hide it, UNLESS the page
    // count isn't actually knowable: under `manualPagination` without a
    // `rowCount`/`pageCount`, TanStack's `getPageCount()` falls back to the
    // CURRENT page's row count, so "<= 1" there is a false positive for
    // "really one page" — the #227 dev warning above stays the diagnostic for
    // exactly that ambiguous case, so this flag doesn't also mask it.
    const pageCountUnknown = manualPagination && rowCount === undefined && pageCount === undefined;
    if (hidePaginationWhenSingle && !pageCountUnknown && table.getPageCount() <= 1) return null;

    return (
      <div className="flex items-center justify-between">
        <p className="text-body text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  // #338: visually-hidden accessible name for the table. Must be the FIRST
  // child of <table> per the HTML spec (caption immediately follows the
  // opening tag) — both branches place it before their thead.
  const captionElement = caption != null ? <caption className="sr-only">{caption}</caption> : null;

  if (enableRowVirtualization) {
    // Virtualized branch: scroll container wraps the whole table
    // If both enablePagination and enableRowVirtualization are set,
    // virtualization wins; pagination controls are silently suppressed.
    return (
      <div ref={ref} className={cn("space-y-3", className)} {...rest}>
        {toolbar ? toolbar(table) : null}
        {/* Outer border is redundant (surface change) → plain border per #173 spec.
            tabIndex={0} makes the windowed scroll region keyboard-operable — the rows
            themselves aren't focusable, so without it the off-screen rows are
            unreachable by keyboard (WCAG 2.1.1 / axe `scrollable-region-focusable`). */}
        <div
          ref={scrollRef}
          tabIndex={0}
          // Names the focus stop (WCAG 4.1.2) without a landmark role — a `role="region"`
          // here would add a redundant landmark over the inner real <table>.
          aria-label={t("data.table.scrollRegion")}
          aria-busy={loading || undefined}
          className="relative overflow-auto rounded-lg border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ maxHeight: maxBodyHeight, ...pinnedScrollPadding }}
        >
          {/* Loading overlay */}
          {loading && rows.length > 0 && (
            <div
              role="status"
              aria-live="polite"
              // z-40 (raised from z-20 for #333): the overlay covers the WHOLE
              // table, so it has to sit above the pinned-column ladder (body z-10,
              // sticky header z-20, pinned header corner z-30) or a frozen column
              // would punch through the "loading" scrim.
              className="absolute inset-0 z-40 flex items-center justify-center rounded-lg bg-card/80"
            >
              <Spinner aria-hidden="true" className="text-foreground" />
              <span className="sr-only">Loading table data…</span>
            </div>
          )}
          <table
            aria-busy={loading || undefined}
            aria-rowcount={ariaRowCount}
            className="w-full caption-bottom text-body"
          >
            {captionElement}
            {renderThead(true, true)}
            {renderTbodyVirtualized()}
          </table>
        </div>
      </div>
    );
  }

  // Non-virtualized branch.
  // #330: the scroll box is `overflow-auto` (was `overflow-hidden`, silently
  // clipping columns that didn't fit instead of letting them scroll) and
  // keyboard-focusable, parity with the virtualized branch above. Split into
  // an OUTER non-scrolling wrapper (keeps the rounded/border/bg chrome +
  // clip, and is the positioning context for the loading overlay + edge
  // fades) and an INNER scrolling div (the focusable, `overflow-auto` scroll
  // region) so the edge-fade affordance can stay pinned to the visible edges
  // instead of scrolling away with the table content.
  return (
    <div ref={ref} className={cn("space-y-3", className)} {...rest}>
      {toolbar ? toolbar(table) : null}
      {/* Outer border is redundant (surface change) → plain border per #173 spec */}
      <div
        aria-busy={loading || undefined}
        className="relative overflow-hidden rounded-lg border bg-card"
      >
        {/* Loading overlay */}
        {loading && rows.length > 0 && (
          <div
            role="status"
            aria-live="polite"
            // z-40 (raised from z-20 for #333): the overlay covers the WHOLE
            // table, so it has to sit above the pinned-column ladder (body z-10,
            // sticky header z-20, pinned header corner z-30) or a frozen column
            // would punch through the "loading" scrim.
            className="absolute inset-0 z-40 flex items-center justify-center rounded-lg bg-card/80"
          >
            <Spinner aria-hidden="true" className="text-foreground" />
            <span className="sr-only">Loading table data…</span>
          </div>
        )}
        {/* The tab stop exists ONLY while the region measurably overflows: without
            it, columns beyond the viewport are unreachable by keyboard (WCAG 2.1.1 /
            axe `scrollable-region-focusable`) — but adding it unconditionally would
            give every table that FITS a focus stop that does nothing and announces
            "scrollable" when it isn't. `aria-label` moves with it (WCAG 4.1.2:
            a name for a stop that exists, none for one that doesn't). No
            `role="region"` — that would add a redundant landmark over the real
            <table> inside it. */}
        <div
          ref={plainScrollRef}
          data-slot="data-table-scroll-region"
          tabIndex={scrollOverflows ? 0 : undefined}
          aria-label={scrollOverflows ? t("data.table.scrollRegion") : undefined}
          onScroll={updateScrollAffordance}
          className="overflow-auto rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          style={hasLeftPinned || hasRightPinned ? pinnedScrollPadding : undefined}
        >
          <table aria-busy={loading || undefined} className="w-full caption-bottom text-body">
            {captionElement}
            {renderThead(false)}
            {renderTbodyNormal()}
          </table>
        </div>
        {/* Horizontal-scroll edge fade — a token-driven affordance that only
            appears once the table actually overflows its container in that
            direction, so a desktop/wide table renders neither (visual no-op).

            #333: an edge with a PINNED column renders no fade. The fade lives
            outside the scroll region and would paint a 32px wash straight over
            the frozen column's own text; and the affordance is already carried
            there by the pinned block's `border-border-strong` seam, which is
            what a frozen column means ("content slides under this edge"). So
            the fade stays the cue for a FREE edge only. */}
        {canScrollLeft && !hasLeftPinned && (
          <div
            aria-hidden="true"
            data-slot="data-table-scroll-fade-left"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 rounded-lg bg-gradient-to-r from-card to-transparent"
          />
        )}
        {canScrollRight && !hasRightPinned && (
          <div
            aria-hidden="true"
            data-slot="data-table-scroll-fade-right"
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 rounded-lg bg-gradient-to-l from-card to-transparent"
          />
        )}
      </div>

      {renderPagination()}
    </div>
  );
}

// ─── Public export with forwardRef + generic cast ─────────────────────────────
//
// React.forwardRef strips the generic parameter. The cast below restores it so
// callers get full type inference on `columns` / `data` while still being able
// to forward a ref to the root <div>.
//
// The ref prop is already declared in DataTableProps (optional) so existing
// consumers are backward-compatible; the forwardRef call means passing a ref
// object also works.

const DataTableWithRef = forwardRef(DataTableInner) as <TData, TValue>(
  props: DataTableProps<TData, TValue> & { ref?: React.Ref<HTMLDivElement> },
) => React.ReactElement | null;

export { DataTableWithRef as DataTable };
