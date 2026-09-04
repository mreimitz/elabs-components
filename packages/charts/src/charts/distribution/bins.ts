/**
 * bins.ts — histogram binning, on its own (RM-026).
 *
 * Provenance: `F14 Rung Histogram` in the lieflat gallery — bins whose EDGES
 * carry business meaning ("resolved inside an hour", "resolved same day"), each
 * bar drawn as countable rungs rather than a filled block.
 *
 * Thin on purpose: `d3-array`'s `bin` already owns the half-open-interval
 * convention (`[x0, x1)`, last bin closed) and the threshold generator. What this
 * module adds is (a) a plain, serialisable return shape instead of d3's
 * `ArrayLike` bin objects, and (b) the two documented decisions below, which are
 * exactly the ones a caller gets wrong.
 *
 * ## Decision 1 — a NUMBER of bins is a hint, an ARRAY is a contract
 *
 * `bins: number` goes to d3's threshold generator, which produces *nice* round
 * edges via `d3.ticks` — so you may get 8 or 11 bins when you asked for 10. That
 * is the right default: round edges are readable, and the exact count of a
 * histogram is never the point.
 *
 * `bins: number[]` is read as the FULL, ordered list of bin EDGES (k+1 edges →
 * k bins), not as d3's interior cut points. It is the form you reach for when
 * the edges MEAN something, and in that case the ends mean something too — an
 * edge list that silently grew an extra open-ended bucket at each end would
 * defeat the whole reason for passing one.
 *
 * ## Decision 2 — a value outside an explicit edge list is DROPPED, loudly
 *
 * With explicit edges the domain is the edge list itself, so anything outside it
 * belongs to no bin. Nothing here clamps it into the end bins: a "resolved
 * within 24 h" bucket that quietly absorbed a 6-day ticket would be a lie told
 * by the axis. Instead the value is dropped and a dev-only warning names the
 * count, so the caller either widens the edges or filters deliberately. This is
 * what "edges must be meaningful" means in practice.
 */
import { bin as d3bin } from "d3-array";

/** One histogram bucket: the half-open interval `[x0, x1)` and what fell in it. */
export interface DistributionBin {
  /** Inclusive lower edge. */
  x0: number;
  /** Exclusive upper edge — inclusive on the LAST bin, per d3's convention. */
  x1: number;
  /** How many values landed here. */
  count: number;
  /** The values themselves, ascending — the tooltip and the a11y summary read these. */
  values: number[];
}

/** Options for {@link binValues}. */
export interface BinValuesOptions {
  /**
   * A bin COUNT hint (nice edges, approximate count) or the FULL ordered edge
   * list. See the module doc for why the two are read differently.
   * Default: `Math.ceil(Math.sqrt(n))`, capped at 30 — the square-root rule,
   * which stays readable from a handful of records up to a few thousand.
   */
  bins?: number | readonly number[];
  /**
   * The value domain to bin over. Pass the SHARED domain when several groups are
   * binned side by side, so every group gets identical edges — comparing two
   * histograms with different edges compares nothing. Ignored when `bins` is an
   * edge list (the edges ARE the domain).
   */
  domain?: readonly [number, number];
  /** Label used in the dropped-value dev warning. */
  label?: string;
}

/** The default bin-count rule, exported so a caller can reproduce it. */
export function defaultBinCount(n: number): number {
  return Math.min(30, Math.max(1, Math.ceil(Math.sqrt(n))));
}

/** Messages already warned about, so a re-rendering chart does not re-log every frame. */
const warnedDropMessages = new Set<string>();

function warnDroppedOnce(message: string): void {
  if (process.env.NODE_ENV === "production") return;
  if (warnedDropMessages.has(message)) return;
  warnedDropMessages.add(message);
  console.warn(message);
}

/**
 * Bin `values` into `[x0, x1)` buckets.
 *
 * @returns the buckets in ascending edge order. An empty input yields `[]` — a
 *   histogram of nothing is nothing, never a row of zero-height bars.
 */
export function binValues(
  values: Iterable<number>,
  options: BinValuesOptions = {},
): DistributionBin[] {
  const finite: number[] = [];
  for (const value of values) {
    if (Number.isFinite(value)) finite.push(value);
  }
  if (finite.length === 0) return [];

  const explicitEdges = Array.isArray(options.bins) ? [...(options.bins as number[])] : undefined;

  if (explicitEdges) {
    if (explicitEdges.length < 2) return [];
    explicitEdges.sort((a, b) => a - b);
    const lo = explicitEdges[0] as number;
    const hi = explicitEdges.at(-1) as number;
    const dropped = finite.filter((value) => value < lo || value > hi).length;
    if (dropped > 0) {
      warnDroppedOnce(
        `[brand-ui/charts] DistributionChart: ${dropped} value(s)${
          options.label ? ` in "${options.label}"` : ""
        } fall outside the explicit bin edges [${lo}, ${hi}] and were dropped. ` +
          "Explicit edges are read as the full domain — widen them, or filter the data before " +
          "passing it, rather than letting an end bucket absorb values it does not describe.",
      );
    }
    const binner = d3bin<number, number>().domain([lo, hi]).thresholds(explicitEdges.slice(1, -1));
    return toDistributionBins(binner(finite), lo, hi);
  }

  const count =
    typeof options.bins === "number" && Number.isFinite(options.bins) && options.bins >= 1
      ? Math.floor(options.bins)
      : defaultBinCount(finite.length);

  const domain = options.domain ?? extentOf(finite);
  const binner = d3bin<number, number>().domain([domain[0], domain[1]]).thresholds(count);
  return toDistributionBins(binner(finite), domain[0], domain[1]);
}

/** Min/max of a non-empty finite array, widened when every value is identical. */
export function extentOf(values: readonly number[]): [number, number] {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value < lo) lo = value;
    if (value > hi) hi = value;
  }
  if (!(Number.isFinite(lo) && Number.isFinite(hi))) return [0, 1];
  // A single repeated value has no extent; a zero-width scale would divide by
  // zero downstream, so give it a unit-wide box centred on the value.
  if (lo === hi) return [lo - 0.5, hi + 0.5];
  return [lo, hi];
}

function toDistributionBins(
  raw: ReadonlyArray<ArrayLike<number> & { x0?: number; x1?: number }>,
  lo: number,
  hi: number,
): DistributionBin[] {
  return raw.map((entry, index) => {
    const values = Array.from(entry as ArrayLike<number>).sort((a, b) => a - b);
    return {
      x0: entry.x0 ?? (index === 0 ? lo : hi),
      x1: entry.x1 ?? hi,
      count: values.length,
      values,
    };
  });
}
