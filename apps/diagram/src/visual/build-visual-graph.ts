import { MarkerType, Position, getSmoothStepPath } from "@elabs-ai/components-flow";
import type { Rect, VisualLayout } from "./lane-layout";
import type { VisualFlow, VisualLens } from "./visual-model";
import {
  VISUAL_BOX_TYPE,
  VISUAL_FLOW_EDGE_TYPE,
  VISUAL_LANE_TYPE,
  type CapabilityBoxNodeType,
  type LanePanelNodeType,
  type VisualFlowEdgeType,
} from "./visual-node-data";

/** Where two rects sit relative to each other, for the edge's anchor points and directions. */
function anchors(from: Rect, to: Rect) {
  const fromMidY = from.y + from.height / 2;
  const toMidY = to.y + to.height / 2;
  if (to.x >= from.x + from.width) {
    return {
      sourceX: from.x + from.width,
      sourceY: fromMidY,
      sourcePosition: Position.Right,
      targetX: to.x,
      targetY: toMidY,
      targetPosition: Position.Left,
    };
  }
  if (from.x >= to.x + to.width) {
    return {
      sourceX: from.x,
      sourceY: fromMidY,
      sourcePosition: Position.Left,
      targetX: to.x + to.width,
      targetY: toMidY,
      targetPosition: Position.Right,
    };
  }
  const fromMidX = from.x + from.width / 2;
  const toMidX = to.x + to.width / 2;
  if (to.y >= from.y + from.height) {
    return {
      sourceX: fromMidX,
      sourceY: from.y + from.height,
      sourcePosition: Position.Bottom,
      targetX: toMidX,
      targetY: to.y,
      targetPosition: Position.Top,
    };
  }
  return {
    sourceX: fromMidX,
    sourceY: from.y,
    sourcePosition: Position.Top,
    targetX: toMidX,
    targetY: to.y + to.height,
    targetPosition: Position.Bottom,
  };
}

function edgePath(from: Rect, to: Rect): string {
  const anchor = anchors(from, to);
  const [path] = getSmoothStepPath({ ...anchor, borderRadius: 8 });
  return path;
}

export interface VisualGraph {
  nodes: (LanePanelNodeType | CapabilityBoxNodeType)[];
  edges: VisualFlowEdgeType[];
}

/**
 * `VisualLens` + its layout → a React Flow graph: lane panels first (so boxes paint over them
 * in DOM order), then boxes, then aggregated edges with a precomputed path (rule 3). Every
 * node is non-draggable, non-connectable, non-selectable at the object level — belt and
 * braces beside `VisualCanvasPane`'s canvas-wide read-only props (maintainer 2026-09-27: a
 * view-only lens must never be draggable into "dirty").
 */
export function buildVisualGraph(lens: VisualLens, layout: VisualLayout): VisualGraph {
  const nodes: (LanePanelNodeType | CapabilityBoxNodeType)[] = [];
  for (const { lane, rect } of layout.lanes) {
    nodes.push({
      id: `lane:${lane.id}`,
      type: VISUAL_LANE_TYPE,
      position: { x: rect.x, y: rect.y },
      style: { width: rect.width, height: rect.height },
      data: { title: lane.title },
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: 0,
    });
  }
  const rectOf = new Map(layout.boxes.map(({ box, rect }) => [box.id, rect]));
  for (const { box, rect } of layout.boxes) {
    nodes.push({
      id: box.id,
      type: VISUAL_BOX_TYPE,
      position: { x: rect.x, y: rect.y },
      style: { width: rect.width, height: rect.height },
      data: { title: box.title, members: box.members, aside: box.aside ?? false, owner: box.owner },
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: 1,
    });
  }

  const edges: VisualFlowEdgeType[] = lens.flows
    .map((flow: VisualFlow) => {
      const from = rectOf.get(flow.from);
      const to = rectOf.get(flow.to);
      if (!from || !to) return null;
      const edge: VisualFlowEdgeType = {
        id: flow.id,
        source: flow.from,
        target: flow.to,
        type: VISUAL_FLOW_EDGE_TYPE,
        data: {
          path: edgePath(from, to),
          solid: flow.kind === "data",
          bidirectional: flow.bidirectional,
        },
        selectable: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        markerStart: flow.bidirectional
          ? { type: MarkerType.ArrowClosed, width: 16, height: 16 }
          : undefined,
        zIndex: 2,
      };
      return edge;
    })
    .filter((edge): edge is VisualFlowEdgeType => edge !== null);

  return { nodes, edges };
}
