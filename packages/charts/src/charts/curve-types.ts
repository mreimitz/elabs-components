import type { curveLinear } from "@visx/curve";

/**
 * The d3/visx curve-factory shape accepted by `@visx/shape`'s `curve` prop.
 *
 * Derived from `@visx/curve`'s own exports so it tracks the vendored d3-shape
 * types instead of being re-declared (previously five files each carried a local
 * `type CurveFactory = any` — issue #185).
 */
export type CurveFactory = typeof curveLinear;
