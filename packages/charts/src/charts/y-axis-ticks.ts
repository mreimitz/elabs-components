/** Default hint passed to `scale.ticks()` (d3 — approximate tick count). */
export const Y_AXIS_DEFAULT_TICK_COUNT = 5;

/** Minimum valid `numTicks` for `scale.ticks()` — values ≤ 0 yield no ticks. */
export const Y_AXIS_MIN_TICK_COUNT = 1;

/**
 * Upper bound for the tick count hint. D3 may return more "nice" ticks above ~10;
 * keeping the hint in a modest range avoids overcrowded axes.
 */
export const Y_AXIS_MAX_TICK_COUNT = 10;

/** Clamps a user `numTicks` value to a valid d3 tick-count hint. */
export function resolveYAxisTickCount(numTicks?: number): number {
  if (numTicks == null || !Number.isFinite(numTicks)) {
    return Y_AXIS_DEFAULT_TICK_COUNT;
  }
  const rounded = Math.round(numTicks);
  if (rounded < Y_AXIS_MIN_TICK_COUNT) {
    return Y_AXIS_MIN_TICK_COUNT;
  }
  if (rounded > Y_AXIS_MAX_TICK_COUNT) {
    return Y_AXIS_MAX_TICK_COUNT;
  }
  return rounded;
}

// ---------------------------------------------------------------------------
// RM-108 — one tick generator for every value axis (labels AND grid rows)
// ---------------------------------------------------------------------------

/** The slice of a d3 continuous scale the tick generator needs. */
export interface TickableScale {
  ticks: (count?: number) => number[];
}

/** d3 log scales expose `base()`; linear/sqrt/pow scales do not. */
export function isLogScale(scale: TickableScale): boolean {
  return typeof (scale as { base?: unknown }).base === "function";
}

/** Leading digit of a positive number (`50` → 5, `0.2` → 2). */
function mantissa(value: number): number {
  return Math.round(value / 10 ** Math.floor(Math.log10(value)));
}

/**
 * Mantissa tiers a log axis thins through, densest first: 1-2-5, then 1-5, then
 * powers of ten only. d3's `log.ticks()` returns every 1–9 multiple for a
 * domain of a few decades (24 labels for 50–10 000), which no axis can paint.
 */
const LOG_MANTISSA_TIERS: readonly (readonly number[])[] = [[1, 2, 5], [1, 5], [1]];

/**
 * Tick values for a value axis: `scale.ticks(count)` for linear/sqrt scales;
 * for a log scale, the densest 1-2-5 tier that stays within `count + 2`
 * labels (and has at least two). `YAxis` labels and `Grid` rows both call this,
 * so the two never disagree.
 */
export function valueAxisTicks(scale: TickableScale, count: number): number[] {
  const all = scale.ticks(count);
  if (!isLogScale(scale)) {
    return all;
  }
  const positive = all.filter((value) => value > 0);
  for (const tier of LOG_MANTISSA_TIERS) {
    const kept = positive.filter((value) => tier.includes(mantissa(value)));
    if (kept.length >= 2 && kept.length <= count + 2) {
      return kept;
    }
  }
  const decades = positive.filter((value) => mantissa(value) === 1);
  return decades.length >= 2 ? decades : all;
}
