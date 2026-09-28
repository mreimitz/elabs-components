/**
 * DG-35 — text → dialect check (DG-09) → `compileArch` → `validateFlowSpec`, without the React
 * Flow projection. React-free: the arch definitions come from `compile/arch-definitions.ts`
 * (the same object `createArchRegistry().definitions` returns), and the icon names are a
 * parameter. `state/compile-text.ts` calls it and adds the decorated graph; the dev server's
 * MCP tools call it through `server/spec-bridge.mjs`.
 */
import {
  checkArchYaml,
  parseArchYaml,
  type ArchDiagram,
  type ArchIssueSeverity,
  type ReferenceSources,
  type SourceRange,
} from "./dialect";
import { locate } from "./dialect/source-map";
import { compileArch, type ArchCompileView } from "./compile/compile-arch";
import { ARCH_DEFINITIONS } from "./compile/arch-definitions";
import { validateFlowSpec, type FlowSpec } from "./flow-spec";

export type IssueStage = "dialect" | "flow-spec";

/** One issue list for every stage (DG-09's `ArchIssue` shape + `stage`). */
export interface DiagramIssue {
  stage: IssueStage;
  path: string;
  code: string;
  message: string;
  severity: ArchIssueSeverity;
  range?: SourceRange;
  /** DG-24: a replacement value for the key at `path` (the nearest icon name). */
  suggestion?: string;
}

export interface CheckedText {
  /** null when the text is not a diagram at all (YAML error, wrong root, wrong version). */
  ast: ArchDiagram | null;
  spec: FlowSpec | null;
  view: ArchCompileView | null;
  /** FlowSpec path (`nodes[3]`) → dialect path (`zones[0].children[1]`). */
  origin: Readonly<Record<string, string>>;
  issues: DiagramIssue[];
  /** No issue of severity "error" in any stage. */
  ok: boolean;
}

export function checkText(
  text: string,
  iconNames: ReadonlySet<string>,
  sources: ReferenceSources = {},
): CheckedText {
  const checked = checkArchYaml(text, iconNames, sources);
  const issues: DiagramIssue[] = checked.issues.map((i) => ({ ...i, stage: "dialect" }));
  if (!checked.ast) {
    return { ast: null, spec: null, view: null, origin: {}, issues, ok: false };
  }
  const { spec, view, origin } = compileArch(checked.ast, checked.components);
  const specIssues = validateFlowSpec(spec, ARCH_DEFINITIONS);
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
  return {
    ast: checked.ast,
    spec,
    view,
    origin,
    issues,
    ok: !issues.some((i) => i.severity === "error"),
  };
}
