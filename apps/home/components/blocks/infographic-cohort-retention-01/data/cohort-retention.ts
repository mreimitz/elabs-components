// registry: infographic-cohort-retention-01 — copied 2026-09-19
/**
 * Monthly signup cohorts for "Acme Connect", the self-serve shipper portal —
 * eight cohorts (Jan–Aug 2026), snapshotted the same day as the shared Acme
 * Logistics Q3 dataset (`AS_OF_DATE`, 31 Aug 2026).
 *
 * Every cell stores the two typed FACTS — `signedUp` (cohort size) and
 * `retained` (how many were still active N months later) — never a
 * pre-typed percentage: {@link retentionPct} is the one place a rate is
 * computed, so it can never silently drift from the counts it comes from.
 * A cohort's `retained` sequence is authored strictly non-increasing by
 * construction (retention never recovers month over month).
 *
 * A cohort younger than N months has NO row for that `monthsSince` — it was
 * never measured, not measured-at-zero — which is what draws the heatmap's
 * empty upper-right triangle instead of a fabricated zero.
 */

export interface CohortCell {
  /** Row label, e.g. "Jan 2026". */
  cohort: string;
  /** 0-based chronological index, Jan 2026 = 0. */
  cohortIndex: number;
  /** Column: whole months elapsed since signup (0 = signup month itself). */
  monthsSince: number;
  /** Cohort size — customers who signed up that month. */
  signedUp: number;
  /** How many of `signedUp` were still active `monthsSince` months later. */
  retained: number;
}

export interface CohortRetentionScenario {
  id: string;
  /** Row order, chronological — also `HeatmapChart`'s `yOrder`. */
  cohortOrder: string[];
  cells: CohortCell[];
  /** Which cohort the single annotation calls out. */
  highlightCohort: string;
  /** Which column (months since signup) the annotation compares at. */
  highlightMonthsSince: number;
  /** The other cohorts the highlighted one is measured against — always the
   * ones with a real (non-empty) value at `highlightMonthsSince`, named
   * explicitly rather than inferred, so the comparison set is never silently
   * whatever the triangle happens to contain. */
  peerCohorts: string[];
  /** Short editorial context for why this cohort differs — stated, not implied. */
  context: string;
}

/** One decimal — enough to tell 61.9% from 62.1% without a false precision. */
export function retentionPct(cell: CohortCell): number {
  return Math.round((cell.retained / cell.signedUp) * 1000) / 10;
}

export interface CohortFindingGap {
  highlightPct: number;
  peerAvgPct: number;
  /** Signed whole percentage points; positive = the highlighted cohort did better. */
  gapPp: number;
  direction: "better" | "worse";
}

/** The one place the annotation's numbers are computed — never re-typed in copy. */
export function cohortFindingGap(scenario: CohortRetentionScenario): CohortFindingGap {
  const highlight = scenario.cells.find(
    (cell) =>
      cell.cohort === scenario.highlightCohort &&
      cell.monthsSince === scenario.highlightMonthsSince,
  );
  const peers = scenario.cells.filter(
    (cell) =>
      scenario.peerCohorts.includes(cell.cohort) &&
      cell.monthsSince === scenario.highlightMonthsSince,
  );
  const highlightPct = highlight ? retentionPct(highlight) : 0;
  const peerAvgPct = peers.length
    ? Math.round((peers.reduce((sum, cell) => sum + retentionPct(cell), 0) / peers.length) * 10) /
      10
    : 0;
  const gapPp = Math.round(highlightPct - peerAvgPct);
  return { highlightPct, peerAvgPct, gapPp, direction: gapPp >= 0 ? "better" : "worse" };
}

const COHORT_ORDER = [
  "Jan 2026",
  "Feb 2026",
  "Mar 2026",
  "Apr 2026",
  "May 2026",
  "Jun 2026",
  "Jul 2026",
  "Aug 2026",
];

const SIGNED_UP: Record<string, number> = {
  "Jan 2026": 420,
  "Feb 2026": 445,
  "Mar 2026": 460,
  "Apr 2026": 480,
  "May 2026": 505,
  "Jun 2026": 530,
  "Jul 2026": 560,
  "Aug 2026": 590,
};

