/**
 * DG-23 — which diagrams Home's Recent section shows. No React import; `home-view.tsx` turns this
 * into UI.
 */
import type { WorkspaceFile } from "../workspace/client";
import { TEMPLATES_FOLDER } from "./templates";

/** Up to 8 recent diagrams shown; the store keeps more (`RECENTS_LIMIT`, 12) for its own use. */
export const RECENTS_SHOWN = 8;

/** A template is a starting point, not something the user "opened"; never counts as a recent. */
function isTemplate(file: WorkspaceFile): boolean {
  return file.path.startsWith(`${TEMPLATES_FOLDER}/`);
}

/**
 * DG-21's recents (paths that still resolve in the tree), topped up with the newest diagrams by
 * mtime that are not already listed — templates excluded either way ("New from template" is the
 * entry point for those, not Recent).
 */
export function recentFiles(
  recents: readonly string[],
  files: readonly WorkspaceFile[] | undefined,
): WorkspaceFile[] {
  if (!files) return [];
  const byPath = new Map(files.map((file) => [file.path, file]));
  const fromRecents = recents
    .map((path) => byPath.get(path))
    .filter((file): file is WorkspaceFile => file !== undefined && !isTemplate(file));
  if (fromRecents.length >= RECENTS_SHOWN) return fromRecents.slice(0, RECENTS_SHOWN);
  const seen = new Set(fromRecents.map((file) => file.path));
  const topUp = [...files]
    .filter((file) => file.kind === "diagram" && !isTemplate(file) && !seen.has(file.path))
    .sort((a, b) => b.mtime - a.mtime);
  return [...fromRecents, ...topUp].slice(0, RECENTS_SHOWN);
}
