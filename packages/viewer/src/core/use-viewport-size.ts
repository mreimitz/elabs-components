"use client";

/**
 * The size of the box a renderer scrolls inside, kept current.
 *
 * Needed because a fit-to-width scale is a function of the VIEWPORT, not of the
 * document: only the renderer can compute it, and only by measuring. Measures
 * the container rather than the window (`window.innerWidth` would be wrong the
 * moment a viewer sits in a resizable pane, a dialog or a split workspace).
 */

import { useEffect, useState, type RefObject } from "react";

import { findScrollHost } from "./scroll-host";

export interface ViewportSize {
  width: number;
  height: number;
}

/**
 * @param ref An element inside the scrolling box — typically the renderer's root.
 * @returns The scroll host's content size, or `undefined` until it is measured.
 */
export function useViewportSize(ref: RefObject<HTMLElement | null>): ViewportSize | undefined {
  const [size, setSize] = useState<ViewportSize>();

  useEffect(() => {
    const host = findScrollHost(ref.current) ?? ref.current?.parentElement ?? ref.current;
    if (!host || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      const { clientWidth: width, clientHeight: height } = host;
      // A hidden pane measures zero. Re-fitting to a zero-width viewport would
      // rasterize a zero-width page and clear the canvas — and nothing would
      // measure again when the pane is shown, because its size did not change
      // from the observer's point of view. Ignoring the reading keeps the last
      // good one. (The guard extend-hq/ui's `useElementWidth` carries too.)
      if (width === 0 || height === 0) return;
      setSize((current) =>
        current && Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1
          ? current
          : { width, height },
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
