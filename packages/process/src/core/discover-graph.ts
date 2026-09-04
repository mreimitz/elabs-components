/**
 * Directly-follows graph discovery — RM-049.
 *
 * The directly-follows abstraction (one node per activity, one edge per adjacent pair in
 * a trace, with frequency and performance aggregates on both) is the standard starting
 * point of every process-mining view. The shape of what a discovered graph carries —
 * per-activity instance and case counts, per-edge count and case count, start/end
 * activity tallies — follows pm4js; see `ATTRIBUTION.md`. No pm4js code is copied, and
 * nothing here derives from the AGPL Python reference implementation.
 *
 * Deterministic and layout-free: `isBackEdge` is always `false` here, because whether an
 * edge points backwards is a property of a LAYOUT, not of a log. A layout pass sets it.
 */
import { DURATION_SAMPLE_CAP, DurationSampler } from "./duration-stats";
import { asNormalizedLog, type AnyLog, type NormalizedEvent } from "./event-log";
import { VARIANT_KEY_SEPARATOR } from "./extract-variants";
import type { ActivityStats, FlowTime, ProcessGraph, TransitionStats } from "./types";

/**
 * Separator used to key an edge. The same C0 control character the variant key uses, and
 * for the same reason: no activity name can contain it, so `source + SEP + target` is an
 * injective key.
 */
export const EDGE_KEY_SEPARATOR = VARIANT_KEY_SEPARATOR;

/** Options for {@link discoverGraph}. Every field has a default; `discoverGraph(log)` works. */
export interface DiscoverGraphOptions {
  /**
   * Which elapsed time an edge measures. Defaults to `"idle_time"` — the wait between the
   * source completing and the target starting, which is the number a bottleneck view
   * wants. For a log of atomic events the two choices coincide.
   */
  flowTime?: FlowTime;
  /**
   * Reservoir capacity per activity and per edge. Lower it for a very wide log; raise it
   * for sharper tail statistics. `sum`/`mean`/`min`/`max` stay exact regardless.
   */
  maxDurationSamples?: number;
}

interface ActivityAccumulator {
  instances: number;
  cases: number;
  duration: DurationSampler;
}

interface TransitionAccumulator {
  source: string;
  target: string;
  count: number;
  caseCount: number;
  duration: DurationSampler;
}

/**
 * Derive a {@link ProcessGraph} from a raw or already-normalized log.
 *
 * One pass per trace: each case's activity sequence is walked once, incrementing
 * per-activity and per-edge counters and feeding two duration samplers. Per-case
 * uniqueness (the `cases` and `caseCount` fields) is tracked with two `Set`s that are
 * cleared per case rather than a per-key `Set` of case ids, so memory stays proportional
 * to the widest trace, not to the log.
 *
 * `totals.variants` is counted from the same walk (the joined activity sequence goes into
 * a `Set`), so a caller that only needs the headline number does not also have to run
 * `extractVariants`.
 */
export function discoverGraph(log: AnyLog, options: DiscoverGraphOptions = {}): ProcessGraph {
  const flowTime: FlowTime = options.flowTime ?? "idle_time";
  const capacity = options.maxDurationSamples ?? DURATION_SAMPLE_CAP;
  const normalized = asNormalizedLog(log);

  const activities = new Map<string, ActivityAccumulator>();
  const transitions = new Map<string, TransitionAccumulator>();
  const startActivities = new Map<string, number>();
  const endActivities = new Map<string, number>();
  const variantKeys = new Set<string>();

  // Sampler seeds come from a creation counter, never from a clock or from entropy: the
  // iteration order over a given log is fixed, so the same log always seeds the same
  // samplers and the reservoir retains the same rows.
  let samplerIndex = 0;
  const nextSeed = (): number => {
    samplerIndex += 1;
    return (0x9e3779b9 ^ Math.imul(samplerIndex, 0x9e3779b1)) >>> 0;
  };

  let events = 0;
  const seenActivities = new Set<string>();
  const seenEdges = new Set<string>();

  for (const kase of normalized.cases) {
    const trace = kase.events;
    if (trace.length === 0) continue;
    events += trace.length;
    seenActivities.clear();
    seenEdges.clear();

    const sequence = new Array<string>(trace.length);

    for (let i = 0; i < trace.length; i += 1) {
      const event = trace[i] as NormalizedEvent;
      const name = event.activity;
      sequence[i] = name;

      let activity = activities.get(name);
      if (activity === undefined) {
        activity = { instances: 0, cases: 0, duration: new DurationSampler(nextSeed(), capacity) };
        activities.set(name, activity);
      }
      activity.instances += 1;
      activity.duration.add(event.duration);
      if (!seenActivities.has(name)) {
        seenActivities.add(name);
        activity.cases += 1;
      }

      if (i === 0) continue;
      const previous = trace[i - 1] as NormalizedEvent;
      const source = previous.activity;
      const key = `${source}${EDGE_KEY_SEPARATOR}${name}`;
      let edge = transitions.get(key);
      if (edge === undefined) {
        edge = {
          source,
          target: name,
          count: 0,
          caseCount: 0,
          duration: new DurationSampler(nextSeed(), capacity),
        };
        transitions.set(key, edge);
      }
      edge.count += 1;
      edge.duration.add(
        flowTime === "inter_start_time" ? event.start - previous.start : event.start - previous.end,
      );
      if (!seenEdges.has(key)) {
        seenEdges.add(key);
        edge.caseCount += 1;
      }
    }

    const first = trace[0] as NormalizedEvent;
    const last = trace[trace.length - 1] as NormalizedEvent;
    startActivities.set(first.activity, (startActivities.get(first.activity) ?? 0) + 1);
    endActivities.set(last.activity, (endActivities.get(last.activity) ?? 0) + 1);
    variantKeys.add(sequence.join(VARIANT_KEY_SEPARATOR));
  }

  const activityList: ActivityStats[] = [];
  for (const [id, accumulator] of activities) {
    activityList.push({
      id,
      label: id,
      instances: accumulator.instances,
      cases: accumulator.cases,
      isStart: startActivities.has(id),
      isEnd: endActivities.has(id),
      duration: accumulator.duration.stats(),
    });
  }
  // Deterministic, reader-friendly order: busiest first, ties broken by name, so the same
  // log always yields the same array in the same positions (downstream items snapshot it).
  activityList.sort((a, b) => b.instances - a.instances || compareStrings(a.id, b.id));

  const transitionList: TransitionStats[] = [];
  for (const accumulator of transitions.values()) {
    transitionList.push({
      source: accumulator.source,
      target: accumulator.target,
      count: accumulator.count,
      caseCount: accumulator.caseCount,
      duration: accumulator.duration.stats(),
      isSelfLoop: accumulator.source === accumulator.target,
      isBackEdge: false,
    });
  }
  transitionList.sort(
    (a, b) =>
      b.count - a.count || compareStrings(a.source, b.source) || compareStrings(a.target, b.target),
  );

  return {
    activities: activityList,
    transitions: transitionList,
    startActivities: toSortedRecord(startActivities),
    endActivities: toSortedRecord(endActivities),
    totals: { cases: normalized.cases.length, events, variants: variantKeys.size },
  };
}

/** Code-unit comparison — locale-independent, so the order is the same on every machine. */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Key order is part of the output, so it is sorted rather than left to insertion order. */
function toSortedRecord(counts: Map<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of [...counts.keys()].sort()) out[key] = counts.get(key) as number;
  return out;
}
