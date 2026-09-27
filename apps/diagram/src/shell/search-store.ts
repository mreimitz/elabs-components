/**
 * DG-sidebar-search — the workspace search box's own state: the query text (read by both the
 * rail's input and the `WorkspaceTree` it filters, so it lives here rather than in either),
 * and a "focus me" request the "/" shortcut (`keymap.ts`) and the collapsed icon rail's button
 * (`workspace-search.tsx`) can make from outside the input itself. React-free except the hooks.
 */
import { useSyncExternalStore } from "react";
import { createStore } from "../state/create-store";
import { activateSearchIndex } from "../workspace/search-index";

interface SearchState {
  query: string;
  /** Bumped to ask the input for focus (and the sidebar to open first if it is collapsed).
   * A counter, not a boolean, so asking twice in a row still re-triggers the effect that
   * opens the sidebar and focuses the input even if nothing else about the state changed.
   * `WorkspaceSearch` only ever acts on a token NEWER than the one it last saw (a ref set at
   * mount), so a remount (e.g. leaving presenting) never replays a request from before it
   * mounted — m2/F2. */
  focusToken: number;
}

const searchStore = createStore<SearchState>({ query: "", focusToken: 0 });

// Module-level (not component state): survives `WorkspaceSearch` unmounting and remounting,
// which the mobile sheet does on every open/close — s6.
let openedExplicitly = false;

/** The live query (`""` when the box is empty — the tree then shows everything, unfiltered). */
export function useSearchQuery(): string {
  return useSyncExternalStore(searchStore.subscribe, () => searchStore.get().query);
}

export function useSearchFocusToken(): number {
  return useSyncExternalStore(searchStore.subscribe, () => searchStore.get().focusToken);
}

export const searchActions = {
  setQuery(query: string) {
    // Lazy: the index is built on the first real search, not on every app load (F7).
    if (query !== "") activateSearchIndex();
    searchStore.set({ query });
  },
  clear() {
    searchStore.set({ query: "" });
  },
  /** Open the sidebar if it is collapsed, then focus the search input. */
  requestFocus() {
    activateSearchIndex();
    openedExplicitly = true;
    searchStore.set((s) => ({ focusToken: s.focusToken + 1 }));
  },
};

/**
 * Read (and clear) whether the sidebar's current open was asked for explicitly — a "/" press
 * or the collapsed rail's icon button — as opposed to an ordinary click on Workspace/the rail
 * toggle, or (on mobile) the sheet just opening on its own. `WorkspaceSearch` reads this once,
 * at mount, to tell its own explicit request apart from Radix's sheet-open auto-focus, which
 * would otherwise land in the first tabbable element — this input — instead of where main put
 * it (s6).
 */
export function consumeExplicitOpen(): boolean {
  const value = openedExplicitly;
  openedExplicitly = false;
  return value;
}
