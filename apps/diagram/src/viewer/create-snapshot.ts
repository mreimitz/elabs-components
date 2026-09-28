import { parseDocument, stringify } from "yaml";
import { parseArchYaml, normalizeArch, type ArchDiagram } from "../spec/dialect";
import { catalogNameOf, diagramRefsOf, refFileOf } from "../spec/dialect/ids";
import { catalogLookupOf } from "../spec/dialect/catalog-refs";
import { checkText } from "../spec/check-text";
import { buildComponentTable, type ComponentFiles } from "../spec/compose/resolver";
import type { CatalogEntry } from "../catalog/catalog-entry";
import {
  MAX_DOCUMENTS,
  MAX_SNAPSHOT_BYTES,
  publicCatalogEntry,
  sanitizePublishedText,
  validateSnapshot,
  validateSnapshotContent,
  type EmbeddedIcon,
  type ViewerSnapshot,
} from "./manifest";
import { publishedStyle } from "./published-style";
import type { WorkspaceStyleConfig } from "../style/types";
interface SnapshotInput {
  text: string;
  theme: string;
  workspaceStyles?: WorkspaceStyleConfig;
  catalog: readonly CatalogEntry[];
  iconNames: ReadonlySet<string>;
  loadDocument(path: string): Promise<string>;
  loadIcon(name: string): Promise<EmbeddedIcon>;
}
function read(text: string): ArchDiagram {
  const parsed = parseArchYaml(text);
  const result = normalizeArch(parsed.raw, parsed.sourceMap);
  const error = [...parsed.issues, ...result.issues].find((issue) => issue.severity === "error");
  if (error || !result.ast)
    throw new Error(`Cannot publish this diagram: ${error?.message ?? "Not a diagram."}`);
  return result.ast;
}
/** Resolve only reachable public content. No raw source/catalog is retained in the snapshot. */
export async function createViewerSnapshot(input: SnapshotInput): Promise<ViewerSnapshot> {
  const sourceLookup = catalogLookupOf(input.catalog);
  const root = sanitizePublishedText(input.text, sourceLookup);
  const rootAst = read(root);
  const texts = new Map<string, string>();
  const asts = new Map<string, ArchDiagram>();
  const pending = diagramRefsOf(rootAst);
  let sourceSize = root.length;
  while (pending.length) {
    const path = pending.shift()!;
    if (texts.has(path)) continue;
    if (texts.size >= MAX_DOCUMENTS - 1)
      throw new Error("The diagram exceeds the embedded reference limit.");
    let text: string;
    try {
      text = sanitizePublishedText(await input.loadDocument(path), sourceLookup);
    } catch (error) {
      throw new Error(
        `Cannot embed referenced diagram "${path}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    sourceSize += text.length;
    if (sourceSize > MAX_SNAPSHOT_BYTES)
      throw new Error("The referenced diagrams exceed the publish size limit.");
    const ast = read(text);
    texts.set(path, text);
    asts.set(path, ast);
    pending.push(...diagramRefsOf(ast).filter((next) => !texts.has(next)));
  }
  const allAsts = [rootAst, ...asts.values()];
  const sourceCatalog = new Map(input.catalog.map((entry) => [entry.name, entry]));
  const included = new Map<string, CatalogEntry>();
  const include = (name: string) => {
    if (included.has(name)) return;
    const entry = sourceCatalog.get(name);
    if (!entry) return;
    included.set(name, publicCatalogEntry(entry));
    if (entry.part) include(entry.icon);
  };
  for (const ast of allAsts)
    for (const node of ast.nodes) {
      const name = node.ref ? catalogNameOf(node.ref) : undefined;
      if (name) include(name);
      if (node.icon) include(node.icon);
    }
  const catalog = [...included.values()];
  const lookup = catalogLookupOf(catalog);
  const files: ComponentFiles = new Map(
    [...texts].map(([path, text]) => [path, { text, mtime: 1 }]),
  );
  const table = buildComponentTable(rootAst, files, {
    catalog: lookup,
    iconNames: input.iconNames,
  });
  for (const entry of table.values())
    if (entry.status !== "ok")
      throw new Error(`Cannot publish reference "${entry.path}": ${entry.status}.`);
  const icons = new Set<string>();
  for (const text of [root, ...texts.values()]) {
    const checked = checkText(text, input.iconNames, { catalog: lookup, files });
    if (!checked.ok || !checked.spec)
      throw new Error(
        `Cannot publish: ${checked.issues.find((issue) => issue.severity === "error")?.message ?? "Missing diagram."}`,
      );
    if (text === root && checked.spec.nodes.length === 0)
      throw new Error("No public diagram content remains after excluding notes and metrics.");
    for (const node of checked.spec.nodes) {
      const icon = node.data?.icon;
      if (typeof icon === "string" && !icon.startsWith("lucide/")) icons.add(icon);
      const provider = node.data?.provider;
      if (typeof provider === "string" && input.iconNames.has(`${provider}/${provider}`))
        icons.add(`${provider}/${provider}`);
    }
    if (checked.ast?.component?.icon && !checked.ast.component.icon.startsWith("lucide/"))
      icons.add(checked.ast.component.icon);
  }
  const names = new Map(
    [...texts.keys()].map((path, index) => [path, `embedded/component-${index + 1}.yaml`]),
  );
  const rewrite = (text: string) => {
    const raw: unknown = parseDocument(text).toJS({ maxAliasCount: 100 });
    const walk = (value: unknown) => {
      if (!value || typeof value !== "object") return;
      const rec = value as Record<string, unknown>;
      if (typeof rec.ref === "string") {
        const path = refFileOf(rec.ref);
        if (path) {
          const embedded = names.get(path);
          if (!embedded) throw new Error("A required reference was not embedded.");
          rec.ref = `ws/${embedded}`;
        }
      }
      Object.values(value).forEach(walk);
    };
    walk(raw);
    return stringify(raw, { lineWidth: 0 });
  };
  const documents = Object.fromEntries([
    ["published.yaml", rewrite(root)],
    ...[...texts].map(([path, text]) => [names.get(path)!, rewrite(text)]),
  ]);
  const embedded: Record<string, EmbeddedIcon> = {};
  for (const name of icons) {
    embedded[name] = await input.loadIcon(name);
    sourceSize += JSON.stringify(embedded[name]).length;
    if (sourceSize > MAX_SNAPSHOT_BYTES)
      throw new Error("The embedded icons exceed the publish size limit.");
  }
  const result: ViewerSnapshot = {
    version: 1,
    root: "published.yaml",
    theme: input.theme,
    style: publishedStyle(input.theme, input.workspaceStyles, rootAst.style),
    documents,
    catalog,
    icons: embedded,
  };
  validateSnapshot(result);
  validateSnapshotContent(result);
  return result;
}
