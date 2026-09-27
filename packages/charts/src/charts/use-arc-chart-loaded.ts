"use client";

import type { Transition } from "motion/react";
import { useEffect, useState } from "react";

/**
 * The one-frame-late "loaded" gate `PieChart` and `RingChart` use before
 * their entrance animation plays: `false` until 100ms after mount, so slice/
 * ring shapes paint at rest before Motion morphs them in — never mid-enter
 * from a zero-length path. Re-arms whenever `enterTransition`/
 * `enterStaggerScale` changes (a replay), and again whenever
 * `geometryScrubbing` toggles. `geometryScrubbing` itself bypasses the
 * timer: a studio scrub wants the exact, immediate path every render, never
 * the enter gate.
 */
export function useArcChartLoaded(
  enterTransition: Transition | undefined,
  enterStaggerScale: number,
  geometryScrubbing: boolean,
): boolean {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (geometryScrubbing) {
      return;
    }
    setIsLoaded(false);
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [enterTransition, enterStaggerScale, geometryScrubbing]);

  return geometryScrubbing || isLoaded;
}
