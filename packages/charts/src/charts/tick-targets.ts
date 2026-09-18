/**
 * Width- and height-derived tick targets (RM-108).
 *
 * An axis that paints the same five ticks at 900 px and at 380 px is either
 * sparse on a desktop or crowded on a phone. Datawrapper's River bikes chart
 * paints nine year ticks at 900 px and four at 380 px; these helpers turn that
 * convention into one rule every axis shares:
 *
 * - **x** — roughly one tick per {@link X_TICK_SPACING_PX} of plot width,
 *   clamped to {@link X_TICK_TARGET_MIN}–{@link X_TICK_TARGET_MAX};
 * - **y** — {@link Y_TICK_TARGET_SHORT} under {@link Y_TICK_SHORT_PLOT_PX} of
 *   plot height, else {@link Y_TICK_TARGET_TALL}.
 *
 * The result is a TARGET, not a promise: d3's `nice` tick generation and the
 * x axis' label de-dupe may paint one fewer or one more. Formatting of the
 * resulting set still goes through `valueFormatOptionsForSet` (#250) — the
 * count never decides the notation.
 *
 * RM-107 (the responsive contract) may later couple the x target to its
 * `narrow` breakpoint; until then the width maths below are the whole rule.
 */

/** Plot pixels per x tick — the River convention (≈ 9 ticks at 900 px). */
export const X_TICK_SPACING_PX = 90;
/** Fewest x ticks a width-derived target asks for (both ends of the domain). */
export const X_TICK_TARGET_MIN = 2;
/** Most x ticks a width-derived target asks for. */
export const X_TICK_TARGET_MAX = 10;

/** Plot height below which the y axis drops to {@link Y_TICK_TARGET_SHORT}. */
export const Y_TICK_SHORT_PLOT_PX = 200;
/** y tick target for a short plot (< {@link Y_TICK_SHORT_PLOT_PX}). */
export const Y_TICK_TARGET_SHORT = 3;
/** y tick target for every other plot — the historical default. */
export const Y_TICK_TARGET_TALL = 5;

/** `tickCount` on an axis: a fixed target, or `"auto"` (derived from the plot size). */
export type AxisTickCount = number | "auto";

/**
 * x tick target for a plot `innerWidth` pixels wide: one per
 * {@link X_TICK_SPACING_PX}, clamped to {@link X_TICK_TARGET_MIN}–{@link X_TICK_TARGET_MAX}.
 * A non-finite or non-positive width returns the minimum.
 */
export function tickTargetForWidth(innerWidth: number): number {
  if (!Number.isFinite(innerWidth) || innerWidth <= 0) {
    return X_TICK_TARGET_MIN;
  }
  const target = Math.round(innerWidth / X_TICK_SPACING_PX);
  return Math.min(X_TICK_TARGET_MAX, Math.max(X_TICK_TARGET_MIN, target));
}

/**
 * y tick target for a plot `innerHeight` pixels tall: {@link Y_TICK_TARGET_SHORT}
 * under {@link Y_TICK_SHORT_PLOT_PX}, else {@link Y_TICK_TARGET_TALL}. A
 * non-finite height returns the tall target (the pre-RM-108 default).
 */
export function tickTargetForHeight(innerHeight: number): number {
  if (!Number.isFinite(innerHeight)) {
    return Y_TICK_TARGET_TALL;
  }
  return innerHeight < Y_TICK_SHORT_PLOT_PX ? Y_TICK_TARGET_SHORT : Y_TICK_TARGET_TALL;
}

/**
 * One precedence for every axis: an explicit `numTicks` (the long-standing
 * override) wins, then a numeric `tickCount`, then `"auto"` → `autoTarget`.
 * A non-finite explicit value is ignored rather than trusted.
 */
export function resolveAxisTickTarget({
  numTicks,
  tickCount = "auto",
  autoTarget,
}: {
  numTicks?: number;
  tickCount?: AxisTickCount;
  autoTarget: number;
}): number {
  if (numTicks != null && Number.isFinite(numTicks)) {
    return numTicks;
  }
  if (typeof tickCount === "number" && Number.isFinite(tickCount)) {
    return tickCount;
  }
  return autoTarget;
}
