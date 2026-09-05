/**
 * map-model — the pure `ProcessGraph → React Flow nodes/edges` mapping (RM-051).
 *
 * Everything the process map DECIDES about a graph lives here, and nothing here renders:
 * no React, no DOM, no engine calls. That is deliberate and load-bearing in three ways.
 *
 * 1. **The canvas and the accessible `TableView` twin read ONE model.** Both surfaces are
 *    built from the same {@link ProcessMapModel}, so a number can never drift between the
 *    picture and the table a screen-reader user is actually given.
 * 2. **Encoding is testable without a browser.** Stroke widths, saturations, printed
 *    labels and selection states are plain data here, so a unit test can assert the
 *    encoding rules instead of screenshotting them.
 * 3. **Layout can be cached independently of metric.** The model changes whenever the
 *    metric changes; the STRUCTURE key (see {@link processGraphStructureKey}) does not, so
 *    `useProcessLayout` reuses positions across a metric switch.
 *
 * ## The encoding contract (WCAG 1.4.1 — colour is never the only channel)
 *
 * Two flow-layer defects (#321 edge colour collapsing on a low-chroma palette, #297 edge
 * colour not refreshing on a theme switch) mean edge COLOUR cannot be trusted to separate
 * two values. This module is designed so it never has to be:
 *
 * - an **edge** metric reaches the reader through `weight` (stroke width, the
 *   `[1.5, 8]` px linear min-max clamp `computeEdgeWeightScale` applies) AND through a
 *   printed `label` pill — colour (`value`/`valueDomain`) is the third channel, never the
 *   first;
 * - a **node** metric reaches the reader through a printed value AND a bar whose LENGTH is
 *   the same fraction the fill saturation encodes — saturation alone would be colour-only;
 * - **self-loop**, **back-edge** and each **selection** state carry a shape, dash or
 *   opacity change, not a hue change.
 *
 * Render any story in greyscale and two different metric values are still distinguishable.
 */
// Deep module imports rather than the `../core` barrel ON PURPOSE. `/core` builds in its
// own tsup pass because it must stay engine-free (ADR 0034), and `createProcessWorker`'s
// `new URL("./process-worker.ts", import.meta.url)` literal only resolves next to
// `dist/core/index.js`. Reaching through the barrel would put that literal on the trunk
// bundle's tree-shaking mercy; naming the four modules the map actually needs takes it off
// the table entirely. Same package, so this is an ordinary relative import.
import type { Edge, Node } from "@xyflow/react";
import { performanceValue } from "../core/aggregate-performance";
import { EDGE_KEY_SEPARATOR } from "../core/discover-graph";
import { minMax } from "../core/scale";
import type { ReworkStats } from "../core/detect-rework";
import type { FilterSpec } from "../core/filter-log";
import type {
  ActivityStats,
  FrequencyMode,
  PerformanceAgg,
  ProcessGraph,
  TransitionStats,
} from "../core/types";

// ── Public vocabulary ────────────────────────────────────────────────────────

/**
 * What a node or an edge is painted with: a frequency reading of the discovered counts,
 * or an aggregate of the measured durations.
 */
export type ProcessMetric = FrequencyMode | PerformanceAgg;

/** The three metric slots a process map paints from. */
export interface ProcessMetricSpec {
  /** Drives node saturation, the node's meter bar and the node's printed value. */
  node: ProcessMetric;
  /** Drives edge stroke width and the edge's printed label pill. */
  edge: ProcessMetric;
  /** Optional second reading, printed beside the first on both nodes and edges. */
  secondary?: ProcessMetric;
}

/** Which half of the graph a selection points at. */
export type ProcessSelectionKind = "activity" | "transition";

/**
 * A coordinated selection. `id` is the ACTIVITY NAME for `"activity"` and the
 * `source`+separator+`target` edge key (see {@link processEdgeId}) for `"transition"` —
 * the same keys `/core` uses, so a selection round-trips through `filterLog` and a URL
 * unchanged.
 */
export interface ProcessSelection {
  kind: ProcessSelectionKind;
  id: string;
}

/**
 * What the map's filter menu emits. A strict subset of `/core`'s `FilterSpec`, so a
 * consumer can hand it straight to `filterLog` with no translation layer — which is the
 * point: an intent the map invents and nothing can consume is not an intent.
 */
export type ProcessFilterIntent = Extract<
  FilterSpec,
  { kind: "with" } | { kind: "without" } | { kind: "startsWith" } | { kind: "endsWith" }
