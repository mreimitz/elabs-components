import type { BulletBand } from "@elabs-ai/components-charts";
import type { KpiUnit } from "../format";

/**
 * One fictional company — "Acme Logistics" — Q3 (Jul 1 – Sep 30, a 92-day
 * quarter), snapshotted on day 62 (31 Aug). Every KPI card block in this
 * registry category reads from this ONE dataset so the numbers agree with
 * each other across blocks.
 *
 * Every number below is a typed FACT (an actual, a target, a prior-year
 * figure, a weekly point); every DELTA (the gap to a baseline, a percentage
 * change, a pace) is computed at render time by `format.ts` / the block
 * itself — never pre-typed here, so it can never silently drift from the
 * facts it is derived from.
 */

export const QUARTER_LABEL = "Q3 (Jul–Sep)";
export const QUARTER_TOTAL_DAYS = 92;
/** Snapshot day — 31 Aug, the 62nd day of the 92-day quarter. */
export const QUARTER_DAY_TODAY = 62;
export const AS_OF_DATE = new Date(Date.UTC(2026, 7, 31, 9, 40));
export const DATA_SOURCE = "ERP";

/** Fraction of the quarter elapsed as of the snapshot — the pace baseline every QTD card measures against. */
export const EXPECTED_PACE_FRACTION = QUARTER_DAY_TODAY / QUARTER_TOTAL_DAYS;

/**
 * A KPI's trailing 13-week trend — the last 13 calendar weeks up to the
 * snapshot (not "weeks 1–13 of this quarter"): a rolling window is what a
 * `Sparkline`/scorecard trend column reads in practice, and it sidesteps the
 * fact that only 9 of this quarter's 13 weeks have happened yet.
 */
export interface KpiMetric {
  id: string;
  label: string;
  unit: KpiUnit;
  /** Whether a higher `actual` is the good direction (false for cost/time metrics). */
  higherIsBetter: boolean;
  actual: number;
  /** Full-quarter target; for a cumulative (QTD) metric this is already prorated to the snapshot day. */
  target: number;
  /** Same point last year. */
  priorYear: number;
  /** The internally budgeted figure (distinct from `target`, which is the goal communicated externally). */
  budget: number;
  /** Trailing 13-week series, oldest → newest, ending at (approximately) `actual`'s own scale. */
  weekly: number[];
  weeklyPriorYear: number[];
  /** The "normal" operating range for the weekly series — what `Sparkline`'s `band` shades. */
  normalBand: readonly [number, number];
  /** Qualitative bullet-chart bands, ascending — see {@link qualitativeBandsForTarget}. */
  bullet: BulletBand[];
  currency?: string;
}

/**
 * Three qualitative bands scaled off a KPI's own `target`, ascending by
 * `to` (BulletChart's own requirement). For a `higherIsBetter` KPI the low
 * end of the scale is the worst band ("Behind"); for a lower-is-better KPI
 * (cost, time) the SAME ascending thresholds carry the OPPOSITE meaning —
 * the low end is the best band ("On track") — because low numbers are good.
 * Bands are computed from the target, never authored as separate literals,
 * so they can never silently drift from it.
 */
export function qualitativeBandsForTarget(target: number, higherIsBetter: boolean): BulletBand[] {
  const magnitudes = higherIsBetter ? [0.85, 1.0, 1.25] : [0.92, 1.08, 1.3];
  const labels = higherIsBetter ? ["Behind", "On track", "Ahead"] : ["On track", "Watch", "Behind"];
  return magnitudes.map((to, i) => ({ to: target * to, label: labels[i] as string }));
}

export const revenue: KpiMetric = {
  id: "revenue",
  label: "Revenue",
  unit: "currency",
  higherIsBetter: true,
  actual: 2_885_870,
  target: 3_032_609,
  priorYear: 2_650_000,
  budget: 2_965_217,
  weekly: [
    298_000, 302_000, 295_000, 310_000, 305_000, 315_000, 308_000, 318_000, 322_000, 316_000,
    328_000, 321_000, 325_870,
  ],
  weeklyPriorYear: [
    275_000, 278_000, 271_000, 285_000, 280_000, 288_000, 283_000, 291_000, 295_000, 289_000,
    298_000, 293_000, 296_500,
  ],
  normalBand: [295_000, 335_000],
  bullet: qualitativeBandsForTarget(3_032_609, true),
};

