"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { SelectionDriver, SelectionSnapshot } from "../core/selection";
import type { DashboardSpec, VariableValue } from "../core/spec";
// bookmarks/URL state — RM-083
import type { DecodedState } from "../core/url";
import { createDashboardStore, type DashboardMode } from "../core/store";
import { normalizeDashboardSpec } from "../core/validate";
import { DEFAULT_DASHBOARD_LABELS, type DashboardLabels } from "./labels";
import { createTileRegistry, type DashboardTileKinds, type TileRegistry } from "./tile-registry";
import { DashboardContext, type DashboardContextValue } from "./use-dashboard";

/** Second argument of `DashboardProvider`'s `onChange`. */
export interface DashboardChangeMeta {
  /**
   * `true` when a new `spec` prop arrived while the store held unsaved edits. The store
   * keeps the edits; `incoming` is the spec that was NOT applied, so the host can merge.
   */
  conflict: boolean;
  incoming?: DashboardSpec;
  /**
   * Why the store changed, when the store itself knows (RM-083) — currently only
   * `"bookmark"` (`saveBookmark` with `bookmarks.storage === "spec"`). Absent otherwise
   * (an ordinary edit, undo/redo, `discard`, a re-synced `spec` prop).
   */
  reason?: string;
}

export interface DashboardProviderProps {
  /** The sheet. Normalised before it reaches the store. */
  spec: DashboardSpec;
  /** Selection driver; read once, when the store is created. Default: the local driver. */
  driver?: SelectionDriver;
  /** Tile kinds (a list, a `kind → definition` map, or a `createTileRegistry` result). */
  tiles: DashboardTileKinds | TileRegistry;
  /** View or edit. Follows the prop when it changes. Default `spec.view.mode`, then `view`. */
  mode?: DashboardMode;
  /**
   * Every spec change the store makes, plus re-sync conflicts (`meta.conflict`). A conflict
   * fires immediately; every other change is debounced by `autosaveMs` (RM-083).
   */
  onChange?: (spec: DashboardSpec, meta: DashboardChangeMeta) => void;
  /**
   * Debounces `onChange` (trailing edge) — rapid edits (a drag, five quick moves) collapse
   * into one call `autosaveMs` after the last of them. Default `0`: every change fires
   * immediately, as before RM-083. Flushed on unmount so a pending edit is never dropped.
   * A `{ conflict: true }` re-sync call is never debounced.
   */
  autosaveMs?: number;
  /**
   * Fires on a selection OR variable change — whichever moved — with the full snapshot of
   * both (RM-083; was selection-only). Selection/variable changes never touch history and
   * never call `onChange` themselves; wire this when a host wants to react to them (persist
   * to a URL, say) without listening for spec edits.
   */
  onSelectionChange?: (
    selection: SelectionSnapshot,
    variables: Readonly<Record<string, VariableValue>>,
  ) => void;
  /** A bookmark or drill names another sheet; the host routes (D5). */
  onNavigate?: (sheetId: string) => void;
  /** A tile asks for fresh data; the host fetches (D5). */
  onRefresh?: (tileId: string) => void;
  /**
   * A `button` tile's `{ type: "host", id }` action (or any kind's own host action) —
   * the host decides what `id` means (D5). Threaded to `DashboardTileProps.emit.action`.
   */
  onAction?: (id: string) => void;
  /**
   * A selection + variables to restore once the store's selection driver is ready
   * (`driver.ready`, when the driver sets it) — the decoded result of
   * `decodeDashboardState`/`useDashboardUrlState().apply` from a share link, or a bookmark
   * applied before mount. Read once, when the store is created (RM-083).
   */
  initialState?: Pick<DecodedState, "selection" | "variables">;
  /**
   * Where "Save bookmark…" persists (RM-083; store option, `core/store.ts`). `"spec"`:
   * `saveBookmark` appends to `spec.bookmarks` and `onChange` fires with `meta.reason ===
   * "bookmark"`. `"host"` (default): `saveBookmark` only returns the `BookmarkSpec` — the
   * host persists it (D5), typically from `DashboardSelectionBar`'s `onSaveBookmark`.
   */
  bookmarks?: { storage: "spec" | "host" };
  /** Strings for the sheet chrome; missing keys fall back to English. */
  labels?: Partial<DashboardLabels>;
  children: ReactNode;
}

const isRegistry = (tiles: DashboardTileKinds | TileRegistry): tiles is TileRegistry =>
  !Array.isArray(tiles) && typeof (tiles as TileRegistry).get === "function";

/**
 * Owns one store per sheet and hands `{ store, registry }` down through context.
 *
 * Re-sync rule: the store is created once. When the `spec` prop changes identity and the
 * store is NOT dirty, the new spec replaces the store's and becomes the saved baseline.
 * When the store IS dirty, the user's edits win: the store is left alone and `onChange` is
 * called with `{ conflict: true, incoming }`.
 */
