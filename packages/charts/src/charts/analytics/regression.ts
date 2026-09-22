/**
 * analytics/regression.ts — the trend models of `analytics[{ kind: "trend" }]`
 * (ADR 0040 §1, RM-137) on top of d3-regression.
 *
 * ## Why d3-regression, and why a wrapper
 *
 * ADR 0040 picks d3-regression (MIT, ~6 kB, tree-shakes) over hand-rolled
 * solvers for the fits themselves. This wrapper adds what the library does
 * not do and a chart needs:
 *
 * 1. **Guards** — fewer than two usable points, every x identical, a
 *    polynomial whose degree is not below the number of usable rows, and the
 *    domain restrictions of the transformed models (`log`/`pow` drop
 *    `x <= 0`; `exp`/`pow` drop `y <= 0`, since both are fitted on `ln y`)
 *    all yield `null` or a filtered fit instead of `NaN` coefficients.
 * 2. **Conditioning** — d3-regression accumulates raw moments
 *    (`E[x²] − E[x]²`), which cancels catastrophically for epoch-ms x values
 *    (`TrendLine` fits on `Date#getTime()`, ~1.7e12). `linear`, `exp` and
 *    `poly` are therefore fitted on the STANDARDISED x (`z = (x − x̄) / s_x`)
 *    and the coefficients mapped back to raw x; `predict` keeps evaluating
 *    in z, so it stays exact even where the raw coefficients are huge.
 *    (`log`/`pow` cannot be shifted — `ln` is not affine-invariant — and are
 *    fitted on raw x, which is fine: `ln x` is already small.)
 * 3. **A confidence band** (`opts.ci`, e.g. `0.95`) for the linear family —
 *    `linear`, `log`, `poly` and, in log-y space, `exp` / `pow`: the
 *    classical band of the MEAN response, `ŷ(x) ± t(1−α/2, n−p) · s ·
 *    √(φ(x)ᵀ (ΦᵀΦ)⁻¹ φ(x))`, with `s² = SSE / (n − p)` and `φ` the model's
 *    basis. For `exp`/`pow` the band is computed on `ln y` against the fitted
 *    curve and exponentiated (so it is asymmetric around the curve); note
 *    d3-regression fits `exp` by a y-weighted log-space least squares, so
 *    that band is an approximation of the fit's true uncertainty. **Loess
 *    offers no band and no r²** — like the analytics-pane BI suite, which offers no band for its
 *    non-linear models either.
 * 4. **Uniform coefficients** — `linear`/`log`: `[intercept, slope]`
 *    (`y = c₀ + c₁·x` / `y = c₀ + c₁·ln x`); `exp`: `[a, b]` (`y = a·eᵇˣ`);
 *    `pow`: `[a, b]` (`y = a·xᵇ`); `poly`: constant term upward; `loess`: `[]`.
 *
 * Framework-free: no React, no DOM, no chart context.
 */

import {
  regressionExp,
  regressionLinear,
  regressionLoess,
  regressionLog,
  regressionPoly,
  regressionPow,
  type RegressionResult,
} from "d3-regression";

import { tQuantile } from "./stats";
import type { AnalyticTrendModel } from "./types";

export interface RegressionInputPoint {
  x: number;
  y: number;
}

export interface ModelFit {
  model: AnalyticTrendModel;
  /** The fitted curve at `x` (raw x units). Loess interpolates linearly between its fitted points. */
  predict: (x: number) => number;
  /** Coefficient of determination (in y space). `undefined` for loess. */
  rSquared?: number;
  /** See the module docblock for the ordering per model. `[]` for loess. */
  coefficients: number[];
  /** `[min, max]` of the usable x values. */
  domain: [number, number];
  /** Number of usable points the fit was built from. */
  n: number;
  /** Confidence band of the mean response at `x` — only with `opts.ci`, linear family only. */
  band?: (x: number) => { lower: number; upper: number };
}

export interface FitModelOptions {
  /** Confidence level for `band`, in `(0, 1)` — e.g. `0.95`. Omit for no band. */
  ci?: number;
}

