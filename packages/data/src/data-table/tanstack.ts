/**
 * tanstack.ts — the one place `@elabs-ai/components-data` touches TanStack Table.
 *
 * The package runs on TanStack Table v9: rows, cells and columns share
 * prototype APIs instead of per-instance closures, which cut row-model memory
 * ~4.7× at 100k rows against v8 (measured in
 * docs/review/2026-09-25-datatable-vs-ag-grid-gap-analysis.md).
 *
 * Every public type keeps its v8 name and generic arity (`ColumnDef<TData,
 * TValue>`, `Row<TData>`, `Table<TData>` …) by binding v9's `TFeatures`
 * parameter to the one feature set DataTable registers — the same shape v9's
 * own `useLegacyTable` uses (`LegacyFeatures`: the stock features plus the
 * built-in filter / sort / aggregation registries, so string ids such as
 * `sortingFn: "alphanumeric"` keep working). Consumers import these names from
 * `@elabs-ai/components-data`, never from TanStack.
 */
import {
  aggregationFns,
  createExpandedRowModel,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  sortFns,
  stockFeatures,
  type CellContext as V9CellContext,
  type HeaderContext as V9HeaderContext,
  type RowData,
  type RowModel as V9RowModel,
  type Table as V9Table,
  type SortFnOption,
  type TableFeatures,
} from "@tanstack/react-table";
import type {
  LegacyCell,
  LegacyColumn,
  LegacyColumnDef,
  LegacyFeatures,
  LegacyHeader,
  LegacyHeaderGroup,
  LegacyReactTable,
  LegacyRow,
} from "@tanstack/react-table/legacy";
import { compileFilter, isActiveFilter, isFilterModel } from "./grid/filter-model";

export { flexRender, useTable } from "@tanstack/react-table";
/**
 * v8-style hook for code that builds its OWN table instance (tests, stories,
 * copy-owned blocks) — v9's compatibility hook, same row-model markers.
 */
export {
  useLegacyTable as useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
} from "@tanstack/react-table/legacy";
export type {
  ColumnMeta,
  ColumnFiltersState,
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  ColumnVisibilityState as VisibilityState,
  ExpandedState,
  GroupingState,
  OnChangeFn,
  PaginationState,
  RowData,
  RowPinningState,
  SortingState,
  Updater,
} from "@tanstack/react-table";

/**
 * Which rows are checked, keyed by row id. v8's shape (`true`/`false` per id)
 * — v9 only stores `true`, so DataTable drops `false` entries on the way in.
 */
export type RowSelectionState = Record<string, boolean>;

/** The feature set every DataTable registers. */
export type DataTableFeatures = LegacyFeatures;

/**
 * v8 → v9 column-option renames DataTable still accepts (it copies them onto
 * the v9 name before the table sees the column, see `normalizeColumns`).
 */
export interface V8ColumnDefCompat<TData extends RowData> {
  /**
   * v8 name of `sortFn`: a custom comparator, or a registered sort id.
   * @deprecated Use `sortFn` (TanStack v9). Still honoured by DataTable.
   */
  sortingFn?: SortFnOption<DataTableFeatures, TData>;
}

export type ColumnDef<TData extends RowData, TValue = unknown> = LegacyColumnDef<TData, TValue> &
  V8ColumnDefCompat<TData>;

