/**
 * Worked example — an external selection engine driving `ProcessMap` (RM-058, #207).
 *
 * REFERENCE IMPLEMENTATION — copy it into your app; nothing in this repo runs it. See
 * `./README.md` for the two-input model and the tri-state contract this file implements.
 *
 * The package never talks to a selection engine directly (D5 — brand-ui is a presentation
 * layer, not a runtime): every line below that knows anything about `SelectionEngine`
 * lives in this file, not in `@elabs-ai/components-process`. Swap `SelectionEngine` for
 * whatever your host platform's own associative-selection API actually looks like and the
 * mapping functions are the only things that change — `ProcessMap` itself does not.
 */
import { ProcessMap, processEdgeId } from "@elabs-ai/components-process";
import type {
  ProcessFilterIntent,
  ProcessSelection,
  ProcessSelectionState,
  ProcessSelectionStates,
} from "@elabs-ai/components-process";
import type { ProcessGraph, Variant } from "@elabs-ai/components-process/core";

/**
 * The generic shape this example assumes a host platform's own associative-selection
 * engine exposes. `state` reads the engine's current per-value verdict for a field
 * ("activity", "transition", "variant" below — field names this example invented; a real
 * engine names its own dimensions); `select` re-selects a field's chosen values on it.
 *
 * `"S"` / `"O"` / `"X"` are the engine's own three states — Selected, Optional-associated,
 * eXcluded — the same tri-state `ProcessSelectionState` expresses as `"selected"` /
 * `"associated"` / `"excluded"`. See `./README.md` for the mapping in both directions.
 */
interface SelectionEngine {
  state(field: string): Record<string, "S" | "O" | "X">;
  select(field: string, values: string[]): void;
}

/** Stands in for the host platform's own hook into its selection engine. */
declare function useHostSelectionEngine(): SelectionEngine;

/**
 * One engine field's states, narrowed to the ids the CURRENT graph/variant list actually
 * draws. The engine may still remember a verdict for an id abstraction or a filter has
 * since dropped from the render — forwarding it as a `ProcessMap` selection state would be
 * pointless (nothing on the canvas would carry it) and keeps the sparse record from
 * growing without bound across a long session.
 *
 * `"O"` (associated) is dropped rather than mapped: an id absent from a
 * `ProcessSelectionStates` field already defaults to `"associated"` through `ProcessMap`'s
 * own `resolveSelectionState`, so writing it out changes nothing and only bloats the object.
 */
function toSelectionStateMap(
  engineState: Record<string, "S" | "O" | "X">,
  knownIds: ReadonlySet<string>,
): Record<string, ProcessSelectionState> {
  const mapped: Record<string, ProcessSelectionState> = {};
  for (const [id, state] of Object.entries(engineState)) {
    if (!knownIds.has(id)) continue;
    if (state === "S") mapped[id] = "selected";
    else if (state === "X") mapped[id] = "excluded";
  }
  return mapped;
}

/**
 * `SelectionEngine.state(field)` → `ProcessSelectionStates`, one field per namespace.
 * Pure and engine-agnostic: everything it needs is the three states above plus the ids the
 * current (possibly pre-aggregated, possibly abstracted) graph and variant list carry.
 */
function mapEngineStateToSelectionStates(
  engine: SelectionEngine,
  graph: ProcessGraph,
  variants: Variant[],
): ProcessSelectionStates {
  const activityIds = new Set(graph.activities.map((activity) => activity.id));
  const transitionIds = new Set(
    graph.transitions.map((transition) => processEdgeId(transition.source, transition.target)),
  );
  const variantIds = new Set(variants.map((variant) => variant.id));

  return {
    activities: toSelectionStateMap(engine.state("activity"), activityIds),
    transitions: toSelectionStateMap(engine.state("transition"), transitionIds),
    // `ProcessMap` never reads this namespace — it has no variant nodes — but a
    // `VariantExplorer` view fed the SAME `selectionStates` object would.
    variants: toSelectionStateMap(engine.state("variant"), variantIds),
  };
}

/**
 * `onFilterIntent` → `SelectionEngine.select(field, values)`.
 *
 * Every kind `ProcessMap`'s own filter menu emits (`with`/`without`/`startsWith`/
 * `endsWith`) narrows to one field ("activity") and one activity name; packing it into a
 * one-element array is what matches `select`'s `values: string[]` shape.
 *
 * This is deliberately the SIMPLEST possible translation, not an exhaustive one: a real
 * associative engine usually offers separate include/exclude primitives, and a fuller
 * adapter would branch on `intent.kind` and call the engine's own equivalent of
 * `without`/`startsWith`/`endsWith` instead of a bare re-select. This generic
 * `SelectionEngine` defines only one primitive, so what this function demonstrates is the
 * SHAPE of the translation (`{ field, values }`), which is what carries over regardless of
 * how many primitives your own engine actually exposes.
 */
function intentToEngineSelect(intent: ProcessFilterIntent): { field: string; values: string[] } {
  return { field: "activity", values: [intent.activity] };
}

/**
 * The click TARGET is a separate, orthogonal channel from the tri-state selection above —
 * this example leaves it unset because driving it into the SAME engine is a further,
 * app-specific decision (does a click select, or only preview?) outside this file's scope.
 */
const NO_LOCAL_SELECTION: ProcessSelection | null = null;

/**
 * `graph`/`variants` are the pre-aggregated input (§1.5): computed by the host platform's
 * own aggregation engine (activity, next activity, count, median duration) and handed to
 * this component directly — no `discoverGraph` call anywhere in this file, and no
 * `useProcessExplorer` either, because that hook is the LOCAL computation path (a raw
 * `EventLog` this package discovers itself) and this is deliberately the other one.
 */
export function ExternalSelectionProcessMap({
  graph,
  variants,
}: {
  graph: ProcessGraph;
  variants: Variant[];
}) {
  const engine = useHostSelectionEngine();
  const selectionStates = mapEngineStateToSelectionStates(engine, graph, variants);

  const handleFilterIntent = (intent: ProcessFilterIntent) => {
    const { field, values } = intentToEngineSelect(intent);
    engine.select(field, values);
  };

  return (
    <ProcessMap
      graph={graph}
      metric={{ node: "absolute_case", edge: "absolute" }}
      selectionStates={selectionStates}
      selection={NO_LOCAL_SELECTION}
      onSelect={() => {
        // Nothing to toggle locally — see `NO_LOCAL_SELECTION` above.
      }}
      onFilterIntent={handleFilterIntent}
    />
  );
}
