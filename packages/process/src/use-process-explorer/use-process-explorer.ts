"use client";

/**
 * `useProcessExplorer` — the coordinating hook every process-mining view is driven from
 * (RM-052, issue #227).
 *
 * This is the tri-state contract analysis §5.3 calls "the most important [API decision]
 * ... because it is what makes the set usable both in a standalone prototype and embedded
 * in a BI platform's mashup": `ProcessMap` and the filter menu it exposes never call
 * `filterLog`/`discoverGraph` themselves — they render `selection` and emit
 * `onFilterIntent`/`onSelect`, and THIS hook is what turns those intents into a
 * recomputed graph. A host with its own associative-selection engine swaps this hook out
 * entirely and drives the exact same components (R22, RM-058).
 *
 * ## What recomputes, and when
 *
 * - `filteredLog` — `filterLog(log, intents)`, always synchronous (a linear scan; nothing
 *   here is expensive enough to move off-thread).
 * - the RAW discovered graph and the variants — `discoverGraph`/`extractVariants` run
 *   INLINE when `filteredLog` has at most `workerThreshold` events (50 000 by default,
 *   the figure RM-050 sized its worker for), and on `createProcessWorker`'s off-thread
 *   handle above it. The caller never has to branch on which path ran; `loading` is the
 *   only observable difference, and it is `false` for the whole life of a hook that never
 *   crosses the threshold.
 * - `graph` (the PUBLIC field) — `abstractGraph(rawGraph, abstraction)`, always
 *   synchronous: abstraction is a cheap view over an already-discovered graph, never a
 *   re-derivation from the log (RM-050's "sliders never change statistics" property).
 * - `kpis`/`rework` — derived from `filteredLog` directly (case count, event count,
 *   `durationStats` over each case's own throughput time, `detectRework`), NOT from the
 *   abstracted `graph` — abstraction hides nodes for the reader, it must not change what
 *   the KPI strip reports.
 *
 * ## Race safety
 *
 * A worker request in flight is superseded, not merged, the moment `filteredLog` changes
 * again (a request-id ref, checked on resolution) — a slow first import can never clobber
 * a fresher result that already landed.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  abstractGraph,
  type AbstractedGraph,
  type AbstractionOptions,
} from "../core/abstract-graph";
import { asNormalizedLog } from "../core/event-log";
import { detectRework, type ReworkStats } from "../core/detect-rework";
import { discoverGraph } from "../core/discover-graph";
import { durationStats } from "../core/duration-stats";
import { extractVariants } from "../core/extract-variants";
import { filterLog } from "../core/filter-log";
import type { EventLog, FrequencyMode, PerformanceAgg, ProcessGraph, Variant } from "../core/types";
import {
  createProcessWorker,
  type CreateProcessWorkerOptions,
} from "../core/worker/create-process-worker";
import type { ProcessFilterIntent, ProcessSelection } from "../process-map/map-model";

/** What a node or an edge is painted with — the same domain `ProcessMap`'s metric reads. */
export type ProcessExplorerMetric = FrequencyMode | PerformanceAgg;

/** The two metric slots a process explorer coordinates. */
export interface ProcessExplorerMetricSpec {
  node: ProcessExplorerMetric;
  edge: ProcessExplorerMetric;
}

/**
 * The filter-intent shape `ProcessMap`'s menu emits (RM-051's `ProcessFilterIntent`) —
 * re-exported under the roadmap's own name so a consumer wiring `applyIntent` up to
 * `onFilterIntent` needs only one type.
 */
export type FilterIntent = ProcessFilterIntent;

/** Options for {@link useProcessExplorer}. */
export interface ProcessExplorerOptions {
  /** Initial abstraction sliders. Default: `{ activities: 1, paths: 1 }` — the identity. */
  abstraction?: Partial<AbstractionOptions>;
  /** Initial metric choice. Default: `{ node: "absolute", edge: "absolute" }`. */
  metric?: Partial<ProcessExplorerMetricSpec>;
  /**
   * Event count above which discovery and variant extraction move to a worker (RM-050's
   * own stated figure). Default `50_000`. Lower it in a test that wants to exercise the
   * worker path without a 50k-row fixture.
   */
  workerThreshold?: number;
  /**
   * Forwarded verbatim to `createProcessWorker` — override `forceInline`/`createWorker`
   * for a test or a host with its own worker construction. The handle is created lazily,
   * on the first request that crosses `workerThreshold`, so passing this costs nothing in
   * a session that never does.
   */
  worker?: CreateProcessWorkerOptions;
}

