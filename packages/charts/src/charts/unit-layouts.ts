/**
 * unit-layouts.ts — the pure geometry/arithmetic behind `UnitChart` (RM-024).
 *
 * "One mark = one honest unit" is lieflat's signature replacement for pie
 * charts: a waffle grid, a phyllotaxis field, or a row of tally ticks, where a
 * reader COUNTS rather than compares angles. Every function here is a plain
 * `(data, options) -> geometry` computation with no React and no randomness
 * beyond {@link seededRnd} — dependency-free on purpose, so the layout math is
 * unit-testable without mounting anything, and the component
 * (`unit-chart.tsx`) is a thin renderer over it.
 *
 * ## The rounding rule (lieflat rule)
 *
 * `UnitChart` never INVENTS a mark to make the count line up with `total` — if
 * `round(value / unit)` per series doesn't sum to `total`, {@link computeArithmetic}
 * says so in its `text` instead of drawing an extra, unearned mark. See
 * `docs/review/2026-09-04-lieflat-charts-gap-analysis.md` §1(1).
 */

import { seededRnd } from "../marks/seeded-rnd";

/** One row of `UnitChart`'s `data` — a labeled quantity. */
export interface UnitChartDatum {
  label: string;
  value: number;
}

/** An axis-aligned box, in the same coordinate space as the marks it bounds. */
export interface UnitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Per-mark stagger: the column/position-within-group step (ms). See the roadmap's `c*8ms`. */
export const UNIT_CHART_POSITION_STAGGER_MS = 8;
/** Per-mark stagger: the group/series step (ms). See the roadmap's `g*50ms`. */
export const UNIT_CHART_GROUP_STAGGER_MS = 50;

/**
 * The CSS `transition-delay` (ms) for the `p`-th mark of series `seriesIndex` —
 * `p` is the mark's position within its own group (a waffle column index, a
 * field cluster's phyllotaxis index, …), not a global mark index, so every
 * series' first mark starts its own stagger from zero.
 */
export function unitMarkDelayMs(positionInGroup: number, seriesIndex: number): number {
  return (
    Math.max(0, positionInGroup) * UNIT_CHART_POSITION_STAGGER_MS +
    Math.max(0, seriesIndex) * UNIT_CHART_GROUP_STAGGER_MS
  );
}

/** `round(value / unit)` per row, floored at 0 — never a negative mark count. */
export function computeUnitCounts(data: readonly UnitChartDatum[], unit: number): number[] {
  const safeUnit = unit > 0 ? unit : 1;
  return data.map((d) => Math.max(0, Math.round(d.value / safeUnit)));
}

export interface UnitArithmetic {
  /** `round(value / unit)` per row. */
  counts: number[];
  /** Sum of `counts`. */
  sum: number;
  /** `total - sum` — positive when marks were rounded away, negative when rounding added one. */
  remainder: number;
  /** The footer caption: the addition when it lands on `total`, the shortfall/excess otherwise. */
  text: string;
}

/**
 * The footer arithmetic (lieflat rule): shows the addition when it lands
 * exactly on `total` ("41 + 35 + 12 + 12 = 100"), and calls out the rounding
 * remainder instead of inventing a mark when it doesn't
 * ("98 · 2 rounded away").
 */
export function computeArithmetic(
  data: readonly UnitChartDatum[],
  unit: number,
  total: number,
): UnitArithmetic {
  const counts = computeUnitCounts(data, unit);
  const sum = counts.reduce((a, b) => a + b, 0);
  const remainder = total - sum;
  const text =
    remainder === 0
      ? `${counts.join(" + ")} = ${sum}`
      : remainder > 0
        ? `${sum} · ${remainder} rounded away`
        : `${sum} · ${Math.abs(remainder)} added by rounding`;
  return { counts, sum, remainder, text };
}

