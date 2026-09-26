/**
 * text → dialect check (DG-09) → `compileArch` → `validateFlowSpec` → `toReactFlow` →
 * registry `decorate`. Synchronous and side-effect free; layout is DG-11, debounce and
 * patching are DG-12. Not under `src/spec/`: it binds the registry (components) and the icon
 * index (JSON).
 */
import {
  checkArchYaml,
  parseArchYaml,
  type ArchDiagram,
  type ArchIssueSeverity,
  type SourceRange,
} from "../spec/dialect";
import { locate } from "../spec/dialect/source-map";
import { compileArch, type ArchCompileView } from "../spec/compile/compile-arch";
import { createArchRegistry } from "../spec/compile/registry";
import {
  toReactFlow,
  validateFlowSpec,
  type FlowSpec,
  type ReactFlowGraph,
} from "../spec/flow-spec";
import { ICON_NAMES } from "../icons/icon-names";

/** Module level: `nodeTypes`/`edgeTypes` must keep one identity (React Flow warns otherwise). */
export const archRegistry = createArchRegistry();

export type IssueStage = "dialect" | "flow-spec";

/** One issue list for every stage (DG-09's `ArchIssue` shape + `stage`). */
export interface DiagramIssue {
  stage: IssueStage;
  path: string;
  code: string;
  message: string;
  severity: ArchIssueSeverity;
  range?: SourceRange;
}

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

export function compileText(text: string): CompiledDiagram {
  const checked = checkArchYaml(text, ICON_NAMES);
  const issues: DiagramIssue[] = checked.issues.map((i) => ({ ...i, stage: "dialect" }));
  if (!checked.ast) {
    return { ast: null, spec: null, graph: null, view: null, origin: {}, issues, ok: false };
  }
  const { spec, view, origin } = compileArch(checked.ast);
  const specIssues = validateFlowSpec(spec, archRegistry.definitions);
  if (specIssues.length > 0) {
    // DG-09's `checkArchYaml` does not return its source map; parse once more to put a
    // flow-spec issue on the line of the dialect entry it came from.
    const { sourceMap } = parseArchYaml(text);
    for (const i of specIssues) {
      const prefix = /^(nodes|edges)\[\d+\]/.exec(i.path)?.[0];
      const from = prefix !== undefined ? origin[prefix] : undefined;
      issues.push({
        ...i,
        stage: "flow-spec",
        ...(from !== undefined ? { range: locate(sourceMap, from, "value") } : {}),
      });
    }
    issues.sort(
      (a, b) =>
        (a.range?.offset[0] ?? Number.MAX_SAFE_INTEGER) -
        (b.range?.offset[0] ?? Number.MAX_SAFE_INTEGER),
    );
  }
  const graph = archRegistry.decorate(toReactFlow(spec, archRegistry.definitions));
  return {
    ast: checked.ast,
    spec,
    graph,
    view,
    origin,
    issues,
    ok: !issues.some((i) => i.severity === "error"),
  };
}
