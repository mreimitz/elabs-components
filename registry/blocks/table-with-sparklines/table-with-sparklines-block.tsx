/**
 * Table with sparklines (copy-owned block).
 *
 * Composes the charts `Sparkline` into a `DataTable` cell. `@elabs-ai/components-data`
 * never imports `@elabs-ai/components-charts` (sibling packages; see the dep-direction
 * rule), so this composition lives in a copy-owned registry block, not in `data`.
 *
 * Reach for it when a row needs the full charts sparkline (a target line, a
 * baseline series, a last-value label). For a plain in-cell trend that shares
 * one y scale down the column, `data`'s own `meta.visual: { kind: "sparkline" }`
 * is lighter and needs no charts install.
 *
 * Depends on installed @elabs-ai/components-data + @elabs-ai/components-charts.
 * Swap the row type, columns and data for your own.
 */
"use client";

import { Sparkline } from "@elabs-ai/components-charts";
import { DataTable, type ColumnDef } from "@elabs-ai/components-data";

interface ServiceTrend {
  service: string;
  /** Requests per second, one value per day, oldest first. */
  daily: number[];
  target: number;
}

const rows: ServiceTrend[] = [
  { service: "api-gateway", daily: [410, 432, 455, 448, 470, 492, 515], target: 480 },
  { service: "billing", daily: [120, 118, 126, 131, 129, 124, 122], target: 130 },
  { service: "search", daily: [260, 244, 251, 238, 229, 233, 241], target: 250 },
  { service: "notifications", daily: [88, 95, 102, 99, 110, 118, 121], target: 100 },
];

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const columns: ColumnDef<ServiceTrend>[] = [
  { accessorKey: "service", header: "Service", enableSorting: true },
  {
    id: "latest",
    header: "Latest (req/s)",
    accessorFn: (row) => row.daily[row.daily.length - 1] ?? 0,
    enableSorting: true,
    meta: { numeric: true, format: { abbreviate: false, decimals: 0 } },
  },
  {
    id: "trend",
    header: "Last 7 days",
    cell: ({ row }) => (
      <Sparkline
        variant="line"
        values={row.original.daily}
        target={row.original.target}
        fit="fill"
        width={140}
        height={28}
        formatValue={(value) => integer.format(value)}
        label={`${row.original.service}, last 7 days: ${row.original.daily
          .map((value) => integer.format(value))
          .join(", ")} requests per second; target ${integer.format(row.original.target)}`}
        className="w-full min-w-24"
      />
    ),
  },
];

export function TableWithSparklinesBlock() {
  return (
    <div className="w-full max-w-3xl">
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.service}
        caption="Requests per second by service, last 7 days"
      />
    </div>
  );
}