/** What {@link useProcessExplorer} returns. See the module docblock for the recompute rules. */
export interface UseProcessExplorerResult {
  /** The graph to render — already abstracted. Superset of `ProcessGraph`; see `hidden`. */
  graph: AbstractedGraph;
  /** Variants of the FILTERED (not abstracted — variants have no node/edge concept) log. */
  variants: Variant[];
  abstraction: AbstractionOptions;
  setAbstraction(next: Partial<AbstractionOptions>): void;
  metric: ProcessExplorerMetricSpec;
  setMetric(next: Partial<ProcessExplorerMetricSpec>): void;
  /** The single explicit selection — `ProcessMap`'s own `selection` prop shape. */
  selection: ProcessSelection | null;
  /** Pass straight through as `ProcessMap`'s `onSelect`. */
  onSelect(next: ProcessSelection | null): void;
  applyIntent(intent: FilterIntent): void;
  clearIntent(index: number): void;
  intents: FilterIntent[];
  filteredLog: EventLog;
  /** Activities/paths abstraction is currently hiding — sourced from `abstractGraph`'s own `hidden` field. */
  hiddenCounts: { activities: number; paths: number };
  kpis: {
    cases: number;
    events: number;
    variants: number;
    /** Median case throughput time, in milliseconds. */
    medianThroughput: number;
    /** Fraction of cases carrying at least one repeated activity. */
    reworkRate: number;
  };
  /** Full rework tallies — feed straight into `ProcessMap`'s `rework` prop. */
  rework: ReworkStats;
  /**
   * `true` while a discovery/variant request for the CURRENT `filteredLog` is running off
   * a worker. Always `false` when `filteredLog` stays at or under `workerThreshold` — the
   * synchronous path has no gap to express. See loading-states.md: this is `loading`, not
   * `isStreaming` — a settled recomputation, not token-by-token output.
   */
  loading: boolean;
}

const DEFAULT_ABSTRACTION: AbstractionOptions = {
  activities: 1,
  paths: 1,
  invert: false,
  keepConnected: true,
};

const DEFAULT_METRIC: ProcessExplorerMetricSpec = { node: "absolute", edge: "absolute" };

/** RM-050's own stated figure for when discovery moves off-thread. */
const DEFAULT_WORKER_THRESHOLD = 50_000;

const EMPTY_GRAPH: ProcessGraph = {
  activities: [],
  transitions: [],
  startActivities: {},
  endActivities: {},
  totals: { cases: 0, events: 0, variants: 0 },
};

interface DiscoveryResult {
  graph: ProcessGraph;
  variants: Variant[];
}

function discoverInline(log: EventLog): DiscoveryResult {
  return { graph: discoverGraph(log), variants: extractVariants(log) };
}

/**
 * Coordinate abstraction, metric choice, selection and filter intents over one event log
 * into everything `ProcessMap` / `AbstractionControls` / `MetricLayerSwitch` /
 * `ProcessKpiStrip` need. See the module docblock.
 */