>;

/** The four intents the map's own menu offers, in menu order. */
export const PROCESS_FILTER_INTENT_KINDS = ["with", "without", "startsWith", "endsWith"] as const;

/** Human wording for each intent, used by the menu and by the intent's accessible name. */
export const PROCESS_FILTER_INTENT_LABELS: Readonly<Record<ProcessFilterIntent["kind"], string>> =
  Object.freeze({
    with: "Keep cases containing",
    without: "Keep cases without",
    startsWith: "Keep cases starting with",
    endsWith: "Keep cases ending with",
  });

/**
 * How an element relates to the current selection AND the active filter.
 *
 * - `"selected"` — the element the reader picked.
 * - `"associated"` — ordinary; either nothing is selected, or this element touches the
 *   selection, and no active filter excludes it.
 * - `"excluded"` — outside the selection's neighbourhood, or dropped by the active filter;
 *   dimmed, but still fully operable. Clicking an excluded element is how a reader filters
 *   it back in, so it is never `aria-disabled` — see {@link resolveSelectionState}. The
 *   dimming is a REDUNDANT cue: `activityAriaLabel`/`transitionAriaLabel` already append the
 *   word "excluded" to the element's accessible name, so the state reaches assistive
 *   technology through real text, not only through opacity.
 */
export type ProcessSelectionState = "selected" | "associated" | "excluded";

/**
 * Per-element selection/filter states, sparse — an id with no entry defaults through
 * {@link resolveSelectionState}'s own rules. Keyed exactly like {@link ProcessSelection}:
 * activity name for `activities`, {@link processEdgeId} for `transitions`.
 *
 * `variants` is carried here for API symmetry with the other two namespaces even though
 * `ProcessMap` does not read it (the variant LIST narrows rather than ghosts — decision
 * `RM-052-tristate-decision.md` §3); a future variant-explorer view may.
 */
export interface ProcessSelectionStates {
  activities?: Readonly<Record<string, ProcessSelectionState>>;
  transitions?: Readonly<Record<string, ProcessSelectionState>>;
  variants?: Readonly<Record<string, ProcessSelectionState>>;
}

// ── Node / edge data ─────────────────────────────────────────────────────────

/** `data` carried by every {@link ProcessMapNode}. */
export interface ProcessActivityNodeData extends Record<string, unknown> {
  /** Activity name — the node identity and its visible title. */
  title: string;
  /** What the primary number MEANS ("Cases", "Median duration"), shown as the eyebrow. */
  metricLabel: string;
  /** The primary metric, already formatted for display. */
  primaryLabel: string;
  /** The primary metric as a number, for the meter and for tests. */
  primaryValue: number;
  /** The secondary metric, already formatted. Absent when `metric.secondary` is unset. */
  secondaryLabel?: string;
  /** `primaryValue` as a `0..1` fraction of the graph's node-metric domain. */
  saturation: number;
  isStart: boolean;
  isEnd: boolean;
  /** Repeat executions of this activity across the log; omitted when no rework data. */
  reworkCount?: number;
  selectionState: ProcessSelectionState;
}

/** `data` carried by every {@link ProcessMapEdge}. */
export interface ProcessTransitionEdgeData extends Record<string, unknown> {
  source: string;
  target: string;
  /** Drives stroke width through `computeEdgeWeightScale`'s `[1.5, 8]` px min-max clamp. */
  weight: number;
  /** Drives stroke colour — the THIRD channel, never the first. */
  value: number;
  /** `[min, max]` the colour ramp interpolates `value` across. */
  valueDomain: [number, number];
  /** The printed pill — the second, colour-free channel for the same measure as `weight`. */
  label: string;
  secondaryLabel?: string;
  isSelfLoop: boolean;
  isBackEdge: boolean;
  selectionState: ProcessSelectionState;
}

/** A process-map activity node. Register as `nodeTypes={{ "process-activity": … }}`. */
export type ProcessMapNode = Node<ProcessActivityNodeData, "process-activity">;
/** A process-map transition edge. Register as `edgeTypes={{ "process-transition": … }}`. */
export type ProcessMapEdge = Edge<ProcessTransitionEdgeData, "process-transition">;

/** One row of the accessible `TableView` twin — activities half. */
export interface ProcessActivityRow {
  id: string;
  title: string;
  primaryLabel: string;
  secondaryLabel?: string;
  reworkCount?: number;
  role: string;
  selectionState: ProcessSelectionState;
}