export function DashboardProvider({
  spec,
  driver,
  tiles,
  mode,
  onChange,
  autosaveMs = 0,
  onSelectionChange,
  onNavigate,
  onRefresh,
  onAction,
  initialState,
  bookmarks,
  labels,
  children,
}: DashboardProviderProps) {
  const callbacks = useRef({ onChange, onSelectionChange, onNavigate, onAction });
  callbacks.current = { onChange, onSelectionChange, onNavigate, onAction };

  const [store] = useState(() =>
    createDashboardStore({
      spec,
      driver,
      mode,
      bookmarks,
      onNavigate: (sheetId) => callbacks.current.onNavigate?.(sheetId),
    }),
  );

  const syncing = useRef(false);
  const lastSpec = useRef(spec);
  useEffect(() => {
    if (lastSpec.current === spec) return;
    lastSpec.current = spec;
    const { dirty, spec: current, actions } = store.getState();
    if (dirty) {
      callbacks.current.onChange?.(current, { conflict: true, incoming: spec });
      return;
    }
    syncing.current = true;
    try {
      actions.setSpec(normalizeDashboardSpec(spec).spec);
      actions.markSaved();
    } finally {
      syncing.current = false;
    }
  }, [spec, store]);

  useEffect(() => {
    if (mode !== undefined) store.getState().actions.setMode(mode);
  }, [mode, store]);

  // initialState — RM-083: applied once, after the driver is ready (`driver.ready`, when the
  // driver sets it — the bundled local driver resolves it immediately). Captured in a ref so
  // a later prop change (the host re-rendering with a different object) does not re-apply it.
  const initialStateRef = useRef(initialState);
  useEffect(() => {
    const init = initialStateRef.current;
    if (!init) return;
    let cancelled = false;
    (driver?.ready ?? Promise.resolve()).then(() => {
      if (cancelled) return;
      const { actions } = store.getState();
      for (const [field, values] of Object.entries(init.selection ?? {}))
        actions.select(field, values, { replace: true });
      for (const [name, value] of Object.entries(init.variables ?? {}))
        actions.setVariable(name, value);
    });
    return () => {
      cancelled = true;
    };
  }, [store, driver]);

  // autosave — RM-083: an ordinary spec commit debounces `onChange` (trailing edge); a
  // `saveBookmark`-with-`storage:"spec"` commit's reason ("bookmark", `state.changeReason`)
  // rides along. A `{ conflict: true }` re-sync (above) is never debounced — it needs the
  // host's attention now, not after `autosaveMs`.
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingChange = useRef<{ spec: DashboardSpec; meta: DashboardChangeMeta } | null>(null);
  const flushAutosave = useCallback(() => {
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = undefined;
    const pending = pendingChange.current;
    pendingChange.current = null;
    if (pending) callbacks.current.onChange?.(pending.spec, pending.meta);
  }, []);

  useEffect(() => {
    const offSpec = store.subscribe(
      (state) => state.spec,
      (next) => {
        if (syncing.current) return;
        const meta: DashboardChangeMeta = { conflict: false };
        const reason = store.getState().changeReason;
        if (reason !== undefined) meta.reason = reason;
        if (autosaveMs <= 0) {
          callbacks.current.onChange?.(next, meta);
          return;
        }
        pendingChange.current = { spec: next, meta };
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = setTimeout(flushAutosave, autosaveMs);
      },
    );
    const offSelection = store.subscribe(
      (state) => ({ selection: state.selection, variables: state.variables }),
      ({ selection, variables }) => callbacks.current.onSelectionChange?.(selection, variables),
      { equalityFn: (a, b) => a.selection === b.selection && a.variables === b.variables },
    );
    return () => {
      offSpec();
      offSelection();
      // Flush a pending debounced change rather than drop it.
      if (autosaveTimer.current) flushAutosave();
    };
  }, [store, autosaveMs, flushAutosave]);

  // Stop mirroring the driver on a real unmount. Deferred so StrictMode's simulated
  // unmount/remount (which keeps this store) does not cut the driver subscription.
  const disposeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(disposeTimer.current);
    return () => {
      disposeTimer.current = setTimeout(() => store.getState().actions.dispose(), 0);
    };
  }, [store]);

  const registry = useMemo(() => (isRegistry(tiles) ? tiles : createTileRegistry(tiles)), [tiles]);
  const mergedLabels = useMemo(() => ({ ...DEFAULT_DASHBOARD_LABELS, ...labels }), [labels]);

  const value = useMemo<DashboardContextValue>(
    () => ({
      store,
      registry,
      labels: mergedLabels,
      onNavigate: (sheetId) => callbacks.current.onNavigate?.(sheetId),
      onRefresh,
      onAction: (id) => callbacks.current.onAction?.(id),
    }),
    [store, registry, mergedLabels, onRefresh],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
