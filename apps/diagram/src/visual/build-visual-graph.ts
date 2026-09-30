// Keep pure graph construction independent of the UI barrel and its browser-only assets.
import type { StyleProfile } from "../style/types";
import { MarkerType } from "@xyflow/react";
import {
  LANE_HEADER_HEIGHT,
  ROUTE_ROW_HEIGHT,
  visualGutterTracks,
  controlPlaneGap,
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
  sourceColumn: number,
  targetColumn: number,
  controlColumn: number,
  approachLeft: boolean,
  skipIndex: number,
  dataTop: number,
  fromControl: boolean,
  toControl: boolean,
  sourceFraction: number,
  targetFraction: number,
  adjacent: boolean,
  controlGap: number,
  controlFraction: number,
): { path: string; labelX: number; labelY: number; labelMaxWidth: number } {
  const sourceY = from.y + 12 + sourceFraction * (from.height - 24);
  const targetY = to.y + 12 + targetFraction * (to.height - 24);
  const sameLane = from.x === to.x;
  const forward = to.x > from.x;
  const sourceX = sameLane || forward ? from.x + from.width : from.x;
  const targetX = sameLane || !forward ? to.x + to.width : to.x;
  let points: [number, number][];
  if (fromControl || toControl) {
    const fraction = controlFraction;
    const control = fromControl ? from : to;
    const other = fromControl ? to : from;
    const start: [number, number] = [
      control.x + control.width * fraction,
      control.y + control.height,
    ];
    const corridor = dataTop - controlGap + 8 + fraction * (controlGap - 16);
    if (fromControl && toControl) {
      points = [
        start,
        [start[0], corridor],
        [to.x + to.width * fraction, corridor],
        [to.x + to.width * fraction, to.y + to.height],
      ];
    } else {
      const sideX = controlColumn;
      const sideY =
        other.y + 12 + (fromControl ? targetFraction : sourceFraction) * (other.height - 24);
      points = [
        start,
        [start[0], corridor],
        [sideX, corridor],
        [sideX, sideY],
        [approachLeft ? other.x : other.x + other.width, sideY],
      ];
      if (!fromControl) points.reverse();
    }
  } else if (sameLane || adjacent) {
    // Put the bend near the receiving box, leaving a full horizontal run for
    // the label. A middle bend would halve the corridor reserved for that label.
    const bend = sourceColumn;
    points = [
      [sourceX, sourceY],
      [bend, sourceY],
      [bend, targetY],
      [targetX, targetY],
    ];
  } else {
    const channelY = dataTop + LANE_HEADER_HEIGHT + 8 + skipIndex * ROUTE_ROW_HEIGHT;
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
  const portRows = new Map<string, number>();
  const occupiedRows: number[] = [];
  for (const { box, rect } of [...layout.boxes].sort((a, b) => a.box.id.localeCompare(b.box.id))) {
    const incident = lens.flows
      .filter((flow) => flow.from === box.id || flow.to === box.id)
      .sort((a, b) => a.id.localeCompare(b.id));
    for (const [index, flow] of incident.entries()) {
      const preferred = rect.y + 12 + ((index + 1) / (incident.length + 1)) * (rect.height - 24);
      let row = preferred;
      if (lens.composition !== "process") {
        for (let offset = 0; offset < rect.height; offset += 8) {
          const available = [preferred + offset, preferred - offset].find(
            (candidate) =>
              candidate >= rect.y + 12 &&
              candidate <= rect.y + rect.height - 12 &&
              occupiedRows.every((used) => Math.abs(candidate - used) >= 8),
          );
          if (available !== undefined) {
            row = available;
            break;
          }
        }
      }
      occupiedRows.push(row);
      portRows.set(`${box.id}\0${flow.id}`, (row - rect.y - 12) / (rect.height - 24));
    }
  }
  const portFraction = (box: string, flow: VisualFlow) => portRows.get(`${box}\0${flow.id}`) ?? 0.5;
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
  const memberTitle = new Map(
    lens.boxes.flatMap((box) => box.members.map((member) => [member.id, member.title] as const)),
  );
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
        summary: box.summary,
        boundaryOf: box.boundaryOf,
      },
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: 1,
    });
  }

  const controlBoxes = new Set(lens.boxes.filter((box) => box.controlPlane).map((box) => box.id));
  const controlFlows = lens.flows
    .filter((flow) => controlBoxes.has(flow.from) || controlBoxes.has(flow.to))
    .sort((a, b) => a.id.localeCompare(b.id));
  const { uses, tracks } = visualGutterTracks(lens);
  const laneRects = new Map(layout.lanes.map((item) => [item.lane.id, item.rect]));
  const trackX = (corridor: string | undefined, flowId: string) => {
    if (corridor === undefined) return 0;
    const lane = laneRects.get(corridor)!;
    return (
      lane.x +
      lane.width +
      layout.gutters[corridor]! -
      4 -
      (tracks.get(corridor)?.indexOf(flowId) ?? 0) * 8
    );
  };
  const edges: VisualFlowEdgeType[] = lens.flows
    .map((flow: VisualFlow) => {
      const use = uses.get(flow.id)!;
      const from = rectOf.get(flow.from);
      const to = rectOf.get(flow.to);
      if (!from || !to) return null;
      const sourceBox = lens.boxes.find((box) => box.id === flow.from)!;
      const targetBox = lens.boxes.find((box) => box.id === flow.to)!;
      const dataLanes = layout.lanes.filter((item) => item.lane.id !== "@control-plane");
      const fromColumn = dataLanes.findIndex((item) => item.lane.id === sourceBox.lane);
      const toColumn = dataLanes.findIndex((item) => item.lane.id === targetBox.lane);
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
            trackX(use.source, flow.id),
            trackX(use.target, flow.id),
            trackX(use.control, flow.id),
            use.approachLeft,
            skipLaneFlowIds(lens).indexOf(flow.id),
            layout.dataTop,
            lens.composition !== "process" && (sourceBox.controlPlane ?? false),
            lens.composition !== "process" && (targetBox.controlPlane ?? false),
            portFraction(flow.from, flow),
            portFraction(flow.to, flow),
            Math.abs(fromColumn - toColumn) === 1,
            controlPlaneGap(lens),
            (controlFlows.indexOf(flow) + 1) / (controlFlows.length + 1),
          ),
          label: flow.label,
          relationshipDetails: flow.relationships
            ?.map(
              (item) =>
                `${memberTitle.get(item.from) ?? item.from} → ${memberTitle.get(item.to) ?? item.to}: ${item.kind ?? "data"}${item.label ? ` — ${item.label}` : ""}`,
            )
            .join("\n"),
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
