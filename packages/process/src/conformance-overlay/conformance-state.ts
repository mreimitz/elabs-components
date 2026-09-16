/**
 * Conformance states on the process map — RM-062.
 *
 * Reads a `ConformanceResult` (RM-061's `tokenReplay`) as the three-colour overlay the
 * analysis names (§2): every activity and every observed transition is in the log AND the
 * model (`"both"`), in the log only (`"logOnly"`), or expected by the model but missing
 * from the log (`"modelOnly"`).
 *
 * ## How the state is derived — without the reference model in hand
 *
 * A `ConformanceResult` does not carry the model it was replayed against, and it does not
 * need to: token replay charges an `undesired` deviation to EVERY observed event whose
 * activity the model does not contain, so an observed activity is outside the model
 * exactly when it carries an `undesired` deviation. The rules, in precedence order:
 *
 * | element    | state        | when                                                         |
 * | ---------- | ------------ | ------------------------------------------------------------ |
 * | activity   | `logOnly`    | at least one `undesired` deviation names it                  |
 * | activity   | `modelOnly`  | at least one `skipped` deviation names it (cases jumped it)   |
 * | activity   | `both`       | otherwise                                                    |
 * | transition | `logOnly`    | deviations are charged to it, or either endpoint is `logOnly` |
 * | transition | `both`       | otherwise                                                    |
 *
 * A transition is never `modelOnly`: every edge on the map was observed. A model step
 * that NO case ever reached is not on the graph at all, so it cannot be painted here —
 * `ViolationList` still counts the cases that skipped it.
 *
 * ## Never colour alone (WCAG 1.4.1, analysis §5.4)
 *
 * Each state pairs a status tone with a distinct glyph AND a distinct line style —
 * solid circle / hollow triangle / dashed square — so the three read apart in greyscale.
 * {@link CONFORMANCE_STATE_ENCODING} is the one table every surface reads it from.
 */
import { Circle, SquareDashed, Triangle, type LucideIcon } from "lucide-react";
import type { ConformanceResult } from "../core/conformance";
import { EDGE_KEY_SEPARATOR } from "../core/discover-graph";
import type { ProcessMapEdge, ProcessMapNode } from "../process-map/map-model";

/** Where an element sits relative to the reference model. */
export type ConformanceState = "both" | "logOnly" | "modelOnly";

/** Every {@link ConformanceState}, in legend order. */
export const CONFORMANCE_STATES: readonly ConformanceState[] = ["both", "logOnly", "modelOnly"];

/** The status tone a state is painted with. */
export type ConformanceTone = "success" | "warning" | "destructive";

/** The line style a state is drawn with — the second non-colour channel. */
export type ConformanceDash = "solid" | "dotted" | "dashed";

/** Everything that encodes one state, colour included. */
export interface ConformanceStateEncoding {
  tone: ConformanceTone;
  /** Stable glyph name, mirrored to `data-glyph` so a test can assert distinctness. */
  glyph: "circle" | "triangle" | "square";
  /** Lucide glyph drawn for the state. */
  icon: LucideIcon;
  /** Whether the glyph is filled (`true`) or an outline. */
  filled: boolean;
  dash: ConformanceDash;
  /** SVG `stroke-dasharray` for a transition stroke; `undefined` keeps the edge's own. */
  strokeDasharray: string | undefined;
  /** Mark (fill-rung) utility for a glyph or swatch. */
  markClass: string;
  /** Ink (`-text` rung) utility for coloured text. */
  textClass: string;
  /** Border utilities: the tone's fill rung plus the line style. */
  borderClass: string;
  /** CSS colour reference for a stroke or a `--border` override. */
  colorVar: string;
}

/** The single source of truth for how each state looks. */
export const CONFORMANCE_STATE_ENCODING: Readonly<
  Record<ConformanceState, ConformanceStateEncoding>
> = Object.freeze({
  both: {
    tone: "success",
    glyph: "circle",
    icon: Circle,
    filled: true,
    dash: "solid",
    strokeDasharray: undefined,
    markClass: "text-success fill-success",
    textClass: "text-success-text",
    borderClass: "border-success border-solid",
    colorVar: "var(--success)",
  },
  logOnly: {
    tone: "warning",
    glyph: "triangle",
    icon: Triangle,
    filled: false,
    dash: "dotted",
    strokeDasharray: "2 4",
    markClass: "text-warning",
    textClass: "text-warning-text",
    borderClass: "border-warning border-dotted",
    colorVar: "var(--warning)",
  },
  modelOnly: {
    tone: "destructive",
    glyph: "square",
    icon: SquareDashed,
    filled: false,
    dash: "dashed",
    strokeDasharray: "6 4",
    markClass: "text-destructive",
    textClass: "text-destructive-text",
    borderClass: "border-destructive border-dashed",
    colorVar: "var(--destructive)",
  },
});

