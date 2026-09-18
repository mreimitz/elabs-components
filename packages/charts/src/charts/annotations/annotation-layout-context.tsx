"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { LabelPlacement, LabelRect } from "../labels/label-layout";

/**
 * The shared state of one annotated chart (RM-111):
 * - `obstacles`: label boxes (plot px) that marks inside the plot have painted
 *   — RM-110 end and value labels, a waterfall's value labels. Annotation
 *   text is laid out around them.
 * - `demoted`: indices of painted annotations the layout could not place
 *   without an overlap. The layer paints each as a numbered marker, and the
 *   `AnnotationKey` lists it, so nothing is hidden.
 *
 * Published from layout effects and read with `useSyncExternalStore`, so the
 * second pass lands before paint. Without a provider every hook is inert: a
 * chart without annotations publishes nothing and renders as before.
 */
interface AnnotationLayoutStore {
  setObstacles: (id: string, rects: readonly LabelRect[] | null) => void;
  setDemoted: (indices: readonly number[]) => void;
  getObstacles: () => readonly LabelRect[];
  getDemoted: () => readonly number[];
  subscribe: (listener: () => void) => () => void;
}

const NO_RECTS: readonly LabelRect[] = [];
const NO_INDICES: readonly number[] = [];

function sameIndices(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

function createAnnotationLayoutStore(): AnnotationLayoutStore {
  const byId = new Map<string, readonly LabelRect[]>();
  const listeners = new Set<() => void>();
  let obstacles = NO_RECTS;
  let demoted = NO_INDICES;
  const emit = () => {
    for (const listener of listeners) listener();
  };
  return {
    setObstacles(id, rects) {
      if (rects?.length) byId.set(id, rects);
      else if (!byId.delete(id)) return;
      obstacles = [...byId.values()].flat();
      emit();
    },
    setDemoted(indices) {
      if (sameIndices(indices, demoted)) return;
      demoted = indices.length ? indices : NO_INDICES;
      emit();
    },
    getObstacles: () => obstacles,
    getDemoted: () => demoted,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const AnnotationLayoutContext = createContext<AnnotationLayoutStore | null>(null);

/**
 * Scope one annotated chart: wrap the chart AND its `AnnotationKey`, so the
 * key lists the notes the layer had to demote. `useAnnotatedChart` and
 * `AutoChart` mount it; a container given no annotations never does.
 */
export function AnnotationLayoutProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createAnnotationLayoutStore);
  return (
    <AnnotationLayoutContext.Provider value={store}>{children}</AnnotationLayoutContext.Provider>
  );
}

/** `true` inside an annotated chart's scope (a key is listening for demoted notes). */
export function useAnnotationLayoutScope(): boolean {
  return useContext(AnnotationLayoutContext) !== null;
}

/** Publish label boxes (plot px) annotation text must avoid; inert outside a scope. */
export function usePublishAnnotationObstacles(
  id: string,
  rects: readonly LabelRect[] | null | undefined,
): void {
  const store = useContext(AnnotationLayoutContext);
  useLayoutEffect(() => {
    if (!store) return undefined;
    store.setObstacles(id, rects ?? null);
    return () => store.setObstacles(id, null);
  }, [store, id, rects]);
}

/** The boxes of solver placements, for {@link usePublishAnnotationObstacles}. */
export function placementRects(
  placements: readonly LabelPlacement[] | null | undefined,
): readonly LabelRect[] | null {
  if (!placements?.length) return null;
  return placements.map((p) => ({ x: p.x, y: p.y, width: p.label.width, height: p.label.height }));
}

const noopSubscribe = () => () => undefined;
const getNoRects = () => NO_RECTS;
const getNoIndices = () => NO_INDICES;

/** Every published obstacle in this chart's scope. */
export function useAnnotationObstacles(): readonly LabelRect[] {
  const store = useContext(AnnotationLayoutContext);
  return useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    store ? store.getObstacles : getNoRects,
    getNoRects,
  );
}

/** Indices of annotations the layer demoted to a numbered marker, for the key. */
export function useDemotedAnnotations(): readonly number[] {
  const store = useContext(AnnotationLayoutContext);
  return useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    store ? store.getDemoted : getNoIndices,
    getNoIndices,
  );
}

/** Report the indices this layer demoted (sorted); cleared when the layer unmounts. */
export function useReportDemotedAnnotations(indices: readonly number[] | null): void {
  const store = useContext(AnnotationLayoutContext);
  useLayoutEffect(() => {
    if (!store || indices === null) return undefined;
    store.setDemoted(indices);
    return () => store.setDemoted(NO_INDICES);
  }, [store, indices]);
}
