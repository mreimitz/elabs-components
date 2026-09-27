import { MarkerType, Position, getSmoothStepPath } from "@elabs-ai/components-flow";
import { LANE_PADDING, type Rect, type VisualLayout } from "./lane-layout";
import type { VisualFlow, VisualLens } from "./visual-model";
import {
  VISUAL_BOX_TYPE,
  VISUAL_FLOW_EDGE_TYPE,
  VISUAL_LANE_TYPE,
  type CapabilityBoxNodeType,
  type LanePanelNodeType,
  type VisualFlowEdgeType,
} from "./visual-node-data";

/** The gutter beside every box in a lane (`lane-layout.ts`'s own `LANE_PADDING`), less a
 * small margin — never occupied by a box, so a same-lane connector's dogleg (below) always
 * lands clear of the next box over. The first of a lane's parallel edges (below); each later
 * one steps further out by `SAME_LANE_EDGE_STEP`. */
const SAME_LANE_EDGE_OFFSET = LANE_PADDING - 4;
/**
 * maintainer 2026-09-27 (review round, F13): every box in a lane shares one x column
 * (`lane-layout.ts`), so two DIFFERENT same-lane pairs anchor at the identical `sourceX` and
 * their bend lines coincided exactly — two lines drawn on top of each other read as one.
 * Each pair sharing a column now gets its own offset, stepped out by this much; the lane's
 * own left gutter is `LANE_PADDING` (16) wide, and `LANE_GAP` (64) of empty canvas sits
 * beyond that before the previous lane's boxes, so a handful of parallel edges fan out with
 * room to spare before any of them could cross real content.
 */
const SAME_LANE_EDGE_STEP = 10;

interface EdgeAnchor {
  sourceX: number;
  sourceY: number;
  sourcePosition: Position;
  targetX: number;
  targetY: number;
  targetPosition: Position;
  /** `getSmoothStepPath`'s own `offset` — how far the path's first bend sits outside each
   * rect. Only the same-lane branch below sets this; the rest keep the library default. */
  offset?: number;
}

/** Where two rects sit relative to each other, for the edge's anchor points and directions. */
function anchors(from: Rect, to: Rect): EdgeAnchor {
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
  // Same lane (same x range, neither box to the other's side): a straight vertical line down
  // the boxes' shared centre would cut through whatever box the layout happens to stack
  // between them (maintainer feedback 2026-09-27, `.evidence/lens-preview-merge/` — "Databricks
  // jobs' line runs through MSK"). Anchor both ends on the SAME side (left) instead:
  // `getSmoothStepPath`'s same-position case bends the path at a fixed `offset` outside both
  // rects rather than on the line between their centres, landing it in the lane's own padding
  // gutter — empty at every row, so the dogleg clears any box in between, not just this pair.
  return {
    sourceX: from.x,
    sourceY: fromMidY,
    sourcePosition: Position.Left,
    targetX: to.x,
    targetY: toMidY,
    targetPosition: Position.Left,
    offset: SAME_LANE_EDGE_OFFSET,
  };
}

function edgePath(from: Rect, to: Rect, offsetOverride?: number): string {
  const anchor = anchors(from, to);
  const [path] = getSmoothStepPath({
    ...anchor,
    ...(offsetOverride !== undefined ? { offset: offsetOverride } : {}),
    borderRadius: 8,
  });
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

  // F13: every same-lane pair anchors at the identical `sourceX` (one box column per lane —
  // `lane-layout.ts`), so two different pairs' dogleg bends would otherwise land on the exact
  // same line. Group same-lane flows by that shared column, sorted by id for a stable order,
  // and step each one further out (`SAME_LANE_EDGE_STEP`) than the last.
  const sameLaneColumn = new Map<string, VisualFlow[]>();
  for (const flow of lens.flows) {
    const from = rectOf.get(flow.from);
    const to = rectOf.get(flow.to);
    if (!from || !to) continue;
    const anchor = anchors(from, to);
    if (anchor.sourcePosition !== Position.Left || anchor.targetPosition !== Position.Left)
      continue;
    const key = anchor.sourceX.toFixed(2);
    sameLaneColumn.set(key, [...(sameLaneColumn.get(key) ?? []), flow]);
  }
  const sameLaneOffset = new Map<string, number>();
  for (const column of sameLaneColumn.values()) {
    [...column]
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach((flow, index) => {
        sameLaneOffset.set(flow.id, SAME_LANE_EDGE_OFFSET + index * SAME_LANE_EDGE_STEP);
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
          path: edgePath(from, to, sameLaneOffset.get(flow.id)),
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
