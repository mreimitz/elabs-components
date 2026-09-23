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
  /** Extra categorical columns a `colorBy` can read. */
  categories?: Record<string, ArrayLike<string>>;
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
 * A zone on the axes. Either a rectangle (`min`/`max` per axis — the "define on
 * axis level" case) or an envelope that varies along x: an `upper` and a `lower`
 * polyline in data units. A rectangle is the two-vertex envelope; both share
 * one classification path (`zones.ts`).
 */
export interface DensityZone {
  /** Stable key — carried in legend entries and selection intents. */
  id: string;
  label: string;
  /** Zone ink — a chart token (`"var(--chart-1)"`). Density rides on it as lightness. */
  color: string;
  bounds:
    | { x?: [number, number]; y: [number, number] }
    | {
        upper: ReadonlyArray<readonly [number, number]>;
        lower: ReadonlyArray<readonly [number, number]>;
      };
}

/** Points that match no zone. Always present in the legend when `zones` is set. */
export interface DensityOutsideZone {
  label?: string;
  color?: string;
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
export interface DensityPlotBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The zone id used for "matches no zone". */
export const DENSITY_OUTSIDE_ID = "__outside";

/** Class index of "outside" when `zones` has `k` entries is `k`. */
export const DENSITY_MAX_CLASSES = 16;

/** Row-input size past which the converter warns once (dev only). */
export const DENSITY_ROWS_WARN_AT = 50_000;
