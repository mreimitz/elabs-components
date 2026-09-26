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
