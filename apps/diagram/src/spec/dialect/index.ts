/** Public surface of the dialect: text in, AST + positioned issues out. React-free. */
import { KEY_ANCHORED, type ArchIssue } from "./issues";
import { normalizeArch } from "./normalize";
import { parseArchYaml } from "./parse";
import { locate } from "./source-map";
import type { ArchDiagram } from "./types";
import { validateArch } from "./validate";

export interface ArchCheckResult {
  /** null when the text is not a diagram at all (YAML error, wrong root, wrong version). */
  ast: ArchDiagram | null;
  /** Every issue, with a 1-based range, sorted by position. */
  issues: ArchIssue[];
  /** true when no issue has severity "error". */
  ok: boolean;
}

export function checkArchYaml(text: string, iconNames: ReadonlySet<string>): ArchCheckResult {
  const parsed = parseArchYaml(text);
  const found: ArchIssue[] = [...parsed.issues];
  let ast: ArchDiagram | null = null;
  if (parsed.raw !== undefined) {
    const normalized = normalizeArch(parsed.raw, parsed.sourceMap);
    ast = normalized.ast;
    found.push(...normalized.issues);
    if (ast) found.push(...validateArch(ast, iconNames));
  }
  const issues = found
    .map((i) =>
      i.range
        ? i
        : {
            ...i,
            range: locate(parsed.sourceMap, i.path, KEY_ANCHORED.has(i.code) ? "key" : "value"),
          },
    )
    .sort((a, b) => (a.range?.offset[0] ?? 0) - (b.range?.offset[0] ?? 0));
  return { ast, issues, ok: !issues.some((i) => i.severity === "error") };
}

export { parseArchYaml, type ParsedArchYaml } from "./parse";
export { normalizeArch } from "./normalize";
export { validateArch } from "./validate";
export {
  ISSUE_SEVERITY,
  type ArchIssue,
  type ArchIssueCode,
  type ArchIssueSeverity,
} from "./issues";
export type { SourcePos, SourceRange } from "./source-map";
export * from "./types";
