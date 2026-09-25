import type { RowData, RowModel, RowPinningState } from "./tanstack";
import type { Table as V9Table } from "@tanstack/react-table";
import type { DataTableFeatures } from "./tanstack";

/**
 * sticky-rows.ts — `DataTable`'s `stickyRows` (RM-123): rows such as an
 * "average" or "total" that stay at the top or bottom of EVERY page and after
 * every sort.
 *
 * Built on TanStack's own row pinning (`keepPinnedRows`), so the table model is
 * unchanged: a sticky row keeps its id, its selection and its `data` index; it
 * is only rendered outside the sorted / paged centre rows.
 */

export type DataTableStickyRowPosition = "top" | "bottom";

/** Decides, per record, whether its row sticks to the top or the bottom (or neither). */
export type DataTableStickyRows<TData> = (
  row: TData,
  index: number,
) => DataTableStickyRowPosition | undefined;

const EMPTY: RowPinningState = { top: [], bottom: [] };

/**
 * The TanStack `rowPinning` state for `stickyRows` over `data`, in data order.
 * Row ids follow TanStack's own rule: `getRowId(row, index)`, else the index.
 */
export function stickyRowPinning<TData>(
  data: readonly TData[],
  stickyRows: DataTableStickyRows<TData> | undefined,
  getRowId?: (row: TData, index: number) => string,
): RowPinningState {
  if (!stickyRows) return EMPTY;
  const top: string[] = [];
  const bottom: string[] = [];
  data.forEach((row, index) => {
    const position = stickyRows(row, index);
    if (!position) return;
    const id = getRowId ? getRowId(row, index) : String(index);
    (position === "top" ? top : bottom).push(id);
  });
  return top.length === 0 && bottom.length === 0 ? EMPTY : { top, bottom };
}

/**
 * Wraps a filtered-row-model factory so sticky (pinned) rows leave the flow the
 * table sorts and pages: every page holds `pageSize` ordinary rows and the page
 * count ignores the sticky ones, which `keepPinnedRows` still renders at the
 * top / bottom of every page. Sticky rows are also exempt from search and
 * filters — an "average" row describes the whole table, not the matches.
 */
export function withoutStickyRows<TData extends RowData>(
  factory: (table: V9Table<DataTableFeatures, TData>) => () => RowModel<TData>,
): (table: V9Table<DataTableFeatures, TData>) => () => RowModel<TData> {
  return (table) => {
    const compute = factory(table);
    let lastModel: RowModel<TData> | undefined;
    let lastPinning: RowPinningState | undefined;
    let lastResult: RowModel<TData> | undefined;
    return () => {
      const model = compute();
      const pinning = table.atoms.rowPinning?.get();
      if (model === lastModel && pinning === lastPinning && lastResult) return lastResult;
      lastModel = model;
      lastPinning = pinning;
      const sticky = new Set([...(pinning?.top ?? []), ...(pinning?.bottom ?? [])]);
      if (sticky.size === 0) {
        lastResult = model;
        return model;
      }
      const rows = model.rows.filter((row) => !sticky.has(row.id));
      const flatRows = model.flatRows.filter((row) => !sticky.has(row.id));
      const rowsById = Object.fromEntries(flatRows.map((row) => [row.id, row]));
      lastResult = { rows, flatRows, rowsById } as RowModel<TData>;
      return lastResult;
    };
  };
}