export const onTimeDelivery: KpiMetric = {
  id: "onTimeDelivery",
  label: "On-time delivery",
  unit: "percent",
  higherIsBetter: true,
  actual: 91.4,
  target: 95,
  priorYear: 93.1,
  budget: 94,
  weekly: [89.8, 90.5, 88.9, 91.2, 90.0, 92.1, 89.5, 90.8, 91.6, 90.2, 92.4, 90.9, 91.4],
  weeklyPriorYear: [92.5, 93.1, 91.8, 93.6, 92.9, 94.0, 92.3, 93.4, 93.8, 92.6, 94.2, 93.0, 93.1],
  normalBand: [92, 97],
  bullet: qualitativeBandsForTarget(95, true),
};

export const ordersShipped: KpiMetric = {
  id: "ordersShipped",
  label: "Orders shipped",
  unit: "count",
  higherIsBetter: true,
  actual: 6_300,
  target: 6_200,
  priorYear: 5_980,
  budget: 6_065,
  weekly: [655, 668, 672, 690, 701, 685, 710, 695, 718, 702, 725, 708, 712],
  weeklyPriorYear: [598, 610, 605, 622, 630, 615, 640, 625, 648, 632, 655, 638, 660],
  // A genuinely NARROWER-than-the-series band (not the old [640,760], which
  // nearly spanned the whole plotted range and read as a full-height wash
  // carrying no information, #…) — the typical weekly corridor, not the
  // series' own min/max.
  normalBand: [665, 705],
  bullet: qualitativeBandsForTarget(6_200, true),
};

export const costPerShipment: KpiMetric = {
  id: "costPerShipment",
  label: "Cost per shipment",
  unit: "currency",
  higherIsBetter: false,
  actual: 8.4,
  target: 7.9,
  priorYear: 8.65,
  budget: 8.1,
  weekly: [8.1, 8.25, 8.05, 8.35, 8.2, 8.45, 8.15, 8.5, 8.3, 8.55, 8.25, 8.6, 8.4],
  weeklyPriorYear: [8.4, 8.55, 8.35, 8.65, 8.5, 8.75, 8.45, 8.8, 8.6, 8.85, 8.55, 8.9, 8.65],
  normalBand: [7.8, 8.6],
  bullet: qualitativeBandsForTarget(7.9, false),
};

export const nps: KpiMetric = {
  id: "nps",
  label: "NPS",
  unit: "score",
  higherIsBetter: true,
  actual: 42,
  target: 50,
  priorYear: 38,
  budget: 45,
  weekly: [37, 39, 36, 41, 38, 43, 39, 44, 40, 45, 41, 46, 42],
  weeklyPriorYear: [33, 35, 32, 37, 34, 39, 35, 40, 36, 41, 37, 42, 38],
  // Narrower than the old [35,55] (55 sat at the domain ceiling, so the band
  // read as filling nearly the whole plot, #…) — the typical weekly corridor.
  normalBand: [38, 44],
  bullet: qualitativeBandsForTarget(50, true),
};

export const avgDeliveryHours: KpiMetric = {
  id: "avgDeliveryHours",
  label: "Avg delivery time",
  unit: "hours",
  higherIsBetter: false,
  actual: 36.2,
  target: 32.0,
  priorYear: 34.5,
  budget: 33.0,
  weekly: [35.0, 35.6, 34.4, 36.2, 35.1, 37.0, 35.4, 37.4, 35.8, 37.8, 36.0, 38.0, 36.2],
  weeklyPriorYear: [33.2, 33.8, 32.6, 34.4, 33.3, 35.2, 33.6, 35.6, 34.0, 36.0, 34.2, 36.4, 34.5],
  // Narrower than the old [30,38] (38 sat exactly at the domain ceiling, so
  // the band read as filling ~85% of the plot height, #…) — the typical
  // weekly corridor; this year's weekly readings running mostly ABOVE it is
  // the honest "worse than normal" story a lower-is-better KPI should tell.
  normalBand: [33, 35],
  bullet: qualitativeBandsForTarget(32.0, false),
};

export const acmeKpis: KpiMetric[] = [
  revenue,
  onTimeDelivery,
  ordersShipped,
  costPerShipment,
  nps,
  avgDeliveryHours,
];

/** A quarter-to-date progress figure — measured against the FULL-quarter target, not the prorated one. */
export interface QtdProgress {
  id: string;
  label: string;
  unit: KpiUnit;
  actual: number;
  /** The full-quarter target (not prorated — `kpi-pace-01` prorates it itself for the "expected by today" marker). */
  targetFullQuarter: number;
  currency?: string;
}

export const revenueQtd: QtdProgress = {
  id: "revenue-qtd",
  label: "Revenue",
  unit: "currency",
  actual: revenue.actual,
  targetFullQuarter: 4_500_000,
};

export const ordersQtd: QtdProgress = {
  id: "orders-qtd",
  label: "Orders shipped",
  unit: "count",
  actual: ordersShipped.actual,
  targetFullQuarter: 9_200,
};
