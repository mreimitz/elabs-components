import { getBezierPath, type EdgeProps } from "@xyflow/react";
import { FlowEdgePath } from "../flow-edge-path";

/**
 * Branded bezier edge using the `--flow-edge` token. Register it in
 * `edgeTypes={{ brand: FlowEdge }}` and create edges with `type: "brand"`.
 *
 * Drawn through `FlowEdgePath`, so it carries the shared keyboard focus
 * indicator (#286) — never reach for React Flow's `BaseEdge` directly.
 */
export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  return (
    <FlowEdgePath
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      data-slot="flow-edge"
      stroke="var(--flow-edge)"
      strokeWidth={1.5}
      style={style}
    />
  );
}
