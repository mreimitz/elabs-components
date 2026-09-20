"use client";

import { EdgeLabelRenderer, getBezierPath, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { FlowEdgePath, FlowEdgeTokens } from "@elabs-ai/components-flow";
import type { DesignerEdge } from "./types";

/** Work moving from one step to the next. Solid, with an arrowhead and an optional label. */
export function FlowLinkEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
  selected,
}: EdgeProps<DesignerEdge>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const lit = Boolean(data?.travelled) || selected;
  return (
    <>
      <FlowEdgePath
        data-slot="flow-link-edge"
        id={id}
        markerEnd={markerEnd}
        path={path}
        stroke={lit ? "var(--flow-edge-strong)" : "var(--flow-edge)"}
        strokeWidth={lit ? 2 : 1.5}
      />
      {/* A test run in transit. The token keeps no clock: the designer feeds `progress`. */}
      {data?.progress !== undefined ? (
        <FlowEdgeTokens path={path} tokens={[{ id: "run", progress: data.progress, radius: 5 }]} />
      ) : null}
      {data?.label ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded-full bg-surface-elevated px-2 py-0.5 text-meta text-muted-foreground shadow-ring-sm"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

/** Equipment hanging off an agent. Dashed and quiet: it is not part of the flow. */
export function AttachEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps<DesignerEdge>) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  });
  return (
    <FlowEdgePath
      data-slot="attach-edge"
      id={id}
      path={path}
      stroke={selected ? "var(--flow-edge-strong)" : "var(--flow-edge)"}
      strokeDasharray="3 4"
      strokeOpacity={selected ? 1 : 0.7}
      strokeWidth={1.5}
    />
  );
}

export const designerEdgeTypes = { flow: FlowLinkEdge, attach: AttachEdge };
