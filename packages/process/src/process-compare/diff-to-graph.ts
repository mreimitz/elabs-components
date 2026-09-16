/**
 * diffToProcessGraph — turn a `ProcessGraphDiff` (`/core`'s `diffGraphs`, RM-064) into the
 * ONE `ProcessGraph` `ProcessCompare`'s superimposed mode hands to a single `ProcessMap`,
 * plus a synthetic `ActivityColorScale` that paints by diff state instead of by identity.
 *
 * `ProcessMap` (RM-051) is never forked or given a new prop for this: its existing
 * `colorScale` prop (RM-054) is the only per-activity colour hook it exposes, and
 * `ActivityColorScale` is a plain interface — nothing stops a second caller building one
 * keyed by diff state rather than by rank. Pure, no React; lives beside `process-compare.tsx`
 * rather than under `/core` because it is presentation shaping for ONE component (label
 * suffixes, colour tokens), not a reusable process-mining derivation.
 */
import type {
  ActivityColor,
  ActivityColorLegendEntry,
  ActivityColorScale,
} from "../core/activity-color-scale";
import type { DiffEntry, DiffState, ProcessGraphDiff } from "../core/diff-graphs";
import type { ActivityStats, ProcessGraph, TransitionStats } from "../core/types";

/** Empty graph — the identity input for a side that has not discovered anything yet. */
export const EMPTY_PROCESS_GRAPH: ProcessGraph = {
  activities: [],
  transitions: [],
  startActivities: {},
  endActivities: {},
  totals: { cases: 0, events: 0, variants: 0 },
};

/**
 * The three diff tokens the design asks for (RM-064's spec): `common` reads as success,
 * `aOnly` as the first chart series, `bOnly` as destructive. Semantic tokens only — no
 * literal colour is authored (`.claude/rules/conventions.md`'s styling rule).
 */
export const DIFF_STATE_TOKEN: Record<DiffState, string> = {
  common: "--success",
  aOnly: "--chart-1",
  bOnly: "--destructive",
};

/** `b`'s stats when the element survives into `b` (common or bOnly); `a`'s otherwise. */
function representative<Stats>(entry: DiffEntry<Stats>): Stats {
  return (entry.b ?? entry.a) as Stats;
}

/**
 * The ONE `ProcessGraph` a superimposed `ProcessMap` renders: every activity/transition
 * either side ever saw, painted with whichever side's stats are the "current" reading (`b`
 * when present, `a` otherwise). `startActivities`/`endActivities` are recomputed from the
 * represented activities themselves, so they can never disagree with what `activities`
 * above actually carries. `totals` prefers `b`'s (the "current" period) and falls back to
 * `a`'s only when `b` measured nothing at all (e.g. a `b` side still loading).
 */
export function diffToProcessGraph(diff: ProcessGraphDiff): ProcessGraph {
  const activities: ActivityStats[] = diff.activities.map(representative);
  const transitions: TransitionStats[] = diff.transitions.map(representative);
  const totals =
    diff.totals.b.cases > 0 || diff.totals.b.events > 0 ? diff.totals.b : diff.totals.a;
  return {
    activities,
    transitions,
    startActivities: Object.fromEntries(
      activities
        .filter((activity) => activity.isStart)
        .map((activity) => [activity.id, activity.cases]),
    ),
    endActivities: Object.fromEntries(
      activities
        .filter((activity) => activity.isEnd)
        .map((activity) => [activity.id, activity.cases]),
    ),
    totals,
  };
}

/** Diff state per activity id, straight off {@link ProcessGraphDiff.activities}. */
export function diffStateByActivity(diff: ProcessGraphDiff): ReadonlyMap<string, DiffState> {
  return new Map(diff.activities.map((entry) => [entry.id, entry.state]));
}

/**
 * A synthetic `ActivityColorScale` that paints every activity by its DIFF STATE rather
 * than its identity. `colorFor` is the only method `ProcessMap` itself calls (see
 * `map-model.ts`'s `buildProcessMapModel`); `codeFor`/`labelFor`/`legend` exist only to
 * satisfy the shared interface.
 */
export function diffColorScale(diff: ProcessGraphDiff): ActivityColorScale {
  const states = diffStateByActivity(diff);
  const colorFor = (activityId: string): ActivityColor => ({
    token: DIFF_STATE_TOKEN[states.get(activityId) ?? "common"],
  });
  const legend: ActivityColorLegendEntry[] = diff.activities.map((entry) => ({
    activityId: entry.id,
    label: entry.id,
    code: entry.id.slice(0, 2).toUpperCase(),
    ...colorFor(entry.id),
  }));
  return {
    colorFor,
    codeFor: (activityId) => activityId.slice(0, 2).toUpperCase(),
    labelFor: (activityId) => activityId,
    legend,
  };
}
