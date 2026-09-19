/**
 * color-scale.ts — `colorScaleFor(values, spec)`: the one value → colour
 * decision behind every thematic encoding (RM-124). A choropleth fill
 * (`charts`), a DataTable heatmap cell (`data`) and a map symbol or legend ramp
 * (`maps`) all ask the same question, and those three packages depend on `ui`
 * but never on each other — so the answer lives here, once.
 *
 * Pure: no React, no DOM. It returns data a renderer paints.
 *
 * ## Colours are token REFERENCES
 *
 * Every colour this module hands back is a `var(--chart-…)` reference — the
 * `--chart-seq-*` ramp, the `--chart-div-*` ramp or the `--chart-1…12`
 * categorical set — never a literal. The result re-colours on a theme flip with
 * no re-render, and the on-mark ink seam (`charts`' `on-mark-ink.ts`) can
 * resolve every step it paints.
 *
 * The price: nothing here can MIX two steps, because their values are unknown
 * until the browser resolves the active theme. So:
 *
 * - a **continuous** scale snaps each value to the nearest ramp step (7
 *   sequential, 5 diverging). {@link ColorScale.positionOf} gives the exact,
 *   unsnapped ramp position (a legend marker) and {@link ColorScale.stops} the
 *   value at which each step is exact (a gradient's colour stops);
 * - a **stepped** scale with more steps than its ramp has tokens repeats tokens,
 *   exactly as `RampLegend` and `resolvePalette` do. Ask for at most 7
 *   sequential or 5 diverging steps when every step must look different.
 *
 * ## Step membership
 *
 * A step is `(from, to]`: the upper bound is inclusive and the first step also
 * includes its `from`. Jenks breaks are class UPPER bounds, so a published
 * break list reads straight across. Values outside the domain clamp into the
 * end steps, the way a map never shows a hole for an outlier.
 */

/** A smooth ramp, or countable classes. */
export type ColorScaleType = "continuous" | "stepped";

/**
 * Where a continuous ramp's stops sit. `linear` spreads them evenly from min
 * to max; `median`, `quartiles`, `quintiles` and `deciles` pin them to those
 * quantiles of the data; `natural` pins them to the Jenks breaks.
 */
export type ContinuousColorScaleMethod =
  | "linear"
  | "median"
  | "quartiles"
  | "quintiles"
  | "deciles"
  | "natural";

/**
 * How a stepped scale cuts its classes. `equidistant` makes equal widths;
 * `rounded` makes equal widths whose inner breaks round to the step's leading
 * power of ten; `quantile` makes equal counts; `jenks` minimises the variance
 * inside each class; `custom` uses {@link SteppedColorScaleSpec.breaks}.
 */
export type SteppedColorScaleMethod = "equidistant" | "rounded" | "quantile" | "jenks" | "custom";

export type ColorScaleMethod = ContinuousColorScaleMethod | SteppedColorScaleMethod;

/**
 * Which token set paints the scale. `sequential` answers "how much",
 * `diverging` answers "how far from the centre, and on which side", and
 * `categorical` gives each distinct value its own colour.
 */
export type ColorScalePalette = "sequential" | "diverging" | "categorical";

/** `[min, max]`, or `[min, center, max]` to pin the ramp's middle colour. */
export type ColorScaleDomain =
  | readonly [min: number, max: number]
  | readonly [min: number, center: number, max: number];

interface ColorScaleSpecBase {
  /**
   * Fixed ends instead of the data's own min / max, so two maps share one
   * scale. A middle entry is the CENTRE: the value that paints the ramp's
   * middle colour.
   */
  domain?: ColorScaleDomain;
  /**
   * Default: `"diverging"` when `domain` has a centre, else `"sequential"`. A
   * diverging scale without a centre centres on 0 when the domain spans 0, and
   * on the domain's midpoint otherwise.
   */
  palette?: ColorScalePalette;
}

export interface ContinuousColorScaleSpec extends ColorScaleSpecBase {
  type: "continuous";
  /** Default `"linear"`. */
  method?: ContinuousColorScaleMethod;
  /** `method: "natural"` only: how many Jenks classes place the stops. Default 5. */
  steps?: number;
}

