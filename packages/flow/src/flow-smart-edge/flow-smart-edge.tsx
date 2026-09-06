import {
  getBezierPath,
  useInternalNode,
  type EdgeProps,
  type InternalNode,
  type Node,
  type Position,
} from "@xyflow/react";
import { FlowEdgePath } from "../flow-edge-path";
import type { FlowHandleSide, FlowNodeData } from "../flow-node";
import {
  pickClosestAnchors,
  pickClosestHandles,
  positionToSide,
  sideToPosition,
  type HandleAnchor,
  type NodeRect,
} from "./smart-edge-geometry";

type HandleKind = "source" | "target";

function toRect(node: InternalNode): NodeRect {
  return {
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    width: node.measured.width ?? 0,
    height: node.measured.height ?? 0,
  };
}

/**
 * The candidate anchors for one end of the edge, read from React Flow's
 * **measured** handle bounds — the DOM truth about where each dot was painted.
 *
 * `handleBounds` entries are node-relative, so the node's absolute position is
 * added back; the dot's centre is the entry's own box centre, which is why this
 * tracks any handle size or offset the node's CSS chooses instead of assuming
 * the dot sits on the side's midpoint.
 *
 * `handleId` pins the result to one handle when the edge names one
 * (`sourceHandle`/`targetHandle`), so an explicitly wired edge is never
 * re-routed to a different dot.
 */
function anchorsOf(
  node: InternalNode,
  kind: HandleKind,
  handleId: string | null | undefined,
): HandleAnchor[] {
  const bounds = node.internals.handleBounds?.[kind] ?? [];
  const origin = node.internals.positionAbsolute;
  return bounds
    .filter((handle) => (handleId ? handle.id === handleId : true))
    .map((handle) => ({
      id: handle.id ?? null,
      x: origin.x + handle.x + handle.width / 2,
      y: origin.y + handle.y + handle.height / 2,
      side: positionToSide[handle.position],
    }));
}

/**
 * The sides a `FlowNode` genuinely renders a handle on, for the pre-measurement
 * fallback only: its `data.handles` config when it has one, otherwise the
 * single default handle React Flow's layout direction placed
 * (`targetPosition`/`sourcePosition`, defaulting to top-in / bottom-out).
 */
function declaredSides(node: InternalNode, kind: HandleKind): FlowHandleSide[] {
  const userNode = node.internals.userNode as Node<Record<string, unknown>>;
  const data = userNode.data as FlowNodeData | undefined;
  const configured = data?.handles?.[kind];
  if (configured?.length) return [...configured];
  const position = (kind === "target" ? userNode.targetPosition : userNode.sourcePosition) as
    | Position
    | undefined;
  if (position) return [positionToSide[position]];
  return [kind === "target" ? "top" : "bottom"];
}

/**
 * Branded edge that picks the closest source/target **handle** pair and routes a
 * bezier between them. Anchors are recomputed every render, so they flip as
 * nodes are dragged. Register it in `edgeTypes={{ smart: FlowSmartEdge }}`; give
 * the connected nodes a `data.handles` config (e.g. `FLOW_ALL_SIDE_HANDLES`) to
 * offer it more than the default two anchors. Uses the `--flow-edge` token,
 * matching `FlowEdge`.
 *
 * ## The path terminates ON the handle dot
 *
 * The endpoints come from React Flow's **measured `handleBounds`** — the centre
 * of the rendered dot — not from a point derived from the node's rectangle.
 * That is a correctness property, not a refinement: an earlier version slid each
 * anchor along the chosen side toward the other node (to fan out edges sharing a
 * side) and picked sides from a four-way fallback list, so a line could meet the
 * node up to half a side away from any dot — measured at ~22px on multi-side
 * nodes and ~124px on nodes carrying only the default top/bottom handles, where
 * a left/right side with no handle at all could be chosen. Two edges leaving the
 * same handle now leave from the same point and diverge, exactly as React Flow's
 * own edges do.
 */
export function FlowSmartEdge({
  id,
  source,
  target,
  sourceHandleId,
  targetHandleId,
  markerEnd,
  style,
}: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const picked = pickClosestAnchors(
    anchorsOf(sourceNode, "source", sourceHandleId),
    anchorsOf(targetNode, "target", targetHandleId),
  );

  let sx: number;
  let sy: number;
  let tx: number;
  let ty: number;
  let sourcePosition: Position;
  let targetPosition: Position;

  if (picked) {
    ({ x: sx, y: sy } = picked.source);
    ({ x: tx, y: ty } = picked.target);
    sourcePosition = sideToPosition[picked.source.side];
    targetPosition = sideToPosition[picked.target.side];
  } else {
    // Handles not measured yet (first render). Fall back to the side midpoints
    // of the sides the nodes actually declare, so the edge is drawn sanely for
    // the frame or two before React Flow reports real handle bounds.
    const fallback = pickClosestHandles(
      toRect(sourceNode),
      declaredSides(sourceNode, "source"),
      toRect(targetNode),
      declaredSides(targetNode, "target"),
    );
    ({ sx, sy, tx, ty } = fallback);
    sourcePosition = sideToPosition[fallback.sourceSide];
    targetPosition = sideToPosition[fallback.targetSide];
  }

  const [edgePath] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition,
    targetX: tx,
    targetY: ty,
    targetPosition,
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