type Pair = [number, number];

/**
 * d3-regression returns, besides the coefficients, a drawable curve sampled
 * ADAPTIVELY across the fit's domain (`interpose`: thousands of points and
 * O(n²) splicing for a degree-6 polynomial — ~700 ms on 10 k rows). We never
 * use that curve (`predict` is exact), so every fit is handed a zero-width
 * domain, which makes the sampler return at once. The domain only feeds the
 * sampler; coefficients and r² are unaffected. (`ModelFit.domain` is ours.)
 */
const NO_CURVE: [number, number] = [1, 1];

/** A stable text key of a model (tests, caches, the accessible description). */
export function modelKey(model: AnalyticTrendModel): string {
  if (typeof model === "string") return model;
  if ("poly" in model) return `poly${model.poly}`;
  return `loess${model.loess}`;
}

/**
 * Fits `model` to the finite `points`. Returns `null` when fewer than two
 * usable points remain, every usable x is identical, or a polynomial's
 * degree is not below the number of usable points.
 */
export function fitModel(
  points: readonly RegressionInputPoint[],
  model: AnalyticTrendModel,
  opts: FitModelOptions = {},
): ModelFit | null {
  const needPositiveX = model === "log" || model === "pow";
  const needPositiveY = model === "exp" || model === "pow";

  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of points) {
    const { x, y } = p;
    if (typeof x !== "number" || typeof y !== "number") continue;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (needPositiveX && x <= 0) continue;
    if (needPositiveY && y <= 0) continue;
    xs.push(x);
    ys.push(y);
  }
  const n = xs.length;
  if (n < 2) return null;

  let xMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let mx = 0;
  for (let i = 0; i < n; i += 1) {
    const x = xs[i] as number;
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    mx += (x - mx) / (i + 1);
  }
  if (xMin === xMax) return null;
  let ssx = 0;
  for (const x of xs) ssx += (x - mx) ** 2;
  const sx = Math.sqrt(ssx / n);
  if (!(sx > 0)) return null;
  const toZ = (x: number) => (x - mx) / sx;
  const domain: [number, number] = [xMin, xMax];

  const zPairs = (): Pair[] => xs.map((x, i) => [toZ(x), ys[i] as number]);
  const rawPairs = (): Pair[] => xs.map((x, i) => [x, ys[i] as number]);

  let fit: Omit<ModelFit, "band" | "model" | "domain" | "n">;
  /** The model's basis `φ(x)` and whether residuals live in `ln y`, for the band. */
  let basis: ((x: number) => number[]) | null = null;
  let logY = false;

  if (model === "linear") {
    const r = regressionLinear<Pair>().domain(NO_CURVE)(zPairs());
    const slopeZ = r.a as number;
    const interceptZ = r.b as number;
    const slope = slopeZ / sx;
    fit = {
      predict: (x) => interceptZ + slopeZ * toZ(x),
      rSquared: r.rSquared,
      coefficients: [interceptZ - slope * mx, slope],
    };
    basis = (x) => [1, toZ(x)];
  } else if (model === "log") {
    const r = regressionLog<Pair>().domain(NO_CURVE)(rawPairs());
    const slope = r.a as number;
    const intercept = r.b as number;
    fit = {
      predict: (x) => intercept + slope * Math.log(x),
      rSquared: r.rSquared,
      coefficients: [intercept, slope],
    };
    basis = (x) => [1, Math.log(x)];
  } else if (model === "exp") {
    const r = regressionExp<Pair>().domain(NO_CURVE)(zPairs());
    const aZ = r.a as number;
    const bZ = r.b as number;
    fit = {
      predict: (x) => aZ * Math.exp(bZ * toZ(x)),
      rSquared: r.rSquared,
      coefficients: [aZ * Math.exp((-bZ * mx) / sx), bZ / sx],
    };
    basis = (x) => [1, toZ(x)];
    logY = true;
  } else if (model === "pow") {
    const r = regressionPow<Pair>().domain(NO_CURVE)(rawPairs());
    const a = r.a as number;
    const b = r.b as number;
    fit = {
      predict: (x) => a * x ** b,
      rSquared: r.rSquared,
      coefficients: [a, b],
    };
    basis = (x) => [1, Math.log(x)];
    logY = true;
  } else if ("poly" in model) {
    const degree = Math.round(model.poly);
    if (!(degree >= 1) || degree >= n) return null;
    const r: RegressionResult = regressionPoly<Pair>().order(degree).domain(NO_CURVE)(zPairs());
    const cz = r.coefficients;
    if (!cz || cz.length !== degree + 1 || !cz.every(Number.isFinite)) return null;
    fit = {
      predict: (x) => horner(cz, toZ(x)),
      rSquared: r.rSquared,
      coefficients: unstandardise(cz, mx, sx),
    };
    basis = (x) => {
      const z = toZ(x);
      const out = [1];
      for (let k = 1; k <= degree; k += 1) out.push((out[k - 1] as number) * z);
      return out;
    };
  } else {
    if (!Number.isFinite(model.loess)) return null;
    // d3-regression's bandwidth is the fraction of points in each local fit.
    const bandwidth = Math.min(1, Math.max(Number.EPSILON, model.loess));
    const smoothed = regressionLoess<Pair>().bandwidth(bandwidth)(zPairs());
    const fx: number[] = [];
    const fy: number[] = [];
    for (const [z, y] of smoothed) {
      if (!Number.isFinite(z) || !Number.isFinite(y)) continue;
      fx.push(z * sx + mx);
      fy.push(y);
    }
    if (fx.length === 0) return null;
    return {
      model,
      predict: (x) => interpolate(fx, fy, x),
      coefficients: [],
      domain,
      n,
    };
  }

  if (!fit.coefficients.every(Number.isFinite)) return null;
  // A constant y is fitted perfectly by a flat curve; d3's `1 − SSE/SST` is 0/0 there.
  if (fit.rSquared !== undefined && !Number.isFinite(fit.rSquared)) fit.rSquared = 1;

  const out: ModelFit = { model, ...fit, domain, n };
  if (opts.ci !== undefined && basis) {
    const band = confidenceBand(xs, ys, fit.predict, basis, logY, opts.ci);
    if (band) out.band = band;
  }
  return out;
}

