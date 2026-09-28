import { MarkerType, Position, getSmoothStepPath } from "@elabs-ai/components-flow";
import {
  LANE_GAP,
  LANE_HEADER_HEIGHT,
  LANE_PADDING,
  LANE_WIDTH,
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

/** The gutter beside every box in a lane (`lane-layout.ts`'s own `LANE_PADDING`), less a
 * small margin — never occupied by a box, so a same-lane connector's dogleg (below) always
 * lands clear of the next box over. The first of a lane's parallel edges (below); each later
 * one steps further out by `SAME_LANE_EDGE_STEP`. */
const SAME_LANE_EDGE_OFFSET = LANE_PADDING - 4;
/**
 * Every box in a lane shares one x column (`lane-layout.ts`), so two DIFFERENT same-lane pairs
 * would otherwise anchor at the identical `sourceX` and draw their bend lines exactly on top of
 * each other, reading as one. Each pair sharing a column gets its own offset, stepped out by
 * this much; the lane's own left gutter is `LANE_PADDING` (16) wide, and `LANE_GAP` (64) of
 * empty canvas sits beyond that before the previous lane's boxes, so a handful of parallel edges
 * fan out with room to spare before any of them could cross real content.
 */
const SAME_LANE_EDGE_STEP = 10;

/**
 * An opposite-kind pair (a dashed control flow one way, a solid data flow the other) is kept as
 * two separate `VisualFlow`s (`derive-visual.ts`'s `pairs` map keys on kind), not merged into
 * one bidirectional edge. But two flows between the SAME pair of boxes, in opposite directions,
 * anchor at the same two points either way — swap `from`/`to` and `anchors()` returns the mirror
 * image of the same line, so the two edges would draw on the exact same path, and a solid line
 * drawn over a dashed one at identical coordinates reads as one bidirectional data line, the
 * exact false direction two separate flows are meant to avoid. Each flow in such a pair gets a
 * small perpendicular nudge (this constant, ± an index) so the two render as visibly separate
 * parallel lines instead of one shared path.
 */
const CROSS_KIND_PAIR_NUDGE = 6;

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

/** Where two rects sit relative to each other, for the edge's anchor points and directions.
 * `yNudge` shifts both ends by the same amount, straight up or down — a plain parallel offset
 * that keeps a pair of opposite-direction, different-kind flows (`CROSS_KIND_PAIR_NUDGE`) from
 * drawing on the exact same line. */
function anchors(from: Rect, to: Rect, yNudge = 0): EdgeAnchor {
  const fromMidY = from.y + from.height / 2 + yNudge;
  const toMidY = to.y + to.height / 2 + yNudge;
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

function edgePath(from: Rect, to: Rect, offsetOverride?: number, yNudge = 0): string {
  const anchor = anchors(from, to, yNudge);
  const [path] = getSmoothStepPath({
    ...anchor,
    ...(offsetOverride !== undefined ? { offset: offsetOverride } : {}),
    borderRadius: 8,
  });
  return path;
}

/**
 * `anchors()`/`edgePath()` above only ever anchor at each box's own edge — correct for an
 * adjacent-lane or same-lane pair, but a flow whose lanes are not adjacent (e.g. Sources
 * straight to Targets, past Customer VPC) would draw a straight line from one box's edge to the
 * other's, running directly through every box and member row the line's lane column happened to
 * cross.
 *
 * The lane grid (`lane-layout.ts`) has one band that is empty in EVERY lane regardless of its
 * content: between the lane header (`LANE_HEADER_HEIGHT`) and the first box
 * (`LANE_HEADER_HEIGHT + LANE_PADDING`) — no title text reaches that far down, and no box
 * starts before it. A skip-lane flow exits its source box sideways into ITS OWN lane's side
 * gutter (mirroring the same-lane dogleg's `SAME_LANE_EDGE_OFFSET`, always empty — one box
 * column per lane), rises or drops to that shared header gutter, crosses every intervening
 * lane through it (still clear of every box there, by the same margin), then drops into the
 * target's own side gutter and its edge — six points, never inside a box's rect at any x.
 */
const SKIP_LANE_CHANNEL_Y = LANE_HEADER_HEIGHT + LANE_PADDING / 2;
/** Multiple concurrent skip-lane flows stagger off this row so they do not overlap each
 * other; `LANE_HEADER_HEIGHT`..`LANE_HEADER_HEIGHT + LANE_PADDING` is 16 px of headroom, and a
 * handful of flows step through it 3 px at a time (`SAME_LANE_EDGE_STEP`'s own idea, reused). */
const SKIP_LANE_CHANNEL_STEP = 3;
/** How far into a lane's own side gutter a skip-lane flow's vertical run sits — the same
 * shape as `SAME_LANE_EDGE_OFFSET`, kept a touch smaller so it never nears the LANE_GAP the
 * lane's title-less lower gutter borders. */
const SKIP_LANE_SIDE_GUTTER = LANE_PADDING - 4;

/** True lane distance between two rects, by lane COLUMN index (not raw x, which the same-lane
 * dogleg's own offset already perturbs) — every lane is `LANE_WIDTH + LANE_GAP` apart, and a
 * box's own `x` always carries exactly one `LANE_PADDING` past its lane's start. */
function laneIndexOf(rect: Rect): number {
  return Math.round((rect.x - LANE_PADDING) / (LANE_WIDTH + LANE_GAP));
}

function skipLanePath(from: Rect, to: Rect, channelY: number): string {
  const forward = to.x >= from.x;
  const fromMidY = from.y + from.height / 2;
  const toMidY = to.y + to.height / 2;
  const fromEdgeX = forward ? from.x + from.width : from.x;
  const toEdgeX = forward ? to.x : to.x + to.width;
  const fromGutterX = forward
    ? fromEdgeX + SKIP_LANE_SIDE_GUTTER
    : fromEdgeX - SKIP_LANE_SIDE_GUTTER;
  const toGutterX = forward ? toEdgeX - SKIP_LANE_SIDE_GUTTER : toEdgeX + SKIP_LANE_SIDE_GUTTER;
  return [
    `M ${fromEdgeX} ${fromMidY}`,
    `L ${fromGutterX} ${fromMidY}`,
    `L ${fromGutterX} ${channelY}`,
    `L ${toGutterX} ${channelY}`,
    `L ${toGutterX} ${toMidY}`,
    `L ${toEdgeX} ${toMidY}`,
  ].join(" ");
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

  // A box pair with more than one flow between it (an opposite-kind pair deliberately kept as
  // two one-way edges, e.g. dashed control one way, solid data the other) anchors both edges at
  // the same two points either way — swapping `from`/`to` mirrors the SAME line, not a different
  // one. Skip the same-lane case: those pairs already fan out via `sameLaneOffset`'s own X step,
  // and stacking a Y-nudge on top would misalign the dogleg.
  const crossPairGroup = new Map<string, VisualFlow[]>();
  for (const flow of lens.flows) {
    const from = rectOf.get(flow.from);
    const to = rectOf.get(flow.to);
    if (!from || !to || anchors(from, to).offset !== undefined) continue;
    const key = [flow.from, flow.to].sort().join("\u0000");
    crossPairGroup.set(key, [...(crossPairGroup.get(key) ?? []), flow]);
  }
  const crossPairNudge = new Map<string, number>();
  for (const group of crossPairGroup.values()) {
    if (group.length < 2) continue;
    const n = group.length;
    [...group]
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach((flow, index) => {
        crossPairNudge.set(flow.id, (index - (n - 1) / 2) * CROSS_KIND_PAIR_NUDGE);
      });
  }

  // A flow whose two boxes are more than one lane apart routes through the header gutter instead
  // of `edgePath()`'s straight box-to-box line. Concurrent skip-lane flows stagger off
  // `SKIP_LANE_CHANNEL_Y`, sorted by id for a stable order, same idea as `sameLaneOffset` above.
  const skipLaneFlows: VisualFlow[] = [];
  for (const flow of lens.flows) {
    const from = rectOf.get(flow.from);
    const to = rectOf.get(flow.to);
    if (!from || !to) continue;
    if (Math.abs(laneIndexOf(from) - laneIndexOf(to)) > 1) skipLaneFlows.push(flow);
  }
  const skipLaneChannel = new Map<string, number>();
  [...skipLaneFlows]
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((flow, index) => {
      skipLaneChannel.set(flow.id, SKIP_LANE_CHANNEL_Y + index * SKIP_LANE_CHANNEL_STEP);
    });

  const edges: VisualFlowEdgeType[] = lens.flows
    .map((flow: VisualFlow) => {
      const from = rectOf.get(flow.from);
      const to = rectOf.get(flow.to);
      if (!from || !to) return null;
      const channelY = skipLaneChannel.get(flow.id);
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
          path:
            channelY !== undefined
              ? skipLanePath(from, to, channelY)
              : edgePath(from, to, sameLaneOffset.get(flow.id), crossPairNudge.get(flow.id)),
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
