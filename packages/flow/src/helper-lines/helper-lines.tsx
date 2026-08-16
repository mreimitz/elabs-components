"use client";

import { forwardRef, type SVGAttributes } from "react";
import { useViewport } from "@xyflow/react";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export interface HelperLinesProps extends SVGAttributes<SVGSVGElement> {
  /** Absolute flow-y of the horizontal guide (from `useHelperLines`). */
  horizontal?: number;
  /** Absolute flow-x of the vertical guide (from `useHelperLines`). */
  vertical?: number;
}

/**
 * Decorative alignment-guide overlay. Draws a full-width horizontal line at
 * `horizontal` and/or a full-height vertical line at `vertical`, coloured with
 * the `--flow-helper-line` token. It reads the live viewport transform
 * (zoom + pan) so the guides sit on the real alignment position when the canvas
 * is zoomed or panned.
 *
 * Render as a child of `<CanvasShell>` / `<ReactFlow>` (it must be inside the
 * flow context to read the viewport). Purely decorative — hidden from AT.
 */
export const HelperLines = forwardRef<SVGSVGElement, HelperLinesProps>(function HelperLines(
  { horizontal, vertical, className, ...props },
  ref,
) {
  const { x, y, zoom } = useViewport();

  if (horizontal == null && vertical == null) return null;

  // flow coordinate → pane pixel: coord * zoom + pan offset.
  const screenY = horizontal == null ? null : y + horizontal * zoom;
  const screenX = vertical == null ? null : x + vertical * zoom;

  return (
    <svg
      ref={ref}
      aria-hidden="true"
      width="100%"
      height="100%"
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
      {...props}
    >
      {screenY != null ? (
        <line
          x1={0}
          x2="100%"
          y1={screenY}
          y2={screenY}
          stroke="var(--flow-helper-line, var(--primary))"
          strokeWidth={1}
        />
      ) : null}
      {screenX != null ? (
        <line
          x1={screenX}
          x2={screenX}
          y1={0}
          y2="100%"
          stroke="var(--flow-helper-line, var(--primary))"
          strokeWidth={1}
        />
      ) : null}
    </svg>
  );
});
