import { BaseEdge, getBezierPath, useInternalNode, type EdgeProps } from "@xyflow/react";
import { getEdgeParams } from "./floating-edge-geometry";

/** Optional per-edge `data` for {@link FlowFloatingEdge}. */
export interface FloatingEdgeData {
  /**
   * Show a small anchor dot at each border connection point. On by default so the
   * edge visibly terminates on the node's closest side (rather than a bare line
   * touching the border with no anchor). Set `false` to hide.
   */
  anchors?: boolean;
  [key: string]: unknown;
}

/** Radius of the connection anchor dot (matches the `FlowNode` handle size). */
const ANCHOR_RADIUS = 4;

/**
 * Branded floating edge: it attaches to the node **border** at the point facing
 * the other node (no fixed handle), recomputed as nodes drag. Register it in
 * `edgeTypes={{ floating: FlowFloatingEdge }}`; the connected nodes need no
 * handle config. Uses the `--flow-edge` token, matching `FlowEdge`.
 *
 * A small **anchor dot** is drawn at each connection point (on by default) so the
 * line clearly terminates on the node's closest border side — not at a bare,
 * unanchored spot. Toggle per edge with `data.anchors: false`.
 */
export function FlowFloatingEdge({ id, source, target, markerEnd, style, data }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode);

  const [edgePath] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetX: tx,
    targetY: ty,
    targetPosition: targetPos,
  });

  const showAnchors = (data as FloatingEdgeData | undefined)?.anchors !== false;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke: "var(--flow-edge)", strokeWidth: 1.5, ...style }}
      />
      {showAnchors ? (
        <g
          className="brand-floating-edge__anchors"
          fill="var(--flow-node)"
          stroke="var(--flow-edge)"
        >
          {/* Decorative rings matching the FlowNode handle look; never intercept
              pointer events so nodes stay draggable through them. */}
          <circle
            cx={sx}
            cy={sy}
            r={ANCHOR_RADIUS}
            strokeWidth={2}
            style={{ pointerEvents: "none" }}
            aria-hidden="true"
          />
          <circle
            cx={tx}
            cy={ty}
            r={ANCHOR_RADIUS}
            strokeWidth={2}
            style={{ pointerEvents: "none" }}
            aria-hidden="true"
          />
        </g>
      ) : null}
    </>
  );
}
