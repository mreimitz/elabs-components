/**
 * analytics/forecast.ts — additive Holt-Winters for
 * `analytics[{ kind: "forecast" }]` (ADR 0040 §1, RM-137).
 *
 * ## Why Holt-Winters, and why additive
 *
 * the analytics-pane BI suite's and the report-builder BI suite's built-in forecasts are exponential-smoothing
 * models (ETS); additive trend with an optional additive season (ETS
 * AAN / AAA) is the member that needs no positivity assumption and stays
 * stable on short series — the right default for a chart overlay that must
 * never throw. Multiplicative variants, damping and ARIMA are out of scope.
 *
 * ## Model
 *
 * With season length `m` (omit for none):
 *
 *     ŷₜ      = ℓₜ₋₁ + bₜ₋₁ + sₜ₋ₘ                (one-step forecast)
 *     ℓₜ      = α (yₜ − sₜ₋ₘ) + (1 − α)(ℓₜ₋₁ + bₜ₋₁)
 *     bₜ      = β (ℓₜ − ℓₜ₋₁) + (1 − β) bₜ₋₁
 *     sₜ      = γ (yₜ − ℓₜ) + (1 − γ) sₜ₋ₘ
 *     ŷ_{T+h} = ℓ_T + h·b_T + s_{T+h−m⌈h/m⌉}
 *
 * Initial state (classical, de-trended): seasonal — `b` = (mean of season 2
 * − mean of season 1) / m, `ℓ` = the first season's mean projected from its
 * middle row to row `m − 1`, `sᵢ = yᵢ −` the trend line through the first
 * season's mean, recursion from `t = m` (a noiseless trend + season is then
 * reproduced exactly); non-seasonal — `ℓ = y₁`,
 * `b = y₁ − y₀`, recursion from `t = 2`.
 *
 * **Parameter fitting.** Any of `alpha`/`beta`/`gamma` not given is found by
 * an exhaustive grid search in steps of 0.05 (α ∈ [0.05, 1], β, γ ∈ [0, 1])
 * minimising the one-step-ahead sum of squared errors — deterministic, no
 * optimiser to diverge, ~9 k cheap passes at most.
 *
 * **Prediction interval** (documented approximation). With `σ` the RMS of
 * the one-step errors and `z` the normal quantile of `(1 + interval) / 2`,
 * step `h` gets `ŷ ± z·σ·√(1 + (h − 1)·α²)`. This is the leading term of the
 * exact ETS(A,N,N) variance, `σ²(1 + (h−1)α²)`; it ignores the trend and
 * seasonal contributions to the variance, so for long horizons on strongly
 * trending series the band is somewhat narrow.
 *
 * Framework-free: no React, no DOM, no chart context.
 */

import { normalQuantile } from "./stats";

export interface HoltWintersOptions {
  /** Number of future steps to forecast (integer ≥ 1). */
  horizon: number;
  /** Season length in rows (integer ≥ 2). Omit (or `< 2`) for no seasonality. */
  season?: number;
  /** Prediction interval level in `(0, 1)`. Default `0.95`. */
  interval?: number;
  /** Level smoothing in `[0, 1]`; grid-searched when omitted. */
  alpha?: number;
  /** Trend smoothing in `[0, 1]`; grid-searched when omitted. */
  beta?: number;
  /** Season smoothing in `[0, 1]`; grid-searched when omitted (ignored without a season). */
  gamma?: number;
}

export interface HoltWintersForecast {
  /** `horizon` forecast values, for steps `1…horizon` after the last input. */
  points: number[];
  /** Lower prediction bound per step. */
  lower: number[];
  /** Upper prediction bound per step. */
  upper: number[];
  /** The smoothing parameters used (fitted or given). `gamma` is `0` without a season. */
  params: { alpha: number; beta: number; gamma: number };
  /** RMS of the one-step-ahead in-sample errors. */
  sigma: number;
}

interface RunResult {
  sse: number;
  errors: number;
  level: number;
  trend: number;
  seasonal: number[];
}

