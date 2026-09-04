/**
 * areaRadius — the shared "value → radius" conversion for every AREA encoding
 * in `@elabs-ai/components-charts` (RM-039, #265).
 *
 * Provenance: lieflat's honesty rule #2 — every area encoding scales by
 * `sqrt(v)`, never `v` itself
 * (`docs/review/2026-09-04-lieflat-charts-gap-analysis.md` §5 C5; lieflat
 * `SKILL.md` §2 "数据", §7, §8).
 *
 * ## Why sqrt, not a linear ratio
 *
 * A reader compares a bubble/dot/cluster by its AREA, not its radius — that is
 * how the eye reads a filled circle. A RADIUS that scales linearly with the
 * value (`r = rMax * (v / max)`) therefore lies: doubling the value doubles
 * the radius, which quadruples the AREA (`π·r²`), so the mark reads roughly
 * four times as important as it should. Scaling the radius by `sqrt(v / max)`
 * instead keeps the AREA proportional to the value — a doubled value draws a
 * dot `√2` (~1.41×) wider, never twice as wide — which is the truthful
 * picture. `packages/charts/src/charts/heatmap/heatmap-chart.stories.tsx`'s
 * `DotHeat` story states this in its own docblock: "the value is the dot's
 * AREA, not its radius".
 *
 * ## Existing call sites already do this by hand
 *
 * `pie-chart.tsx` (`radiusKey`), `unit-layouts.ts` (the `field` layout's
 * cluster radius) and `network/network-layout.ts` (node radius from weight)
 * each hand-roll the identical `Math.sqrt(value / max)` shape today. This
 * helper is the shared, testable primitive a NEW area encoding should reach
 * for instead of re-deriving it — wiring the three existing call sites onto
 * it is a separate, container-scoped change (out of this item's `touches`).
 */

/**
 * `rMax * sqrt(max(value, 0) / max)` — the radius that makes a filled
 * circle's AREA proportional to `value`.
 *
 * @param value the data value this mark represents. Negative values clamp to
 *   0 (an area encoding has no honest way to draw a negative size).
 * @param max the largest value in the series (the mark that should draw at
 *   `rMax`). `max <= 0` (no data, or every value is non-positive) returns 0
 *   for every mark rather than dividing by zero.
 * @param rMax the radius, in px, the largest mark in the series draws at.
 *   `rMax <= 0` returns 0.
 * @returns a radius in `[0, rMax]`.
 */
export function areaRadius(value: number, max: number, rMax: number): number {
  if (!(max > 0) || !(rMax > 0)) {
    return 0;
  }
  const ratio = Math.max(value, 0) / max;
  return rMax * Math.sqrt(ratio);
}
