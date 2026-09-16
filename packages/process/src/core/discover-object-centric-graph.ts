/**
 * Object-centric directly-follows graph (OC-DFG) discovery — RM-066.
 *
 * An OC-DFG is one directly-follows graph PER OBJECT TYPE, drawn on one canvas: activities
 * shared between types merge into a single node that keeps a per-type breakdown, while
 * edges stay per type — an `order` following and an `item` following are different
 * relations, so they are never summed into one arrow. The merge semantics (per-type
 * projection, shared-activity join, per-type edges) follow pm4js's documented OC-DFG
 * construction; see `ATTRIBUTION.md`. No pm4js code is copied, and nothing here derives
 * from the AGPL Python reference implementation.
 *
 * Built entirely on `discoverGraph` and `abstractGraph`: every per-type number is exactly
 * what the single-case pipeline would print for that type's projection.
 */
import { abstractGraph, type AbstractionOptions } from "./abstract-graph";
import { activityColorScale, type ActivityColorScale } from "./activity-color-scale";
import { OCEL_EVENT_ID_ATTRIBUTE } from "./adapters/ocel";
import { discoverGraph, EDGE_KEY_SEPARATOR, type DiscoverGraphOptions } from "./discover-graph";
import type { ActivityStats, EventLog, ProcessGraph, TransitionStats } from "./types";

/** One object type's share of a merged activity. */
export interface ObjectTypeActivityCounts {
  /** Occurrences in that type's projection (one per event × referenced object). */
  instances: number;
  /** Distinct objects of that type the activity touches. */
  cases: number;
}

/** A merged activity: shared across object types, with a per-type breakdown. */
export interface ObjectCentricActivityStats extends Omit<ActivityStats, "instances" | "cases"> {
  /**
   * Distinct OCEL events of this activity across every type — an event that references an
   * order and two items counts once. Falls back to the largest per-type `instances` when
   * the logs carry no `__ocelEventId` (hand-built logs).
   */
  events: number;
  /** Object type → counts, only for the types this activity occurs in. */
  perType: Record<string, ObjectTypeActivityCounts>;
}

/** An object-centric directly-follows graph. */
export interface ObjectCentricGraph {
  /** Merged activities, busiest (by `events`) first, ties by id. */
  activities: ObjectCentricActivityStats[];
  /** Object type → that type's own directly-follows edges. Never merged across types. */
  transitionsByType: Record<string, TransitionStats[]>;
  /** The object types, in the caller's order. */
  objectTypes: string[];
  /** Object type → the full per-type graph the merge was built from. */
  graphsByType: Record<string, ProcessGraph>;
}