/** One row of the accessible `TableView` twin — transitions half. */
export interface ProcessTransitionRow {
  id: string;
  source: string;
  target: string;
  primaryLabel: string;
  secondaryLabel?: string;
  shape: string;
  selectionState: ProcessSelectionState;
}

/** Everything the canvas and the table are both rendered from. */
export interface ProcessMapModel {
  nodes: ProcessMapNode[];
  edges: ProcessMapEdge[];
  /** `[min, max]` of the node metric across the graph. */
  nodeDomain: [number, number];
  /** `[min, max]` of the edge metric across the graph — the `Legend` scale's domain. */
  edgeDomain: [number, number];
  /** What the node metric means, e.g. "Cases". */
  nodeMetricLabel: string;
  /** What the edge metric means, e.g. "Transitions". */
  edgeMetricLabel: string;
  activityRows: ProcessActivityRow[];
  transitionRows: ProcessTransitionRow[];
  /** Format one edge-metric value the way the map prints it — used by the `Legend`. */
  formatEdgeValue: (value: number) => string;
}

// ── Metric resolution ────────────────────────────────────────────────────────

/**
 * The frequency readings an ACTIVITY can actually answer from `ActivityStats`.
 *
 * `relative_antecedent` / `relative_consequent` are edge-only readings (they are shares of
 * a source's or a target's traffic — a node has no antecedent), and `max_repetitions`
 * needs the per-case maximum, which discovery does not retain. Rather than invent a
 * number for those three, {@link resolveActivityFrequencyMode} maps them onto the nearest
 * reading the data supports and the RESOLVED mode is what labels the value — so the map
 * never prints one measure under another measure's name.
 */
export type ActivityFrequencyMode = Extract<
  FrequencyMode,
  "absolute" | "absolute_case" | "relative" | "relative_case"
>;

/** See {@link ActivityFrequencyMode} — a total, documented, tested resolution. */
export function resolveActivityFrequencyMode(mode: FrequencyMode): ActivityFrequencyMode {
  switch (mode) {
    case "absolute_case":
      return "absolute_case";
    case "relative":
      return "relative";
    case "relative_case":
    case "relative_antecedent":
    case "relative_consequent":
      return "relative_case";
    case "max_repetitions":
    case "absolute":
    default:
      return "absolute";
  }
}

/**
 * The frequency readings a TRANSITION can answer from `TransitionStats`.
 *
 * Only `max_repetitions` is unsupported — the per-case maximum is not retained by
 * discovery — and it resolves to `absolute`, the count it is a maximum of.
 */
export type TransitionFrequencyMode = Exclude<FrequencyMode, "max_repetitions">;

/** See {@link TransitionFrequencyMode}. */
export function resolveTransitionFrequencyMode(mode: FrequencyMode): TransitionFrequencyMode {
  return mode === "max_repetitions" ? "absolute" : mode;
}

const PERFORMANCE_AGGS = new Set<string>([
  "median",
  "mean",
  "min",
  "max",
  "sum",
  "p90",
  "trimmed_mean",
]);

/** Whether a metric names a duration aggregate rather than a frequency reading. */
export function isPerformanceMetric(metric: ProcessMetric): metric is PerformanceAgg {
  return PERFORMANCE_AGGS.has(metric);
}

const PERFORMANCE_AGG_LABELS: Readonly<Record<PerformanceAgg, string>> = Object.freeze({
  median: "Median duration",
  mean: "Mean duration",
  min: "Fastest",
  max: "Slowest",
  sum: "Total duration",
  p90: "90th percentile duration",
  trimmed_mean: "Trimmed mean duration",
});

const ACTIVITY_FREQUENCY_LABELS: Readonly<Record<ActivityFrequencyMode, string>> = Object.freeze({
  absolute: "Occurrences",
  absolute_case: "Cases",
  relative: "Share of events",
  relative_case: "Share of cases",
});

const TRANSITION_FREQUENCY_LABELS: Readonly<Record<TransitionFrequencyMode, string>> =
  Object.freeze({
    absolute: "Transitions",
    absolute_case: "Cases",
    relative: "Share of transitions",
    relative_case: "Share of cases",
    relative_antecedent: "Share of source traffic",
    relative_consequent: "Share of target traffic",
  });

