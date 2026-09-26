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

/**
 * The margin of the cartesian families: Line, Area, Composed, Bar, Scatter and
 * Candlestick (RM-182, review F31). They held six identical copies of it; a
 * family with a different margin (LiveLine, Parallel, …) keeps its own.
 */
export const DEFAULT_CARTESIAN_MARGIN: Readonly<Margin> = {
  top: 40,
  right: 40,
  bottom: 40,
  left: 40,
};

/**
 * A chart's `margin` prop over its family default (the `frame-size` group, ADR
 * 0042 §4): one number sets every side, an object overrides the sides it names.
 */
export function resolveChartMargin(
  margin: number | Partial<Margin> | undefined,
  fallback: Readonly<Margin>,
): Margin {
  if (typeof margin === "number") {
    return { top: margin, right: margin, bottom: margin, left: margin };
  }
  return { ...fallback, ...margin };
}
