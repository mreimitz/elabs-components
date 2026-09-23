/**
 * condense-overview.ts — the navigator's shadow data (RM-140).
 *
 * LTTB (`decimateTimeSeries`) keeps the SHAPE of a line but does not promise
 * its extremes; the overview strip must (the associative BI suite: "the very low and the very high
 * values are still visible"). So the rows are cut into `bucketCount` equal row
 * buckets and each reports the `min` and `max` of every pooled series value in
 * it — a one-row spike always survives in its bucket's `max`.
 */

export interface OverviewBucket {
  /** Position on the navigator's value axis: the mean of the bucket's first and last row x. */
  x: number;
  /** First row x in the bucket. */
  x0: number;
  /** Last row x in the bucket. */
  x1: number;
  /** Smallest pooled value in the bucket (`NaN` when the bucket has none). */
  min: number;
  /** Largest pooled value in the bucket (`NaN` when the bucket has none). */
  max: number;
}

export interface CondenseOverviewOptions {
  /**
   * A row's x on the navigator's value axis (ms for time, row index for
   * index). Default: the row index.
   */
  xAccessor?: (row: Record<string, unknown>, index: number) => number;
  /**
   * Pool the STACK TOTAL per row (the sum of `keys`) instead of each value — a
   * stacked host's silhouette is its totals.
   */
  stacked?: boolean;
}

function rowExtent(
  row: Record<string, unknown>,
  keys: readonly string[],
  stacked: boolean,
): [number, number] | null {
  if (stacked) {
    let sum = 0;
    let any = false;
    for (const key of keys) {
      const v = row[key];
      if (typeof v === "number" && Number.isFinite(v)) {
        sum += v;
        any = true;
      }
    }
    return any ? [sum, sum] : null;
  }
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return min === Number.POSITIVE_INFINITY ? null : [min, max];
}

/**
 * Condense `rows` to at most `bucketCount` min/max buckets. With
 * `rows.length <= bucketCount` every row is its own bucket (the full series).
 */
export function condenseOverview(
  rows: readonly Record<string, unknown>[],
  keys: readonly string[],
  bucketCount: number,
  options: CondenseOverviewOptions = {},
): OverviewBucket[] {
  const { xAccessor = (_row, index) => index, stacked = false } = options;
  const n = rows.length;
  if (n === 0) return [];
  const buckets = Math.max(1, Math.floor(bucketCount));
  const out: OverviewBucket[] = [];

  if (n <= buckets) {
    for (let i = 0; i < n; i++) {
      const row = rows[i] as Record<string, unknown>;
      const x = xAccessor(row, i);
      const e = rowExtent(row, keys, stacked);
      out.push({ x, x0: x, x1: x, min: e ? e[0] : Number.NaN, max: e ? e[1] : Number.NaN });
    }
    return out;
  }

  for (let b = 0; b < buckets; b++) {
    const from = Math.floor((b * n) / buckets);
    const to = Math.floor(((b + 1) * n) / buckets);
    if (to <= from) continue;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = from; i < to; i++) {
      const e = rowExtent(rows[i] as Record<string, unknown>, keys, stacked);
      if (!e) continue;
      if (e[0] < min) min = e[0];
      if (e[1] > max) max = e[1];
    }
    const x0 = xAccessor(rows[from] as Record<string, unknown>, from);
    const x1 = xAccessor(rows[to - 1] as Record<string, unknown>, to - 1);
    const has = min !== Number.POSITIVE_INFINITY;
    out.push({
      x: (x0 + x1) / 2,
      x0,
      x1,
      min: has ? min : Number.NaN,
      max: has ? max : Number.NaN,
    });
  }
  return out;
}
