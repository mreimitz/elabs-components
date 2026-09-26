/**
 * chart-margin.ts — the pixel margin every chart shell resolves to (RM-173).
 *
 * Split out of `chart-context.tsx`, which also imports React and `motion`, so
 * the future `frame-size` prop group (ADR 0042 §4) can reference `Margin`
 * without pulling either into the pure definition layer. `chart-context.tsx`
 * re-exports it, so every existing import keeps working unchanged.
 */
export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// RM-183 — the radial/part-to-whole families (`PieChart`, `RingChart`,
// `FunnelChart`, `UnitChart`, `BulletChart`) adopt the shared `frame-size`
// group's `margin?: number | Partial<Margin>` shape (`charts/props/frame-size.ts`),
// which none of them had before. One tiny resolver, appended here rather than
// duplicated five times, turns that union into a full `Margin` against a
// family-supplied fallback (every one of these families' own default is "no
// extra margin" — `ZERO_MARGIN` — so an unset `margin` prop is byte-identical
// to today).
export const ZERO_MARGIN: Margin = { top: 0, right: 0, bottom: 0, left: 0 };

/** `number | Partial<Margin> | undefined` → a full `Margin`, against `fallback` (RM-183). */
export function resolveMarginBox(
  margin: number | Partial<Margin> | undefined,
  fallback: Margin = ZERO_MARGIN,
): Margin {
  if (margin === undefined) return fallback;
  if (typeof margin === "number")
    return { top: margin, right: margin, bottom: margin, left: margin };
  return {
    top: margin.top ?? fallback.top,
    right: margin.right ?? fallback.right,
    bottom: margin.bottom ?? fallback.bottom,
    left: margin.left ?? fallback.left,
  };
}