/** Evaluates `c₀ + c₁z + c₂z² + …`. */
function horner(coefficients: readonly number[], z: number): number {
  let y = 0;
  for (let k = coefficients.length - 1; k >= 0; k -= 1) y = y * z + (coefficients[k] as number);
  return y;
}

/** Maps coefficients in `z = (x − m)/s` to coefficients in raw x (binomial expansion). */
function unstandardise(cz: readonly number[], m: number, s: number): number[] {
  const out = new Array<number>(cz.length).fill(0);
  for (let k = 0; k < cz.length; k += 1) {
    const ck = (cz[k] as number) / s ** k;
    // (x − m)^k = Σ_j C(k, j) x^j (−m)^(k−j)
    let binom = 1;
    for (let j = 0; j <= k; j += 1) {
      if (j > 0) binom = (binom * (k - j + 1)) / j;
      out[j] = (out[j] as number) + ck * binom * (-m) ** (k - j);
    }
  }
  return out;
}

/** Piecewise-linear interpolation over ascending `xs`, clamped at both ends. */
function interpolate(xs: readonly number[], ys: readonly number[], x: number): number {
  const last = xs.length - 1;
  if (last === 0 || x <= (xs[0] as number)) return ys[0] as number;
  if (x >= (xs[last] as number)) return ys[last] as number;
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((xs[mid] as number) <= x) lo = mid;
    else hi = mid;
  }
  const x0 = xs[lo] as number;
  const x1 = xs[hi] as number;
  const y0 = ys[lo] as number;
  const y1 = ys[hi] as number;
  return x1 === x0 ? y0 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

/**
 * The classical confidence band of the mean response (see module docblock,
 * point 3). `null` when there are no residual degrees of freedom, the level is
 * outside `(0, 1)`, or `ΦᵀΦ` is singular.
 */
