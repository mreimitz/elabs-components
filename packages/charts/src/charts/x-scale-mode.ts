/**
 * Non-temporal x-scale modes for the cartesian time-series shell (#352).
 *
 * ## Why this exists
 *
 * `LineChart` / `AreaChart` / `ComposedChart` share `time-series-chart-shell.tsx`,
 * which hard-coded `scaleTime`. A non-Date x value (a turn number, a step index,
 * a bucket label) had nowhere to go: `new Date("A")` is an Invalid Date, so the
 * whole series collapsed onto one pixel. The shipped crash-guard made that
 * failure honest (`ChartFallback` + a dev warning) but it still could not draw
 * the chart the caller actually asked for.
 *
 * ## The encoding (read this before changing anything here)
 *
 * The chart context types `xScale` as a `ScaleTime` and ~20 consumers
 * (`Line`, `Area`, `Grid`, `XAxis`, `ChartBrush`, markers, tooltips, highlight
 * segments, …) call it as `(Date) => number`. Re-typing that surface as a union
 * would touch every one of them for zero user-visible gain, because **a point
 * scale over an ordinal index and a linear scale over a number are both just a
 * monotonic projection onto a 1-D axis** — exactly what a time scale already is.
 *
 * So a non-time mode keeps ONE scale type and changes the two things that
 * actually differ:
 *
 * 1. **position** — `xAccessor` projects the raw x value onto a synthetic,
 *    strictly monotonic instant (band → the category's ordinal; linear → the
 *    number normalised into a fixed span). Spacing, ordering and the bisector
 *    nearest-point lookup are therefore correct by construction.
 * 2. **label** — `labelOf` returns the caller's OWN x value (`"Turn 1"`, `"3"`),
 *    never a formatted date. That label is what the axis, the ticker and the
 *    tooltip title render.
 *
 * This is deliberately NOT the workaround #352 complains about. There, the
 * *consumer* fabricated Dates and lost their real label (turn number visible
 * only in the tooltip). Here the fabrication is an internal positional encoding
 * and the caller's label is the one thing that reaches the screen.
 */

import { shortDateFmt } from "./chart-formatters";
import { fallbackXLabel, isInvalidDate } from "./chart-x-value-utils";

/**
 * How a cartesian chart interprets its `xDataKey` values.
 *
 * - `"time"` — Date (or Date-coercible) values on a time scale. The default;
 *   unchanged behaviour.
 * - `"band"` — categorical/ordinal values (strings, or anything stringifiable).
 *   Points are evenly spaced in first-seen order, one slot per distinct value.
 * - `"linear"` — numeric values spaced by magnitude, not by order.
 */
export type ChartXScaleType = "time" | "band" | "linear";

/** Synthetic domain width (ms) used by the `linear` projection. See the file header. */
const SYNTHETIC_SPAN_MS = 1_000_000;

/** Stable key for a categorical x value. `null`/`undefined` collapse to `""`. */
function categoryKey(rawValue: unknown): string {
  return rawValue == null ? "" : String(rawValue);
}

/** Numeric reading of an x value; `NaN` when it is not a finite number. */
function toNumber(rawValue: unknown): number {
  if (typeof rawValue === "number") {
    return rawValue;
  }
  if (rawValue instanceof Date) {
    return rawValue.getTime();
  }
  if (typeof rawValue === "string" && rawValue.trim() !== "") {
    return Number(rawValue);
  }
  return Number.NaN;
}

/** True when the value could carry a category label (so an ordinal axis is meaningful). */
function isLabellable(rawValue: unknown): boolean {
  if (typeof rawValue === "number") {
    return Number.isFinite(rawValue);
  }
  if (typeof rawValue === "string") {
    return rawValue.trim() !== "";
  }
  return typeof rawValue === "boolean";
}

export interface XScaleResolution {
  /** The mode the shell should render with. */
  type: ChartXScaleType;
  /**
   * True when the caller passed no `xScale` and the data forced the ordinal
   * fallback — the shell warns once per mount for this case (#352 AC2).
   */
  autoFellBack: boolean;
  /**
   * True when NO x value can be plotted at all (time mode, every value
   * non-Date-coercible AND unlabellable). The shell renders `ChartFallback`.
   */
  unplottable: boolean;
}

