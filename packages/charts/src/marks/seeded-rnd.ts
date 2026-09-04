/**
 * seededRnd — the ONLY randomness allowed anywhere in `@elabs-ai/components-charts`.
 *
 * Provenance: the `rnd(i, k)` helper every jittered card in the lieflat gallery
 * shares (`templates/lupi-gallery.html` — `L9 Bubble Almanac`, `L4 Thread Ledger`,
 * `F1 Rung Bars`). It is a spatial hash, not a generator: the same `(i, k)` pair
 * yields the same number on every call, in every process, forever.
 *
 * WHY IT IS A RULE AND NOT A CONVENIENCE. Editorial marks jitter their width,
 * opacity and offset so a stack of countable units reads as drawn rather than
 * printed. `Math.random()` would do that too — and would make every chart a
 * different picture on every render, so a Storybook snapshot, a visual-regression
 * shot and a play-function assertion could never agree with each other. Handing
 * the jitter a seed instead makes the drawing reproducible AND still irregular.
 *
 * Therefore: **`Math.random` must not appear anywhere under
 * `packages/charts/src/marks/`.** Reach for `seededRnd` — pass the mark's index
 * as `i` and a per-stack constant as `k`, and vary `k` (not `i`) when one mark
 * needs two independent-looking values.
 *
 * ```ts
 * const width   = 0.6 + 0.8 * seededRnd(i, seed);
 * const opacity = 0.7 + 0.3 * seededRnd(i, seed + 1); // a second, decorrelated draw
 * ```
 */

/** The two large primes of the lieflat hash — kept named so the constant is auditable. */
const HASH_A = 73_856_093;
const HASH_B = 19_349_663;

/**
 * A deterministic pseudo-random number in `[0, 1)` for the pair `(i, k)`.
 *
 * Exact lieflat hash: `|((i * 73856093) ^ (k * 19349663)) % 1000| / 1000`. The
 * `Math.abs` is load-bearing — JavaScript's `^` yields a SIGNED 32-bit integer, so
 * without it roughly half of all `(i, k)` pairs return a negative number and a
 * "jitter" that was meant to widen a stroke would invert it.
 *
 * Resolution is deliberately 1/1000 (the hash's own `% 1000`): these values drive
 * sub-pixel stroke widths and opacities, where a thousand steps is already finer
 * than anything a screen can show.
 *
 * @param i the mark's index within its stack
 * @param k the stack's seed — vary this for a second, decorrelated draw on the same `i`
 * @returns a value in `[0, 1)`, stable across calls, processes and test runs
 */
export function seededRnd(i: number, k: number): number {
  return Math.abs(((i * HASH_A) ^ (k * HASH_B)) % 1000) / 1000;
}
