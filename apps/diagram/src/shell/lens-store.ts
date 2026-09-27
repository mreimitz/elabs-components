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
 * toggle) reverses smoothly instead of restarting or jumping. `src/panes/canvas-pane.tsx`
 * reads `position` to cross-fade the two panes; see that file and
 * `docs/findings/lens-switch-slice.md` for exactly what this transition does and does not do
 * (a crossfade with each side pre-fitted to its own bounds, not a full shared-camera morph).
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

function tick(now: number, last: number) {
  const state = lensStore.get();
  const targetPosition = state.target === "visual" ? 1 : 0;
  const duration = prefersReducedMotion() ? REDUCED_DURATION_MS : DURATION_MS;
  const step = (now - last) / duration;
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

function ensureAnimating() {
  if (rafId) return;
  lensStore.set({ animating: true });
  rafId = requestAnimationFrame((t) => tick(t, t));
}

export const lensActions = {
  /**
   * Switch lenses. `frameNodeIds` is the orientation drill-down (concept §5): the technical
   * node ids `canvas-pane.tsx` frames once its pane shows again.
   */
  setLens(next: Lens, options: { frameNodeIds?: string[] } = {}) {
    window.location.hash = hashWithLens(window.location.hash, next === "visual");
    const { frameKey } = lensStore.get();
    lensStore.set({
      target: next,
      frameNodeIds: options.frameNodeIds ?? null,
      frameKey: options.frameNodeIds ? frameKey + 1 : frameKey,
    });
    ensureAnimating();
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
