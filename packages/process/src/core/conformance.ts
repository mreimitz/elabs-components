/**
 * Conformance model — RM-061.
 *
 * The log-level result of replaying an event log against a reference model
 * ({@link ConformanceResult}, produced by `tokenReplay`) and the fitness-over-time series a
 * KPI sparkline plots ({@link conformanceRateSeries}).
 *
 * Scope boundary (analysis §9 risk 2): token replay against a lifted happy path only — no
 * alignments, no BPMN import. A host needing either brings a backend.
 *
 * Framework-free, deterministic: no React, no `Date.now()`, no `@elabs-ai/components-*`
 * import.
 */
import { asNormalizedLog, type AnyLog } from "./event-log";
import type { ReplayModel } from "./reference-model";
import { replayActivities, type DeviationType, type TraceReplayResult } from "./token-replay";

/** Log-level conformance of an event log against a reference model. */
export interface ConformanceResult {
  /** Mean trace fitness in `[0, 1]`; `0` for an empty log. */
  overallFitness: number;
  /** One result per case, in the log's case order. */
  traces: TraceReplayResult[];
  /** Total deviations per type across all cases; every type is present. */
  deviationCounts: Record<DeviationType, number>;
  /** Deviations charged to each activity. Sums to the total deviation count. */
  perActivity: Record<string, { deviations: number }>;
  /**
   * Deviations charged to each OBSERVED directly-follows edge, keyed
   * `source + EDGE_KEY_SEPARATOR + target` — the same key `discoverGraph` gives the edge.
   * Sums to at most the total deviation count.
   */
  perEdge: Record<string, { deviations: number }>;
}

/** Calendar granularity of {@link conformanceRateSeries}. All buckets are UTC. */
export type ConformanceBucket = "day" | "week" | "month";

/** One point of {@link conformanceRateSeries}. */
export interface ConformanceRatePoint {
  /** `YYYY-MM-DD` (day; for week, the UTC Monday that starts it) or `YYYY-MM` (month). */
  bucket: string;
  /** Mean fitness of the cases that started in this bucket. */
  fitness: number;
  caseCount: number;
}

const DAY_MS = 86_400_000;

function bucketOf(ms: number, bucket: ConformanceBucket): string {
  const date = new Date(ms);
  if (bucket === "week") {
    // getUTCDay(): 0 = Sunday … 6 = Saturday; shift so Monday is day 0.
    const offset = (date.getUTCDay() + 6) % 7;
    const monday = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - offset * DAY_MS,
    );
    return monday.toISOString().slice(0, 10);
  }
  const iso = date.toISOString();
  return bucket === "month" ? iso.slice(0, 7) : iso.slice(0, 10);
}

/**
 * Mean replay fitness per calendar bucket, keyed by each case's START time, in ascending
 * bucket order. Empty buckets are not emitted. A case with no resolvable start timestamp
 * cannot be placed in time and is left out, so `caseCount`s sum to the number of cases
 * with a valid start.
 */
export function conformanceRateSeries(
  log: AnyLog,
  model: ReplayModel,
  bucket: ConformanceBucket,
): ConformanceRatePoint[] {
  const totals = new Map<string, { sum: number; count: number }>();
  for (const kase of asNormalizedLog(log).cases) {
    if (!Number.isFinite(kase.start)) continue;
    const key = bucketOf(kase.start, bucket);
    const trace = kase.events.map((event) => event.activity);
    const { fitness } = replayActivities(kase.caseId, trace, model);
    const entry = totals.get(key);
    if (entry === undefined) totals.set(key, { sum: fitness, count: 1 });
    else {
      entry.sum += fitness;
      entry.count += 1;
    }
  }
  return [...totals.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, { sum, count }]) => ({ bucket: key, fitness: sum / count, caseCount: count }));
}
