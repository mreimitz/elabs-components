// Keep pure graph construction independent of the UI barrel and its browser-only assets.
import type { StyleProfile } from "../style/types";
import { MarkerType } from "@xyflow/react";
import {
  LANE_HEADER_HEIGHT,
  LANE_PADDING,
  laneGap,
  skipLaneFlowIds,
  type Rect,
  type VisualLayout,
} from "./lane-layout";
import { type VisualFlow, type VisualLens } from "./visual-model";
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
  dataTop: number,
  fromControl: boolean,
  toControl: boolean,
  sourceFraction: number,
  targetFraction: number,
): { path: string; labelX: number; labelY: number; labelMaxWidth: number } {
  const fraction = (index + 1) / (count + 1);
  const sourceY = from.y + 12 + sourceFraction * (from.height - 24);
  const targetY = to.y + 12 + targetFraction * (to.height - 24);
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
  if (fromControl || toControl) {
    const control = fromControl ? from : to;
    const other = fromControl ? to : from;
    const start: [number, number] = [
      control.x + control.width * fraction,
      control.y + control.height,
    ];
    const corridor = dataTop - gap + 8 + fraction * (gap - 16);
    if (fromControl && toControl) {
      points = [
        start,
        [start[0], corridor],
        [to.x + to.width * fraction, corridor],
        [to.x + to.width * fraction, to.y + to.height],
      ];
    } else {
      const sideX = other.x + other.width + LANE_PADDING + 8 + fraction * (gap - 16);
      const sideY = other.y + 12 + fraction * (other.height - 24);
      points = [
        start,
        [start[0], corridor],
        [sideX, corridor],
        [sideX, sideY],
        [other.x + other.width, sideY],
      ];
      if (!fromControl) points.reverse();
    }
  } else if (sameLane || Math.abs(to.x - from.x) <= from.width + 2 * LANE_PADDING + gap + 1) {
    points = [
      [sourceX, sourceY],
      [sourceColumn, sourceY],
      [sourceColumn, targetY],
      [targetX, targetY],
    ];
  } else {
    const channelY = dataTop + LANE_HEADER_HEIGHT + 8 + skipIndex * 8;
    points = [
      [sourceX, sourceY],
      [sourceColumn, sourceY],
      [sourceColumn, channelY],
      [targetColumn, channelY],
      [targetColumn, targetY],
      [targetX, targetY],
    ];
  }
  const segments = points.slice(1).map((to, i) => ({ from: points[i]!, to }));
  const horizontal = segments.filter(({ from, to }) => from[1] === to[1]);
  const chosen = (horizontal.length ? horizontal : segments).sort(
    (a, b) =>
      Math.abs(b.to[0] - b.from[0]) +
      Math.abs(b.to[1] - b.from[1]) -
      (Math.abs(a.to[0] - a.from[0]) + Math.abs(a.to[1] - a.from[1])),
  )[0]!;
  return {
    path: points.map(([x, y], n) => `${n === 0 ? "M" : "L"} ${x} ${y}`).join(" "),
    labelX: (chosen.from[0] + chosen.to[0]) / 2,
    labelY: (chosen.from[1] + chosen.to[1]) / 2,
    labelMaxWidth: Math.max(0, Math.abs(chosen.to[0] - chosen.from[0]) - 12),
  };
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
export function buildVisualGraph(
  lens: VisualLens,
  layout: VisualLayout,
  profile?: StyleProfile,
): VisualGraph {
  const nodes: (LanePanelNodeType | CapabilityBoxNodeType)[] = [];
  const portFraction = (box: string, flow: VisualFlow) => {
    const incident = lens.flows.filter((item) => item.from === box || item.to === box);
    return (incident.indexOf(flow) + 1) / (incident.length + 1);
  };
  for (const { lane, rect } of layout.lanes) {
    nodes.push({
      id: `lane:${lane.id}`,
      type: VISUAL_LANE_TYPE,
      position: { x: rect.x, y: rect.y },
      style: { width: rect.width, height: rect.height },
      data: { title: lane.title, role: lane.role },
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
        laneTitle: lens.lanes.find((lane) => lane.id === box.lane)?.title ?? box.lane,
        processes: box.processes,
        sub: box.sub,
        provider: box.provider,
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
      const paint =
        profile && !profile.ground.followTheme
          ? profile.flows[flow.kind === "data" ? "data" : "control"]
          : undefined;
      const arrows = paint?.marker !== "none" && profile?.flows.arrowheads !== "none";
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
        ariaLabel: `${flow.kind === "data" ? "Data flow" : "Flow"} ${flow.bidirectional ? "between" : "from"} ${fromTitle}${flow.bidirectional ? " and " : " to "}${toTitle}${flow.label ? `. ${flow.label}` : ""}${flow.process ? `. Process: ${flow.process}` : ""}`,
        data: {
          ...routedPath(
            from,
            to,
            index,
            lens.flows.length,
            laneGap(lens),
            skipLaneFlowIds(lens).indexOf(flow.id),
            layout.dataTop,
            lens.boxes.find((box) => box.id === flow.from)?.controlPlane ?? false,
            lens.boxes.find((box) => box.id === flow.to)?.controlPlane ?? false,
            portFraction(flow.from, flow),
            portFraction(flow.to, flow),
          ),
          label: flow.label,
          process: flow.process,
          solid: flow.kind === "data",
          bidirectional: flow.bidirectional,
        },
        selectable: false,
        // With no `color`, React Flow falls back to its own `defaultMarkerColor` — a literal
        // grey (rgb(177,177,183), ~1.9:1 on the lane panel) that follows no theme, exactly the
        // gap `edge-style.ts`'s own `edgeMarkers` doc comment warns about. The arrowhead is the
        // only direction cue on these edges, so it takes the same token `VisualFlowEdge` already
        // paints its stroke with.
        markerEnd: arrows
          ? {
              type: MarkerType.ArrowClosed,
              width: 16,
              height: 16,
              color: paint?.stroke ?? "var(--muted-foreground)",
            }
          : undefined,
        markerStart:
          arrows && flow.bidirectional && profile?.flows.arrowheads !== "target-only"
            ? {
                type: MarkerType.ArrowClosed,
                width: 16,
                height: 16,
                color: paint?.stroke ?? "var(--muted-foreground)",
              }
            : undefined,
        zIndex: 2,
      };
      return edge;
    })
    .filter((edge): edge is VisualFlowEdgeType => edge !== null);

  return { nodes, edges };
}
