/**
 * analytics/window.ts — rolling-window reduce for `analytics[{ kind: "window" }]`
 * (ADR 0040 §1, RM-137): moving average / median / sum / min / max and an
 * exponentially weighted mean.
 *
 * ## Semantics (the notebook plotting library's `window` transform)
 *
 * The output is ALIGNED to the input: `out[i]` is the reduction of the
 * window that belongs to row `i`, so a derived series shares its source's x
 * values one-for-one.
 *
 * - `anchor: "end"` (default) — the window ENDS at `i`: rows `[i−k+1, i]`
 *   (a trailing moving average; no look-ahead, which is what a time series
 *   usually wants).
 * - `anchor: "middle"` — the window is centred on `i`: rows
 *   `[i − ⌊(k−1)/2⌋, i + ⌈(k−1)/2⌉]` (for even `k` the extra row lies after `i`,
 *   as in Plot).
 * - `anchor: "start"` — the window STARTS at `i`: rows `[i, i+k−1]`.
 * - `strict: false` (default) — windows cut by either edge reduce the rows
 *   they have, and missing values (`null`/`undefined`/`NaN`) inside a window
 *   are skipped; a window with no finite value yields `null`.
 * - `strict: true` — a window that is cut by an edge, or contains a missing
 *   value, yields `null` (Plot's `strict`).
 *
 * `reduce: "ewm"` is the exponentially weighted mean with span `k`
 * (`α = 2 / (k + 1)`, pandas' `ewm(span=k, adjust=False)`):
 * `s₀ = x₀`, `sᵢ = α·xᵢ + (1 − α)·sᵢ₋₁`. It is causal by definition, so
 * `anchor` does not apply; a missing input yields `null` at that row and the
 * state carries over the gap; `strict` blanks the first `k − 1` rows.
 *
 * `mean`/`sum` run in O(n) with a running sum; `median`/`min`/`max` are
 * O(n·k), comfortably fast for chart-sized series.
 *
 * Framework-free: no React, no DOM, no chart context.
 */

export type WindowReduce = "mean" | "median" | "sum" | "min" | "max" | "ewm";
export type WindowAnchor = "start" | "middle" | "end";

export interface WindowReduceOptions {
  /** Window size in rows (integer ≥ 1). */
  k: number;
  reduce: WindowReduce;
  /** Default `"end"`. */
  anchor?: WindowAnchor;
  /** Default `false`. */
  strict?: boolean;
}

type Input = readonly (number | null | undefined)[];

function isFiniteValue(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Reduces `values` over a sliding window of `k` rows; returns an array of
 * the same length. `k` below 1 or non-finite → every entry `null`; a
 * non-integer `k` is rounded.
 */
export function windowReduce(values: Input, options: WindowReduceOptions): (number | null)[] {
  const n = values.length;
  const k = Math.round(options.k);
  if (!Number.isFinite(k) || k < 1) return new Array<number | null>(n).fill(null);
  const strict = options.strict ?? false;

  if (options.reduce === "ewm") return ewm(values, k, strict);

  const anchor = options.anchor ?? "end";
  // Offset of the window's first row relative to `i`.
  const before = anchor === "start" ? 0 : anchor === "end" ? k - 1 : (k - 1) >> 1;
  const out = new Array<number | null>(n).fill(null);

  if (options.reduce === "mean" || options.reduce === "sum") {
    // Prefix sums of the finite values and of how many there are.
    const prefix = new Float64Array(n + 1);
    const count = new Uint32Array(n + 1);
    for (let i = 0; i < n; i += 1) {
      const v = values[i];
      const ok = isFiniteValue(v);
      prefix[i + 1] = (prefix[i] as number) + (ok ? v : 0);
      count[i + 1] = (count[i] as number) + (ok ? 1 : 0);
    }
    for (let i = 0; i < n; i += 1) {
      const start = i - before;
      const end = start + k; // exclusive
      const lo = Math.max(0, start);
      const hi = Math.min(n, end);
      const c = (count[hi] as number) - (count[lo] as number);
      if (strict && (start < 0 || end > n || c < k)) continue;
      if (c === 0) continue;
      const s = (prefix[hi] as number) - (prefix[lo] as number);
      out[i] = options.reduce === "sum" ? s : s / c;
    }
    return out;
  }

  const buffer: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const start = i - before;
    const end = start + k;
    if (strict && (start < 0 || end > n)) continue;
    buffer.length = 0;
    let missing = false;
    for (let j = Math.max(0, start); j < Math.min(n, end); j += 1) {
      const v = values[j];
      if (isFiniteValue(v)) buffer.push(v);
      else missing = true;
    }
    if ((strict && missing) || buffer.length === 0) continue;
    out[i] = reduceBuffer(buffer, options.reduce);
  }
  return out;
}

function reduceBuffer(buffer: number[], reduce: "median" | "min" | "max"): number {
  if (reduce === "min") return Math.min(...buffer);
  if (reduce === "max") return Math.max(...buffer);
  buffer.sort((a, b) => a - b);
  const m = buffer.length >> 1;
  return buffer.length % 2 === 1
    ? (buffer[m] as number)
    : ((buffer[m - 1] as number) + (buffer[m] as number)) / 2;
}

/** Exponentially weighted mean with span `k` — see the module docblock. */
function ewm(values: Input, k: number, strict: boolean): (number | null)[] {
  const alpha = 2 / (k + 1);
  const out = new Array<number | null>(values.length).fill(null);
  let state: number | null = null;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (!isFiniteValue(v)) continue;
    state = state === null ? v : alpha * v + (1 - alpha) * state;
    if (strict && i < k - 1) continue;
    out[i] = state;
  }
  return out;
}
