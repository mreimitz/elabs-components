/**
 * hit-test.ts — bucketed nearest-mark lookup for the canvas mark layer (RM-046).
 *
 * ## Why not a linear scan
 *
 * A canvas layer exists precisely because the mark count is past what the DOM
 * can carry (`DottedChart`, `PerformanceSpectrum` — tens of thousands of marks).
 * At that scale the hover path is the bottleneck, not the draw: a linear scan
 * touches every point on every `pointermove`, i.e. 50k distance tests at
 * pointer-event rate. A uniform grid turns that into "read the cells that can
 * possibly contain a point within `radius`" — a handful of buckets whose
 * occupancy does not grow with the dataset, only with local density.
 *
 * ## Why a uniform grid and not a k-d tree / quadtree
 *
 * Marks in these views are laid out on a scale, so they are broadly uniform in
 * screen space — the case a uniform grid is best at, and the only structure
 * here that is O(1) to BUILD (one array push per point). A quadtree costs more
 * to build than it saves for a structure that is rebuilt whenever the scales
 * change. Cell size should be ~the hover radius: `createSpatialGrid(8)` for an
 * 8px hit radius means `query` reads a 3×3 block of cells.
 *
 * The grid stores screen coordinates (CSS pixels, the same space `draw`
 * receives), NOT data coordinates — the caller inserts after applying its
 * scales, and re-inserts when they change.
 */

/** A rebuildable uniform-grid index over screen-space points. */
export interface SpatialGrid<T> {
  /** Index `datum` at CSS-pixel position (`x`, `y`). O(1). */
  insert(x: number, y: number, datum: T): void;
  /**
   * The datum nearest (`x`, `y`) within `radius` CSS pixels, or `null`.
   * Ties resolve to the earliest-inserted point, so a redraw with unchanged
   * data resolves the same datum twice.
   */
  query(x: number, y: number, radius: number): T | null;
  /** Drop every entry, keeping the grid (and its cell size) reusable. */
  clear(): void;
  /** How many points are indexed. */
  readonly size: number;
  /**
   * How many points the last `query` measured a distance to.
   *
   * A DIAGNOSTIC, not part of the hover path: it is what makes "the lookup is
   * sub-linear" an assertion a test can make against a brute-force baseline
   * (which by definition examines `size` candidates) rather than a claim in a
   * comment. Reset on every `query`.
   */
  readonly lastQueryCandidates: number;
}

interface GridEntry<T> {
  x: number;
  y: number;
  datum: T;
  /** Insertion order — the tie-breaker that keeps `query` deterministic. */
  seq: number;
}

/**
 * Creates an empty grid whose buckets are `cellSize` CSS pixels square.
 *
 * Pick `cellSize` ≈ the hover radius you will query with. Much smaller and a
 * query walks many near-empty cells; much larger and each cell degenerates
 * toward a linear scan of its contents.
 *
 * @throws {RangeError} when `cellSize` is not a positive finite number — a
 * zero or negative cell size silently makes every key `0,0`, i.e. a linear
 * scan wearing a grid's name.
 */
export function createSpatialGrid<T>(cellSize: number): SpatialGrid<T> {
  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    throw new RangeError(`createSpatialGrid: cellSize must be a positive number, got ${cellSize}`);
  }

  const cells = new Map<string, GridEntry<T>[]>();
  let count = 0;
  let seq = 0;
  let lastQueryCandidates = 0;

  const keyOf = (cx: number, cy: number) => `${cx},${cy}`;

  return {
    insert(x, y, datum) {
      if (!(Number.isFinite(x) && Number.isFinite(y))) {
        // A NaN coordinate (an unresolved scale, a null value) is not a mark
        // the user can point at; indexing it would poison a whole cell.
        return;
      }
      const key = keyOf(Math.floor(x / cellSize), Math.floor(y / cellSize));
      const bucket = cells.get(key);
      const entry: GridEntry<T> = { x, y, datum, seq: seq++ };
      if (bucket) {
        bucket.push(entry);
      } else {
        cells.set(key, [entry]);
      }
      count += 1;
    },

    query(x, y, radius) {
      lastQueryCandidates = 0;
      if (!(Number.isFinite(x) && Number.isFinite(y)) || !(radius > 0) || count === 0) {
        return null;
      }
      const reach = Math.ceil(radius / cellSize);
      const cx = Math.floor(x / cellSize);
      const cy = Math.floor(y / cellSize);
      const maxDistanceSq = radius * radius;

      let best: GridEntry<T> | null = null;
      let bestDistanceSq = Number.POSITIVE_INFINITY;

      for (let ix = cx - reach; ix <= cx + reach; ix++) {
        for (let iy = cy - reach; iy <= cy + reach; iy++) {
          const bucket = cells.get(keyOf(ix, iy));
          if (!bucket) {
            continue;
          }
          for (const entry of bucket) {
            lastQueryCandidates += 1;
            const dx = entry.x - x;
            const dy = entry.y - y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq > maxDistanceSq) {
              continue;
            }
            // Strictly-less keeps the earliest-inserted point on a tie.
            if (distanceSq < bestDistanceSq) {
              bestDistanceSq = distanceSq;
              best = entry;
            }
          }
        }
      }

      return best ? best.datum : null;
    },

    clear() {
      cells.clear();
      count = 0;
      seq = 0;
      lastQueryCandidates = 0;
    },

    get size() {
      return count;
    },

    get lastQueryCandidates() {
      return lastQueryCandidates;
    },
  };
}
