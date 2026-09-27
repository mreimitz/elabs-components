/**
 * density-scatter/types.ts — the declared shapes of `DensityScatterChart`.
 *
 * A point plot for 10⁵–10⁶ rows: every point is always drawn, its colour comes
 * from the density around it, and zones defined on the axes classify it. The
 * framework-free parts (`columns.ts`, `zones.ts`, `bin.ts`, `selection.ts`)
 * work on the typed arrays declared here; the React container only wires them.
 */

/** A numeric column as the chart wants it — any array-like of numbers. */
export type NumericColumn = ArrayLike<number>;

/**
 * Columnar input: parallel arrays, one entry per point. The chart never keeps
 * per-row objects for 10⁵+ points — 500k `Record<string, unknown>` rows are a
 * garbage-collection problem before a single pixel is drawn. `toDensityColumns`
 * accepts plain rows too and converts once, with a dev warning past
 * `DENSITY_ROWS_WARN_AT`.
 */
export interface DensityScatterColumns {
  x: NumericColumn;
  y: NumericColumn;
  /** Extra numeric columns a `colorBy` can read (a continuous parameter). */
  values?: Record<string, NumericColumn>;
  /**
   * Extra categorical columns a `colorBy` can read: one label per point, or
   * already encoded as `codes` (index into `labels`, one per point). Pass the
   * encoded form for 10⁵+ points that stream in — the chart then reads the
   * codes as they are instead of re-encoding every label on each update.
   */
  categories?: Record<string, ArrayLike<string> | DensityCategoryCodes>;
}

/** A categorical column already encoded: `labels[codes[i]]` is point i's value. */
export interface DensityCategoryCodes {
  codes: Uint16Array;
  labels: readonly string[];
}

/** Row input — converted once by `toDensityColumns`. */
export type DensityScatterRows = ReadonlyArray<Record<string, unknown>>;

export type DensityScatterData = DensityScatterColumns | DensityScatterRows;

/** Converted, typed, ready for the hot loops. */
export interface DensityPoints {
  x: Float32Array;
  y: Float32Array;
  /** Point count. */
  n: number;
  values: Record<string, Float32Array>;
  categories: Record<string, { codes: Uint16Array; labels: string[] }>;
}

/**
 * A zone on the axes, in data units. One of:
 * - a rectangle (`min`/`max` per axis — the "define on axis level" case; `x`
 *   omitted = a horizontal band),
 * - an envelope that varies along x: an `upper` and a `lower` polyline,
 * - a `line`: everything above (or below) one polyline,
 * - a `polygon`: any closed shape (implicitly closed, ≥ 3 vertices).
 * Envelopes and lines stop at their end vertices unless `extend` opens an end.
 * A rectangle is the two-vertex envelope; envelopes and polygons share one
 * classification pass (`zones.ts`).
 */
export interface DensityZone {
  /** Stable key — carried in legend entries and selection intents. */
  id: string;
  label: string;
  /** Zone ink — a chart token (`"var(--chart-1)"`). Density rides on it as lightness. */
  color: string;
  /**
   * Which side of the shape the zone covers. `false` (default): the points
   * INSIDE the bounds. `true`: every point OUTSIDE them (a "negative" zone —
   * e.g. everything beyond a limit envelope). The outline is drawn dashed.
   */
  invert?: boolean;
  bounds:
    | { x?: [number, number]; y: [number, number] }
    | {
        upper: ReadonlyArray<readonly [number, number]>;
        lower: ReadonlyArray<readonly [number, number]>;
        /** Continue past the first / last vertex, holding the edge's end value. Default: closed ends. */
        extend?: DensityZoneExtend;
      }
    | {
        /** A threshold polyline: the zone is everything above (or below) it. */
        line: ReadonlyArray<readonly [number, number]>;
        side: "above" | "below";
        /** Continue past the first / last vertex, holding the end value. Default: closed ends. */
        extend?: DensityZoneExtend;
      }
    | {
        /** Vertices in drawing order; the last joins the first. */
        polygon: ReadonlyArray<readonly [number, number]>;
      };
}

