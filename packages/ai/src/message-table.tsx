"use client";

/**
 * MessageTable — a model-emittable data table rendered inside a chat message.
 *
 * The model emits a serializable, column-oriented `TableSpec` (see
 * `message-table-spec.ts`); MessageTable renders a lightweight table (NOT the
 * app-chrome `@elabs-ai/components-data` DataTable — this is message content).
 *
 * Design bar (mirrors AutoChart):
 * - Spec-driven, zod-validated; the model never chooses the look.
 * - Never throws. A malformed spec → `MessageTableFallback`; an unknown format
 *   falls back to text; a missing cell renders an em-dash.
 * - Streaming-tolerant. Half-arrived columns/rows are dropped or render
 *   progressively; a spec with columns but no rows yet shows skeleton rows.
 * - Tokens only; numeric columns are end-aligned + `tabular-nums`.
 * - Optional client-side sort (controlled OR uncontrolled) and an optional
 *   per-cell `renderCell` override for consumer composition.
 *
 * Composes the `@elabs-ai/components-ui` `Table` primitive.
 */

import { forwardRef, useId, useMemo, useState, type HTMLAttributes, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import {
  Badge,
  Skeleton,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { useLocale } from "@elabs-ai/components-ui";

import {
  badgeToneForValue,
  compareCellValues,
  EMPTY_CELL,
  formatCellValue,
  isEmptyCell,
  isNumericFormat,
  normalizeTableSpec,
  type ColumnSpec,
  type TableRowData,
  type TableSpec,
} from "./message-table-spec";

// ─── Sort ─────────────────────────────────────────────────────────────────────

export interface TableSort {
  /** The sorted column's key. */
  key: string;
  direction: "asc" | "desc";
}

/** Per-cell render override — return `undefined` to fall back to default rendering. */
export type RenderCell = (args: {
  value: unknown;
  column: ColumnSpec;
  row: TableRowData;
  rowIndex: number;
}) => ReactNode;

// ─── Fallback ─────────────────────────────────────────────────────────────────

export interface MessageTableFallbackProps extends HTMLAttributes<HTMLDivElement> {
  /** Short human reason the table could not render. */
  message?: string;
}

/** Shown when the spec is unusable. Mirrors `ChartFallback` semantics. */
export const MessageTableFallback = forwardRef<HTMLDivElement, MessageTableFallbackProps>(
  function MessageTableFallback(
    { message = "This table could not be displayed.", className, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        className={cn(
          // Sole structural cue is the border (no fill) — reads in every theme,
          // incl. themes where surface-muted ≈ background. border-strong is
          // contrast-guaranteed vs the background.
          "flex items-center justify-center rounded-md border border-border-strong px-4 py-6 text-center text-body text-muted-foreground",
          className,
        )}
        {...props}
      >
        {message}
      </div>
    );
  },
);

// ─── MessageTable ─────────────────────────────────────────────────────────────

export interface MessageTableProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** The serializable table specification produced by an LLM tool-call. */
  spec: TableSpec | unknown;
  /** Enable click-to-sort column headers. @default false */
  sortable?: boolean;
  /** Controlled sort. When provided, `onSortChange` is the only way to update it. */
  sort?: TableSort | null;
  /** Uncontrolled initial sort. */
  defaultSort?: TableSort | null;
  /** Called with the next sort (or `null`) when a header is clicked. */
  onSortChange?: (sort: TableSort | null) => void;
  /** Cap the number of rendered rows; shows a "Showing N of M rows" notice. */
  maxRows?: number;
  /** Per-cell render override for custom composition. */
  renderCell?: RenderCell;
  /** The spec is still streaming (columns-but-no-rows shows skeleton rows). */
  streaming?: boolean;
}

/**
 * MessageTable — renders a `TableSpec` as a lightweight message-body table.
 *
 * Intentionally bare: no toolbar, no expand chrome. Growing one here would be
 * `ChartFrame` re-implemented inside this package.
 *
 * **To make it expandable, wrap it in `ExpandDialog`**
 * (`@elabs-ai/components-ui`) — the shared two-pane expand surface,
 * the same one a chart opens. Do NOT hand-roll a lightbox or a full-screen
 * breakout; four of those already existed before the component was shared, and
 * each one taught users a different meaning for the same button.
 *
 * The context pane for a table is its SHAPE, not statistics: row count,
 * "showing N of M", column count, each column's declared `format`. A
 * model-emitted table's numerics may already be formatted strings, so min/max/avg
 * over them is wrong more often than right.
 */
export const MessageTable = forwardRef<HTMLDivElement, MessageTableProps>(function MessageTable(
  {
    spec,
    sortable = false,
    sort: sortProp,
    defaultSort = null,
    onSortChange,
    maxRows,
    renderCell,
    streaming = false,
    className,
    ...props
  },
  ref,
) {
  const { t } = useLocale();
  const reactId = useId();
  const isControlled = sortProp !== undefined;
  const [internalSort, setInternalSort] = useState<TableSort | null>(defaultSort);
  const resolvedSort = isControlled ? (sortProp as TableSort | null) : internalSort;

  const result = normalizeTableSpec(spec);

  const normalized = result.ok ? result.spec : null;

  const sortedRows = useMemo<TableRowData[]>(() => {
    if (!normalized || !resolvedSort) return normalized?.rows ?? [];
    const column = normalized.columns.find((c) => c.key === resolvedSort.key);
    if (!column) return normalized.rows;
    const direction = resolvedSort.direction === "asc" ? 1 : -1;
    return [...normalized.rows].sort(
      (a, b) => direction * compareCellValues(a[column.key], b[column.key], column.format),
    );
  }, [normalized, resolvedSort]);

  if (!result.ok) {
    return (
      <MessageTableFallback ref={ref} message={result.reason} className={className} {...props} />
    );
  }

  const { columns, title, emptyText } = result.spec;

  // No columns: skeleton while streaming, otherwise a fallback.
  if (columns.length === 0) {
    if (streaming) {
      return (
        <div ref={ref} className={cn("w-full", className)} {...props}>
          <span className="sr-only" role="status" aria-live="polite">
            Loading table…
          </span>
          <div
            aria-hidden="true"
            className="flex flex-col gap-2 rounded-md border border-border p-3"
          >
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      );
    }
    return (
      <MessageTableFallback
        ref={ref}
        message="This table has no columns to display."
        className={className}
        {...props}
      />
    );
  }

  const total = sortedRows.length;
  const cappedRows =
    maxRows !== undefined && maxRows >= 0 ? sortedRows.slice(0, maxRows) : sortedRows;
  const truncatedCount = total - cappedRows.length;

  const titleId = title ? `${reactId}-title` : undefined;

  const setSort = (next: TableSort | null) => {
    if (!isControlled) setInternalSort(next);
    onSortChange?.(next);
  };

  const toggleSort = (column: ColumnSpec) => {
    if (resolvedSort?.key === column.key) {
      setSort({ key: column.key, direction: resolvedSort.direction === "asc" ? "desc" : "asc" });
    } else {
      setSort({ key: column.key, direction: "asc" });
    }
  };

  const renderCellContent = (
    column: ColumnSpec,
    row: TableRowData,
    rowIndex: number,
  ): ReactNode => {
    const value = row[column.key];
    if (renderCell) {
      const overridden = renderCell({ value, column, row, rowIndex });
      if (overridden !== undefined) return overridden;
    }
    if (isEmptyCell(value)) {
      return <span className="text-muted-foreground">{EMPTY_CELL}</span>;
    }
    if (column.format === "badge") {
      return <Badge variant={badgeToneForValue(value)}>{String(value)}</Badge>;
    }
    return formatCellValue(value, column.format);
  };

  return (
    <div ref={ref} className={cn("w-full", className)} {...props}>
      {title && (
        <p id={titleId} className="mb-1 text-body font-semibold text-foreground text-balance">
          {title}
        </p>
      )}
      <div className="overflow-hidden rounded-md border border-border">
        {streaming && cappedRows.length === 0 && (
          <span className="sr-only" role="status" aria-live="polite">
            Loading table…
          </span>
        )}
        <Table
          aria-labelledby={titleId}
          aria-label={title ? undefined : t("ai.messageTable.label")}
          aria-busy={(streaming && cappedRows.length === 0) || undefined}
        >
          {truncatedCount > 0 && (
            <TableCaption className="mb-2 mt-3 px-3 text-caption">
              Showing {cappedRows.length} of {total} rows
            </TableCaption>
          )}
          <TableHeader>
            <TableRow>
              {columns.map((column) => {
                const numeric = isNumericFormat(column.format);
                const active = resolvedSort?.key === column.key;
                const ariaSort = active
                  ? resolvedSort?.direction === "asc"
                    ? "ascending"
                    : "descending"
                  : sortable
                    ? "none"
                    : undefined;
                const label = column.label ?? column.key;
                return (
                  <TableHead
                    key={column.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={cn(numeric && "text-end")}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-sm font-medium",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                          "hover:text-foreground transition-colors duration-fast ease-standard motion-reduce:transition-none",
                          numeric && "flex-row-reverse",
                        )}
                      >
                        <span>{label}</span>
                        {active ? (
                          resolvedSort?.direction === "asc" ? (
                            <ChevronUp aria-hidden="true" className="size-3.5" />
                          ) : (
                            <ChevronDown aria-hidden="true" className="size-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown aria-hidden="true" className="size-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      label
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cappedRows.length === 0 && streaming ? (
              [0, 1, 2].map((i) => (
                <TableRow key={`skeleton-${i}`} aria-hidden="true">
                  {columns.map((column) => (
                    <TableCell key={column.key}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : cappedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-6 text-center text-muted-foreground"
                >
                  {emptyText ?? "No rows to display"}
                </TableCell>
              </TableRow>
            ) : (
              cappedRows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map((column) => {
                    const numeric = isNumericFormat(column.format);
                    return (
                      <TableCell
                        key={column.key}
                        className={cn(numeric && "text-end tabular-nums")}
                      >
                        {renderCellContent(column, row, rowIndex)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
});
