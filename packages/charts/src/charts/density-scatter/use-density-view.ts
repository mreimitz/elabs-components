"use client";

/**
 * density-scatter/use-density-view.ts — the zoom/pan window of a cartesian plot.
 *
 * One view box in DATA units, controlled or uncontrolled. Wheel zoom is
 * anchored at the cursor and EASED: centre and (log) scale glide toward the
 * target with one shared factor, so the four edges never move at different
 * rates and the picture scales uniformly — an earlier per-edge interpolation
 * visibly sheared. Successive wheel notches chain off the in-flight target,
 * not the eased view, so the point under the cursor stays put across a whole
 * gesture. Reduced motion jumps straight to the target.
 *
 * Kept separate from the chart so a second cartesian family can adopt it.
 */

import { useCallback, useEffect, useRef } from "react";
import { useControllableState } from "@elabs-ai/components-ui";
import type { DensityPlotBox, DensityView } from "./types";

export interface UseDensityViewOptions {
  /** The full-data window (what "reset" returns to). */
  home: DensityView;
  /** Controlled window. */
  view?: DensityView;
  defaultView?: DensityView;
  onViewChange?: (view: DensityView) => void;
  /** Smallest x span the window may reach, as a fraction of `home`'s span. Default `1e-4`. */
  minSpanFraction?: number;
  /** Largest x span, as a multiple of `home`'s span. Default `10`. */
  maxSpanFactor?: number;
}

export interface UseDensityViewResult {
  view: DensityView;
  /** Whether the window differs from `home`. */
  isZoomed: boolean;
  /** Ease toward a window (or jump, under reduced motion). */
  animateTo: (next: DensityView) => void;
  /** Set immediately (a pan frame). */
  set: (next: DensityView) => void;
  reset: () => void;
  /** Zoom by `factor` (>1 out, <1 in) around a CSS-pixel anchor inside `box`. */
  zoomAt: (factor: number, px: number, py: number, box: DensityPlotBox) => void;
  /** The view a pan of `(dx, dy)` CSS pixels from `from` produces. */
  panned: (from: DensityView, dx: number, dy: number, box: DensityPlotBox) => DensityView;
  /** CSS px → data units inside `box`, against the CURRENT view. */
  toData: (px: number, py: number, box: DensityPlotBox) => [number, number];
  /** Data units → CSS px inside `box`, against the CURRENT view. */
  toPixel: (x: number, y: number, box: DensityPlotBox) => [number, number];
}

const EASE = 0.3;