/** What a node's metric is CALLED once resolved — the eyebrow and the a11y name use it. */
export function nodeMetricLabel(metric: ProcessMetric): string {
  return isPerformanceMetric(metric)
    ? PERFORMANCE_AGG_LABELS[metric]
    : ACTIVITY_FREQUENCY_LABELS[resolveActivityFrequencyMode(metric)];
}

/** What an edge's metric is CALLED once resolved. */
export function edgeMetricLabel(metric: ProcessMetric): string {
  return isPerformanceMetric(metric)
    ? PERFORMANCE_AGG_LABELS[metric]
    : TRANSITION_FREQUENCY_LABELS[resolveTransitionFrequencyMode(metric)];
}

/** Whether a resolved reading is a `0..1` share rather than a count. */
function isShare(metric: ProcessMetric): boolean {
  if (isPerformanceMetric(metric)) return false;
  const resolved = resolveTransitionFrequencyMode(metric);
  return resolved !== "absolute" && resolved !== "absolute_case";
}

// ── Metric values ────────────────────────────────────────────────────────────

/** The node metric of one activity, as a plain number. Pure and total. */
export function activityMetricValue(
  activity: ActivityStats,
  metric: ProcessMetric,
  totals: ProcessGraph["totals"],
): number {
  if (isPerformanceMetric(metric)) return performanceValue(activity.duration, metric);
  switch (resolveActivityFrequencyMode(metric)) {
    case "absolute_case":
      return activity.cases;
    case "relative":
      return totals.events === 0 ? 0 : activity.instances / totals.events;
    case "relative_case":
      return totals.cases === 0 ? 0 : activity.cases / totals.cases;
    case "absolute":
    default:
      return activity.instances;
  }
}

/** Denominators the two per-endpoint edge shares need, computed once per graph. */
export interface ProcessEdgeDenominators {
  /** Total of every transition count in the graph. */
  total: number;
  /** Activity → total count of the transitions LEAVING it. */
  outgoing: Map<string, number>;
  /** Activity → total count of the transitions ENTERING it. */
  incoming: Map<string, number>;
}

/** Build the per-graph denominators the antecedent/consequent shares divide by. */
export function processEdgeDenominators(
  transitions: readonly TransitionStats[],
): ProcessEdgeDenominators {
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  let total = 0;
  for (const t of transitions) {
    total += t.count;
    outgoing.set(t.source, (outgoing.get(t.source) ?? 0) + t.count);
    incoming.set(t.target, (incoming.get(t.target) ?? 0) + t.count);
  }
  return { total, outgoing, incoming };
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

/** The edge metric of one transition, as a plain number. Pure and total. */
export function transitionMetricValue(
  transition: TransitionStats,
  metric: ProcessMetric,
  totals: ProcessGraph["totals"],
  denominators: ProcessEdgeDenominators,
): number {
  if (isPerformanceMetric(metric)) return performanceValue(transition.duration, metric);
  switch (resolveTransitionFrequencyMode(metric)) {
    case "absolute_case":
      return transition.caseCount;
    case "relative":
      return ratio(transition.count, denominators.total);
    case "relative_case":
      return ratio(transition.caseCount, totals.cases);
    case "relative_antecedent":
      return ratio(transition.count, denominators.outgoing.get(transition.source) ?? 0);
    case "relative_consequent":
      return ratio(transition.count, denominators.incoming.get(transition.target) ?? 0);
    case "absolute":
    default:
      return transition.count;
  }
}

// ── Formatting ───────────────────────────────────────────────────────────────

/** Milliseconds per unit, largest first — the ladder {@link formatDurationMs} walks. */
const DURATION_LADDER: readonly (readonly [number, string])[] = [
  [86_400_000, "d"],
  [3_600_000, "h"],
  [60_000, "min"],
  [1_000, "s"],
];

/**
 * A duration in milliseconds, spoken in the largest unit that leaves a number at or above
 * one.
 *
 * One decimal below 10 and none above, so "3.4 d" and "18 h" both read as measurements
 * rather than as false precision. A non-finite or negative input answers an em dash — a
 * process map has legitimate holes (an activity that never followed anything), and a
 * printed `NaN` is worse than a printed dash.
 */
export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms === 0) return "0 s";
  for (const [size, unit] of DURATION_LADDER) {
    if (ms >= size) {
      const scaled = ms / size;
      return `${scaled < 10 ? scaled.toFixed(1) : Math.round(scaled)} ${unit}`;
    }
  }
  return `${Math.round(ms)} ms`;
}

