/**
 * dumbbell-layout.ts — pure layout helpers for `DumbbellChart`'s extended sort
 * keys, `groupBy` row grouping and arrow-head geometry (RM-116, Datawrapper
 * parity: dot / range / arrow plots).
 *
 * Deliberately dependency-free (no React, no `@visx/scale`) so every function
 * here is testable as plain arithmetic — `dumbbell-layout.test.ts` — while
 * `dumbbell-chart.tsx` keeps owning measurement, scales and SVG.
 *
 * `bar-groups.tsx` (RM-113) draws the same "group header + separator" shape
 * for `BarChart`; this is a local copy until RM-127 dedupes the two (see the
 * RM-116 orchestrator note).
 */

import type { DumbbellRow } from "./dumbbell-chart";

// ─── Sort keys ──────────────────────────────────────────────────────────────

/**
 * `"delta"` sorts **descending by `|delta|`** (magnitude, sign ignored);
 * `"deltaPercent"` sorts **descending by `|delta / start|`**, the same
 * magnitude-first read for a relative change. `"start"`/`"end"`/`"label"`
 * sort **ascending**. `"data"` and `"none"` both mean spreadsheet order —
 * `"data"` is this RM's explicit spelling of the same thing `"none"` already
 * meant, so a spec that always names its sort never special-cases the
 * unsorted default. `reverse` flips whichever order results.
 */
export type DumbbellSortBy = "start" | "end" | "delta" | "deltaPercent" | "data" | "label" | "none";

/** `row.delta` as a fraction of `row.start`; `start === 0` reads as an infinite
 *  (unsigned-comparable) move rather than `NaN`, so a "from zero" row still
 *  sorts to an extreme rather than dropping out of a magnitude comparison. */
export function dumbbellDeltaPercent(row: DumbbellRow): number {
  if (row.start === 0) {
    if (row.delta === 0) return 0;
    return row.delta > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  }
  return row.delta / row.start;
}

/**
 * Sorts a copy of `rows` by `sortBy`, then reverses when `reverse` is set.
 * `"none"`/`"data"` return `rows` itself (not a copy) when `reverse` is
 * false — the identity the `DumbbellChart` sort-by-`"none"` contract already
 * relies on (`sortDumbbellRows(rows, "none") === rows`).
 */
export function sortDumbbellRowsBy(
  rows: DumbbellRow[],
  sortBy: DumbbellSortBy,
  reverse = false,
): DumbbellRow[] {
  if (sortBy === "none" || sortBy === "data") {
    return reverse ? [...rows].reverse() : rows;
  }
  const sorted = [...rows].sort((a, b) => {
    switch (sortBy) {
      case "start":
        return a.start - b.start;
      case "end":
        return a.end - b.end;
      case "delta":
        return Math.abs(b.delta) - Math.abs(a.delta);
      case "deltaPercent":
        return Math.abs(dumbbellDeltaPercent(b)) - Math.abs(dumbbellDeltaPercent(a));
      case "label":
        return a.category.localeCompare(b.category);
      default:
        return 0;
    }
  });
  return reverse ? sorted.reverse() : sorted;
}

// ─── groupBy bands ──────────────────────────────────────────────────────────

export interface DumbbellGroupHeaderBand {
  kind: "header";
  /** Group column value, rendered as the header label. */
  label: string;
}

export interface DumbbellRowBand {
  kind: "row";
  row: DumbbellRow;
}

export type DumbbellBand = DumbbellGroupHeaderBand | DumbbellRowBand;

/**
 * Buckets `rows` (already sorted) into contiguous groups keyed by
 * `String(datum[groupBy])`, preserving each group's first-seen order and
 * every row's relative order within its group, then flattens to one header
 * band per group followed by its row bands. `DumbbellChart` walks this list
 * — instead of `rows` directly — to lay out group headers and separators as
 * extra bands alongside ordinary rows.
 *
 * `groupBy` unset (or empty) returns one row band per row and no headers —
 * byte-identical to the ungrouped layout.
 */
export function buildDumbbellBands(rows: DumbbellRow[], groupBy?: string): DumbbellBand[] {
  if (!groupBy) {
    return rows.map((row) => ({ kind: "row", row }));
  }
  const order: string[] = [];
  const buckets = new Map<string, DumbbellRow[]>();
  for (const row of rows) {
    const key = String(row.datum[groupBy] ?? "");
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
      order.push(key);
    }
    bucket.push(row);
  }
  const bands: DumbbellBand[] = [];
  for (const key of order) {
    bands.push({ kind: "header", label: key });
    for (const row of buckets.get(key) ?? []) {
      bands.push({ kind: "row", row });
    }
  }
  return bands;
}

// ─── Arrow-head geometry ────────────────────────────────────────────────────

export interface ArrowHeadPoints {
  tip: [number, number];
  left: [number, number];
  right: [number, number];
}

/**
 * The filled triangle for an arrow-plot row's head at `(x2, y2)`, pointing
 * along the line from `(x1, y1)`: `length` px from base to tip, `width` px
 * across the base. Pure trig, no DOM/measurement dependency.
 *
 * A zero-length line (`start === end`) has no direction to draw from — falls
 * back to pointing along `+x` rather than producing a degenerate (NaN) head.
 */
export function arrowHeadPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  length: number,
  width: number,
): ArrowHeadPoints {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const ux = dist > 0 ? dx / dist : 1;
  const uy = dist > 0 ? dy / dist : 0;
  const baseX = x2 - ux * length;
  const baseY = y2 - uy * length;
  // Perpendicular unit vector, for the base's two corners.
  const nx = -uy;
  const ny = ux;
  const half = width / 2;
  return {
    tip: [x2, y2],
    left: [baseX + nx * half, baseY + ny * half],
    right: [baseX - nx * half, baseY - ny * half],
  };
}

/** `arrowHeadPoints` as an SVG `<path>` `d` attribute (a closed triangle). */
export function arrowHeadPath(points: ArrowHeadPoints): string {
  return (
    `M ${points.tip[0]},${points.tip[1]} ` +
    `L ${points.left[0]},${points.left[1]} ` +
    `L ${points.right[0]},${points.right[1]} Z`
  );
}
