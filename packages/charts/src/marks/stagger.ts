/**
 * stagger — per-mark animation delay, in SECONDS.
 *
 * Provenance: the `animation-delay: calc(var(--i) * 12ms)` idiom every drawn-in
 * lieflat card uses (`L9 Bubble Almanac` dots, `F1 Rung Bars` bars). A chart whose
 * marks all appear on the same frame reads as a state change; one whose marks
 * arrive a few milliseconds apart reads as being drawn.
 *
 * ## Why seconds
 *
 * The consumer is `motion`, whose `transition.delay` is in seconds — so the unit
 * conversion lives here, once, rather than at every call site. The two BASE STEPS
 * below are quoted in ms because that is the unit of the tokens they alias.
 *
 * ## One rhythm, one home (#174)
 *
 * RM-020 introduced `--t-chart-stagger-dot: 12ms` / `--t-chart-stagger-bar: 100ms`
 * as real `:root` timing tokens, read SSR-safely by `getChartStaggerDotMs`/
 * `getChartStaggerBarMs` in `../charts/animation.ts` — that module is the single
 * source of truth for the rhythm (it lives beside the token readers). The two
 * constants below are re-exports of `../charts/animation`'s `DEFAULT_CHART_STAGGER_*`
 * pair, kept under their historical names so existing literal-step callers
 * (`stagger(i, 0, CHART_STAGGER_BAR_MS)` in `tree-chart.tsx` /
 * `parallel-coordinates-chart.tsx` / `marks.stories.tsx`) do not change. Do not
 * re-declare a third literal here or anywhere else — import from `../charts/animation`.
 *
 * The `--t-chart-*` (not `--chart-*`) prefix on the CSS custom properties is
 * deliberate: `--chart-*` is a real PER-THEME colour namespace
 * (`--chart-1`…`--chart-12`, `--chart-background`, …), so an unprefixed
 * `--chart-stagger-dot` would have to be redeclared in every theme block to pass
 * the `theme-parity` gate even though it is `:root`-only timing machinery, like
 * `--t-fast`/`--t-base`. Do not "fix" it back to `--chart-stagger-*`.
 */

import {
  DEFAULT_CHART_STAGGER_BAR_MS,
  DEFAULT_CHART_STAGGER_DOT_MS,
  getChartStaggerDotMs,
} from "../charts/animation";

/**
 * Per-dot stagger step, in milliseconds (`--t-chart-stagger-dot`).
 * Dots are small and numerous — the gap has to stay under the ~15 ms at which a
 * sequence stops reading as one gesture and starts reading as a queue.
 */
export const CHART_STAGGER_DOT_MS = DEFAULT_CHART_STAGGER_DOT_MS;

/**
 * Per-bar stagger step, in milliseconds (`--t-chart-stagger-bar`).
 * Bars are large and few, so they can afford — and need — an order of magnitude
 * more room between them than a dot.
 */
export const CHART_STAGGER_BAR_MS = DEFAULT_CHART_STAGGER_BAR_MS;

/**
 * The delay for the `i`-th mark of a staggered group, in SECONDS.
 *
 * ```ts
 * transition={{ delay: stagger(i, 0, CHART_STAGGER_BAR_MS) }}
 * ```
 *
 * A negative index is clamped to 0 — a mark can be late, never early, and a
 * negative `motion` delay silently starts the animation mid-flight.
 *
 * @param i    the mark's index within its group
 * @param base the group's own offset in ms (default 0) — use it to sequence one
 *             group after another without re-basing every index
 * @param step the per-mark increment in ms. Omit it to read the live
 *             `--t-chart-stagger-dot` token off the document root (SSR-safe,
 *             falls back to {@link CHART_STAGGER_DOT_MS}) — so a theme/consumer
 *             retune of the token reaches every caller that doesn't pass an
 *             explicit step. Pass one explicitly (e.g.
 *             {@link CHART_STAGGER_BAR_MS}) to opt out of the token read.
 * @returns the delay in seconds, ready for a `motion` transition
 */
export function stagger(i: number, base = 0, step?: number): number {
  const resolvedStep = step ?? getChartStaggerDotMs();
  return (base + Math.max(0, i) * resolvedStep) / 1000;
}
