import { AS_OF_DATE } from "@/components/kpi-card-parts/data/acme-quarter";

/** One day's outcome. `met` is true for an on-time delivery day / an incident-free deploy day. */
export interface StreakDay {
  /** ISO `yyyy-mm-dd`, UTC. */
  date: string;
  met: boolean;
}

/** Both windows a card reads: the trailing 30 days, and the 30 days before that (the comparison baseline). */
export interface StreakWindow {
  days: StreakDay[];
  priorDays: StreakDay[];
}

const HASH_A = 73_856_093;
const HASH_B = 19_349_663;

/** A deterministic pseudo-random number in `[0, 1)` for the pair `(i, k)` — never `Math.random()`. */
function seededRandom(i: number, k: number): number {
  return Math.abs(((i * HASH_A) ^ (k * HASH_B)) % 1000) / 1000;
}

/**
 * `missCount` day-indices out of `total`, chosen by a deterministic seeded
 * shuffle rather than picked by hand — WHICH days miss is pseudo-random, how
 * MANY do is exact. `protectRecent` keeps the most recent days out of the
 * draw, so the window always ends on a real current streak.
 */
function pickMissedDays(
  total: number,
  missCount: number,
  seed: number,
  protectRecent = 0,
): number[] {
  const candidates = Array.from({ length: total - protectRecent }, (_, i) => i);
  candidates.sort((a, b) => seededRandom(a, seed) - seededRandom(b, seed));
  return candidates.slice(0, missCount).sort((a, b) => a - b);
}

const WINDOW = 30;

/** ISO date `daysBefore` days before the shared snapshot date (`AS_OF_DATE`), at UTC midnight. */
function isoDateBefore(daysBefore: number): string {
  const date = new Date(AS_OF_DATE);
  date.setUTCDate(date.getUTCDate() - daysBefore);
  return date.toISOString().slice(0, 10);
}

/**
 * Builds one 30-day window, oldest day first. `daysBeforeToday` is how many
 * days before the snapshot THIS window's last day sits — 0 for the current
 * (trailing) window, `WINDOW` for the one immediately before it — so the two
 * windows are contiguous and never overlap.
 */
function buildWindow(missedIndices: readonly number[], daysBeforeToday: number): StreakDay[] {
  return Array.from({ length: WINDOW }, (_, i) => ({
    date: isoDateBefore(daysBeforeToday + (WINDOW - 1 - i)),
    met: !missedIndices.includes(i),
  }));
}

/**
 * "SLA met 27 of 30 days" — a daily on-time-delivery gate (≥90% of that
 * day's deliveries) consistent with the shared dataset's 91.4% QTD on-time
 * rate: most days clear it, three do not.
 */
export const slaComplianceWindow: StreakWindow = {
  days: buildWindow(pickMissedDays(WINDOW, 3, 501, 3), 0),
  priorDays: buildWindow(pickMissedDays(WINDOW, 5, 601, 3), WINDOW),
};

/**
 * "Deploys without incident: 18-day streak" — two named incident days,
 * placed (not searched for) so the trailing run is exactly the 18 days the
 * card's own headline states; the prior window's three incidents are what
 * the 18-day run is an improvement ON.
 */
export const deployReliabilityWindow: StreakWindow = {
  days: buildWindow([3, 11], 0),
  priorDays: buildWindow([6, 14, 22], WINDOW),
};