/** A count, grouped by the runtime locale; a share, as a percentage with one decimal. */
export function formatMetricValue(value: number, metric: ProcessMetric): string {
  if (isPerformanceMetric(metric)) return formatDurationMs(value);
  if (!Number.isFinite(value)) return "—";
  if (isShare(metric)) return `${(value * 100).toFixed(1)}%`;
  return value.toLocaleString();
}

// ── Identity ─────────────────────────────────────────────────────────────────

/**
 * The stable id of a transition: source, {@link EDGE_KEY_SEPARATOR}, target — keyed
 * exactly the way `/core` keys it. A selection, a performance-layer lookup and a React
 * Flow edge therefore all name the same edge with the same string, with no translation.
 */
export function processEdgeId(source: string, target: string): string {
  return `${source}${EDGE_KEY_SEPARATOR}${target}`;
}

/**
 * A cheap, order-independent key over the graph's STRUCTURE — node ids and edge ids only,
 * never a metric. `useProcessLayout` caches on it, which is what lets a metric switch
 * reuse the existing positions instead of re-running dagre.
 */
export function processGraphStructureKey(graph: ProcessGraph): string {
  const activities = graph.activities.map((a) => a.id).sort();
  const transitions = graph.transitions.map((t) => processEdgeId(t.source, t.target)).sort();
  return `${activities.join(EDGE_KEY_SEPARATOR)}|${transitions.join(EDGE_KEY_SEPARATOR)}`;
}

// ── Selection ────────────────────────────────────────────────────────────────

/** The activities and transitions a selection keeps in play. */
export interface ProcessSelectionNeighbourhood {
  activities: Set<string>;
  transitions: Set<string>;
}

/**
 * Which activities and transitions a selection keeps in play.
 *
 * Selecting an ACTIVITY keeps that activity, every activity directly connected to it, and
 * every edge incident to it. Selecting a TRANSITION keeps its two endpoints and itself.
 * Everything else becomes `"excluded"` — dimmed, but never `aria-disabled` (see
 * {@link resolveSelectionState}).
 */
export function selectionNeighbourhood(
  graph: ProcessGraph,
  selection: ProcessSelection | null | undefined,
): ProcessSelectionNeighbourhood | null {
  if (!selection) return null;
  const activities = new Set<string>();
  const transitions = new Set<string>();
  if (selection.kind === "activity") {
    activities.add(selection.id);
    for (const t of graph.transitions) {
      if (t.source !== selection.id && t.target !== selection.id) continue;
      transitions.add(processEdgeId(t.source, t.target));
      activities.add(t.source);
      activities.add(t.target);
    }
    return { activities, transitions };
  }
  for (const t of graph.transitions) {
    if (processEdgeId(t.source, t.target) !== selection.id) continue;
    transitions.add(selection.id);
    activities.add(t.source);
    activities.add(t.target);
  }
  return { activities, transitions };
}

/**
 * Resolve one element's tri-state {@link ProcessSelectionState} from BOTH the coordinated
 * click selection and the active filter's per-element states — the two channels
 * `ProcessMap` renders together. Five rules, in precedence order (RM-052 round 2, #227):
 *
 * 1. **The element IS the click target** → `"selected"`. This wins over everything else,
 *    including an active filter's own `"excluded"` — clicking an excluded element is how a
 *    reader re-focuses it, so the click must always win.
 * 2. **`states` already says `"excluded"`** → `"excluded"`. This must be checked BEFORE
 *    rule 3: a filter-excluded element stays excluded even when it happens to sit inside
 *    the neighbourhood of whatever is currently click-selected — the filter's exclusion is
 *    not something a click's neighbourhood should be able to override.
 * 3. **A click target exists and this element sits outside its neighbourhood** →
 *    `"excluded"`.
 * 4. **`states` carries an entry for this element** → that entry (`"associated"` or
 *    `"selected"` from a filter's own point of view — reserved for a future filter shape
 *    that can name a "primary" match; today filters only ever produce `"excluded"`
 *    entries, which rule 2 already handles).
 * 5. **Otherwise** → `"associated"`, the default.
 */