export function useProcessExplorer(
  log: EventLog,
  opts: ProcessExplorerOptions = {},
): UseProcessExplorerResult {
  const workerThreshold = opts.workerThreshold ?? DEFAULT_WORKER_THRESHOLD;

  // The worker options a caller passes are read once per request, never used to decide
  // whether to re-create the handle — the handle is a long-lived resource for the life of
  // this hook, matching `createProcessWorker`'s own "construct lazily, reuse" contract.
  const workerOptionsRef = useRef(opts.worker);
  workerOptionsRef.current = opts.worker;
  const handleRef = useRef<ReturnType<typeof createProcessWorker> | null>(null);
  function getHandle() {
    if (handleRef.current === null) {
      handleRef.current = createProcessWorker(workerOptionsRef.current);
    }
    return handleRef.current;
  }
  useEffect(
    () => () => {
      handleRef.current?.terminate();
    },
    [],
  );

  const [abstraction, setAbstractionState] = useState<AbstractionOptions>(() => ({
    ...DEFAULT_ABSTRACTION,
    ...opts.abstraction,
  }));
  const [metric, setMetricState] = useState<ProcessExplorerMetricSpec>(() => ({
    ...DEFAULT_METRIC,
    ...opts.metric,
  }));
  const [selection, setSelection] = useState<ProcessSelection | null>(null);
  const [intents, setIntents] = useState<FilterIntent[]>([]);

  const setAbstraction = useCallback((next: Partial<AbstractionOptions>) => {
    setAbstractionState((prev) => ({ ...prev, ...next }));
  }, []);
  const setMetric = useCallback((next: Partial<ProcessExplorerMetricSpec>) => {
    setMetricState((prev) => ({ ...prev, ...next }));
  }, []);
  const onSelect = useCallback((next: ProcessSelection | null) => setSelection(next), []);
  const applyIntent = useCallback((intent: FilterIntent) => {
    setIntents((prev) => [...prev, intent]);
  }, []);
  const clearIntent = useCallback((index: number) => {
    setIntents((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const filteredLog = useMemo(
    () => (intents.length === 0 ? log : filterLog(log, intents)),
    [log, intents],
  );

  const useWorkerPath = filteredLog.events.length > workerThreshold;

  // Synchronous path: computed directly during render, so a caller never observes a
  // `loading` gap for a log that never crosses the threshold.
  const syncResult = useMemo<DiscoveryResult | null>(
    () => (useWorkerPath ? null : discoverInline(filteredLog)),
    [filteredLog, useWorkerPath],
  );

  const [asyncResult, setAsyncResult] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!useWorkerPath) {
      // Superseded by (or never needed) the async path — never leave a stale `true`
      // behind from a request that crossed the threshold before this one didn't.
      setLoading(false);
      return;
    }
    const requestId = (requestIdRef.current += 1);
    setLoading(true);
    const handle = getHandle();
    Promise.all([handle.discover(filteredLog), handle.variants(filteredLog)])
      .then(([graph, variants]) => {
        if (requestIdRef.current !== requestId) return; // a later request already answered
        setAsyncResult({ graph, variants });
        setLoading(false);
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return;
        // Degrade to the inline computation rather than getting stuck loading forever —
        // `createProcessWorker` already degrades internally; this catch is the belt for
        // an error the handle itself could not absorb (e.g. a `variants` call after a
        // `terminate()` this hook did not initiate).
        setAsyncResult(discoverInline(filteredLog));
        setLoading(false);
      });
    // `getHandle` is intentionally excluded — it is a stable ref-backed accessor, not
    // reactive state; including it would re-run this effect on every render.
  }, [filteredLog, useWorkerPath]);

  const rawResult = syncResult ?? asyncResult ?? { graph: EMPTY_GRAPH, variants: [] };

  const graph = useMemo(
    () => abstractGraph(rawResult.graph, abstraction),
    [rawResult.graph, abstraction],
  );

  const rework = useMemo(() => detectRework(filteredLog), [filteredLog]);

  const kpis = useMemo(() => {
    const normalized = asNormalizedLog(filteredLog);
    const medianThroughput = durationStats(normalized.cases.map((kase) => kase.duration)).median;
    return {
      cases: normalized.totals.cases,
      events: normalized.totals.events,
      variants: rawResult.variants.length,
      medianThroughput,
      reworkRate: rework.caseReworkRate,
    };
  }, [filteredLog, rawResult.variants, rework]);

  return {
    graph,
    variants: rawResult.variants,
    abstraction,
    setAbstraction,
    metric,
    setMetric,
    selection,
    onSelect,
    applyIntent,
    clearIntent,
    intents,
    filteredLog,
    hiddenCounts: graph.hidden,
    kpis,
    rework,
    loading,
  };
}
