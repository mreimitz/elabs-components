/**
 * density-scatter/bin.ts — screen-space binning, the level-of-detail engine.
 *
 * Framework-free and allocation-free after warm-up. Bins are a fixed size in
 * CSS PIXELS: zooming in makes each cell cover less data, so counts drop and
 * the picture resolves into individual dots on its own — there is no mode
 * switch. Per frame:
 *
 *   1. `binPoints` — one O(n) pass over the typed arrays: per cell `count`,
 *      per-class counts, a running sum of one value column, and the first
 *      point index (the sparse-cell tooltip target). Off-window and hidden
 *      points are skipped early.
 *   2. `smoothField` — one separable [1 2 1] pass so the COLOUR field feathers
 *      at cluster edges. The decision "which cell is a cluster" (`count`) is
 *      never smoothed; only the paint reads the smoothed field.
 *   3. `densityLevels` — a second O(n) pass writing ONE byte per point: its
 *      local density on a log ramp. That byte is what the GPU (or the 2D
 *      fallback) turns into colour.
 *
 * The budget at 500k points is one frame on a laptop; the module's test
 * asserts an upper bound rather than eyeballing it.
 */

import type { DensityPlotBox, DensityView } from "./types";

export interface BinGrid {
  cell: number;
  cols: number;
  rows: number;
  counts: Uint32Array;
  /** `cols * rows * classCount`, class-major inside a cell. */
  classCounts: Uint32Array;
  /** Running sum of the value column (for a cell mean). */
  sums: Float32Array;
  /** First point index per cell, `-1` when empty. */
  firstIndex: Int32Array;
  /** The smoothed colour field. */
  smooth: Float32Array;
  scratch: Float32Array;
  classCount: number;
  /** Max raw count of the last pass. */
  max: number;
  /** Max smoothed value of the last pass. */
  smoothMax: number;
  /** Points inside the window (and not hidden) in the last pass. */
  visible: number;
  /** Visible points that were also selected in the last pass. */
  selected: number;
}

export function createBinGrid(
  box: DensityPlotBox,
  cell: number,
  classCount: number,
  previous?: BinGrid,
): BinGrid {
  const cols = Math.max(1, Math.ceil(box.width / cell));
  const rows = Math.max(1, Math.ceil(box.height / cell));
  const cells = cols * rows;
  if (
    previous &&
    previous.cols === cols &&
    previous.rows === rows &&
    previous.cell === cell &&
    previous.classCount === classCount
  ) {
    previous.counts.fill(0);
    previous.classCounts.fill(0);
    previous.sums.fill(0);
    previous.firstIndex.fill(-1);
    return previous;
  }
  return {
    cell,
    cols,
    rows,
    counts: new Uint32Array(cells),
    classCounts: new Uint32Array(cells * classCount),
    sums: new Float32Array(cells),
    firstIndex: new Int32Array(cells).fill(-1),
    smooth: new Float32Array(cells),
    scratch: new Float32Array(cells),
    classCount,
    max: 0,
    smoothMax: 0,
    visible: 0,
    selected: 0,
  };
}

export interface BinInput {
  x: Float32Array;
  y: Float32Array;
  n: number;
  cls: Uint8Array;
  /** `hidden[k]` — the class is toggled off in the legend. */
  hidden: ArrayLike<boolean>;
  /** Selected flag per point (255 / 0); `null` when nothing is selected. */
  selected: Uint8Array | null;
  /** The value column whose cell mean the tooltip / value colouring shows. */
  value?: Float32Array;
  view: DensityView;
  box: DensityPlotBox;
}