export function resolveSelectionState(
  id: string,
  kind: ProcessSelectionKind,
  selection: ProcessSelection | null | undefined,
  neighbourhood: ProcessSelectionNeighbourhood | null,
  states?: ProcessSelectionStates,
): ProcessSelectionState {
  if (selection && selection.kind === kind && selection.id === id) return "selected";

  const namespace = kind === "activity" ? states?.activities : states?.transitions;
  const filterState = namespace?.[id];

  if (filterState === "excluded") return "excluded";

  if (selection && neighbourhood) {
    const kept = kind === "activity" ? neighbourhood.activities : neighbourhood.transitions;
    if (!kept.has(id)) return "excluded";
  }

  if (filterState !== undefined) return filterState;

  return "associated";
}

// ── The model ────────────────────────────────────────────────────────────────

/** Inputs to {@link buildProcessMapModel}. */
export interface BuildProcessMapModelOptions {
  graph: ProcessGraph;
  metric: ProcessMetricSpec;
  /** Optional rework tallies (from `/core`'s `detectRework`) for the node badge. */
  rework?: ReworkStats;
  selection?: ProcessSelection | null;
  /**
   * Per-element states an active filter contributes (RM-052 round 2, #227) — merged with
   * the click `selection` by {@link resolveSelectionState}. Omitting it reproduces the
   * pre-filter behaviour exactly: every element resolves through rules 1/3/5 alone.
   */
  selectionStates?: ProcessSelectionStates;
  /**
   * Edge ids `layoutFlow` reported as running against the layout direction. Supplied on
   * the SECOND pass, after a layout exists — the first pass has no ranks to read, so
   * every edge starts `isBackEdge: false` exactly as `discoverGraph` leaves it.
   */
  backEdgeIds?: ReadonlySet<string>;
}

/**
 * Map a discovered (or abstracted) graph plus a metric choice into everything both the
 * canvas and the table render. Pure: same inputs, same model, no clock and no DOM.
 */
export function buildProcessMapModel({
  graph,
  metric,
  rework,
  selection,
  selectionStates,
  backEdgeIds,
}: BuildProcessMapModelOptions): ProcessMapModel {
  const neighbourhood = selectionNeighbourhood(graph, selection);
  const denominators = processEdgeDenominators(graph.transitions);

  const nodeValues = graph.activities.map((a) => activityMetricValue(a, metric.node, graph.totals));
  const nodeDomain = minMax(nodeValues);
  const edgeValues = graph.transitions.map((t) =>
    transitionMetricValue(t, metric.edge, graph.totals, denominators),
  );
  const edgeDomain = minMax(edgeValues);

  const resolvedNodeMetricLabel = nodeMetricLabel(metric.node);
  const resolvedEdgeMetricLabel = edgeMetricLabel(metric.edge);
  const nodeSpan = nodeDomain[1] - nodeDomain[0];

  const nodes: ProcessMapNode[] = graph.activities.map((activity, index) => {
    const primaryValue = nodeValues[index] as number;
    const secondaryLabel =
      metric.secondary === undefined
        ? undefined
        : formatMetricValue(
            activityMetricValue(activity, metric.secondary, graph.totals),
            metric.secondary,
          );
    const reworkEntry = rework?.perActivity[activity.id];
    const reworkCount =
      reworkEntry === undefined ? undefined : reworkEntry.selfLoops + reworkEntry.loops;
    const selectionState = resolveSelectionState(
      activity.id,
      "activity",
      selection,
      neighbourhood,
      selectionStates,
    );
    const data: ProcessActivityNodeData = {
      title: activity.label || activity.id,
      metricLabel: resolvedNodeMetricLabel,
      primaryLabel: formatMetricValue(primaryValue, metric.node),
      primaryValue,
      secondaryLabel,
      // A single-activity graph (or a flat metric) has no domain to sit in; half
      // saturation is the honest answer — "no comparison available" — rather than a
      // full-strength fill claiming this is the busiest node in a set of one.
      saturation: nodeSpan === 0 ? 0.5 : (primaryValue - nodeDomain[0]) / nodeSpan,
      isStart: activity.isStart,
      isEnd: activity.isEnd,
      reworkCount,
      selectionState,
    };
    return {
      id: activity.id,
      type: "process-activity",
      position: { x: 0, y: 0 },
      data,
      draggable: false,
      // React Flow reads a node's accessible name from the node OBJECT, not from the
      // component — the same seam `withWeightedEdgeAria` exists for on the edge side
      // (#285). Without this the node announces only its id and the metric the map
      // exists to show reaches no assistive technology.
      ariaLabel: activityAriaLabel(data),
      // No `aria-disabled` here even when `selectionState === "excluded"` — an excluded
      // node stays fully operable (clicking it is how a reader filters it back in), and
      // `activityAriaLabel` already appends the word "excluded" to its accessible name, so
      // assistive technology gets the state as real text rather than a lie about
      // disablement. See `ProcessSelectionState`'s own doc comment.
      domAttributes: {
        "data-selection": selectionState,
        "data-activity": activity.id,
      } as ProcessMapNode["domAttributes"],
    };
  });

  const edges: ProcessMapEdge[] = graph.transitions.map((transition, index) => {
    const value = edgeValues[index] as number;
    const id = processEdgeId(transition.source, transition.target);
    const secondaryLabel =
      metric.secondary === undefined
        ? undefined
        : formatMetricValue(
            transitionMetricValue(transition, metric.secondary, graph.totals, denominators),
            metric.secondary,
          );
    const selectionState = resolveSelectionState(
      id,
      "transition",
      selection,
      neighbourhood,
      selectionStates,
    );
    const data: ProcessTransitionEdgeData = {
      source: transition.source,
      target: transition.target,
      weight: value,
      value,
      valueDomain: edgeDomain,
      label: formatMetricValue(value, metric.edge),
      secondaryLabel,
      isSelfLoop: transition.isSelfLoop,
      isBackEdge: backEdgeIds?.has(id) ?? transition.isBackEdge,
      selectionState,
    };
    return {
      id,
      source: transition.source,
      target: transition.target,
      type: "process-transition",
      data,
      ariaLabel: transitionAriaLabel(data, resolvedEdgeMetricLabel),
    };
  });

  const activityRows: ProcessActivityRow[] = nodes.map((node) => ({
    id: node.id,
    title: node.data.title,
    primaryLabel: node.data.primaryLabel,
    secondaryLabel: node.data.secondaryLabel,
    reworkCount: node.data.reworkCount,
    role: activityRole(node.data),
    selectionState: node.data.selectionState,
  }));

  const transitionRows: ProcessTransitionRow[] = edges.map((edge) => {
    const data = edge.data as ProcessTransitionEdgeData;
    return {
      id: edge.id,
      source: data.source,
      target: data.target,
      primaryLabel: data.label,
      secondaryLabel: data.secondaryLabel,
      shape: transitionShape(data),
      selectionState: data.selectionState,
    };
  });

  return {
    nodes,
    edges,
    nodeDomain,
    edgeDomain,
    nodeMetricLabel: resolvedNodeMetricLabel,
    edgeMetricLabel: resolvedEdgeMetricLabel,
    activityRows,
    transitionRows,
    formatEdgeValue: (value: number) => formatMetricValue(value, metric.edge),
  };
}

