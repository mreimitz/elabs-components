"use client";

/**
 * CaseTable — the case drill-down every auditor persona needs (RM-055, issue #204, §4 R11).
 *
 * A column CONFIGURATION over `@elabs-ai/components-data`'s `DataTable`, not a table
 * implementation (`.claude/rules/data.md` — "primitives go down, compositions go up"):
 * this file authors no `<table>` markup of its own. Row activation, keyboard navigation,
 * loading/empty states and the CSV column-order contract all come straight from `DataTable`;
 * the only thing this component adds is the domain reading (which field is a column, how a
 * duration/conformance value prints) and the export button.
 *
 * ## CSV export mirrors the VISIBLE columns
 *
 * `toCsv` is called with the SAME column set the table renders (the default set, or the
 * caller's own `columns` override) — in the same order, with the same header text — so a
 * consumer who narrows or reorders `columns` gets an export that matches what is on screen,
 * attribute columns included. Header/value resolution reads a `ColumnDef`'s own
 * `accessorKey`/`accessorFn` directly rather than re-deriving through a live table instance,
 * which keeps this a pure per-row mapping (no TanStack `Table` needed for the export path).
 */
import { forwardRef, useCallback, useMemo, type HTMLAttributes, type ReactNode } from "react";
import { Download } from "lucide-react";
import { DataTable, toCsv, type ColumnDef } from "@elabs-ai/components-data";
import { Button, downloadBlob, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { CaseRow } from "../core/cases-from-log";
import { createCaseTableColumns } from "./columns";

export interface CaseTableProps extends HTMLAttributes<HTMLDivElement> {
  cases: CaseRow[];
  /** Column configuration over `DataTable`. Defaults to `createCaseTableColumns`'s set. */
  columns?: ColumnDef<CaseRow>[];
  /** Fired when a row is activated (click, or Enter/Space on its keyboard activation target). */
  onCaseOpen?: (caseId: string) => void;
  /** File name for the CSV export. Default `"cases.csv"`. */
  exportFileName?: string;
  loading?: boolean;
  /** Message shown when there are no cases and not loading. */
  emptyMessage?: ReactNode;
}

type CaseTableColumn = ColumnDef<CaseRow> & {
  id?: string;
  accessorKey?: string;
  accessorFn?: (row: CaseRow, index: number) => unknown;
};

function csvKey(column: CaseTableColumn): string {
  return column.id ?? column.accessorKey ?? "";
}

function csvHeader(column: CaseTableColumn): string {
  return typeof column.header === "string" ? column.header : csvKey(column);
}

function csvValue(row: CaseRow, column: CaseTableColumn): string | number | boolean | null {
  const value =
    typeof column.accessorFn === "function"
      ? column.accessorFn(row, 0)
      : typeof column.accessorKey === "string"
        ? (row as unknown as Record<string, unknown>)[column.accessorKey]
        : undefined;
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
}

function toCsvRecord(
  row: CaseRow,
  columns: CaseTableColumn[],
): Record<string, string | number | boolean | null> {
  const record: Record<string, string | number | boolean | null> = {};
  for (const column of columns) {
    const key = csvKey(column);
    if (key) record[key] = csvValue(row, column);
  }
  return record;
}

export const CaseTable = forwardRef<HTMLDivElement, CaseTableProps>(function CaseTable(
  {
    cases,
    columns,
    onCaseOpen,
    exportFileName = "cases.csv",
    loading = false,
    emptyMessage,
    className,
    ...props
  },
  ref,
) {
  const { t, formatDate } = useLocale();

  const resolvedColumns = useMemo<CaseTableColumn[]>(
    () => columns ?? createCaseTableColumns({ t, formatDate }),
    [columns, t, formatDate],
  );

  const handleExport = useCallback(() => {
    const csvColumns = resolvedColumns.map((column) => ({
      key: csvKey(column),
      header: csvHeader(column),
    }));
    const rows = cases.map((row) => toCsvRecord(row, resolvedColumns));
    const csv = toCsv(rows, { columns: csvColumns });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `${exportFileName.replace(/\.csv$/i, "")}.csv`);
  }, [cases, resolvedColumns, exportFileName]);

  return (
    <div
      ref={ref}
      data-slot="case-table"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    >
      <div data-slot="case-table-toolbar" className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={cases.length === 0}
        >
          <Download aria-hidden="true" />
          {t("process.caseTable.exportCsv")}
        </Button>
      </div>
      <DataTable<CaseRow, unknown>
        data={cases}
        columns={resolvedColumns}
        getRowId={(row) => row.caseId}
        loading={loading}
        emptyMessage={emptyMessage ?? t("process.caseTable.empty")}
        onRowClick={onCaseOpen ? (row) => onCaseOpen(row.original.caseId) : undefined}
        caption={t("process.caseTable.tableLabel")}
      />
    </div>
  );
});
