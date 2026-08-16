"use client";

/**
 * useHighDecoration — is the chart rendered in a high-`--decoration` region
 * (any `data-decoration` 8–10 subtree)? Issue #164 / ADR 0011.
 *
 * SVG `fill="url(#pattern)"` cannot be driven from CSS the way the decoration hatch
 * overlay (`decoration.css`) is — a `<pattern>` def must exist in the SVG and the
 * element's `fill` attribute must reference it. So, uniquely among the decoration
 * features, charts must participate in JS. This hook is that signal.
 *
 * Detection reads the registered `@property --decoration` custom property off the
 * chart container via `getComputedStyle` (it inherits, so a theme block or an
 * ancestor `data-decoration="N"` both reach it). This works with NO
 * `ThemeProvider`/`DecorationProvider` — a bare `<BarChart>` inside a decorated
 * region is covered. SSR-safe: the ref is null on the server, so
 * it returns `false` (color) and the first client paint matches (no hydration
 * mismatch); `useLayoutEffect` then flips to pattern pre-paint (no color flash).
 */

import { type RefObject, useLayoutEffect, useState } from "react";
import { useChartStable } from "./chart-context";

/** High decoration begins at level 8 (matches `decoration.css` binary switches). */
const HIGH_DECORATION_THRESHOLD = 8;

/** Read `--decoration` off `el` and decide if it's high. */
function readHigh(el: Element | null): boolean {
  if (!el || typeof window === "undefined") return false;
  const raw = window.getComputedStyle(el).getPropertyValue("--decoration");
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value >= HIGH_DECORATION_THRESHOLD;
}

/**
 * Reusable core: is the element `ref` in a high-decoration region? Re-reads when
 * `data-theme`/`data-decoration` change at the document root (covers the Storybook
 * theme toolbar and runtime theme switches).
 */
export function useHighDecorationOf(ref: RefObject<Element | null>): boolean {
  const [high, setHigh] = useState(false);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    const update = () => {
      const el = ref.current;
      if (!el) {
        // The ref may be populated by a PARENT callback ref that fires AFTER this
        // child effect (React commit order) — e.g. a fixed-size chart's outer
        // container. Read a PROVISIONAL value from the theme root so the first
        // paint is already correct in the common global-theme case (#289 — the
        // one-frame deferral flashed solid fills on fixed-size decorated charts
        // and raced synchronous story assertions); `--decoration` inherits, so
        // the root equals the container unless a region override sits between.
        // Then retry on the next frame until the ref attaches, which refines
        // region-scoped overrides. SSR/unmount → cancelled.
        setHigh(readHigh(document.documentElement));
        raf = requestAnimationFrame(update);
        return;
      }
      setHigh(readHigh(el));
    };
    update();
    const observer = new MutationObserver(() => {
      const el = ref.current;
      if (el) setHigh(readHigh(el));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-decoration", "class", "style"],
    });
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [ref]);

  return high;
}

/** Chart-context variant: detects high decoration on the chart container. */
export function useHighDecoration(): boolean {
  const { containerRef } = useChartStable();
  return useHighDecorationOf(containerRef);
}
