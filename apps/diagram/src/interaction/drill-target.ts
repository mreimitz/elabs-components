import {
  buildComponentTable,
  MAX_COMPONENT_DEPTH,
  type ComponentFiles,
} from "../spec/compose/resolver";
import type { ArchDiagram } from "../spec/dialect";
import type { CatalogLookup } from "../spec/dialect/catalog-refs";
import { refFileOf } from "../spec/dialect/ids";

export interface DrillCrumb {
  id: string;
  title: string;
  path: string;
}
export type DrillTarget =
  | { crumbs: DrillCrumb[]; path: string; text: string }
  | { crumbs: DrillCrumb[]; error: string };
/** Resolve ids against actual reference instances, never concatenate untrusted paths. */
export function resolveDrillTarget(
  ast: ArchDiagram,
  files: ComponentFiles,
  catalog: CatalogLookup,
  iconNames: ReadonlySet<string>,
  chain: readonly string[],
): DrillTarget {
  const crumbs: DrillCrumb[] = [];
  if (!chain.length || chain.length > MAX_COMPONENT_DEPTH)
    return { crumbs, error: "This inspection path is not valid." };
  const table = buildComponentTable(ast, files, { catalog, iconNames });
  let scope = ast;
  const seen = new Set<string>();
  for (const id of chain) {
    const node = scope.nodes.find((node) => node.id === id);
    const path = node?.ref ? refFileOf(node.ref) : undefined;
    if (!node || !path)
      return { crumbs, error: `The diagram reference “${id}” is no longer here.` };
    const entry = table.get(path);
    if (!entry || entry.status !== "ok" || seen.has(path))
      return {
        crumbs,
        error: `The referenced diagram “${path}” is unavailable${entry && entry.status !== "ok" ? ` (${entry.status})` : ""}.`,
      };
    seen.add(path);
    crumbs.push({ id, title: node.unwritten?.includes("title") ? entry.title : node.title, path });
    scope = entry.ast;
  }
  const path = crumbs.at(-1)!.path;
  const file = files.get(path);
  return file && "text" in file
    ? { crumbs, path, text: file.text }
    : { crumbs, error: `The referenced diagram “${path}” is unavailable.` };
}
