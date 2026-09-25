/**
 * infer-columns.ts — `ColumnDef`s from plain rows, for data an app (or an
 * agent) did not describe: one column per key seen in the first rows, typed
 * from the values (number, ISO date, boolean, text), labelled from the key
 * ("tradeDate" → "Trade date"), numbers end-aligned and formatted.
 */
import type { ColumnDef } from "../data-table/tanstack";
import type {
  DataTableAggregate,
  DataTableCellVisual,
  DataTableValueFormatSpec,
} from "../data-table/column-meta";
import type { FilterKind } from "../data-table/grid/filter-model";

export type InferredType = "text" | "number" | "date" | "boolean";

/** A serialisable column description (what `DataGridSpec.columns` holds). */
export interface DataGridColumnSpec {
  /** Row field; dotted paths reach nested objects. */
  key: string;
  label?: string;
  type?: InferredType;
  format?: DataTableValueFormatSpec;
  aggregate?: DataTableAggregate;
  /** Width in px. */
  width?: number;
  pinned?: "left" | "right";
  filter?: FilterKind | false;
  /** An in-cell visual (bar, heatmap, …) — the same object `meta.visual` takes. */
  visual?: DataTableCellVisual;
}

type Row = Record<string, unknown>;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

/** "tradeDate" / "trade_date" / "trade-date" → "Trade date". */
export function humanizeKey(key: string): string {
  const last = key.split(".").pop() ?? key;
  const words = last
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function inferType(values: readonly unknown[]): InferredType {
  let numbers = 0;
  let dates = 0;
  let booleans = 0;
  let other = 0;
  for (const v of values) {
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "number") numbers++;
    else if (typeof v === "boolean") booleans++;
    else if (v instanceof Date || (typeof v === "string" && ISO_DAY.test(v))) dates++;
    else other++;
  }
  const max = Math.max(numbers, dates, booleans, other);
  if (max === 0 || max === other) return "text";
  if (max === numbers) return "number";
  if (max === dates) return "date";
  return "boolean";
}

const read = (row: Row, key: string): unknown =>
  key.split(".").reduce<unknown>((v, k) => (v as Row | null | undefined)?.[k], row);

/** Column specs for rows: keys in first-seen order across the first `sample` rows. */
export function inferColumnSpecs(rows: readonly Row[], sample = 200): DataGridColumnSpec[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const head = rows.slice(0, sample);
  for (const row of head) {
    for (const key of Object.keys(row)) {
      const v = row[key];
      // One level of plain nested objects flattens to dotted keys.
      const nested =
        v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)
          ? Object.keys(v as Row).map((k) => `${key}.${k}`)
          : [key];
      for (const k of nested) {
        if (!seen.has(k)) {
          seen.add(k);
          keys.push(k);
        }
      }
    }
  }
  return keys.map((key) => {
    const values = head.map((r) => read(r, key));
    const type = inferType(values);
    const spec: DataGridColumnSpec = { key, label: humanizeKey(key), type };
    if (type === "number") {
      const integers = values.every((v) => typeof v !== "number" || Number.isInteger(v));
      spec.format = { abbreviate: false, decimals: integers ? 0 : 2 };
    }
    return spec;
  });
}

/** `ColumnDef`s from column specs (or inferred from `rows` when none are given). */
export function columnsFromSpec<TData extends Row>(
  specs: readonly DataGridColumnSpec[] | undefined,
  rows: readonly TData[],
): ColumnDef<TData, unknown>[] {
  const list = specs && specs.length > 0 ? specs : inferColumnSpecs(rows);
  return list.map((spec) => {
    const type = spec.type ?? inferType(rows.slice(0, 200).map((r) => read(r, spec.key)));
    const numeric = type === "number";
    return {
      id: spec.key,
      accessorFn: (row: TData) => read(row, spec.key),
      header: spec.label ?? humanizeKey(spec.key),
      // A pinned column needs an explicit width to stack its neighbours.
      ...(spec.width || spec.pinned ? { size: spec.width ?? 150 } : {}),
      meta: {
        label: spec.label ?? humanizeKey(spec.key),
        ...(numeric ? { numeric: true } : {}),
        ...(spec.format ? { format: spec.format } : {}),
        ...(spec.aggregate ? { aggregate: spec.aggregate } : {}),
        ...(spec.visual ? { visual: spec.visual } : {}),
        ...(spec.filter !== undefined
          ? { filter: spec.filter }
          : type === "date"
            ? { filter: "date" as const }
            : {}),
      },
      ...(type === "boolean"
        ? {
            cell: ({ getValue }: { getValue: () => unknown }) =>
              getValue() === true ? "✓" : getValue() === false ? "—" : "",
          }
        : {}),
    } as ColumnDef<TData, unknown>;
  });
}