export interface SteppedColorScaleSpec extends ColorScaleSpecBase {
  type: "stepped";
  /** Default `"equidistant"`. */
  method?: SteppedColorScaleMethod;
  /**
   * How many classes. Default 5. Ignored by `custom`. `quantile` and `jenks`
   * can return fewer when the data has fewer distinct values.
   */
  steps?: number;
  /**
   * `method: "custom"` only: the inner thresholds, ascending. The scale's ends
   * widen to include them, so the same breaks give the same colours on every
   * dataset.
   */
  breaks?: readonly number[];
}

/** What to build. The feature / column the values come from is the caller's business. */
export type ColorScaleSpec = ContinuousColorScaleSpec | SteppedColorScaleSpec;

/**
 * One input value. Numeric scales read finite numbers only; categorical scales
 * read non-empty strings and finite numbers. Everything else is "no data".
 */
export type ColorScaleValue = number | string | null | undefined;

/** One class of the scale, low → high. See the module docblock for membership. */
export interface ColorScaleStep {
  from: number;
  to: number;
  /** A `var(--chart-…)` reference. */
  color: string;
}

/** The value at which one ramp token is exact: a gradient's colour stop. */
export interface ColorScaleStop {
  value: number;
  /** A `var(--chart-…)` reference. */
  color: string;
}

/** One category of a categorical scale, in first-seen order. */
export interface ColorScaleCategory {
  value: string | number;
  /** A `var(--chart-…)` reference. */
  color: string;
}

/** The resolved scale. Every colour in it is a `var(--chart-…)` reference. */
export interface ColorScale {
  type: ColorScaleType;
  /** The method actually used (a data-driven method with no data falls back to linear / equidistant). */
  method: ColorScaleMethod;
  palette: ColorScalePalette;
  /** The resolved `[lo, hi]`; `null` for a categorical scale or when there is nothing to scale. */
  domain: readonly [number, number] | null;
  /** The value that paints the ramp's middle colour, or `null` when none applies. */
  center: number | null;
  /**
   * The classes a value can land in, low → high. Continuous: one per ramp
   * token (the value band that snaps to it). Categorical: empty.
   */
  steps: readonly ColorScaleStep[];
  /** Continuous only: one per ramp token. Stepped and categorical: empty. */
  stops: readonly ColorScaleStop[];
  /** Categorical only: one per distinct value. Otherwise empty. */
  categories: readonly ColorScaleCategory[];
  /** The colour for a value, or `null` for no data (and for an unseen category). */
  colorOf(value: ColorScaleValue): string | null;
  /** The index into `steps` (or `categories`) a value lands in; `-1` for no data. */
  indexOf(value: ColorScaleValue): number;
  /**
   * Where a value sits on a key whose tokens (continuous) or swatches (stepped)
   * are drawn evenly: `0` = the start of the strip, `1` = the end. `null` for
   * no data and for categorical scales.
   */
  positionOf(value: ColorScaleValue): number | null;
}

/** `--chart-seq-1` (quietest) … `--chart-seq-7` (boldest), in every theme. */
const SEQUENTIAL_RAMP = [
  "var(--chart-seq-1)",
  "var(--chart-seq-2)",
  "var(--chart-seq-3)",
  "var(--chart-seq-4)",
  "var(--chart-seq-5)",
  "var(--chart-seq-6)",
  "var(--chart-seq-7)",
] as const;

/** Far-negative → neutral → far-positive. */
const DIVERGING_RAMP = [
  "var(--chart-div-neg-2)",
  "var(--chart-div-neg-1)",
  "var(--chart-div-mid)",
  "var(--chart-div-pos-1)",
  "var(--chart-div-pos-2)",
] as const;

/** The twelve series colours. Past twelve categories they repeat. */
const CATEGORICAL_SET = Array.from({ length: 12 }, (_, i) => `var(--chart-${i + 1})`);

const DEFAULT_STEPS = 5;

