"use client";

import { useLayoutEffect, useState } from "react";

/**
 * The CSS-pixel size of an element, re-measured whenever it resizes. `0 × 0` until measured.
 *
 * Returns a CALLBACK ref (a state setter), so an element that mounts after the first render
 * (a loading or table view switching to the plot) is still observed.
 */
export function useElementSize<E extends HTMLElement>() {
  const [node, setNode] = useState<E | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      setSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    };
    measure();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [setNode, size] as const;
}
