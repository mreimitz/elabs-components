"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
  type Cell,
  type ColumnPinningState,
  type ColumnSizingState,
  type Header,
  type OnChangeFn,
  type PaginationState,
  type Row,
  type RowSelectionState,
  type SortingState,
  type Table as TanstackTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
// Row drag-reorder (#13). @dnd-kit is the only DnD primitive in the repo (reuse
// audit found none) — MIT-licensed, attributed in scripts/attributions.sources.json.
// KeyboardSensor + sortableKeyboardCoordinates already implement the exact key
// model the issue asks for (Space/Enter lift, arrows move, Space/Enter drop,
// Escape cancel) and DndContext's built-in `Accessibility` component renders the
// aria-live announcer — this file supplies the localized announcement text, the
// localized screen-reader instructions + role description (#98 — dnd-kit ships
// its own hardcoded-English defaults for both, which need an explicit override
// same as everything else this feature says out loud), and the token-driven
// visuals.
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical } from "lucide-react";
import {
  Button,
  Checkbox,
  Skeleton,
  Spinner,
  StatePanel,
  useLocale,
  type ColorScale,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  columnSizeStyle,
  formatCellValue,
  resolveShowAt,
  type DataTableColumnMeta,
} from "./column-meta";
import { computeColumnScales, extentOf, labelBoxCh, seriesEnds, seriesValues } from "./cell-scales";
import { BarCell } from "./cells/bar-cell";
import { ColumnsCell } from "./cells/columns-cell";
import { HeatmapCell, HeatmapLegend, heatmapCellStyle } from "./cells/heatmap-cell";
import { CategoryLegend } from "./cells/category-legend";
import { MarkdownCell } from "./cells/markdown-cell";
import { SparklineCell } from "./cells/sparkline-cell";
import { DataTableCard, DataTableCardList, type DataTableCardField } from "./card-layout";
import { DataTableRankCell, DataTableRankHeader, computeRowRanks } from "./ranks-column";
import { stickyRowPinning, withoutStickyRows, type DataTableStickyRows } from "./sticky-rows";
import { useTableBreakpoint } from "./use-table-breakpoint";

export type { DataTableColumnMeta } from "./column-meta";

// ─── Column meta seam (#69) ─────────────────────────────────────────────────────
// `columnDef.meta` is where TanStack lets a caller attach column-specific,
// renderer-agnostic data — `DataTable` reads exactly two keys from it so
// numeric-column styling (interaction-guidelines.md § Micro-typography:
// "tabular-nums for any number column … DataTable numeric cells") is the
// component's job, not a per-caller convention rediscovered at every call
// site. Exported (not just declared) so a consumer's own `ColumnDef` literal
// type-checks against a NAMED type, per component-api.md § Types.

// `DataTableColumnMeta` and its TanStack `ColumnMeta` augmentation live in
// `./column-meta` (RM-123 grew the contract: visuals, format, colorBy, showAt,
// sizing, markdown); they are re-exported above under the same name.

/**
 * `<th>`/`<td>`/skeleton-`<td>` className for a column's `meta.numeric`/`meta.align`
 * (#69). A pure, module-level helper (no component state) so all three call
 * sites — header, body cell, loading skeleton — stay in lockstep; a drift
 * between them is exactly the "skeleton doesn't mirror the real layout" bug
 * loading-states.md warns about. `meta` is typed as the exported
 * `DataTableColumnMeta` (structurally satisfied by TanStack's augmented
 * `ColumnMeta<TData, TValue>`) so the helper doesn't need the table's generic
 * row type.
 *
 * Deliberately takes NO options and NO padding branch: round-1 (#82
 * follow-up) briefly reserved an extra 36px of trailing `<th>` padding here
 * to clear the resize handle, but that moved the header's alignment
 * reference point 24px away from the body `<td>`'s (which keeps the plain
 * 12px `px-3`) — an end-aligned numeric column's own header no longer lined
 * up with the values it labels, defeating the whole point of #69. Reserving
 * space via padding necessarily desyncs header from body, because only the
 * header has a handle to clear. The round-2 fix instead resolves the
 * hit-test collision at the CONTROL that needs to win it — see the sort
 * button's `relative z-10` below — so header and body padding stay
 * byte-identical and this helper only ever contributes alignment +
 * tabular-nums classes.
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
   * Draw a quiet `--rule` hairline between columns (header and body). Off by
   * default. Pinned cells keep their own seam and never take a divider.
   */
  columnDividers?: boolean;

  // ── Presentation (RM-123) ──────────────────────────────────────────────────
  /**
   * `"table"` (default): always a `<table>`. `"cards"`: always one card per
   * row (a `<dl>` of header → cell). `"auto"`: cards while the table's own
   * container is narrower than 450 px, a `<table>` above. Only the markup
   * changes; sorting, filtering, paging and selection use the same table.
   */
  layout?: "auto" | "table" | "cards";
  /**
   * Rows pinned to the top or bottom of every page. An "average" or "total"
   * row stays put through sorting, paging and search. Receives each record
   * and its `data` index.
   */
  stickyRows?: DataTableStickyRows<TData>;
  /**
   * Prepend a 1…n rank column, in `data` order. Sticky rows are not ranked;
   * the rank travels with its row — sorting never renumbers it.
   */
  showRanks?: boolean;
  /**
   * What the rank column is CALLED — its accessible name, its `title`, the
   * term in the cards layout, and the key printed above the table. Defaults to
   * the locale seam (`data.table.rankHeader` / `data.table.rankKey`).
   *
   * The number is the row's position in `data`, not its position on screen, so
   * beside a sorted column it reads 2, 1, 6, 4 on purpose. A column headed by
   * a bare "#" gives a reader no way to know that; this names it.
   */
  rankLabel?: string;
  /** `"compact"` tightens row and header height. Default `"default"`. */
  density?: "default" | "compact";
  /**
   * Span an ungrouped column's header over the empty group rows. With
   * grouped headers, the placeholder cells above a column merge into one.
   */
  mergeEmptyHeaders?: boolean;
  /**
   * `"exact"`: a row matches only when a cell equals the query. Default
   * `"contains"` (TanStack's substring search); both ignore case.
   */
  searchMode?: "contains" | "exact";
  /**
   * Hide the header row visually (a pixel heatmap). The headers stay for
   * screen readers, and a focused sort button still shows itself.
   *
   * Sorting is then KEYBOARD-reachable, not clickable: the band has no height,
   * so it offers no hit area — deliberately, since an invisible click target
   * over the first data row would be worse than none. Tab to the column's sort
   * button (it becomes visible on focus) and press Enter.
   */
  hideHeader?: boolean;

  // ── Row drag-reorder (#13) ───────────────────────────────────────────────
  /**
   * Opt-in row drag-reorder. Off by default — an existing table renders
   * byte-identical markup with no extra DOM per row until this is set.
   * Fully controlled like every other slice: the component never mutates
   * `data` itself, it only reports the move via `onRowReorder`; the caller
   * re-orders `data` in response.
   *
   * Keyboard-operable out of the box (`@dnd-kit`'s default keyboard sensor):
   * Space/Enter picks a row up, Arrow Up/Down moves it, Space/Enter drops it,
   * Escape cancels. Every position change is announced through a live region
   * (WCAG 4.1.3).
   *
   * Mutually exclusive with `enableRowVirtualization` — a windowed table
   * can't keep dnd-kit's sortable list and a virtualizer in sync, so reorder
   * is silently disabled (a dev warning fires) when both are set. Combining
   * it with active `sorting` also fires a dev warning (both still work, but
   * a sort re-orders the very rows a drag just moved, which reads as broken).
   *
   * Table-only. The card layout (`layout="cards"`, or `"auto"` at the narrow
   * tier) has no grip column and no row to drop onto, so reorder is a no-op
   * there and `onRowReorder` never fires; a dev warning says so once per mount.
   */
  enableRowReorder?: boolean;
  /**
   * Fires when a row is dropped in a new position. `from`/`to` are indices
   * into the **`data` array you passed in** — never into the sorted, filtered
   * or paginated view the table renders — so they are safe to use directly
   * with `arrayMove`/`slice`+`splice`/immer against your own `data`, unchanged
   * by an active sort or by client-side pagination (the dragged row's true
   * index in the full array, not its index on the current page). Under
   * `manualPagination`, `data` IS the current page, so `from`/`to` are
   * page-relative — reorder that page's own array with them. `row` is the
   * moved record (`data[from]`).
   */
  onRowReorder?: (from: number, to: number, row: TData) => void;
  /**
   * Where the drag activator lives. `"cell"` (default) renders a dedicated
   * grip-handle column so the rest of the row keeps its ordinary click/
   * keyboard behavior untouched. `"row"` makes the whole row itself the drag
   * activator (no extra column) — reach for this only when the row has no
   * other primary interaction (e.g. no `onRowClick`), since a whole-row
   * activator and a row click target the same surface.
   */
  rowReorderHandle?: "cell" | "row";

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

// ─── Presentation (RM-123, module-level) ────────────────────────────────────

/** The category a `colorBy` key names on a record (a string or a finite number). */
function rowKeyValue(original: unknown, key: string): string | number | null {
  const v = ((original ?? {}) as Record<string, unknown>)[key];
  return typeof v === "string" || (typeof v === "number" && Number.isFinite(v)) ? v : null;
}

/**
 * `colorBy` paint: a background wash (22 % of the category colour over the
 * row's own ground), or text ink pulled 55 % toward `--foreground` so a
 * categorical hue still clears text contrast in every theme.
 */
function colorByStyle(
  target: "background" | "text",
  color: string | null,
): React.CSSProperties | undefined {
  if (!color) return undefined;
  return target === "background"
    ? { backgroundColor: `color-mix(in oklab, ${color} 22%, transparent)` }
    : { color: `color-mix(in oklab, ${color} 35%, var(--foreground))` };
}

