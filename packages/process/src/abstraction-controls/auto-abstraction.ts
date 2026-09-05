/**
 * Auto abstraction heuristic — RM-052 (issue #227).
 *
 * The "Auto" button on {@link AbstractionControls} picks an activities fraction that fits
 * a node budget, so a reader opens a busy graph and gets a readable one in one click
 * instead of hand-dragging a slider. This module is pure and framework-free on purpose —
 * it is a small, independently testable piece of judgment, not a UI concern.
 *
 * ## The heuristic
 *
 * "Smallest activities % whose graph fits the budget" is the phrase this feature is
 * usually described by, but taken literally it is degenerate: a fraction near 0 always
 * fits any budget, so the "smallest fraction" reading is trivially satisfied by hiding
 * almost everything. What a reader actually wants from "Auto" is the OPPOSITE end of
 * that: the LARGEST fraction — the most detail — that still fits the budget. This module
 * implements that reading.
 *
 * ## Bounded and terminating, by construction
 *
 * The search is a fixed-iteration binary search over the fraction range `[minFraction,
 * 1]` — `maxSteps` (default 8) iterations, no early-exit convergence check, no
 * data-dependent loop bound. That makes termination a property of the `for` loop itself,
 * not of the input: `computeAutoAbstraction` always does at most `maxSteps` probes of
 * `keptAt(fraction)`, regardless of how many activities the graph has. See
 * `auto-abstraction.test.ts` for the explicit bound assertion.
 *
 * ## Known limitation: this heuristic is topology-blind (RM-052 round 2, #227, F2)
 *
 * `keptActivityCount` predicts how many activities a fraction keeps from the COUNT alone —
 * `round(total * fraction)`. It has no visibility into which activities `abstractGraph`
 * would actually drop, or how they connect. `abstractGraph`'s default `keepConnected: true`
 * adds activities back in to restore reachability to a start/end activity that truncation
 * would otherwise strand — and on a graph with no bypass edges (a strict, unbranched chain,
 * where every activity's only path to the end activity runs through every activity after
 * it), dropping ANY suffix forces the ENTIRE remainder back in. The naive prediction and the
 * real, reconnected result can then diverge by the graph's full size: a 30-activity chain
 * with `maxActivities: 10` predicts a fraction that keeps 10 activities, but
 * `abstractGraph(graph, { activities: fraction, keepConnected: true })` actually keeps all
 * 30 — see `auto-abstraction.test.ts`'s "known limitation" describe block, which measures
 * this exact case and isolates `keepConnected` as the sole cause (turning it off makes the
 * real result match the naive prediction exactly).
 *
 * This is accepted as a best-effort gap, not fixed here: fixing it precisely would mean this
 * module accepting a real `ProcessGraph` and searching against `abstractGraph`'s actual
 * output rather than a plain count — a signature change that would also require updating
 * `AbstractionControls`'s call site (`handleAuto`), which sits outside this round's write-set
 * (RM-052-fix-brief.md / RM-052-tristate-decision.md §10). A future round that wants an exact
 * search should route that signature change through `brand-ui-design-system-architect` (it
 * changes this module's public contract) rather than patching around it here.
 */
export interface AutoAbstractionOptions {
  /** Largest number of activities the resulting view should keep. Default `25`. */
  maxActivities?: number;
  /** Maximum fraction candidates probed before returning the best found so far. Default `8`. */
  maxSteps?: number;
  /** The smallest fraction ever offered — "Auto" never hides everything. Default `0.05`. */
  minFraction?: number;
}

export interface AutoAbstractionResult {
  /** The activities fraction to hand to `setAbstraction`. */
  activities: number;
  /** How many fraction candidates were actually probed — always `<= maxSteps`. */
  steps: number;
}

const DEFAULT_MAX_ACTIVITIES = 25;
const DEFAULT_MAX_STEPS = 8;
const DEFAULT_MIN_FRACTION = 0.05;

/**
 * Mirrors `abstractGraph`'s own kept-activity count: `round(total * fraction)`, floored at
 * one activity — `abstractGraph` never hides every activity, so this heuristic must not
 * search for a fraction that would.
 */
function keptActivityCount(total: number, fraction: number): number {
  return Math.max(1, Math.round(total * fraction));
}

/**
 * Picks the activities fraction "Auto" applies, from a plain activity COUNT — not a graph.
 * Paths are left to `abstractGraph`'s own connectivity repair, and duration/statistic
 * fields never enter the search, so this heuristic's result cannot be perturbed by the
 * discovery layer's own reservoir-sampling nondeterminism. Taking a count rather than a
 * `ProcessGraph` also lets a caller pass the graph's PRE-abstraction total — e.g.
 * `graph.activities.length + hiddenCounts.activities` — without building a throwaway array.
 */
export function computeAutoAbstraction(
  totalActivities: number,
  opts: AutoAbstractionOptions = {},
): AutoAbstractionResult {
  const maxActivities = opts.maxActivities ?? DEFAULT_MAX_ACTIVITIES;
  const maxSteps = opts.maxSteps ?? DEFAULT_MAX_STEPS;
  const minFraction = opts.minFraction ?? DEFAULT_MIN_FRACTION;
  const total = totalActivities;

  // Already within budget at full detail (or nothing to abstract) — nothing to search for.
  if (total === 0 || keptActivityCount(total, 1) <= maxActivities) {
    return { activities: 1, steps: 0 };
  }

  // Even the floor doesn't fit — hand back the floor. Still bounded (one probe), still
  // the best answer this heuristic can offer for a graph this large.
  if (keptActivityCount(total, minFraction) > maxActivities) {
    return { activities: minFraction, steps: 1 };
  }

  let lo = minFraction; // largest fraction CONFIRMED to fit the budget so far
  let hi = 1; // smallest fraction confirmed NOT to fit
  let best = minFraction;

  for (let step = 1; step <= maxSteps; step += 1) {
    const mid = (lo + hi) / 2;
    if (keptActivityCount(total, mid) <= maxActivities) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
    if (step === maxSteps) {
      return { activities: best, steps: step };
    }
  }

  // Unreachable — maxSteps is always >= 1 when opts allow it — but keeps the function
  // total for TypeScript's control-flow analysis.
  return { activities: best, steps: maxSteps };
}
