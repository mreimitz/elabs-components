import { currentComponentFiles } from "../state/component-files";
import type { ReactFlowGraph } from "../spec/flow-spec";
import type { ArchCompileView } from "../spec/compile/compile-arch";
import { useSyncExternalStore } from "react";
import { createStore } from "../state/create-store";
import { diagramStore } from "../state/diagram-store";

const EMPTY: ReadonlyMap<string, boolean> = new Map();
const state = createStore<{ byPath: ReadonlyMap<string, ReadonlyMap<string, boolean>> }>({
  byPath: new Map(),
});
let previous = diagramStore.get();
const projectionOf = (spec: unknown) =>
  JSON.stringify([spec, [...currentComponentFiles()].sort(([a], [b]) => a.localeCompare(b))]);
let projection = projectionOf(previous.drawn.spec);
// Observe every authored change, not only mounted renders: A→B→A must not revive old choices.
diagramStore.subscribe(() => {
  const next = diagramStore.get();
  const nextProjection = next.drawn === previous.drawn ? projection : projectionOf(next.drawn.spec);
  if (
    previous.loadCount !== next.loadCount ||
    ((previous.text !== next.text || projection !== nextProjection) && previous.path === next.path)
  ) {
    const byPath = new Map(state.get().byPath);
    byPath.delete(next.path ?? "shared");
    state.set({ byPath });
  }
  previous = next;
  projection = nextProjection;
});
export const compositeOverrides = {
  get: (path: string | null) => state.get().byPath.get(path ?? "shared") ?? EMPTY,
  has: (path: string | null, viewing = true) =>
    [
      ...(state
        .get()
        .byPath.get(path ?? "shared")
        ?.keys() ?? []),
    ].some((id) => viewing || id.includes(".")),
  subscribe: state.subscribe,
  set(path: string | null, id: string, expanded: boolean) {
    const byPath = new Map(state.get().byPath);
    const entries = new Map(byPath.get(path ?? "shared") ?? []);
    entries.set(id, expanded);
    byPath.set(path ?? "shared", entries);
    state.set({ byPath });
  },
};
export function useCompositeOverrides(path: string | null) {
  return useSyncExternalStore(state.subscribe, () => compositeOverrides.get(path));
}

export const compositePreview = createStore<{
  path: string | null;
  graph: ReactFlowGraph | null;
  view: ArchCompileView | null;
  toggle?: (id: string) => void;
}>({ path: null, graph: null, view: null });
export function useCompositePreview() {
  return useSyncExternalStore(compositePreview.subscribe, compositePreview.get);
}
