/**
 * Merge hover paint into base paint as MapLibre `case` expressions keyed on
 * the per-feature `hover` feature-state, so only the hovered feature changes
 * appearance.
 */
export function mergeHoverPaint<T extends Record<string, unknown>>(
  paint: T,
  hoverPaint: T | undefined,
): T {
  if (!hoverPaint) return paint;
  const merged: Record<string, unknown> = { ...paint };
  for (const [key, hoverValue] of Object.entries(hoverPaint)) {
    if (hoverValue === undefined) continue;
    const baseValue = merged[key];
    merged[key] =
      baseValue === undefined
        ? hoverValue
        : ["case", ["boolean", ["feature-state", "hover"], false], hoverValue, baseValue];
  }
  return merged as T;
}