/** A single plotted unit — one dot/tick/square, owned by one series. */
export interface UnitMark {
  /** Index into the original `data` array. */
  seriesIndex: number;
  /** This mark's 0-based position within its own series' run. */
  positionInGroup: number;
  x: number;
  y: number;
  /** Half-extent of the mark (dot radius, tick half-length, square half-side). */
  size: number;
  /** `transition-delay` in ms — see {@link unitMarkDelayMs}. */
  delayMs: number;
}

function boundingRects(marks: readonly UnitMark[], seriesCount: number): UnitRect[] {
  const bounds: (UnitRect | undefined)[] = Array.from({ length: seriesCount });
  for (const mark of marks) {
    const current = bounds[mark.seriesIndex];
    const minX = mark.x - mark.size;
    const minY = mark.y - mark.size;
    const maxX = mark.x + mark.size;
    const maxY = mark.y + mark.size;
    if (!current) {
      bounds[mark.seriesIndex] = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      continue;
    }
    const nextMinX = Math.min(current.x, minX);
    const nextMinY = Math.min(current.y, minY);
    const nextMaxX = Math.max(current.x + current.width, maxX);
    const nextMaxY = Math.max(current.y + current.height, maxY);
    bounds[mark.seriesIndex] = {
      x: nextMinX,
      y: nextMinY,
      width: nextMaxX - nextMinX,
      height: nextMaxY - nextMinY,
    };
  }
  return bounds.map((rect) => rect ?? { x: 0, y: 0, width: 0, height: 0 });
}

export interface WaffleLayout {
  marks: UnitMark[];
  seriesRects: UnitRect[];
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
}

export interface WaffleLayoutOptions {
  data: readonly UnitChartDatum[];
  unit: number;
  total: number;
  columns: number;
  width: number;
  height: number;
}

/**
 * `waffle` — column-major grid, marks assigned to series IN ORDER (G4 Dot
 * Waffle). `total` sizes the grid (default 100 cells); only `sum(counts)`
 * marks are actually drawn — a rounding shortfall is a caption, never a ghost
 * mark filling the gap.
 */
export function layoutWaffle({
  data,
  unit,
  total,
  columns,
  width,
  height,
}: WaffleLayoutOptions): WaffleLayout {
  const counts = computeUnitCounts(data, unit);
  const safeColumns = Math.max(1, columns);
  const rows = Math.max(1, Math.ceil(total / safeColumns));
  const cellWidth = width / safeColumns;
  const cellHeight = height / rows;
  const size = Math.min(cellWidth, cellHeight) * 0.35;

  const drawable = Math.min(
    total,
    counts.reduce((a, b) => a + b, 0),
  );
  const marks: UnitMark[] = [];
  let globalIndex = 0;
  for (const [seriesIndex, count] of counts.entries()) {
    for (let p = 0; p < count && globalIndex < drawable; p++, globalIndex++) {
      const column = Math.floor(globalIndex / rows);
      const row = globalIndex % rows;
      marks.push({
        seriesIndex,
        positionInGroup: p,
        x: (column + 0.5) * cellWidth,
        y: (row + 0.5) * cellHeight,
        size,
        delayMs: unitMarkDelayMs(column, seriesIndex),
      });
    }
  }

  return {
    marks,
    seriesRects: boundingRects(marks, data.length),
    columns: safeColumns,
    rows,
    cellWidth,
    cellHeight,
  };
}

/** Golden angle, in radians (137.508°) — the phyllotaxis constant. */
export const GOLDEN_ANGLE_RAD = 137.508 * (Math.PI / 180);

export interface FieldCluster {
  seriesIndex: number;
  cx: number;
  cy: number;
  radius: number;
}

export interface FieldLayout {
  marks: UnitMark[];
  seriesRects: UnitRect[];
  clusters: FieldCluster[];
}

export interface FieldLayoutOptions {
  data: readonly UnitChartDatum[];
  unit: number;
  width: number;
  height: number;
}

