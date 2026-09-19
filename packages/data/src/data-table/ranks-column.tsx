"use client";

import { forwardRef, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { cn } from "@elabs-ai/components-ui/lib/cn";

/**
 * ranks-column.tsx — `DataTable`'s `showRanks` column (RM-123).
 *
 * A rank belongs to the ROW: it is the row's 1-based position in the `data`
 * you passed (sticky rows excluded), so re-sorting, filtering or paging moves
 * the numbers with their rows and never renumbers them. It is rendered beside
 * the TanStack columns, not as one, so the table model is unchanged.
 */

/** Row id → rank (1…n in data order), skipping the ids in `exclude`. */
export function computeRowRanks(
  rowIds: readonly string[],
  exclude: ReadonlySet<string> = new Set(),
): Map<string, number> {
  const ranks = new Map<string, number>();
  let rank = 0;
  for (const id of rowIds) {
    if (!exclude.has(id)) ranks.set(id, ++rank);
  }
  return ranks;
}

/** The ranks column's header cell. Its visible label is the number sign. */
export const DataTableRankHeader = forwardRef<
  HTMLTableCellElement,
  ThHTMLAttributes<HTMLTableCellElement>
>(function DataTableRankHeader({ className, children = "#", ...props }, ref) {
  return (
    <th
      ref={ref}
      scope="col"
      data-slot="data-table-rank-header"
      className={cn("w-10 px-3 text-end align-middle tabular-nums", className)}
      {...props}
    >
      {children}
    </th>
  );
});

/** One row's rank cell; `rank` undefined (a sticky row) renders empty. */
export const DataTableRankCell = forwardRef<
  HTMLTableCellElement,
  TdHTMLAttributes<HTMLTableCellElement> & { rank?: string }
>(function DataTableRankCell({ rank, className, ...props }, ref) {
  return (
    <td
      ref={ref}
      data-slot="data-table-rank-cell"
      className={cn(
        "w-10 px-3 text-end align-middle tabular-nums text-muted-foreground",
        className,
      )}
      {...props}
    >
      {rank}
    </td>
  );
});