function confidenceBand(
  xs: readonly number[],
  ys: readonly number[],
  predict: (x: number) => number,
  basis: (x: number) => number[],
  logY: boolean,
  level: number,
): ((x: number) => { lower: number; upper: number }) | null {
  if (!(level > 0 && level < 1)) return null;
  const n = xs.length;
  const p = basis(xs[0] as number).length;
  const df = n - p;
  if (df <= 0) return null;

  const xtx: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  let sse = 0;
  for (let i = 0; i < n; i += 1) {
    const x = xs[i] as number;
    const phi = basis(x);
    for (let r = 0; r < p; r += 1) {
      const row = xtx[r] as number[];
      for (let c = 0; c < p; c += 1)
        row[c] = (row[c] as number) + (phi[r] as number) * (phi[c] as number);
    }
    const yHat = predict(x);
    const resid = logY ? Math.log(ys[i] as number) - Math.log(yHat) : (ys[i] as number) - yHat;
    sse += resid * resid;
  }
  if (!Number.isFinite(sse)) return null;
  const inv = invert(xtx);
  if (!inv) return null;
  const s = Math.sqrt(sse / df);
  const t = tQuantile(1 - (1 - level) / 2, df);

  return (x: number) => {
    const phi = basis(x);
    let h = 0;
    for (let r = 0; r < p; r += 1) {
      const row = inv[r] as number[];
      let acc = 0;
      for (let c = 0; c < p; c += 1) acc += (row[c] as number) * (phi[c] as number);
      h += (phi[r] as number) * acc;
    }
    const half = t * s * Math.sqrt(Math.max(0, h));
    const yHat = predict(x);
    if (logY) {
      const ly = Math.log(yHat);
      return { lower: Math.exp(ly - half), upper: Math.exp(ly + half) };
    }
    return { lower: yHat - half, upper: yHat + half };
  };
}

/** Gauss-Jordan inverse with partial pivoting; `null` when (numerically) singular. */
function invert(matrix: readonly (readonly number[])[]): number[][] | null {
  const n = matrix.length;
  const a = matrix.map((row, i) => {
    const out = [...row];
    for (let j = 0; j < n; j += 1) out.push(i === j ? 1 : 0);
    return out;
  });
  let scale = 0;
  for (const row of matrix) for (const v of row) scale = Math.max(scale, Math.abs(v));
  const eps = scale * 1e-13;
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (
        Math.abs((a[r] as number[])[col] as number) >
        Math.abs((a[pivot] as number[])[col] as number)
      )
        pivot = r;
    }
    const pv = (a[pivot] as number[])[col] as number;
    if (!(Math.abs(pv) > eps)) return null;
    [a[col], a[pivot]] = [a[pivot] as number[], a[col] as number[]];
    const pr = a[col] as number[];
    for (let c = 0; c < 2 * n; c += 1) pr[c] = (pr[c] as number) / pv;
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const row = a[r] as number[];
      const f = row[col] as number;
      if (f === 0) continue;
      for (let c = 0; c < 2 * n; c += 1) row[c] = (row[c] as number) - f * (pr[c] as number);
    }
  }
  return a.map((row) => row.slice(n));
}

/**
 * "increasing" / "decreasing" / "flat" — the direction a fit reports to the
 * accessible description. Accepts a slope-bearing fit (`fitTrend`'s
 * `TrendFit`) or any `ModelFit`, whose direction is the sign of its change
 * across its own x domain (for `linear`/`log` that is the slope's sign).
 */
export function trendDirection(
  fit: { slope: number } | Pick<ModelFit, "predict" | "domain">,
): "increasing" | "decreasing" | "flat" {
  let delta: number;
  if ("slope" in fit) {
    delta = fit.slope;
  } else {
    const y0 = fit.predict(fit.domain[0]);
    const y1 = fit.predict(fit.domain[1]);
    delta = y1 - y0;
    if (Math.abs(delta) <= 1e-12 * Math.max(1, Math.abs(y0), Math.abs(y1))) delta = 0;
  }
  if (delta > 0) return "increasing";
  if (delta < 0) return "decreasing";
  return "flat";
}