/**
 * Picks the x-scale mode for a dataset.
 *
 * An explicit `xScaleType` always wins — that is what makes the prop a contract
 * rather than a hint, and it is why `"time"` data is bit-for-bit unaffected.
 *
 * With no explicit mode the answer is `"time"`, except for the case #352 was
 * filed about: EVERY x value fails Date coercion. Then
 *
 * - if the values can carry a label (a string, a finite number, a boolean) the
 *   mode degrades to `"band"` — the ordinal fallback the issue asks for — and
 *   the caller gets a dev warning naming the fix;
 * - if they cannot (all `null`/`undefined`/empty), there is genuinely nothing to
 *   label OR to plot, so the shell keeps rendering `ChartFallback` rather than an
 *   axis of blank ticks.
 */
export function resolveXScaleType({
  data,
  xDataKey,
  xScaleType,
}: {
  data: Record<string, unknown>[];
  xDataKey: string;
  xScaleType: ChartXScaleType | undefined;
}): XScaleResolution {
  if (xScaleType) {
    return { type: xScaleType, autoFellBack: false, unplottable: false };
  }

  if (data.length === 0) {
    return { type: "time", autoFellBack: false, unplottable: false };
  }

  let invalidCount = 0;
  let labellableCount = 0;
  for (const row of data) {
    const raw = row[xDataKey];
    const date = raw instanceof Date ? raw : new Date(raw as string | number);
    if (isInvalidDate(date)) {
      invalidCount += 1;
      if (isLabellable(raw)) {
        labellableCount += 1;
      }
    }
  }

  if (invalidCount !== data.length) {
    // A mixed dataset still has a real time domain to anchor on — keep time mode
    // and let the per-point label fallback handle the odd bad row.
    return { type: "time", autoFellBack: false, unplottable: false };
  }

  if (labellableCount === data.length) {
    return { type: "band", autoFellBack: true, unplottable: false };
  }

  return { type: "time", autoFellBack: false, unplottable: true };
}

export interface XValueEncoder {
  /** Projects a row onto the shared monotonic time axis. */
  xAccessor: (d: Record<string, unknown>) => Date;
  /** The human-readable x label for a row — the caller's own value in non-time modes. */
  labelOf: (d: Record<string, unknown>) => string;
}

/**
 * Builds the positional projection + label reader for a mode.
 *
 * `data` is the ordinal/extent SOURCE, not the render set: pass the full
 * dataset so the encoding does not shift while brushing or decimating.
 */
export function buildXValueEncoder({
  data,
  type,
  xDataKey,
}: {
  data: Record<string, unknown>[];
  type: ChartXScaleType;
  xDataKey: string;
}): XValueEncoder {
  if (type === "band") {
    const ordinals = new Map<string, number>();
    for (const row of data) {
      const key = categoryKey(row[xDataKey]);
      if (!ordinals.has(key)) {
        ordinals.set(key, ordinals.size);
      }
    }
    return {
      xAccessor: (d) => new Date(ordinals.get(categoryKey(d[xDataKey])) ?? 0),
      labelOf: (d) => fallbackXLabel(d[xDataKey]),
    };
  }

  if (type === "linear") {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const row of data) {
      const value = toNumber(row[xDataKey]);
      if (!Number.isFinite(value)) {
        continue;
      }
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    // Normalising into a fixed synthetic span (instead of using the raw number
    // as an epoch) keeps the projection inside the representable Date range for
    // ANY magnitude of x — a run id of 1e18 would otherwise be an Invalid Date.
    const span = Number.isFinite(min) && max > min ? max - min : 0;
    return {
      xAccessor: (d) => {
        const value = toNumber(d[xDataKey]);
        if (!(Number.isFinite(value) && span > 0)) {
          return new Date(0);
        }
        return new Date(((value - min) / span) * SYNTHETIC_SPAN_MS);
      },
      labelOf: (d) => fallbackXLabel(d[xDataKey]),
    };
  }

  return {
    xAccessor: (d) => {
      const value = d[xDataKey];
      return value instanceof Date ? value : new Date(value as string | number);
    },
    labelOf: (d) => {
      const value = d[xDataKey];
      const date = value instanceof Date ? value : new Date(value as string | number);
      return isInvalidDate(date) ? fallbackXLabel(value) : shortDateFmt.format(date);
    },
  };
}
