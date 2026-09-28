/** Id grammar and the flow arrow. React-free. */
import type { ArchDiagram } from "./types";

/** An id: letter or _, then letters, digits, _ or -; never ends in -. */
export const ID_SOURCE = "[A-Za-z_](?:[A-Za-z0-9_-]*[A-Za-z0-9_])?";
export const ID_RE = new RegExp(`^${ID_SOURCE}$`);

/** A flow end: an id, or `<node>.<inner id>` through a node whose ref is a diagram (V4). No capture groups inside. */
export const END_SOURCE = `${ID_SOURCE}(?:\\.${ID_SOURCE})*`;
/** `a -> b`, `a <- b`, `a <-> b`; each end an id or a dotted end. Groups: 1 from, 2 arrow, 3 to. */
export const ARROW_PATTERN = `^\\s*(${END_SOURCE})\\s*(<->|->|<-)\\s*(${END_SOURCE})\\s*$`;
/** With the `d` flag, so match.indices gives each id's offset inside the text (for line/col). */
export const ARROW_RE = new RegExp(ARROW_PATTERN, "d");

export const ARROW_DIRECTION = {
  "->": "forward",
  "<-": "back",
  "<->": "both",
} as const;

// DG-26 — `ref:` paths (maintainer ruling 2026-09-27: nodes are reference-first). The first
// segment names the form.
export const CATALOG_REF_ROOT = "catalog";
/** The literal root word for a diagram reference (maintainer decision: "ws", not "workspace"). */
export const WORKSPACE_REF_ROOT = "ws";
const NAME_SOURCE = "[a-z0-9][a-z0-9-]*"; // the catalog's own names (server/catalog-fs.mjs:40, the icon index)
/** `catalog/<pack>/<entry>`. */
export const CATALOG_REF_SOURCE = `${CATALOG_REF_ROOT}/${NAME_SOURCE}/${NAME_SOURCE}`;
/**
 * A workspace path segment: what the workspace tree itself accepts (maintainer ruling
 * 2026-09-27: any character except "/" — spaces, capitals, dots and unicode are fine — except
 * no leading "_" (keeps `_trash` out), no leading "." (also excludes "." and ".." on their
 * own, which are never a segment), and no empty or whitespace-only segment. No length bound: a
 * real file or folder name may hold spaces, punctuation or unicode.
 */
const SEGMENT_SOURCE = "(?!_)(?!\\.)(?=[^/]*[^/\\s])[^/]+";
/**
 * `ws/<folder>/…/<file name>`: the last segment is the file name. A trailing ".yaml"/".yml"
 * (any case) is legal there — the natural way to copy a real file name — and is stripped in
 * `refFileOf` before ".yaml" is appended back, so it never doubles up.
 */
export const DIAGRAM_REF_SOURCE = `${WORKSPACE_REF_ROOT}(?:/${SEGMENT_SOURCE})+`;
export const REF_RE = new RegExp(`^(?:${CATALOG_REF_SOURCE}|${DIAGRAM_REF_SOURCE})$`);
const CATALOG_REF_RE = new RegExp(`^${CATALOG_REF_SOURCE}$`);
const DIAGRAM_REF_RE = new RegExp(`^${DIAGRAM_REF_SOURCE}$`);
/** A trailing ".yaml"/".yml" (any case) on the last segment. */
const TRAILING_YAML_RE = /\.ya?ml$/i;
export type RefForm = "catalog" | "diagram";
/** The form a ref claims by its first segment, valid or not; undefined without a known root. */
export function refForm(ref: string): RefForm | undefined {
  if (ref.startsWith(`${CATALOG_REF_ROOT}/`)) return "catalog";
  if (ref === WORKSPACE_REF_ROOT || ref.startsWith(`${WORKSPACE_REF_ROOT}/`)) return "diagram";
  return undefined;
}
/** `catalog/aws/glue` → `aws/glue` (the CatalogEntry name); undefined unless a valid catalog ref. */
export const catalogNameOf = (ref: string): string | undefined =>
  CATALOG_REF_RE.test(ref) ? ref.slice(CATALOG_REF_ROOT.length + 1) : undefined;
/**
 * `ws/components/x` → `components/x.yaml`, the workspace file; `ws/components/x.yaml` (or
 * `.yml`, any case) resolves the same way — the trailing extension is stripped, not doubled.
 * Undefined unless a valid diagram ref.
 */
export const refFileOf = (ref: string): string | undefined =>
  DIAGRAM_REF_RE.test(ref)
    ? `${ref.slice(WORKSPACE_REF_ROOT.length + 1).replace(TRAILING_YAML_RE, "")}.yaml`
    : undefined;
/** The id before the first dot: `tenant.qca` → `tenant`. */
export const endHead = (end: string): string => end.split(".", 1)[0] ?? end;
/** The part after the first dot, or undefined. */
export const endInner = (end: string): string | undefined => {
  const dot = end.indexOf(".");
  return dot === -1 ? undefined : end.slice(dot + 1);
};
/** The workspace files an AST references, first use, no duplicates (DG-23's tree check, the resolver). */
export function diagramRefsOf(ast: Pick<ArchDiagram, "nodes">): string[] {
  const files = ast.nodes.flatMap((n) => {
    const file = n.ref !== undefined ? refFileOf(n.ref) : undefined;
    return file !== undefined ? [file] : [];
  });
  return [...new Set(files)];
}
/** The catalog names an AST references, first use, no duplicates. */
export function catalogRefsOf(ast: Pick<ArchDiagram, "nodes">): string[] {
  const names = ast.nodes.flatMap((n) => {
    const name = n.ref !== undefined ? catalogNameOf(n.ref) : undefined;
    return name !== undefined ? [name] : [];
  });
  return [...new Set(names)];
}
// end DG-26
