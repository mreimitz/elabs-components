/**
 * Document keys, shared by `shell/mode-store.ts` (tabs and modes) and
 * `shell/view-overrides-store.ts` (per-viewer direction/node-style choices). Kept here, in the
 * state layer, rather than in either store: `mode-store.ts` already imports `diagram-store.ts`,
 * and `diagram-store.ts` itself needs `overrideDocKey` (to drop a stale override the moment the
 * open document's own field changes — see that file), so a shell-layer home for these two
 * functions would cycle back on `diagram-store.ts`.
 */

/** The mode key of a document that is no workspace file (an old share link). */
export const SHARED_DOC_KEY = "#shared";

/** A document's mode key: its workspace path, or `SHARED_DOC_KEY` for a share link/tab-less doc. */
export function docKey(path: string | null): string {
  return path ?? SHARED_DOC_KEY;
}

/**
 * The per-viewer view-overrides key for a document: the workspace path, or — unlike `docKey`,
 * which folds every path-less document into one `SHARED_DOC_KEY` — a share link's OWN content
 * id, so opening a second shared diagram in the same tab never inherits the first one's
 * view-only direction or node style. A path-less, share-less document (a bare `#present`) still
 * falls back to `SHARED_DOC_KEY`: there is nothing to tell two of those apart by.
 */
export function overrideDocKey(path: string | null, share: string | undefined): string {
  if (path !== null) return path;
  return share !== undefined ? `share:${share}` : SHARED_DOC_KEY;
}