function sameView(a: DensityView, b: DensityView): boolean {
  return a.x0 === b.x0 && a.x1 === b.x1 && a.y0 === b.y0 && a.y1 === b.y1;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

export function useDensityView(options: UseDensityViewOptions): UseDensityViewResult {
  const {
    home,
    view: viewProp,
    defaultView,
    onViewChange,
    minSpanFraction = 1e-4,
    maxSpanFactor = 10,
  } = options;
  const [view, commitView] = useControllableState<DensityView>(
    viewProp,
    defaultView ?? home,
    onViewChange,
  );
  const viewRef = useRef(view);
  viewRef.current = view;
  const targetRef = useRef<DensityView | null>(null);
  const rafRef = useRef(0);

  const commit = useCallback((next: DensityView) => commitView(next), [commitView]);

  const step = useCallback(() => {
    rafRef.current = 0;
    const target = targetRef.current;
    if (!target) return;
    const v = viewRef.current;
    const vcx = (v.x0 + v.x1) / 2;
    const vcy = (v.y0 + v.y1) / 2;
    const vlx = Math.log(v.x1 - v.x0);
    const vly = Math.log(v.y1 - v.y0);
    const tcx = (target.x0 + target.x1) / 2;
    const tcy = (target.y0 + target.y1) / 2;
    const tlx = Math.log(target.x1 - target.x0);
    const tly = Math.log(target.y1 - target.y0);
    const close =
      Math.abs(tlx - vlx) < 0.002 &&
      Math.abs(tcx - vcx) < 0.001 * (target.x1 - target.x0) &&
      Math.abs(tcy - vcy) < 0.001 * (target.y1 - target.y0);
    if (close) {
      targetRef.current = null;
      commit(target);
      return;
    }
    const ncx = vcx + (tcx - vcx) * EASE;
    const ncy = vcy + (tcy - vcy) * EASE;
    const nsx = Math.exp(vlx + (tlx - vlx) * EASE);
    const nsy = Math.exp(vly + (tly - vly) * EASE);
    const next = { x0: ncx - nsx / 2, x1: ncx + nsx / 2, y0: ncy - nsy / 2, y1: ncy + nsy / 2 };
    viewRef.current = next;
    commit(next);
    rafRef.current = requestAnimationFrame(step);
  }, [commit]);

  const animateTo = useCallback(
    (next: DensityView) => {
      if (prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
        targetRef.current = null;
        commit(next);
        return;
      }
      targetRef.current = next;
      if (!rafRef.current) rafRef.current = requestAnimationFrame(step);
    },
    [commit, step],
  );

  const set = useCallback(
    (next: DensityView) => {
      targetRef.current = null;
      viewRef.current = next;
      commit(next);
    },
    [commit],
  );

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // A new home (the data's extent changed — a selection, a reload) re-homes an
  // uncontrolled window, as the native charts do; a zoom into the old extent
  // would otherwise leave the new data off-screen or lost in empty space.
  const homeKey = `${home.x0}|${home.x1}|${home.y0}|${home.y1}`;
  const lastHome = useRef(homeKey);
  useEffect(() => {
    if (homeKey === lastHome.current) return;
    lastHome.current = homeKey;
    if (viewProp === undefined) {
      targetRef.current = null;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      viewRef.current = home;
      commit(home);
    }
  }, [homeKey, home, viewProp, commit]);

  const toData = useCallback((px: number, py: number, box: DensityPlotBox): [number, number] => {
    const v = viewRef.current;
    return [
      v.x0 + ((px - box.left) / box.width) * (v.x1 - v.x0),
      v.y1 - ((py - box.top) / box.height) * (v.y1 - v.y0),
    ];
  }, []);
  const toPixel = useCallback((x: number, y: number, box: DensityPlotBox): [number, number] => {
    const v = viewRef.current;
    return [
      box.left + ((x - v.x0) / (v.x1 - v.x0)) * box.width,
      box.top + ((v.y1 - y) / (v.y1 - v.y0)) * box.height,
    ];
  }, []);

  const zoomAt = useCallback(
    (factor: number, px: number, py: number, box: DensityPlotBox) => {
      const base = targetRef.current ?? viewRef.current;
      const homeSpan = home.x1 - home.x0;
      const spanX = (base.x1 - base.x0) * factor;
      const spanY = (base.y1 - base.y0) * factor;
      if (spanX < homeSpan * minSpanFraction || spanX > homeSpan * maxSpanFactor) return;
      const dx = base.x0 + ((px - box.left) / box.width) * (base.x1 - base.x0);
      const dy = base.y1 - ((py - box.top) / box.height) * (base.y1 - base.y0);
      const fx = (dx - base.x0) / (base.x1 - base.x0);
      const fy = (dy - base.y0) / (base.y1 - base.y0);
      animateTo({
        x0: dx - fx * spanX,
        x1: dx + (1 - fx) * spanX,
        y0: dy - fy * spanY,
        y1: dy + (1 - fy) * spanY,
      });
    },
    [animateTo, home, minSpanFraction, maxSpanFactor],
  );

  const panned = useCallback(
    (from: DensityView, dx: number, dy: number, box: DensityPlotBox): DensityView => {
      const ddx = (dx / box.width) * (from.x1 - from.x0);
      const ddy = (dy / box.height) * (from.y1 - from.y0);
      return { x0: from.x0 - ddx, x1: from.x1 - ddx, y0: from.y0 + ddy, y1: from.y1 + ddy };
    },
    [],
  );

  const reset = useCallback(() => animateTo(home), [animateTo, home]);

  return {
    view,
    isZoomed: !sameView(view, home),
    animateTo,
    set,
    reset,
    zoomAt,
    panned,
    toData,
    toPixel,
  };
}
