/**
 * DG-23 — which files are templates, and their name/description. No React import — `start-from.tsx`
 * turns this into UI, `recents.ts` imports `TEMPLATES_FOLDER` so "a template is never a recent" has
 * one definition, not two literals.
 */
import type { WorkspaceFile } from "../workspace/client";
import { topLevelDescription } from "./yaml-field";

/** Every template lives directly under this folder, a sibling of `examples/` and `customers/`. */
export const TEMPLATES_FOLDER = "templates";

/** A path's file name without its extension: `templates/foo.yaml` → `foo`. */
export function fileStem(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.ya?ml$/i, "");
}

/** Every diagram directly under `templates/`, from the tree's files. */
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
 * A top-level `title:` line, matched only at column 0 so a nested `title:` under `boxes`/`lanes`/
 * `story.steps` (always indented) is never touched.
 */
const TOP_LEVEL_TITLE_RE = /^title:[ \t]*(.*)$/m;

/**
 * `text` with `n`'s copy suffix appended to its top-level `title:` value — `" (copy)"` for the
 * first copy, `" (copy 2)"` for the second, matching the number `createUniqueFile` gives the copy's
 * own file name. Without it, two copies of the same template read identically in Recent, Folders
 * and a component's Used-in list. Every other line, including comments, is left untouched — this
 * edits one line with a plain string replace, not a full YAML-document round trip, which would
 * re-flow long lines and re-space flow collections.
 */
export function titleWithCopySuffix(text: string, n: number): string {
  const suffix = n <= 1 ? " (copy)" : ` (copy ${n})`;
  return text.replace(TOP_LEVEL_TITLE_RE, (_line, rawValue: string) => {
    const doubleQuoted = /^"([^"]*)"$/.exec(rawValue);
    const singleQuoted = /^'([^']*)'$/.exec(rawValue);
    const quoted = doubleQuoted ?? singleQuoted;
    if (quoted) {
      const quote = rawValue[0];
      return `title: ${quote}${quoted[1]}${suffix}${quote}`;
    }
    return `title: ${rawValue.trimEnd()}${suffix}`;
  });
}
