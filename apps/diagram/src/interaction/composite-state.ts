import { useSyncExternalStore } from "react";
import { createStore } from "../state/create-store";
import { diagramStore } from "../state/diagram-store";

const EMPTY: ReadonlyMap<string, boolean> = new Map();
const state = createStore<{ byPath: ReadonlyMap<string, ReadonlyMap<string, boolean>> }>({
  byPath: new Map(),
});
let previous = diagramStore.get();
// Observe every authored change, not only mounted renders: A→B→A must not revive old choices.
diagramStore.subscribe(() => {
  const next = diagramStore.get();
  if (
    (previous.text !== next.text || previous.drawn !== next.drawn) &&
    previous.path === next.path
  ) {
    const byPath = new Map(state.get().byPath);
    byPath.delete(next.path ?? "shared");
    state.set({ byPath });
  }
  previous = next;
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
  graph: import("../spec/flow-spec").ReactFlowGraph | null;
  view: import("../spec/compile/compile-arch").ArchCompileView | null;
  toggle?: (id: string) => void;
}>({ path: null, graph: null, view: null });
export function useCompositePreview() {
  return useSyncExternalStore(compositePreview.subscribe, compositePreview.get);
}
