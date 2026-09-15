import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;

function subscribe(breakpoint: number, onStoreChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

function getSnapshot(breakpoint: number) {
  return window.innerWidth < breakpoint;
}

// SSR / first-paint snapshot: no viewport to measure yet, so report "not
// mobile" rather than guessing — this must match what the server rendered to
// avoid a hydration mismatch, and useSyncExternalStore re-syncs to the real
// value on the client before paint (no desktop-layout flash).
function getServerSnapshot() {
  return false;
}

/**
 * Returns true when the viewport is below `breakpoint` (default 768px, the
 * mobile breakpoint). Additive optional argument (ADR 0035 §5) — every
 * existing zero-arg call site is unchanged. A caller with its own threshold
 * (e.g. `ContextRail`'s `overlayBreakpoint`) passes it directly instead of a
 * second hook.
 */
export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT): boolean {
  return useSyncExternalStore(
    (onStoreChange) => subscribe(breakpoint, onStoreChange),
    () => getSnapshot(breakpoint),
    getServerSnapshot,
  );
}
