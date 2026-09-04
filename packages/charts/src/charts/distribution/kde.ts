/**
 * kde.ts — the violin's arithmetic: a gaussian kernel density estimate on a
 * fixed 44-point grid (RM-026).
 *
 * Provenance: `G19 Violin` in the lieflat gallery — a mirrored density silhouette
 * sampled at 44 points, tapered 1.6 bandwidths past the data on each side, with a
 * paper median tick cut through the waist.
 *
 * ## Why 44 points, and why that is a constant rather than a prop
 *
 * A violin is a SHAPE, not a series: nobody reads a value off it. Its grid needs
 * to be fine enough that the silhouette reads as a curve and coarse enough that
 * the smoothing in `blob-path.ts` still rounds it — around 40 samples is where
 * both hold, and the lieflat card fixed it at 44. Exposing it as a prop would
 * invite "more points = more accurate", which is false here: the bandwidth, not
 * the grid, decides how much structure the estimate shows.
 *
 * ## Why the domain is tapered by 1.6 bandwidths
 *
 * Cutting the grid at the data's own min/max chops the kernel mass that sits
 * beyond the extreme observations, so the silhouette ends in two flat vertical
 * walls — it reads as a bar, not a distribution. 1.6 h of taper carries the
 * density down to about 5% of a boundary point's peak, which is visually zero,
 * while leaving less than a percent of the total mass outside the grid (see
 * {@link integrateDensity} and the `kde.test.ts` "integrates to 1" assertion).
 *
 * **The measured limit of that claim, stated rather than implied:** the grid
 * holds ≥ 99% of the mass whenever the bandwidth is proportionate to the
 * structure in the data. When it is NOT — a bimodal sample whose pooled spread
 * drives Silverman to a bandwidth wider than either cluster — most observations
 * sit within 2 h of an END of the grid and their tails fall off it. Two clusters
 * six units wide and sixty apart integrate to **0.980**, and passing a bandwidth
 * of 2 returns them to 0.997. `kde.test.ts` pins both numbers. This is the same
 * over-smoothing the bandwidth note below warns about, seen from the other side:
 * it is a reason to pass `bandwidth`, not a defect in the taper.
 *
 * ## Bandwidth
 *
 * Default is Silverman's rule of thumb, `0.9 · min(σ, IQR/1.34) · n^(-1/5)` —
 * the robust form, so one far outlier widens the bandwidth through σ but not
 * through the IQR term. It is a RULE OF THUMB and is documented as one: it
 * over-smooths genuinely bimodal data, which is exactly when a caller should
 * pass `bandwidth` by hand.
 */
import { quantileSorted, sortedFinite } from "./five-number";

/** The violin's fixed sample count. See the module doc for why it is not a prop. */
export const KDE_GRID_POINTS = 44;

/** How many bandwidths past the data the grid runs, on each side. */
export const KDE_TAPER = 1.6;

/** The IQR → σ conversion factor for a normal distribution (`Φ⁻¹(0.75) · 2`). */
const IQR_TO_SIGMA = 1.34;

/** One sample of the estimated density. */
export interface KdePoint {
  /** Position on the value axis. */
  value: number;
  /** Estimated probability density at {@link value} — NOT a probability. */
  density: number;
}

/** The standard normal pdf, the kernel this module convolves with. */
export function gaussianKernel(u: number): number {
  return Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
}

/**
 * Silverman's rule-of-thumb bandwidth for `values` (robust form).
 *
 * @returns a strictly positive bandwidth. Degenerate input (fewer than two
 *   finite values, or every value identical) has no spread to estimate, so the
 *   result falls back to a small positive number rather than `0` — a zero
 *   bandwidth would make every kernel a spike and the violin an invisible line.
 */
