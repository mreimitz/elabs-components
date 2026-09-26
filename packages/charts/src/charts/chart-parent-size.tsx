"use client";

/**
 * chart-parent-size.tsx — the box a chart fills, measured on the one chart
 * measurement path (RM-189).
 *
 * A drop-in for the `ParentSize` render prop the families used before: the same
 * `width: 100%; height: 100%` wrapper `<div>`, the same `children({ width,
 * height })` call — but measured by `useLayoutMeasure` (`layout-size.ts`), so it
 * answers in the box's own CSS pixels under a transform, and debounces by the
 * one `CHART_RESIZE_DEBOUNCE_MS`. Its own module so a jsdom test can stand in
 * a fixed size for it without replacing the rest of `layout-size.ts`.
 */

import {
  type CSSProperties,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  useCallback,
} from "react";
import { type LayoutSize, useLayoutMeasure } from "./layout-size";

const FILL_PARENT: CSSProperties = { width: "100%", height: "100%" };

export interface ChartParentSizeProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Renders the chart at the measured size (0 × 0 until the first measurement). */
  children: (size: LayoutSize) => ReactNode;
}

export const ChartParentSize = forwardRef<HTMLDivElement, ChartParentSizeProps>(
  function ChartParentSize({ children, style, ...props }, forwardedRef) {
    const [measureRef, size] = useLayoutMeasure();
    const ref = useCallback(
      (node: HTMLDivElement | null) => {
        measureRef(node);
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [measureRef, forwardedRef],
    );
    return (
      <div ref={ref} style={style ? { ...FILL_PARENT, ...style } : FILL_PARENT} {...props}>
        {children(size)}
      </div>
    );
  },
);
