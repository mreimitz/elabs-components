/**
 * pivot.ts — spreadsheet-style pivoting for DataTable / DataGrid: rows keyed
 * by one or more fields, one column per distinct value of a pivot field, and
 * each cell an aggregate of a value field. Pure: it returns plain rows and the
 * `ColumnDef`s (grouped headers when there are several value fields) to hand
 * to `DataTable` / `DataGrid`, so sorting, filtering, totals, copy and export
 * all work on the pivoted view unchanged.
 */
import type { ColumnDef } from "./tanstack";

export type PivotAggregate = "sum" | "count" | "mean" | "min" | "max";

export interface PivotValue {
  /** Field of the source rows to aggregate. */
  field: string;
  aggregate: PivotAggregate;
  /** Header text (default: the field name, or "Count"). */
  label?: string;
}

export interface PivotConfig {
  /** Fields whose combination makes a pivot row (outermost first). */
  rows: readonly string[];
  /** Field whose distinct values become columns; omit for a plain summary. */
  columns?: string;
  values: readonly PivotValue[];
  /** Add a row-total column per value (default `true` when `columns` is set). */
  rowTotals?: boolean;
  /** Orders the pivot column values (default: natural, numeric-aware). */
  compareColumns?: (a: string, b: string) => number;
  /** Label of the row-total columns. Default `"Total"`. */
  totalLabel?: string;
}

/** A pivoted row: the row-key fields plus one numeric cell per pivot column. */
export type PivotRow = Record<string, unknown> & { __pivotId: string };

export interface PivotResult {
  rows: PivotRow[];
  columns: ColumnDef<PivotRow, unknown>[];
  /** The distinct pivot column values, in column order. */
  columnValues: string[];
}

interface Acc {
  sum: number;
  count: number;
  min: number;
  max: number;
  numeric: number;
}

function accumulate(acc: Acc | undefined, value: unknown): Acc {
  const a = acc ?? { sum: 0, count: 0, min: Infinity, max: -Infinity, numeric: 0 };
  a.count++;
  if (typeof value === "number" && Number.isFinite(value)) {
    a.numeric++;
    a.sum += value;
    if (value < a.min) a.min = value;
    if (value > a.max) a.max = value;
  }
  return a;
}

function resolve(acc: Acc | undefined, aggregate: PivotAggregate): number | null {
  if (!acc) return aggregate === "count" ? 0 : null;
  switch (aggregate) {
    case "count":
      return acc.count;
    case "sum":
      return acc.numeric ? acc.sum : null;
    case "mean":
      return acc.numeric ? acc.sum / acc.numeric : null;
    case "min":
      return acc.numeric ? acc.min : null;
    case "max":
      return acc.numeric ? acc.max : null;
  }
}

/** How a pivot cell's column should total in DataTable's totals row. */
function totalOf(aggregate: PivotAggregate): "sum" | "min" | "max" | undefined {
  return aggregate === "sum" || aggregate === "count"
    ? "sum"
    : aggregate === "min" || aggregate === "max"
      ? aggregate
      : undefined;
}

const read = (row: unknown, field: string): unknown =>
  field.split(".").reduce<unknown>((v, k) => (v as Record<string, unknown> | null)?.[k], row);

const keyText = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function pivotData(data: readonly unknown[], config: PivotConfig): PivotResult {
  const { rows: rowFields, columns: pivotField, values } = config;
  const withTotals = config.rowTotals ?? pivotField !== undefined;
  const collator = new Intl.Collator(undefined, { numeric: true });
  const byRow = new Map<string, { keys: unknown[]; cells: Map<string, Acc[]> }>();
  const columnSet = new Set<string>();
  const TOTAL = "\u0000total";

  for (const source of data) {
    const keys = rowFields.map((f) => read(source, f));
    const id = keys.map(keyText).join("\u001f");
    let entry = byRow.get(id);
    if (!entry) {
      entry = { keys, cells: new Map() };
      byRow.set(id, entry);
    }
    const buckets = pivotField === undefined ? [TOTAL] : [keyText(read(source, pivotField)), TOTAL];
    if (pivotField !== undefined) columnSet.add(buckets[0]!);
    for (const bucket of buckets) {
      let accs = entry.cells.get(bucket);
      if (!accs) {
        accs = [];
        entry.cells.set(bucket, accs);
      }
      values.forEach((v, i) => {
        accs![i] = accumulate(accs![i], read(source, v.field));
      });
    }
  }

  const columnValues = [...columnSet].sort(config.compareColumns ?? collator.compare);
  const cellId = (bucket: string, valueIndex: number) =>
    values.length === 1 ? `p:${bucket}` : `p:${bucket}:${valueIndex}`;

  const rows: PivotRow[] = [...byRow.entries()].map(([id, entry]) => {
    const row: PivotRow = { __pivotId: id };
    rowFields.forEach((f, i) => {
      row[f] = entry.keys[i];
    });
    const buckets =
      pivotField === undefined ? [TOTAL] : [...columnValues, ...(withTotals ? [TOTAL] : [])];
    for (const bucket of buckets) {
      values.forEach((v, i) => {
        row[cellId(bucket, i)] = resolve(entry.cells.get(bucket)?.[i], v.aggregate);
      });
    }
    return row;
  });

  const valueLabel = (v: PivotValue) => v.label ?? (v.aggregate === "count" ? "Count" : v.field);
  const valueColumn = (
    bucket: string,
    i: number,
    header: string,
  ): ColumnDef<PivotRow, unknown> => ({
    id: cellId(bucket, i),
    accessorFn: (row) => row[cellId(bucket, i)],
    header,
    size: 110,
    meta: {
      label: header,
      numeric: true,
      format:
        values[i]!.aggregate === "mean" ? { decimals: 2 } : { abbreviate: false, decimals: 2 },
      aggregate: totalOf(values[i]!.aggregate),
      filter: "number",
    },
  });

  const keyColumns: ColumnDef<PivotRow, unknown>[] = rowFields.map((f) => ({
    id: f,
    accessorFn: (row) => row[f],
    header: f,
    size: 140,
    meta: { label: f },
  }));

  const bucketColumns = (bucket: string, label: string): ColumnDef<PivotRow, unknown>[] =>
    values.length === 1
      ? [valueColumn(bucket, 0, label)]
      : [
          {
            id: `g:${bucket}`,
            header: label,
            columns: values.map((v, i) => valueColumn(bucket, i, valueLabel(v))),
          },
        ];

  const totalLabel = config.totalLabel ?? "Total";
  const columns: ColumnDef<PivotRow, unknown>[] =
    pivotField === undefined
      ? [...keyColumns, ...values.map((v, i) => valueColumn(TOTAL, i, valueLabel(v)))]
      : [
          ...keyColumns,
          ...columnValues.flatMap((value) =>
            bucketColumns(value, value === "" ? "(Blanks)" : value),
          ),
          ...(withTotals ? bucketColumns(TOTAL, totalLabel) : []),
        ];

  return { rows, columns, columnValues };
}
