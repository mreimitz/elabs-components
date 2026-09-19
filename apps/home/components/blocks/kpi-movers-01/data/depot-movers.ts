// registry: kpi-movers-01 — copied 2026-09-19
import { revenue } from "../../kpi-card-parts/data/acme-quarter";

/**
 * "What changed most?" needs a full ranked field to move WITHIN, not just the
 * few rows a card ends up showing — `rankMovers`/`topMovers` below compute
 * every row's rank (this quarter and last) and its places-moved from these
 * FACTS, never from a pre-typed rank or delta.
 */
export interface DepotMetricPoint {
  id: string;
  label: string;
  /** This quarter's value. */
  current: number;
  /** Last quarter's value, same unit. */
  prior: number;
}

/**
 * On-time delivery rate by depot, this quarter vs last quarter — the
 * current-quarter values average to `onTimeDelivery.actual` (91.4%), the
 * shared Acme Logistics Q3 dataset's own company-wide figure.
 */
export const onTimeByDepot: DepotMetricPoint[] = [
  { id: "berlin", label: "Berlin", current: 97.3, prior: 92.4 },
  { id: "munich", label: "Munich", current: 95.8, prior: 90.1 },
  { id: "hamburg", label: "Hamburg", current: 94.3, prior: 90.9 },
  { id: "cologne", label: "Cologne", current: 93.3, prior: 94.1 },
  { id: "frankfurt", label: "Frankfurt", current: 92.6, prior: 91.4 },
  { id: "stuttgart", label: "Stuttgart", current: 91.8, prior: 89.3 },
  { id: "dusseldorf", label: "Düsseldorf", current: 90.3, prior: 93.6 },
  { id: "leipzig", label: "Leipzig", current: 88.3, prior: 95.6 },
  { id: "dresden", label: "Dresden", current: 86.5, prior: 89.9 },
  { id: "nuremberg", label: "Nuremberg", current: 83.8, prior: 92.0 },
];

/**
 * Revenue by depot, this quarter vs last quarter — the current-quarter
 * values sum EXACTLY to `revenue.actual` (2,885,870).
 */
export const revenueByDepot: DepotMetricPoint[] = [
  { id: "berlin", label: "Berlin", current: 520_000, prior: 504_854 },
  { id: "munich", label: "Munich", current: 460_000, prior: 567_901 },
  { id: "hamburg", label: "Hamburg", current: 410_000, prior: 390_476 },
  { id: "cologne", label: "Cologne", current: 320_000, prior: 313_725 },
  { id: "frankfurt", label: "Frankfurt", current: 300_000, prior: 260_870 },
  { id: "stuttgart", label: "Stuttgart", current: 270_000, prior: 321_429 },
  { id: "dusseldorf", label: "Düsseldorf", current: 230_000, prior: 188_525 },
  { id: "leipzig", label: "Leipzig", current: 160_000, prior: 135_593 },
  { id: "dresden", label: "Dresden", current: 120_000, prior: 139_535 },
  { id: "nuremberg", label: "Nuremberg", current: 95_870, prior: 94_921 },
];

if (revenueByDepot.reduce((sum, d) => sum + d.current, 0) !== revenue.actual) {
  throw new Error("revenueByDepot must sum to revenue.actual");
}

/** One depot's computed rank + movement for a metric. */
export interface RankedMover extends DepotMetricPoint {
  /** The metric's own signed change (pp for a rate, % for a relative change) — see `changeFn`. */
  change: number;
  rankNow: number;
  rankPrior: number;
  /** Positive = moved UP (a better/lower rank number) this quarter. */
  placesMoved: number;
}

function rankDescendingBy(
  points: DepotMetricPoint[],
  key: "current" | "prior",
): Map<string, number> {
  const sorted = [...points].sort((a, b) => b[key] - a[key]);
  return new Map(sorted.map((p, i) => [p.id, i + 1]));
}

/** Ranks every depot (descending, higher is better for both metrics here) and computes its movement. */
export function rankMovers(
  points: DepotMetricPoint[],
  changeFn: (p: DepotMetricPoint) => number,
): RankedMover[] {
  const rankNow = rankDescendingBy(points, "current");
  const rankPrior = rankDescendingBy(points, "prior");
  return points.map((p) => {
    const now = rankNow.get(p.id) ?? points.length;
    const prior = rankPrior.get(p.id) ?? points.length;
    return { ...p, change: changeFn(p), rankNow: now, rankPrior: prior, placesMoved: prior - now };
  });
}

/** The `n` biggest risers and `n` biggest fallers by `change`, each sorted most-extreme-first. */
export function topMovers(
  ranked: RankedMover[],
  n = 3,
): { risers: RankedMover[]; fallers: RankedMover[] } {
  const sorted = [...ranked].sort((a, b) => b.change - a.change);
  return { risers: sorted.slice(0, n), fallers: sorted.slice(-n).reverse() };
}

/** pp change vs last quarter — for a rate metric like on-time delivery. */
export function ppChange(p: DepotMetricPoint): number {
  return p.current - p.prior;
}

/** Relative % change vs last quarter — for a magnitude metric like revenue. */
export function pctChange(p: DepotMetricPoint): number {
  return p.prior === 0 ? 0 : ((p.current - p.prior) / p.prior) * 100;
}
