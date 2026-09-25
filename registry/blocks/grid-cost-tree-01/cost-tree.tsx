/**
 * Budget vs actual by cost centre — a finance business partner runs the
 * quarterly re-forecast with department heads.
 *
 * What it shows a copier: tree data plus editing. `getSubRows` nests teams
 * under departments; parents expand in place and carry the roll-up. Only the
 * leaf forecasts are editable (`meta.editable` as a per-row predicate), so a
 * department total can never be typed over — change a team's forecast and the
 * block re-rolls every ancestor (`updateCostCenter`), which moves the variance
 * bars and the totals row at once. Variance prints its sign as well as its
 * colour, so over / under budget still reads in greyscale.
 */
"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { DataGrid, type ColumnDef } from "@elabs-ai/components-data";
import { Button } from "@elabs-ai/components-ui";
import { makeCostCenters, updateCostCenter, type CostCenter } from "./data/cost-centers";

const money = { style: "currency", abbreviate: false, decimals: 0 } as const;
const isLeaf = (row: unknown) => !(row as CostCenter).children?.length;

const COLUMNS: ColumnDef<CostCenter>[] = [
  { accessorKey: "name", header: "Cost centre", size: 230 },
  { accessorKey: "owner", header: "Owner", size: 150, meta: { filter: "set" } },
  {
    accessorKey: "budget",
    header: "FY budget",
    size: 130,
    meta: { numeric: true, format: money, aggregate: "sum" },
  },
  {
    accessorKey: "actual",
    header: "Actual YTD",
    size: 130,
    meta: { numeric: true, format: money, aggregate: "sum" },
  },
  {
    id: "spent",
    header: "Spent",
    size: 90,
    accessorFn: (row) => row.actual / row.budget,
    meta: { numeric: true, format: { style: "percent", decimals: 0 } },
  },
  {
    accessorKey: "forecast",
    header: "FY forecast",
    size: 140,
    meta: {
      numeric: true,
      format: money,
      aggregate: "sum",
      editable: isLeaf,
      validate: (value, row) => {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0) return "Enter a positive amount.";
        if (n < (row as CostCenter).actual)
          return "The forecast can’t be below what is already spent.";
        return null;
      },
    },
  },
  {
    id: "variance",
    header: "Variance to budget",
    size: 190,
    accessorFn: (row) => row.budget - row.forecast,
    meta: {
      numeric: true,
      format: { ...money, sign: "always" },
      visual: { kind: "bar", style: "slim", range: "column" },
      aggregate: "sum",
    },
  },
];

export interface CostTreeProps {
  data?: CostCenter[];
  /** Called with the new tree after every edit. */
  onChange?: (tree: CostCenter[]) => void;
}

export function CostTree({ data, onChange }: CostTreeProps) {
  const initial = useMemo(() => data ?? makeCostCenters(), [data]);
  const [tree, setTree] = useState(initial);
  const [edits, setEdits] = useState(0);

  const commit = (next: CostCenter[]) => {
    setTree(next);
    onChange?.(next);
  };

  const over = tree.filter((d) => d.forecast > d.budget).map((d) => d.name);

  return (
    <section
      aria-labelledby="cost-tree-title"
      className="flex flex-col gap-3"
      data-slot="cost-tree"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-subtitle font-semibold" id="cost-tree-title">
            Q3 re-forecast by cost centre
          </h2>
          <p className="text-meta text-muted-foreground">
            Type a team’s full-year forecast; departments roll up.{" "}
            {over.length
              ? `Over budget: ${over.join(", ")}.`
              : "Every department is within budget."}
          </p>
        </div>
        <Button
          disabled={edits === 0}
          onClick={() => {
            commit(initial);
            setEdits(0);
          }}
          size="sm"
          variant="outline"
        >
          <RotateCcw aria-hidden="true" />
          Reset forecast
        </Button>
      </div>
      <DataGrid
        caption="Budget, actual and forecast by cost centre"
        columns={COLUMNS}
        data={tree}
        exportFileName="cost-centres"
        getRowId={(row) => row.id}
        getSubRows={(row) => row.children}
        initialView={{ expanded: { D1: true, D2: true } }}
        onCellEdit={(changes) => {
          let next = tree;
          for (const change of changes) {
            next = updateCostCenter(next, change.rowId, { forecast: Number(change.value) });
          }
          commit(next);
          setEdits((n) => n + changes.length);
        }}
        showTotals
      />
    </section>
  );
}
