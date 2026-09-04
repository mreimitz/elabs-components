/**
 * `@elabs-ai/components-process/core` — the FRAMEWORK-FREE half of the process package.
 *
 * A gated subpath export (ADR 0006 / ADR 0034): the event-log model, directly-follows
 * derivation, variant grouping and conformance math, with a materially lighter
 * dependency tree than the trunk — no React, no React Flow, no visx. That is what lets
 * a server route, a worker or a unit test import the domain model without pulling a
 * rendering engine.
 *
 * NOTHING in this module may import React or any `@elabs-ai/components-*` package.
 *
 * Wave-1 items APPEND their exports at the end of the block below, each under a
 * `// <Name> — RM-NNN` comment, so concurrent branches merge as appends.
 */

// ── Model & derivation (framework-free) ──────────────────────────────────────

// Model types — RM-049
export type {
  ActivityStats,
  DurationStats,
  EventLog,
  EventRow,
  FlowTime,
  FrequencyMode,
  PerformanceAgg,
  ProcessGraph,
  TransitionStats,
  Variant,
} from "./types";

// normalizeLog — RM-049
export { asNormalizedLog, isNormalizedLog, normalizeLog, toEpochMs } from "./event-log";
export type { AnyLog, NormalizedCase, NormalizedEvent, NormalizedLog } from "./event-log";

// fromFlatRows — RM-049
export { DEFAULT_LIFECYCLE_VALUES, fromFlatRows, normalizeLifecycle } from "./adapters/flat";
export type { FlatRow, FlatRowMapping, LifecycleValues } from "./adapters/flat";

// fromCsv — RM-049
export { fromCsv, parseDelimited } from "./adapters/csv";
export type { CsvMapping, CsvOptions } from "./adapters/csv";

// discoverGraph — RM-049
export { discoverGraph } from "./discover-graph";
export type { DiscoverGraphOptions } from "./discover-graph";

// extractVariants — RM-049
export { extractVariants, variantId, variantKey, VARIANT_KEY_SEPARATOR } from "./extract-variants";

// durationStats — RM-049
export {
  DURATION_SAMPLE_CAP,
  DurationSampler,
  durationStats,
  EMPTY_DURATION_STATS,
  emptyDurationStats,
  TRIM_FRACTION,
} from "./duration-stats";

// minMax / quantile / clampWidth — RM-049
export { clampWidth, minMax, quantile, quantileSorted } from "./scale";

// generateSyntheticLog — RM-049
export {
  generateSyntheticLog,
  SYNTHETIC_ACTIVITIES,
  SYNTHETIC_LOG_EPOCH,
} from "./fixtures/synthetic-log";
export type { SyntheticActivity, SyntheticLogOptions } from "./fixtures/synthetic-log";
