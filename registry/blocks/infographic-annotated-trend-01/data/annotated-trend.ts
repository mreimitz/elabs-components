import { AS_OF_DATE } from "@/components/kpi-card-parts/data/acme-quarter";
import type { KpiUnit } from "@/components/kpi-card-parts/format";

/**
 * A longer trailing window than the shared Acme Logistics Q3 dataset's own
 * 13-week series (`kpi-card-parts/data/acme-quarter.ts`) — this block needs
 * enough history to place three well-separated events, so it defines its OWN
 * 20-week series here rather than importing one, while staying the same
 * fictional company, unit and snapshot date (`AS_OF_DATE`, 31 Aug, day 62 of
 * Q3). Every value below is a typed FACT; nothing here is a delta computed
 * from something else, so there is nothing that could silently drift.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** `n` weekly dates ending exactly at `end` (index `n - 1` is `end` itself). */
function weeklyDates(end: Date, n: number): Date[] {
  return Array.from({ length: n }, (_, i) => new Date(end.getTime() - (n - 1 - i) * WEEK_MS));
}

export interface TrendPoint {
  date: Date;
  value: number;
}

/** One labelled event, anchored to a real point on the series (never an
 * interpolated position) — `value` matches that week's own reading exactly. */
export interface TrendEvent {
  date: Date;
  label: string;
  value: number;
}

export interface AnnotatedTrendSeries {
  id: string;
  label: string;
  unit: KpiUnit;
  higherIsBetter: boolean;
  points: TrendPoint[];
  events: TrendEvent[];
  /** States the finding in words — never left for the reader to infer. */
  headline: string;
  methodNote: string;
}

const ORDERS_WEEKLY = [
  640, 648, 652, 645, 610, 615, 625, 640, 655, 665, 672, 520, 660, 670, 680, 690, 695, 735, 725,
  712,
];
const ordersDates = weeklyDates(AS_OF_DATE, ORDERS_WEEKLY.length);

/** Weekly shipped orders — a price change and a depot outage both dented
 * volume; only one of them left a mark that lasted. */
export const ordersTrend: AnnotatedTrendSeries = {
  events: [
    { date: ordersDates[4] as Date, label: "Price increase", value: ORDERS_WEEKLY[4] as number },
    { date: ordersDates[11] as Date, label: "Depot outage", value: ORDERS_WEEKLY[11] as number },
    { date: ordersDates[17] as Date, label: "Autumn campaign", value: ORDERS_WEEKLY[17] as number },
  ],
  headline: "A one-week depot outage cost more volume than the price change ever did",
  higherIsBetter: true,
  id: "orders",
  label: "Orders shipped",
  methodNote: "Weekly shipped orders, 20 trailing weeks.",
  points: ordersDates.map((date, i) => ({ date, value: ORDERS_WEEKLY[i] as number })),
  unit: "count",
};

const ON_TIME_WEEKLY = [
  93.5, 93.8, 94.0, 93.6, 94.2, 94.5, 90.5, 89.0, 88.2, 89.5, 91.0, 92.5, 93.0, 93.4, 93.8, 94.0,
  94.3, 94.6, 94.8, 95.0,
];
const onTimeDates = weeklyDates(AS_OF_DATE, ON_TIME_WEEKLY.length);

/** Weekly on-time delivery rate — a staff shortage cost five points; the fix
 * that followed it more than recovered them. */
export const onTimeTrend: AnnotatedTrendSeries = {
  events: [
    { date: onTimeDates[4] as Date, label: "New route added", value: ON_TIME_WEEKLY[4] as number },
    { date: onTimeDates[8] as Date, label: "Staff shortage", value: ON_TIME_WEEKLY[8] as number },
    { date: onTimeDates[17] as Date, label: "Process fix", value: ON_TIME_WEEKLY[17] as number },
  ],
  headline:
    "A staff shortage cost five points of on-time delivery — the fix more than recovered them",
  higherIsBetter: true,
  id: "on-time-delivery",
  label: "On-time delivery",
  methodNote: "Weekly on-time delivery rate, 20 trailing weeks.",
  points: onTimeDates.map((date, i) => ({ date, value: ON_TIME_WEEKLY[i] as number })),
  unit: "percent",
};