/**
 * `field` — golden-angle phyllotaxis per series (L14 Hundred Field): each
 * series draws its own cluster, cluster AREA proportional to its mark count,
 * seeded so the same data always draws the same field.
 */
export function layoutField({ data, unit, width, height }: FieldLayoutOptions): FieldLayout {
  const counts = computeUnitCounts(data, unit);
  const cx0 = width / 2;
  const cy0 = height / 2;
  const orbit = Math.min(width, height) * 0.28;
  const maxCount = Math.max(1, ...counts);
  const maxClusterRadius = Math.min(width, height) * 0.16;

  const clusters: FieldCluster[] = counts.map((count, seriesIndex) => {
    const angle =
      counts.length <= 1 ? 0 : (2 * Math.PI * seriesIndex) / counts.length - Math.PI / 2;
    const center =
      counts.length <= 1
        ? { cx: cx0, cy: cy0 }
        : { cx: cx0 + orbit * Math.cos(angle), cy: cy0 + orbit * Math.sin(angle) };
    const radius = maxClusterRadius * Math.sqrt(Math.max(count, 1) / maxCount);
    return { seriesIndex, radius, ...center };
  });

  const dotSize = Math.min(width, height) * 0.012;
  const marks: UnitMark[] = [];
  for (const cluster of clusters) {
    const count = counts[cluster.seriesIndex] ?? 0;
    if (count <= 0) continue;
    const spread = cluster.radius / Math.sqrt(count);
    for (let k = 0; k < count; k++) {
      const angle = k * GOLDEN_ANGLE_RAD;
      const r = spread * Math.sqrt(k);
      const jitterX = (seededRnd(k, cluster.seriesIndex * 97 + 1) - 0.5) * dotSize;
      const jitterY = (seededRnd(k, cluster.seriesIndex * 97 + 2) - 0.5) * dotSize;
      marks.push({
        seriesIndex: cluster.seriesIndex,
        positionInGroup: k,
        x: cluster.cx + r * Math.cos(angle) + jitterX,
        y: cluster.cy + r * Math.sin(angle) + jitterY,
        size: dotSize,
        delayMs: unitMarkDelayMs(k, cluster.seriesIndex),
      });
    }
  }

  return { marks, seriesRects: boundingRects(marks, data.length), clusters };
}

export interface RowsLayoutRow {
  seriesIndex: number;
  count: number;
  y: number;
  height: number;
}

export interface RowsLayout {
  rows: RowsLayoutRow[];
  seriesRects: UnitRect[];
  rowHeight: number;
}

export interface RowsLayoutOptions {
  data: readonly UnitChartDatum[];
  unit: number;
  width: number;
  rowHeight: number;
}

/**
 * `rows` — one row per series, ticks tallied `markEvery` 10 (L15 Ballot
 * Tally). Ignores `total` — a multi-select survey's rows may each independently
 * sum past 100.
 */
export function layoutRows({ data, unit, width, rowHeight }: RowsLayoutOptions): RowsLayout {
  const counts = computeUnitCounts(data, unit);
  const rows: RowsLayoutRow[] = counts.map((count, seriesIndex) => ({
    seriesIndex,
    count,
    y: (seriesIndex + 0.5) * rowHeight,
    height: rowHeight,
  }));
  const seriesRects: UnitRect[] = rows.map((row) => ({
    x: 0,
    y: row.y - row.height / 2,
    width,
    height: row.height,
  }));
  return { rows, seriesRects, rowHeight };
}

/** `label: value (share%)` per row — the `role="img"` accessible summary. */
export function buildUnitChartSummary(data: readonly UnitChartDatum[], total: number): string {
  if (data.length === 0) {
    return "No data";
  }
  const sum = data.reduce((a, b) => a + b.value, 0);
  const denominator = total > 0 ? total : sum;
  const parts = data.map((d) => {
    const share = denominator > 0 ? Math.round((d.value / denominator) * 100) : 0;
    return `${d.label}: ${d.value} (${share}%)`;
  });
  return parts.join(", ");
}
