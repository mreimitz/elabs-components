/**
 * Sidebar search (maintainer request 2026-09-28: "also add a search box in the left side main
 * nav panel below the home button and before the workspaces start. it should search and filter
 * the entire workspace") — the search box's own state: the query text (read by both the rail's
 * input and the `WorkspaceTree` it filters, so it lives here rather than in either), and a
 * "focus me" request the "/" shortcut (`keymap.ts`) and the collapsed icon rail's button
 * (`workspace-search.tsx`) can make from outside the input itself. React-free except the hooks.
 *
 * Opening the sidebar/sheet for that request is an EVENT, not state a component watches:
 * `registerSearchOpener` lets `SearchSidebarBridge` (the one component that can actually call
 * `useSidebar()`'s `setOpen`/`setOpenMobile`) hand over a function once, which `requestFocus()`
 * then calls directly — no counter for it to bump, no effect to react to the bump, no
 * `react-hooks/exhaustive-deps` suppression for deliberately not re-running on every render.
 * `focusToken` remains for the one thing that DOES need a component to react to a request after
 * the fact: focusing the input once it is actually on screen (`WorkspaceSearch`).
 */
import { useSyncExternalStore } from "react";
import { createStore } from "../state/create-store";
import { activateSearchIndex } from "../workspace/search-index";

interface SearchState {
  query: string;
  /** Bumped to ask for the sidebar/sheet to open (if it is not already) and the input to focus.
   * A counter, not a boolean, so asking twice in a row still re-triggers the effect that serves
   * it even if nothing else about the state changed. The always-mounted
   * `SearchSidebarBridge` (`workspace-search.tsx`) reacts to every bump; `WorkspaceSearch`
   * itself only ever acts on a token NEWER than the one it last saw (a ref set at mount), so a
   * remount (the mobile sheet does this on every close) never replays a request from before it
   * mounted. */
  focusToken: number;
}

const searchStore = createStore<SearchState>({ query: "", focusToken: 0 });

// Module-level (not component state): true from `requestFocus()` until something actually
// serves the request (opens the sidebar/sheet if needed, then focuses the input). Survives
// `WorkspaceSearch` unmounting and remounting, which the mobile sheet does on every open/close,
// so a "/" press with the sheet closed is still served once it opens, rather than lost.
let pendingFocus = false;

/** Opens the sidebar (desktop) or the sheet (mobile) — registered once by `SearchSidebarBridge`,
 * the always-mounted component inside `SidebarProvider` that can call `useSidebar()`. `null`
 * before that component has ever mounted, in which case `requestFocus()` has nothing to open yet
 * but the bumped `focusToken` still reaches `WorkspaceSearch` once it does. */
let opener: (() => void) | null = null;

/** Register the function that opens the sidebar/sheet; returns the unregister (called on
 * unmount). A later registration replaces an earlier one; unregistering a stale one (already
 * replaced) is a no-op. */
export function registerSearchOpener(open: () => void): () => void {
  opener = open;
  return () => {
    if (opener === open) opener = null;
  };
}

/** The live query (`""` when the box is empty — the tree then shows everything, unfiltered). */
export function useSearchQuery(): string {
  return useSyncExternalStore(searchStore.subscribe, () => searchStore.get().query);
}

export function useSearchFocusToken(): number {
  return useSyncExternalStore(searchStore.subscribe, () => searchStore.get().focusToken);
}

export const searchActions = {
  setQuery(query: string) {
    // Lazy: the index is built on the first real search, not on every app load.
    if (query !== "") activateSearchIndex();
    searchStore.set({ query });
  },
  clear() {
    searchStore.set({ query: "" });
  },
  /** Ask for the sidebar (or the mobile sheet) to open if it is not already, and the input to
   * focus once it is on screen. */
  requestFocus() {
    activateSearchIndex();
    pendingFocus = true;
    opener?.();
    searchStore.set((s) => ({ focusToken: s.focusToken + 1 }));
  },
};

/**
 * Read and clear whether a focus request is still waiting to be served — called exactly once,
 * by whichever `WorkspaceSearch` render actually focuses the input (at mount, when it mounts
 * because a request just opened the sidebar/sheet, or later while already mounted, when a new
 * request arrives on desktop or an already-open mobile sheet). Reading it on every platform,
 * every time, is what keeps a request from lingering past the open it was meant for.
 */
export function consumePendingFocus(): boolean {
  const value = pendingFocus;
  pendingFocus = false;
  return value;
}

/** Whether `query` should narrow the tree — trimmed, so a whitespace-only query behaves like an
 * empty one everywhere (the rail's forced-open Workspace section, the tree's own filtering),
 * rather than in the tree only. */
export function isFiltering(query: string): boolean {
  return query.trim() !== "";
}