/** The words for each state. Override through a component's `labels` to localize. */
export interface ConformanceStateLabels {
  both: string;
  logOnly: string;
  modelOnly: string;
  /** The table twin's column header and the legend's title. */
  column: string;
}

/** The shipped English words for each state. */
export const CONFORMANCE_STATE_DEFAULT_LABELS: Readonly<ConformanceStateLabels> = Object.freeze({
  column: "Conformance",
  both: "Conforms — in log and model",
  logOnly: "Log only — not in the model",
  modelOnly: "Model only — skipped in the log",
});

/** Per-element conformance states for one `ConformanceResult`. */
export interface ConformanceStates {
  /** Keyed by activity id. An activity absent here is `"both"`. */
  activities: ReadonlyMap<string, ConformanceState>;
  /**
   * Keyed `source + EDGE_KEY_SEPARATOR + target` — the id `discoverGraph` and the map give
   * the transition. A transition absent here is resolved by {@link transitionConformance}.
   */
  transitions: ReadonlyMap<string, ConformanceState>;
}

/** Derive activity and transition states from a replay result. See this module's docblock. */
export function resolveConformanceStates(conformance: ConformanceResult): ConformanceStates {
  const activities = new Map<string, ConformanceState>();
  for (const trace of conformance.traces) {
    for (const deviation of trace.deviations) {
      if (deviation.activity === undefined) continue;
      if (deviation.type === "undesired") activities.set(deviation.activity, "logOnly");
      else if (deviation.type === "skipped" && activities.get(deviation.activity) !== "logOnly") {
        activities.set(deviation.activity, "modelOnly");
      }
    }
  }
  const transitions = new Map<string, ConformanceState>();
  for (const [key, { deviations }] of Object.entries(conformance.perEdge)) {
    if (deviations > 0) transitions.set(key, "logOnly");
  }
  return { activities, transitions };
}

/** The state of one activity. */
export function activityConformance(states: ConformanceStates, activity: string): ConformanceState {
  return states.activities.get(activity) ?? "both";
}

/** The state of one observed transition. */
export function transitionConformance(
  states: ConformanceStates,
  source: string,
  target: string,
): ConformanceState {
  const charged = states.transitions.get(`${source}${EDGE_KEY_SEPARATOR}${target}`);
  if (charged) return charged;
  if (
    activityConformance(states, source) === "logOnly" ||
    activityConformance(states, target) === "logOnly"
  ) {
    return "logOnly";
  }
  return "both";
}

/**
 * A map node with its conformance state folded in: `data.conformance` for the glyph and
 * dash, `data-conformance` on React Flow's own node element (additive to
 * `data-selection`), and the state's word appended to the accessible name — so the state
 * reaches assistive technology as text, never as colour.
 */
export function withActivityConformance(
  node: ProcessMapNode,
  states: ConformanceStates,
  labels: ConformanceStateLabels = CONFORMANCE_STATE_DEFAULT_LABELS,
): ProcessMapNode {
  const state = activityConformance(states, node.id);
  return {
    ...node,
    data: { ...node.data, conformance: state },
    ariaLabel: node.ariaLabel ? `${node.ariaLabel}, ${labels[state]}` : labels[state],
    domAttributes: {
      ...node.domAttributes,
      "data-conformance": state,
    } as ProcessMapNode["domAttributes"],
  };
}

/** A map edge with its conformance state folded in. See {@link withActivityConformance}. */
export function withTransitionConformance(
  edge: ProcessMapEdge,
  states: ConformanceStates,
  labels: ConformanceStateLabels = CONFORMANCE_STATE_DEFAULT_LABELS,
): ProcessMapEdge {
  const state = transitionConformance(states, edge.source, edge.target);
  const ariaLabel = edge.ariaLabel ? `${edge.ariaLabel}, ${labels[state]}` : labels[state];
  return {
    ...edge,
    ariaLabel,
    data: edge.data ? { ...edge.data, conformance: state, ariaLabel } : edge.data,
  };
}
