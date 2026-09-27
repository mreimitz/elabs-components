/**
 * text → `checkText` (dialect check, compile, flow-spec check; `spec/check-text.ts`) →
 * `toReactFlow` → registry `decorate`. Synchronous and side-effect free; layout is DG-11,
 * debounce and patching are DG-12. Not under `src/spec/`: it binds the registry (components)
 * and the icon index (JSON). DG-35 moved the React-free half to `spec/check-text.ts` so the
 * dev server runs the same checks.
 */
import type { ArchDiagram, ReferenceSources } from "../spec/dialect";
import type { ArchCompileView } from "../spec/compile/compile-arch";
import { checkText, type DiagramIssue } from "../spec/check-text";
import { createArchRegistry } from "../spec/compile/registry";
import { toReactFlow, type FlowSpec, type ReactFlowGraph } from "../spec/flow-spec";
import { ICON_NAMES } from "../icons/icon-names";
import { currentCatalog } from "../catalog/catalog-bundle"; // DG-26

export type { DiagramIssue, IssueStage } from "../spec/check-text";

/** Module level: `nodeTypes`/`edgeTypes` must keep one identity (React Flow warns otherwise). */
export const archRegistry = createArchRegistry();

export interface CompiledDiagram {
  /** null when the text is not a diagram at all (YAML error, wrong root, wrong version). */
  ast: ArchDiagram | null;
  spec: FlowSpec | null;
  /** Decorated React Flow graph, NOT laid out (every position `{0,0}` unless manual). */
  graph: ReactFlowGraph | null;
  view: ArchCompileView | null;
  /** FlowSpec path (`nodes[3]`) → dialect path (`zones[0].children[1]`); DG-12 maps selection with it. */
  origin: Readonly<Record<string, string>>;
  issues: DiagramIssue[];
  /** No issue of severity "error" in any stage. */
  ok: boolean;
}

export function compileText(
  text: string,
  sources: ReferenceSources = { catalog: currentCatalog() }, // DG-26
): CompiledDiagram {
  const checked = checkText(text, ICON_NAMES, sources);
  const graph = checked.spec
    ? archRegistry.decorate(toReactFlow(checked.spec, archRegistry.definitions))
    : null;
  return { ...checked, graph };
}
