/**
 * density-scatter/columns.ts — rows or columns in, typed arrays out.
 *
 * Framework-free. The converter runs ONCE per data identity (the container
 * memoises on it); every per-frame loop then reads `Float32Array`s only.
 */

import {
  DENSITY_ROWS_WARN_AT,
  type DensityPoints,
  type DensityScatterColumns,
  type DensityScatterData,
  type NumericColumn,
} from "./types";

export function isDensityColumns(data: DensityScatterData): data is DensityScatterColumns {
  return !Array.isArray(data) && typeof data === "object" && data !== null && "x" in data;
}

function toFloat32(column: NumericColumn): Float32Array {
  if (column instanceof Float32Array) return column;
  const out = new Float32Array(column.length);
  for (let i = 0; i < column.length; i++) {
    const v = column[i];
    out[i] = typeof v === "number" ? v : Number.NaN;
  }
  return out;
}

function encodeCategory(column: ArrayLike<string>): { codes: Uint16Array; labels: string[] } {
  const labels: string[] = [];
  const index = new Map<string, number>();
  const codes = new Uint16Array(column.length);
  for (let i = 0; i < column.length; i++) {
    const label = String(column[i]);
    let code = index.get(label);
    if (code === undefined) {
      code = labels.length;
      labels.push(label);
      index.set(label, code);
    }
    codes[i] = code;
  }
  return { codes, labels };
}

export interface ToDensityColumnsOptions {
  /** Row key for x. Default `"x"`. */
  xKey?: string;
  /** Row key for y. Default `"y"`. */
  yKey?: string;
  /** Row keys to lift as numeric columns (a `colorBy: { kind: "value" }` source). */
  valueKeys?: readonly string[];
  /** Row keys to lift as categorical columns (a `colorBy: { kind: "category" }` source). */
  categoryKeys?: readonly string[];
  /** Called once when a row input is past the warn threshold (dev only). */
  warn?: (message: string) => void;
}

/**
 * Converts either input shape to `DensityPoints`. Non-numeric x/y become `NaN`
 * and are skipped by every loop downstream (never drawn, never counted).
 */
export function toDensityColumns(
  data: DensityScatterData,
  options: ToDensityColumnsOptions = {},
): DensityPoints {
  if (isDensityColumns(data)) {
    const x = toFloat32(data.x);
    const y = toFloat32(data.y);
    const n = Math.min(x.length, y.length);
    const values: Record<string, Float32Array> = {};
    for (const [key, column] of Object.entries(data.values ?? {})) values[key] = toFloat32(column);
    const categories: DensityPoints["categories"] = {};
    for (const [key, column] of Object.entries(data.categories ?? {}))
      categories[key] = encodeCategory(column);
    return { x, y, n, values, categories };
  }

  const { xKey = "x", yKey = "y", valueKeys = [], categoryKeys = [], warn } = options;
  const n = data.length;
  if (n > DENSITY_ROWS_WARN_AT && warn) {
    warn(
      `DensityScatterChart: ${n} rows were handed as objects; pass columnar data ({ x, y, values }) to avoid the per-row object cost at this size.`,
    );
  }
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const values: Record<string, Float32Array> = {};
  for (const key of valueKeys) values[key] = new Float32Array(n);
  const rawCategories: Record<string, string[]> = {};
  for (const key of categoryKeys) rawCategories[key] = new Array<string>(n);
  for (let i = 0; i < n; i++) {
    const row = data[i]!;
    const rx = row[xKey];
    const ry = row[yKey];
    x[i] = typeof rx === "number" ? rx : rx instanceof Date ? rx.getTime() : Number.NaN;
    y[i] = typeof ry === "number" ? ry : Number.NaN;
    for (const key of valueKeys) {
      const v = row[key];
      values[key]![i] = typeof v === "number" ? v : Number.NaN;
    }
    for (const key of categoryKeys) rawCategories[key]![i] = String(row[key] ?? "");
  }
  const categories: DensityPoints["categories"] = {};
  for (const key of categoryKeys) categories[key] = encodeCategory(rawCategories[key]!);
  return { x, y, n, values, categories };
}

/** The finite extent of a column, or `null` when nothing is finite. */
export function columnExtent(column: Float32Array): [number, number] | null {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < column.length; i++) {
    const v = column[i]!;
    if (Number.isNaN(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return lo <= hi ? [lo, hi] : null;
}
