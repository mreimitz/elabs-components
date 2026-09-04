/**
 * The framework-free event-log and process-graph model — RM-049.
 *
 * Every downstream item in the process-mining track (RM-050 abstraction, RM-051 the
 * process map, RM-052 the variant explorer, RM-053 the case table, RM-054 the coverage
 * strip) reads these shapes, so they are the wave's frozen contract. Keep additions
 * additive: a required field added here is a breaking change for five items at once.
 *
 * NOTHING in this module — or anywhere under `src/core/` — may import React, React Flow,
 * visx, d3 or an `@elabs-ai/components-*` package. See `.claude/rules/process-components.md`
 * and `pnpm process:reuse:check`.
 */

/**
 * One raw row of an event log, before normalization.
 *
 * `timestamp` accepts the three shapes tabular sources actually produce — an ISO string,
 * an epoch number, or a `Date` — because the adapters hand rows through unchanged and a
 * consumer should not have to pre-convert. {@link normalizeLog} resolves all three to
 * epoch milliseconds.
 */
export interface EventRow {
  /** Case (process instance) this event belongs to. */
  caseId: string;
  /** Activity name. This is the node identity in the discovered graph. */
  activity: string;
  /** When the event completed (or, for a `lifecycle: "start"` row, when it started). */
  timestamp: string | number | Date;
  /**
   * Optional explicit start of an interval event. Ignored when the row is one half of a
   * `lifecycle` pair — the paired `"start"` row wins, because it is the observed value.
   */
  startTimestamp?: string | number | Date;
  /** Who or what executed the event (a user, a queue, a system). */
  resource?: string;
  /** Lifecycle transition. Absent means the row is an atomic (already-complete) event. */
  lifecycle?: "start" | "complete";
  /** Free-form event-level attributes carried through normalization untouched. */
  attributes?: Record<string, string | number | boolean | null>;
}

/** A raw event log: the rows, plus optional per-case attributes keyed by `caseId`. */
export interface EventLog {
  events: EventRow[];
  caseAttributes?: Record<string, Record<string, unknown>>;
}

/**
 * Summary statistics over a set of duration samples, in milliseconds.
 *
 * All seven members are always present; an empty sample set yields zeros rather than
 * `null`, so a renderer never has to branch on absence.
 */
export interface DurationStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  p90: number;
  sum: number;
  /** Mean after discarding the lowest and highest 10% of samples. */
  trimmedMean: number;
}

/** Per-activity aggregates in a discovered graph. */
export interface ActivityStats {
  /** Stable node identity — the activity name. */
  id: string;
  /** Human-readable label. Equal to `id` unless a caller relabels the graph. */
  label: string;
  /** Total occurrences across all cases. */
  instances: number;
  /** Number of distinct cases the activity occurs in at least once. */
  cases: number;
  /** True when the activity starts at least one case. */
  isStart: boolean;
  /** True when the activity ends at least one case. */
  isEnd: boolean;
  /** Distribution of the activity's own execution durations. */
  duration: DurationStats;
}

/** Per-edge aggregates in a discovered graph (a directly-follows relation). */
export interface TransitionStats {
  source: string;
  target: string;
  /** Total occurrences of the directly-follows pair across all cases. */
  count: number;
  /** Number of distinct cases the pair occurs in at least once. */
  caseCount: number;
  /** Distribution of the flow time between the two activities. */
  duration: DurationStats;
  /** `source === target`. */
  isSelfLoop: boolean;
  /**
   * Whether the edge points backwards in the laid-out graph. Discovery does not lay out,
   * so this is always `false` here; a layout pass sets it (RM-044).
   */
  isBackEdge: boolean;
}

/** A directly-follows graph plus its totals. */
export interface ProcessGraph {
  activities: ActivityStats[];
  transitions: TransitionStats[];
  /** Activity name → number of cases that start with it. */
  startActivities: Record<string, number>;
  /** Activity name → number of cases that end with it. */
  endActivities: Record<string, number>;
  totals: { cases: number; events: number; variants: number };
}

/** One distinct activity sequence, with the cases that follow it. */
export interface Variant {
  /** Stable, reproducible id derived from the sequence — see `variantId`. */
  id: string;
  sequence: string[];
  /** Number of cases following this sequence. */
  count: number;
  /** `count / totalCases`. */
  share: number;
  /** Running share across the descending-frequency order — monotonically non-decreasing. */
  cumulativeShare: number;
  /** Case ids following this sequence, in first-appearance order. */
  caseIds: string[];
  /** Distribution of the end-to-end case durations of `caseIds`. */
  duration: DurationStats;
}

/** How an edge or node frequency is expressed to the reader. */
export type FrequencyMode =
  | "absolute"
  | "absolute_case"
  | "relative"
  | "relative_case"
  | "relative_antecedent"
  | "relative_consequent"
  | "max_repetitions";

/** Which member of a {@link DurationStats} a performance view reads. */
export type PerformanceAgg = "median" | "mean" | "min" | "max" | "sum" | "p90" | "trimmed_mean";

/**
 * Which elapsed time an edge measures.
 *
 * - `idle_time` — from the source's completion to the target's start (waiting time).
 * - `inter_start_time` — from the source's start to the target's start (cycle time).
 *
 * For atomic events the two coincide, because start and completion are the same instant.
 */
export type FlowTime = "idle_time" | "inter_start_time";
