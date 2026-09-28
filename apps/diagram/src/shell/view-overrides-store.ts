/**
 * View mode's per-viewer overrides (maintainer ruling 2026-09-27): "in view mode nothing
 * should be able to change, also moving the nodes is not allowed. Just the layout direction,
 * if it's card or icon [nodeStyle], and then the change from technical to visual [a third
 * field, `lens`, its own `lens-store.ts` — that store already covers the third choice on its
 * own terms (global, URL-hash-carried) rather than through this one]." A viewer may change
 * these without opening the editor, entirely for themself: never written to the file, never
 * marks the document dirty, never enters undo, and a page reload forgets them (the same rule
 * `interaction-store.ts` follows for the details card and the step walk-through).
 *
 * Kept per open document, keyed by `state/override-key.ts`'s `overrideDocKey` — a workspace
 * path, or (unlike `docKey`, which folds every path-less document into one `SHARED_DOC_KEY`) a
 * share link's OWN content id, so two different shared diagrams opened in the same tab never
 * bleed one's override into the other's. `mode-store.ts`'s `moved` carries an open override to
 * a renamed or moved file's new key, the same way it already carries tabs and modes;
 * `closeTabsAt` (a trash) forgets it instead (`forgetAt`, below).
 *
 * Edit mode always shows and lays out the file's own values — the override never applies
 * there, and setting it there rewrites the file for everyone (`top-bar.tsx` `DiagramToggles`,
 * `diagramActions.setTopLevel`).
 *
 * A viewer's override survives edits that leave the field alone, but is dropped for good the
 * moment the field's OWN value actually changes — even if a later edit sets it back to what it
 * was (A→B→A). This module subscribes to `diagram-store.ts` directly (not a component effect),
 * so it runs for the app's whole life, never only while some particular pane happens to stay
 * mounted, and works two different ways depending on whether the document stayed open the
 * whole time:
 *
 * - While it stays the CURRENTLY open document, every compile is compared to the previous one
 *   (`trackedDirection`/`trackedNodeStyle` below) — a mismatch drops that field's override right
 *   away, the instant the value changes.
 * - Reopening it (a tab switch back, or a share/rename round trip) cannot have watched any of
 *   that: the doc may have been rewritten by another tab, or an agent/editor, while its own tab
 *   sat in the background. Comparing only the CURRENT value would miss an A→B→A that happened
 *   entirely offscreen (it nets back to what the override already assumed). Instead, each key's
 *   override remembers the file's `workspace-store.ts` mtime at the moment it was set
 *   (`revisionAtSet`); reopening the key compares that snapshot to the file's fresh mtime, and a
 *   mismatch drops the WHOLE override for that key, whether or not the value it settled on
 *   happens to match.
 *
 * Switching to a DIFFERENT document never touches that document's own override on its own
 * account — only the revision check above can drop it, on the visit where it is reopened.
 */
import { useSyncExternalStore } from "react";
import { createStore } from "../state/create-store";
import { diagramStore } from "../state/diagram-store";
import { overrideDocKey } from "../state/override-key";
import { parseRoute } from "../routes/use-hash";
import { workspaceStore } from "../workspace/workspace-store";
import type { DiagramDirection } from "../layout/run-elk";
import type { NodeStyle } from "../spec/dialect";

export interface ViewOverrides {
  direction?: DiagramDirection;
  nodeStyle?: NodeStyle;
}

type ViewOverrideField = keyof ViewOverrides;

interface ViewOverridesState {
  /** Document key → this viewer's own choice for it, field by field. */
  overrides: Record<string, ViewOverrides>;
  /**
   * Document key → the file's mtime the moment its override was (first) set; `null` when no
   * mtime was known at that point (a share link, or a document that has never round-tripped
   * through a workspace read). See the module doc above for what this is for.
   */
  revisionAtSet: Record<string, number | null>;
}

const store = createStore<ViewOverridesState>({ overrides: {}, revisionAtSet: {} });

const EMPTY_OVERRIDES: ViewOverrides = {};

/** This viewer's own overrides for `key` — empty (the file's own values show) until one is set. */
export function useViewOverrides(key: string): ViewOverrides {
  return useSyncExternalStore(store.subscribe, () => store.get().overrides[key] ?? EMPTY_OVERRIDES);
}

/** `entry`, only while `viewing` — the caller falls back to the file's own value otherwise. */
export function activeOverrideValue<T>(viewing: boolean, entry: T | undefined): T | undefined {
  return viewing ? entry : undefined;
}

/**
 * What view mode shows for one field: this viewer's own override while editing is off and one
 * is set, else the file's own value. The one place both the canvas (`canvas-pane.tsx`) and the
 * top bar (`top-bar.tsx`) derive it, so the two can never disagree about what a viewer is
 * looking at.
 */
export function effectiveViewValue<T>(viewing: boolean, entry: T | undefined, fileValue: T): T {
  return activeOverrideValue(viewing, entry) ?? fileValue;
}

function withField(
  overrides: Record<string, ViewOverrides>,
  key: string,
  next: ViewOverrides,
): Record<string, ViewOverrides> {
  return { ...overrides, [key]: next };
}

/** Drop one field's override for `key` — a no-op if it was not set. */
function dropField(key: string, field: ViewOverrideField) {
  const { overrides } = store.get();
  const current = overrides[key];
  if (current?.[field] === undefined) return;
  const { [field]: _dropped, ...rest } = current;
  if (Object.keys(rest).length === 0) {
    dropAll(key);
    return;
  }
  store.set({ overrides: withField(overrides, key, rest) });
}

