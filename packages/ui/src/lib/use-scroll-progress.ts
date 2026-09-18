"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * The motion gate (`packages/tokens/src/themes.css`, MOTION GATE) sets `--motion-factor` to
 * 0.0001 under a reduce request and 1 otherwise. Anything at or below this floor is "motion off".
 */
export const MOTION_FACTOR_FLOOR = 0.01;

/** `--motion-factor` as seen by `el` (default: the document root); 1 when unset or on the server. */
export function readMotionFactor(el?: Element | null): number {
  if (typeof window === "undefined") return 1;
  const target = el ?? document.documentElement;
  const value = Number.parseFloat(getComputedStyle(target).getPropertyValue("--motion-factor"));
  return Number.isFinite(value) ? value : 1;
}

/** True when the factor sits at the floor — the reader asked for reduced motion. */
export function isMotionAtFloor(factor: number): boolean {
  return factor <= MOTION_FACTOR_FLOOR;
}

/** True when the browser runs scroll-driven CSS animations (`animation-timeline: scroll()`). */
export function supportsScrollTimeline(): boolean {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("animation-timeline: scroll()")
  );
}

/**
 * How root scroll progress is delivered:
 * - `static` — server render, before hydration, motion at the floor, or disabled: nothing moves.
 * - `timeline` — the browser runs `animation-timeline: scroll()`; the caller's CSS does the work
 *   on the compositor and no JavaScript listens to scroll.
 * - `script` — no scroll timelines: `motion`'s `scroll()` (an optional peer, imported lazily
 *   only here) calls `onScroll` every frame.
 */
export type ScrollProgressMode = "static" | "timeline" | "script";

export interface ScrollProgressOptions {
  /** Skip all work (e.g. a plane whose rate means it never moves). Default `true`. */
  enabled?: boolean;
  /** Read `--motion-factor` from this element (so a subtree can dial motion); default the root. */
  target?: RefObject<Element | null>;
}

export interface ScrollProgress {
  mode: ScrollProgressMode;
  /** `--motion-factor` read once after mount (1 before hydration). */
  factor: number;
}

/**
 * Root scroll progress under the motion gate. The factor is read once, after hydration, so the
 * server HTML and the first client render are identical (`static`). `onScroll(scrollY, progress)`
 * fires only in `script` mode; it may change between renders without resubscribing.
 */
export function useScrollProgress(
  onScroll?: (scrollY: number, progress: number) => void,
  { enabled = true, target }: ScrollProgressOptions = {},
): ScrollProgress {
  const [state, setState] = useState<ScrollProgress>({ mode: "static", factor: 1 });
  const onScrollRef = useRef(onScroll);

  useEffect(() => {
    onScrollRef.current = onScroll;
  });

  useEffect(() => {
    const factor = readMotionFactor(target?.current);
    if (!enabled || isMotionAtFloor(factor)) {
      setState({ mode: "static", factor });
      return;
    }
    if (supportsScrollTimeline()) {
      setState({ mode: "timeline", factor });
      return;
    }
    setState({ mode: "script", factor });
    let cancelled = false;
    let stop: (() => void) | undefined;
    import("motion")
      .then(({ scroll }) => {
        if (cancelled) return;
        stop = scroll((progress: number, info) => {
          onScrollRef.current?.(info.y.current, progress);
        });
      })
      .catch(() => {
        // `motion` is an optional peer: without it the page simply does not move.
        if (!cancelled) setState({ mode: "static", factor });
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [enabled, target]);

  return state;
}