/** One smoothing pass over `y`; returns the final state and the one-step SSE. */
function run(
  y: readonly number[],
  m: number,
  alpha: number,
  beta: number,
  gamma: number,
): RunResult {
  const n = y.length;
  let level: number;
  let trend: number;
  const seasonal: number[] = [];
  let start: number;

  if (m > 0) {
    let s1 = 0;
    let s2 = 0;
    for (let i = 0; i < m; i += 1) {
      s1 += y[i] as number;
      s2 += y[i + m] as number;
    }
    s1 /= m;
    s2 /= m;
    trend = (s2 - s1) / m;
    // The first season's mean sits at its middle row, (m − 1) / 2: project it
    // to row m − 1 for the level, and de-trend each row for its seasonal.
    const mid = (m - 1) / 2;
    level = s1 + trend * mid;
    for (let i = 0; i < m; i += 1) seasonal.push((y[i] as number) - (s1 + trend * (i - mid)));
    start = m;
  } else {
    level = y[1] as number;
    trend = (y[1] as number) - (y[0] as number);
    start = 2;
  }

  let sse = 0;
  for (let t = start; t < n; t += 1) {
    const yt = y[t] as number;
    const si = m > 0 ? t % m : 0;
    const s = m > 0 ? (seasonal[si] as number) : 0;
    const forecast = level + trend + s;
    const err = yt - forecast;
    sse += err * err;
    const prevLevel = level;
    level = alpha * (yt - s) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    if (m > 0) seasonal[si] = gamma * (yt - level) + (1 - gamma) * s;
  }
  return { sse, errors: n - start, level, trend, seasonal };
}

function grid(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = Math.round(from / 0.05); i <= Math.round(to / 0.05); i += 1) out.push(i * 0.05);
  return out;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * Additive Holt-Winters forecast of `values` (see the module docblock).
 * Returns `null` when a value is not finite, `horizon < 1`, or the series is
 * too short: `>= 2·season` rows with a season, `>= 3` without.
 */
export function forecastHoltWinters(
  values: readonly number[],
  options: HoltWintersOptions,
): HoltWintersForecast | null {
  const horizon = Math.floor(options.horizon);
  if (!(horizon >= 1)) return null;
  if (!values.every((v) => typeof v === "number" && Number.isFinite(v))) return null;
  const season = options.season !== undefined ? Math.floor(options.season) : 0;
  const m = season >= 2 ? season : 0;
  const n = values.length;
  if (m > 0 ? n < 2 * m : n < 3) return null;
  const level = options.interval ?? 0.95;
  if (!(level > 0 && level < 1)) return null;

  const alphas = options.alpha !== undefined ? [clamp01(options.alpha)] : grid(0.05, 1);
  const betas = options.beta !== undefined ? [clamp01(options.beta)] : grid(0, 1);
  const gammas =
    m === 0 ? [0] : options.gamma !== undefined ? [clamp01(options.gamma)] : grid(0, 1);

  let best: { result: RunResult; alpha: number; beta: number; gamma: number } | null = null;
  for (const alpha of alphas) {
    for (const beta of betas) {
      for (const gamma of gammas) {
        const result = run(values, m, alpha, beta, gamma);
        if (!Number.isFinite(result.sse)) continue;
        if (best === null || result.sse < best.result.sse) best = { result, alpha, beta, gamma };
      }
    }
  }
  if (best === null) return null;

  const { result, alpha, beta, gamma } = best;
  const sigma = result.errors > 0 ? Math.sqrt(result.sse / result.errors) : 0;
  const z = normalQuantile(1 - (1 - level) / 2);

  const points: number[] = [];
  const lower: number[] = [];
  const upper: number[] = [];
  for (let h = 1; h <= horizon; h += 1) {
    const s = m > 0 ? (result.seasonal[(n + h - 1) % m] as number) : 0;
    const yHat = result.level + h * result.trend + s;
    const half = z * sigma * Math.sqrt(1 + (h - 1) * alpha * alpha);
    points.push(yHat);
    lower.push(yHat - half);
    upper.push(yHat + half);
  }
  return { points, lower, upper, params: { alpha, beta, gamma }, sigma };
}
