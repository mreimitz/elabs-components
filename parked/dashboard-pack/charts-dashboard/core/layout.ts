/**
 * layout.ts — the dashboard grid engine (analysis §2.1, §5.1, R6–R8).
 *
 * Framework-free and pure: every function returns new arrays/objects and never mutates
 * its inputs. Coordinates are cells, never pixels, except `cellRect`/`hitTestCell`, which
 * translate between the two for a given container size.
 *
 * Two grid models (`GridSpec.mode`):
 * - `fit` — bounded `columns × rows`; no compaction; `push` looks right-then-down for room.
 * - `flow` — `columns` wide, unbounded height; `compact` applies vertical gravity; `push`
 *   moves colliders down.
 *
 * gridstack's `GridStackEngine` (`collide`, `findEmptyPosition`, `nodeBoundFix`) and
 * react-grid-layout 2.1's `fastVerticalCompactor` were read as reference; no code is taken.
 */

import type { GridSpec, TileLayout } from "./spec";

/** Default columns when a grid omits them. */
export const DEFAULT_GRID_COLUMNS = 24;
/** Default `fit` rows when a grid omits them. */
export const DEFAULT_GRID_ROWS = 12;
/** Default `flow` row height in px. */
export const DEFAULT_ROW_HEIGHT = 30;
/** Default gap between cells in px (the renderer resolves it to `--spacing`). */
export const DEFAULT_GRID_GAP = 8;

/** A pixel rectangle, shaped like `DOMRectReadOnly` so it can be used where one is expected. */
export interface CellRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/** A layout together with whether the requested operation succeeded. */
export interface CollisionResult {
  layout: TileLayout[];
  ok: boolean;
}

/** How a move that overlaps other tiles is resolved. */
export type CollisionStrategy = "push" | "reject" | "swap";

function columnsOf(grid: GridSpec): number {
  return Math.max(1, Math.round(grid.columns || DEFAULT_GRID_COLUMNS));
}

/** Rows of a bounded (`fit`) grid; `Infinity` for `flow`. */
function rowsOf(grid: GridSpec): number {
  if (grid.mode === "flow") return Number.POSITIVE_INFINITY;
  return Math.max(1, Math.round(grid.rows ?? DEFAULT_GRID_ROWS));
}

