/**
 * DG-23 — which files are templates, and their name/description. React-free
 * (`conventions/logic-modules`); `start-from.tsx` turns this into UI, `recents.ts` imports
 * `TEMPLATES_FOLDER` so "a template is never a recent" has one definition, not two literals.
 */
import type { WorkspaceFile } from "../workspace/client";
import { topLevelDescription } from "./yaml-field";

/** Every template lives directly under this folder (DECISIONS 2026-09-28). */
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
