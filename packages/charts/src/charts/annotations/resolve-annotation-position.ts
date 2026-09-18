/**
 * Data units → plot pixels for annotations (RM-111).
 *
 * One annotation vocabulary has to land on five kinds of axis: a time scale
 * (`Date`, ISO string or epoch number), a continuous value scale (linear, log,
 * sqrt), a band scale (a category → its band), the synthetic positional x of
 * a `band`/`linear` time-series shell (`xValueToPosition`), and a horizontal
 * bar chart, where the value runs along x and the categories down y. Every
 * resolver returns `undefined` for a value its axis cannot place — the caller
 * skips that annotation instead of drawing it at 0.
 */

import type { AnnotationValue } from "./annotation-types";

/** A continuous d3 scale (time, linear, log, sqrt). */
type ContinuousScale = (value: never) => number | undefined;

/** A d3 band scale. */
interface BandScale {
  (value: string): number | undefined;
  bandwidth(): number;
}

/** One axis of the plot: where a value lands, and the span an interval covers. */
export interface AnnotationAxis {
  /** Pixel position of a value (a band's centre), or `undefined`. */
  point(value: AnnotationValue): number | undefined;
  /** Pixel span `[start, end]` covering two values (bands: outer edges), or `undefined`. */
  span(from: AnnotationValue, to: AnnotationValue): [number, number] | undefined;
}

/** Both axes of a plot plus its inner size. */
export interface AnnotationScales {
  x: AnnotationAxis;
  y: AnnotationAxis;
  innerWidth: number;
  innerHeight: number;
  /** The category axis of a band chart, when there is one — `row` annotations need it. */
  category?: "x" | "y";
}

const ISO_DATE = /^(\d{4})-(\d{2})(?:-(\d{2}))?(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * Coerce a value to a `Date` for a time axis. ISO date strings are read in
 * LOCAL time (d3 time intervals are local), numbers as epoch milliseconds.
 */
export function annotationValueToDate(value: AnnotationValue): Date | undefined {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : undefined;
  if (typeof value === "number") return Number.isFinite(value) ? new Date(value) : undefined;
  const match = ISO_DATE.exec(value.trim());
  if (match) {
    const [, y, m, d, hh, mm, ss] = match;
    return new Date(
      Number(y),
      Number(m) - 1,
      d ? Number(d) : 1,
      hh ? Number(hh) : 0,
      mm ? Number(mm) : 0,
      ss ? Number(ss) : 0,
    );
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : undefined;
}

function finite(n: number | undefined): number | undefined {
  return n !== undefined && Number.isFinite(n) ? n : undefined;
}

function ordered(a: number | undefined, b: number | undefined): [number, number] | undefined {
  if (a === undefined || b === undefined) return undefined;
  return a <= b ? [a, b] : [b, a];
}

/** A continuous axis. `toInput` turns a data value into the scale's input. */
export function continuousAxis(
  scale: ContinuousScale,
  toInput: (value: AnnotationValue) => unknown,
): AnnotationAxis {
  const point = (value: AnnotationValue) => {
    const input = toInput(value);
    return input === undefined ? undefined : finite(scale(input as never));
  };
  return { point, span: (from, to) => ordered(point(from), point(to)) };
}

/** A numeric value axis (linear, log, sqrt). Numeric strings are accepted. */
export function valueAxis(scale: ContinuousScale): AnnotationAxis {
  return continuousAxis(scale, (value) => {
    const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    return Number.isFinite(n) ? n : undefined;
  });
}

/** A time axis; `project` maps the coerced value onto the scale's domain. */
export function timeAxis(
  scale: ContinuousScale,
  project: (value: AnnotationValue) => unknown = annotationValueToDate,
): AnnotationAxis {
  return continuousAxis(scale, project);
}

/** A band (category) axis: a point is the band centre, a span runs edge to edge. */
export function bandAxis(scale: BandScale): AnnotationAxis {
  const start = (value: AnnotationValue) =>
    finite(scale(value instanceof Date ? value.toISOString() : String(value)));
  return {
    point: (value) => {
      const s = start(value);
      return s === undefined ? undefined : s + scale.bandwidth() / 2;
    },
    span: (from, to) => {
      const a = start(from);
      const b = start(to);
      if (a === undefined || b === undefined) return undefined;
      return [Math.min(a, b), Math.max(a, b) + scale.bandwidth()];
    },
  };
}

/** Pixel position of a data point, or `undefined` when either axis cannot place it. */
export function resolveAnnotationPosition(
  point: { x: AnnotationValue; y: AnnotationValue },
  scales: Pick<AnnotationScales, "x" | "y">,
): { x: number; y: number } | undefined {
  const x = scales.x.point(point.x);
  const y = scales.y.point(point.y);
  return x === undefined || y === undefined ? undefined : { x, y };
}

/**
 * A category axis of equal, gap-free rows (or columns) in DRAWN order — the
 * layout of a container that splits its extent evenly per category
 * (`DumbbellChart`). A category resolves to its row's centre wherever the
 * row sorts, so a `row` note follows its category through a re-sort.
 */
export function rowBandAxis(categories: readonly string[], extent: number): AnnotationAxis {
  const step = extent / Math.max(categories.length, 1);
  const start = (value: AnnotationValue) => {
    const i = categories.indexOf(value instanceof Date ? value.toISOString() : String(value));
    return i < 0 ? undefined : i * step;
  };
  return {
    point: (value) => {
      const s = start(value);
      return s === undefined ? undefined : s + step / 2;
    },
    span: (from, to) => {
      const a = start(from);
      const b = start(to);
      if (a === undefined || b === undefined) return undefined;
      return [Math.min(a, b), Math.max(a, b) + step];
    },
  };
}

/**
 * The scales of a category × value plot that draws its own rows (no
 * `ChartProvider`): `categoryAxis` names the axis the categories run along.
 */
export function categoryValueScales({
  categories,
  categoryAxis,
  valueScale,
  innerWidth,
  innerHeight,
}: {
  categories: readonly string[];
  categoryAxis: "x" | "y";
  valueScale: ContinuousScale;
  innerWidth: number;
  innerHeight: number;
}): AnnotationScales {
  const value = valueAxis(valueScale);
  return categoryAxis === "y"
    ? {
        x: value,
        y: rowBandAxis(categories, innerHeight),
        innerWidth,
        innerHeight,
        category: "y",
      }
    : {
        x: rowBandAxis(categories, innerWidth),
        y: value,
        innerWidth,
        innerHeight,
        category: "x",
      };
}
