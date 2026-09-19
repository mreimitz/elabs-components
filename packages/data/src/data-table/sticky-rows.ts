import type { RowPinningState } from "@tanstack/react-table";

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
