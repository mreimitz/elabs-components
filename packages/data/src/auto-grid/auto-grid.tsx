"use client";

/**
 * AutoGrid — a DataGrid (or DataTable) from ONE serialisable spec: rows,
 * optional column specs (inferred from the rows when absent) and an optional
 * saved view. The grid an agent should reach for: every prop is JSON, so it
 * validates against the A2UI catalog and survives a round trip through a
 * model; the app never writes a `ColumnDef`.
 */
import { forwardRef, useMemo } from "react";
import { DataTable, type DataTableViewState } from "../data-table/data-table";
import { DataGrid } from "../data-grid/data-grid";
import { parseGridState, type GridState } from "../data-table/grid-state";
import { columnsFromSpec, type DataGridColumnSpec } from "./infer-columns";

type Row = Record<string, unknown>;

export interface DataGridSpec {
  rows: Row[];
  /** Column specs; inferred from `rows` when absent. */
  columns?: DataGridColumnSpec[];
  /** Field holding each row's stable id (default: `id` when every row has one, else the index). */
  idKey?: string;
  /** Accessible name of the grid (also the export file name). */
  title?: string;
  /** Initial view — a `GridState` (versioned) or a plain view snapshot. */
  view?: GridState | Partial<DataTableViewState>;
  /** `"grid"` (default): the spreadsheet preset; `"table"`: a read-only document table. */
  mode?: "grid" | "table";
  /** Show a totals row (columns with `aggregate`). */
  totals?: boolean;
  /** Group rows by these column keys. */
  groupBy?: string[];
  /** Show the floating filter row. */
  floatingFilters?: boolean;
  /** Body height in px; long tables (> 200 rows) virtualize inside it. Default 480. */
  height?: number;
}

export interface AutoGridProps {
  spec: DataGridSpec;
  /** Rows are on their way: a layout-shaped skeleton. */
  loading?: boolean;
  /** A row was activated (click / Enter) — receives the row's data. */
  onRowClick?: (row: Row) => void;
  className?: string;
}

export const AutoGrid = forwardRef<HTMLDivElement, AutoGridProps>(function AutoGrid(
  { spec, loading = false, onRowClick, className },
  ref,
) {
  const rows = spec.rows ?? [];
  const columns = useMemo(() => columnsFromSpec(spec.columns, rows), [spec.columns, rows]);
  const initialView = useMemo(() => {
    const view: DataTableViewState = spec.view
      ? parseGridState(spec.view).state
      : { sorting: [], columnVisibility: {}, columnFilters: [] };
    if (spec.groupBy?.length) view.grouping = spec.groupBy;
    // Column specs may pin; a saved view's own pinning wins.
    const left = (spec.columns ?? []).filter((c) => c.pinned === "left").map((c) => c.key);
    const right = (spec.columns ?? []).filter((c) => c.pinned === "right").map((c) => c.key);
    if (!view.columnPinning && (left.length || right.length)) view.columnPinning = { left, right };
    return view;
  }, [spec.view, spec.groupBy, spec.columns]);
  const idKey =
    spec.idKey ??
    (rows.length > 0 && rows.every((r) => r.id !== undefined && r.id !== null) ? "id" : undefined);
  const virtualize = rows.length > 200;
  const common = {
    ref,
    columns,
    data: rows,
    loading,
    caption: spec.title,
    exportFileName: spec.title ?? "export",
    initialView,
    getRowId: (row: Row, index: number) => (idKey ? String(row[idKey]) : String(index)),
    enableRowVirtualization: virtualize,
    maxBodyHeight: virtualize ? `${spec.height ?? 480}px` : undefined,
    showTotals: spec.totals,
    onRowClick: onRowClick ? (row: { original: Row }) => onRowClick(row.original) : undefined,
    className,
  };
  return spec.mode === "table" ? (
    <DataTable {...common} data-slot="auto-grid" enableFilterUI showFilterChips />
  ) : (
    <DataGrid
      {...common}
      data-slot="auto-grid"
      enableGrouping
      floatingFilters={spec.floatingFilters}
    />
  );
});
