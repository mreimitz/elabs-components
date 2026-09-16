/**
 * diffGraphs — RM-064's pure diff between two discovered `ProcessGraph`s, the model
 * `ProcessCompare` renders (side-by-side or superimposed).
 *
 * Activities are matched by `id` (the activity name — the same identity `/core` uses
 * everywhere else); transitions are matched by `source`+{@link EDGE_KEY_SEPARATOR}+`target`,
 * exactly the key `reconcileGraph`'s own `transitionKey` builds, so a transition that moved
 * between the two graphs is never mistaken for two unrelated ones. An element present on
 * both sides is `"common"`; present only in `a` is `"aOnly"`; present only in `b` is
 * `"bOnly"` — every element in the union appears in exactly one of the three states.
 *
 * `delta`/`ratio` are computed once BOTH sides have the element (a `"common"` entry) —
 * comparing a real reading against nothing would be a fabricated number, not a diff. The
 * reference metric is each element's plain occurrence count — `instances` for an activity,
 * `count` for a transition — because those are the only two fields every `ActivityStats`/
 * `TransitionStats` always carries (never derived, never optional), so a delta is always
 * well-defined for a `"common"` entry, whatever metric a downstream view happens to paint
 * with. `ratio` is omitted rather than `Infinity` when `a`'s value is `0`.
 *
 * Pure, deterministic, framework-free — see the module-level rule in `types.ts`.
 */
import { EDGE_KEY_SEPARATOR } from "./discover-graph";
import type { ActivityStats, ProcessGraph, TransitionStats } from "./types";

/** Which side(s) of the diff an activity or transition survives in. */
export type DiffState = "common" | "aOnly" | "bOnly";

/** One activity's or transition's diff — its identity, its state, and (when `"common"`) its delta. */
export interface DiffEntry<Stats> {
  id: string;
  state: DiffState;
  /** Present unless the element is `"bOnly"`. */
  a?: Stats;
  /** Present unless the element is `"aOnly"`. */
  b?: Stats;
  /** `b`'s reference value minus `a`'s. Only set for a `"common"` entry. */
  delta?: number;
  /** `b`'s reference value divided by `a`'s. Only set for a `"common"` entry with `a > 0`. */
  ratio?: number;
}

/** The full diff between two graphs. */
export interface ProcessGraphDiff {
  activities: DiffEntry<ActivityStats>[];
  transitions: DiffEntry<TransitionStats>[];
  totals: { a: ProcessGraph["totals"]; b: ProcessGraph["totals"] };
}

/** `source`+{@link EDGE_KEY_SEPARATOR}+`target` — the same key `reconcileGraph` builds. */
function transitionKey(transition: Pick<TransitionStats, "source" | "target">): string {
  return `${transition.source}${EDGE_KEY_SEPARATOR}${transition.target}`;
}

/** Every id in `first`, in order, then every id `second` adds that `first` did not have. */
function unionIds(first: string[], second: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of first) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of second) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function diffEntries<Stats>(
  aById: ReadonlyMap<string, Stats>,
  bById: ReadonlyMap<string, Stats>,
  ids: string[],
  referenceValue: (stats: Stats) => number,
): DiffEntry<Stats>[] {
  return ids.map((id) => {
    const a = aById.get(id);
    const b = bById.get(id);
    const state: DiffState = a !== undefined && b !== undefined ? "common" : a ? "aOnly" : "bOnly";
    const entry: DiffEntry<Stats> = { id, state };
    if (a !== undefined) entry.a = a;
    if (b !== undefined) entry.b = b;
    if (a !== undefined && b !== undefined) {
      const aValue = referenceValue(a);
      const bValue = referenceValue(b);
      entry.delta = bValue - aValue;
      if (aValue > 0) entry.ratio = bValue / aValue;
    }
    return entry;
  });
}

/**
 * Diff two discovered graphs. Neither input is mutated; the entries reference the original
 * `ActivityStats`/`TransitionStats` objects, never copies.
 */
export function diffGraphs(a: ProcessGraph, b: ProcessGraph): ProcessGraphDiff {
  const aActivities = new Map(a.activities.map((activity) => [activity.id, activity]));
  const bActivities = new Map(b.activities.map((activity) => [activity.id, activity]));
  const activityIds = unionIds(
    a.activities.map((activity) => activity.id),
    b.activities.map((activity) => activity.id),
  );

  const aTransitions = new Map(a.transitions.map((t) => [transitionKey(t), t]));
  const bTransitions = new Map(b.transitions.map((t) => [transitionKey(t), t]));
  const transitionIds = unionIds(
    a.transitions.map((t) => transitionKey(t)),
    b.transitions.map((t) => transitionKey(t)),
  );

  return {
    activities: diffEntries(aActivities, bActivities, activityIds, (stats) => stats.instances),
    transitions: diffEntries(aTransitions, bTransitions, transitionIds, (stats) => stats.count),
    totals: { a: a.totals, b: b.totals },
  };
}
