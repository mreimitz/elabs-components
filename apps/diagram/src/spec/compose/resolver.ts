/** Workspace references resolve against explicit snapshots; no I/O or global cache. */
import { parseArchYaml } from "../dialect/parse";
import { normalizeArch } from "../dialect/normalize";
import { resolveCatalogRefs, type CatalogLookup } from "../dialect/catalog-refs";
import { diagramRefsOf } from "../dialect/ids";
import { validateArch } from "../dialect/validate";
import type { ArchDiagram } from "../dialect/types";

export const MAX_COMPONENT_DEPTH = 8;
export type ComponentFile = { text: string; mtime: number } | null | { error: string };
export type ComponentFiles = ReadonlyMap<string, ComponentFile>;
export type LoadFile = (path: string) => Promise<ComponentFile>;
export type ComponentEntry =
  | {
      status: "ok";
      path: string;
      mtime: number;
      ast: ArchDiagram;
      title: string;
      icon?: string;
      description?: string;
      count: number;
    }
  | { status: "missing"; path: string }
  | { status: "invalid"; path: string; reason: string }
  | { status: "cycle" | "too-deep"; path: string; chain: readonly string[] };
export type ComponentTable = ReadonlyMap<string, ComponentEntry>;
export interface ResolverSources {
  catalog?: CatalogLookup;
  iconNames?: ReadonlySet<string>;
}

/** Errors in a child remain local, including malformed or recursive YAML aliases. */
function readAst(
  text: string,
  sources: ResolverSources = {},
): { ast: ArchDiagram } | { error: string } {
  try {
    const parsed = parseArchYaml(text);
    const normalized = normalizeArch(parsed.raw, parsed.sourceMap);
    let ast = normalized.ast;
    const issues = [...parsed.issues, ...normalized.issues];
    if (ast && sources.catalog) {
      const resolved = resolveCatalogRefs(ast, sources.catalog, sources.iconNames ?? new Set());
      ast = resolved.ast;
      issues.push(...resolved.issues);
    }
    if (ast) issues.push(...validateArch(ast, sources.iconNames ?? new Set()));
    const error = issues.find((i) => i.severity === "error");
    return !ast || error ? { error: error?.message ?? "Not a diagram." } : { ast };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** Every unseen dependency, bounded even for cyclic or over-depth graphs. */
export function neededFiles(ast: ArchDiagram, files: ComponentFiles): string[] {
  const needed = new Set<string>();
  const shallowest = new Map<string, number>();
  const parsed = new Map<string, ReturnType<typeof readAst>>();
  const visit = (current: ArchDiagram, depth: number) => {
    for (const path of diagramRefsOf(current)) {
      if (depth >= MAX_COMPONENT_DEPTH || (shallowest.get(path) ?? Infinity) <= depth) continue;
      // A shared dependency only needs another visit when a shorter route reveals more levels.
      // This also terminates cycles without enumerating every route through a shared graph.
      shallowest.set(path, depth);
      if (!files.has(path)) {
        needed.add(path);
        continue;
      }
      const file = files.get(path);
      if (!file || "error" in file) continue;
      let child = parsed.get(path);
      if (!child) {
        child = readAst(file.text);
        parsed.set(path, child);
      }
      if ("ast" in child) visit(child.ast, depth + 1);
    }
  };
  visit(ast, 0);
  return [...needed];
}

export async function loadComponentFiles(
  ast: ArchDiagram,
  loadFile: LoadFile,
  initial: ComponentFiles = new Map(),
): Promise<Map<string, ComponentFile>> {
  const files = new Map(initial);
  for (;;) {
    const paths = neededFiles(ast, files);
    if (!paths.length) return files;
    await Promise.all(
      paths.map(async (path) => {
        try {
          files.set(path, await loadFile(path));
        } catch (error) {
          files.set(path, { error: error instanceof Error ? error.message : String(error) });
        }
      }),
    );
  }
}

export function buildComponentTable(
  ast: ArchDiagram,
  files: ComponentFiles,
  sources: ResolverSources = {},
): ComponentTable {
  const table = new Map<string, ComponentEntry>();
  const parsed = new Map<string, ReturnType<typeof readAst>>();
  const visit = (path: string, stack: readonly string[]): ComponentEntry | undefined => {
    if (stack.includes(path)) return { status: "cycle", path, chain: [...stack, path] };
    if (stack.length >= MAX_COMPONENT_DEPTH)
      return { status: "too-deep", path, chain: [...stack, path] };
    if (!files.has(path)) return undefined;
    const file = files.get(path);
    let result: ComponentEntry;
    if (!file) result = { status: "missing", path };
    else if ("error" in file) result = { status: "invalid", path, reason: file.error };
    else {
      let checked = parsed.get(path);
      if (!checked) {
        checked = readAst(file.text, sources);
        parsed.set(path, checked);
      }
      if ("error" in checked) result = { status: "invalid", path, reason: checked.error };
      else {
        const child = checked.ast;
        result = {
          status: "ok",
          path,
          mtime: file.mtime,
          ast: child,
          title:
            child.title ??
            path
              .split("/")
              .at(-1)!
              .replace(/\.yaml$/, ""),
          icon: child.component?.icon,
          description: child.component?.description ?? child.description,
          count: child.nodes.length,
        };
        for (const dependency of diagramRefsOf(child)) {
          const nested = visit(dependency, [...stack, path]);
          if (nested?.status === "cycle" || nested?.status === "too-deep") {
            if (result.status === "ok") result = { ...nested, path };
          }
        }
      }
    }
    // Depth is contextual: a shallow valid visit must not inherit a deeper route's failure.
    if (result.status !== "too-deep" || !table.has(path)) table.set(path, result);
    return result;
  };
  for (const path of diagramRefsOf(ast)) visit(path, []);
  // Dotted endpoints can only be checked once every reachable child has a table entry.
  // Broken descendants stay local; malformed endpoints in this file make this file invalid.
  for (const [path, entry] of table) {
    if (entry.status !== "ok") continue;
    const error = validateArch(entry.ast, sources.iconNames ?? new Set(), table).find(
      (i) => i.severity === "error" && !i.code.startsWith("ref-"),
    );
    if (error) table.set(path, { status: "invalid", path, reason: error.message });
  }
  return table;
}