/** Pass 1 — fills `grid` in place. */
export function binPoints(grid: BinGrid, input: BinInput): void {
  const { x, y, n, cls, hidden, selected, value, view, box } = input;
  const { cell, cols, rows, counts, classCounts, sums, firstIndex, classCount } = grid;
  const sx = box.width / (view.x1 - view.x0);
  const sy = box.height / (view.y1 - view.y0);
  const invCell = 1 / cell;
  const { x0, x1, y0, y1 } = view;
  let max = 0;
  let visible = 0;
  let sel = 0;
  for (let i = 0; i < n; i++) {
    const px = x[i]!;
    const py = y[i]!;
    // NaN fails every comparison → skipped like an off-window point.
    if (!(px >= x0 && px <= x1 && py >= y0 && py <= y1)) continue;
    const k = cls[i]!;
    if (hidden[k]) continue;
    let ci = ((px - x0) * sx * invCell) | 0;
    let ri = ((y1 - py) * sy * invCell) | 0;
    if (ci >= cols) ci = cols - 1;
    if (ri >= rows) ri = rows - 1;
    const idx = ri * cols + ci;
    const c = ++counts[idx]!;
    if (c > max) max = c;
    classCounts[idx * classCount + k]!++;
    if (value) sums[idx] = sums[idx]! + value[i]!;
    if (firstIndex[idx] === -1) firstIndex[idx] = i;
    visible++;
    if (!selected || selected[i]) sel++;
  }
  grid.max = max;
  grid.visible = visible;
  grid.selected = selected ? sel : visible;
}

/** Pass 2 — the smoothed colour field. */
export function smoothField(grid: BinGrid): void {
  const { cols, rows, counts, smooth, scratch } = grid;
  for (let r = 0; r < rows; r++) {
    const b = r * cols;
    for (let c = 0; c < cols; c++) {
      const l = c > 0 ? counts[b + c - 1]! : counts[b + c]!;
      const m = counts[b + c]!;
      const rr = c < cols - 1 ? counts[b + c + 1]! : m;
      scratch[b + c] = (l + 2 * m + rr) * 0.25;
    }
  }
  let smoothMax = 0;
  for (let r = 0; r < rows; r++) {
    const b = r * cols;
    const up = r > 0 ? b - cols : b;
    const dn = r < rows - 1 ? b + cols : b;
    for (let c = 0; c < cols; c++) {
      const v = (scratch[up + c]! + 2 * scratch[b + c]! + scratch[dn + c]!) * 0.25;
      smooth[b + c] = v;
      if (v > smoothMax) smoothMax = v;
    }
  }
  grid.smoothMax = smoothMax;
}

/**
 * Pass 3 — one byte per point: `log1p(local density) / log1p(max)`, 0–255.
 * Points outside the window keep whatever byte they had (they are not drawn).
 */
export function densityLevels(grid: BinGrid, input: BinInput, out: Uint8Array): void {
  const { x, y, n, view, box } = input;
  const { cell, cols, rows, smooth, smoothMax } = grid;
  const sx = box.width / (view.x1 - view.x0);
  const sy = box.height / (view.y1 - view.y0);
  const invCell = 1 / cell;
  const { x0, x1, y0, y1 } = view;
  const f = 255 / Math.log1p(Math.max(smoothMax, 2));
  for (let i = 0; i < n; i++) {
    const px = x[i]!;
    const py = y[i]!;
    if (!(px >= x0 && px <= x1 && py >= y0 && py <= y1)) continue;
    let ci = ((px - x0) * sx * invCell) | 0;
    let ri = ((y1 - py) * sy * invCell) | 0;
    if (ci >= cols) ci = cols - 1;
    if (ri >= rows) ri = rows - 1;
    out[i] = (Math.log1p(smooth[ri * cols + ci]!) * f) | 0;
  }
}

/** The dominant class of one cell (ties → the lower index, i.e. the inner zone). */
export function dominantClass(grid: BinGrid, idx: number): number {
  const base = idx * grid.classCount;
  let best = 0;
  let bestCount = -1;
  for (let k = 0; k < grid.classCount; k++) {
    const c = grid.classCounts[base + k]!;
    if (c > bestCount) {
      bestCount = c;
      best = k;
    }
  }
  return best;
}

/** The cell under a CSS-pixel position inside the plot box, or `-1`. */
export function cellAt(grid: BinGrid, box: DensityPlotBox, px: number, py: number): number {
  const ci = ((px - box.left) / grid.cell) | 0;
  const ri = ((py - box.top) / grid.cell) | 0;
  if (ci < 0 || ri < 0 || ci >= grid.cols || ri >= grid.rows) return -1;
  return ri * grid.cols + ci;
}

/** Log-scaled density of one cell in 0–1, on the smoothed field. */
export function cellDensity(grid: BinGrid, idx: number): number {
  return Math.log1p(grid.smooth[idx]!) / Math.log1p(Math.max(grid.smoothMax, 2));
}
