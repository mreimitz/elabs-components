"use client";

/**
 * mark-registry.tsx — the selection engine's mark geometry registry (RM-142).
 *
 * Mirrors `ChartDatapointLayer`'s target store (`chart-datapoint-layer.tsx`):
 * families publish the geometry arrays they ALREADY compute from their scales
 * (bars, points, cells) with `useRegisterMarkGeometry`, into a ref-backed
 * external store. The gesture engine reads the store lazily at commit time
 * (`useMarkGeometryStore().getSnapshot()`) — a registry write never
 * re-renders the marks, and a pointermove never re-renders the registry.
 *
 * With no provider above (gestures off) every hook here is a no-op: no
 * context value, no DOM.
 */

import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { ChartMarkGeometry } from "./hit-test";

export interface MarkGeometryStore {
  set: (groupId: string, marks: readonly ChartMarkGeometry<unknown>[]) => void;
  remove: (groupId: string) => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => readonly ChartMarkGeometry<unknown>[];
}

const EMPTY_MARKS: readonly ChartMarkGeometry<unknown>[] = Object.freeze([]);

export function createMarkGeometryStore(): MarkGeometryStore {
  const groups = new Map<string, readonly ChartMarkGeometry<unknown>[]>();
  const listeners = new Set<() => void>();
  let snapshot: readonly ChartMarkGeometry<unknown>[] = EMPTY_MARKS;

  const recompute = () => {
    const next: ChartMarkGeometry<unknown>[] = [];
    for (const marks of groups.values()) next.push(...marks);
    snapshot = next.length === 0 ? EMPTY_MARKS : next;
    for (const listener of listeners) listener();
  };

  return {
    set(groupId, marks) {
      if (groups.get(groupId) === marks) return;
      groups.set(groupId, marks);
      recompute();
    },
    remove(groupId) {
      if (groups.delete(groupId)) recompute();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
  };
}

const MarkGeometryContext = createContext<MarkGeometryStore | null>(null);

export interface ChartMarkGeometryProviderProps {
  /** An external store; one is created per provider when omitted. */
  store?: MarkGeometryStore;
  children?: ReactNode;
}

/** Scopes a mark registry to a chart. Adds no DOM. */
export function ChartMarkGeometryProvider({ store, children }: ChartMarkGeometryProviderProps) {
  const [own] = useState(createMarkGeometryStore);
  return <MarkGeometryContext value={store ?? own}>{children}</MarkGeometryContext>;
}

/** The registry in scope, or `null` when gestures are off. */
export function useMarkGeometryStore(): MarkGeometryStore | null {
  return use(MarkGeometryContext);
}

/**
 * Publishes a family's mark geometry under `groupId` (one group per series /
 * layer). Pass a MEMOISED array — a new identity republishes. No-op without a
 * provider.
 */
export function useRegisterMarkGeometry(
  marks: readonly ChartMarkGeometry<unknown>[],
  groupId = "marks",
): void {
  const store = use(MarkGeometryContext);
  useEffect(() => {
    if (!store) return;
    store.set(groupId, marks);
  }, [store, groupId, marks]);
  useEffect(() => {
    if (!store) return;
    return () => store.remove(groupId);
  }, [store, groupId]);
}

const noopSubscribe = () => () => {};
const emptySnapshot = () => EMPTY_MARKS;

/** Every registered mark (re-renders on registry writes). Empty without a provider. */
export function useMarkGeometry(): readonly ChartMarkGeometry<unknown>[] {
  const store = use(MarkGeometryContext);
  return useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    store ? store.getSnapshot : emptySnapshot,
    store ? store.getSnapshot : emptySnapshot,
  );
}