export function silvermanBandwidth(values: Iterable<number>): number {
  const sorted = sortedFinite(values);
  const n = sorted.length;
  if (n === 0) return 1;
  if (n === 1) return Math.max(Math.abs(sorted[0] as number) * 0.01, 1e-6);

  let sum = 0;
  for (const value of sorted) sum += value;
  const mean = sum / n;
  let sq = 0;
  for (const value of sorted) sq += (value - mean) ** 2;
  // Sample standard deviation (n − 1): the estimate, not the population figure.
  const sigma = Math.sqrt(sq / Math.max(1, n - 1));
  const iqr = quantileSorted(sorted, 0.75) - quantileSorted(sorted, 0.25);

  const candidates = [sigma, iqr / IQR_TO_SIGMA].filter((candidate) => candidate > 0);
  if (candidates.length === 0) {
    const span = (sorted.at(-1) as number) - (sorted[0] as number);
    return Math.max(span, Math.abs(sorted[0] as number) * 0.01, 1e-6);
  }
  return 0.9 * Math.min(...candidates) * n ** (-1 / 5);
}

/** The estimated density of `values` at one position. */
export function kdeDensityAt(values: readonly number[], at: number, bandwidth: number): number {
  const n = values.length;
  if (n === 0 || !(bandwidth > 0)) return 0;
  let total = 0;
  for (const value of values) {
    total += gaussianKernel((at - value) / bandwidth);
  }
  return total / (n * bandwidth);
}

/** Options for {@link kde}. */
export interface KdeOptions {
  /** Override the bandwidth. Default: {@link silvermanBandwidth}. */
  bandwidth?: number;
  /** Sample count. Default {@link KDE_GRID_POINTS}; changing it is rarely right. */
  gridPoints?: number;
  /**
   * The value domain to sample over — pass the SHARED domain when several
   * violins sit on one axis, so they are drawn on the same scale. The taper is
   * applied to the data's own extent when this is omitted, and NOT applied when
   * it is given (a shared domain is already the caller's decision about where
   * the axis ends).
   */
  domain?: readonly [number, number];
  /** Taper, in bandwidths, when `domain` is omitted. Default {@link KDE_TAPER}. */
  taper?: number;
}

/** The estimate itself: the sampled curve plus the numbers it was drawn from. */
export interface KdeResult {
  /** `gridPoints` samples, ascending by `value`. */
  points: KdePoint[];
  /** The bandwidth actually used (resolved from Silverman when not supplied). */
  bandwidth: number;
  /** The largest density on the grid — what a violin's half-width is scaled by. */
  peak: number;
}

/**
 * Estimate the density of `values` on an evenly spaced grid.
 *
 * @returns an EMPTY result for empty input. A violin of no data is nothing;
 *   there is no zero-height silhouette to draw.
 */
export function kde(values: Iterable<number>, options: KdeOptions = {}): KdeResult {
  const finite = sortedFinite(values);
  if (finite.length === 0) return { points: [], bandwidth: 0, peak: 0 };

  const bandwidth =
    options.bandwidth !== undefined && options.bandwidth > 0
      ? options.bandwidth
      : silvermanBandwidth(finite);
  const gridPoints = Math.max(2, Math.floor(options.gridPoints ?? KDE_GRID_POINTS));
  const taper = options.taper ?? KDE_TAPER;

  const [lo, hi] = options.domain
    ? [options.domain[0], options.domain[1]]
    : [(finite[0] as number) - taper * bandwidth, (finite.at(-1) as number) + taper * bandwidth];
  const step = (hi - lo) / (gridPoints - 1);

  const points: KdePoint[] = [];
  let peak = 0;
  for (let index = 0; index < gridPoints; index += 1) {
    const value = lo + index * step;
    const density = kdeDensityAt(finite, value, bandwidth);
    if (density > peak) peak = density;
    points.push({ value, density });
  }
  return { points, bandwidth, peak };
}

/**
 * Trapezoidal integral of a sampled density — a density that does not integrate
 * to ~1 has a bug in it, so this is the estimate's own self-check and is used by
 * `kde.test.ts` rather than only by eye.
 */
export function integrateDensity(points: readonly KdePoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1] as KdePoint;
    const current = points[index] as KdePoint;
    total += ((previous.density + current.density) / 2) * (current.value - previous.value);
  }
  return total;
}
