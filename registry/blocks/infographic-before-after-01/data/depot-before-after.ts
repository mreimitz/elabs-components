import { onTimeByDepot, revenueByDepot } from "@/components/kpi-movers-01/data/depot-movers";

/**
 * Two-time-point depot facts for the "who improved, who slipped?" slope
 * chart — Q2 (start) → Q3 (end, the same quarter every other Acme Logistics
 * KPI block reports). Both series below are a re-shaped SUBSET of
 * `kpi-movers-01`'s own `onTimeByDepot`/`revenueByDepot`, imported rather
 * than re-typed, so a depot's Q2/Q3 figure reads identically in the movers
 * card and here (`.claude/rules/registry.md`'s `@/` cross-item alias). Each
 * subset keeps the network's TRUE biggest riser and biggest faller by signed
 * change (not just the two the previous, block-owned numbers happened to
 * pick) so `findNotable()` in the component names the real story.
 */

export interface BeforeAfterPoint {
  id: string;
  label: string;
  /** Q2 value. */
  start: number;
  /** Q3 value — the same quarter `acme-quarter.ts` reports. */
  end: number;
}

function pointsFor(
  ids: string[],
  byId: Map<string, { label: string; prior: number; current: number }>,
) {
  return ids.map((id) => {
    const depot = byId.get(id);
    if (!depot) {
      throw new Error(`no depot "${id}"`);
    }
    return { id, label: depot.label, start: depot.prior, end: depot.current };
  });
}

const onTimeById = new Map(onTimeByDepot.map((d) => [d.id, d]));
const revenueById = new Map(revenueByDepot.map((d) => [d.id, d]));

/**
 * On-time delivery rate (%), by depot, Q2 → Q3. Higher is better. Six of the
 * network's ten depots — Munich (+5.7pp) is the true biggest riser,
 * Nuremberg (−8.2pp) the true biggest faller. Berlin, Cologne, Dresden and
 * Frankfurt are omitted: not because they are uninteresting, but because
 * their Q2 values cluster within ~1pp of a kept depot's, and a slope
 * chart's collision-spaced labels drift away from their own marker when too
 * many rows start within a couple of points of each other — six well-spread
 * start values keep every label beside the point it names.
 */
export const onTimeQ2ToQ3: BeforeAfterPoint[] = pointsFor(
  ["stuttgart", "munich", "hamburg", "nuremberg", "dusseldorf", "leipzig"],
  onTimeById,
);

/**
 * Revenue (EUR), by depot, Q2 → Q3. Higher is better. Düsseldorf (+€41.5K) is
 * the true biggest riser, Munich (−€107.9K) the true biggest faller; the
 * other four are picked for the same even-spread-of-start-values reason as
 * `onTimeQ2ToQ3` above.
 */
export const revenueQ2ToQ3: BeforeAfterPoint[] = pointsFor(
  ["dusseldorf", "frankfurt", "stuttgart", "hamburg", "berlin", "munich"],
  revenueById,
);
