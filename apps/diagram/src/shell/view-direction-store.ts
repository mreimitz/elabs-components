/**
 * view-mode direction (maintainer 2026-09-27): a viewer may lay the canvas out LR or TB
 * without opening the editor, entirely for themself. It is never written to the file, never
 * marks the document dirty, never enters undo, and a page reload forgets it (view-only,
 * plan D9 — the same rule `interaction-store.ts` follows for the details card and the step
 * walk-through). Kept per open document (`mode-store.ts`'s `docKey`), so a tab switch away and
 * back keeps the choice.
 *
 * Edit mode always shows and lays out the file's own `direction:` — the override never
 * applies there, and setting it there rewrites the file for everyone (`top-bar.tsx`
 * `DiagramToggles`, `diagramActions.setTopLevel`). The moment the file's own direction changes
 * under an open override — the edit-mode toggle, typing the YAML, or a disk change from
 * outside — the override is dropped, so the canvas falls back to the new saved default.
 */
import { useEffect, useSyncExternalStore } from "react";
import { createStore } from "../state/create-store";
import type { DiagramDirection } from "../layout/run-elk";

interface ViewDirectionState {
  /** Document key (`mode-store.ts` `docKey`) → the viewer's own choice for it. */
  overrides: Record<string, DiagramDirection>;
  /** The file's own direction last seen for each key, so a change from it can drop the override. */
  lastFileDirection: Record<string, DiagramDirection | undefined>;
}

const store = createStore<ViewDirectionState>({ overrides: {}, lastFileDirection: {} });

/** The viewer's own direction for `key`, or `undefined` while none is set (the file's own shows). */
export function useViewDirectionOverride(key: string): DiagramDirection | undefined {
  return useSyncExternalStore(store.subscribe, () => store.get().overrides[key]);
}

export const viewDirectionActions = {
  /** The view-mode control (top-bar.tsx): this viewer's own choice, this document only. */
  setOverride(key: string, direction: DiagramDirection) {
    const { overrides } = store.get();
    if (overrides[key] === direction) return;
    store.set({ overrides: { ...overrides, [key]: direction } });
  },
  /**
   * Called once per render of the file's own direction for `key` (`canvas-pane.tsx`, effect):
   * a change from what was last seen drops any open override for it — the canvas then follows
   * the new saved default. The first call for a key only records it (nothing to drop yet).
   */
  noteFileDirection(key: string, fileDirection: DiagramDirection | undefined) {
    const { overrides, lastFileDirection } = store.get();
    if (lastFileDirection[key] === fileDirection) return;
    const nextLast = { ...lastFileDirection, [key]: fileDirection };
    if (!(key in overrides)) {
      store.set({ lastFileDirection: nextLast });
      return;
    }
    const { [key]: _dropped, ...rest } = overrides;
    store.set({ overrides: rest, lastFileDirection: nextLast });
  },
};

/** Installs `noteFileDirection` for `key`/`fileDirection` — call once from the shown document. */
export function useSyncViewDirectionWithFile(
  key: string,
  fileDirection: DiagramDirection | undefined,
): void {
  useEffect(() => {
    viewDirectionActions.noteFileDirection(key, fileDirection);
  }, [key, fileDirection]);
}
