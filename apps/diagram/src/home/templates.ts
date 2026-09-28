/**
 * DG-23 — which files are templates, and their name/description. No React import — `start-from.tsx`
 * turns this into UI, `recents.ts` imports `TEMPLATES_FOLDER` so "a template is never a recent" has
 * one definition, not two literals.
 */
import { CST, Parser, isAlias, isScalar, parseDocument, visit } from "yaml";
import type { WorkspaceFile } from "../workspace/client";
import { topLevelDescription } from "./yaml-field";

/** Every template lives directly under this folder, a sibling of `examples/` and `customers/`. */
export const TEMPLATES_FOLDER = "templates";

/** A path's file name without its extension: `templates/foo.yaml` → `foo`. */
export function fileStem(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.ya?ml$/i, "");
}

/** Every diagram under `templates/`, including one nested in a subfolder, from the tree's files. */
export function templateFiles(files: readonly WorkspaceFile[] | undefined): WorkspaceFile[] {
  return (files ?? []).filter(
    (file) => file.kind === "diagram" && file.path.startsWith(`${TEMPLATES_FOLDER}/`),
  );
}

/** The top-level `description:`, read as plain YAML. */
export function templateDescription(text: string): string {
  return topLevelDescription(text, ["description"]);
}

/**
 * Append the file-name attempt's copy marker to a string title, including alias and flow-map
 * forms. Edit CST tokens so comments, quoting and unrelated bytes remain intact. If the title
 * defines an anchor, aliases of that exact scalar are replaced by its original quoted value
 * before changing the title; otherwise their non-title semantics would change as well.
 * An aliased title is replaced at its own token, leaving the original anchor untouched.
 * Invalid documents and non-string titles are returned unchanged.
 */
export function titleWithCopySuffix(text: string, n: number): string {
  const parsed = parseDocument(text);
  if (parsed.errors.length > 0) return text;
  const titleNode = parsed.get("title", true);
  // Resolve at most one scalar alias. No collection expansion or recursive toJS conversion.
  const scalar = isAlias(titleNode) ? titleNode.resolve(parsed) : titleNode;
  if (!isScalar(scalar) || typeof scalar.value !== "string") return text;
  const title = scalar.value;
  const suffix = n <= 1 ? " (copy)" : ` (copy ${n})`;
  const tokens = [...new Parser().parse(text)];
  const doc = tokens.find((token): token is CST.Document => token.type === "document");
  const map = doc?.value;
  if (!doc || !map || (map.type !== "block-map" && map.type !== "flow-collection")) return text;
  const item = map.items.find((entry) => CST.resolveAsScalar(entry.key)?.value === "title");
  const valueToken = item?.value;
  if (!valueToken) return text;

  const aliases = new Set<number>();
  if (isScalar(titleNode) && titleNode.anchor) {
    visit(parsed, {
      Alias(_key, node) {
        if (node.resolve(parsed) === titleNode && node.range) aliases.add(node.range[0]);
      },
    });
  }
  // Materializing a large scalar many times must not allocate an unbounded copy. The server
  // also enforces its one-megabyte write limit; fail before creating any file here.
  if (text.length + aliases.size * JSON.stringify(title).length > 1_000_000) {
    throw new Error("The title's aliases would make this copy too large. Use a shorter title.");
  }
  CST.visit(doc, (entry) => {
    for (const token of [entry.key, entry.value]) {
      if (token?.type === "alias" && aliases.has(token.offset)) {
        // Quoting preserves strings such as "null", "true" and numeric-looking titles,
        // including when the alias supplies a mapping key or a flow-collection value.
        CST.setScalarValue(token, title, { type: "QUOTE_DOUBLE", inFlow: true });
      }
    }
  });
  CST.setScalarValue(valueToken, title.replace(/\n+$/, "") + suffix, {
    afterKey: true,
    inFlow: map.type === "flow-collection",
    ...(isAlias(titleNode) && { type: "QUOTE_DOUBLE" as const }),
  });
  return tokens.map((token) => CST.stringify(token)).join("");
}

const COPY_SUFFIX_RE = / \(copy(?: \d+)?\)$/;

/**
 * Split a title (as read from a file, e.g. `WorkspaceFile.title`) into its base text and a
 * trailing `(copy)`/`(copy N)` marker written by `titleWithCopySuffix`, if any — so a view that
 * truncates or line-clamps the base can still render the marker as its own non-shrinking part
 * instead of cutting it off along with the rest of a long title. `marker` is `null` when `title`
 * carries no such suffix.
 */
export function splitCopySuffix(title: string): { base: string; marker: string | null } {
  const match = COPY_SUFFIX_RE.exec(title);
  if (!match) return { base: title, marker: null };
  return { base: title.slice(0, match.index), marker: match[0].trim() };
}
