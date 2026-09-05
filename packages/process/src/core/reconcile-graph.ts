/**
 * reconcileGraph — merge a FILTERED graph's statistics onto a PRESENTED graph's element set
 * (RM-052 round 2, issue #227, Invariant F).
 *
 * The maintainer's ruling on filtering: keep every process-map step visible, dim the ones a
 * filter excludes — never remove them. Invariant F makes that ruling mechanical: the set of
 * activities and transitions a process map renders is a function of the log and the
 * abstraction alone, never of the active filter intents. Applying or clearing a filter can
 * only change an element's STATE and the statistics it carries; it can never add or remove a
 * node or an edge.
 *
 * `reconcileGraph` is the pure operation that keeps that promise: given the graph a map is
 * about to PRESENT (`presented` — the full, abstracted graph, computed with no filter
 * applied) and the graph the ACTIVE filter actually produced (`filtered`), it returns a graph
 * with `presented`'s exact element set, where every element also present in `filtered` reads
 * `filtered`'s statistics, and every element `filtered` dropped becomes a "ghost" — the same
 * id, at zero. A ghost's statistics are the FILTERED ones (zero), not the full-log ones —
 * painting full-log numbers on an excluded element would make filtering cosmetic.
 *
 * `startActivities`, `endActivities` and `totals` come from `filtered` outright (they are
 * graph-level facts about what actually survived the filter, not per-element stats to
 * reconcile). Extra fields the presented graph carries beyond `ProcessGraph` itself (e.g.
 * `AbstractedGraph.hidden`) pass through untouched — `reconcileGraph` never removes what it
 * did not add.
 *
 * Pipeline ordering is load-bearing: abstraction runs on the FULL graph, BEFORE
 * reconciliation with the filtered graph. Reconciling first (running abstraction on an
 * already-filtered graph) would let the zeroed ghosts get treated as least-frequent and
 * deleted by abstraction's own ranking — reinstating the "filtering removes elements"
 * behaviour the maintainer ruled against, by a second route.
 */
import { emptyDurationStats } from "./duration-stats";
import { EDGE_KEY_SEPARATOR } from "./discover-graph";
import type { ProcessGraph, TransitionStats } from "./types";

/** The result of {@link reconcileGraph}. */
export interface ReconciledGraph<G extends ProcessGraph> {
  /** `presented`'s exact element set, with `filtered`'s statistics where an element survived. */
  graph: G;
  /** Activity ids `presented` carries that `filtered` dropped — rendered as zeroed ghosts. */
  excludedActivities: string[];
  /** Transition keys (`source` + {@link EDGE_KEY_SEPARATOR} + `target`) `filtered` dropped. */
  excludedTransitions: string[];
}

function transitionKey(transition: Pick<TransitionStats, "source" | "target">): string {
  return `${transition.source}${EDGE_KEY_SEPARATOR}${transition.target}`;
}

/**
 * Reconcile a presented graph's element set against what a filter actually produced.
 *
 * `G` is generic over `ProcessGraph` so an already-abstracted graph (`AbstractedGraph`, which
 * adds `hidden`) reconciles without losing its extra field — the return type is `G`, and the
 * implementation spreads `presented` before overwriting only the fields this function owns.
 */
export function reconcileGraph<G extends ProcessGraph>(
  presented: G,
  filtered: ProcessGraph,
): ReconciledGraph<G> {
  const filteredActivities = new Map(
    filtered.activities.map((activity) => [activity.id, activity]),
  );
  const filteredTransitions = new Map(
    filtered.transitions.map((transition) => [transitionKey(transition), transition]),
  );

  const excludedActivities: string[] = [];
  const activities = presented.activities.map((activity) => {
    const survivor = filteredActivities.get(activity.id);
    if (survivor) return survivor;
    excludedActivities.push(activity.id);
    return {
      ...activity,
      instances: 0,
      cases: 0,
      isStart: false,
      isEnd: false,
      duration: emptyDurationStats(),
    };
  });

  const excludedTransitions: string[] = [];
  const transitions = presented.transitions.map((transition) => {
    const key = transitionKey(transition);
    const survivor = filteredTransitions.get(key);
    if (survivor) return survivor;
    excludedTransitions.push(key);
    return {
      ...transition,
      count: 0,
      caseCount: 0,
      duration: emptyDurationStats(),
    };
  });

  const graph: G = {
    ...presented,
    activities,
    transitions,
    startActivities: filtered.startActivities,
    endActivities: filtered.endActivities,
    totals: filtered.totals,
  };

  return { graph, excludedActivities, excludedTransitions };
}
