/**
 * The performance metric layer — RM-050.
 *
 * A process map is read twice: once for FREQUENCY (how often does this happen) and once
 * for PERFORMANCE (how long does it take). The frequency numbers come straight off
 * discovery; the performance numbers need three further decisions that only a reader can
 * make — which aggregate (median, mean, p90 …), which elapsed time an edge measures
 * (waiting or cycle), and which unit the answer is spoken in. This module applies all
 * three to an already-discovered graph and hands back the scalar each node and edge
 * should be painted with.
 *
 * The returned graph is a NEW object graph: unlike {@link abstractGraph}, which filters,
 * this function re-expresses. The input is never mutated.
 */
import { discoverGraph } from "./discover-graph";
import { EDGE_KEY_SEPARATOR } from "./discover-graph";
import type { AnyLog } from "./event-log";
import { minMax } from "./scale";
import type {
  ActivityStats,
  DurationStats,
  FlowTime,
  PerformanceAgg,
  ProcessGraph,
  TransitionStats,
} from "./types";

/** The units a duration can be spoken in. Everything upstream is milliseconds. */
export type DurationUnit = "ms" | "s" | "min" | "h" | "d";

/** How many milliseconds each {@link DurationUnit} is worth. */
export const DURATION_UNIT_MS: Readonly<Record<DurationUnit, number>> = Object.freeze({
  ms: 1,
  s: 1_000,
  min: 60_000,
  h: 3_600_000,
  d: 86_400_000,
});

/** Options for {@link aggregatePerformance}. */
export interface PerformanceOptions {
  /** Which member of a {@link DurationStats} the layer reads. */
  agg: PerformanceAgg;
  /**
   * Which elapsed time an edge measures. Honoured only when `log` is supplied — a graph
   * alone cannot be converted from waiting time to cycle time, because the two are not
   * derivable from each other's summary statistics. Without `log` this field DECLARES
   * what the graph already carries and nothing is re-derived.
   */
  flowTime: FlowTime;
  /** The unit every returned duration is expressed in. */
  unit: DurationUnit;
  /**
   * The log the graph came from. Supply it to re-derive edge durations at `flowTime`;
   * pass an already-normalized log (see `asNormalizedLog`) to skip a second parse.
   */
  log?: AnyLog;
  /**
   * Reservoir capacity per activity and per edge when re-deriving. Order statistics
   * (`median`, `p90`, `trimmedMean`) are ESTIMATES past this many samples per key; raise
   * it when a threshold has to be exact. Only meaningful together with `log`.
   */
  maxDurationSamples?: number;
}

/** The per-element scalars a performance view paints with, plus the domains to scale them on. */
export interface PerformanceLayer {
  agg: PerformanceAgg;
  flowTime: FlowTime;
  unit: DurationUnit;
  /** Activity id → the selected aggregate of its execution time, in `unit`. */
  activities: Record<string, number>;
  /** `source␁target` (see `EDGE_KEY_SEPARATOR`) → the selected aggregate, in `unit`. */
  transitions: Record<string, number>;
  /** `[min, max]` over `activities` — `[0, 0]` when there are none. */
  activityDomain: [number, number];
  /** `[min, max]` over `transitions` — `[0, 0]` when there are none. */
  transitionDomain: [number, number];
}

/** What {@link aggregatePerformance} returns: a `ProcessGraph` plus its metric layer. */
export interface PerformanceGraph extends ProcessGraph {
  performance: PerformanceLayer;
}

/**
 * Read the member of `stats` a {@link PerformanceAgg} names.
 *
 * The one place the mapping lives, so a control, a legend and a renderer cannot disagree
 * about what "p90" is. `trimmed_mean` is the snake_case spelling of `trimmedMean` —
 * the type is a wire/URL value, the field is a property name.
 */
export function performanceValue(stats: DurationStats, agg: PerformanceAgg): number {
  switch (agg) {
    case "mean":
      return stats.mean;
    case "min":
      return stats.min;
    case "max":
      return stats.max;
    case "sum":
      return stats.sum;
    case "p90":
      return stats.p90;
    case "trimmed_mean":
      return stats.trimmedMean;
    case "median":
    default:
      return stats.median;
  }
}

/** Scale every member of `stats` by `factor`. Returns a new object; `stats` is untouched. */
function scaleStats(stats: DurationStats, factor: number): DurationStats {
  if (factor === 1) return { ...stats };
  return {
    min: stats.min * factor,
    max: stats.max * factor,
    mean: stats.mean * factor,
    median: stats.median * factor,
    p90: stats.p90 * factor,
    sum: stats.sum * factor,
    trimmedMean: stats.trimmedMean * factor,
  };
}

function edgeKey(source: string, target: string): string {
  return `${source}${EDGE_KEY_SEPARATOR}${target}`;
}

/**
 * Express `graph`'s durations as a performance layer.
 *
 * Every `DurationStats` in the returned graph is converted to `opts.unit`, and
 * `performance` carries the single scalar per activity and per transition that
 * `opts.agg` selects, together with the two domains a scale needs.
 *
 * With `opts.log`, edge and activity durations are RE-DERIVED at `opts.flowTime` from the
 * FULL log — which is what keeps a performance layer honest on an abstracted graph: the
 * numbers describe everything that happened, not only the part currently drawn. Elements
 * the re-derivation does not know about keep the statistics they arrived with.
 *
 * Order statistics past the reservoir cap are estimates (see `maxDurationSamples`);
 * `sum`, `mean`, `min` and `max` are exact at any log size.
 */
export function aggregatePerformance(
  graph: ProcessGraph,
  opts: PerformanceOptions,
): PerformanceGraph {
  const factor = 1 / (DURATION_UNIT_MS[opts.unit] ?? 1);

  let activitySource: Map<string, DurationStats> | undefined;
  let transitionSource: Map<string, DurationStats> | undefined;
  if (opts.log !== undefined) {
    const derived = discoverGraph(opts.log, {
      flowTime: opts.flowTime,
      ...(opts.maxDurationSamples === undefined
        ? {}
        : { maxDurationSamples: opts.maxDurationSamples }),
    });
    activitySource = new Map(derived.activities.map((a) => [a.id, a.duration]));
    transitionSource = new Map(
      derived.transitions.map((t) => [edgeKey(t.source, t.target), t.duration]),
    );
  }

  const activityValues: Record<string, number> = {};
  const activities: ActivityStats[] = graph.activities.map((activity) => {
    const source = activitySource?.get(activity.id) ?? activity.duration;
    const duration = scaleStats(source, factor);
    activityValues[activity.id] = performanceValue(duration, opts.agg);
    return { ...activity, duration };
  });

  const transitionValues: Record<string, number> = {};
  const transitions: TransitionStats[] = graph.transitions.map((edge) => {
    const key = edgeKey(edge.source, edge.target);
    const source = transitionSource?.get(key) ?? edge.duration;
    const duration = scaleStats(source, factor);
    transitionValues[key] = performanceValue(duration, opts.agg);
    return { ...edge, duration };
  });

  return {
    activities,
    transitions,
    startActivities: { ...graph.startActivities },
    endActivities: { ...graph.endActivities },
    totals: { ...graph.totals },
    performance: {
      agg: opts.agg,
      flowTime: opts.flowTime,
      unit: opts.unit,
      activities: activityValues,
      transitions: transitionValues,
      activityDomain: minMax(Object.values(activityValues)),
      transitionDomain: minMax(Object.values(transitionValues)),
    },
  };
}
