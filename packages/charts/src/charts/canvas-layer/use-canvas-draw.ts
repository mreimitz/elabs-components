"use client";

/**
 * use-canvas-draw.ts — the draw loop behind `CanvasLayer` (RM-046).
 *
 * Owns the four things a canvas gets wrong when they are written inline in a
 * component, and which interact:
 *
 * 1. **Device pixel ratio.** The backing store is `size × dpr` device pixels
 *    while the element stays `size` CSS pixels, and the context is transformed
 *    once so every draw callback works in CSS pixels. A canvas that skips this
 *    is soft on every retina display; one that skips the transform makes every
 *    consumer multiply by `dpr` by hand. `dpr` is also passed to `draw` so a
 *    callback that genuinely needs it (hairlines, text hinting) has it.
 * 2. **Resize.** Assigning `canvas.width`/`height` CLEARS the surface, so the
 *    resize and the redraw are one operation, not two, and the assignment is
 *    skipped when the size is unchanged (a redraw on theme change must not
 *    flash the canvas empty).
 * 3. **Theme change.** Canvas pixels are not styled by CSS: a `data-theme`
 *    flip repaints every DOM mark for free and leaves a canvas showing the old
 *    theme's colours until something redraws it. One attribute observer covers
 *    this — WITHOUT remounting the element (see `CanvasLayer`'s test, which
 *    asserts canvas identity is stable across a theme toggle, because a remount
 *    would discard scroll/zoom state and re-run every enter animation).
 * 4. **Reduced motion.** A draw-in ramp is motion. Under
 *    `prefers-reduced-motion: reduce` the ramp does not run at all — `progress`
 *    starts and stays at `1`, so the layer paints its final state immediately
 *    (see `.claude/rules/quality-gates.md` — "Motion-tokened").
 *
 * Colours belong to the CALLER's `draw`, read through `canvasTokenColor` so the
 * layer stays token-driven (`.claude/rules/styling-and-tokens.md` — no raw hex
 * outside `themes.css`). The hook only guarantees that a redraw HAPPENS when
 * the tokens under the element could have changed.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { resolveTokenColor } from "@elabs-ai/components-tokens";
import type { Margin } from "../chart-context";

/**
 * The plot geometry handed to a canvas `draw` callback, in **CSS pixels** (the
 * context is already `dpr`-transformed, so a callback never multiplies).
 *
 * It is deliberately geometry + progress, not d3 scale objects: a canvas view
 * owns its own scales (band, time, linear — often several), and threading them
 * through a shared type would force every consumer onto one scale vocabulary.
 * Build scales from `innerWidth`/`innerHeight` in the consumer and close over
 * them in `draw`.
 */
export interface ChartScales {
  /** Full layer width in CSS pixels. */
  width: number;
  /** Full layer height in CSS pixels. */
  height: number;
  /** Plot insets. */
  margin: Margin;
  /** `width` minus horizontal margins, floored at 0. */
  innerWidth: number;
  /** `height` minus vertical margins, floored at 0. */
  innerHeight: number;
  /**
   * Draw-in ramp, `0`–`1`. Always exactly `1` when `animateIn` is off or
   * `prefers-reduced-motion: reduce` is set — a reduced-motion user sees the
   * final frame, never a staggered build-up.
   */
  progress: number;
}

/** The zero margin — a bare mark layer fills its box. */
export const CANVAS_LAYER_DEFAULT_MARGIN: Margin = { top: 0, right: 0, bottom: 0, left: 0 };

/** Default draw-in duration when `animateIn` is on, in ms. */
export const CANVAS_LAYER_ENTER_MS = 480;

export interface UseCanvasDrawOptions {
  /** Layer width in CSS pixels. A non-positive width draws nothing. */
  width: number;
  /** Layer height in CSS pixels. A non-positive height draws nothing. */
  height: number;
  /** Paints one frame. Receives a `dpr`-transformed, already-cleared context. */
  draw: (ctx: CanvasRenderingContext2D, scales: ChartScales, dpr: number) => void;
  /** Plot insets. Defaults to zero on every side. */
  margin?: Partial<Margin>;
  /**
   * Opaque string that changes when the DATA behind `draw` changes. `draw`
   * itself is read through a ref (so an inline arrow function does not redraw
   * on every parent render); this is how a caller says "the pixels are stale".
   */
  drawSignature?: string;
  /** Ramp `progress` 0→1 on mount. Ignored under reduced motion. */
  animateIn?: boolean;
  /** Draw-in duration in ms. Defaults to {@link CANVAS_LAYER_ENTER_MS}. */
  animationDuration?: number;
}

export interface UseCanvasDrawResult {
  /** Attach to the `<canvas>`. */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** The resolved device pixel ratio the backing store is scaled by. */
  dpr: number;
  /** The geometry `draw` will receive (`progress` is the CURRENT ramp value). */
  scales: ChartScales;
  /**
   * Repaint now. Returns `false` when there was nothing to paint — no element,
   * a zero-sized box, or **no 2D context**, which is the normal case under
   * jsdom (`getContext` returns `null` without the optional `canvas` package).
   * Callers must treat a canvas as a surface that may not exist.
   */
  redraw: () => boolean;
}

/**
 * Reads `window.devicePixelRatio` and re-reads it when the display changes
 * (dragging a window between a retina and a non-retina screen, or a browser
 * zoom step). `matchMedia("(resolution: Ndppx)")` is the only event the
 * platform offers for this; the query is re-armed at the new ratio each time.
 */
