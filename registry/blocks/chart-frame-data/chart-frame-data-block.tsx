/**
 * ChartFrame + @elabs-ai/components-data block (copy-owned).
 *
 * Upgrades `ChartFrame`'s flip-to-table to the full TanStack `DataTable` (sortable,
 * filterable) and its CSV download to `@elabs-ai/components-data`'s `downloadCsv` — the richer
 * experience that the bare `@elabs-ai/components-charts` package intentionally does NOT pull in
 * (charts must not depend on the sibling `@elabs-ai/components-data`; see CH-01 #116). Copy-owned
 * registry blocks may compose both siblings, so the wiring lives here.
 *
 * Depends on installed @elabs-ai/components-charts + @elabs-ai/components-data. Swap the sample data/columns
 * and the chart child for your own.
 */
"use client";

import {
  Bar,
  BarChart,
  BarXAxis,
  ChartFrame,
  ChartTooltip,
  Grid,
} from "@elabs-ai/components-charts";
import { DataTable, downloadCsv, type ColumnDef } from "@elabs-ai/components-data";

// A `type` alias, not an `interface`: only aliases get TypeScript's implicit index
// signature, which is what makes `Row[]` assignable to `ChartFrame`'s
// `Record<string, unknown>[]` data prop.
type Row = {
  month: string;
  revenue: number;
  profit: number;
};

const data: Row[] = [
  { month: "Jan", revenue: 12000, profit: 4500 },
  { month: "Feb", revenue: 15500, profit: 5200 },
  { month: "Mar", revenue: 11000, profit: 3800 },
  { month: "Apr", revenue: 18500, profit: 7100 },
  { month: "May", revenue: 16800, profit: 5400 },
  { month: "Jun", revenue: 21200, profit: 8800 },
];

const columns = [
  { key: "month", header: "Month" },
  { key: "revenue", header: "Revenue ($)" },
  { key: "profit", header: "Profit ($)" },
];

export function ChartFrameDataBlock() {
  return (
    <ChartFrame
      title="Monthly revenue"
      description="ChartFrame wired to @elabs-ai/components-data — full DataTable on flip, downloadCsv on export"
      data={data}
      columns={columns}
      // Flip-to-table renders the full TanStack DataTable instead of the bare table.
      renderTable={(rows, cols) => (
        <DataTable
          data={rows}
          columns={cols.map(
            (c): ColumnDef<Record<string, unknown>> => ({
              accessorKey: c.key,
              header: c.header ?? c.key,
            }),
          )}
        />
      )}
      // Download exports the same rows via @elabs-ai/components-data's RFC-4180 + injection-guarded serializer.
      onDownload={(rows, cols) => downloadCsv(rows, { columns: cols, filename: "monthly-revenue" })}
    >
      <BarChart data={data} xDataKey="month">
        <Grid horizontal />
        <Bar dataKey="revenue" fill="var(--chart-1)" lineCap="round" />
        <Bar dataKey="profit" fill="var(--chart-2)" lineCap="round" />
        <BarXAxis />
        <ChartTooltip />
      </BarChart>
    </ChartFrame>
  );
}
