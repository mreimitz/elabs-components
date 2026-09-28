/**
 * View mode's per-viewer overrides (maintainer ruling 2026-09-27): "in view mode nothing
 * should be able to change, also moving the nodes is not allowed. Just the layout direction,
 * if it's card or icon [nodeStyle], and then the change from technical to visual [a third
 * field, `lens`, built on `diagram/lens-switch` and landed as its own `lens-store.ts` — that
 * store already covers the third choice on its own terms (global, URL-hash-carried) rather
 * than through this one]." A viewer may change these without opening the editor, entirely for
 * themself: never written to the file, never marks the document dirty, never enters undo, and
 * a page reload forgets them (the same rule `interaction-store.ts` follows for the details
 * card and the step walk-through).
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
 * was (A→B→A): this module subscribes to `diagram-store.ts` directly (not a component effect,
 * so it runs for the app's whole life, never only while some particular pane happens to stay
 * mounted — the gap a component-effect design left open the first time this was built, when a
 * document sitting in the phone's Editor tab, canvas unmounted, could miss the change) and
 * drops an override the instant the CURRENTLY OPEN document's own direction or node style
 * differs from what it was at the previous compile. Switching to a DIFFERENT document never
 * touches its override — nothing here compares one document's values to another's — so an
 * override survives being tabbed away from and back to, exactly as long as its own file stays
 * untouched.
 */
import { useSyncExternalStore } from "react";
import { createStore } from "../state/create-store";
import { diagramStore } from "../state/diagram-store";
import { overrideDocKey } from "../state/override-key";
import { parseRoute } from "../routes/use-hash";
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
}

const store = createStore<ViewOverridesState>({ overrides: {} });

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
  store.set({ overrides: withField(overrides, key, rest) });
}

// ── Drop a stale override the moment the file itself changes (see the file doc comment) ────
// Tracks the CURRENTLY OPEN document's own key and its last-seen direction/node style; every
// `diagram-store.ts` change (a keystroke's compile, the edit-mode toggle, a disk reload) runs
// this once. A different key (the document itself changed, e.g. a tab switch) just starts
// tracking that document's own current values — never a comparison across two documents.
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
    const { overrides } = store.get();
    const current = overrides[key];
    if (current?.[field] === value) return;
    store.set({ overrides: withField(overrides, key, { ...current, [field]: value }) });
  },
  /** The reset control (top-bar.tsx): back to the diagram's own setting for every field at once. */
  clear(key: string) {
    const { overrides } = store.get();
    if (!(key in overrides)) return;
    const { [key]: _dropped, ...rest } = overrides;
    store.set({ overrides: rest });
  },
  /**
   * A document (or every document under a moved folder) changed key: carry its open override
   * to the new key, the same way `mode-store.ts`'s `moved` carries tabs and modes — `follow` is
   * that call's own path-rewriter. A share-link key never matches a workspace path, so this is
   * a no-op for one.
   */
  moved(follow: (key: string) => string) {
    const { overrides } = store.get();
    store.set({
      overrides: Object.fromEntries(
        Object.entries(overrides).map(([key, value]) => [follow(key), value]),
      ),
    });
  },
  /** A file or folder is trashed (`mode-store.ts` `closeTabsAt`): forget any override on record
   * for it, or for a file under it — nothing left to apply a viewer's choice TO. */
  forgetAt(path: string) {
    const { overrides } = store.get();
    const kept = Object.fromEntries(
      Object.entries(overrides).filter(([key]) => key !== path && !key.startsWith(`${path}/`)),
    );
    if (Object.keys(kept).length !== Object.keys(overrides).length) {
      store.set({ overrides: kept });
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
