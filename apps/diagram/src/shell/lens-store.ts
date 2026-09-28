/**
 * The lens switch's state (maintainer 2026-09-27, "the switch from technical to visual"):
 * `technical` (today's diagram) or `visual` (the derived lens, `src/visual/`). View-only —
 * nothing here ever touches `diagram-store`/`workspace-store`, so switching lenses can never
 * write the file, mark it dirty or enter undo (the hard requirement this task starts from: a
 * previous feature leaked a viewer-only view into the saved file).
 *
 * `position` is the transition's one scrubbable tween value, 0 (technical) .. 1 (visual) —
 * `docs/2026-09-27-style-system-concept.md` §7's "single tween `t`, so a mid-flight reverse is
 * continuous": `setLens` only ever changes `target` and lets `position` keep moving from
 * wherever it already is, at a constant rate, so calling it twice in a row (a fast double
 * toggle) reverses smoothly instead of restarting or jumping. `src/panes/canvas-pane.tsx` reads
 * `position` to drive the morph (`lens-morph-overlay.tsx`) and the cross-fade; see those files
 * and `docs/findings/lens-switch-slice.md` for exactly what this transition does and does not
 * do.
 *
 * `setLens` writes the URL with `history.replaceState`, not a `location.hash` assignment: the
 * latter fires `hashchange`, which `routes/use-hash.ts` turns into a full shell re-render (the
 * hash string itself changed, so every `useRoute()`/`useHash()` consumer re-renders even though
 * `parseRoute` ignores `lens=`), landing squarely inside the tween's first frame and stalling
 * it. `replaceState` updates `location.hash` (so a copied link, or a fresh `lensFromHash()` read
 * on reload, still sees it) without dispatching `hashchange` or `popstate`, so a lens switch
 * costs the tween nothing. External hash changes (back/forward, a shared link, any other
 * `navigate()` call) still go through the `hashchange` listener below.
 */
import { useSyncExternalStore } from "react";
import { prefersReducedMotion } from "../motion";
import { createStore } from "../state/create-store";
import { hashWithLens, isVisualLensHash } from "../interaction/lens-mode";

export type Lens = "technical" | "visual";

/** S10's normal-motion duration (the concept's own 700 ms, not the app's token scale — see
 * `motion.ts`'s "one scale" note; this is the one deliberate, documented exception, because
 * the maintainer specified this exact number for this exact signature move). */
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
  lensStore.set({ animating: true });
  const prepared = prepareTransition?.() ?? Promise.resolve(false);
  void prepared
    .catch(() => false)
    .then((ready) => {
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
    // `replaceState`, not a `location.hash` assignment (see the header comment above): the
    // URL still ends up carrying `lens=` for a copied link or a reload, but the write itself
    // never dispatches `hashchange`, so it costs the tween nothing — no shell re-render shares
    // the frame this starts animating on.
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