/**
 * The word for an activity's position in the process — printed in the table's own column
 * and folded into the node's accessible name, so "this is where cases start" survives
 * without the start/end glyph.
 */
export function activityRole(data: ProcessActivityNodeData): string {
  if (data.isStart && data.isEnd) return "Start and end";
  if (data.isStart) return "Start";
  if (data.isEnd) return "End";
  return "Step";
}

/** The word for an edge's shape — the non-colour channel, said in text. */
export function transitionShape(data: ProcessTransitionEdgeData): string {
  if (data.isSelfLoop) return "Self-loop";
  if (data.isBackEdge) return "Back edge";
  return "Forward";
}

/** The accessible name of one activity node. */
export function activityAriaLabel(data: ProcessActivityNodeData): string {
  const parts = [`${data.title} — ${activityRole(data).toLowerCase()}`];
  parts.push(`${data.metricLabel} ${data.primaryLabel}`);
  if (data.secondaryLabel) parts.push(data.secondaryLabel);
  if (data.reworkCount) parts.push(`${data.reworkCount} repeated executions`);
  if (data.selectionState !== "associated") parts.push(data.selectionState);
  return parts.join(", ");
}

/** The accessible name of one transition edge. */
export function transitionAriaLabel(data: ProcessTransitionEdgeData, metricLabel: string): string {
  const parts = [
    data.isSelfLoop
      ? `Self-loop on ${data.source}`
      : `${data.isBackEdge ? "Back edge" : "Transition"} from ${data.source} to ${data.target}`,
    `${metricLabel} ${data.label}`,
  ];
  if (data.secondaryLabel) parts.push(data.secondaryLabel);
  if (data.selectionState !== "associated") parts.push(data.selectionState);
  return parts.join(", ");
}
