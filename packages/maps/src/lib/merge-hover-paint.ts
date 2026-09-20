/** Per-feature paint states a layer can express through MapLibre feature-state. */
export interface FeatureStatePaint<T> {
  /** Applied to the feature under the cursor or keyboard focus. */
  hover?: T;
  /** Applied to the selected feature(s); wins over `hover`. */
  selected?: T;
}

/**
 * Merge hover/selected paint into base paint as MapLibre `case` expressions
 * keyed on per-feature feature-state, so only the affected features change
 * appearance. `selected` is tested first, so a selected feature keeps looking
 * selected while the cursor is over it.
 *
 * Only paint properties that accept feature-state belong here (`fill-color`,
 * `fill-opacity`, `line-color`, `line-width`, …). `fill-pattern` and
 * `line-dasharray` do NOT: they read feature PROPERTIES, which is why status
 * texture and selection are separate channels.
 */
export function mergeFeatureStatePaint<T extends Record<string, unknown>>(
  paint: T,
  states: FeatureStatePaint<T>,
): T {
  // Identity preserved when there is nothing to merge: callers memoize on it.
  if (!states.hover && !states.selected) return paint;

  const merged: Record<string, unknown> = { ...paint };

  // Applied hover-first so that `selected` ends up as the OUTER case.
  for (const state of ["hover", "selected"] as const) {
    const statePaint = states[state];
    if (!statePaint) continue;
    for (const [key, stateValue] of Object.entries(statePaint)) {
      if (stateValue === undefined) continue;
      const baseValue = merged[key];
      merged[key] =
        baseValue === undefined
          ? stateValue
          : ["case", ["boolean", ["feature-state", state], false], stateValue, baseValue];
    }
  }

  return merged as T;
}

/** Hover-only shorthand for {@link mergeFeatureStatePaint}. */
export function mergeHoverPaint<T extends Record<string, unknown>>(
  paint: T,
  hoverPaint: T | undefined,
): T {
  return mergeFeatureStatePaint(paint, { hover: hoverPaint });
}
