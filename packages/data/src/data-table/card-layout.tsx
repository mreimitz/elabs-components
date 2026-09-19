"use client";

import { forwardRef, type HTMLAttributes, type LiHTMLAttributes, type ReactNode } from "react";
import { cn } from "@elabs-ai/components-ui/lib/cn";

/**
 * card-layout.tsx — `DataTable`'s transposed card rows (RM-123, `layout`).
 *
 * Under the table's `narrow` breakpoint (`layout="auto"`) or always
 * (`layout="cards"`), each row renders as one card: a `<dl>` whose terms are
 * the column headers and whose details are the row's cells. Only the markup
 * changes — the TanStack model (sorting, filtering, paging, selection) is the
 * same instance the table uses, so the toolbar and pager keep working.
 */

/** One term / detail pair of a card. */
export interface DataTableCardField {
  /** Stable key: the column id. */
  id: string;
  term: ReactNode;
  value: ReactNode;
  /** Extra classes / style for the detail (alignment, a colour wash). */
  className?: string;
  style?: React.CSSProperties;
}

/** The list that holds the cards. Rows are separated by a strong divider. */
export const DataTableCardList = forwardRef<HTMLUListElement, HTMLAttributes<HTMLUListElement>>(
  function DataTableCardList({ className, ...props }, ref) {
    return (
      <ul
        ref={ref}
        data-slot="data-table-card-list"
        className={cn("divide-y divide-border-strong", className)}
        {...props}
      />
    );
  },
);

export interface DataTableCardProps extends LiHTMLAttributes<HTMLLIElement> {
  fields: readonly DataTableCardField[];
  /** Content above the fields (the selection checkbox, the rank, the row action). */
  lead?: ReactNode;
  /** `compact` tightens the padding, like the table's `density="compact"`. */
  density?: "default" | "compact";
}

/** One row as a card: a `<dl>` of header → cell pairs. */
export const DataTableCard = forwardRef<HTMLLIElement, DataTableCardProps>(function DataTableCard(
  { fields, lead, density = "default", className, ...props },
  ref,
) {
  return (
    <li
      ref={ref}
      data-slot="data-table-card"
      className={cn("px-3", density === "compact" ? "py-2" : "py-3", className)}
      {...props}
    >
      {lead}
      <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-1.5">
        {fields.map((field) => (
          <div key={field.id} data-slot="data-table-card-field" className="contents">
            <dt className="min-w-0 break-words text-meta text-muted-foreground">{field.term}</dt>
            <dd className={cn("min-w-0 break-words", field.className)} style={field.style}>
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </li>
  );
});
