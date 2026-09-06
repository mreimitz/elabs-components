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
 * - **Two independent discoveries when they genuinely differ, one when they don't**
 *   (RM-052 round 2, #227, Invariant F — filtering re-inks, it never removes): the FULL
 *   `log` and the `filteredLog` are each discovered on their own sync-or-worker path with
 *   their own `loading` flag and request-id ref, because either one can independently
 *   cross `workerThreshold`. With no intent active `filteredLog === log`, and the
 *   filtered role REUSES the full discovery instead of recomputing it — running two
 *   identical discoveries in that state was a round-2 regression against `4a1a244`, fixed
 *   in round 3 (G1); see `useLogDiscovery`'s own docblock for the skip mechanism.
 * - `graph` (the PUBLIC field) — abstraction runs on the FULL graph FIRST
 *   (`abstractGraph(fullGraph, abstraction)`), and the FILTERED graph is reconciled onto that
 *   result SECOND (`reconcileGraph`). This order is load-bearing, not incidental: reversing
 *   it would let a filter-ghosted element (zeroed to look unused) be mistaken by
 *   `abstractGraph`'s own least-frequent heuristic for a genuinely rare one and hidden by
 *   abstraction instead of merely dimmed by the filter. So a reader always sees the SAME
 *   node set regardless of which intents are active — filtering re-inks elements as
 *   `"excluded"` (via `selectionStates`), it never shrinks the rendered graph. Abstraction is
 *   still the only thing that removes a node from the render (RM-050's "sliders never change
 *   statistics" property, now paired with "intents never change the node set either").
 * - `variants` stays sourced from the FILTERED log alone (unlike `graph`, it narrows rather
 *   than ghosts — a variant list has no per-row "excluded but still there" concept to draw).
 * - `kpis`/`rework` — derived from `filteredLog` directly (case count, event count,
 *   `durationStats` over each case's own throughput time, `detectRework`), NOT from the
 *   abstracted/reconciled `graph` — abstraction and filtering both change what is DRAWN, never
 *   what the KPI strip reports for the cases actually in scope.
 *
 * ## Race safety
 *
 * Each of the two discoveries above owns its OWN request-id ref — a worker request in flight
 * for the full log and one in flight for the filtered log are superseded independently the
 * moment their respective input changes again, so a slow full-log import can never clobber a
 * fresher filtered-log result (or vice versa).
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
import type { FilterSpec } from "../core/filter-log";
import { filterLog } from "../core/filter-log";
import { reconcileGraph } from "../core";
import type { EventLog, FrequencyMode, PerformanceAgg, ProcessGraph, Variant } from "../core/types";
import {
  createProcessWorker,
  type CreateProcessWorkerOptions,
} from "../core/worker/create-process-worker";
import type { MetricLayer } from "../metric-layer-switch";
import type {
  ProcessFilterIntent,
  ProcessSelection,
  ProcessSelectionStates,
} from "../process-map/map-model";

/** What a node or an edge is painted with — the same domain `ProcessMap`'s metric reads. */
export type ProcessExplorerMetric = FrequencyMode | PerformanceAgg;

/** The two metric slots a process explorer coordinates. */
export interface ProcessExplorerMetricSpec {
  node: ProcessExplorerMetric;
  edge: ProcessExplorerMetric;
}

/**
 * Every intent this hook's `applyIntent` accepts — wider than `ProcessMap`'s own menu.
 *
 * `ProcessFilterIntent` (RM-051) is the four kinds `ProcessMap`'s filter-intent menu
 * offers (`with`/`without`/`startsWith`/`endsWith`) and stays scoped to exactly that menu.
 * This hook's `FilterIntent` widens it with `{ kind: "variant" }` (RM-052 round 2, #227) so
 * a variant-explorer view can drive the SAME `applyIntent`/`intents` pair to filter by a
 * variant selection — a case a click on the process map can never produce, but a click on a
 * variant row can. The widening is local to this hook's own type alias; it does not touch
 * `ProcessFilterIntent` or `ProcessMap`'s menu, which still only ever emits the original four.
 */
export type FilterIntent = ProcessFilterIntent | Extract<FilterSpec, { kind: "variant" }>;

/** Options for {@link useProcessExplorer}. */
export interface ProcessExplorerOptions {
  /** Initial abstraction sliders. Default: `{ activities: 1, paths: 1 }` — the identity. */
  abstraction?: Partial<AbstractionOptions>;
  /** Initial metric choice. Default: `{ node: "absolute", edge: "absolute" }`. */
  metric?: Partial<ProcessExplorerMetricSpec>;
  /** Initial metric layer — feed straight into `MetricLayerSwitch`'s `layer` prop. Default `"frequency"`. */
  layer?: MetricLayer;
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
  /**
   * Per-element states the active filter contributes — pass straight into `ProcessMap`'s
   * `selectionStates` prop (RM-052 round 2, #227, Invariant F). Every activity/transition an
   * intent excluded is marked `"excluded"` here; nothing is ever removed from `graph` itself.
   * `variants` (RM-052 round 3, #227, G2) marks every id named by an active
   * `{ kind: "variant" }` intent `"selected"` — read by `VariantExplorer` (RM-054), not by
   * `ProcessMap`, which has no variant nodes.
   */
  selectionStates: ProcessSelectionStates;
  /** Activities/paths abstraction is currently hiding — sourced from `abstractGraph`'s own `hidden` field. */
  hiddenCounts: { activities: number; paths: number };
  /**
   * Activities/transitions the active FILTER excluded — rendered, dimmed, never removed.
   * Disjoint from `hiddenCounts` by construction: `hiddenCounts` is what abstraction removed
   * from the render entirely, `excludedCounts` is what the filter re-inked but kept drawn.
   */
  excludedCounts: { activities: number; paths: number };
  /** The active metric layer — feed straight into `MetricLayerSwitch`'s `layer` prop. */
  layer: MetricLayer;
  /** Pass straight through as `MetricLayerSwitch`'s `onLayerChange` — a plain setter; the
   * frequency/performance metric coercion lives in `MetricLayerSwitch` itself, not here. */
  setLayer(next: MetricLayer): void;
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

interface DiscoveryState {
  result: DiscoveryResult;
  loading: boolean;
  settled: boolean;
}

/**
 * One log's own discovery/variants — sync inline below `workerThreshold`, off-thread above
 * it, its OWN request-id ref so it can be superseded independently of any other log this
 * hook is also discovering (RM-052 round 2, #227 — the full log and the filtered log each
 * get one of these; see the module docblock's "Race safety").
 *
 * `targetLog === null` means "skip — a sibling {@link useLogDiscovery} instance already
 * covers this role" (RM-052 round 3, #227, G1). It exists so the full-log and
 * filtered-log derivations can share one discovery when `filteredLog === log` (no intent
 * active) without calling this hook conditionally, which the Rules of Hooks forbid. A
 * skipped instance runs no memo and posts no request, and its `result` stays the
 * `EMPTY_GRAPH` placeholder for as long as it is skipped — but the caller must NOT read
 * that placeholder as real data the moment the skip ends. `settled` (RM-052 round 4, #227,
 * H1) is `false` until this instance has produced a result of its own — synchronously, in
 * the same render, for a log at or under `workerThreshold`; only once the worker request
 * resolves, above it — so a caller that keeps reusing the sibling discovery while
 * `!settled` never shows this instance's empty placeholder as if it were a settled answer.
 */
function useLogDiscovery(
  targetLog: EventLog | null,
  workerThreshold: number,
  getHandle: () => ReturnType<typeof createProcessWorker>,
): DiscoveryState {
  const useWorkerPath = targetLog !== null && targetLog.events.length > workerThreshold;

  // Synchronous path: computed directly during render, so a caller never observes a
  // `loading` gap for a log that never crosses the threshold.
  const syncResult = useMemo<DiscoveryResult | null>(
    () => (targetLog === null || useWorkerPath ? null : discoverInline(targetLog)),
    [targetLog, useWorkerPath],
  );

  const [asyncResult, setAsyncResult] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (targetLog === null || !useWorkerPath) {
      // Skipped, or superseded by (or never needed) the async path — never leave a stale
      // `true` behind from a request that crossed the threshold before this one didn't,
      // or from a filtered request the caller stopped needing when the filter cleared.
      setLoading(false);
      return;
    }
    const requestId = (requestIdRef.current += 1);
    setLoading(true);
    const handle = getHandle();
    Promise.all([handle.discover(targetLog), handle.variants(targetLog)])
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
        setAsyncResult(discoverInline(targetLog));
        setLoading(false);
      });
    // `getHandle` is intentionally excluded — it is a stable ref-backed accessor, not
    // reactive state; including it would re-run this effect on every render.
  }, [targetLog, useWorkerPath]);

  return {
    result: syncResult ?? asyncResult ?? { graph: EMPTY_GRAPH, variants: [] },
    loading,
    settled: syncResult !== null || asyncResult !== null,
  };
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
  // Both discoveries below share this one handle — `createProcessWorker`'s handle answers
  // concurrent requests independently, so the full-log and filtered-log discoveries never
  // block one another.
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
  const [layer, setLayerState] = useState<MetricLayer>(opts.layer ?? "frequency");
  const [selection, setSelection] = useState<ProcessSelection | null>(null);
  const [intents, setIntents] = useState<FilterIntent[]>([]);

  const setAbstraction = useCallback((next: Partial<AbstractionOptions>) => {
    setAbstractionState((prev) => ({ ...prev, ...next }));
  }, []);
  const setMetric = useCallback((next: Partial<ProcessExplorerMetricSpec>) => {
    setMetricState((prev) => ({ ...prev, ...next }));
  }, []);
  // A plain setter — the frequency/performance metric coercion that goes with a layer
  // switch lives in `MetricLayerSwitch` itself (it already calls `onMetricChange` before
  // `onLayerChange`), not here.
  const setLayer = useCallback((next: MetricLayer) => setLayerState(next), []);
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

  // Two independent discoveries — see the module docblock. `variants`, `kpis` and `rework`
  // read the FILTERED one; `graph` reads BOTH, full first through abstraction, then
  // reconciled against filtered (Invariant F: filtering re-inks, never removes).
  //
  // With no intent active, `filteredLog === log` (see `filteredLog` above), and the
  // filtered role REUSES the full discovery rather than recomputing it from scratch —
  // decision §1.4 step 3 / §4's whole cost argument rests on this: "the pipeline reuses
  // `fullRaw` for both roles and runs exactly one discovery — identical to today" (RM-052
  // round 3, #227, G1). `useLogDiscovery` cannot be called conditionally (Rules of
  // Hooks), so the second instance is always called, but is told to SKIP (`null`) exactly
  // when its sibling already covers the same log; its own request-id ref never fires in
  // that state, so the two derivations still supersede independently the moment the logs
  // genuinely diverge again.
  const sameLog = filteredLog === log;
  const fullDiscovery = useLogDiscovery(log, workerThreshold, getHandle);
  const filteredOwnDiscovery = useLogDiscovery(
    sameLog ? null : filteredLog,
    workerThreshold,
    getHandle,
  );
  // Keep reading the full discovery until the filtered instance has settled a result of
  // its OWN — not just until the skip ends (RM-052 round 4, #227, H1). The moment the
  // first intent makes `filteredLog !== log`, `filteredOwnDiscovery` starts running but
  // has not resolved yet on a worker-path log; reading it immediately would paint its
  // still-`EMPTY_GRAPH` placeholder (all-ghosted, all-zero) for the whole round-trip.
  const filteredDiscovery =
    sameLog || !filteredOwnDiscovery.settled ? fullDiscovery : filteredOwnDiscovery;
  // `loading` ORs the two RAW instances, not the substituted `filteredDiscovery` above —
  // reading `filteredDiscovery.loading` here would silently drop the real in-flight signal
  // during exactly the window this fix targets: while `filteredOwnDiscovery` is unsettled,
  // `filteredDiscovery` reads as `fullDiscovery` (already resolved, `loading: false`), so
  // ORing its `.loading` would report `false` even though `filteredOwnDiscovery.loading` is
  // genuinely `true`. `filteredOwnDiscovery.loading` is always `false` while skipped
  // (`sameLog`), so this is a no-op change there.
  const loading = fullDiscovery.loading || filteredOwnDiscovery.loading;

  const presented = useMemo(
    () => abstractGraph(fullDiscovery.result.graph, abstraction),
    [fullDiscovery.result.graph, abstraction],
  );

  const reconciled = useMemo(
    () => reconcileGraph(presented, filteredDiscovery.result.graph),
    [presented, filteredDiscovery.result.graph],
  );

  const graph = reconciled.graph;

  const selectionStates = useMemo<ProcessSelectionStates>(
    () => ({
      activities: Object.fromEntries(
        reconciled.excludedActivities.map((id) => [id, "excluded" as const]),
      ),
      transitions: Object.fromEntries(
        reconciled.excludedTransitions.map((key) => [key, "excluded" as const]),
      ),
      // Decision §1.4 step 5 (RM-052 round 3, #227, G2): there is no click channel for a
      // variant, so `"selected"` here is intent-derived — every id named by an active
      // `{ kind: "variant" }` intent, read by `VariantExplorer` (RM-054), not by
      // `ProcessMap`. This namespace was declared on `ProcessSelectionStates` from round 2
      // onward and never populated until this fix.
      variants: Object.fromEntries(
        intents
          .flatMap((intent) => (intent.kind === "variant" ? intent.ids : []))
          .map((id) => [id, "selected" as const]),
      ),
    }),
    [reconciled, intents],
  );

  const excludedCounts = useMemo(
    () => ({
      activities: reconciled.excludedActivities.length,
      paths: reconciled.excludedTransitions.length,
    }),
    [reconciled],
  );

  const rework = useMemo(() => detectRework(filteredLog), [filteredLog]);

  const kpis = useMemo(() => {
    const normalized = asNormalizedLog(filteredLog);
    const medianThroughput = durationStats(normalized.cases.map((kase) => kase.duration)).median;
    return {
      cases: normalized.totals.cases,
      events: normalized.totals.events,
      variants: filteredDiscovery.result.variants.length,
      medianThroughput,
      reworkRate: rework.caseReworkRate,
    };
  }, [filteredLog, filteredDiscovery.result.variants, rework]);

  return {
    graph,
    variants: filteredDiscovery.result.variants,
    abstraction,
    setAbstraction,
    metric,
    setMetric,
    layer,
    setLayer,
    selection,
    onSelect,
    applyIntent,
    clearIntent,
    intents,
    filteredLog,
    selectionStates,
    hiddenCounts: graph.hidden,
    excludedCounts,
    kpis,
    rework,
    loading,
  };
}
