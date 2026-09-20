"use client";

import { forwardRef, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { useLocale } from "@elabs-ai/components-ui";
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

export interface DataTableRankHeaderProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /**
   * The column's accessible NAME, and its `title`. Defaults to the locale
   * seam's `data.table.rankHeader`.
   *
   * The visible glyph stays "#" — it has to, in a 40px column — so the glyph
   * is decorative (`aria-hidden`) and this string is what the column is
   * actually called. Without it the header's accessible name is the single
   * character "#", which says nothing about WHICH position is printed: beside
   * a sorted column the numbers legitimately read 2, 1, 6, 4 and a reader has
   * no way to learn why. `DataTable` prints the same rule visibly, once, above
   * the table (`data-slot="data-table-rank-key"`).
   */
  label?: string;
}

/**
 * The ranks column's header cell: "#" as the visible glyph, `label` as the
 * name AT reads.
 */
export const DataTableRankHeader = forwardRef<HTMLTableCellElement, DataTableRankHeaderProps>(
  function DataTableRankHeader({ className, children, label, ...props }, ref) {
    const { t } = useLocale();
    const name = label ?? t("data.table.rankHeader");
    return (
      <th
        ref={ref}
        scope="col"
        title={name}
        data-slot="data-table-rank-header"
        className={cn("w-10 px-3 text-end align-middle tabular-nums", className)}
        {...props}
      >
        {children ?? (
          <>
            <span aria-hidden="true">#</span>
            <span className="sr-only">{name}</span>
          </>
        )}
      </th>
    );
  },
);

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
