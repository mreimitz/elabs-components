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
 * Kept per open document, keyed by `mode-store.ts`'s `overrideDocKey` — a workspace path, or
 * (unlike `docKey`, which folds every path-less document into one `SHARED_DOC_KEY`) a share
 * link's OWN content id, so two different shared diagrams opened in the same tab never bleed
 * one's override into the other's. `mode-store.ts`'s `moved` carries an open override to a
 * renamed or moved file's new key, the same way it already carries tabs and modes.
 *
 * Edit mode always shows and lays out the file's own values — the override never applies
 * there, and setting it there rewrites the file for everyone (`top-bar.tsx` `DiagramToggles`,
 * `diagramActions.setTopLevel`).
 *
 * fix-r0 F5: dropping a stale override (the field's own file value moved on under it — the
 * edit-mode toggle, typing the YAML, or a disk change from outside) is DERIVED, not synced by
 * an effect. Each override records `basis`: the file's own value for that field at the moment
 * this viewer set it. `effectiveViewValue`/`activeOverrideValue` compare `basis` against
 * whatever the caller passes as the CURRENT file value on every read; once they disagree the
 * override reads back as gone, with no separate "last seen" state to keep in step and no
 * effect that only runs while some particular component (`canvas-pane.tsx`, previously) stays
 * mounted — the phone's edit tab, with the canvas unmounted, missed an A→B→A change under the
 * old effect-synced design. The OTHER field's override (if any) is untouched, since the two
 * are independent choices.
 */
import { useSyncExternalStore } from "react";
import { createStore } from "../state/create-store";
import type { DiagramDirection } from "../layout/run-elk";
import type { NodeStyle } from "../spec/dialect";

/** One viewer-chosen value, pinned to the file's own value it was chosen against. */
export interface OverrideEntry<T> {
  value: T;
  /** The file's own value for this field when the viewer set this override (fix-r0 F5). */
  basis: T;
}

export interface ViewOverrides {
  direction?: OverrideEntry<DiagramDirection>;
  nodeStyle?: OverrideEntry<NodeStyle>;
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

/**
 * `entry`'s value, only while it still applies: `viewing` and its `basis` still matches the
 * file's actual current value for the field. A stale entry (the file moved on since the viewer
 * set it) reads back as `undefined` here — the caller then falls back to the file's own value.
 */
export function activeOverrideValue<T>(
  viewing: boolean,
  entry: OverrideEntry<T> | undefined,
  fileValue: T,
): T | undefined {
  return viewing && entry !== undefined && entry.basis === fileValue ? entry.value : undefined;
}

/**
 * What view mode shows for one field: this viewer's own override while editing is off and one
 * still applies, else the file's own value. The one place both the canvas (`canvas-pane.tsx`)
 * and the top bar (`top-bar.tsx`) derive it, so the two can never disagree about what a viewer
 * is looking at (review-r0: they used to derive it two different ways).
 */
export function effectiveViewValue<T>(
  viewing: boolean,
  entry: OverrideEntry<T> | undefined,
  fileValue: T,
): T {
  return activeOverrideValue(viewing, entry, fileValue) ?? fileValue;
}

export const viewOverrideActions = {
  /**
   * The view-mode control (top-bar.tsx): this viewer's own choice for one field, this document
   * only, pinned to `fileValue` — the file's own value for the field right now, so a later
   * change to it drops this override on the next read (fix-r0 F5).
   */
  setOverride<K extends ViewOverrideField>(
    key: string,
    field: K,
    value: NonNullable<ViewOverrides[K]>["value"],
    fileValue: NonNullable<ViewOverrides[K]>["value"],
  ) {
    const { overrides } = store.get();
    const current = overrides[key];
    const existing = current?.[field];
    if (existing?.value === value && existing.basis === fileValue) return;
    store.set({
      overrides: { ...overrides, [key]: { ...current, [field]: { value, basis: fileValue } } },
    });
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
  /**
   * This document has an override on record right now (`use-autosave.ts`: never thumbnail one
   * while a viewer's own choice, not the file's, could be on screen — see that file's mode
   * gate for why a stale entry here is harmless: edit mode never reads an override at all).
   */
  hasOverride(key: string): boolean {
    const current = store.get().overrides[key];
    return current !== undefined && Object.keys(current).length > 0;
  },
};
