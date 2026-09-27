/**
 * View mode's per-viewer overrides (maintainer ruling 2026-09-27): "in view mode nothing
 * should be able to change, also moving the nodes is not allowed. Just the layout direction,
 * if it's card or icon [nodeStyle], and then the change from technical to visual [a third
 * field, `lens`, built on `diagram/lens-switch` — this store already generalises over a field
 * name, so adding it there is a one-line `ViewOverrides` addition, nothing here]." A viewer may
 * change these without opening the editor, entirely for themself: never written to the file,
 * never marks the document dirty, never enters undo, and a page reload forgets them (the same
 * rule `interaction-store.ts` follows for the details card and the step walk-through).
 *
 * Kept per open document, keyed by `mode-store.ts`'s `overrideDocKey` — a workspace path, or
 * (unlike `docKey`, which folds every path-less document into one `SHARED_DOC_KEY`) a share
 * link's OWN content id, so two different shared diagrams opened in the same tab never bleed
 * one's override into the other's. `mode-store.ts`'s `moved` carries an open override to a
 * renamed or moved file's new key, the same way it already carries tabs and modes.
 *
 * Edit mode always shows and lays out the file's own values — the override never applies
 * there, and setting it there rewrites the file for everyone (`top-bar.tsx` `DiagramToggles`,
 * `diagramActions.setTopLevel`). The moment a field's own file value changes under an open
 * override for it — the edit-mode toggle, typing the YAML, or a disk change from outside —
 * that field's override is dropped, so the canvas falls back to the new saved default; the
 * OTHER field's override (if any) is untouched, since the two are independent choices.
 */
import { useEffect, useSyncExternalStore } from "react";
import { createStore } from "../state/create-store";
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
  /** The file's own values last seen for each key, so a change from them can drop the override. */
  lastFile: Record<string, ViewOverrides | undefined>;
}

const store = createStore<ViewOverridesState>({ overrides: {}, lastFile: {} });

const EMPTY_OVERRIDES: ViewOverrides = {};

/** This viewer's own overrides for `key` — empty (the file's own values show) until one is set. */
export function useViewOverrides(key: string): ViewOverrides {
  return useSyncExternalStore(store.subscribe, () => store.get().overrides[key] ?? EMPTY_OVERRIDES);
}

/**
 * What view mode shows for one field: this viewer's own override while editing is off and one
 * is set, else the file's own value. The one place both the canvas (`canvas-pane.tsx`) and the
 * top bar (`top-bar.tsx`) derive it, so the two can never disagree about what a viewer is
 * looking at (review-r0: they used to derive it two different ways).
 */
export function effectiveViewValue<T>(viewing: boolean, override: T | undefined, fileValue: T): T {
  return viewing && override !== undefined ? override : fileValue;
}

export const viewOverrideActions = {
  /** The view-mode control (top-bar.tsx): this viewer's own choice for one field, this document only. */
  setOverride<K extends ViewOverrideField>(
    key: string,
    field: K,
    value: NonNullable<ViewOverrides[K]>,
  ) {
    const { overrides } = store.get();
    const current = overrides[key];
    if (current?.[field] === value) return;
    store.set({ overrides: { ...overrides, [key]: { ...current, [field]: value } } });
  },
  /**
   * Called once per render of the file's own values for `key` (`canvas-pane.tsx`, effect): a
   * field that changed from what was last seen for it drops only THAT field's open override —
   * the canvas then follows the new saved default for it. The other field's override (if any)
   * is untouched. The first call for a key only records it (nothing to drop yet).
   */
  noteFileValues(key: string, file: ViewOverrides) {
    const { overrides, lastFile } = store.get();
    const previous = lastFile[key];
    if (previous?.direction === file.direction && previous?.nodeStyle === file.nodeStyle) return;
    const nextLastFile = { ...lastFile, [key]: file };
    const current = overrides[key];
    if (!current || previous === undefined) {
      store.set({ lastFile: nextLastFile });
      return;
    }
    let next = current;
    if (previous.direction !== file.direction && next.direction !== undefined) {
      const { direction: _direction, ...rest } = next;
      next = rest;
    }
    if (previous.nodeStyle !== file.nodeStyle && next.nodeStyle !== undefined) {
      const { nodeStyle: _nodeStyle, ...rest } = next;
      next = rest;
    }
    if (next === current) {
      store.set({ lastFile: nextLastFile });
      return;
    }
    const nextOverrides = { ...overrides };
    if (Object.keys(next).length === 0) delete nextOverrides[key];
    else nextOverrides[key] = next;
    store.set({ overrides: nextOverrides, lastFile: nextLastFile });
  },
  /**
   * A document (or every document under a moved folder) changed key: carry its open override
   * (and the file values recorded for it) to the new key, the same way `mode-store.ts`'s
   * `moved` carries tabs and modes — `follow` is that call's own path-rewriter. A share-link
   * key never matches a workspace path, so this is a no-op for one.
   */
  moved(follow: (key: string) => string) {
    const remap = <T>(map: Record<string, T>): Record<string, T> =>
      Object.fromEntries(Object.entries(map).map(([key, value]) => [follow(key), value]));
    const { overrides, lastFile } = store.get();
    store.set({ overrides: remap(overrides), lastFile: remap(lastFile) });
  },
  /** This document has an open override right now (`use-autosave.ts`: never thumbnail one). */
  hasOverride(key: string): boolean {
    const current = store.get().overrides[key];
    return current !== undefined && Object.keys(current).length > 0;
  },
};

/** Installs `noteFileValues` for `key`/`file` — call once from the shown document. */
export function useSyncViewOverridesWithFile(key: string, file: ViewOverrides): void {
  const { direction, nodeStyle } = file;
  useEffect(() => {
    viewOverrideActions.noteFileValues(key, { direction, nodeStyle });
  }, [key, direction, nodeStyle]);
}
