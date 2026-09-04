import { getBezierPath, useInternalNode, type EdgeProps, type InternalNode } from "@xyflow/react";
import { FlowEdgePath } from "../flow-edge-path";
import type { FlowNodeData } from "../flow-node";
import {
  pickClosestHandles,
  rectCenter,
  sideToPosition,
  slideAnchor,
  type NodeRect,
} from "./smart-edge-geometry";

function toRect(node: InternalNode): NodeRect {
  return {
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    width: node.measured.width ?? 0,
    height: node.measured.height ?? 0,
  };
}

/**
 * Branded edge that picks the closest source/target handle pair (from a node's
 * multi-side `FlowNodeHandles` config) and routes a bezier between them. Anchors
 * are recomputed every render, so they flip as nodes are dragged. Register it in
 * `edgeTypes={{ smart: FlowSmartEdge }}` and give the connected nodes a
 * `data.handles` config. Uses the `--flow-edge` token, matching `FlowEdge`.
 */
export function FlowSmartEdge({ id, source, target, markerEnd, style }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const sourceData = sourceNode.internals.userNode.data as FlowNodeData | undefined;
  const targetData = targetNode.internals.userNode.data as FlowNodeData | undefined;

  const sourceRect = toRect(sourceNode);
  const targetRect = toRect(targetNode);

  // Pick which side of each node the edge exits/enters (the facing handle side).
  const { sourceSide, targetSide } = pickClosestHandles(
    sourceRect,
    sourceData?.handles?.source ?? [],
    targetRect,
    targetData?.handles?.target ?? [],
  );

  // Then slide each anchor along its chosen side toward the OTHER node, so
  // edges sharing a side fan out to distinct, target-facing points instead of
  // stacking on the side midpoint.
  const sourceAnchor = slideAnchor(sourceRect, sourceSide, rectCenter(targetRect));
  const targetAnchor = slideAnchor(targetRect, targetSide, rectCenter(sourceRect));

  const [edgePath] = getBezierPath({
    sourceX: sourceAnchor.x,
    sourceY: sourceAnchor.y,
    sourcePosition: sideToPosition[sourceSide],
    targetX: targetAnchor.x,
    targetY: targetAnchor.y,
    targetPosition: sideToPosition[targetSide],
  });

  return (
    <FlowEdgePath
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      data-slot="flow-smart-edge"
      stroke="var(--flow-edge)"
      strokeWidth={1.5}
      style={style}
    />
  );
}
