/**
 * DG-23 — which files are templates, and their name/description. No React import — `start-from.tsx`
 * turns this into UI, `recents.ts` imports `TEMPLATES_FOLDER` so "a template is never a recent" has
 * one definition, not two literals.
 */
import { CST, Parser, parseDocument } from "yaml";
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
 * `text` with `n`'s copy suffix appended to its top-level `title:` value — `" (copy)"` for the
 * first copy, `" (copy 2)"` for the second, matching the number `createUniqueFile` gives the
 * copy's own file name. Without it, two copies of the same template read identically in Recent,
 * Folders and a component's Used-in list.
 *
 * Edits only the title's own CST token (`yaml`'s `Parser` + `CST.resolveAsScalar`/
 * `CST.setScalarValue`), not the whole document: re-stringifying a parsed `Document` re-flows
 * long plain lines and re-spaces flow collections wherever they appear in the file, which would
 * touch bytes that have nothing to do with the title. Working at the CST level instead means
 * every other line, every comment, and any nested `title:` under `boxes`/`lanes`/`story.steps`
 * stays byte-for-byte the same (checked against both shipped templates: exactly one line
 * changes), and `yaml` re-escapes the new value for whichever quoting style the title already
 * used — plain, `'single'` (with `''` escapes), `"double"` (with `\"` escapes), or a `|`/`>-`
 * block scalar. A trailing `# comment` on the title's line is left as a comment; the suffix goes
 * into the value, never into the comment text.
 *
 * Falls back to returning `text` unchanged if the document has no top-level `title` (or it is not
 * a scalar) — the same as before, nothing to suffix.
 */
export function titleWithCopySuffix(text: string, n: number): string {
  const parsed = parseDocument(text);
  if (parsed.errors.length > 0 || typeof parsed.get("title") !== "string") return text;
  const suffix = n <= 1 ? " (copy)" : ` (copy ${n})`;
  const tokens = [...new Parser().parse(text)];
  const doc = tokens.find((token): token is CST.Document => token.type === "document");
  const map = doc?.value;
  if (!map || map.type !== "block-map") return text;
  const item = map.items.find((entry) => CST.resolveAsScalar(entry.key)?.value === "title");
  const valueToken = item?.value;
  const scalar = valueToken ? CST.resolveAsScalar(valueToken) : null;
  if (!valueToken || !scalar) return text;
  CST.setScalarValue(valueToken, scalar.value.replace(/\n+$/, "") + suffix, { afterKey: true });
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