// TanStack's filterFn shape varies with the feature / row generics; the
// wrapper only forwards arguments, so it takes them untyped.
/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyFilterFn = ((row: any, columnId: string, filterValue: any, addMeta?: any) => boolean) & {
  resolveFilterValue?: (value: any) => unknown;
  autoRemove?: (value: any, column?: any) => boolean;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const COMPILED = Symbol("dataTableCompiledFilter");
interface CompiledFilter {
  [COMPILED]: (value: unknown) => boolean;
}
const MODEL_AWARE = new WeakSet<AnyFilterFn>();
const wrappedCache = new WeakMap<AnyFilterFn, AnyFilterFn>();

/**
 * Teaches a filter function DataTable's filter models (`grid/filter-model.ts`):
 * a model value is compiled once per pass and evaluated against the cell;
 * anything else reaches the original function untouched, so existing
 * `FacetFilter` arrays, strings and ranges keep their TanStack meaning.
 */
export function withFilterModels(fn: AnyFilterFn): AnyFilterFn {
  const cached = wrappedCache.get(fn);
  if (cached) return cached;
  const wrapped: AnyFilterFn = (row, columnId, filterValue, addMeta) => {
    if (filterValue && typeof filterValue === "object" && COMPILED in filterValue) {
      return (filterValue as CompiledFilter)[COMPILED](row.getValue(columnId));
    }
    return fn(row, columnId, filterValue, addMeta);
  };
  wrapped.resolveFilterValue = (value) =>
    isFilterModel(value)
      ? ({ [COMPILED]: compileFilter(value) } satisfies CompiledFilter)
      : (fn.resolveFilterValue?.(value) ?? value);
  wrapped.autoRemove = (value, column) =>
    isFilterModel(value)
      ? !isActiveFilter(value)
      : fn.autoRemove
        ? fn.autoRemove(value, column)
        : typeof value === "string" && !value;
  MODEL_AWARE.add(wrapped);
  wrappedCache.set(fn, wrapped);
  return wrapped;
}

const modelAwareFilterFns = Object.fromEntries(
  Object.entries(filterFns).map(([id, fn]) => [id, withFilterModels(fn as AnyFilterFn)]),
) as typeof filterFns;

/**
 * Copies v8 option names onto their v9 names, recursively through column
 * groups. Returns the same array when nothing needs renaming, so a memoized
 * `columns` prop stays referentially stable for the table.
 */
export function normalizeColumns<TData extends RowData, TValue>(
  columns: readonly ColumnDef<TData, TValue>[],
): ColumnDef<TData, TValue>[] {
  let changed = false;
  const next = columns.map((def) => {
    const group = def as { columns?: ColumnDef<TData, TValue>[] };
    const compat = def as V8ColumnDefCompat<TData> & { sortFn?: unknown };
    let out = def;
    if (compat.sortingFn !== undefined && compat.sortFn === undefined) {
      out = { ...out, sortFn: compat.sortingFn } as ColumnDef<TData, TValue>;
    }
    const aggregate = (def as { meta?: { aggregate?: string } }).meta?.aggregate;
    if (aggregate && (def as { aggregationFn?: unknown }).aggregationFn === undefined) {
      out = { ...out, aggregationFn: aggregate } as ColumnDef<TData, TValue>;
    }
    const filterFn = (def as { filterFn?: unknown }).filterFn;
    if (typeof filterFn === "function" && !MODEL_AWARE.has(filterFn as AnyFilterFn)) {
      out = { ...out, filterFn: withFilterModels(filterFn as AnyFilterFn) } as ColumnDef<
        TData,
        TValue
      >;
    }
    if (group.columns) {
      const children = normalizeColumns(group.columns);
      if (children !== group.columns)
        out = { ...out, columns: children } as ColumnDef<TData, TValue>;
    }
    if (out !== def) changed = true;
    return out;
  });
  return changed ? next : (columns as ColumnDef<TData, TValue>[]);
}
export type Column<TData extends RowData, TValue = unknown> = LegacyColumn<TData, TValue>;
export type Cell<TData extends RowData, TValue = unknown> = LegacyCell<TData, TValue>;
export type Header<TData extends RowData, TValue = unknown> = LegacyHeader<TData, TValue>;
export type HeaderGroup<TData extends RowData> = LegacyHeaderGroup<TData>;
export type Row<TData extends RowData> = LegacyRow<TData>;
/** The table instance handed to `toolbar` (v8-compatible `getState()` included). */
export type Table<TData extends RowData> = LegacyReactTable<TData>;
/** The core v9 table (what cell / header contexts carry). */
export type CoreTable<TData extends RowData> = V9Table<DataTableFeatures, TData>;
export type RowModel<TData extends RowData> = V9RowModel<DataTableFeatures, TData>;
export type CellContext<TData extends RowData, TValue = unknown> = V9CellContext<
  DataTableFeatures,
  TData,
  TValue
>;
export type HeaderContext<TData extends RowData, TValue = unknown> = V9HeaderContext<
  DataTableFeatures,
  TData,
  TValue
>;

type RowModelFactory<TData extends RowData> = (
  table: V9Table<DataTableFeatures, TData>,
) => () => RowModel<TData>;

export interface DataTableFeatureOptions<TData extends RowData> {
  /** Wraps the filtered row model (e.g. to take sticky rows out of the flow). */
  wrapFiltered?: (factory: RowModelFactory<TData>) => RowModelFactory<TData>;
  /**
   * Whether the paginated model should paginate. Read on every compute, so
   * turning pagination on or off never needs a new table instance (v9 fixes a
   * table's features at construction).
   */
  paginate: () => boolean;
}

/**
 * The features object for `useTable`. Built ONCE per table (v9 reads
 * `features` at construction), so anything that can change between renders is
 * read through a callback, never captured by value.
 */
export function createDataTableFeatures<TData extends RowData>(
  options: DataTableFeatureOptions<TData>,
): DataTableFeatures {
  const filtered = createFilteredRowModel<DataTableFeatures, TData>() as RowModelFactory<TData>;
  const paginated = createPaginatedRowModel<DataTableFeatures, TData>() as RowModelFactory<TData>;
  const paginatedWhenEnabled: RowModelFactory<TData> = (table) => {
    const compute = paginated(table);
    return () => (options.paginate() ? compute() : table.getPrePaginatedRowModel());
  };
  return {
    ...stockFeatures,
    filterFns: { ...modelAwareFilterFns },
    sortFns: { ...sortFns },
    aggregationFns: { ...aggregationFns },
    filteredRowModel: options.wrapFiltered ? options.wrapFiltered(filtered) : filtered,
    sortedRowModel: createSortedRowModel(),
    paginatedRowModel: paginatedWhenEnabled,
    expandedRowModel: createExpandedRowModel(),
    groupedRowModel: createGroupedRowModel(),
    facetedRowModel: createFacetedRowModel(),
    facetedUniqueValues: createFacetedUniqueValues(),
    facetedMinMaxValues: createFacetedMinMaxValues(),
  } as unknown as DataTableFeatures;
}

declare module "@tanstack/react-table" {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  interface TableMeta<TFeatures extends TableFeatures, TData extends RowData> {
    /** Set by DataTable: which interaction model its own cells adapt to. */
    dataTableInteraction?: "table" | "grid";
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}