const CONTINUOUS_METHODS: ReadonlySet<string> = new Set<ContinuousColorScaleMethod>([
  "linear",
  "median",
  "quartiles",
  "quintiles",
  "deciles",
  "natural",
]);

const STEPPED_METHODS: ReadonlySet<string> = new Set<SteppedColorScaleMethod>([
  "equidistant",
  "rounded",
  "quantile",
  "jenks",
  "custom",
]);

/** How many equal-count intervals each quantile-based continuous method cuts the data into. */
const QUANTILE_STOPS: Partial<Record<ContinuousColorScaleMethod, number>> = {
  median: 2,
  quartiles: 4,
  quintiles: 5,
  deciles: 10,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function stepCount(steps: number | undefined, fallback: number): number {
  return isFiniteNumber(steps) && steps >= 1 ? Math.floor(steps) : fallback;
}

/**
 * `n` entries spread evenly across `ramp`, INCLUDING both ends, so two scales
 * with different step counts still start quiet and end bold. `n === 1` is the
 * boldest step: one class means "the value", and a lone pale fill reads as no
 * data. Past the ramp's length, entries repeat (see the module docblock).
 */
function spread(ramp: readonly string[], n: number): string[] {
  if (n <= 0) return [];
  const last = ramp.length - 1;
  if (n === 1) return [ramp[last] as string];
  return Array.from({ length: n }, (_, i) => ramp[Math.round((i * last) / (n - 1))] as string);
}

/** The `p`-quantile of an ascending array, linearly interpolated (R type 7, as d3). */
function quantileSorted(sorted: readonly number[], p: number): number {
  const h = (sorted.length - 1) * p;
  const below = Math.floor(h);
  const lower = sorted[below] as number;
  const upper = sorted[Math.min(sorted.length - 1, below + 1)] as number;
  return lower + (upper - lower) * (h - below);
}

/**
 * Jenks natural breaks: the partition of `values` into `classes` contiguous
 * classes with the smallest summed squared deviation from each class mean.
 *
 * Returns `[min, upper bound of class 1, …, upper bound of class k − 1, max]`
 * — the format published implementations (jenkspy, geostats) return. Runs on
 * the distinct values weighted by their counts, so equal values never split
 * across two classes; `classes` is capped at the distinct-value count. The
 * dynamic programme uses the divide-and-conquer speed-up that the monotone
 * split points of 1-D least squares allow (Wang & Song, Ckmeans.1d.dp), so a
 * 10 000-row column stays fast.
 */
export function jenksBreaks(values: readonly number[], classes: number): number[] {
  const sorted = values.filter(isFiniteNumber).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const xs: number[] = [];
  const counts: number[] = [];
  for (const value of sorted) {
    if (xs.length > 0 && xs[xs.length - 1] === value) counts[counts.length - 1]! += 1;
    else {
      xs.push(value);
      counts.push(1);
    }
  }
  const d = xs.length;
  const first = xs[0] as number;
  const last = xs[d - 1] as number;
  const k = Math.min(stepCount(classes, 1), d);
  if (k === 1) return [first, last];

  // Prefix sums of weight, value and value², shifted by a middle value so the
  // subtraction below stays well-conditioned for large magnitudes.
  const shift = xs[Math.floor(d / 2)] as number;
  const w = new Float64Array(d + 1);
  const s1 = new Float64Array(d + 1);
  const s2 = new Float64Array(d + 1);
  for (let i = 0; i < d; i++) {
    const x = (xs[i] as number) - shift;
    const c = counts[i] as number;
    w[i + 1] = (w[i] as number) + c;
    s1[i + 1] = (s1[i] as number) + c * x;
    s2[i + 1] = (s2[i] as number) + c * x * x;
  }
  /** Summed squared deviation of distinct values `a..b` (inclusive). */
  const ssd = (a: number, b: number): number => {
    const weight = (w[b + 1] as number) - (w[a] as number);
    const sum = (s1[b + 1] as number) - (s1[a] as number);
    return Math.max(0, (s2[b + 1] as number) - (s2[a] as number) - (sum * sum) / weight);
  };

  let previous = Float64Array.from({ length: d }, (_, i) => ssd(0, i));
  const splits: Int32Array[] = [];
  for (let j = 1; j < k; j++) {
    const prior = previous;
    const current = new Float64Array(d).fill(Number.POSITIVE_INFINITY);
    const split = new Int32Array(d);
    // Class `j` covers distinct values `m..i`; the best `m` never moves left
    // as `i` grows, so each half only searches its side of the middle's `m`.
    const solve = (lo: number, hi: number, optLo: number, optHi: number): void => {
      if (lo > hi) return;
      const mid = (lo + hi) >> 1;
      let best = Number.POSITIVE_INFINITY;
      let bestM = Math.max(optLo, j);
      for (let m = Math.max(optLo, j); m <= Math.min(mid, optHi); m++) {
        const cost = (prior[m - 1] as number) + ssd(m, mid);
        if (cost < best) {
          best = cost;
          bestM = m;
        }
      }
      current[mid] = best;
      split[mid] = bestM;
      solve(lo, mid - 1, optLo, bestM);
      solve(mid + 1, hi, bestM, optHi);
    };
    solve(j, d - 1, j, d - 1);
    splits.push(split);
    previous = current;
  }

  const uppers: number[] = [];
  let end = d - 1;
  for (let j = k - 1; j >= 1; j--) {
    const start = (splits[j - 1] as Int32Array)[end] as number;
    uppers.push(xs[start - 1] as number);
    end = start - 1;
  }
  return [first, ...uppers.reverse(), last];
}

/** Linear interpolation through ascending `[x, y]` knots, clamped at both ends. */
function interpolate(knots: readonly (readonly [number, number])[], x: number): number {
  const head = knots[0] as readonly [number, number];
  if (x <= head[0]) return head[1];
  for (let i = 1; i < knots.length; i++) {
    const [x1, y1] = knots[i] as readonly [number, number];
    if (x <= x1) {
      const [x0, y0] = knots[i - 1] as readonly [number, number];
      return x1 === x0 ? y0 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return (knots[knots.length - 1] as readonly [number, number])[1];
}

/** Drop interior breaks that repeat, so no class is empty by construction. */
function uniqueBreaks(breaks: readonly number[]): number[] {
  const out: number[] = [];
  for (const b of breaks) if (out.length === 0 || b > (out[out.length - 1] as number)) out.push(b);
  return out.length === 1 ? [out[0] as number, out[0] as number] : out;
}

function roundedBreaks(lo: number, hi: number, n: number): number[] {
  const width = (hi - lo) / n;
  const exponent = Math.floor(Math.log10(width));
  // Divide by an integer power of ten below 1, so 0.3 stays 0.3 rather than 0.30000000000000004.
  const round = (x: number) =>
    exponent >= 0
      ? Math.round(x / 10 ** exponent) * 10 ** exponent
      : Math.round(x * 10 ** -exponent) / 10 ** -exponent;
  return [lo, ...Array.from({ length: n - 1 }, (_, i) => round(lo + width * (i + 1))), hi];
}

/**
 * Colours for stepped classes. No centre: spread the whole ramp. A centre:
 * classes wholly at or below it take the ramp's lower arm, classes wholly
 * above it the upper arm (each spread from the centre outwards), and a class
 * that straddles it takes the middle token — so sign never changes hue
 * inside one class.
 */
function stepColors(
  bounds: readonly (readonly [number, number])[],
  ramp: readonly string[],
  center: number | null,
): string[] {
  if (center === null) return spread(ramp, bounds.length);
  const middle = (ramp.length - 1) / 2;
  const side = bounds.map(([from, to]) =>
    from === to && from === center ? 0 : to <= center ? -1 : from >= center ? 1 : 0,
  );
  const lower = spread(ramp.slice(0, middle).reverse(), side.filter((s) => s < 0).length).reverse();
  const upper = spread(ramp.slice(middle + 1), side.filter((s) => s > 0).length);
  let l = 0;
  let u = 0;
  return side.map((s) =>
    s < 0 ? (lower[l++] as string) : s > 0 ? (upper[u++] as string) : (ramp[middle] as string),
  );
}

/** Index of the step `value` lands in: the first whose `to` is ≥ the clamped value. */
function stepIndex(steps: readonly ColorScaleStep[], value: number): number {
  for (let i = 0; i < steps.length; i++) if (value <= (steps[i] as ColorScaleStep).to) return i;
  return steps.length - 1;
}

function categoricalScale(
  values: readonly ColorScaleValue[],
  spec: ColorScaleSpec,
  method: ColorScaleMethod,
): ColorScale {
  const order = new Map<string | number, number>();
  for (const value of values) {
    const usable = (typeof value === "string" && value !== "") || isFiniteNumber(value);
    if (usable && !order.has(value)) order.set(value, order.size);
  }
  const categories = [...order.keys()].map((value, i) => ({
    value,
    color: CATEGORICAL_SET[i % CATEGORICAL_SET.length] as string,
  }));
  const indexOf = (value: ColorScaleValue) =>
    value === null || value === undefined ? -1 : (order.get(value) ?? -1);
  return {
    type: spec.type,
    method,
    palette: "categorical",
    domain: null,
    center: null,
    steps: [],
    stops: [],
    categories,
    colorOf: (value) => categories[indexOf(value)]?.color ?? null,
    indexOf,
    positionOf: () => null,
  };
}

/**
 * Build a colour scale over `values`.
 *
 * ```ts
 * const scale = colorScaleFor(rows.map((r) => r.share), {
 *   type: "stepped",
 *   method: "quantile",
 *   steps: 5,
 * });
 * scale.colorOf(0.42); // "var(--chart-seq-4)"
 * scale.steps;         // five { from, to, color } classes for the legend
 * ```
 */
export function colorScaleFor(
  values: readonly ColorScaleValue[],
  spec: ColorScaleSpec,
): ColorScale {
  const continuous = spec.type === "continuous";
  let method: ColorScaleMethod =
    spec.method !== undefined &&
    (continuous ? CONTINUOUS_METHODS : STEPPED_METHODS).has(spec.method)
      ? spec.method
      : continuous
        ? "linear"
        : "equidistant";
  const domain = spec.domain?.every(isFiniteNumber) ? spec.domain : undefined;
  const palette: ColorScalePalette =
    spec.palette ?? (domain?.length === 3 ? "diverging" : "sequential");
  if (palette === "categorical") return categoricalScale(values, spec, method);

  const data = values.filter(isFiniteNumber);
  // A loop, not `Math.min(...data)`: a spread of a 100k-row column overflows the call stack.
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const v of domain ? [domain[0], domain[domain.length - 1] as number] : data) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const thresholds =
    !continuous && method === "custom"
      ? [...new Set((spec.breaks ?? []).filter(isFiniteNumber))].sort((a, b) => a - b)
      : [];
  if (method === "custom" && thresholds.length === 0) method = "equidistant";
  if (thresholds.length > 0) {
    lo = Math.min(lo, thresholds[0] as number);
    hi = Math.max(hi, thresholds.at(-1) as number);
  }

  const noData = (): ColorScale => ({
    type: spec.type,
    method,
    palette,
    domain: null,
    center: null,
    steps: [],
    stops: [],
    categories: [],
    colorOf: () => null,
    indexOf: () => -1,
    positionOf: () => null,
  });
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return noData();

  const center =
    domain?.length === 3
      ? (domain[1] as number)
      : palette === "diverging"
        ? lo < 0 && hi > 0
          ? 0
          : (lo + hi) / 2
        : null;
  const ramp: readonly string[] = palette === "diverging" ? DIVERGING_RAMP : SEQUENTIAL_RAMP;
  const sorted = data.map((v) => clamp(v, lo, hi)).sort((a, b) => a - b);
  const needsData =
    method === "quantile" || method === "jenks" || (continuous && method !== "linear");
  if (needsData && sorted.length === 0) method = continuous ? "linear" : "equidistant";

  let steps: ColorScaleStep[];
  let stops: ColorScaleStop[] = [];
  let positionOf: (value: number) => number;

  if (lo === hi) {
    // One value (or a zero-width domain): one class, painted as "the value".
    const color = stepColors([[lo, hi]], ramp, center)[0] as string;
    steps = [{ from: lo, to: hi, color }];
    if (continuous) stops = [{ value: lo, color }];
    const position = ramp.indexOf(color) / (ramp.length - 1);
    positionOf = () => position;
  } else if (continuous) {
    // Knots map a value to its position on the ramp: the method's stops sit at
    // evenly spaced positions, then a centre bends the map so it lands at 0.5.
    let cuts: number[];
    const quantiles = QUANTILE_STOPS[method as ContinuousColorScaleMethod];
    if (quantiles !== undefined) {
      cuts = Array.from({ length: quantiles + 1 }, (_, i) =>
        i === 0 ? lo : i === quantiles ? hi : quantileSorted(sorted, i / quantiles),
      );
    } else if (method === "natural") {
      const breaks = jenksBreaks(sorted, stepCount(spec.steps, DEFAULT_STEPS));
      cuts = breaks.length > 2 ? [lo, ...breaks.slice(1, -1), hi] : [lo, hi];
    } else {
      cuts = [lo, hi];
    }
    let knots: [number, number][] = cuts.map((v, i) => [v, i / (cuts.length - 1)]);
    if (center !== null) {
      const pc = interpolate(knots, clamp(center, lo, hi));
      const bend = (p: number) =>
        pc <= 0
          ? 0.5 + p / 2
          : pc >= 1
            ? p / 2
            : p <= pc
              ? (0.5 * p) / pc
              : 0.5 + (0.5 * (p - pc)) / (1 - pc);
      knots = knots.map(([v, p]) => [v, bend(p)]);
      if (center > lo && center < hi) {
        knots.push([center, 0.5]);
        knots.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      }
    }
    const inverse = knots.map(([v, p]) => [p, v] as [number, number]);
    const last = ramp.length - 1;
    const valueAt = (position: number) => interpolate(inverse, position);
    steps = ramp.map((color, j) => ({
      from: j === 0 ? lo : valueAt((j - 0.5) / last),
      to: j === last ? hi : valueAt((j + 0.5) / last),
      color,
    }));
    stops = ramp.map((color, j) => ({ value: valueAt(j / last), color }));
    positionOf = (value) => interpolate(knots, value);
  } else {
    const n = stepCount(spec.steps, DEFAULT_STEPS);
    let breaks: number[];
    if (method === "custom") breaks = [lo, ...thresholds, hi];
    else if (method === "quantile")
      breaks = Array.from({ length: n + 1 }, (_, i) =>
        i === 0 ? lo : i === n ? hi : quantileSorted(sorted, i / n),
      );
    else if (method === "jenks") {
      const natural = jenksBreaks(sorted, n);
      breaks = [lo, ...natural.slice(1, -1), hi];
    } else if (method === "rounded") breaks = roundedBreaks(lo, hi, n);
    else
      breaks = Array.from({ length: n + 1 }, (_, i) => (i === n ? hi : lo + ((hi - lo) * i) / n));
    const unique = uniqueBreaks(breaks);
    const bounds = unique
      .slice(1)
      .map((to, i): readonly [number, number] => [unique[i] as number, to]);
    const colors = stepColors(bounds, ramp, center);
    steps = bounds.map(([from, to], i) => ({ from, to, color: colors[i] as string }));
    positionOf = (value) => {
      const i = stepIndex(steps, value);
      const { from, to } = steps[i] as ColorScaleStep;
      const within = to === from ? 0.5 : (value - from) / (to - from);
      return (i + clamp(within, 0, 1)) / steps.length;
    };
  }

  const indexOf = (value: ColorScaleValue) =>
    isFiniteNumber(value) ? stepIndex(steps, clamp(value, lo, hi)) : -1;
  return {
    type: spec.type,
    method,
    palette,
    domain: [lo, hi],
    center,
    steps,
    stops,
    categories: [],
    colorOf: (value) => steps[indexOf(value)]?.color ?? null,
    indexOf,
    positionOf: (value) => (isFiniteNumber(value) ? positionOf(clamp(value, lo, hi)) : null),
  };
}
