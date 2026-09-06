import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Returns true when the viewport is below `breakpoint` (default 768px, the
 * mobile breakpoint). Additive optional argument (ADR 0035 §5) — every
 * existing zero-arg call site is unchanged. A caller with its own threshold
 * (e.g. `ContextRail`'s `overlayBreakpoint`) passes it directly instead of a
 * second hook.
 */
export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < breakpoint);
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < breakpoint);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);
  return !!isMobile;
}
