/**
 * The "bikes" recipe (RM-111): monthly cycle traffic in four cities, as the
 * percentage change against the same month of 2019, Jan 2019 – Dec 2023.
 * Deterministic (a closed-form curve per city, no randomness) and built with
 * LOCAL-time `Date` constructors — d3 time intervals are local.
 */
import type { ChartAnnotation, ChartSpecAnnotation } from "./annotation-types";

/** The four series, in legend order, each on its own ramp step. */
export const BIKES_SERIES = [
  { key: "paris", label: "Paris", color: "var(--chart-1)" },
  { key: "berlin", label: "Berlin", color: "var(--chart-2)" },
  { key: "london", label: "London", color: "var(--chart-3)" },
  { key: "newYork", label: "New York", color: "var(--chart-4)" },
] as const;

const MONTHS = 60;

function change(i: number, lift: number, dip: number, phase: number): number {
  const t = i / 12;
  const covid = i >= 14 && i <= 29 ? -dip * Math.sin(((i - 14) / 15) * Math.PI) : 0;
  const trend = t < 1.2 ? 0 : lift * (1 - Math.exp(-(t - 1.2) * 1.4));
  const season = 4 * Math.sin((i / 12) * 2 * Math.PI + phase);
  return Math.round((trend + covid + season) * 10) / 10;
}

/** One row per month: `{ date, paris, berlin, london, newYork }`. */
export const BIKES_DATA: Array<Record<string, number | Date>> = Array.from(
  { length: MONTHS },
  (_, i) => ({
    date: new Date(2019 + Math.floor(i / 12), i % 12, 1),
    paris: change(i, 48, 10, 0.2),
    berlin: change(i, 14, 34, 0.6),
    london: change(i, 22, 18, 1.1),
    newYork: change(i, -6, 26, 1.7),
  }),
);

/** The recipe in `ChartSpec` form: ISO date strings, plain string notes. */
export const BIKES_SPEC_ANNOTATIONS: ChartSpecAnnotation[] = [
  { kind: "range", x1: "2020-03-01", x2: "2021-06-01", label: "Covid-19" },
  { kind: "line", y: 0, label: "±0", width: 2 },
  {
    kind: "text",
    x: "2021-09-01",
    y: 58,
    text: "Paris opens 50 km of pop-up cycle lanes and keeps them",
    color: "series:paris",
    width: 24,
    connector: { to: { x: "2022-01-01", y: 36 }, arrow: true },
  },
  {
    kind: "text",
    x: "2019-02-01",
    y: -22,
    text: "Berlin’s lockdown empties the commute",
    color: "series:berlin",
    width: 18,
    connector: { to: { x: "2020-08-01", y: -30 } },
  },
  {
    kind: "text",
    x: "2022-07-01",
    y: 4,
    text: "London’s low-traffic streets hold the gain",
    color: "series:london",
    anchor: "sw",
    width: 20,
  },
  {
    kind: "text",
    x: "2023-06-01",
    y: -16,
    text: "New York slips back below 2019",
    color: "series:newYork",
    anchor: "ne",
    width: 16,
  },
];

/**
 * The same annotations for an explicit container: identical to the spec form
 * (the layer reads ISO strings as local dates), so the two pictures match by
 * construction rather than by a hand-kept copy.
 */
export const BIKES_ANNOTATIONS: ChartAnnotation[] = BIKES_SPEC_ANNOTATIONS;
