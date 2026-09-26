"use client";

/**
 * layout-size.ts — how big a chart's box is, in the box's OWN CSS pixels.
 *
 * A chart draws in its root's coordinate space, so that is the size it must
 * measure. `getBoundingClientRect` answers in VIEWPORT pixels instead: a CSS
 * transform on the root or any ancestor scales it — ChartFrame's entrance
 * `zoom-in-95`, a dialog opening — and a transform ending fires no
 * ResizeObserver, so the scaled size sticks. An SVG drawn from it stops short
 * of its box; a canvas, stretched to the box by CSS, paints its marks off the
 * axes and outlines drawn over it. The offset size is the layout box, which no
 * transform touches.
 */

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import useMeasure, { type Options } from "react-use-measure";

/**
 * The one resize wait every chart measurement uses, in ms (RM-189). The first
 * ResizeObserver callback of a burst redraws at once; while the burst lasts the
 * chart redraws at most once per this period, with the newest size, and the
 * final size lands no later than this long after the last callback. A
 * drag-resize or a panel collapse therefore follows the drag without
 * recomputing a whole chart on every tick. In lodash terms:
 * `debounce(fn, 100, { leading: true, maxWait: 100 })`.
 */
export const CHART_RESIZE_DEBOUNCE_MS = 100;

/**
 * A `ResizeObserver` whose callback runs on the FIRST observation of a burst,
 * then at most once per `wait` ms with the newest entries while callbacks keep
 * coming. A period with nothing new ends the burst without a call, so a single
 * observation is never answered twice and the final size is never repeated.
 * Handed to `react-use-measure` as its `polyfill`, so the chart measurement
 * keeps that library's triggers and answers at once.
 */
export class ChartResizeObserver implements ResizeObserver {
  private readonly callback: ResizeObserverCallback;
  private readonly wait: number;
  private readonly observer: ResizeObserver | null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: ResizeObserverEntry[] | null = null;

  constructor(callback: ResizeObserverCallback, wait: number = CHART_RESIZE_DEBOUNCE_MS) {
    this.callback = callback;
    this.wait = wait;
    // Read at construction, not at import: a server render never constructs one.
    const Native = typeof ResizeObserver === "function" ? ResizeObserver : undefined;
    this.observer = Native ? new Native((entries) => this.notify(entries)) : null;
  }

  private notify(entries: ResizeObserverEntry[]): void {
    if (this.timer === undefined) {
      this.callback(entries, this); // leading: the first callback of a burst
      this.schedule();
    } else {
      this.pending = entries; // folded into the next period's call
    }
  }

  /** One period: call with the newest entries, or end the burst if none came. */
  private schedule(): void {
    this.timer = setTimeout(() => {
      const entries = this.pending;
      this.pending = null;
      if (entries) {
        this.callback(entries, this);
        this.schedule();
      } else {
        this.timer = undefined;
      }
    }, this.wait);
  }

  observe(target: Element, options?: ResizeObserverOptions): void {
    this.observer?.observe(target, options);
  }

  unobserve(target: Element): void {
    this.observer?.unobserve(target);
  }

  disconnect(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = null;
    this.observer?.disconnect();
  }
}

export interface LayoutSize {
  width: number;
  height: number;
}

/**
 * `el`'s layout size. An element with no layout box of its own — an SVG
 * element, or any element under jsdom, where offsets are always 0 — answers
 * with `rect` (default: its bounding rect).
 */
export function layoutSize(el: Element, rect?: LayoutSize): LayoutSize {
  const { offsetWidth, offsetHeight } = el as Partial<HTMLElement>;
  if (
    typeof offsetWidth === "number" &&
    typeof offsetHeight === "number" &&
    (offsetWidth > 0 || offsetHeight > 0)
  ) {
    return usedBorderBox(el) ?? { width: offsetWidth, height: offsetHeight };
  }
  const box = rect ?? el.getBoundingClientRect();
  return { width: box.width, height: box.height };
}

/**
 * The used border box, exact to the sub-pixel. Offsets are the same box rounded
 * to whole pixels: an SVG drawn 0.5px taller than an aspect-ratio root grows the
 * root, and the chart measures again. `null` when the style has no length (jsdom).
 */
function usedBorderBox(el: Element): LayoutSize | null {
  const style = getComputedStyle(el);
  let width = parseFloat(style.width);
  let height = parseFloat(style.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (style.boxSizing !== "border-box") {
    const px = (name: string) => parseFloat(style.getPropertyValue(name)) || 0;
    width +=
      px("padding-left") + px("padding-right") + px("border-left-width") + px("border-right-width");
    height +=
      px("padding-top") + px("padding-bottom") + px("border-top-width") + px("border-bottom-width");
  }
  return { width, height };
}

/**
 * `react-use-measure` — its ResizeObserver, window-resize and debounce
 * triggers — answering with the layout size instead of the rect it reads.
 * The one measurement path for the chart families (RM-189): the observer is a
 * `ChartResizeObserver` (leading, then at most once per
 * `CHART_RESIZE_DEBOUNCE_MS` while a burst lasts), and
 * a window resize trails by the same constant.
 */
export function useLayoutMeasure(
  options?: Omit<Options, "debounce" | "polyfill">,
): [(el: HTMLElement | SVGElement | null) => void, LayoutSize] {
  const [measureRef, bounds] = useMeasure({
    ...options,
    // `react-use-measure` drives its ResizeObserver with the SCROLL handler, so
    // that one stays undebounced and `ChartResizeObserver` does the timing.
    debounce: { scroll: 0, resize: CHART_RESIZE_DEBOUNCE_MS },
    polyfill: ChartResizeObserver,
  });
  const elRef = useRef<HTMLElement | SVGElement | null>(null);
  // The first render sees what `react-use-measure` would have answered — never an extra 0 × 0 pass.
  const [size, setSize] = useState<LayoutSize>(() => ({
    width: bounds.width,
    height: bounds.height,
  }));
  // The last node measured on attach: a ref callback React re-runs with the
  // same node (or `null` first) does not measure again.
  const attachedRef = useRef<HTMLElement | SVGElement | null>(null);
  const ref = useCallback(
    (el: HTMLElement | SVGElement | null) => {
      elRef.current = el;
      measureRef(el);
      // A node that mounts later (after a loading branch) is measured now: the
      // observer answers only after its debounce, and the effect below runs
      // only when that answer changes.
      if (el === null || el === attachedRef.current) return;
      attachedRef.current = el;
      const next = layoutSize(el);
      // Nothing laid out yet (0 × 0): leave it to the observer.
      if (next.width === 0 && next.height === 0) return;
      setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
    },
    [measureRef],
  );
  useLayoutEffect(() => {
    // Before the first observation `bounds` is all zeros (the observer answers
    // only after its debounce), so the element is read directly — the size is
    // there at mount, as it was for the families that measured on their own.
    const observed = bounds.width > 0 || bounds.height > 0;
    const next = elRef.current ? layoutSize(elRef.current, observed ? bounds : undefined) : bounds;
    setSize((prev) =>
      prev.width === next.width && prev.height === next.height
        ? prev
        : { width: next.width, height: next.height },
    );
  }, [bounds]);
  return [ref, size];
}
