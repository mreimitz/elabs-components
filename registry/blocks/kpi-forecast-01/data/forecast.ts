import {
  ordersQtd,
  ordersShipped,
  QUARTER_DAY_TODAY,
  QUARTER_TOTAL_DAYS,
  revenue,
  revenueQtd,
  type KpiMetric,
  type QtdProgress,
} from "@/components/kpi-card-parts/data/acme-quarter";
import type { KpiStatusValue } from "@/components/kpi-card-parts/kpi-status";

/**
 * "Where will I land?" — a linear run-rate projection to the end of the
 * quarter, computed here from each KPI's own trailing weekly series, never
 * typed as a separate fact.
 *
 * `KpiMetric.weekly` is a ROLLING 13-week window ending at the snapshot (see
 * `acme-quarter.ts`), so its LAST {@link ELAPSED_WEEKS} entries are this
 * quarter's elapsed weeks as of today (`QUARTER_DAY_TODAY` of
 * `QUARTER_TOTAL_DAYS` ≈ {@link ELAPSED_WEEKS} of 13 weeks). Those weeks are
 * rescaled so they sum to the metric's own quarter-to-date `actual` — the
 * same number `kpi-pace-01`/`kpi-trend-reference-01` already show — so this
 * card's headline can never silently drift from the rest of the registry.
 *
 * The last 4 of those (rescaled) weeks set both the run-rate the remaining
 * weeks are projected at AND the uncertainty band around it — its relative
 * width is the run-rate's own coefficient of variation (σ/mean), floored at
 * {@link MIN_RELATIVE_BAND} so a real-but-tiny sample σ never renders as a
 * sub-pixel sliver — applied to the projected total and widened with the
 * square root of the number of weeks projected: a random-walk assumption,
 * the simplest honest way to say "less certain further out" without
 * inventing a real forecasting model. The resulting ± width is always stated
 * in words in {@link ForecastResult.methodNote}, never left for the band's
 * shape alone to carry.
 */

export const TOTAL_WEEKS = 13;
/** This quarter's elapsed weeks, as a share of {@link TOTAL_WEEKS}. */
export const ELAPSED_WEEKS = Math.round((QUARTER_DAY_TODAY / QUARTER_TOTAL_DAYS) * TOTAL_WEEKS);
const REMAINING_WEEKS = TOTAL_WEEKS - ELAPSED_WEEKS;
/** How many trailing weeks set the run-rate and the confidence band's σ. */
const RUN_RATE_WINDOW = 4;
/**
 * Floor on the confidence band's relative width (σ/run-rate). A stable
 * weekly series (this fictional company's revenue/orders both run ~1–2%
 * week-to-week noise) yields a real sample σ from only
 * {@link RUN_RATE_WINDOW} points that is both statistically unreliable and,
 * plotted in cumulative dollars against a multi-million-dollar y-domain, a
 * band only 1–2 px wide — narrower than the line's own stroke, so it reads
 * as "no band at all" even though it is technically painted. Flooring the
 * relative width (never trust an n=4 σ as the whole story, and a real band
 * has to visibly clear the series stroke to read as a band) is disclosed in
 * {@link ForecastResult.methodNote}, never hidden.
 */
const MIN_RELATIVE_BAND = 0.08;
/** Status margin: within this fraction of target counts "at risk", not "off track". */
const AT_RISK_MARGIN = 0.05;

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

/** One point on the forecast chart's shared "week" x-axis. */
export interface ForecastPoint {
  week: number;
  /** Continuous actual→projected series — one line, dashed from `todayWeek` on. */
  value: number;
  /** Confidence band lower/upper edge — equals `value` (zero-width) before `todayWeek`. */
  lo: number;
  hi: number;
  /** Structural compatibility with `LineChart`'s `Record<string, unknown>[]` data prop. */
  [key: string]: unknown;
}

export interface ForecastResult {
  label: string;
  unit: QtdProgress["unit"];
  currency?: string;
  higherIsBetter: boolean;
  points: ForecastPoint[];
  /** The x-axis ("week") value of the last actual point — the projection starts one week later. */
  todayWeek: number;
  /** Full-quarter target the projection is read against. */
  target: number;
  /** Cumulative actual as of today (== the metric's own QTD `actual`). */
  actualToDate: number;
  /** Linear run-rate projection for the full quarter (end of week {@link TOTAL_WEEKS}). */
  projectedTotal: number;
  pctOfTarget: number;
  status: KpiStatusValue;
  /** e.g. "Linear run-rate from the last 4 weeks, ±1σ band". */
  methodNote: string;
}

function statusForProjection(
  projected: number,
  target: number,
  higherIsBetter: boolean,
): KpiStatusValue {
  const gapRatio = higherIsBetter ? (target - projected) / target : (projected - target) / target;
  if (gapRatio <= 0) return "on-track";
  if (gapRatio <= AT_RISK_MARGIN) return "at-risk";
  return "off-track";
}

/** Build a full forecast (actual + projection + confidence band + status) for one metric. */
export function buildForecast(metric: KpiMetric, qtd: QtdProgress): ForecastResult {
  const elapsed = metric.weekly.slice(-ELAPSED_WEEKS);
  const elapsedSum = elapsed.reduce((sum, v) => sum + v, 0);
  const scale = elapsedSum === 0 ? 1 : qtd.actual / elapsedSum;
  const weeklyActual = elapsed.map((v) => v * scale);

  const cumulativeActual: number[] = [];
  weeklyActual.reduce((sum, v) => {
    const next = sum + v;
    cumulativeActual.push(next);
    return next;
  }, 0);

  const points: ForecastPoint[] = cumulativeActual.map((value, i) => ({
    week: i + 1,
    value,
    lo: value,
    hi: value,
  }));

  const runRateWeeks = weeklyActual.slice(-RUN_RATE_WINDOW);
  const runRate = mean(runRateWeeks);
  const sigma = stdDev(runRateWeeks);
  const relativeBand = Math.max(runRate === 0 ? 0 : Math.abs(sigma / runRate), MIN_RELATIVE_BAND);

  let projectedTotal = cumulativeActual[cumulativeActual.length - 1] as number;
  for (let j = 1; j <= REMAINING_WEEKS; j++) {
    projectedTotal += runRate;
    // Widens from 0 (today) to `relativeBand` of the projected total at the
    // full remaining horizon — a random-walk-shaped ramp (sqrt(j)) applied to
    // a relative, floored width rather than the raw per-week σ (see
    // `MIN_RELATIVE_BAND`).
    const band = relativeBand * projectedTotal * Math.sqrt(j / REMAINING_WEEKS);
    points.push({
      week: ELAPSED_WEEKS + j,
      value: projectedTotal,
      lo: projectedTotal - band,
      hi: projectedTotal + band,
    });
  }

  const pctOfTarget = (projectedTotal / qtd.targetFullQuarter) * 100;
  const status = statusForProjection(projectedTotal, qtd.targetFullQuarter, metric.higherIsBetter);

  return {
    label: qtd.label,
    unit: qtd.unit,
    currency: qtd.currency,
    higherIsBetter: metric.higherIsBetter,
    points,
    todayWeek: ELAPSED_WEEKS,
    target: qtd.targetFullQuarter,
    actualToDate: qtd.actual,
    projectedTotal,
    pctOfTarget,
    status,
    methodNote: `Linear run-rate from the last ${RUN_RATE_WINDOW} weeks, ±${Math.round(relativeBand * 100)}% band`,
  };
}

export const revenueForecast: ForecastResult = buildForecast(revenue, revenueQtd);
export const ordersForecast: ForecastResult = buildForecast(ordersShipped, ordersQtd);