function useDevicePixelRatio(): number {
  const [dpr, setDpr] = useState(() =>
    typeof window === "undefined" ? 1 : (window.devicePixelRatio ?? 1),
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia(`(resolution: ${dpr}dppx)`);
    const onChange = () => setDpr(window.devicePixelRatio ?? 1);
    // Safari <14 only has the deprecated listener API; both are cheap to add.
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, [dpr]);

  return dpr;
}

/**
 * Resolves a semantic token to a colour string a canvas context can use,
 * scoped to `el` so a nested `data-theme` region resolves in ITS theme rather
 * than the document's.
 *
 * This is the token seam for canvas marks: `ctx.fillStyle` cannot read a CSS
 * variable, so without it a canvas view hardcodes hex and stops theming. Call
 * it INSIDE `draw` (i.e. per frame), never at module scope — the whole point is
 * that the value is re-read after a theme flip.
 *
 * **The token you pick is your own 1.4.11 compliance (#283).** Nothing
 * downstream can inspect a painted bitmap, so contrast has to be right at the
 * call site. A categorical series token (`--chart-1`…`--chart-12`,
 * `--chart-accent`) is exempt from the 3:1 mark bar only AS A RAMP with other
 * series for context (`.claude/rules/theming.md`) — using one as the SOLE ink
 * for an entire dataset is not covered, and composites even lower once
 * `globalAlpha` is applied. Reach for a neutral rung (e.g. `--chart-mono-7`)
 * for full-density ink, and reserve a series/accent colour for a highlighted
 * subset drawn over it — see `canvas-layer.stories.tsx`.
 */
export function canvasTokenColor(name: string, el: Element | null, fallback: string): string {
  return resolveTokenColor(name, { el: el ?? undefined, fallback });
}

/**
 * The canvas draw loop: dpr-correct sizing, redraw on resize / data / theme,
 * and a reduced-motion-aware enter ramp.
 */
export function useCanvasDraw({
  animateIn = false,
  animationDuration = CANVAS_LAYER_ENTER_MS,
  draw,
  drawSignature,
  height,
  margin,
  width,
}: UseCanvasDrawOptions): UseCanvasDrawResult {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dpr = useDevicePixelRatio();
  const prefersReducedMotion = useReducedMotion() === true;

  // Latest-callback ref: a consumer passing an inline `draw` must not force a
  // repaint on every parent render — `drawSignature` is the repaint trigger.
  const drawRef = useRef(draw);
  drawRef.current = draw;

  const resolvedMargin = useMemo<Margin>(
    () => ({ ...CANVAS_LAYER_DEFAULT_MARGIN, ...margin }),
    [margin?.top, margin?.right, margin?.bottom, margin?.left], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const animating = animateIn && !prefersReducedMotion && animationDuration > 0;
  const progressRef = useRef(animating ? 0 : 1);

  const scales = useMemo<ChartScales>(
    () => ({
      width,
      height,
      margin: resolvedMargin,
      innerWidth: Math.max(0, width - resolvedMargin.left - resolvedMargin.right),
      innerHeight: Math.max(0, height - resolvedMargin.top - resolvedMargin.bottom),
      progress: progressRef.current,
    }),
    [height, resolvedMargin, width],
  );

  const redraw = useCallback((): boolean => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) {
      return false;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return false;
    }

    const backingWidth = Math.round(width * dpr);
    const backingHeight = Math.round(height * dpr);
    // Assigning width/height CLEARS the canvas, so only touch it on a real
    // size change — a theme redraw must not blank the surface first.
    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth;
      canvas.height = backingHeight;
    }
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    drawRef.current(ctx, { ...scales, progress: progressRef.current }, dpr);
    return true;
  }, [dpr, height, scales, width]);

  // Paint before the browser shows the frame: a canvas that paints in a passive
  // effect shows one blank frame on every resize.
  useLayoutEffect(() => {
    redraw();
  }, [redraw, drawSignature]);

  // The enter ramp. Runs at most once per mount and never under reduced motion.
  const rampKey = `${animating}|${animationDuration}`;
  useEffect(() => {
    if (!animating) {
      // Only repaint when the ramp was mid-flight (reduced motion switched on,
      // or the prop cleared): landing on the FINAL frame is required, a second
      // full repaint of the mount frame is not — at 50k marks it is the most
      // expensive no-op in the component.
      if (progressRef.current !== 1) {
        progressRef.current = 1;
        redraw();
      }
      return;
    }
    if (typeof requestAnimationFrame !== "function") {
      progressRef.current = 1;
      redraw();
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / animationDuration);
      progressRef.current = t;
      redraw();
      if (t < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // `redraw` is intentionally excluded: it changes identity on every resize,
    // and restarting the enter ramp mid-resize is exactly the jitter this hook
    // exists to avoid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rampKey]);

  // Theme redraw. `data-theme` can be written on ANY ancestor (ThemeProvider's
  // `attributeTarget`), and `data-decoration` / a class swap can move token
  // values too — so the observer watches the document subtree with an attribute
  // FILTER rather than guessing which element carries the theme. It fires only
  // on those four attribute names, and schedules one repaint per frame.
  useEffect(() => {
    if (typeof MutationObserver !== "function" || typeof document === "undefined") {
      return;
    }
    let scheduled = false;
    const schedule = () => {
      if (scheduled) {
        return;
      }
      scheduled = true;
      const run = () => {
        scheduled = false;
        redraw();
      };
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(run);
      } else {
        run();
      }
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-decoration", "class", "style"],
      subtree: true,
    });
    return () => observer.disconnect();
  }, [redraw]);

  return { canvasRef, dpr, scales, redraw };
}
