import { MarkerType } from "@elabs-ai/components-flow";
import {
  LANE_HEADER_HEIGHT,
  LANE_PADDING,
  laneGap,
  skipLaneFlowIds,
  type Rect,
  type VisualLayout,
} from "./lane-layout";
import { LANE_TITLE, type VisualFlow, type VisualLens } from "./visual-model";
import {
  VISUAL_BOX_TYPE,
  VISUAL_FLOW_EDGE_TYPE,
  VISUAL_LANE_TYPE,
  type CapabilityBoxNodeType,
  type LanePanelNodeType,
  type VisualFlowEdgeType,
} from "./visual-node-data";

/** Each flow owns its ports and bend column. No two flows share a run or an arrowhead. */
function routedPath(
  from: Rect,
  to: Rect,
  index: number,
  count: number,
  gap: number,
  skipIndex: number,
): string {
  const fraction = (index + 1) / (count + 1);
  const sourceY = from.y + 12 + fraction * (from.height - 24);
  const targetY = to.y + 12 + fraction * (to.height - 24);
  const sameLane = from.x === to.x;
  const forward = to.x > from.x;
  const sourceX = sameLane || forward ? from.x + from.width : from.x;
  const targetX = sameLane || !forward ? to.x + to.width : to.x;
  const offset = LANE_PADDING + 4 + fraction * (gap - 8);
  const sourceColumn =
    sameLane || forward ? sourceX + offset : sourceX - gap - 2 * LANE_PADDING + offset;
  const targetColumn =
    sameLane || !forward ? targetX + offset : targetX - gap - 2 * LANE_PADDING + offset;
  let points: [number, number][];
  if (sameLane || Math.abs(to.x - from.x) <= from.width + 2 * LANE_PADDING + gap + 1) {
    points = [
      [sourceX, sourceY],
      [sourceColumn, sourceY],
      [sourceColumn, targetY],
      [targetX, targetY],
    ];
  } else {
    const channelY = LANE_HEADER_HEIGHT + 8 + skipIndex * 8;
    points = [
      [sourceX, sourceY],
      [sourceColumn, sourceY],
      [sourceColumn, channelY],
      [targetColumn, channelY],
      [targetColumn, targetY],
      [targetX, targetY],
    ];
  }
  return points.map(([x, y], n) => `${n === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
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
  const titleOf = new Map(layout.boxes.map(({ box }) => [box.id, box.title]));
  for (const { box, rect } of layout.boxes) {
    nodes.push({
      id: box.id,
      type: VISUAL_BOX_TYPE,
      position: { x: rect.x, y: rect.y },
      style: { width: rect.width, height: rect.height },
      data: {
        title: box.title,
        members: box.members,
        aside: box.aside ?? false,
        owner: box.owner,
        laneTitle: LANE_TITLE[box.lane],
      },
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: 1,
    });
  }

  const edges: VisualFlowEdgeType[] = lens.flows
    .map((flow: VisualFlow, index) => {
      const from = rectOf.get(flow.from);
      const to = rectOf.get(flow.to);
      if (!from || !to) return null;
      const fromTitle = titleOf.get(flow.from) ?? flow.from;
      const toTitle = titleOf.get(flow.to) ?? flow.to;
      const edge: VisualFlowEdgeType = {
        id: flow.id,
        source: flow.from,
        target: flow.to,
        type: VISUAL_FLOW_EDGE_TYPE,
        // Box titles, never the internal `box:…` ids these edges connect: with no `ariaLabel`,
        // React Flow's default names an edge from its raw node ids ("Edge from box:dbx-workspace
        // to box:dbx-jobs"), which means nothing to a screen-reader user and exposes an
        // implementation detail besides. `edgesFocusable={false}` keeps these out of the tab
        // order, but a virtual cursor can still land on the `role="img"` group RF renders.
        ariaLabel: `${flow.kind === "data" ? "Data flow" : "Flow"} ${flow.bidirectional ? "between" : "from"} ${fromTitle}${flow.bidirectional ? " and " : " to "}${toTitle}`,
        data: {
          path: routedPath(
            from,
            to,
            index,
            lens.flows.length,
            laneGap(lens),
            skipLaneFlowIds(lens).indexOf(flow.id),
          ),
          solid: flow.kind === "data",
          bidirectional: flow.bidirectional,
        },
        selectable: false,
        // With no `color`, React Flow falls back to its own `defaultMarkerColor` — a literal
        // grey (rgb(177,177,183), ~1.9:1 on the lane panel) that follows no theme, exactly the
        // gap `edge-style.ts`'s own `edgeMarkers` doc comment warns about. The arrowhead is the
        // only direction cue on these edges, so it takes the same token `VisualFlowEdge` already
        // paints its stroke with.
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: "var(--muted-foreground)",
        },
        markerStart: flow.bidirectional
          ? {
              type: MarkerType.ArrowClosed,
              width: 16,
              height: 16,
              color: "var(--muted-foreground)",
            }
          : undefined,
        zIndex: 2,
      };
      return edge;
    })
    .filter((edge): edge is VisualFlowEdgeType => edge !== null);

  return { nodes, edges };
}
