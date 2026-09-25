/**
 * Sales ledger — a BI analyst slices order lines without leaving the grid.
 *
 * What it shows a copier: the analytics half of `DataGrid`. The ledger opens
 * grouped by region with sums and a mean on every group row and a totals row
 * over whatever passes the filters (drag another column into the grouping bar,
 * or use a column menu, to regroup). "Pivot" swaps in `pivotData` — region ×
 * quarter revenue, same grid, same export. Select any block of cells and pick
 * "Chart selection" from the right-click menu: the grid hands the raw values to
 * `onChartRange` and this block draws them with charts' `AutoChart` — the grid
 * itself never draws a chart (D5, one-way dependencies).
 */
"use client";

import { useMemo, useState } from "react";
import { BarChart3, X } from "lucide-react";
import { AutoChart, ChartCard, type ChartSpec } from "@elabs-ai/components-charts";
import {
  DataGrid,
  pivotData,
  type ColumnDef,
  type DataTableChartRange,
} from "@elabs-ai/components-data";
import { Button, StatePanel, ToggleGroup, ToggleGroupItem } from "@elabs-ai/components-ui";
import { makeSales, type SaleLine } from "./data/sales";

const money = { style: "currency", abbreviate: false, decimals: 0 } as const;

const COLUMNS: ColumnDef<SaleLine>[] = [
  { accessorKey: "id", header: "Order", size: 110 },
  { accessorKey: "date", header: "Date", size: 120 },
  { accessorKey: "quarter", header: "Quarter", size: 100, meta: { filter: "set" } },
  { accessorKey: "region", header: "Region", size: 110, meta: { filter: "set" } },
  { accessorKey: "country", header: "Country", size: 150, meta: { filter: "set" } },
  { accessorKey: "rep", header: "Rep", size: 150, meta: { filter: "set" } },
  { accessorKey: "segment", header: "Segment", size: 130, meta: { filter: "set" } },
  { accessorKey: "product", header: "Product", size: 160, meta: { filter: "set" } },
  {
    accessorKey: "units",
    header: "Units",
    size: 90,
    meta: { numeric: true, format: { abbreviate: false, decimals: 0 }, aggregate: "sum" },
  },
  {
    accessorKey: "revenue",
    header: "Revenue",
    size: 130,
    meta: { numeric: true, format: money, aggregate: "sum" },
  },
  {
    accessorKey: "margin",
    header: "Gross margin",
    size: 140,
    meta: { numeric: true, format: money, aggregate: "sum" },
  },
  {
    id: "marginPct",
    header: "Margin %",
    size: 110,
    accessorFn: (row) => row.margin / row.revenue,
    meta: { numeric: true, format: { style: "percent", decimals: 1 }, aggregate: "mean" },
  },
];

/**
 * A label for a range row that has no text cell selected: a group row's id is
 * `field:value` (nested groups join with `>`), so its innermost value names it;
 * a pivot row's id is its keys joined with U+001F, so its innermost key names
 * it; any other row is named by its id (the order number here).
 */
function rowLabel(id: string, index: number): string {
  const group = id
    .split(">")
    .pop()
    ?.match(/^[^:]+:(.+)$/);
  if (group) return group[1]!;
  return id.split("\u001f").pop() || `Row ${index + 1}`;
}

/** Turns the grid's raw range into an AutoChart spec: the first text column is x, numbers are series. */
export function chartSpecFromRange(range: DataTableChartRange): ChartSpec | null {
  const xIndex = range.columns.findIndex((column) => !column.numeric);
  const series = range.columns.filter((column) => column.numeric);
  if (series.length === 0) return null;
  const data = range.rows.map((row, r) => {
    const point: Record<string, unknown> = {
      label: xIndex >= 0 ? String(row.values[xIndex] ?? "") : rowLabel(row.id, r),
    };
    range.columns.forEach((column, c) => {
      if (column.numeric) point[column.label] = Number(row.values[c] ?? 0);
    });
    return point;
  });
  return {
    type: "bar",
    data,
    x: "label",
    series: series.map((column) => column.label),
    title: `${series.map((c) => c.label).join(", ")} by ${xIndex >= 0 ? range.columns[xIndex]!.label.toLowerCase() : "row"}`,
  };
}