/** Drop every field's override for `key` at once — the reset control, and a stale revision. */
function dropAll(key: string) {
  const { overrides, revisionAtSet } = store.get();
  if (!(key in overrides) && !(key in revisionAtSet)) return;
  const { [key]: _o, ...restOverrides } = overrides;
  const { [key]: _r, ...restRevisions } = revisionAtSet;
  store.set({ overrides: restOverrides, revisionAtSet: restRevisions });
}

// ── Drop a stale override once the file itself changes (see the module doc above) ──────────
// Tracks the CURRENTLY OPEN document's own key and its last-seen direction/node style; every
// `diagram-store.ts` change (a keystroke's compile, the edit-mode toggle, a disk reload) runs
// this once.
let trackedKey: string | null = null;
let trackedDirection: DiagramDirection | undefined;
let trackedNodeStyle: NodeStyle | undefined;

diagramStore.subscribe(() => {
  const { path, drawn } = diagramStore.get();
  const route = parseRoute(window.location.hash);
  const key = overrideDocKey(path, route.kind === "doc" ? route.share : undefined);
  const direction = drawn.spec?.layout.direction;
  const nodeStyle = drawn.ast?.nodeStyle;
  if (key !== trackedKey) {
    trackedKey = key;
    trackedDirection = direction;
    trackedNodeStyle = nodeStyle;
    const revisionAtSet = store.get().revisionAtSet[key];
    const current = workspaceStore.get().current;
    const liveMtime = current?.path === path ? current.mtime : null;
    if (revisionAtSet !== undefined && liveMtime !== null && liveMtime !== revisionAtSet) {
      dropAll(key);
    }
    return;
  }
  if (direction !== trackedDirection) {
    trackedDirection = direction;
    dropField(key, "direction");
  }
  if (nodeStyle !== trackedNodeStyle) {
    trackedNodeStyle = nodeStyle;
    dropField(key, "nodeStyle");
  }
});

export const viewOverrideActions = {
  /**
   * The view-mode control (top-bar.tsx): this viewer's own choice for one field, this document
   * only. Choosing the diagram's OWN current value (`fileValue`) removes the override instead
   * of recording a redundant one that would only ever show as the file's own value anyway — so
   * `use-autosave.ts`'s thumbnail guard (`hasOverride`) never skips a refresh for nothing.
   */
  setOverride<K extends ViewOverrideField>(
    key: string,
    field: K,
    value: NonNullable<ViewOverrides[K]>,
    fileValue: NonNullable<ViewOverrides[K]>,
  ) {
    if (value === fileValue) {
      dropField(key, field);
      return;
    }
    const { overrides, revisionAtSet } = store.get();
    const current = overrides[key];
    if (current?.[field] === value) return;
    const nextOverrides = withField(overrides, key, { ...current, [field]: value });
    // The first override on this key: remember the file's own revision right now, so
    // reopening this document later (the subscription above) can tell a background rewrite
    // happened even if the value it settled on matches this one again.
    const nextRevisions =
      current === undefined
        ? { ...revisionAtSet, [key]: workspaceStore.get().current?.mtime ?? null }
        : revisionAtSet;
    store.set({ overrides: nextOverrides, revisionAtSet: nextRevisions });
  },
  /** The reset control (top-bar.tsx): back to the diagram's own setting for every field at once. */
  clear(key: string) {
    dropAll(key);
  },
  /**
   * A document (or every document under a moved folder) changed key: carry its open override
   * (and the revision it was set against) to the new key, the same way `mode-store.ts`'s
   * `moved` carries tabs and modes — `follow` is that call's own path-rewriter. A share-link key
   * never matches a workspace path, so this is a no-op for one.
   */
  moved(follow: (key: string) => string) {
    const { overrides, revisionAtSet } = store.get();
    const rekey = <V>(record: Record<string, V>) =>
      Object.fromEntries(Object.entries(record).map(([key, value]) => [follow(key), value]));
    store.set({ overrides: rekey(overrides), revisionAtSet: rekey(revisionAtSet) });
  },
  /** A file or folder is trashed (`mode-store.ts` `closeTabsAt`): forget any override on record
   * for it, or for a file under it — nothing left to apply a viewer's choice TO. */
  forgetAt(path: string) {
    const { overrides, revisionAtSet } = store.get();
    const keeps = ([key]: [string, unknown]) => key !== path && !key.startsWith(`${path}/`);
    const keptOverrides = Object.fromEntries(Object.entries(overrides).filter(keeps));
    if (Object.keys(keptOverrides).length !== Object.keys(overrides).length) {
      const keptRevisions = Object.fromEntries(Object.entries(revisionAtSet).filter(keeps));
      store.set({ overrides: keptOverrides, revisionAtSet: keptRevisions });
    }
  },
  /**
   * This document has an override on record right now (`use-autosave.ts`: never thumbnail one
   * while a viewer's own choice, not the file's, could be on screen — see that file's mode
   * gate for why a stale entry here is harmless: edit mode never reads an override at all).
   */
  hasOverride(key: string): boolean {
    const current = store.get().overrides[key];
    return current !== undefined && Object.keys(current).length > 0;
  },
  /** Runs `listener` on every change to any document's overrides (`use-autosave.ts`: retry a
   * thumbnail a moment ago skipped because an override was on record, once it clears). */
  subscribe(listener: () => void): () => void {
    return store.subscribe(listener);
  },
};
