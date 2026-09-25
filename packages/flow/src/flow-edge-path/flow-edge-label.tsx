"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { EdgeLabelRenderer } from "@xyflow/react";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export interface FlowEdgeLabelProps extends HTMLAttributes<HTMLDivElement> {
  /** Label anchor x — the `labelX` that `getBezierPath`/`getSmoothStepPath`/… return. */
  x: number;
  /** Label anchor y — the `labelY` that `getBezierPath`/`getSmoothStepPath`/… return. */
  y: number;
}

/**
 * The one anchor for HTML on an edge: it portals its children into React Flow's edge-label
 * layer (`EdgeLabelRenderer`) and centres them on the edge's label point, so a pill, a
 * button or a badge rides the edge through pan, zoom and drag.
 *
 * - **Centred on `x`/`y`.** The anchor is `absolute` and translated by `-50%` of its own
 *   size, so whatever it holds is centred on the point, whatever its size. `style` merges
 *   first; the position transform always wins, because placing the label is this
 *   component's one job.
 * - **Never steals the canvas gesture.** `nodrag nopan` stop React Flow from starting a
 *   drag or a pan on it, and the anchor itself is `pointer-events-none`, so the edge
 *   underneath stays hoverable around the label. An interactive child (a `<button>`) opts
 *   back in with `pointer-events-auto` — the edge-label layer does not receive pointer
 *   events by default either.
 *
 * `data-slot="flow-edge-label"` unless the caller passes its own (`EdgeLabelPill` keeps
 * `edge-label-pill-anchor`); `className` merges last. Render it inside an edge component —
 * outside a React Flow canvas there is no label layer and it renders nothing.
 */
export const FlowEdgeLabel = forwardRef<HTMLDivElement, FlowEdgeLabelProps>(function FlowEdgeLabel(
  { x, y, className, style, ...props },
  ref,
) {
  return (
    <EdgeLabelRenderer>
      <div
        ref={ref}
        data-slot="flow-edge-label"
        {...props}
        className={cn("nodrag nopan pointer-events-none absolute", className)}
        style={{ ...style, transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
      />
    </EdgeLabelRenderer>
  );
});
