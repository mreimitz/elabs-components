import { nps, onTimeDelivery } from "@/components/kpi-card-parts/data/acme-quarter";

/**
 * "How big is it in human terms?" needs a whole broken into a SMALL number of
 * countable units (a row of 10 or 12), not a percentage. Every number below
 * is derived from the shared Acme Logistics Q3 dataset's `onTimeDelivery`/
 * `nps` facts, never re-typed, so a rate here can never drift from the KPI
 * card that states it as a plain percentage.
 */

/** One statement's worked "N in M" fraction plus the exact rate it approximates. */
export interface RatioStatement {
  /** How many of the `denominator` units the statement highlights. */
  numerator: number;
  denominator: number;
  /** The exact rate (0–100) the fraction rounds — always shown alongside the rounded headline. */
  exactPct: number;
}

/**
 * Nearest "1 in N" fraction for a rate (0–100): `N = round(100 / rate)`. Never
 * hand-picked — the headline can't silently drift from the rate it restates.
 */
export function nearestUnitFraction(ratePct: number): RatioStatement {
  const denominator = Math.max(1, Math.round(100 / ratePct));
  return { numerator: 1, denominator, exactPct: ratePct };
}

/** Orders that did NOT arrive on time, this quarter and last year. */
export const lateDeliveryRatePct = 100 - onTimeDelivery.actual;
export const lateDeliveryRatePctPriorYear = 100 - onTimeDelivery.priorYear;
export const lateDeliveryRatio = nearestUnitFraction(lateDeliveryRatePct);
export const lateDeliveryRatioPriorYear = nearestUnitFraction(lateDeliveryRatePctPriorYear);

/**
 * NPS respondent shares consistent with `nps.actual` (42): promoters −
 * detractors must equal the NPS score, which floors promoters at 42% (since
 * detractors ≥ 0) — so a headline near "3 in 10" is arithmetically
 * impossible at this NPS. Detractors 8% keeps promoters at an exact 50%
 * (no rounding needed for the headline fraction), passives fill the rest.
 */
export interface NpsBreakdown {
  promotersPct: number;
  passivesPct: number;
  detractorsPct: number;
}

export const npsBreakdown: NpsBreakdown = {
  promotersPct: 50,
  passivesPct: 42,
  detractorsPct: 8,
};

export const npsBreakdownPriorYear: NpsBreakdown = {
  promotersPct: 48,
  passivesPct: 42,
  detractorsPct: 10,
};

export const promoterRatio = nearestUnitFraction(npsBreakdown.promotersPct);
export const promoterRatioPriorYear = nearestUnitFraction(npsBreakdownPriorYear.promotersPct);

if (npsBreakdown.promotersPct - npsBreakdown.detractorsPct !== nps.actual) {
  throw new Error("npsBreakdown must be consistent with nps.actual (promoters − detractors)");
}
if (npsBreakdown.promotersPct + npsBreakdown.passivesPct + npsBreakdown.detractorsPct !== 100) {
  throw new Error("npsBreakdown shares must sum to 100");
}
if (npsBreakdownPriorYear.promotersPct - npsBreakdownPriorYear.detractorsPct !== nps.priorYear) {
  throw new Error("npsBreakdownPriorYear must be consistent with nps.priorYear");
}