/** {@link abstractObjectCentricGraph}'s result — what each type's abstraction hid. */
export interface AbstractedObjectCentricGraph extends ObjectCentricGraph {
  hiddenByType: Record<string, { activities: number; paths: number }>;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Distinct `__ocelEventId`s per activity across every log, or `undefined` if none carry one. */
function countDistinctEvents(logs: readonly EventLog[]): Map<string, number> | undefined {
  const ids = new Map<string, Set<string>>();
  let any = false;
  for (const log of logs) {
    for (const row of log.events) {
      const id = row.attributes?.[OCEL_EVENT_ID_ATTRIBUTE];
      if (typeof id !== "string") continue;
      any = true;
      let set = ids.get(row.activity);
      if (set === undefined) {
        set = new Set();
        ids.set(row.activity, set);
      }
      set.add(id);
    }
  }
  if (!any) return undefined;
  const out = new Map<string, number>();
  for (const [activity, set] of ids) out.set(activity, set.size);
  return out;
}

/**
 * Merge per-type graphs into one {@link ObjectCentricGraph}.
 *
 * `eventCounts` supplies each activity's distinct-event count; an activity it does not
 * name falls back to its largest per-type `instances`. A merged activity's `duration` is
 * the duration of the type with the most instances of it (ties: earlier type), because
 * durations of the same events seen through two projections are not additive.
 */
export function mergeObjectCentricGraphs(
  graphsByType: Record<string, ProcessGraph>,
  objectTypes: readonly string[] = Object.keys(graphsByType),
  eventCounts?: ReadonlyMap<string, number>,
): ObjectCentricGraph {
  const merged = new Map<string, ObjectCentricActivityStats>();
  const bestInstances = new Map<string, number>();
  const transitionsByType: Record<string, TransitionStats[]> = {};
  const types = objectTypes.filter((type) => graphsByType[type] !== undefined);

  for (const type of types) {
    const graph = graphsByType[type] as ProcessGraph;
    transitionsByType[type] = graph.transitions;
    for (const activity of graph.activities) {
      let entry = merged.get(activity.id);
      if (entry === undefined) {
        entry = {
          id: activity.id,
          label: activity.label,
          isStart: false,
          isEnd: false,
          duration: activity.duration,
          events: 0,
          perType: {},
        };
        merged.set(activity.id, entry);
      }
      entry.perType[type] = { instances: activity.instances, cases: activity.cases };
      entry.isStart ||= activity.isStart;
      entry.isEnd ||= activity.isEnd;
      if (activity.instances > (bestInstances.get(activity.id) ?? -1)) {
        bestInstances.set(activity.id, activity.instances);
        entry.duration = activity.duration;
      }
    }
  }

  const activities = [...merged.values()];
  for (const activity of activities) {
    activity.events = eventCounts?.get(activity.id) ?? bestInstances.get(activity.id) ?? 0;
  }
  activities.sort((a, b) => b.events - a.events || compareStrings(a.id, b.id));

  const graphs: Record<string, ProcessGraph> = {};
  for (const type of types) graphs[type] = graphsByType[type] as ProcessGraph;

  return { activities, transitionsByType, objectTypes: types, graphsByType: graphs };
}

/**
 * Discover an {@link ObjectCentricGraph} from per-object-type logs (typically
 * `fromOcel(…).logs`). Runs `discoverGraph` once per type, then merges.
 */
export function discoverObjectCentricGraph(
  logsByType: Record<string, EventLog>,
  options: DiscoverGraphOptions & { objectTypes?: string[] } = {},
): ObjectCentricGraph {
  const { objectTypes = Object.keys(logsByType), ...discoverOptions } = options;
  const types = objectTypes.filter((type) => logsByType[type] !== undefined);
  const graphsByType: Record<string, ProcessGraph> = {};
  for (const type of types) {
    graphsByType[type] = discoverGraph(logsByType[type] as EventLog, discoverOptions);
  }
  const eventCounts = countDistinctEvents(types.map((type) => logsByType[type] as EventLog));
  return mergeObjectCentricGraphs(graphsByType, types, eventCounts);
}

/**
 * Abstract each object type independently, then re-merge.
 *
 * `perType[type]` wins for a type it names; `fallback` applies to every other type; a type
 * with neither is kept whole. Activity `events` counts are carried over from the input,
 * so abstraction hides nodes and edges without restating a statistic.
 */
export function abstractObjectCentricGraph(
  graph: ObjectCentricGraph,
  perType: Readonly<Record<string, AbstractionOptions>> = {},
  fallback?: AbstractionOptions,
): AbstractedObjectCentricGraph {
  const graphsByType: Record<string, ProcessGraph> = {};
  const hiddenByType: Record<string, { activities: number; paths: number }> = {};
  for (const type of graph.objectTypes) {
    const source = graph.graphsByType[type] as ProcessGraph;
    const options = perType[type] ?? fallback;
    if (options === undefined) {
      graphsByType[type] = source;
      hiddenByType[type] = { activities: 0, paths: 0 };
      continue;
    }
    const { hidden, ...abstracted } = abstractGraph(source, options);
    graphsByType[type] = abstracted;
    hiddenByType[type] = hidden;
  }
  const eventCounts = new Map(graph.activities.map((activity) => [activity.id, activity.events]));
  return {
    ...mergeObjectCentricGraphs(graphsByType, graph.objectTypes, eventCounts),
    hiddenByType,
  };
}

/**
 * Flatten an {@link ObjectCentricGraph} into one {@link ProcessGraph} — the shape the
 * process map lays out and reads its node metrics from.
 *
 * - an activity's `instances` is its distinct-event count and its `cases` is the number of
 *   objects (of any type) it touches;
 * - a pair of activities joined in several types becomes ONE transition whose `count` and
 *   `caseCount` sum the types' — used for layout and selection only; the map still draws
 *   the per-type edges from `transitionsByType`;
 * - `totals.cases` counts objects, `totals.events` distinct events.
 */
export function objectCentricProcessGraph(graph: ObjectCentricGraph): ProcessGraph {
  const activities: ActivityStats[] = graph.activities.map((activity) => {
    let cases = 0;
    for (const counts of Object.values(activity.perType)) cases += counts.cases;
    return {
      id: activity.id,
      label: activity.label,
      instances: activity.events,
      cases,
      isStart: activity.isStart,
      isEnd: activity.isEnd,
      duration: activity.duration,
    };
  });

  const transitions = new Map<string, TransitionStats>();
  const startActivities: Record<string, number> = {};
  const endActivities: Record<string, number> = {};
  const totals = { cases: 0, events: 0, variants: 0 };
  for (const activity of graph.activities) totals.events += activity.events;

  for (const type of graph.objectTypes) {
    const typeGraph = graph.graphsByType[type] as ProcessGraph;
    totals.cases += typeGraph.totals.cases;
    totals.variants += typeGraph.totals.variants;
    for (const [id, count] of Object.entries(typeGraph.startActivities)) {
      startActivities[id] = (startActivities[id] ?? 0) + count;
    }
    for (const [id, count] of Object.entries(typeGraph.endActivities)) {
      endActivities[id] = (endActivities[id] ?? 0) + count;
    }
    for (const transition of graph.transitionsByType[type] ?? []) {
      const key = `${transition.source}${EDGE_KEY_SEPARATOR}${transition.target}`;
      const existing = transitions.get(key);
      if (existing === undefined) {
        transitions.set(key, { ...transition });
        continue;
      }
      if (transition.count > existing.count) existing.duration = transition.duration;
      existing.count += transition.count;
      existing.caseCount += transition.caseCount;
    }
  }

  const transitionList = [...transitions.values()].sort(
    (a, b) =>
      b.count - a.count || compareStrings(a.source, b.source) || compareStrings(a.target, b.target),
  );

  const sorted = (record: Record<string, number>): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const key of Object.keys(record).sort()) out[key] = record[key] as number;
    return out;
  };

  return {
    activities,
    transitions: transitionList,
    startActivities: sorted(startActivities),
    endActivities: sorted(endActivities),
    totals,
  };
}

/**
 * The object-type colour scale — RM-054's `activityColorScale`, reused rather than
 * reimplemented: object types are ranked by how many objects each has (ties by name) and
 * take `--chart-1` … `--chart-11` in that order, beyond which they share the hatched
 * "other" slot. `codeFor(type)` is the two-character text code painted beside every
 * swatch, so a type is never identified by colour alone.
 */
export function objectTypeColorScale(graph: ObjectCentricGraph): ActivityColorScale {
  const zero = { min: 0, max: 0, mean: 0, median: 0, p90: 0, sum: 0, trimmedMean: 0 };
  const activities: ActivityStats[] = graph.objectTypes.map((type) => {
    const typeGraph = graph.graphsByType[type] as ProcessGraph;
    return {
      id: type,
      label: type,
      instances: typeGraph.totals.events,
      cases: typeGraph.totals.cases,
      isStart: false,
      isEnd: false,
      duration: zero,
    };
  });
  return activityColorScale({
    activities,
    transitions: [],
    startActivities: {},
    endActivities: {},
    totals: { cases: 0, events: 0, variants: 0 },
  });
}