export interface SalesLedgerProps {
  lines?: SaleLine[];
  /** Initial grouping, outermost first. Default: region. */
  defaultGrouping?: string[];
}

export function SalesLedger({ lines, defaultGrouping = ["region"] }: SalesLedgerProps) {
  const data = useMemo(() => lines ?? makeSales(), [lines]);
  const [mode, setMode] = useState<"ledger" | "pivot">("ledger");
  const [chart, setChart] = useState<ChartSpec | null>(null);

  const pivot = useMemo(() => {
    const result = pivotData(data, {
      rows: ["region", "country"],
      columns: "quarter",
      values: [{ field: "revenue", aggregate: "sum", label: "Revenue" }],
    });
    // pivotData heads the row-key columns with their field names; give them words.
    const labels: Record<string, string> = { region: "Region", country: "Country" };
    return {
      ...result,
      columns: result.columns.map((column): typeof column => {
        const label = column.id ? labels[column.id] : undefined;
        return label ? { ...column, header: label, meta: { ...column.meta, label } } : column;
      }),
    };
  }, [data]);

  return (
    <section
      aria-labelledby="sales-ledger-title"
      className="flex flex-col gap-3"
      data-slot="sales-ledger"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-subtitle font-semibold" id="sales-ledger-title">
            Sales ledger, January–September
          </h2>
          <p className="text-meta text-muted-foreground">
            Group, filter and total in place. Select cells and right-click → Chart selection to plot
            them.
          </p>
        </div>
        <ToggleGroup
          aria-label="View"
          onValueChange={(value) => value && setMode(value as "ledger" | "pivot")}
          size="sm"
          type="single"
          value={mode}
          variant="segmented"
        >
          <ToggleGroupItem value="ledger">Ledger</ToggleGroupItem>
          <ToggleGroupItem value="pivot">Pivot: region × quarter</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {mode === "ledger" ? (
        <DataGrid
          key="ledger"
          caption="Sales order lines"
          columns={COLUMNS}
          data={data}
          enableGrouping
          enableRowVirtualization
          exportFileName="sales-ledger"
          getRowId={(row) => row.id}
          initialView={{
            grouping: defaultGrouping,
            sorting: [{ id: "revenue", desc: true }],
          }}
          maxBodyHeight="30rem"
          onChartRange={(range) => setChart(chartSpecFromRange(range))}
          showTotals
        />
      ) : (
        <DataGrid
          key="pivot"
          caption="Revenue by region, country and quarter"
          columns={pivot.columns}
          data={pivot.rows}
          enableGrouping
          exportFileName="sales-pivot"
          getRowId={(row) => row.__pivotId}
          initialView={{ grouping: ["region"], expanded: true }}
          onChartRange={(range) => setChart(chartSpecFromRange(range))}
          showTotals
        />
      )}

      {chart ? (
        <ChartCard
          actions={
            <Button
              aria-label="Close chart"
              onClick={() => setChart(null)}
              size="icon-sm"
              variant="ghost"
            >
              <X aria-hidden="true" />
            </Button>
          }
          description="Drawn from the cells you selected."
          title={chart.title ?? "Selection"}
          titleAs="h3"
        >
          <AutoChart plotHeight={240} spec={{ ...chart, title: undefined }} />
        </ChartCard>
      ) : (
        <StatePanel
          description="Select a label column and one or more number columns, right-click, then choose Chart selection."
          icon={<BarChart3 aria-hidden="true" />}
          kind="empty"
          title="Chart any selection"
        />
      )}
    </section>
  );
}
