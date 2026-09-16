"use client";

import { createContext, useContext, useRef, useSyncExternalStore } from "react";

import type { DashboardActions, DashboardState, DashboardStore } from "../core/store";
import type { DashboardLabels } from "./labels";
import type { TileRegistry } from "./tile-registry";

/** What `DashboardProvider` puts in context. */
export interface DashboardContextValue {
  store: DashboardStore;
  registry: TileRegistry;
  labels: DashboardLabels;
  onNavigate?: (sheetId: string) => void;
  onRefresh?: (tileId: string) => void;
  /** A `button` tile's `{ type: "host" }` action (or any kind's own host action). */
  onAction?: (id: string) => void;
}

export const DashboardContext = createContext<DashboardContextValue | null>(null);

/** The provider's context; throws outside a `DashboardProvider`. */
export function useDashboardContext(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("Dashboard hooks must be used inside <DashboardProvider>.");
  return ctx;
}

/**
 * Read a slice of the sheet's store. Re-renders only when the selected slice changes
 * (`equality`, default `Object.is`) — a `s => s.hover` subscriber ignores `moveTile`.
 */
export function useDashboard<T>(
  selector: (state: DashboardState) => T,
  equality: (a: T, b: T) => boolean = Object.is,
): T {
  const { store } = useDashboardContext();
  const cache = useRef<{ state: DashboardState; value: T } | null>(null);
  const getSnapshot = () => {
    const state = store.getState();
    const previous = cache.current;
    if (previous && previous.state === state) return previous.value;
    const next = selector(state);
    if (previous && equality(previous.value, next)) {
      cache.current = { state, value: previous.value };
      return previous.value;
    }
    cache.current = { state, value: next };
    return next;
  };
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

/** The store's actions. Stable for the provider's lifetime; never re-renders. */
export function useDashboardActions(): DashboardActions {
  return useDashboardContext().store.getState().actions;
}