function gapOf(grid: GridSpec): number {
  return Math.max(0, grid.gap ?? DEFAULT_GRID_GAP);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/** True when two tiles (with different ids) share at least one cell. */
export function collides(a: TileLayout, b: TileLayout): boolean {
  if (a.id === b.id) return false;
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function collidesAny(item: TileLayout, others: readonly TileLayout[]): boolean {
  return others.some((other) => collides(item, other));
}

/** Clamp one tile to integer cells, its own min/max, and the grid's bounds. */
function boundOne(item: TileLayout, grid: GridSpec): TileLayout {
  const columns = columnsOf(grid);
  const rows = rowsOf(grid);
  const minW = Math.max(1, item.minW ?? 1);
  const minH = Math.max(1, item.minH ?? 1);
  const w = clamp(
    Math.round(finiteOr(item.w, minW)),
    Math.min(minW, columns),
    Math.min(item.maxW ?? columns, columns),
  );
  const h = clamp(
    Math.round(finiteOr(item.h, minH)),
    Math.min(minH, rows),
    Math.min(item.maxH ?? rows, rows),
  );
  const x = clamp(Math.round(finiteOr(item.x, 0)), 0, columns - w);
  const y = clamp(Math.round(finiteOr(item.y, 0)), 0, rows - h);
  return { ...item, x, y, w, h };
}

/**
 * Clamp every tile to whole cells inside the grid, honouring `minW`/`maxW`/`minH`/`maxH`.
 * In `flow` mode only the horizontal axis and `y ≥ 0` are bounded.
 */
export function correctBounds(layout: readonly TileLayout[], grid: GridSpec): TileLayout[] {
  return layout.map((item) => boundOne(item, grid));
}

/** Order by `y`, then `x`, then `id` — deterministic regardless of input order. */
function byPosition(a: TileLayout, b: TileLayout): number {
  return a.y - b.y || a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * The direction a move travelled, as unit signs, used to bias where a pushed tile goes: a
 * tile dragged DOWN onto a neighbour should push that neighbour down (or into the space the
 * drag vacated), never sideways for no reason.
 */
function moveDirection(previous: TileLayout | undefined, placed: TileLayout) {
  if (!previous) return { x: 0, y: 0 };
  return { x: Math.sign(placed.x - previous.x), y: Math.sign(placed.y - previous.y) };
}

/**
 * The best free spot for a displaced tile inside a bounded grid: the closest position (in
 * cells) to where it was, preferring moves in the drag direction, then down, then right —
 * ties resolved top-to-bottom, left-to-right so the result is deterministic. `null` when
 * nothing fits.
 */
function nearestFreeSpot(
  item: TileLayout,
  occupied: readonly TileLayout[],
  grid: GridSpec,
  direction: { x: number; y: number },
): TileLayout | null {
  const columns = columnsOf(grid);
  const rows = rowsOf(grid);
  let best: { spot: TileLayout; score: number } | null = null;
  for (let y = 0; y + item.h <= rows; y++) {
    for (let x = 0; x + item.w <= columns; x++) {
      const ddx = x - item.x;
      const ddy = y - item.y;
      // Manhattan distance from where it was; vertical steps cost a little more than horizontal
      // ones (a row is usually shorter than a column, so a sideways shift reads as smaller).
      let score = Math.abs(ddx) + Math.abs(ddy) * 1.25;
      // Against the drag direction costs extra: the reader expects things to flow away from
      // the tile that arrived.
      if (direction.y !== 0 && ddy !== 0 && Math.sign(ddy) === -direction.y) score += 3;
      if (direction.x !== 0 && ddx !== 0 && Math.sign(ddx) === -direction.x) score += 3;
      // With no direction (a resize, a keyboard add) prefer down, then right.
      if (direction.x === 0 && direction.y === 0) {
        if (ddy < 0) score += 3;
        if (ddx < 0) score += 3;
      }
      if (best && score >= best.score) continue;
      const candidate = { ...item, x, y };
      if (collidesAny(candidate, occupied)) continue;
      best = { spot: candidate, score };
    }
  }
  return best?.spot ?? null;
}

/**
 * Place `moved` into `layout` and resolve any overlap it causes.
 *
 * - `reject`: `ok: false` and the original layout when anything overlaps.
 * - `swap`: when `moved` lands exactly on ONE tile of the same size, that tile takes
 *   `moved`'s previous position; otherwise behaves like `reject`.
 * - `push`: tiles that overlap `moved` are relocated; tiles that do not are never touched.
 *   `flow` moves each collider straight down to the first free row; `fit` moves each
 *   collider to the nearest free spot, biased in the drag direction (`nearestFreeSpot`), and
 *   returns `ok: false` with the original layout when any collider has no room.
 *
 * A `static` tile is never relocated: a `moved` tile overlapping one is rejected under every
 * strategy, and a `static` tile is never the `moved` tile's swap partner.
 */
export function resolveCollisions(
  layout: readonly TileLayout[],
  moved: TileLayout,
  grid: GridSpec,
  strategy: CollisionStrategy,
): CollisionResult {
  const original = layout.map((item) => ({ ...item }));
  const fail: CollisionResult = { layout: original, ok: false };
  const placed = boundOne(moved, grid);
  const previous = layout.find((item) => item.id === moved.id);
  const others = layout.filter((item) => item.id !== moved.id).map((item) => ({ ...item }));
  const colliders = others.filter((item) => collides(item, placed));

  const assemble = (replacements: Map<string, TileLayout>): TileLayout[] => {
    const out = layout.map((item) =>
      item.id === moved.id ? placed : { ...(replacements.get(item.id) ?? item) },
    );
    if (!previous) out.push(placed);
    return out;
  };

  if (colliders.length === 0) return { layout: assemble(new Map()), ok: true };
  if (strategy === "reject") return fail;
  if (colliders.some((item) => item.static)) return fail;

  if (strategy === "swap") {
    const target = colliders[0];
    if (
      colliders.length !== 1 ||
      !previous ||
      !target ||
      target.x !== placed.x ||
      target.y !== placed.y ||
      target.w !== placed.w ||
      target.h !== placed.h
    ) {
      return fail;
    }
    const swapped = { ...target, x: previous.x, y: previous.y };
    const rest = others.filter((item) => item.id !== target.id);
    if (collidesAny(swapped, [...rest, placed])) return fail;
    return { layout: assemble(new Map([[target.id, swapped]])), ok: true };
  }

  // push
  const occupied: TileLayout[] = [placed, ...others.filter((item) => !collides(item, placed))];
  const replacements = new Map<string, TileLayout>();
  const direction = moveDirection(previous, placed);
  for (const item of [...colliders].sort(byPosition)) {
    let spot: TileLayout | null = null;
    if (grid.mode === "flow") {
      let y = placed.y + placed.h;
      let candidate = { ...item, y };
      while (collidesAny(candidate, occupied)) {
        y += 1;
        candidate = { ...item, y };
      }
      spot = candidate;
    } else {
      spot = nearestFreeSpot(item, occupied, grid, direction);
    }
    if (!spot) return fail;
    occupied.push(spot);
    replacements.set(item.id, spot);
  }
  return { layout: assemble(replacements), ok: true };
}

/**
 * Vertical gravity for `flow` grids; identity (a copy) for `fit`.
 *
 * O(n log n): sort on `y, x, id`, then drop each tile onto a per-column skyline. The result
 * is independent of input order, never overlaps, and keeps the input's array order.
 */
export function compact(layout: readonly TileLayout[], grid: GridSpec): TileLayout[] {
  if (grid.mode !== "flow") return layout.map((item) => ({ ...item }));
  const bounded = correctBounds(layout, grid);
  const placed = new Map<string, TileLayout>();
  // Locked tiles are obstacles: they keep their cells and everything else flows around them.
  const fixed = bounded.filter((item) => item.static);
  const settled: TileLayout[] = [...fixed];
  for (const item of fixed) placed.set(item.id, { ...item });
  const skyline = new Array<number>(columnsOf(grid)).fill(0);
  for (const item of [...bounded].sort(byPosition)) {
    if (item.static) continue;
    let y = 0;
    for (let c = item.x; c < item.x + item.w; c++) y = Math.max(y, skyline[c] ?? 0);
    // The skyline ignores locked tiles; step down past any it would land on.
    let candidate = { ...item, y };
    while (fixed.length > 0 && collidesAny(candidate, settled)) {
      y += 1;
      candidate = { ...item, y };
    }
    for (let c = item.x; c < item.x + item.w; c++) skyline[c] = y + item.h;
    settled.push(candidate);
    placed.set(item.id, candidate);
  }
  return bounded.map((item) => placed.get(item.id) ?? item);
}

/**
 * First free position for a tile of `size`, scanning row-major (top row first, left to right).
 *
 * `fit`: `null` when nothing fits inside `rows` and the grid is not `extendable`; an
 * extendable grid scans past `rows` (the caller then calls `extendRows` until it fits).
 * `flow`: always finds a slot (at worst below the lowest tile). `null` if `size.w` exceeds `columns`.
 */
export function findEmptySlot(
  layout: readonly TileLayout[],
  size: { w: number; h: number },
  grid: GridSpec,
): { x: number; y: number } | null {
  const columns = columnsOf(grid);
  const w = Math.max(1, Math.round(size.w));
  const h = Math.max(1, Math.round(size.h));
  if (w > columns) return null;
  const bottom = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  const unbounded = grid.mode === "flow" || grid.extendable === true;
  const lastY = unbounded ? bottom : rowsOf(grid) - h;
  for (let y = 0; y <= lastY; y++) {
    for (let x = 0; x + w <= columns; x++) {
      if (!collidesAny({ id: "\u0000slot", x, y, w, h }, layout)) return { x, y };
    }
  }
  return null;
}

/**
 * Grow a `fit` grid by 50 % of its ORIGINAL rows (rounded up), counting the step in
 * `extensions`. Twice on a 12-row grid gives 24 (12 → 18 → 24).
 */
export function extendRows(grid: GridSpec): GridSpec {
  const extensions = grid.extensions ?? 0;
  const current = grid.rows ?? DEFAULT_GRID_ROWS;
  const base = baseRowsOf(grid);
  return { ...grid, rows: current + Math.ceil(base / 2), extensions: extensions + 1 };
}

/**
 * The rows a `fit` grid had before any `extendRows` step — what one viewport height is
 * divided into, so extending never shrinks the cells the author sized the sheet with.
 */
export function baseRowsOf(grid: GridSpec): number {
  const extensions = grid.extensions ?? 0;
  const current = grid.rows ?? DEFAULT_GRID_ROWS;
  if (extensions <= 0) return current;
  for (let candidate = 1; candidate <= current; candidate++) {
    if (candidate + extensions * Math.ceil(candidate / 2) === current) return candidate;
  }
  return current;
}

/**
 * One-column layout for narrow viewports (R8): tiles in `y`-then-`x` order, each spanning
 * every column, heights preserved, stacked top to bottom. Returned in stacking order.
 */
export function stackForNarrow(
  layout: readonly TileLayout[],
  grid: Pick<GridSpec, "columns"> = { columns: DEFAULT_GRID_COLUMNS },
): TileLayout[] {
  const columns = Math.max(1, Math.round(grid.columns || DEFAULT_GRID_COLUMNS));
  let y = 0;
  return [...layout].sort(byPosition).map((item) => {
    const out = { ...item, x: 0, y, w: columns };
    y += item.h;
    return out;
  });
}

function cellSize(grid: GridSpec, container: { width: number; height: number }) {
  const columns = columnsOf(grid);
  const gap = gapOf(grid);
  const width = (container.width - (columns - 1) * gap) / columns;
  const height =
    grid.mode === "flow"
      ? (grid.rowHeight ?? DEFAULT_ROW_HEIGHT)
      : (container.height - (rowsOf(grid) - 1) * gap) / rowsOf(grid);
  return { width, height, gap };
}

/**
 * Pixel rectangle of a cell span inside a container. `fit` divides the container's width
 * and height by columns/rows minus gaps; `flow` divides only the width and uses `rowHeight`.
 */
export function cellRect(
  cell: Pick<TileLayout, "x" | "y" | "w" | "h">,
  grid: GridSpec,
  container: { width: number; height: number },
): CellRect {
  const size = cellSize(grid, container);
  const x = cell.x * (size.width + size.gap);
  const y = cell.y * (size.height + size.gap);
  const width = cell.w * size.width + (cell.w - 1) * size.gap;
  const height = cell.h * size.height + (cell.h - 1) * size.gap;
  return { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height };
}

/** The cell under a pixel point (relative to the container's top-left), clamped to the grid. */
export function hitTestCell(
  point: { x: number; y: number },
  grid: GridSpec,
  container: { width: number; height: number },
): { x: number; y: number } {
  const size = cellSize(grid, container);
  const columns = columnsOf(grid);
  const rows = rowsOf(grid);
  const x = clamp(Math.floor(point.x / (size.width + size.gap)), 0, columns - 1);
  const y = clamp(Math.floor(point.y / (size.height + size.gap)), 0, rows - 1);
  return { x, y };
}

/**
 * Clamp a requested size to a tile's `minW`/`maxW`/`minH`/`maxH`; when the tile has an
 * `aspect` (width ÷ height), the height follows the width.
 */
export function snapSize(
  size: { w: number; h: number },
  tile: Pick<TileLayout, "minW" | "maxW" | "minH" | "maxH" | "aspect">,
): { w: number; h: number } {
  const w = clamp(
    Math.round(size.w),
    Math.max(1, tile.minW ?? 1),
    tile.maxW ?? Number.POSITIVE_INFINITY,
  );
  const wantedH = tile.aspect && tile.aspect > 0 ? w / tile.aspect : size.h;
  const h = clamp(
    Math.round(wantedH),
    Math.max(1, tile.minH ?? 1),
    tile.maxH ?? Number.POSITIVE_INFINITY,
  );
  return { w, h };
}
