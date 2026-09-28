/**
 * Whether the open document's canvas has a settled layout. ELK lays a diagram out
 * asynchronously (`layout/use-diagram-layout.ts`), and the fit that centres the result runs a
 * render behind that; a thumbnail (`workspace/use-autosave.ts`) captured before both land shows
 * the canvas mid-relayout. `panes/canvas-pane.tsx` is the only writer, the moment its own
 * `status` from `useDiagramLayout` reaches `"ready"`; `use-autosave.ts` is the only reader,
 * tracked by document path so a stale answer for a document no longer open never gates a
 * different one's thumbnail.
 */
import { createStore } from "../state/create-store";

interface LayoutReadyState {
  path: string | null;
  ready: boolean;
}

const layoutReadyStore = createStore<LayoutReadyState>({ path: null, ready: false });

export const layoutReadyActions = {
  setReady(path: string | null, ready: boolean) {
    const current = layoutReadyStore.get();
    if (current.path === path && current.ready === ready) return;
    layoutReadyStore.set({ path, ready });
  },
};

/** How long to wait for `path`'s layout before giving up without capturing. */
const LAYOUT_READY_TIMEOUT_MS = 4000;

/**
 * Resolves once `path`'s layout is ready — immediately if it already is, or after
 * `LAYOUT_READY_TIMEOUT_MS` with false (a layout error, or a pane that never mounted,
 * must not hang a thumbnail forever or publish an unsettled canvas).
 */
export function whenLayoutReady(path: string): Promise<boolean> {
  const current = layoutReadyStore.get();
  if (current.path === path && current.ready) return Promise.resolve(true);
  return new Promise((resolve) => {
    let unsubscribe = () => {};
    const timeout = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, LAYOUT_READY_TIMEOUT_MS);
    unsubscribe = layoutReadyStore.subscribe(() => {
      const state = layoutReadyStore.get();
      if (state.path !== path || !state.ready) return;
      clearTimeout(timeout);
      unsubscribe();
      resolve(true);
    });
  });
}
