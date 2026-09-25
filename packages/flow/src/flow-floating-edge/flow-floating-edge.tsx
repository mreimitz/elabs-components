"use client";

import { getBezierPath, useInternalNode, type Edge, type EdgeProps } from "@xyflow/react";
import { FlowEdgePath } from "../flow-edge-path";
import type { FLOW_EDGE_TYPE } from "../flow-types";
import { getEdgeParams } from "./floating-edge-geometry";

/** Optional per-edge `data` for {@link FlowFloatingEdge}. */
export interface FlowFloatingEdgeData {
  /**
   * Show a small anchor dot at each border connection point. On by default so the
   * edge visibly terminates on the node's closest side (rather than a bare line
   * touching the border with no anchor). Set `false` to hide.
   */
  anchors?: boolean;
  [key: string]: unknown;
}

/** @deprecated Use `FlowFloatingEdgeData`. Removed in 6.0.0. */
export type FloatingEdgeData = FlowFloatingEdgeData;

/** A `FlowFloatingEdge` edge object: `type: "floating"`, `data: FlowFloatingEdgeData`. */
export type BrandFlowFloatingEdge = Edge<FlowFloatingEdgeData, typeof FLOW_EDGE_TYPE.floating>;

/** Radius of the connection anchor dot (matches the `FlowNode` handle size). */
const ANCHOR_RADIUS = 4;

/**
 * Branded floating edge: it attaches to the node **border** at the point facing
 * the other node (no fixed handle), recomputed as nodes drag. Register it in
 * `edgeTypes={{ floating: FlowFloatingEdge }}`; the connected nodes need no
 * handle config. Uses the `--flow-edge` token, matching `FlowEdge`, and shows
 * selection the way every built-in edge does (`FlowEdgePath`: `--ring`, wider).
 *
 * A small **anchor dot** is drawn at each connection point (on by default) so the
 * line clearly terminates on the node's closest border side — not at a bare,
 * unanchored spot. Toggle per edge with `data.anchors: false`.
 */
export function FlowFloatingEdge({
  id,
  source,
  target,
  markerEnd,
  style,
  selected,
  data,
  // `Edge<FlowFloatingEdgeData>`, not `BrandFlowFloatingEdge`: the component keeps
  // accepting plain `EdgeProps` (a wrapping custom edge, a `ComponentType<EdgeProps>`
  // map), as it did before `data` was typed. The alias pins `type` for edge objects only.
}: EdgeProps<Edge<FlowFloatingEdgeData>>) {
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

  const showAnchors = data?.anchors !== false;

  return (
    <>
      <FlowEdgePath
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        data-slot="flow-floating-edge"
        selected={selected}
        style={style}
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