/**
 * The row's hidden activation button (#337): `sr-only` removes the box from the
 * visual layout but not the browser's own focus ring — the ROW (or card)
 * paints the deliberate compound indicator via a `has-[…]` selector, so the
 * proxy's own native ring must be suppressed or it leaks as a stray dot.
 */
const ROW_ACTION_CLASS = "sr-only focus-visible:outline-none";

// ─── Exact search (RM-123) ─────────────────────────────────────────────────

/** `searchMode="exact"`: the cell equals the query, trimmed and case-insensitive. */
function exactSearchMatch(value: unknown, query: unknown): boolean {
  const q = String(query ?? "")
    .trim()
    .toLowerCase();
  if (q === "") return true;
  return value !== null && value !== undefined && String(value).trim().toLowerCase() === q;
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
 * Opt-in `columnDividers` hairline. `--rule`, not `--border-strong`: the column
 * is already told apart by alignment and whitespace, so this line is a
 * redundant boundary (ADR 0010). A real border is fine here, unlike the pinned
 * seam above — pinned cells never take it.
 */
const COLUMN_DIVIDER_CLASS = "border-e border-rule last:border-e-0";

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

// ─── Row drag-reorder (#13) ─────────────────────────────────────────────────

/** Render-prop payload `SortableDataRow` hands its child — the live dnd-kit
 * registration for one row. */
interface SortableRowRenderArgs {
  setNodeRef: (node: HTMLElement | null) => void;
  setActivatorNodeRef: (node: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  isDragging: boolean;
  style: React.CSSProperties;
}

/**
 * Per-row `@dnd-kit` registration, defined ONCE at module level.
 *
 * This must be a real component, not a hook call inlined into `rows.map()`
 * (that would call `useSortable` a variable number of times across renders —
 * the classic "hook in a loop" Rules-of-Hooks violation the moment the row
 * count changes) and not a component DEFINED inside `DataTableInner`'s body
 * either (a function created fresh every render gets a new `type` identity,
 * so React would tear down and remount the whole row subtree, including
 * dnd-kit's own internal drag state, on every re-render). A stable top-level
 * component keyed by `id` gives every row its own persistent `useSortable`
 * state via ordinary type+key reconciliation.
 *
 * `transition: null` is deliberate — dnd-kit's own transition is a raw
 * inline `ms` duration, which would bypass the gated `duration-*`/`ease-*`
 * utilities (quality-gates.md "Motion-tokened"). The moving row instead gets
 * `transition-transform duration-base ease-standard motion-reduce:transition-none`
 * as a class at the call site; only the live `transform` stays inline.
 */
function SortableDataRow({
  id,
  disabled,
  attributesOverride,
  children,
}: {
  id: string;
  disabled?: boolean;
  /**
   * `rowReorderHandle: "row"` applies `attributes`/`listeners` straight to
   * the `<tr>` (no separate activator element), so dnd-kit's DEFAULT
   * `role="button"` would replace the table's own `role="row"` on that
   * element — destroying its row semantics. Override the role in that mode
   * only; `"cell"` mode leaves `role` unset because the grip `<button>` —
   * not the `<tr>` — receives `attributes`/`listeners`. `roleDescription` is
   * overridden in BOTH modes (#98) — it carries dnd-kit's localized
   * `aria-roledescription`, which the activator needs regardless of which
   * element is the activator.
   */
  attributesOverride?: { role?: string; roleDescription?: string; tabIndex?: number };
  children: (args: SortableRowRenderArgs) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } =
    useSortable({ id, disabled, transition: null, attributes: attributesOverride });
  return (
    <>
      {children({
        setNodeRef,
        setActivatorNodeRef,
        attributes,
        listeners,
        isDragging,
        style: { transform: CSS.Transform.toString(transform) },
      })}
    </>
  );
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
    columnDividers = false,

    // Presentation (RM-123)
    layout = "table",
    stickyRows,
    showRanks = false,
    rankLabel,
    density = "default",
    mergeEmptyHeaders = false,
    searchMode = "contains",
    hideHeader = false,

    // Row drag-reorder (#13)
    enableRowReorder = false,
    onRowReorder,
    rowReorderHandle = "cell",

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

  // ── Dev-only guard: enableRowReorder + active sorting (#13) ───────────────
  // Both keep working — this doesn't disable anything — but a sort re-orders
  // the very rows a drag just moved, which reads as broken rather than merely
  // confusing. Warn once per mount, same idiom as the two guards above.
  const warnedReorderSortingRef = useRef(false);
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      enableRowReorder &&
      sorting.length > 0 &&
      !warnedReorderSortingRef.current
    ) {
      warnedReorderSortingRef.current = true;
      console.warn(
        "[DataTable] `enableRowReorder` is set while a column is sorted — the sort will " +
          "keep re-ordering rows out from under a manual drag. Clear `sorting` (or avoid " +
          "enabling both at once) so a drag's new order stays stable.",
      );
    }
  }, [enableRowReorder, sorting.length]);

  // ── Dev-only guard: enableRowReorder + enableRowVirtualization (#13) ──────
  // A windowed table can't keep dnd-kit's sortable list in sync with a
  // virtualizer that only mounts a subset of rows, so the two are mutually
  // exclusive — virtualization wins (same precedent as enablePagination vs.
  // enableRowVirtualization) and reorder is silently disabled below
  // (`rowReorderActive`). This warning is the diagnostic for why.
  const warnedReorderVirtualizedRef = useRef(false);
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      enableRowReorder &&
      enableRowVirtualization &&
      !warnedReorderVirtualizedRef.current
    ) {
      warnedReorderVirtualizedRef.current = true;
      console.warn(
        "[DataTable] `enableRowReorder` has no effect while `enableRowVirtualization` is " +
          "set — the two are mutually exclusive. Virtualization wins; row reorder is disabled.",
      );
    }
  }, [enableRowReorder, enableRowVirtualization]);

  // Only wired up in the non-virtualized body — see the warning above.
  const rowReorderActive = enableRowReorder && !enableRowVirtualization;
  const hasGripColumn = rowReorderActive && rowReorderHandle === "cell";

  const reorderSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // Backing store for `getReorderRowId` (defined below, once `rows` is in
  // scope) — see its own doc comment for why a WeakMap keyed by row object
  // reference is the round-1 fix for findings 1 & 3.
  const reorderIdentityMapRef = useRef<WeakMap<object, string>>(new WeakMap());
  const reorderIdentityCounterRef = useRef(0);
  // Positions in `data` whose record REPEATS an object reference that already
  // appeared earlier in the array — 2nd and later occurrences only (round-2
  // finding 6). `getReorderRowId` below keys its identity on the record's own
  // object reference, which is exactly what makes an id survive the array
  // REPLACEMENT every reorder idiom performs; the cost is that a record the
  // caller listed twice IS one reference, so both rows would be handed one id
  // — one React key, one dnd-kit registration, and a drop that can only ever
  // name the first occurrence. The positions listed here get their own data
  // index folded into the id so the occurrences stay separately addressable.
  // Only the repeats are suffixed, so a table with no repeated record keeps
  // byte-identical ids (and with them the round-1 focus restore).
  const reorderRepeatedPositions = useMemo(() => {
    const repeats = new Set<number>();
    if (!rowReorderActive) return repeats;
    const seen = new Set<unknown>();
    data.forEach((record, index) => {
      if (record === null || typeof record !== "object") return;
      if (seen.has(record)) repeats.add(index);
      else seen.add(record);
    });
    return repeats;
  }, [data, rowReorderActive]);
  // The component's OWN `aria-live="polite"` announcer state — round-1
  // finding 4 (dnd-kit's built-in region is hardcoded `assertive` with no
  // override). `reorderLastAnnouncedPositionRef` de-dupes a same-position
  // re-fire (the pickup self-collision, a no-op arrow press at a boundary).
  const [reorderLiveMessage, setReorderLiveMessage] = useState("");
  const reorderLastAnnouncedPositionRef = useRef<number | null>(null);

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

  // ── Row models — omit client model for manual slices, and LAZILY ATTACH
  // the client sorted/filtered models even in client mode (#602 — mount cost
  // independent of row count). TanStack caches `table._get{Sorted,Filtered}
  // RowModel` PERMANENTLY the first time it sees a matching option
  // (`RowSorting`/`ColumnFiltering` in @tanstack/table-core never re-check
  // the option on a later render), so a ref that only ever latches ON
  // matches that lifetime exactly: a table that has never sorted/filtered
  // gets NEITHER model attached, so `table.getSortedRowModel()`/
  // `getFilteredRowModel()` fall back to `getPreSortedRowModel()`/
  // `getPreFilteredRowModel()` (== the already-built core model) with ZERO
  // extra per-row work at mount — not even `getFilteredRowModel`'s own
  // "nothing is filtered" branch, which still loops every row to reset
  // `row.columnFilters`/`columnFiltersMeta` (read by no code in this file).
  // The first sort/filter attaches the real model from that render on and
  // it never turns back off, mirroring TanStack's own permanent cache.
  const sortingActive = !manualSorting && sorting.length > 0;
  const everSortedRef = useRef(sortingActive);
  if (sortingActive) everSortedRef.current = true;
  const sortedRowModel =
    manualSorting || !everSortedRef.current ? {} : { getSortedRowModel: getSortedRowModel() };

  // `stickyRows` needs the filtered model attached regardless of filter
  // activity — `withoutStickyRows` (the thing that excludes pinned rows
  // from the centre flow) must run as soon as sticky rows are configured,
  // not only once a filter happens to be applied too.
  const filteringActive =
    !manualFiltering && (columnFilters.length > 0 || !!globalFilter || !!stickyRows);
  const everFilteredRef = useRef(filteringActive);
  if (filteringActive) everFilteredRef.current = true;
  const filteredRowModel =
    manualFiltering || !everFilteredRef.current
      ? {}
      : {
          getFilteredRowModel: stickyRows
            ? withoutStickyRows(getFilteredRowModel<TData>())
            : getFilteredRowModel(),
        };
  // Only attach the client pagination row model when we actually paginate locally.
  // Under `manualPagination`, TanStack ignores a supplied `getPaginationRowModel`
  // (it returns the pre-pagination rows — i.e. the page the app already fetched),
  // so attaching it there is dead per-render work. `(A && !B) || B === A || B`,
  // but the honest single-branch form documents that manual mode needs no model.
  const paginationRowModel =
    enablePagination && !manualPagination ? { getPaginationRowModel: getPaginationRowModel() } : {};

  // ── Sticky rows (RM-123) ──────────────────────────────────────────────────
  // TanStack row pinning with `keepPinnedRows`: a sticky row renders on every
  // page and outside the sort, while keeping its id, selection and data index.
  const rowPinning = useMemo(
    () => stickyRowPinning(data, stickyRows, getRowId),
    [data, stickyRows, getRowId],
  );
  const stickyActive = (rowPinning.top?.length ?? 0) + (rowPinning.bottom?.length ?? 0) > 0;

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
      ...(stickyActive ? { rowPinning } : {}),
    },
    ...(stickyActive ? { enableRowPinning: true, keepPinnedRows: true } : {}),
    // RM-123 `searchMode="exact"`: a row matches when one cell EQUALS the query.
    ...(searchMode === "exact"
      ? {
          globalFilterFn: (row: Row<TData>, columnId: string, filterValue: unknown) =>
            exactSearchMatch(row.getValue(columnId), filterValue),
        }
      : {}),

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

  // Sticky rows (RM-123) render outside the centre rows, above and below them.
  const rows = stickyActive ? table.getCenterRows() : table.getRowModel().rows;
  const topRows = stickyActive ? table.getTopRows() : [];
  const bottomRows = stickyActive ? table.getBottomRows() : [];

  // ── Presentation layer (RM-123) ──────────────────────────────────────────
  // Every piece below is gated on the column meta / prop that asks for it, so a
  // table that uses none of it renders exactly as before.
  const leafColumns = table.getAllLeafColumns();
  const coreRows = table.getCoreRowModel().rows;
  const needsScales = leafColumns.some(
    (c) => c.columnDef.meta?.visual !== undefined || c.columnDef.meta?.colorBy !== undefined,
  );
  // One scale per visual / colorBy column over ALL rows (never the page), so a
  // bar or a heatmap colour means the same thing on every page and sort.
  const columnScales = useMemo(
    () =>
      needsScales
        ? computeColumnScales(
            leafColumns.map((c) => ({ id: c.id, meta: c.columnDef.meta })),
            coreRows,
          )
        : null,
    [needsScales, leafColumns, coreRows],
  );
  // One printed-label reservation per visual column, over ALL rows: a bar's
  // track and a sparkline's drawing get what the text leaves over, so a box
  // sized per row would give a row with a shorter number a LONGER bar (and move
  // a diverging column's zero rule from row to row). `ch` against the column's
  // longest label; `tabular-nums` makes every digit exactly 1ch.
  const labelBoxes = useMemo(() => {
    const boxes = new Map<string, { value?: number; ends?: readonly [number, number] }>();
    for (const column of leafColumns) {
      const meta = column.columnDef.meta;
      const visual = meta?.visual;
      const labelOf = (value: unknown) => formatCellValue(value, meta?.format, formatNumber);
      if (visual?.kind === "bar" && visual.style !== "slim") {
        boxes.set(column.id, {
          value: labelBoxCh(coreRows.map((row) => labelOf(row.getValue(column.id)))),
        });
      }
      if (visual?.kind === "sparkline" && visual.labels === "ends") {
        const ends = coreRows
          .map((row) => seriesEnds(seriesValues(row.original, visual.keys)))
          .filter((pair): pair is readonly [number, number] => pair !== null);
        boxes.set(column.id, {
          ends: [
            labelBoxCh(ends.map(([first]) => labelOf(first))),
            labelBoxCh(ends.map(([, last]) => labelOf(last))),
          ],
        });
      }
    }
    return boxes;
  }, [leafColumns, coreRows, formatNumber]);
  const rowRanks = useMemo(
    () =>
      showRanks
        ? computeRowRanks(
            coreRows.map((r) => r.id),
            new Set([...(rowPinning.top ?? []), ...(rowPinning.bottom ?? [])]),
          )
        : null,
    [showRanks, coreRows, rowPinning],
  );
  const hasShowAt = leafColumns.some((c) => c.columnDef.meta?.showAt !== undefined);
  const { ref: breakpointRef, breakpoint } = useTableBreakpoint<HTMLDivElement>(
    layout === "auto" || hasShowAt,
  );
  const cardsActive = layout === "cards" || (layout === "auto" && breakpoint === "narrow");
  // Row reorder is table-only (RM-123): a card is a `<dl>` in a `<ul>`, with no
  // grip column and no row to drop onto, so dnd-kit is not mounted at all in
  // the card branch. That is a deliberate, documented no-op rather than a
  // half-working drag — but a silent one is a trap, so say it once per mount.
  const warnedCardReorderRef = useRef(false);
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      cardsActive &&
      enableRowReorder &&
      !warnedCardReorderRef.current
    ) {
      warnedCardReorderRef.current = true;
      console.warn(
        "[DataTable] `enableRowReorder` is ignored in the card layout — a card list has no " +
          "grip column and no drop target, so `onRowReorder` will never fire. Keep " +
          '`layout="table"` for reordering, or offer the move as a row action in cards.',
      );
    }
  }, [cardsActive, enableRowReorder]);
  // Published only when a presentation prop is in play, so the default DOM is
  // unchanged: `data-layout` is what renders, `data-breakpoint` what was measured.
  const presentationAttrs =
    layout !== "table" || hasShowAt
      ? {
          "data-layout": cardsActive ? "cards" : "table",
          "data-breakpoint": layout === "auto" || hasShowAt ? breakpoint : undefined,
        }
      : null;
  const isColumnShown = (column: Column<TData, unknown>) =>
    resolveShowAt(column.columnDef.meta?.showAt, breakpoint);
  const rootRef = useCallback(
    (node: HTMLDivElement | null) => {
      breakpointRef(node);
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [breakpointRef, ref],
  );
  const captionId = useId();
  const headerGroupsForCards = table.getHeaderGroups();
  // Leading columns DataTable adds beside the TanStack ones (grip, rank).
  const leadingColCount = (hasGripColumn ? 1 : 0) + (showRanks ? 1 : 0);

  // colSpan for spacer / empty / skeleton cells must match the number of cells a
  // real data row renders (`row.getVisibleCells()`) — use VISIBLE leaf columns so a
  // hidden column (a first-class slice here via columnVisibility + ColumnPicker)
  // doesn't make those rows over-span. `showAt` (RM-123) hides at render only.
  const colCount = table.getVisibleLeafColumns().filter(isColumnShown).length;
  // Virtualized-table ARIA: only a window of rows is mounted, so assistive tech
  // can't infer the true size from the DOM. aria-rowcount counts the header row(s)
  // plus every data row; rendered data rows carry an absolute 1-based aria-rowindex
  // (header rows occupy 1..headerRowCount). Falls back to rows.length for the
  // client path; uses the server `rowCount` total when provided.
  const headerRowCount = table.getHeaderGroups().length;
  // `rows` is the CENTRE row model when `stickyRows` is on, so the pinned rows
  // above and below it are extra mounted rows. They join the count, and they
  // take the first / last indices, so `aria-rowindex` still rises with DOM
  // order — a screen reader hears "row 1 of 121", never an unplaced row.
  const centreRowCount = rowCount ?? rows.length;
  const ariaRowCount = centreRowCount + topRows.length + bottomRows.length + headerRowCount;
  const firstCentreRowIndex = headerRowCount + topRows.length + 1;

  // ── Row drag-reorder (#13) ────────────────────────────────────────────────
  // `rowActionName` (defined below, but hoisted as a function declaration) is
  // the SAME row-naming lookup `onRowClick`'s hidden button uses (#337) —
  // reusing it means a reorder announcement names a row exactly the way its
  // click target already does, rather than inventing a second convention.
  function reorderRowName(id: string): string {
    const row = rows.find((r) => getReorderRowId(r) === id);
    return row ? rowActionName(row) : id;
  }
  function reorderPosition(id: string): number {
    return rows.findIndex((r) => getReorderRowId(r) === id) + 1;
  }

  // ── Stable identity for drag reconciliation (round-1 fix, findings 1 & 3) ──
  // `getRowId`'s own doc comment above states TanStack's fallback: default row
  // ids are assigned ONCE per row object when the core row model is built from
  // the current `data` ARRAY REFERENCE, then carried by reference through
  // sort/filter — but a `data` array REPLACEMENT (exactly what every
  // `onRowReorder` consumer does: `arrayMove`/`slice`+`splice`/immer all
  // return a new array) rebuilds the core row model and reassigns ids by
  // POSITION IN THE NEW ARRAY. So the id that used to denote "the row now at
  // index 1" keeps denoting index 1 even though a different record moved
  // there — which is what let a keyboard drop leave focus on the wrong row
  // (a different record now sits at the id the focus restore targets).
  // Requiring every consumer to hand-roll `getRowId` would leave the DEFAULT
  // configuration broken, so when the caller hasn't supplied one, mint an id
  // keyed by the row's own OBJECT REFERENCE (`row.original`) in a `WeakMap` —
  // unlike TanStack's default, this id follows the object wherever it lands
  // in a new array, because every reorder idiom MOVES the element reference,
  // it never clones it. When `getRowId` IS supplied it is already exactly
  // this kind of identity, so it's reused as-is instead of minting a second,
  // divergent id namespace.
  function getReorderRowId(row: Row<TData>): string {
    if (getRowId) return row.id;
    const original: unknown = row.original;
    if (original !== null && typeof original === "object") {
      const map = reorderIdentityMapRef.current;
      let id = map.get(original);
      if (id === undefined) {
        id = `__reorder-${reorderIdentityCounterRef.current++}`;
        map.set(original, id);
      }
      // A repeated record shares ONE object reference, so the id minted above
      // is by construction identical for both of its rows — round-2 finding
      // 6. Fold the data position into the repeats so each occupant is its
      // own draggable. Two identical records are interchangeable to the user,
      // so the weaker cross-replacement stability of a suffixed id costs
      // nothing the first-occurrence rule doesn't already give back.
      return reorderRepeatedPositions.has(row.index) ? `${id}__${row.index}` : id;
    }
    // Primitive `TData` (rare) has no object reference to key off — same
    // documented limitation `getRowId`'s own comment already carries for
    // TanStack's own default identity.
    return row.id;
  }

  // dnd-kit's own `Accessibility` component's `LiveRegion` hardcodes
  // `aria-live="assertive"` with no way to override it from `DndContext`
  // (`@dnd-kit/accessibility` 3.1.1 accepts an `ariaLiveType` prop on
  // `LiveRegion` itself, but nothing forwards one through `accessibility`) —
  // round-1 finding 4. `.claude/rules/accessibility.md` reserves assertive
  // for terminal errors (`role="alert"`); a sortable list's own position
  // updates are `polite` status. So dnd-kit's built-in announcer is silenced
  // below (every callback returns `undefined`, which `useAnnouncement`
  // treats as "no update" — the region stays permanently empty and never
  // fires) and DataTable renders its OWN `aria-live="polite"` region
  // (`reorderLiveMessage`, wired to the `data-table-reorder-live-region`
  // node near the bottom of this function) from the `onDragStart`/
  // `onDragOver`/`onDragEnd`/`onDragCancel` handlers below.
  const silentDragAnnouncements: Announcements = {
    onDragStart: () => undefined,
    onDragOver: () => undefined,
    onDragEnd: () => undefined,
    onDragCancel: () => undefined,
  };

  /**
   * Pickup always announces — it's the start of a new, meaningful gesture.
   * Seeding `reorderLastAnnouncedPositionRef` with the row's OWN starting
   * position (not `null`) is what suppresses dnd-kit's immediate self-
   * collision `onDragOver` (over === active, at the same position) that
   * otherwise fires in the same tick and would stomp this message before it
   * is ever observable (WCAG 4.1.3 needs it heard, not just rendered).
   */
  function handleRowDragStart(event: DragStartEvent) {
    const activeRowId = String(event.active.id);
    reorderLastAnnouncedPositionRef.current = reorderPosition(activeRowId);
    setReorderLiveMessage(t("data.table.reorderPickedUp", { name: reorderRowName(activeRowId) }));
  }

  /**
   * Announces a real position change only — round-1 finding 4 measured 4
   * announcements for a 2-step move, one of them a same-position self-
   * collision that buried the "picked up" message. De-duping on the actual
   * computed position (not on the raw event) means a screen reader hears one
   * `polite` (queued, non-interrupting) announcement per genuine move, not
   * one per keystroke.
   */
  function handleRowDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const position = reorderPosition(String(over.id));
    if (position === reorderLastAnnouncedPositionRef.current) return;
    reorderLastAnnouncedPositionRef.current = position;
    setReorderLiveMessage(
      t("data.table.reorderMoved", {
        name: reorderRowName(String(active.id)),
        position,
        total: rows.length,
      }),
    );
  }

  function handleRowDragCancel(event: DragCancelEvent) {
    const activeRowId = String(event.active.id);
    setReorderLiveMessage(
      t("data.table.reorderCancelled", {
        name: reorderRowName(activeRowId),
        position: reorderPosition(activeRowId),
        total: rows.length,
      }),
    );
    reorderLastAnnouncedPositionRef.current = null;
  }

  /**
   * The component never mutates `data` itself (D5 — presentation layer, not
   * an SDK): it only reports the move, the same "controlled slice" contract
   * every other DataTable feature follows. A no-op drop (dropped on itself,
   * or outside any droppable) fires nothing on the data callback, but still
   * announces (matching the "dropped back where it started" reality).
   *
   * `from`/`to` resolve against the ORIGINAL `data` array the caller passed
   * in, never against the sorted/paginated VIEW (`rows`) — round-1 finding 1.
   * Reporting `rows.findIndex(...)` positions meant a caller doing
   * `arrayMove(data, from, to)` (the idiom both shipped stories use) silently
   * moved the WRONG records whenever an active sort or a client-side page
   * had changed which record sat at which view position — measured: a
   * paginated drag on page 2 reported `(0, 1, …)`, corrupting `data[0]`/
   * `data[1]` on page 1. Resolving against `data` itself makes the contract
   * "indices into the `data` you gave me" — correct under any sort/filter,
   * correct under client-side pagination (the dragged record's true index in
   * the full array), and correct under `manualPagination` too (there `data`
   * IS the current page, so `from`/`to` are page-relative, which is exactly
   * what a caller reordering that page's own array needs).
   */
  function handleRowDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const activeRowId = String(active.id);
    setReorderLiveMessage(
      t("data.table.reorderDropped", {
        name: reorderRowName(activeRowId),
        position: reorderPosition(String(over ? over.id : active.id)),
        total: rows.length,
      }),
    );
    reorderLastAnnouncedPositionRef.current = null;

    if (!over || active.id === over.id) return;
    const movedRow = rows.find((r) => getReorderRowId(r) === activeRowId);
    const targetRow = rows.find((r) => getReorderRowId(r) === String(over.id));
    if (!movedRow || !targetRow) return;
    // Round-2 finding 6: this used to build a `Map` keyed by `row.original`
    // and read `from`/`to` out of it. A `data` array that repeats a record —
    // the same object reference, or the same primitive, at two positions —
    // can only occupy ONE slot in such a map, so the later occurrence was
    // reported as the earlier one and the documented `arrayMove(data, from,
    // to)` idiom moved a row the user never dragged, silently. `Row.index` is
    // the position TanStack already assigned this row when it built the core
    // row model FROM `data`, carried by reference through sort/filter/
    // pagination (the same property the round-1 fix above relies on) — so it
    // keeps the "indices into the `data` you gave me" contract without the
    // value-equality lookup that collapsed the repeats.
    const from = movedRow.index;
    const to = targetRow.index;
    if (from < 0 || from >= data.length || to < 0 || to >= data.length) return;
    onRowReorder?.(from, to, movedRow.original);
  }

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
      // scrolled, in every theme and on both edges. So the one cue vanished
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
    // `cardsActive` (RM-123): switching back from cards mounts a new scroll box.
  }, [updateScrollAffordance, colCount, rows.length, cardsActive]);

  // ─── Empty / loading state ───────────────────────────────────────────────
  const showEmpty = !loading && rows.length === 0;
  const showSkeletons = loading && rows.length === 0;

  // Number of skeleton rows to show — caller can override via `loadingRows`.
  const skeletonRowCount = loadingRows ?? pageSize;

  // ─── Render helpers ───────────────────────────────────────────────────────

  // ─── Presentation helpers (RM-123) ─────────────────────────────────────────
  const headerHeightClass = density === "compact" ? "h-8" : "h-10";
  const cellPadYClass = density === "compact" ? "py-1" : "py-2";
  // TanStack's own default `cell` renderer: a column still using it gets its
  // `meta.format` applied; a column with its own `cell` renders that instead.
  const defaultCellRenderer = table._getDefaultColumnDef().cell;
  const rowColorColumns = leafColumns.filter((c) => c.columnDef.meta?.colorBy?.scope === "row");

  function cellLabel(value: unknown, meta: DataTableColumnMeta | undefined): string {
    return formatCellValue(value, meta?.format, formatNumber);
  }

  /** A cell's content: its visual, its markdown, its formatted value, or its `cell` renderer. */
  function renderCellContent(cell: Cell<TData, unknown>): ReactNode {
    const meta = cell.column.columnDef.meta;
    const visual = meta?.visual;
    const value = cell.getValue();
    const scale = columnScales?.get(cell.column.id);
    if (visual?.kind === "bar") {
      return (
        <BarCell
          value={typeof value === "number" ? value : null}
          label={cellLabel(value, meta)}
          domain={scale?.barDomain ?? [0, 0]}
          variant={visual.style}
          track={visual.track}
          fillColor={
            visual.colorBy
              ? scale?.barCategory?.colorOf(rowKeyValue(cell.row.original, visual.colorBy))
              : undefined
          }
          negativeColor={visual.negative !== false}
          labelWidth={labelBoxes.get(cell.column.id)?.value}
        />
      );
    }
    if (visual?.kind === "sparkline" || visual?.kind === "columns") {
      const values = seriesValues(cell.row.original, visual.keys);
      const label = values.map((v) => (v === null ? "–" : cellLabel(v, meta))).join(", ");
      const domain = visual.range === "column" ? (scale?.seriesExtent ?? null) : extentOf(values);
      if (visual.kind === "columns") {
        return (
          <ColumnsCell
            values={visual.keys.map((key, i) => ({ key, value: values[i] ?? null }))}
            domain={domain}
            label={label}
            height={visual.height}
          />
        );
      }
      const ends = seriesEnds(values);
      return (
        <SparklineCell
          values={values}
          domain={domain}
          label={label}
          fill={visual.fill}
          height={visual.height}
          ends={
            visual.labels === "ends" && ends
              ? [cellLabel(ends[0], meta), cellLabel(ends[1], meta)]
              : undefined
          }
          endsWidth={labelBoxes.get(cell.column.id)?.ends}
        />
      );
    }
    if (visual?.kind === "heatmap") {
      return <HeatmapCell label={cellLabel(value, meta)} hideValue={visual.hideValue} />;
    }
    if (meta?.markdown && typeof value === "string") {
      const images = typeof meta.markdown === "object" && meta.markdown.images === true;
      return <MarkdownCell text={value} images={images} />;
    }
    if (meta?.format && cell.column.columnDef.cell === defaultCellRenderer) {
      return cellLabel(value, meta);
    }
    return flexRender(cell.column.columnDef.cell, cell.getContext());
  }

  /** Extra `<td>` classes / style from the column meta (sizing, heatmap fill, colorBy). */
  function cellPresentation(
    cell: Cell<TData, unknown>,
    includeSizing = true,
  ): {
    className?: string;
    style?: React.CSSProperties;
  } {
    const meta = cell.column.columnDef.meta;
    if (!meta) return {};
    const scale = columnScales?.get(cell.column.id);
    let style = includeSizing ? columnSizeStyle(meta) : undefined;
    let className: string | undefined;
    if (meta.visual?.kind === "heatmap") {
      const value = cell.getValue();
      const color = scale?.heatmap?.colorOf(typeof value === "number" ? value : null) ?? null;
      style = { ...style, ...heatmapCellStyle(color) };
      // A value-less heatmap cell is pure colour: no padding (so the column can
      // shrink with the table) but a real height, or the band would vanish.
      className = meta.visual.hideValue ? "h-6 px-0 text-center" : "text-center";
    }
    if (meta.colorBy && (meta.colorBy.scope ?? "cell") === "cell") {
      const color =
        scale?.category?.colorOf(rowKeyValue(cell.row.original, meta.colorBy.key)) ?? null;
      const colorStyle = colorByStyle(meta.colorBy.target, color);
      if (colorStyle) style = { ...style, ...colorStyle };
    }
    return { className, style };
  }

  /** A row's `colorBy` (`scope: "row"`) style — the first such column that paints. */
  function rowColorStyle(row: Row<TData>): React.CSSProperties | undefined {
    for (const column of rowColorColumns) {
      const colorBy = column.columnDef.meta?.colorBy;
      if (!colorBy) continue;
      const color =
        columnScales?.get(column.id)?.category?.colorOf(rowKeyValue(row.original, colorBy.key)) ??
        null;
      const style = colorByStyle(colorBy.target, color);
      if (style) return style;
    }
    return undefined;
  }

  /** The printed rank for a row (`showRanks`); `undefined` for a sticky row. */
  function rankOf(row: Row<TData>): string | undefined {
    const rank = rowRanks?.get(row.id);
    return rank === undefined ? undefined : formatNumber(rank);
  }

  /**
   * A header's sort button — shared by the table header and the card layout's
   * sort bar (RM-123), so both name the column and its sort state identically.
   */
  function renderSortButton(header: Header<TData, unknown>) {
    const sorted = header.column.getIsSorted();
    const headerLabel =
      typeof header.column.columnDef.header === "string"
        ? header.column.columnDef.header
        : header.column.id;
    const sortStateLabel =
      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "not sorted";
    const SortIcon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
    return (
      <button
        type="button"
        onClick={header.column.getToggleSortingHandler()}
        aria-label={`Sort by ${headerLabel}, ${sortStateLabel}`}
        // `relative z-10` (round-2 fix, #82 follow-up — replaces
        // round-1's padding-based clearance, see the note on
        // `numericColumnClasses`): on a resizable column the
        // resize handle below is `absolute`, and CSS painting
        // order always puts a positioned descendant above
        // non-positioned in-flow content in the SAME stacking
        // context, regardless of DOM order — so without this,
        // the handle's 24px hit box would win every hit-test
        // where it overlaps this button's own trailing edge
        // (measured: a 12px overlap on an end-aligned
        // sortable+resizable column) no matter which element
        // renders first in markup. Giving the button its own
        // explicit positive z-index (not just `relative`, which
        // alone would still lose — see the code comment on
        // `numericColumnClasses` above) promotes it into a
        // later, higher-stacked paint step than the handle's
        // implicit `z-index: auto`, so the button wins the
        // overlap purely at the hit-test/paint layer — the
        // header's padding, and therefore its alignment with
        // the body `<td>`, never has to move. The handle's own
        // visible drag affordance (the `after:` seam, 0-8px
        // from the cell's trailing edge) sits entirely outside
        // this button's box (which ends at the same 12px inset
        // as the body), so dragging is unaffected.
        // RM-127 (a-5): `min-h-6` is the WCAG 2.2 target-size floor (2.5.8).
        // A sort button is 16–20 px of text, which only cleared the rule
        // through the "safe clickable space" around it — and two layouts have
        // no such space: `hideHeader` collapses the row to `h-0 p-0` (16 px
        // between neighbours) and the card sort bar packs the same buttons at
        // `gap-y-1` (4 px). The box is the target now, everywhere, rather than
        // the room that happens to be left beside it. No visual change in a
        // normal header, whose row is already taller than 24 px.
        className="relative z-10 inline-flex min-h-6 items-center gap-1 rounded-sm transition-colors duration-fast ease-standard hover:text-foreground focus-ring"
      >
        {flexRender(header.column.columnDef.header, header.getContext())}
        <SortIcon
          aria-hidden="true"
          className="size-3 shrink-0 transition-colors duration-fast ease-standard"
        />
      </button>
    );
  }

  /**
   * thead — sticky in virtualized mode, normal otherwise.
   * `withRowIndex` (virtualized only) sets the header row's `aria-rowindex` so the
   * windowed `aria-rowcount` on the table stays internally consistent with the
   * absolute indices on the data rows.
   */
  function renderThead(sticky: boolean, withRowIndex = false) {
    const headerGroups = table.getHeaderGroups();
    // Columns whose merged header already rendered in a higher row (RM-123).
    const mergedHeaderColumns = new Set<string>();
    return (
      <thead
        className={cn(
          // #173: header bottom is the only cue between header and first data row → border-strong
          // RM-123 `hideHeader`: the header row collapses to zero height (its
          // labels stay for screen readers), so it draws no rule and no wash.
          // A hidden header must not reserve width either — its own padding
          // would otherwise floor every column (a 24 px minimum per cell).
          hideHeader ? "[&_th]:h-0 [&_th]:p-0" : "border-b border-border-strong",
          // A sticky header scrolls OVER the body, so its fill must be opaque or data
          // rows bleed through the labels; the non-sticky header keeps the /60 wash.
          // z-20 (raised from z-10 for #333) puts the header row above the pinned
          // body cells (z-10) and below the pinned header corner (z-30). No visual
          // delta: nothing else in the table sits between those rungs.
          !hideHeader && (sticky ? "sticky top-0 z-20 bg-surface-muted" : "bg-surface-muted/60"),
        )}
      >
        {headerGroups.map((headerGroup, groupIndex) => (
          <tr key={headerGroup.id} aria-rowindex={withRowIndex ? groupIndex + 1 : undefined}>
            {hasGripColumn && (
              <th
                key="__reorder"
                scope="col"
                className="h-10 w-10 px-3 align-middle bg-table-header-background"
              >
                <span className="sr-only">{t("data.table.reorderColumnHeader")}</span>
              </th>
            )}
            {showRanks && groupIndex === 0 && (
              <DataTableRankHeader
                key="__rank"
                label={rankLabel}
                rowSpan={headerGroups.length > 1 ? headerGroups.length : undefined}
                className={cn(
                  headerHeightClass,
                  "font-table-header bg-table-header-background text-table-header-foreground text-table-header",
                )}
              />
            )}
            {headerGroup.headers.map((header) => {
              // RM-123: `showAt` hides leaf columns at render time, so a group
              // header spans only its SHOWN leaves and vanishes with none.
              const shownLeaves = header
                .getLeafHeaders()
                .filter((h) => h.subHeaders.length === 0 && isColumnShown(h.column)).length;
              if (shownLeaves === 0) return null;
              // RM-123 `mergeEmptyHeaders`: a leaf column's topmost empty
              // placeholder renders the column's own header, spanning down to
              // the leaf row; the placeholders and the leaf below it are skipped.
              let mergedRowSpan: number | undefined;
              if (mergeEmptyHeaders && mergedHeaderColumns.has(header.column.id)) return null;
              if (mergeEmptyHeaders && header.isPlaceholder) {
                mergedHeaderColumns.add(header.column.id);
                mergedRowSpan = headerGroups.length - groupIndex;
              }
              const merged = mergedRowSpan !== undefined;
              const geometry = pinnedCellGeometry(header.column);
              const canSort = header.column.getCanSort();
              const sorted = header.column.getIsSorted();
              // String-header fallback (`column.id`) so an icon-only / non-text
              // header still yields a named button (#230).
              const headerLabel =
                typeof header.column.columnDef.header === "string"
                  ? header.column.columnDef.header
                  : header.column.id;
              // #12: every column gets the same explicit width triad a pinned
              // column already has, gated behind `enableColumnResizing` so a
              // table that doesn't opt in stays byte-identical to before.
              const resizeStyle = enableColumnResizing
                ? resizeWidthStyle(header.getSize())
                : undefined;
              const canResize =
                enableColumnResizing && !header.isPlaceholder && header.column.getCanResize();
              const resizeMax = header.column.columnDef.maxSize;
              const content =
                header.isPlaceholder && !merged
                  ? null
                  : canSort
                    ? renderSortButton(header)
                    : flexRender(header.column.columnDef.header, header.getContext());
              return (
                <th
                  key={header.id}
                  scope="col"
                  colSpan={shownLeaves > 1 ? shownLeaves : undefined}
                  rowSpan={
                    mergedRowSpan !== undefined && mergedRowSpan > 1 ? mergedRowSpan : undefined
                  }
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
                  style={
                    geometry?.style ?? resizeStyle ?? columnSizeStyle(header.column.columnDef.meta)
                  }
                  className={cn(
                    // Same `px-3` the body `<td>` uses (below) — deliberately
                    // NOT split into `ps-3`/`pe-3` for a resize-handle
                    // override (round-1 briefly did this, see the round-2
                    // note on `numericColumnClasses`): the header's padding
                    // must stay byte-identical to the body's so an
                    // end-aligned numeric column's header lines up with its
                    // own values.
                    // Table-header seams (fidelity review #4): a theme dials
                    // background/foreground/size/transform/tracking via the
                    // `--table-header-*` contract; every default equals
                    // today's byte-identical rendering (transparent bg,
                    // `--muted-foreground` ink, 1em size = the table's own
                    // body size, no transform, body tracking).
                    headerHeightClass,
                    "px-3 text-start align-middle font-table-header bg-table-header-background text-table-header-foreground text-table-header tracking-(--table-header-tracking) [text-transform:var(--table-header-transform)]",
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
                    // Pinned corner keeps its OPAQUE ground above (unchanged
                    // default `transparent` on `--table-header-background`
                    // paints nothing here, byte-identical). A theme that fills
                    // the header instead layers that fill on an `after:`
                    // pseudo ABOVE the ground/wash (source order after
                    // `before:` at the same `-z-10` rung, below the cell's own
                    // text) so the corner stays opaque either way — it never
                    // replaces the ground the way overwriting `background-color`
                    // directly would.
                    geometry &&
                      "after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:bg-table-header-background after:content-['']",
                    // Separate cn() argument on purpose: the seam is the sole
                    // structural cue between the frozen and scrolling blocks, so
                    // it must not read as a "boundary + fill in one class string"
                    // redundancy (separation:check).
                    geometry?.edgeClass,
                    columnDividers && !geometry && COLUMN_DIVIDER_CLASS,
                  )}
                >
                  {hideHeader && content !== null ? (
                    // A focused sort button un-hides its label (skip-link idiom).
                    <span className="sr-only focus-within:not-sr-only">{content}</span>
                  ) : (
                    content
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
                        // `bg-primary` treatment — that is a drag AFFORDANCE,
                        // not a focus indicator, and it is redundant with the
                        // pointer capture, so it is out of scope here. The
                        // keyboard focus indicator on both branches is the
                        // shared compound one (#67), applied to the drawn seam
                        // via `focus-visible:after:focus-ring-static`: the
                        // element itself is a 24px transparent hit box, so
                        // ringing IT would ring nothing a user can see.
                        header.column.getIsResizing()
                          ? "after:absolute after:inset-y-0 after:end-0 after:w-2 after:bg-primary after:content-[''] focus-visible:after:focus-ring-static"
                          : "after:absolute after:inset-y-0 after:end-0 after:w-px after:bg-muted-foreground after:content-[''] hover:after:w-2 focus-visible:after:w-2 focus-visible:after:focus-ring-static",
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
   * - zebra (default): a gentle `--table-stripe` wash on alternate rows is the ONE
   *   separation gesture; rows carry NO divider (#173's strong divider was the cue
   *   only because nothing else was — the stripe replaces it, so a border would now
   *   be redundant per the surface-separation rule). A theme that turns the stripe
   *   off (`--table-stripe: transparent`) sets `--table-row-rule-width` to put the
   *   strong divider back as the sole cue; it is `0px` by default, so the stock
   *   stripe carries no border and no extra pixel.
   * - lines (`zebra={false}`): the classic `border-border-strong` divider between
   *   rows; `last:border-b-0` so the final divider doesn't double with the
   *   container's own bottom border (which reads as a heavy edge / shadow).
   */
  function rowSeparationClass(rowIndex: number): string {
    if (!zebra) return "border-b border-border-strong last:border-b-0";
    return cn(
      "border-b-(length:--table-row-rule-width) border-border-strong last:border-b-0",
      // Separate cn() argument: the stripe and the (theme-gated) rule are
      // alternative cues, never both at once — see the jsdoc above.
      rowIndex % 2 === 1 && "bg-table-stripe",
    );
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
      zebra && rowIndex % 2 === 1 && "before:bg-table-stripe",
      "group-hover/row:before:bg-table-row-hover",
      "group-data-[state=selected]/row:before:bg-selection",
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
    // Reorder metadata for THIS row, present in either handle mode whenever
    // reorder is active — `activator` is set only in `"cell"` mode, where the
    // grip button (not the row) is the drag activator (dnd-kit's
    // `setActivatorNodeRef` pattern).
    dragHandle?: {
      isDragging: boolean;
      activator?: {
        setActivatorNodeRef: (node: HTMLElement | null) => void;
        attributes: DraggableAttributes;
        listeners: DraggableSyntheticListeners;
      };
    },
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

    const sticky = stickyActive ? row.getIsPinned() || undefined : undefined;
    const rowStyle = rowColorStyle(row);
    return (
      <tr
        key={row.id}
        data-state={row.getIsSelected() ? "selected" : undefined}
        data-sticky={sticky}
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
          "transition-colors duration-fast ease-standard hover:bg-table-row-hover data-[state=selected]:bg-selection",
          // #13: the dragged row's live `transform` (set inline via `extras.style`,
          // see `SortableDataRow`) is what actually MOVES it — this class only
          // makes that movement glide instead of snapping, through the gated
          // duration/ease utilities (never a raw ms/ease value —
          // quality-gates.md "Motion-tokened") with a reduced-motion
          // neutralizer. Raising the dragged row's stacking + opacity is a
          // colour/composite-only cue, so it isn't gated by the same rule.
          dragHandle &&
            "relative transition-transform duration-base ease-standard motion-reduce:transition-none",
          dragHandle?.isDragging && "z-20 opacity-90 shadow-md",
          // Named group (#333) so a PINNED cell can re-apply the row's hover /
          // selected wash on top of its own opaque fill — only CSS knows the
          // pointer is over a sibling cell. Purely a selector hook: `group/row`
          // emits no style of its own.
          "group/row",
          rowSeparationClass(rowIndex),
          // RM-123 sticky rows: a quiet header-tone wash + medium weight mark
          // the "average" / "total" rows that repeat on every page.
          sticky && "font-medium",
          sticky && "bg-surface-muted/60",
          // `<tr>` isn't in the global auto-cursor-pointer role list (button/
          // menuitem/tab/…), so a clickable row needs its own cursor. The focus
          // ring is driven off the hidden button's `:focus-visible` (same
          // `has-[[data-slot=…]:focus-visible]` pattern as InputGroup) so the
          // ring paints on the ROW the user is about to activate, even though
          // focus lives on the sr-only control inside it.
          clickable &&
            "cursor-pointer has-[[data-slot=data-table-row-action]:focus-visible]:focus-ring-static-inset",
          rowClassName?.(row),
        )}
        {...extras}
        style={rowStyle || extras?.style ? { ...rowStyle, ...extras?.style } : undefined}
      >
        {dragHandle?.activator && (
          <td className="w-10 px-3 py-2 align-middle">
            <button
              type="button"
              ref={dragHandle.activator.setActivatorNodeRef}
              data-slot="data-table-row-drag-handle"
              aria-label={t("data.table.reorderHandle", { name: rowActionName(row) })}
              className={cn(
                "inline-flex size-7 cursor-grab items-center justify-center rounded-sm text-muted-foreground transition-colors duration-fast ease-standard hover:bg-foreground/10 hover:text-foreground focus-ring active:cursor-grabbing",
                dragHandle.isDragging && "text-foreground",
              )}
              {...dragHandle.activator.attributes}
              {...dragHandle.activator.listeners}
            >
              <GripVertical aria-hidden="true" className="size-4" />
            </button>
          </td>
        )}
        {showRanks && <DataTableRankCell rank={rankOf(row)} className={cellPadYClass} />}
        {row
          .getVisibleCells()
          .filter((cell) => isColumnShown(cell.column))
          .map((cell, cellIndex) => {
            const geometry = pinnedCellGeometry(cell.column);
            // #12: same width triad as the header cell — see `resizeWidthStyle`.
            const resizeStyle = enableColumnResizing
              ? resizeWidthStyle(cell.column.getSize())
              : undefined;
            const presentation = cellPresentation(cell);
            const baseStyle = geometry?.style ?? resizeStyle;
            return (
              <td
                key={cell.id}
                data-pinned={geometry?.pinned ?? undefined}
                style={presentation.style ? { ...baseStyle, ...presentation.style } : baseStyle}
                className={cn(
                  "px-3 align-middle",
                  cellPadYClass,
                  // #69: same numeric-column seam as the header — see
                  // `numericColumnClasses`.
                  numericColumnClasses(cell.column.columnDef.meta),
                  // z-10: above the normal (unpositioned) cells it scrolls over,
                  // below the sticky header row (z-20) and the pinned corner (z-30).
                  geometry && "sticky z-10",
                  geometry && pinnedCellFillClass(rowIndex),
                  // Separate cn() argument — see pinnedCellGeometry's edgeClass.
                  geometry?.edgeClass,
                  columnDividers && !geometry && COLUMN_DIVIDER_CLASS,
                  presentation.className,
                )}
              >
                {clickable && cellIndex === 0 && (
                  <button
                    type="button"
                    data-slot="data-table-row-action"
                    // #311: `sr-only` removes the box from the visual layout but
                    // not the browser's own focus ring — the ROW paints the
                    // deliberate compound indicator (via the `has-[…]` selector
                    // above), so the proxy's own native ring must be suppressed
                    // or it leaks as a stray dot at the row's edge.
                    className={ROW_ACTION_CLASS}
                    onClick={(event) => onRowClick?.(row, event)}
                  >
                    {rowActionName(row)}
                  </button>
                )}
                {renderCellContent(cell)}
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
    const visibleColumns = table.getVisibleLeafColumns().filter(isColumnShown);
    return Array.from({ length: count }).map((_, i) => (
      <tr key={`skeleton-${i}`} aria-hidden="true" className={rowSeparationClass(i)}>
        {hasGripColumn && (
          <td className="w-10 px-3 py-2 align-middle">
            <Skeleton className="size-4" />
          </td>
        )}
        {showRanks && (
          <td className={cn("w-10 px-3 align-middle", cellPadYClass)}>
            <Skeleton className="h-4 w-full" />
          </td>
        )}
        {visibleColumns.map((column) => (
          <td
            key={column.id}
            className={cn(
              "px-3 align-middle",
              cellPadYClass,
              numericColumnClasses(column.columnDef.meta),
              columnDividers && COLUMN_DIVIDER_CLASS,
            )}
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
        <td
          colSpan={colCount + leadingColCount}
          className="h-24 px-3 text-center text-muted-foreground"
        >
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
    if (showEmpty) {
      return <tbody>{renderEmptyBody()}</tbody>;
    }
    if (!rowReorderActive) {
      return (
        <tbody>
          {topRows.map((row, i) => renderRow(row, i))}
          {rows.map((row, i) => renderRow(row, i))}
          {bottomRows.map((row, i) => renderRow(row, i))}
        </tbody>
      );
    }

    // #13: `SortableContext` renders no DOM element of its own (a plain
    // context Provider), so nesting it around `<tbody>` here does not insert
    // anything between `<table>` and `<tbody>` — the real DOM stays valid.
    return (
      <SortableContext
        items={rows.map((r) => getReorderRowId(r))}
        strategy={verticalListSortingStrategy}
      >
        <tbody>
          {topRows.map((row, i) => renderRow(row, i))}
          {rows.map((row, i) => (
            <SortableDataRow
              key={getReorderRowId(row)}
              id={getReorderRowId(row)}
              attributesOverride={{
                // #98: dnd-kit's own `roleDescription: 'sortable'` default is
                // hardcoded English; override it with the localized value in
                // BOTH handle modes — `role` stays row-mode-only (see the
                // `attributesOverride` prop doc above).
                roleDescription: t("data.table.reorderRoleDescription"),
                ...(rowReorderHandle === "row" ? { role: "row" } : null),
              }}
            >
              {({ setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging, style }) =>
                renderRow(
                  row,
                  i,
                  {
                    ref: setNodeRef,
                    style,
                    // `aria-pressed` is a `DraggableAttributes` field meant for a
                    // real `<button>` activator; spread onto a `<tr role="row">`
                    // (row-handle mode) it fails axe's `aria-allowed-attr` (that
                    // ARIA state is not permitted on the `row` role), so strip it
                    // here rather than exempt it downstream.
                    ...(rowReorderHandle === "row"
                      ? (() => {
                          const { "aria-pressed": _ariaPressed, ...rowAttributes } = attributes;
                          return { ...rowAttributes, ...listeners };
                        })()
                      : {}),
                  } as React.HTMLAttributes<HTMLTableRowElement>,
                  {
                    isDragging,
                    activator:
                      rowReorderHandle === "cell"
                        ? { setActivatorNodeRef, attributes, listeners }
                        : undefined,
                  },
                )
              }
            </SortableDataRow>
          ))}
          {bottomRows.map((row, i) => renderRow(row, i))}
        </tbody>
      </SortableContext>
    );
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
            {topRows.map((row, i) =>
              renderRow(row, i, {
                "aria-rowindex": headerRowCount + i + 1,
              } as React.HTMLAttributes<HTMLTableRowElement>),
            )}
            {/* Top spacer — real <tr> so table layout is preserved */}
            {paddingTop > 0 && (
              <tr aria-hidden="true">
                <td style={{ height: paddingTop }} colSpan={colCount + leadingColCount} />
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
                // Absolute 1-based row position; header row(s) occupy
                // 1..headerRowCount and any top-pinned rows the slots after them.
                "aria-rowindex": firstCentreRowIndex + virtualRow.index,
              } as React.HTMLAttributes<HTMLTableRowElement>);
            })}
            {/* Bottom spacer */}
            {paddingBottom > 0 && (
              <tr aria-hidden="true">
                <td style={{ height: paddingBottom }} colSpan={colCount + leadingColCount} />
              </tr>
            )}
            {bottomRows.map((row, i) =>
              renderRow(row, i, {
                "aria-rowindex": firstCentreRowIndex + centreRowCount + i,
              } as React.HTMLAttributes<HTMLTableRowElement>),
            )}
          </>
        )}
      </tbody>
    );
  }

  // ─── Card layout (RM-123) ─────────────────────────────────────────────────
  // One `<dl>` card per row under `layout="cards"` / narrow `"auto"`. Same
  // table instance: the toolbar, the pager and the sort bar below drive it.

  /** Leaf headers by column id — a card's terms. */
  function leafHeadersById(): Map<string, Header<TData, unknown>> {
    const bottom = headerGroupsForCards[headerGroupsForCards.length - 1];
    return new Map((bottom?.headers ?? []).map((h) => [h.column.id, h]));
  }

  function renderCardSortBar() {
    const sortable = [...leafHeadersById().values()].filter(
      (h) => !h.isPlaceholder && isColumnShown(h.column) && h.column.getCanSort(),
    );
    // The selection column's header (select-all) leads the bar, as it leads the thead.
    const selectHeader = leafHeadersById().get("select");
    if (sortable.length === 0 && !selectHeader) return null;
    return (
      <div
        data-slot="data-table-card-sort"
        className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border-strong px-3 py-2 text-meta text-muted-foreground"
      >
        {selectHeader && !selectHeader.isPlaceholder ? (
          <span className="inline-flex">
            {flexRender(selectHeader.column.columnDef.header, selectHeader.getContext())}
          </span>
        ) : null}
        {sortable.map((header) => (
          <span key={header.id} className="inline-flex">
            {renderSortButton(header)}
          </span>
        ))}
      </div>
    );
  }

  function renderCard(
    row: Row<TData>,
    headers: Map<string, Header<TData, unknown>>,
    extras?: { ref?: React.Ref<HTMLLIElement>; "data-index"?: number },
  ) {
    const cells = row.getVisibleCells().filter((cell) => isColumnShown(cell.column));
    const selectCell = cells.find((cell) => cell.column.id === "select");
    const clickable = Boolean(onRowClick);
    const sticky = stickyActive ? row.getIsPinned() || undefined : undefined;
    const fields: DataTableCardField[] = [];
    const rank = rankOf(row);
    if (showRanks && rank !== undefined) {
      // The cards layout has room for the column's real name, so it prints it:
      // a `<dl>` term reading "#" would carry the same ambiguity as the header.
      fields.push({
        id: "__rank",
        term: rankLabel ?? t("data.table.rankHeader"),
        value: rank,
        className: "tabular-nums",
      });
    }
    for (const cell of cells) {
      if (cell === selectCell) continue;
      const def = cell.column.columnDef.header;
      const header = headers.get(cell.column.id);
      const presentation = cellPresentation(cell, false);
      fields.push({
        id: cell.column.id,
        term:
          typeof def === "string"
            ? def
            : header
              ? flexRender(def, header.getContext())
              : cell.column.id,
        value: renderCellContent(cell),
        className: cn(
          cell.column.columnDef.meta?.numeric && "tabular-nums",
          presentation.style?.backgroundColor !== undefined && "min-h-5 rounded-sm px-1",
        ),
        style: presentation.style,
      });
    }
    return (
      <DataTableCard
        key={row.id}
        ref={extras?.ref}
        data-index={extras?.["data-index"]}
        fields={fields}
        density={density}
        data-state={row.getIsSelected() ? "selected" : undefined}
        data-sticky={sticky}
        onClick={
          clickable
            ? (event) => {
                if (isInteractiveEventTarget(event.target)) return;
                if (isActiveTextSelection()) return;
                onRowClick?.(row, event);
              }
            : undefined
        }
        style={rowColorStyle(row)}
        className={cn(
          "transition-colors duration-fast ease-standard data-[state=selected]:bg-selection",
          clickable &&
            "cursor-pointer hover:bg-table-row-hover has-[[data-slot=data-table-row-action]:focus-visible]:focus-ring-static-inset",
          sticky && "font-medium",
          sticky && "bg-surface-muted/60",
        )}
        lead={
          selectCell || clickable ? (
            <>
              {selectCell && (
                <div className="mb-1.5">
                  {flexRender(selectCell.column.columnDef.cell, selectCell.getContext())}
                </div>
              )}
              {clickable && (
                <button
                  type="button"
                  data-slot="data-table-row-action"
                  className={ROW_ACTION_CLASS}
                  onClick={(event) => onRowClick?.(row, event)}
                >
                  {rowActionName(row)}
                </button>
              )}
            </>
          ) : undefined
        }
      />
    );
  }

  function renderCardList(virtualized: boolean) {
    if (showSkeletons) {
      const count = virtualized ? (loadingRows ?? Math.min(10, pageSize)) : skeletonRowCount;
      return (
        <DataTableCardList aria-hidden="true">
          {Array.from({ length: count }).map((_, i) => (
            <li key={`skeleton-${i}`} className="space-y-2 px-3 py-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </li>
          ))}
        </DataTableCardList>
      );
    }
    if (showEmpty) {
      return <StatePanel kind="empty" title={emptyMessage} />;
    }
    const headers = leafHeadersById();
    return (
      <DataTableCardList aria-labelledby={caption != null ? captionId : undefined}>
        {topRows.map((row) => renderCard(row, headers))}
        {virtualized && paddingTop > 0 && <li aria-hidden="true" style={{ height: paddingTop }} />}
        {virtualized
          ? virtualItems.map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;
              return renderCard(row, headers, {
                ref: virtualizer.measureElement as React.Ref<HTMLLIElement>,
                "data-index": virtualRow.index,
              });
            })
          : rows.map((row) => renderCard(row, headers))}
        {virtualized && paddingBottom > 0 && (
          <li aria-hidden="true" style={{ height: paddingBottom }} />
        )}
        {bottomRows.map((row) => renderCard(row, headers))}
      </DataTableCardList>
    );
  }

  /** The cards' own accessible name: `caption`, as a hidden paragraph the list points at. */
  const cardsCaption =
    caption != null ? (
      <p id={captionId} className="sr-only">
        {caption}
      </p>
    ) : null;

  // ─── Heatmap legends (RM-123) ─────────────────────────────────────────────
  // One key per heatmap scale (columns sharing a spec share one), above the table.
  function renderLegends() {
    const seen = new Set<string>();
    const legends: ReactNode[] = [];
    for (const column of table.getVisibleLeafColumns()) {
      const visual = column.columnDef.meta?.visual;
      if (visual?.kind !== "heatmap" || !visual.legend || !isColumnShown(column)) continue;
      const scale = columnScales?.get(column.id);
      if (!scale?.heatmap || scale.heatmapGroup === undefined || seen.has(scale.heatmapGroup)) {
        continue;
      }
      seen.add(scale.heatmapGroup);
      const header = column.columnDef.header;
      legends.push(
        <HeatmapLegend
          key={column.id}
          scale={scale.heatmap}
          title={
            typeof visual.legend === "string"
              ? visual.legend
              : typeof header === "string"
                ? header
                : undefined
          }
          formatValue={(v) => cellLabel(v, column.columnDef.meta)}
        />,
      );
    }
    // b-6: a `colorBy` column's category key. Same reason the heatmap column
    // gets one — a fill that is the only carrier of a category cannot be read
    // without a key (WCAG 1.4.1) — but for an UNORDERED scale, so it names
    // each category instead of printing class bounds. One key per source key,
    // however many columns colour by it; `legend: false` opts a column out.
    const seenCategoryKeys = new Set<string>();
    for (const column of table.getVisibleLeafColumns()) {
      if (!isColumnShown(column)) continue;
      const meta = column.columnDef.meta;
      const scale = columnScales?.get(column.id);
      const bar = meta?.visual?.kind === "bar" ? meta.visual : undefined;
      const keys: { key: string; scale: ColorScale; legend: string | boolean | undefined }[] = [];
      if (bar?.colorBy && scale?.barCategory) {
        keys.push({ key: bar.colorBy, scale: scale.barCategory, legend: bar.legend });
      }
      if (meta?.colorBy && scale?.category) {
        keys.push({ key: meta.colorBy.key, scale: scale.category, legend: meta.colorBy.legend });
      }
      for (const entry of keys) {
        if (entry.legend === false || seenCategoryKeys.has(entry.key)) continue;
        seenCategoryKeys.add(entry.key);
        legends.push(
          <CategoryLegend
            key={`category-${entry.key}`}
            scale={entry.scale}
            title={typeof entry.legend === "string" ? entry.legend : entry.key}
          />,
        );
      }
    }

    // b-5: the ranks column's key. A heatmap column gets a legend because its
    // colour is unreadable without one; the rank column has exactly the same
    // problem in digits — "2, 1, 6, 4" beside a descending column reads as a
    // broken ranking until something says the numbers are the DATA order. The
    // header carries it as an accessible name; this carries it for everyone
    // who can see the table. Rendered above both the table and the cards
    // layout, so it cannot be lost in a branch.
    const rankKey = showRanks ? (
      <p
        key="__rank-key"
        data-slot="data-table-rank-key"
        className="text-meta text-muted-foreground"
      >
        {rankLabel != null ? `# — ${rankLabel}` : t("data.table.rankKey")}
      </p>
    ) : null;
    if (legends.length === 0 && rankKey === null) return null;
    return (
      <div data-slot="data-table-legends" className="flex flex-wrap gap-x-6 gap-y-2">
        {legends}
        {rankKey}
      </div>
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
      <div ref={rootRef} {...presentationAttrs} className={cn("space-y-3", className)} {...rest}>
        {toolbar ? toolbar(table) : null}
        {renderLegends()}
        {/* Outer border is redundant (surface change) → plain border per #173 spec.
            tabIndex={0} makes the windowed scroll region keyboard-operable — the rows
            themselves aren't focusable, so without it the off-screen rows are
            unreachable by keyboard (WCAG 2.1.1 / axe `scrollable-region-focusable`). */}
        <div
          ref={scrollRef}
          tabIndex={0}
          // Names the focus stop (WCAG 4.1.2). A naming-capable role is required
          // for that name to compute at all — `aria-label` on a plain `<div>`
          // (role `generic`) is not guaranteed to produce an accessible name.
          // `group`, not `region`: a landmark per table would be redundant over
          // the real <table> and collide under axe `landmark-unique` when two
          // tables share a page.
          role="group"
          aria-label={t("data.table.scrollRegion")}
          aria-busy={loading || undefined}
          className="relative overflow-auto rounded-lg border bg-card focus-ring"
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
              <span className="sr-only">{t("data.table.loading")}</span>
            </div>
          )}
          {cardsActive ? (
            <div data-slot="data-table-card-region" className="text-body">
              {cardsCaption}
              {renderCardSortBar()}
              {renderCardList(true)}
            </div>
          ) : (
            <table
              aria-busy={loading || undefined}
              aria-rowcount={ariaRowCount}
              className="w-full caption-bottom text-body"
            >
              {captionElement}
              {renderThead(true, true)}
              {renderTbodyVirtualized()}
            </table>
          )}
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
  const nonVirtualizedContent = (
    <div ref={rootRef} {...presentationAttrs} className={cn("space-y-3", className)} {...rest}>
      {toolbar ? toolbar(table) : null}
      {renderLegends()}
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
            <span className="sr-only">{t("data.table.loading")}</span>
          </div>
        )}
        {/* The tab stop exists ONLY while the region measurably overflows: without
            it, columns beyond the viewport are unreachable by keyboard (WCAG 2.1.1 /
            axe `scrollable-region-focusable`) — but adding it unconditionally would
            give every table that FITS a focus stop that does nothing and announces
            "scrollable" when it isn't. `aria-label` moves with it (WCAG 4.1.2:
            a name for a stop that exists, none for one that doesn't) — and
            `role="group"` moves with BOTH of them: `aria-label` on a plain
            `<div>` (role `generic`) is not guaranteed to compute into an
            accessible name, so the stop needs a naming-capable role. `group`,
            never the `region` landmark: that would be redundant over the real
            <table> and collide (axe `landmark-unique`) with every other
            overflowing table on the page. */}
        {cardsActive ? (
          <div data-slot="data-table-card-region">
            {cardsCaption}
            {renderCardSortBar()}
            {renderCardList(false)}
          </div>
        ) : (
          <div
            ref={plainScrollRef}
            data-slot="data-table-scroll-region"
            tabIndex={scrollOverflows ? 0 : undefined}
            role={scrollOverflows ? "group" : undefined}
            aria-label={scrollOverflows ? t("data.table.scrollRegion") : undefined}
            onScroll={updateScrollAffordance}
            className="overflow-auto rounded-lg focus-ring-inset"
            style={hasLeftPinned || hasRightPinned ? pinnedScrollPadding : undefined}
          >
            <table aria-busy={loading || undefined} className="w-full caption-bottom text-body">
              {captionElement}
              {renderThead(false)}
              {renderTbodyNormal()}
            </table>
          </div>
        )}
        {/* Horizontal-scroll edge fade — a token-driven affordance that only
            appears once the table actually overflows its container in that
            direction, so a desktop/wide table renders neither (visual no-op).

            #333: an edge with a PINNED column renders no fade. The fade lives
            outside the scroll region and would paint a 32px wash straight over
            the frozen column's own text; and the affordance is already carried
            there by the pinned block's `border-border-strong` seam, which is
            what a frozen column means ("content slides under this edge"). So
            the fade stays the cue for a FREE edge only. */}
        {!cardsActive && canScrollLeft && !hasLeftPinned && (
          <div
            aria-hidden="true"
            data-slot="data-table-scroll-fade-left"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 rounded-lg bg-gradient-to-r from-card to-transparent"
          />
        )}
        {!cardsActive && canScrollRight && !hasRightPinned && (
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

  // #13: `DndContext` renders no wrapping DOM element around `children` either
  // — it composes `children` alongside its own hidden a11y nodes (the
  // screen-reader instructions, plus a `role="status"` `LiveRegion` that is
  // permanently silent — see `silentDragAnnouncements` above) as SIBLINGS.
  // Wrapping the whole component root here (rather than reaching inside the
  // `<table>`) is what keeps those hidden nodes out of the table's own DOM —
  // they land beside the table's outer `<div>`, never inside a
  // `<thead>`/`<tbody>`, which is the only place in HTML that would reject
  // them. DataTable's OWN `aria-live="polite"` region (`reorderLiveMessage`)
  // is a further sibling here for the same reason.
  if (!rowReorderActive) return nonVirtualizedContent;
  return (
    <DndContext
      sensors={reorderSensors}
      collisionDetection={closestCenter}
      onDragStart={handleRowDragStart}
      onDragOver={handleRowDragOver}
      onDragEnd={handleRowDragEnd}
      onDragCancel={handleRowDragCancel}
      accessibility={{
        announcements: silentDragAnnouncements,
        // #98: dnd-kit's own hidden keyboard-instructions node is hardcoded
        // English (`defaultScreenReaderInstructions`) unless overridden here.
        screenReaderInstructions: { draggable: t("data.table.reorderInstructions") },
      }}
    >
      {nonVirtualizedContent}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-slot="data-table-reorder-live-region"
        className="sr-only"
      >
        {reorderLiveMessage}
      </div>
    </DndContext>
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
