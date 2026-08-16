"use client";

/**
 * useResolvedRadius — the active theme's `--radius` token resolved to a px NUMBER
 * for SVG geometry (bar `rx`/`ry`). Issue #165.
 *
 * Chart color theming works because SVG paint accepts `var(--…)` strings, but SVG
 * `rx`/`ry` need a NUMBER — so bar corners were stuck at a hardcoded literal and
 * never squared in blueprint / high-decoration like the rest of the themed UI.
 *
 * `--radius` is `calc(var(--radius-base) * (1 - var(--decoration-factor)))` and is
 * NOT a registered `@property`, so `getComputedStyle(el).getPropertyValue("--radius")`
 * returns the UNEVALUATED `calc(...)` string (parseFloat → NaN). We instead resolve
 * it through a real length property on a hidden probe element placed in the chart's
 * own inheritance context (theme + `data-decoration` region), so the browser
 * evaluates the calc to px for us. Re-resolves on theme/decoration change.
 *
 * SSR-safe: returns `DEFAULT_RADIUS_PX` until the container is attached client-side.
 */

import { type RefObject, useLayoutEffect, useState } from "react";
import { useChartStable } from "./chart-context";

/** Fallback ≈ `--radius-base` (0.25rem) before the DOM is measurable. */
const DEFAULT_RADIUS_PX = 4;

/** Resolve `var(--radius)` to px in `host`'s inheritance context via a probe. */
function resolveRadiusPx(host: Element | null): number {
  if (!host || typeof window === "undefined" || typeof document === "undefined") {
    return DEFAULT_RADIUS_PX;
  }
  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.height = "0";
  // A real length property forces the browser to EVALUATE the calc() to px.
  probe.style.width = "var(--radius)";
  host.appendChild(probe);
  const px = Number.parseFloat(window.getComputedStyle(probe).width);
  probe.remove();
  return Number.isFinite(px) ? px : DEFAULT_RADIUS_PX;
}

/** Reusable core: resolve `--radius` to px for the element `ref`. */
export function useResolvedRadiusOf(ref: RefObject<Element | null>): number {
  const [radius, setRadius] = useState(DEFAULT_RADIUS_PX);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    const update = () => {
      const el = ref.current;
      if (!el) {
        // Parent callback refs (e.g. PieChart's container) populate AFTER child
        // effects — retry next frame until attached. Mirrors useHighDecoration.
        raf = requestAnimationFrame(update);
        return;
      }
      setRadius(resolveRadiusPx(el));
    };
    update();
    const observer = new MutationObserver(() => {
      const el = ref.current;
      if (el) setRadius(resolveRadiusPx(el));
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

  return radius;
}

/** Chart-context variant: resolves `--radius` on the chart container. */
export function useResolvedRadius(): number {
  const { containerRef } = useChartStable();
  return useResolvedRadiusOf(containerRef);
}
