import {
  curveLinear,
  curveMonotoneX,
  curveNatural,
  curveStep,
  curveStepAfter,
  curveStepBefore,
} from "@visx/curve";

/**
 * The d3/visx curve-factory shape accepted by `@visx/shape`'s `curve` prop.
 *
 * Derived from `@visx/curve`'s own exports so it tracks the vendored d3-shape
 * types instead of being re-declared (previously five files each carried a local
 * `type CurveFactory = any` — issue #185).
 */
export type CurveFactory = typeof curveLinear;

/**
 * Named curve aliases (RM-112) — the Datawrapper-parity vocabulary
 * (`dw-charts.md` §2.10: "interpolation linear / curved / steps before /
 * after / middle") mapped onto the underlying d3-shape factory. Accepted
 * alongside a raw `CurveFactory` so an existing `curve={someD3Factory}` caller
 * is unaffected — `resolveCurve` passes a non-string value through untouched.
 *
 * `"natural"` is `curveNatural` — the blog's own "avoid natural/cardinal
 * interpolation, it overshoots" warning still applies; it is offered for
 * parity, not as the default (see `resolveCurve`'s callers).
 */
export type CurveAlias = "linear" | "monotone" | "natural" | "step" | "step-before" | "step-after";

const CURVE_ALIASES: Record<CurveAlias, CurveFactory> = {
  linear: curveLinear,
  monotone: curveMonotoneX,
  natural: curveNatural,
  step: curveStep,
  "step-before": curveStepBefore,
  "step-after": curveStepAfter,
};

/**
 * Resolve a `Line`/`Area` `curve` prop — a named alias or a raw d3/visx
 * `CurveFactory` — into the factory `@visx/shape` actually wants. A factory
 * (function) passes straight through so `curve={curveCatmullRom}` (or any
 * other `@visx/curve` export not in {@link CurveAlias}) keeps working
 * unchanged.
 */
export function resolveCurve(curve: CurveFactory | CurveAlias): CurveFactory {
  return typeof curve === "string" ? CURVE_ALIASES[curve] : curve;
}
