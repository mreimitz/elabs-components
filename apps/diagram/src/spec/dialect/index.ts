/** Public surface of the dialect: text in, AST + positioned issues out. React-free. */
import { buildComponentTable, type ComponentFiles, type ComponentTable } from "../compose/resolver";
import { resolveCatalogRefs, type CatalogLookup } from "./catalog-refs";
import { KEY_ANCHORED, type ArchIssue } from "./issues";
import { normalizeArch } from "./normalize";
import { parseArchYaml } from "./parse";
import { locate } from "./source-map";
import type { ArchDiagram } from "./types";
import { validateArch } from "./validate";

/** Explicit reference sources keep parsing deterministic in browser and server callers. */
export interface ReferenceSources {
  /** Catalog values fill unwritten node fields. */
  catalog?: CatalogLookup;
  files?: ComponentFiles;
}

export interface ArchCheckResult {
  components?: ComponentTable;
  /** null when the text is not a diagram at all (YAML error, wrong root, wrong version). */
  ast: ArchDiagram | null;
  /** Every issue, with a 1-based range, sorted by position. */
  issues: ArchIssue[];
  /** true when no issue has severity "error". */
  ok: boolean;
}

export function checkArchYaml(
  text: string,
  iconNames: ReadonlySet<string>,
  sources: ReferenceSources = {},
): ArchCheckResult {
  const parsed = parseArchYaml(text);
  const found: ArchIssue[] = [...parsed.issues];
  let ast: ArchDiagram | null = null;
  let components: ComponentTable | undefined;
  if (parsed.raw !== undefined) {
    const normalized = normalizeArch(parsed.raw, parsed.sourceMap);
    ast = normalized.ast;
    found.push(...normalized.issues);
    if (ast && sources.catalog) {
      const filled = resolveCatalogRefs(ast, sources.catalog, iconNames);
      ast = filled.ast;
      found.push(...filled.issues);
    }
    if (ast) {
      if (sources.files)
        components = buildComponentTable(ast, sources.files, {
          catalog: sources.catalog,
          iconNames,
        });
      found.push(...validateArch(ast, iconNames, components));
    }
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
  return { ast, components, issues, ok: !issues.some((i) => i.severity === "error") };
}

export { parseArchYaml, type ParsedArchYaml } from "./parse";
export { normalizeArch } from "./normalize";
export { validateArch } from "./validate";
export {
  catalogLookupOf,
  resolveCatalogRefs,
  refHints, // DG-26 (1b.1)
  suppliedBy,
  GLYPH_VENDOR,
  type CatalogLookup,
  type CatalogRefEntry,
  type ResolvedCatalogRefs,
  type Supplied,
} from "./catalog-refs";
export {
  ISSUE_SEVERITY,
  type ArchIssue,
  type ArchIssueCode,
  type ArchIssueSeverity,
} from "./issues";
export type { SourcePos, SourceRange } from "./source-map";
export * from "./types";
