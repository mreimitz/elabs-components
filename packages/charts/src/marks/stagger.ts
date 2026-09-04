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
 * below are quoted in ms because that is the unit of the tokens they will become.
 *
 * ## Why the steps are constants today
 *
 * RM-020 introduces `--chart-stagger-dot: 12ms` and `--chart-stagger-bar: 100ms`
 * as real theme tokens, at which point this module reads them instead. Until that
 * lands the two exported constants ARE the contract — they carry the same values,
 * so the swap is a change of source, not of behaviour. Do not fork a third
 * literal into a chart in the meantime.
 */

/**
 * Per-dot stagger step, in milliseconds (RM-020 token: `--chart-stagger-dot`).
 * Dots are small and numerous — the gap has to stay under the ~15 ms at which a
 * sequence stops reading as one gesture and starts reading as a queue.
 */
export const CHART_STAGGER_DOT_MS = 12;

/**
 * Per-bar stagger step, in milliseconds (RM-020 token: `--chart-stagger-bar`).
 * Bars are large and few, so they can afford — and need — an order of magnitude
 * more room between them than a dot.
 */
export const CHART_STAGGER_BAR_MS = 100;

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
 * @param step the per-mark increment in ms (default {@link CHART_STAGGER_DOT_MS})
 * @returns the delay in seconds, ready for a `motion` transition
 */
export function stagger(i: number, base = 0, step: number = CHART_STAGGER_DOT_MS): number {
  return (base + Math.max(0, i) * step) / 1000;
}
