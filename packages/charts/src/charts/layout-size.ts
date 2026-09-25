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
 */
export function useLayoutMeasure(
  options?: Options,
): [(el: HTMLElement | SVGElement | null) => void, LayoutSize] {
  const [measureRef, bounds] = useMeasure(options);
  const elRef = useRef<HTMLElement | SVGElement | null>(null);
  const ref = useCallback(
    (el: HTMLElement | SVGElement | null) => {
      elRef.current = el;
      measureRef(el);
    },
    [measureRef],
  );
  // The first render sees what `react-use-measure` would have answered — never an extra 0 × 0 pass.
  const [size, setSize] = useState<LayoutSize>(() => ({
    width: bounds.width,
    height: bounds.height,
  }));
  useLayoutEffect(() => {
    const next = elRef.current ? layoutSize(elRef.current, bounds) : bounds;
    setSize((prev) =>
      prev.width === next.width && prev.height === next.height
        ? prev
        : { width: next.width, height: next.height },
    );
  }, [bounds]);
  return [ref, size];
}
