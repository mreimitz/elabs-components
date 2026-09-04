/**
 * heatmap-scale.ts — the pure value→ink decisions behind `HeatmapChart`
 * (RM-021): how a number picks a ramp step, how a number picks a dot radius,
 * and what the chart's one-sentence summary says.
 *
 * Kept free of React and of `@visx` so each decision can be asserted directly
 * (`heatmap-scale.test.ts`) instead of being inferred from a rendered square.
 */

/** One countable step of the legend ramp. */
export interface HeatmapBucket {
  /** Inclusive lower bound. */
  from: number;
  /** Upper bound — exclusive, except on the last bucket where it is inclusive. */
  to: number;
  /** The `var(--chart-…)` reference this step paints with. */
  color: string;
}

/**
 * The value domain a heatmap's ramp is stretched across.
 *
 * `diverging` is not a cosmetic flag: a diverging ramp has a MEANINGFUL ZERO at
 * its middle step, so its domain must be symmetric (`[-m, +m]`) or the neutral
 * step stops landing on zero and the two arms stop being comparable.
 */
export function heatmapDomain(
  min: number,
  max: number,
  diverging: boolean,
): { lo: number; hi: number } {
  if (diverging) {
    const m = Math.max(Math.abs(min), Math.abs(max));
    // A dataset that is entirely zero would give a zero-width domain; 1 keeps
    // the buckets well-formed and every value still lands on the neutral step.
    const span = m === 0 ? 1 : m;
    return { lo: -span, hi: span };
  }
  return min === max
    ? { lo: min, hi: min + (min === 0 ? 1 : Math.abs(min)) }
    : { lo: min, hi: max };
}

/**
 * Cut `[lo, hi]` into equal-width buckets, one per colour.
 *
 * Equal WIDTH, not equal count (quantiles): a heatmap's legend is read as a
 * scale — "twice as dark is roughly twice as many" — and a quantile ramp
 * silently breaks that while looking identical. A skewed dataset that needs
 * quantiles needs the caller to transform the values, which is a decision the
 * caller can see, rather than a scale that lies quietly.
 */
export function buildHeatmapBuckets(
  lo: number,
  hi: number,
  colors: readonly string[],
): HeatmapBucket[] {
  const steps = colors.length;
  if (steps === 0) return [];
  const width = (hi - lo) / steps;
  return colors.map((color, i) => ({
    from: lo + width * i,
    to: i === steps - 1 ? hi : lo + width * (i + 1),
    color,
  }));
}

/**
 * Which bucket `value` falls in. Values outside `[lo, hi]` clamp to the end
 * buckets rather than dropping out — a heatmap with a hole in it reads as a
 * rendering bug, not as an outlier.
 */
export function bucketIndexOf(buckets: readonly HeatmapBucket[], value: number): number {
  if (buckets.length === 0) return -1;
  const lo = buckets[0]!.from;
  const hi = buckets[buckets.length - 1]!.to;
  if (hi === lo) return buckets.length - 1;
  const t = (value - lo) / (hi - lo);
  return Math.min(buckets.length - 1, Math.max(0, Math.floor(t * buckets.length)));
}

/**
 * Dot radius for `mode="dot"` — **area proportional to value**, which is why
 * the ratio is square-rooted before it reaches the radius. Encoding a value on
 * the RADIUS instead exaggerates it by the square: a doubled number draws a dot
 * four times the size. That is the lieflat honesty rule for area marks (`F10
 * Dot Heat`, `L4 Arc Matrix`), and RM-039 is the gate that will assert it
 * across every area-encoded mark in the package.
 *
 * The magnitude is used, so a diverging heatmap's `-40` and `+40` draw the same
 * size — sign is carried by the ramp (and by the second, non-colour channel the
 * diverging palette requires), never by the area.
 */
export function dotRadius(value: number, maxAbs: number, maxRadius: number): number {
  if (maxAbs <= 0 || maxRadius <= 0) return 0;
  const ratio = Math.min(1, Math.abs(value) / maxAbs);
  return Math.sqrt(ratio) * maxRadius;
}

/** The facts a heatmap's accessible summary is built from. */
export interface HeatmapSummaryFacts {
  rows: number;
  columns: number;
  /** The peak cell, or `null` when every cell is empty. */
  peak: { x: string; y: string; value: number } | null;
  /** True for `variant="calendar"`, where the row/column grid is days-and-weeks. */
  calendar: boolean;
}

/**
 * The default accessible name for the chart region — a sentence, because the
 * SVG body is `aria-hidden` and this is the only thing a screen reader gets
 * before it reaches the datapoint layer.
 *
 * English by construction: `@elabs-ai/components-charts` cannot add keys to the
 * `@elabs-ai/components-ui` message catalogue without a cross-package change, so
 * the localization seam is the `accessibleLabel` prop — pass one and it replaces
 * this entirely.
 */
export function heatmapSummary(
  facts: HeatmapSummaryFacts,
  formatValue: (value: number) => string,
): string {
  const grid = facts.calendar
    ? `${facts.columns} weeks × ${facts.rows} weekdays`
    : `${facts.rows} rows × ${facts.columns} columns`;
  if (!facts.peak) {
    return `Heatmap, ${grid}, no values.`;
  }
  const where = facts.calendar ? facts.peak.x : `${facts.peak.y} ${facts.peak.x}`;
  return `Heatmap, ${grid}, peak ${formatValue(facts.peak.value)} at ${where}.`;
}

// ── Continuous mode (`steps: 0`) ─────────────────────────────────────────────

/**
 * The quietest a continuous cell gets. Not 0: a cell that fades to nothing is
 * indistinguishable from a missing one, which is the misreading `QuietDot`
 * exists to prevent.
 */
export const CONTINUOUS_MIN_OPACITY = 0.12;

/** A resolved fill: which ramp colour, and how much of it. */
export interface HeatmapInk {
  color: string;
  opacity: number;
}

/**
 * Continuous ink for `steps: 0`.
 *
 * The ramp entries are `var(--chart-…)` REFERENCES, not colours — nothing here
 * can interpolate between two of them, because their values are not known until
 * the browser resolves the active theme. So a continuous scale is expressed the
 * one way that survives that: a single ramp colour at a continuously varying
 * opacity. On a diverging scale each ARM keeps its own hue, so sign is still
 * carried by colour (and, as everywhere else on a diverging heatmap, by a
 * second non-colour channel as well).
 */
export function continuousInk(
  value: number,
  lo: number,
  hi: number,
  positive: string,
  negative?: string,
): HeatmapInk {
  const ramp = (t: number) =>
    CONTINUOUS_MIN_OPACITY + (1 - CONTINUOUS_MIN_OPACITY) * Math.min(1, Math.max(0, t));
  if (negative !== undefined) {
    return {
      color: value < 0 ? negative : positive,
      opacity: ramp(hi === 0 ? 0 : Math.abs(value) / hi),
    };
  }
  return { color: positive, opacity: ramp(hi === lo ? 1 : (value - lo) / (hi - lo)) };
}

/**
 * `n` evenly-spaced samples of a continuous scale, for the legend strip. A
 * continuous scale still needs a KEY; sampling it is honest (the swatches are
 * drawn gapless so they read as a gradient, not as buckets).
 */
export function sampleContinuousInk(
  n: number,
  lo: number,
  hi: number,
  positive: string,
  negative?: string,
): HeatmapInk[] {
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) =>
    continuousInk(lo + ((hi - lo) * i) / (n - 1 || 1), lo, hi, positive, negative),
  );
}