/**
 * Open ends for an envelope or a line zone: `true` continues the shape past its
 * first (`start`) / last (`end`) vertex without end, holding the edge's value
 * there; unset or `false` stops it at that vertex (a closed end). A rectangle
 * gets the same with `x: [-Infinity, max]` / `[min, Infinity]`.
 */
export interface DensityZoneExtend {
  start?: boolean;
  end?: boolean;
}

/** Points that match no zone. Always present in the legend when `zones` is set. */
export interface DensityOutsideZone {
  label?: string;
  color?: string;
  /** List the outside class in the legend. Default `true`. */
  legend?: boolean;
  /**
   * The outside class can be picked as a zone constraint (legend modifier-click).
   * Default `true`. Its points stay drawn and range/lasso gestures still reach them.
   */
  selectable?: boolean;
}

/** The chart's own intersection selection, in DATA units. */
export interface DensityScatterSelection {
  /** Inclusive x range. */
  x?: [number, number];
  /** Inclusive y range. */
  y?: [number, number];
  /** A closed polygon in data units. */
  lasso?: ReadonlyArray<readonly [number, number]>;
  /** Zone ids (`DENSITY_OUTSIDE_ID` for the outside class). Empty/undefined = no zone constraint. */
  zones?: readonly string[];
  /**
   * Row indexes picked one by one (a click on a dot). Selected in addition to
   * what the other constraints select — a union, never an intersection.
   */
  points?: readonly number[];
}

/** Colour source for the dots. */
export type DensityColorBy =
  /** Default: the zone class, with density as lightness. */
  | { kind: "zone" }
  /** Density alone, on the neutral wire ramp. */
  | { kind: "density" }
  /** A continuous column on a sequential ramp; dense cells show the cell's mean. */
  | { kind: "value"; key: string; domain?: [number, number] }
  /** A categorical column (≤ 12 distinct values) on the series ramp. */
  | { kind: "category"; key: string };

/** The data window shown — the zoom/pan state. */
export interface DensityView {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** The plot's inner box in CSS pixels. */
/** Per-axis presentation of `DensityScatterChart` (`xAxis` / `yAxis`). */
export interface DensityAxisOptions {
  /** Tick labels. Default `true`; `false` keeps the grid lines. */
  labels?: boolean;
  /** Target distance between ticks / grid lines in CSS px. Default 90 (x), 60 (y). */
  tickSpacing?: number;
}

export interface DensityPlotBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * What `renderOverlay` receives: the current window and plot box plus the two
 * projections, so a host can draw (and hit-test) its own layer in data units —
 * an editor, annotations — without re-deriving the chart's scales.
 */
export interface DensityOverlayContext {
  view: DensityView;
  /** The plot's inner box, CSS px relative to the chart root. */
  box: DensityPlotBox;
  /** The chart root's size in CSS px. */
  width: number;
  height: number;
  /** Data units → CSS px (chart-root coordinates), against the current view. */
  toPixel: (x: number, y: number) => [number, number];
  /** CSS px (chart-root coordinates) → data units, against the current view. */
  toData: (px: number, py: number) => [number, number];
}

/** The zone id used for "matches no zone". */
export const DENSITY_OUTSIDE_ID = "__outside";

/** Class index of "outside" when `zones` has `k` entries is `k`. */
export const DENSITY_MAX_CLASSES = 16;

/** Row-input size past which the converter warns once (dev only). */
export const DENSITY_ROWS_WARN_AT = 50_000;

/** Extra hover content for one dot (`describePoint`). */
export interface DensityPointDescription {
  /** Replaces the generic "Point" title — e.g. the row's dimension value. */
  title?: string;
  /** Rows appended after the coordinates. */
  rows?: ReadonlyArray<{ label: string; value: string }>;
}
