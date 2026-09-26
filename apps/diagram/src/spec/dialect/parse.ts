/** YAML text → plain value + source map + YAML-level issues. Keeps the Document (DG-14). React-free. */
import { LineCounter, isAlias, isMap, isScalar, isSeq, parseDocument, type Document } from "yaml";
import { issue, type ArchIssue } from "./issues";
import { indexPath, joinPath, toSourceRange, type SourceMap } from "./source-map";
import { yamlIssueMessage } from "./yaml-messages";

export interface ParsedArchYaml {
  doc: Document.Parsed;
  /** Plain JS value of the document (like doc.toJS()), or undefined when YAML errors stop the walk. */
  raw: unknown;
  sourceMap: SourceMap;
  issues: ArchIssue[];
}

export function parseArchYaml(text: string): ParsedArchYaml {
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, {
    lineCounter,
    prettyErrors: true,
    uniqueKeys: true,
  });
  const sourceMap: SourceMap = {
    text,
    lineCounter,
    values: new Map(),
    keys: new Map(),
  };
  const issues: ArchIssue[] = [];

  // One parser issue per line, the first (errors before warnings): the parser often reports
  // one slip several times on a line ("a: b: c" → two BLOCK_AS_IMPLICIT_KEY), wave-2 m5.
  const reportedLines = new Set<number>();
  const found = [
    ...doc.errors.map((e) => ({ e, warning: false })),
    ...doc.warnings.map((e) => ({ e, warning: true })),
  ];
  for (const { e, warning } of found) {
    const range = toSourceRange(sourceMap, e.pos);
    if (reportedLines.has(range.start.line)) continue;
    reportedLines.add(range.start.line);
    const code = warning
      ? "yaml-warning"
      : e.code === "DUPLICATE_KEY"
        ? "yaml-duplicate-key"
        : "yaml-syntax";
    issues.push({ ...issue(code, "", yamlIssueMessage(e.code, e.message)), range });
  }
  if (doc.errors.length > 0) return { doc, raw: undefined, sourceMap, issues };

  const walk = (node: unknown, path: string): unknown => {
    const resolved = isAlias(node) ? node.resolve(doc) : node;
    if (isScalar(resolved)) {
      if (resolved.range) sourceMap.values.set(path, [resolved.range[0], resolved.range[1]]);
      return resolved.value;
    }
    if (isSeq(resolved)) {
      if (resolved.range) sourceMap.values.set(path, [resolved.range[0], resolved.range[1]]);
      return resolved.items.map((item, i) => walk(item, indexPath(path, i)));
    }
    if (isMap(resolved)) {
      if (resolved.range) sourceMap.values.set(path, [resolved.range[0], resolved.range[1]]);
      const out: Record<string, unknown> = {};
      for (const pair of resolved.items) {
        const key = isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
        const p = joinPath(path, key);
        if (isScalar(pair.key) && pair.key.range)
          sourceMap.keys.set(p, [pair.key.range[0], pair.key.range[1]]);
        out[key] = pair.value == null ? null : walk(pair.value, p);
      }
      return out;
    }
    return null;
  };

  return { doc, raw: walk(doc.contents, ""), sourceMap, issues };
}
