/**
 * Editorial marks — the low-level drawing vocabulary shared by every "editorial"
 * chart in `@elabs-ai/components-charts` (RM-017).
 *
 * These are not charts and not containers. Each one is a bare SVG element or a
 * `<g>` with no provider, no context and no measurement, so it composes inside
 * ANY existing chart's `children` — or inside a hand-written `<svg>` — exactly
 * where its coordinates put it.
 *
 * ## Why the layer exists
 *
 * The lieflat gallery re-implements the same ten marks inline in 63 templates,
 * which is why they have quietly drifted apart there: three dash rhythms that
 * were meant to be one, four halo widths, two different jitter hashes. Six new
 * chart containers and five enhancements in this roadmap each need three or more
 * of these marks; without a shared layer that drift would be reproduced eleven
 * times here on day one. Every export below carries its lieflat provenance in
 * its docblock so the origin survives the copy.
 *
 * ## The rules that hold across all ten
 *
 * - **Semantic tokens only** — `--chart-foreground`, `--chart-foreground-muted`,
 *   `--chart-grid`, `--chart-background`. No literal colour appears in this
 *   directory, which is what makes a halo dark on a dark card for free.
 * - **`seededRnd` is the only randomness.** `Math.random` must not appear under
 *   `packages/charts/src/marks/` — see `seeded-rnd.ts` for why.
 * - **Decorative by default.** The chart body is `aria-hidden`; a mark never
 *   carries the only copy of a fact. Say it in the caption, the summary or the
 *   data table too.
 */

export { DrawPath, type DrawPathProps } from "./draw-path";
export { HairlineFloor, type HairlineFloorProps, type HairlineScale } from "./hairline-floor";
export { HaloText, type HaloTextProps } from "./halo-text";
export {
  Leader,
  type LeaderDash,
  type LeaderKind,
  type LeaderPoint,
  type LeaderProps,
  leaderPath,
} from "./leader";
export { Marginalia, type MarginaliaProps } from "./marginalia";
export { PeakRing, type PeakRingProps, type PeakRingShape } from "./peak-ring";
export { QUIET_DOT_SIZE, QuietDot, type QuietDotProps } from "./quiet-dot";
export { seededRnd } from "./seeded-rnd";
export { CHART_STAGGER_BAR_MS, CHART_STAGGER_DOT_MS, stagger } from "./stagger";
export {
  UnitStack,
  type UnitStackDirection,
  type UnitStackKind,
  type UnitStackProps,
} from "./unit-stack";
