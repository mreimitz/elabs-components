/**
 * DG-sidebar-search — the workspace search box's own state: the query text (read by both the
 * rail's input and the `WorkspaceTree` it filters, so it lives here rather than in either),
 * and a "focus me" request the "/" shortcut (`keymap.ts`) and the collapsed icon rail's button
 * (`workspace-search.tsx`) can make from outside the input itself. React-free except the hooks.
 */
import { useSyncExternalStore } from "react";
import { createStore } from "../state/create-store";

interface SearchState {
  query: string;
  /** Bumped to ask the input for focus (and the sidebar to open first if it is collapsed).
   * A counter, not a boolean, so asking twice in a row still re-triggers the effect that
   * opens the sidebar and focuses the input even if nothing else about the state changed. */
  focusToken: number;
}

const searchStore = createStore<SearchState>({ query: "", focusToken: 0 });

/** The live query (`""` when the box is empty — the tree then shows everything, unfiltered). */
export function useSearchQuery(): string {
  return useSyncExternalStore(searchStore.subscribe, () => searchStore.get().query);
}

export function useSearchFocusToken(): number {
  return useSyncExternalStore(searchStore.subscribe, () => searchStore.get().focusToken);
}

export const searchActions = {
  setQuery(query: string) {
    searchStore.set({ query });
  },
  clear() {
    searchStore.set({ query: "" });
  },
  /** Open the sidebar if it is collapsed, then focus the search input. */
  requestFocus() {
    searchStore.set((s) => ({ focusToken: s.focusToken + 1 }));
  },
};
