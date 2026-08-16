"use client";

/**
 * The one grid every tabular format renders into.
 *
 * CSV and XLSX arrive through completely different parsers and end up wanting
 * exactly the same thing: a header row, body rows, a truncation notice and an
 * `sr-only` caption. That is a PATTERN, not a coincidence, so it is named once
 * here rather than copied a second time (`.claude/rules/design-first.md` —
 * patterns over instances).
 *
 * It stays deliberately dumb: no sorting, no filtering, no virtualization. A
 * preview pane is for looking; past a few thousand rows the right component is
 * `DataTable` in `@elabs-ai/components-data`, which virtualizes.
 */

import {
  cn,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useLocale,
} from "@elabs-ai/components-ui";
import { useRef } from "react";

import { type MarkRanges } from "../core/highlight-marks";
import { chunkOffset } from "../core/text-index";
import { useScrollActiveHighlightIntoView } from "../core/use-highlight-scroll";
import { GRID_CELL_SEPARATOR, GRID_HEAD_ROW } from "./grid-text";
import { MarkedText } from "./marked-text";

export interface SheetTableProps {
  /** Header cells. May be empty — the grid still renders its body. */
  columns: string[];
  /** Body rows, already capped by the caller. */
  rows: string[][];
  /** Total body rows in the file, when more exist than `rows` holds. */
  totalRows?: number;
  className?: string;
  /** Marks to paint, in projection offsets. */
  marks?: MarkRanges;
  /**
   * Where a row's first cell begins in the projection — {@link GRID_HEAD_ROW}
   * for the header. A function rather than an array so a workbook can answer
   * for the sheet being drawn without slicing an index per tab.
   */
  rowStart?: (row: number) => number | undefined;
  /** Scrolls the current mark into this grid's own viewport when it changes. */
  activeHighlightId?: string | null;
}

export function SheetTable({
  columns,
  rows,
  totalRows,
  className,
  marks,
  rowStart,
  activeHighlightId,
}: SheetTableProps) {
  const { t, formatNumber } = useLocale();
  const viewport = useRef<HTMLDivElement>(null);

  useScrollActiveHighlightIntoView(viewport, activeHighlightId);

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-2", className)}>
      {totalRows !== undefined && (
        // A status, not an error: the file is fine, we are simply showing part
        // of it (loading-states.md — a capability bound is news, not an alarm).
        <p role="status" className="text-meta text-muted-foreground shrink-0">
          {t("viewer.table.truncated", { count: formatNumber(rows.length) })}
        </p>
      )}
      {/* The grid keeps its OWN viewport, unlike the flowing formats: a workbook
          puts a sheet-tab bar above it that must not scroll away with the rows.
          A table cell is not focusable, so a scrollable region wrapping one is
          unreachable from a keyboard (WCAG 2.1.1) — `tabIndex={0}` makes it a
          real stop that arrow keys and Page Up/Down drive. `group`, not
          `region`, so a sheet does not mint a second landmark inside the
          viewer's content region. */}
      <div
        ref={viewport}
        tabIndex={0}
        role="group"
        aria-label={t("viewer.content")}
        className="focus-visible:ring-ring min-h-0 flex-1 overflow-auto focus-visible:outline-none focus-visible:ring-2"
      >
        <Table>
          <TableCaption className="sr-only">
            {t("viewer.table.caption", {
              rows: formatNumber(totalRows ?? rows.length),
              columns: formatNumber(columns.length),
            })}
          </TableCaption>
          <TableHeader>
            <TableRow>
              {columns.map((column, index) => (
                // The file's own header text is the only identity a column has;
                // an empty one still needs a cell so the grid stays aligned.
                <TableHead key={`${column}-${String(index)}`} scope="col">
                  <MarkedText
                    text={column}
                    marks={marks}
                    start={chunkOffset(
                      columns,
                      index,
                      rowStart?.(GRID_HEAD_ROW),
                      GRID_CELL_SEPARATOR,
                    )}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIndex) => {
              const start = rowStart?.(rowIndex);
              return (
                <TableRow key={rowIndex}>
                  {columns.map((_, columnIndex) => (
                    <TableCell key={columnIndex} className="whitespace-pre-wrap">
                      <MarkedText
                        text={row[columnIndex] ?? ""}
                        marks={marks}
                        start={chunkOffset(row, columnIndex, start, GRID_CELL_SEPARATOR)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
