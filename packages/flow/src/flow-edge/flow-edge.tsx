import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

/**
 * Branded bezier edge using the `--flow-edge` token. Register it in
 * `edgeTypes={{ brand: FlowEdge }}` and create edges with `type: "brand"`.
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
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{ stroke: "var(--flow-edge)", strokeWidth: 1.5, ...style }}
    />
  );
}
