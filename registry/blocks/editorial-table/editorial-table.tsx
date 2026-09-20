/**
 * Editorial table (copy-owned block).
 *
 * A published data table, not an app grid: the numbers carry their own visual
 * encoding, so a reader sees the shape of the column before reading a single
 * figure. Three encodings, all from `@elabs-ai/components-data`'s own cell
 * layer (`meta.visual`) — no `@elabs-ai/components-charts` install needed:
 *
 * - a **bar** column, zero-based, sharing one range down the column, so bar
 *   length means the same thing in every row;
 * - a **heatmap** column, a diverging ramp centred on zero with its own key;
 * - a **mini-columns** column for the per-quarter shape.
 *
 * `layout="auto"` flips the whole thing to a card list below 450 px, where a
 * five-column table cannot be read — the same TanStack instance, so the sort
 * bar above the cards keeps working.
 *
 * Every visual keeps its value in the accessible tree, so a screen reader and a
 * sort read the number, never the picture. For the heavier charts `Sparkline`
 * in a cell (target lines, a baseline series), copy `table-with-sparklines`
 * instead — it needs the charts package too.
 *
 * Depends on an installed @elabs-ai/components-data. Swap the row type,
 * columns and data for your own.
 */
"use client";

import { DataTable, type ColumnDef } from "@elabs-ai/components-data";

interface RegionRow {
  region: string;
  revenue: number;
  /** Year-on-year change, as a fraction (0.12 = +12 %). */
  change: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

const rows: RegionRow[] = [
  { region: "Nordics", revenue: 4_820_000, change: 0.18, q1: 1020, q2: 1180, q3: 1240, q4: 1380 },
  { region: "DACH", revenue: 7_410_000, change: 0.06, q1: 1760, q2: 1840, q3: 1880, q4: 1930 },
  { region: "Benelux", revenue: 2_260_000, change: -0.04, q1: 610, q2: 580, q3: 545, q4: 525 },
  { region: "Iberia", revenue: 1_940_000, change: 0.22, q1: 405, q2: 452, q3: 508, q4: 575 },
  { region: "France", revenue: 3_580_000, change: -0.11, q1: 1010, q2: 940, q3: 860, q4: 770 },
  { region: "Italy", revenue: 2_710_000, change: 0.02, q1: 660, q2: 672, q3: 684, q4: 694 },
];

const columns: ColumnDef<RegionRow>[] = [
  {
    accessorKey: "region",
    header: "Region",
    enableSorting: true,
    meta: { width: 22 },
  },
  {
    accessorKey: "revenue",
    header: "Revenue",
    enableSorting: true,
    meta: {
      numeric: true,
      // One range for the whole column, so a longer bar is always more money.
      visual: { kind: "bar", range: "column", track: true },
      format: { style: "currency", currency: "EUR", decimals: 1 },
      width: 28,
    },
  },
  {
    accessorKey: "change",
    header: "YoY",
    enableSorting: true,
    meta: {
      numeric: true,
      // Diverging ramp pinned at zero: the middle colour IS "no change".
      visual: {
        kind: "heatmap",
        scale: { type: "stepped", steps: 5, domain: [-0.25, 0, 0.25], palette: "diverging" },
        legend: "Year on year",
      },
      format: { style: "percent", decimals: 0, sign: "always" },
      width: 16,
    },
  },
  {
    id: "shape",
    header: "By quarter",
    // The four quarters are their own columns; this one only draws them.
    enableSorting: false,
    cell: () => null,
    meta: {
      visual: { kind: "columns", keys: ["q1", "q2", "q3", "q4"], range: "column", height: 26 },
      width: 34,
    },
  },
];

export function EditorialTable() {
  return (
    <div className="w-full max-w-4xl">
      <DataTable
        caption="Revenue by region, last four quarters"
        columns={columns}
        data={rows}
        getRowId={(row) => row.region}
        layout="auto"
      />
    </div>
  );
}
