/**
 * DG-26 — catalog references (CURRENT.md:37): `ref: catalog/<pack>/<entry>` supplies what the
 * node does not write. Pure and React-free: the browser passes the bundled or live catalog
 * (src/catalog/catalog-bundle.ts), the MCP passes readAll's entries (server/catalog-fs.mjs).
 */
import { catalogNameOf } from "./ids";
import { issue, type ArchIssue } from "./issues";
import { nearestName } from "./nearest-name";
import { joinPath } from "./source-map";
import type { ArchDiagram, ArchNodeSpec, ArchNodeType } from "./types";

/** The fields of a CatalogEntry this reads; readAll's entries and src/catalog's CatalogEntry both fit. */
export interface CatalogRefEntry {
  name: string;
  vendor: string;
  label: string;
  icon: string;
  kind?: ArchNodeType;
  description?: string;
  docs?: string;
  docsUnverified?: boolean;
  part?: { subtitle?: string; badges?: readonly string[] };
}
export type CatalogLookup = ReadonlyMap<string, CatalogRefEntry>;
/** Generic glyphs: icons, never catalog items (catalog-service.ts LUCIDE_VENDOR; Ruling 7). */
export const GLYPH_VENDOR = "lucide";

/** name → entry, without the glyphs (a `ref:` never names one, Ruling 7). */
export function catalogLookupOf(entries: Iterable<CatalogRefEntry>): CatalogLookup {
  const map = new Map<string, CatalogRefEntry>();
  for (const entry of entries) {
    if (entry.vendor === GLYPH_VENDOR) continue;
    map.set(entry.name, entry);
  }
  return map;
}

export interface Supplied {
  title: string;
  subtitle?: string;
  icon: string;
  type?: ArchNodeType;
  badges?: readonly string[];
  description?: string;
  docs?: string;
  docsUnverified?: boolean;
}
/**
 * What an entry supplies (the precedence table in "Design"): title = the entry's `label`
 * (already the part's name-or-slug, or the vendor name-or-index-label, from the merge);
 * subtitle and badges = the part's own; icon = the entry's own; type, description and docs =
 * the entry's, else, for a part with none of its own, its icon entry's. DG-25 calls this for
 * description and docs.
 */
export function suppliedBy(entry: CatalogRefEntry, catalog: CatalogLookup): Supplied {
  const iconEntry = entry.part ? catalog.get(entry.icon) : undefined;
  return {
    title: entry.label,
    subtitle: entry.part?.subtitle,
    icon: entry.icon,
    type: entry.kind ?? iconEntry?.kind,
    badges: entry.part?.badges,
    description: entry.description ?? iconEntry?.description,
    docs: entry.docs ?? iconEntry?.docs,
    docsUnverified: entry.docsUnverified ?? iconEntry?.docsUnverified,
  };
}

export interface ResolvedCatalogRefs {
  ast: ArchDiagram;
  issues: ArchIssue[];
}

/** `ref-missing`'s message (and `suggestion`, when one applies) for a name the catalog lacks. */
function refMissing(name: string, catalog: CatalogLookup, iconNames: ReadonlySet<string>) {
  if (iconNames.has(name)) {
    return {
      message: `"${name}" is an icon with no catalog item; write "icon: ${name}" instead of the ref.`,
    };
  }
  const near = nearestName(name, catalog.keys());
  return {
    message: `No catalog item "${name}".${near ? ` Did you mean "catalog/${near}"?` : ""}`,
    suggestion: near ? `catalog/${near}` : undefined,
  };
}

/**
 * For each node with a valid catalog ref: when the catalog has the name, a new node object with
 * `catalogEntry` and each key in `unwritten` that the entry supplies (title, subtitle, icon,
 * type, badges); otherwise `ref-missing` at `<path>.ref` and the node unchanged. An invalid ref
 * was reported as bad-ref (normalize) and is skipped. Never mutates `ast`.
 */
export function resolveCatalogRefs(
  ast: ArchDiagram,
  catalog: CatalogLookup,
  iconNames: ReadonlySet<string>,
): ResolvedCatalogRefs {
  const issues: ArchIssue[] = [];
  const nodes = ast.nodes.map((node) => {
    if (node.ref === undefined) return node;
    const name = catalogNameOf(node.ref);
    if (name === undefined) return node; // a diagram ref, or invalid (already bad-ref)
    const entry = catalog.get(name);
    if (!entry) {
      const problem = refMissing(name, catalog, iconNames);
      issues.push({
        ...issue("ref-missing", joinPath(node.path, "ref"), problem.message),
        ...(problem.suggestion ? { suggestion: problem.suggestion } : {}),
      });
      return node;
    }
    const supplied = suppliedBy(entry, catalog);
    // `key` ranges over SuppliedKey, so `supplied[key]` is always the field ArchNodeSpec
    // expects at that same key; the cast below only tells TS what the loop already ensures.
    const fill: Record<string, unknown> = {};
    for (const key of node.unwritten ?? []) {
      const value = supplied[key];
      if (value !== undefined) fill[key] = value;
    }
    return { ...node, ...(fill as Partial<ArchNodeSpec>), catalogEntry: entry.name };
  });
  return { ast: { ...ast, nodes }, issues };
}

/**
 * Custom nodes (no `ref:`) whose `icon:` names a catalog item: the MCP tools hint at the
 * reference (CURRENT.md:38, "the MCP tools must write reference-first nodes"). A glyph is not
 * a catalog item (Ruling 7; `catalog` already excludes them), so a glyph node gets no hint.
 * `ids`, when given, limits the hints to the nodes a call wrote. Never an issue: a custom node
 * stays valid, and a human author sees nothing.
 */
export function refHints(
  ast: ArchDiagram,
  catalog: CatalogLookup,
  ids?: ReadonlySet<string>,
): string[] {
  const hints: string[] = [];
  for (const node of ast.nodes) {
    if (node.ref !== undefined) continue;
    if (ids && !ids.has(node.id)) continue;
    if (typeof node.icon !== "string") continue;
    const entry = catalog.get(node.icon);
    if (!entry) continue;
    hints.push(
      `Node "${node.id}" uses the icon of the catalog item ${entry.name}. If the node is ` +
        `that item, write "ref: catalog/${entry.name}" instead of "icon: ${entry.name}" ` +
        `(title, type, subtitle and badges then come from the catalog). Keep "icon:" when ` +
        `the node only borrows the picture.`,
    );
  }
  return hints;
}
