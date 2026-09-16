"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { SelectionDriver, SelectionSnapshot } from "../core/selection";
import type { DashboardSpec } from "../core/spec";
import {
  createDashboardStore,
  type DashboardMode,
  // interaction graph — RM-082
  type DashboardNavigateContext,
} from "../core/store";
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
  /** Every spec change the store makes, plus re-sync conflicts (`meta.conflict`). */
  onChange?: (spec: DashboardSpec, meta: DashboardChangeMeta) => void;
  onSelectionChange?: (selection: SelectionSnapshot) => void;
  /** A bookmark or drill names another sheet; the host routes (D5). */
  // interaction graph — RM-082: a drill passes `{ carry }` (field → values to select there).
  onNavigate?: (sheetId: string, context?: DashboardNavigateContext) => void;
  /** A tile asks for fresh data; the host fetches (D5). */
  onRefresh?: (tileId: string) => void;
  /**
   * A `button` tile's `{ type: "host", id }` action (or any kind's own host action) —
   * the host decides what `id` means (D5). Threaded to `DashboardTileProps.emit.action`.
   */
  onAction?: (id: string) => void;
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
  onSelectionChange,
  onNavigate,
  onRefresh,
  onAction,
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
      // interaction graph — RM-082
      onNavigate: (sheetId, context) => callbacks.current.onNavigate?.(sheetId, context),
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

  useEffect(() => {
    const offSpec = store.subscribe(
      (state) => state.spec,
      (next) => {
        if (!syncing.current) callbacks.current.onChange?.(next, { conflict: false });
      },
    );
    const offSelection = store.subscribe(
      (state) => state.selection,
      (next) => callbacks.current.onSelectionChange?.(next),
    );
    return () => {
      offSpec();
      offSelection();
    };
  }, [store]);

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
      // interaction graph — RM-082
      onNavigate: (sheetId: string, context?: DashboardNavigateContext) =>
        callbacks.current.onNavigate?.(sheetId, context),
      onRefresh,
      onAction: (id) => callbacks.current.onAction?.(id),
    }),
    [store, registry, mergedLabels, onRefresh],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}
