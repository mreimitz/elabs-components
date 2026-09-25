"use client";

/**
 * status-bar.tsx — DataGrid's footer summary: how many rows exist, match the
 * filter and are selected, plus Count / Sum / Average / Min / Max of the
 * numeric cells in the current range (Excel's status bar). Numbers go
 * through the locale's number format. Not a live region: it changes on every
 * arrow key, and announcing each change would drown the grid itself.
 */
import { useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { RangeStats } from "./grid-model";

export interface DataTableStatusBarProps {
  totalRows: number;
  /** Rows matching the current filter / search (omit when not filtered). */
  filteredRows?: number;
  selectedRows: number;
  /** Stats of the selected cell range (omit when fewer than two cells). */
  stats?: RangeStats | null;
  className?: string;
}

export function DataTableStatusBar({
  totalRows,
  filteredRows,
  selectedRows,
  stats,
  className,
}: DataTableStatusBarProps) {
  const { t, formatNumber } = useLocale();
  const n = (value: number) => formatNumber(value, { maximumFractionDigits: 2 });
  const rowsText =
    filteredRows !== undefined && filteredRows !== totalRows
      ? t("data.table.filteredRowCount", { shown: n(filteredRows), total: n(totalRows) })
      : t("data.table.rowCount", { count: totalRows, total: n(totalRows) });
  return (
    <div
      role="group"
      aria-label={t("data.table.statusBar")}
      data-slot="data-table-status-bar"
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-caption text-muted-foreground tabular-nums",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span>{rowsText}</span>
        {selectedRows > 0 && (
          <span>{t("data.table.selectedRowCount", { count: n(selectedRows) })}</span>
        )}
      </div>
      {stats && stats.count > 1 && (
        <dl className="flex flex-wrap items-center gap-x-3">
          <Stat label={t("data.table.statCount")} value={n(stats.count)} />
          {stats.numericCount > 0 && (
            <>
              <Stat label={t("data.table.statSum")} value={n(stats.sum)} />
              <Stat label={t("data.table.statAvg")} value={n(stats.avg)} />
              <Stat label={t("data.table.statMin")} value={n(stats.min)} />
              <Stat label={t("data.table.statMax")} value={n(stats.max)} />
            </>
          )}
        </dl>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <dt>{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
