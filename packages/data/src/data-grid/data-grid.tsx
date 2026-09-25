"use client";

import { forwardRef } from "react";
import { DataTable, type DataTableProps } from "../data-table/data-table";
import type { RowData } from "../data-table/tanstack";

/**
 * `DataGrid` — the spreadsheet-grade preset of `DataTable`.
 *
 * Same engine, same props, same presentation layer; it switches on the WAI-ARIA
 * grid interaction (`interaction="grid"`): one tab stop, arrow-key navigation
 * across header and body cells, Excel-style cell ranges (drag, Shift, Ctrl/⌘),
 * Ctrl/⌘+A and copy as tab-separated text — plus column resizing, the
 * column menu (sort, pin, move, auto-size, fit, hide, reset) and drag /
 * Shift+←/→ column reordering, a cell context menu (copy, copy with headers,
 * export CSV) and a status bar (row counts + range Count / Sum / Average /
 * Min / Max), all on by default; columns fit the width until resized.
 *
 * Reach for `DataGrid` when people WORK in the data (analysts, operators,
 * back-office); keep `DataTable` for reading and scanning (reports, editorial
 * tables, lists with row actions).
 */
export type DataGridProps<TData extends RowData, TValue> = Omit<
  DataTableProps<TData, TValue>,
  "interaction"
>;

function DataGridInner<TData extends RowData, TValue>(
  {
    enableColumnResizing = true,
    enableColumnMenu = true,
    enableColumnReorder = true,
    autoSizeStrategy = "fit",
    enableContextMenu = true,
    showStatusBar = true,
    ...props
  }: DataGridProps<TData, TValue>,
  ref: React.Ref<HTMLDivElement>,
) {
  return (
    <DataTable
      ref={ref}
      data-slot="data-grid"
      interaction="grid"
      enableColumnResizing={enableColumnResizing}
      enableColumnMenu={enableColumnMenu}
      enableColumnReorder={enableColumnReorder}
      autoSizeStrategy={autoSizeStrategy}
      enableContextMenu={enableContextMenu}
      showStatusBar={showStatusBar}
      {...props}
    />
  );
}

export const DataGrid = forwardRef(DataGridInner) as <TData extends RowData, TValue>(
  props: DataGridProps<TData, TValue> & { ref?: React.Ref<HTMLDivElement> },
) => React.ReactElement | null;
