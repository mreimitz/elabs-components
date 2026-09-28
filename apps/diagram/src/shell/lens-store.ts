/** A reversible viewer-only lens tween. Target locks edits immediately; position controls the
 * shared-camera morph. URL replacement preserves sharing without rerendering the shell. */
import { useSyncExternalStore } from "react";
import { prefersReducedMotion } from "../motion";
import { createStore } from "../state/create-store";
import { hashWithLens, isVisualLensHash } from "../interaction/lens-mode";

export type Lens = "technical" | "visual";

/** Normal-motion choreography duration. */
const DURATION_MS = 700;
/** Reduced motion: a short cross-fade, no movement (style-system concept §7). */
const REDUCED_DURATION_MS = 200;

interface LensState {
  /** The settled lens: meaningful once `position` has reached 0 or 1 and stopped. */
  lens: Lens;
  /** 0 = technical, 1 = visual — the live tween. */
  position: number;
  target: Lens;
  animating: boolean;
  /** Orientation (concept §5): technical node ids to frame once the technical pane shows,
   * from a box's ⌥-click in the visual lens. Consumed once by `canvas-pane.tsx`. */
  frameNodeIds: string[] | null;
  frameKey: number;
}

function lensFromHash(): Lens {
  return isVisualLensHash(window.location.hash) ? "visual" : "technical";
}

const initial = lensFromHash();

export const lensStore = createStore<LensState>({
  lens: initial,
  position: initial === "visual" ? 1 : 0,
  target: initial,
  animating: false,
  frameNodeIds: null,
  frameKey: 0,
});

export function useLens<T>(select: (state: LensState) => T): T {
  return useSyncExternalStore(lensStore.subscribe, () => select(lensStore.get()));
}

let rafId = 0;

/** A stalled frame (a long task elsewhere on the main thread) must not jump the tween by
 * however long the stall was: cap the elapsed time charged to any one frame at twice a normal
 * 60fps frame, so a stall costs one visibly larger step, never a double-digit percent jump in
 * `position`. */
const MAX_FRAME_MS = (1000 / 60) * 2;

function tick(now: number, last: number) {
  const state = lensStore.get();
  const targetPosition = state.target === "visual" ? 1 : 0;
  const duration = prefersReducedMotion() ? REDUCED_DURATION_MS : DURATION_MS;
  const step = Math.min(now - last, MAX_FRAME_MS) / duration;
  const position =
    targetPosition > state.position
      ? Math.min(targetPosition, state.position + step)
      : Math.max(targetPosition, state.position - step);
  const settled = position === targetPosition;
  lensStore.set({ position, animating: !settled, ...(settled ? { lens: state.target } : {}) });
  if (settled) {
    rafId = 0;
    return;
  }
  rafId = requestAnimationFrame((t) => tick(t, now));
}

let preparing = false;
let transitionGeneration = 0;
let prepareTransition: (() => Promise<boolean>) | null = null;

/** The mounted canvas prepares both current layouts before the animation clock starts. */
export function registerLensPreparation(prepare: () => Promise<boolean>): () => void {
  prepareTransition = prepare;
  return () => {
    if (prepareTransition === prepare) prepareTransition = null;
  };
}

function ensureAnimating() {
  if (rafId || preparing) return;
  preparing = true;
  const generation = transitionGeneration;
  lensStore.set({ animating: true });
  const prepared = prepareTransition?.() ?? Promise.resolve(false);
  void prepared
    .catch(() => false)
    .then((ready) => {
      if (generation !== transitionGeneration) return;
      preparing = false;
      const state = lensStore.get();
      const endpoint = state.target === "visual" ? 1 : 0;
      if (!ready || state.position === endpoint) {
        lensStore.set({ position: endpoint, lens: state.target, animating: false });
        return;
      }
      rafId = requestAnimationFrame((time) => tick(time, time));
    });
}

export const lensActions = {
  /** Geometry belongs to one document. Discard its preparation and tween on navigation. */
  settleForDocument() {
    transitionGeneration++;
    cancelAnimationFrame(rafId);
    rafId = 0;
    preparing = false;
    const next = lensFromHash();
    lensStore.set({
      lens: next,
      target: next,
      position: next === "visual" ? 1 : 0,
      animating: false,
      frameNodeIds: null,
    });
  },
  /**
   * Switch lenses. `frameNodeIds` is the orientation drill-down (concept §5): the technical
   * node ids `canvas-pane.tsx` frames once its pane shows again.
   */
  setLens(next: Lens, options: { frameNodeIds?: string[] } = {}) {
    const { frameKey } = lensStore.get();
    lensStore.set({
      target: next,
      frameNodeIds: options.frameNodeIds ?? null,
      frameKey: options.frameNodeIds ? frameKey + 1 : frameKey,
    });
    ensureAnimating();
    // Avoid hashchange and its full-shell render in the first moving frame.
    const hash = hashWithLens(window.location.hash, next === "visual");
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}${hash}`,
    );
  },
  toggle() {
    lensActions.setLens(lensStore.get().target === "visual" ? "technical" : "visual");
  },
};

if (typeof window !== "undefined") {
  // Back/forward, a shared link, or any other `navigate()` call that rewrites the hash
  // without a `lens=` part (`lens-mode.ts`'s header note): the lens follows the URL either way.
  window.addEventListener("hashchange", () => {
    const next = lensFromHash();
    if (lensStore.get().target !== next) {
      lensStore.set({ target: next });
      ensureAnimating();
    }
  });
}
