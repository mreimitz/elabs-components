/**
 * distribution-geometry.ts — the one scale every distribution mark draws on
 * (RM-026).
 *
 * The whole point of `DistributionChart` is that a histogram, a box, a violin
 * and a jitter strip of the SAME numbers are four readings of one picture. That
 * only holds if they share a scale, so the scale lives here — a plain, pure
 * object of `number → number` functions — rather than inside any one mark. A
 * `kinds/*.tsx` file never computes a position from a domain; it asks the
 * geometry.
 *
 * ## The two axes are named by ROLE, not by x/y
 *
 * - the **value axis** carries the numeric variable;
 * - the **cross axis** carries the groups (one band each) and, for a histogram,
 *   the count.
 *
 * `orientation` decides which screen axis each role lands on, and NOTHING else
 * in this folder branches on it. That is deliberate: the four kinds each drew a
 * different mark, and letting all four carry their own `if (horizontal)` would
 * have been four chances to disagree about where a band starts.
 */
import { ticks as d3ticks } from "d3-array";

/** The plot area's inset inside the chart's own box. */
export interface DistributionMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Which screen axis the numeric variable runs along. */
export type DistributionOrientation = "horizontal" | "vertical";

/**
 * Padding at each end of a band, in px, so neighbouring groups' marks never
 * touch. Small, because a distribution's band is already mostly empty.
 */
export const BAND_PADDING = 6;

/** A point in the plot area's own coordinates (origin at the plot's top-left). */
export interface PlotPoint {
  x: number;
  y: number;
}

/** The shared scale + band layout. Pure data + pure functions; no React. */
export interface DistributionGeometry {
  orientation: DistributionOrientation;
  /** Width of the plot area (inside the margins). */
  plotWidth: number;
  /** Height of the plot area (inside the margins). */
  plotHeight: number;
  /** The shared value domain, `[lo, hi]`. */
  domain: readonly [number, number];
  /** How many bands (groups) the cross axis is divided into. */
  bandCount: number;
  /** One band's full extent along the cross axis, in px. */
  bandSize: number;
  /** Usable extent inside a band, i.e. `bandSize − 2 × BAND_PADDING`. */
  bandInner: number;
  /** The plot area's inset inside the chart box — an event handler needs it to
   *  convert an SVG-space pointer position into plot space. */
  margin: DistributionMargin;
  /** Position of `value` along the VALUE axis, in px. */
  valuePos: (value: number) => number;
  /** The inverse of {@link valuePos}: a position on the value axis → its value. */
  valueAt: (position: number) => number;
  /**
   * Position along the CROSS axis, in px: the centre of band `groupIndex`,
   * displaced by `offset` band-fractions (−0.5 … 0.5).
   */
  crossPos: (groupIndex: number, offset?: number) => number;
  /** {@link valuePos} × {@link crossPos}, resolved onto screen x/y. */
  point: (value: number, groupIndex: number, offset?: number) => PlotPoint;
  /** Where a count-height mark (a histogram bar) STARTS, along the cross axis. */
  baseline: (groupIndex: number) => number;
  /** Sign a count grows in along the cross axis: `−1` upward, `+1` rightward. */
  countSign: 1 | -1;
  /** Nice tick values across {@link domain}. */
  valueTicks: (count?: number) => number[];
}

/** Inputs to {@link makeDistributionGeometry}. */
export interface DistributionGeometryOptions {
  orientation: DistributionOrientation;
  plotWidth: number;
  plotHeight: number;
  domain: readonly [number, number];
  bandCount: number;
  margin: DistributionMargin;
}

/**
 * Build the geometry.
 *
 * A zero-width domain (every record carries the same value) is widened to a unit
 * box rather than dividing by zero — the chart then draws a single mark in the
 * middle of the axis, which is the truthful picture of "no spread".
 */
export function makeDistributionGeometry({
  orientation,
  plotWidth,
  plotHeight,
  domain,
  bandCount,
  margin,
}: DistributionGeometryOptions): DistributionGeometry {
  const horizontal = orientation === "horizontal";
  const [rawLo, rawHi] = domain;
  const lo = rawLo;
  const hi = rawHi > rawLo ? rawHi : rawLo + 1;
  const span = hi - lo;

  const valueExtent = horizontal ? plotWidth : plotHeight;
  const crossExtent = horizontal ? plotHeight : plotWidth;
  const bands = Math.max(1, bandCount);
  const bandSize = crossExtent / bands;
  const bandInner = Math.max(0, bandSize - 2 * BAND_PADDING);

  const valuePos = (value: number): number => {
    const t = (value - lo) / span;
    // The value axis runs left→right when horizontal and BOTTOM→TOP when
    // vertical: on a vertical layout "more" must be higher on the page.
    return horizontal ? t * valueExtent : valueExtent - t * valueExtent;
  };

  const crossPos = (groupIndex: number, offset = 0): number =>
    groupIndex * bandSize + bandSize / 2 + offset * bandSize;

  const countSign: 1 | -1 = horizontal ? -1 : 1;

  const baseline = (groupIndex: number): number =>
    horizontal ? (groupIndex + 1) * bandSize - BAND_PADDING : groupIndex * bandSize + BAND_PADDING;

  return {
    orientation,
    plotWidth,
    plotHeight,
    domain: [lo, hi],
    bandCount: bands,
    bandSize,
    bandInner,
    margin,
    valuePos,
    valueAt: (position) => {
      const t = horizontal ? position / valueExtent : 1 - position / valueExtent;
      return lo + t * span;
    },
    crossPos,
    point: (value, groupIndex, offset = 0) => {
      const v = valuePos(value);
      const c = crossPos(groupIndex, offset);
      return horizontal ? { x: v, y: c } : { x: c, y: v };
    },
    baseline,
    countSign,
    valueTicks: (count = 5) => d3ticks(lo, hi, count),
  };
}
