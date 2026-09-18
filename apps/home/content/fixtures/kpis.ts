/**
 * Ashgrove's KPI set — the hero and the dashboard tab's KPI strip both read this module, so
 * the number the hero shows and the number the chart's last point draws are the SAME value
 * (RM-095, concept §5 "Real size, real data").
 *
 * Five weekly series over the 13 weeks of `company.ts`' `FISCAL_QUARTER_WEEKS`. Every
 * headline (`KPI_HEADLINES`) is READ from its series' last point, and every delta is
 * COMPUTED from first vs. last point — never a second, hand-typed number that could drift
 * from the series it describes.
 */
import { FISCAL_QUARTER_WEEKS, REGIONS, type Region } from "./company";
import { mulberry32 } from "./lib/prng";

export interface WeeklyPoint {
  /** ISO week-ending date, one of `FISCAL_QUARTER_WEEKS`. */
  week: string;
  value: number;
}

export type KpiUnit = "usd" | "percent" | "accounts" | "tickets";

export interface KpiSeries {
  id: string;
  label: string;
  unit: KpiUnit;
  points: WeeklyPoint[];
}

/** A smooth seeded walk from `start` to roughly `start + drift`, jittered by `jitter`. */
function walk(seed: number, start: number, drift: number, jitter: number, round = 2): number[] {
  const rnd = mulberry32(seed);
  return FISCAL_QUARTER_WEEKS.map((_, i) => {
    const t = i / (FISCAL_QUARTER_WEEKS.length - 1);
    const base = start + drift * t;
    const noise = (rnd() - 0.5) * 2 * jitter;
    const value = base + noise;
    const factor = 10 ** round;
    return Math.round(value * factor) / factor;
  });
}

function series(id: string, label: string, unit: KpiUnit, values: number[]): KpiSeries {
  return {
    id,
    label,
    unit,
    points: FISCAL_QUARTER_WEEKS.map((week, i) => ({ week, value: values[i]! })),
  };
}

// ── The five series ───────────────────────────────────────────────────────────
export const ARR_SERIES = series(
  "arr",
  "Annual recurring revenue",
  "usd",
  walk(101, 38_400_000, 3_100_000, 180_000, 0),
);
export const NRR_SERIES = series(
  "nrr",
  "Net revenue retention",
  "percent",
  walk(102, 109.4, -1.1, 0.6),
);
export const CHURN_SERIES = series("churn", "Logo churn", "percent", walk(103, 3.1, 1.7, 0.25));
export const ACTIVE_ACCOUNTS_SERIES = series(
  "active-accounts",
  "Active accounts",
  "accounts",
  walk(104, 1_204, 58, 12, 0),
);
export const SUPPORT_BACKLOG_SERIES = series(
  "support-backlog",
  "Support backlog",
  "tickets",
  walk(105, 64, -9, 6, 0),
);

/**
 * Churn by region — EMEA rises fastest, which is the fact the tour's chat use case
 * (`conversation.ts`) and copy (`README.md`) read off of. Not part of the headline
 * invariant (only the OVERALL churn series is), but every number here is still a seeded
 * derivation, never typed.
 */
export const CHURN_BY_REGION: Record<Region, KpiSeries> = Object.fromEntries(
  REGIONS.map((region, i) => {
    // EMEA (index 0) drifts up hardest; the others stay closer to flat.
    const drift = region === "EMEA" ? 2.6 : 0.6 + i * 0.15;
    const start = region === "EMEA" ? 2.9 : 3.0 + i * 0.1;
    return [
      region,
      series(
        `churn-${region.toLowerCase()}`,
        `Logo churn — ${region}`,
        "percent",
        walk(200 + i, start, drift, 0.3),
      ),
    ];
  }),
) as Record<Region, KpiSeries>;

export const KPI_SERIES: KpiSeries[] = [
  ARR_SERIES,
  NRR_SERIES,
  CHURN_SERIES,
  ACTIVE_ACCOUNTS_SERIES,
  SUPPORT_BACKLOG_SERIES,
];

/** The series' last point — the "headline" number a KPI tile shows. */
export function headlineValue(s: KpiSeries): number {
  return s.points[s.points.length - 1]!.value;
}

/** Last point minus first point — COMPUTED, never a second typed number. */
export function headlineDelta(s: KpiSeries): number {
  return headlineValue(s) - s.points[0]!.value;
}

export interface KpiHeadline {
  id: string;
  label: string;
  unit: KpiUnit;
  value: number;
  delta: number;
}

function headline(s: KpiSeries): KpiHeadline {
  return {
    id: s.id,
    label: s.label,
    unit: s.unit,
    value: headlineValue(s),
    delta: headlineDelta(s),
  };
}

/**
 * The hero's KPI strip. `headlines.find((h) => h.id === "churn")!.value` MUST equal
 * `CHURN_SERIES.points.at(-1)!.value` — it is the same read, so it always does
 * (`fixtures.test.ts` asserts it anyway, as the concept's named invariant).
 */
export const KPI_HEADLINES: KpiHeadline[] = KPI_SERIES.map(headline);