/** Build one cohort's rows from a signup count and a strictly-descending retention curve (%). */
function buildCohortRows(
  cohort: string,
  cohortIndex: number,
  retentionCurvePct: number[],
): CohortCell[] {
  const signedUp = SIGNED_UP[cohort] as number;
  return retentionCurvePct.map((pct, monthsSince) => ({
    cohort,
    cohortIndex,
    monthsSince,
    signedUp,
    retained: Math.round((signedUp * pct) / 100),
  }));
}

// ── Scenario 1: the onboarding fix (default) ────────────────────────────────
// The typical curve every cohort follows, absent a deliberate change.
const NORMAL_CURVE_PCT = [100, 78, 68, 62, 58, 55, 53, 51];
// March shipped a reworked first-week onboarding flow; its curve holds up
// visibly better at every later month than the cohorts around it.
const MARCH_FIX_CURVE_PCT = [100, 84, 76, 74, 70, 68];

export const onboardingFixCohorts: CohortRetentionScenario = {
  id: "onboarding-fix",
  cohortOrder: COHORT_ORDER,
  cells: [
    ...buildCohortRows("Jan 2026", 0, NORMAL_CURVE_PCT),
    ...buildCohortRows("Feb 2026", 1, NORMAL_CURVE_PCT.slice(0, 7)),
    ...buildCohortRows("Mar 2026", 2, MARCH_FIX_CURVE_PCT),
    ...buildCohortRows("Apr 2026", 3, NORMAL_CURVE_PCT.slice(0, 5)),
    ...buildCohortRows("May 2026", 4, NORMAL_CURVE_PCT.slice(0, 4)),
    ...buildCohortRows("Jun 2026", 5, NORMAL_CURVE_PCT.slice(0, 3)),
    ...buildCohortRows("Jul 2026", 6, NORMAL_CURVE_PCT.slice(0, 2)),
    ...buildCohortRows("Aug 2026", 7, NORMAL_CURVE_PCT.slice(0, 1)),
  ],
  highlightCohort: "Mar 2026",
  highlightMonthsSince: 3,
  peerCohorts: ["Jan 2026", "Feb 2026", "Apr 2026", "May 2026"],
  context: "after the reworked first-week onboarding flow shipped in March",
};

// ── Scenario 2: worsening recent cohorts (alternate) ────────────────────────
// A support-capacity incident in May degraded onboarding for every cohort
// that signed up from May onward; Jan–Apr are unaffected.
const MAY_INCIDENT_CURVE_PCT = [100, 70, 58, 50];
const JUN_INCIDENT_CURVE_PCT = [100, 66, 52];
const JUL_INCIDENT_CURVE_PCT = [100, 62];

export const incidentCohorts: CohortRetentionScenario = {
  id: "incident",
  cohortOrder: COHORT_ORDER,
  cells: [
    ...buildCohortRows("Jan 2026", 0, NORMAL_CURVE_PCT),
    ...buildCohortRows("Feb 2026", 1, NORMAL_CURVE_PCT.slice(0, 7)),
    ...buildCohortRows("Mar 2026", 2, NORMAL_CURVE_PCT.slice(0, 6)),
    ...buildCohortRows("Apr 2026", 3, NORMAL_CURVE_PCT.slice(0, 5)),
    ...buildCohortRows("May 2026", 4, MAY_INCIDENT_CURVE_PCT),
    ...buildCohortRows("Jun 2026", 5, JUN_INCIDENT_CURVE_PCT),
    ...buildCohortRows("Jul 2026", 6, JUL_INCIDENT_CURVE_PCT),
    ...buildCohortRows("Aug 2026", 7, NORMAL_CURVE_PCT.slice(0, 1)),
  ],
  highlightCohort: "Jun 2026",
  highlightMonthsSince: 1,
  peerCohorts: ["Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026"],
  context: "since the May support-capacity incident",
};

export const MONTHS_SINCE_MAX = 7;
