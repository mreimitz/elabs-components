import { getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import { FlowEdgePath } from "../flow-edge-path";
import type { FLOW_EDGE_TYPE } from "../flow-types";

/** A `FlowEdge` edge object: `type: "brand"`, no edge-specific `data`. */
export type BrandFlowEdge = Edge<Record<string, unknown>, typeof FLOW_EDGE_TYPE.brand>;

/**
 * Branded bezier edge using the `--flow-edge` token. Register it in
 * `edgeTypes={{ brand: FlowEdge }}` and create edges with `type: "brand"`.
 *
 * Drawn through `FlowEdgePath`, so it carries the shared keyboard focus
 * indicator (#286) and the shared selected look (`--ring`, wider) — never reach
 * for React Flow's `BaseEdge` directly. Its stroke and width are
 * `FLOW_EDGE_DEFAULTS`.
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
  selected,
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
      selected={selected}
      style={style}
    />
  );
}
