/**
 * `layoutVisualLens(lens)` — a deterministic grid, not ELK (maintainer 2026-09-27). `elkjs`
 * 0.12.0 (`node_modules/elkjs/lib/elk-worker.js`) does support `elk.partitioning.activate` on
 * the layered algorithm, but `@elabs-ai/components-flow`'s `layoutFlowElk` — the only ELK
 * entry point this app uses (`docs/verified-apis.md` "Layout (DG-11)") — passes no
 * partitioning option and has no per-group layout options at all (grep of
 * `packages/flow/src/` for "partition" is empty). Reaching the option would mean calling raw
 * `elkjs` directly and re-implementing the graph-building, sizing and fallback the wrapper
 * already owns — a lot of new surface for a layout this simple: fixed-order columns, each
 * box's own content sizing, top-to-bottom stacking. `docs/findings/lens-switch-slice.md`
 * records this as a possible follow-up if a future slice needs true ELK partitioning (e.g. an
 * edge-aware column order).
 *
 * Pure geometry: `VisualLens` in, absolute-position rectangles out. `build-visual-graph.ts`
 * turns these into React Flow nodes; nothing here touches React or `@xyflow/react`.
 */
import type { VisualBox, VisualLane, VisualLens } from "./visual-model";

/** Mirrors `nodes/zone-data.ts`'s zone geometry, so the visual lens sits on the same grid. */
export const LANE_HEADER_HEIGHT = 44;
export const LANE_PADDING = 16;
export const LANE_WIDTH = 320;
export const LANE_GAP = 64;
/** Keep routing columns at least six graph units apart as the number of flows grows. */
export function laneGap(lens: VisualLens): number {
  return Math.max(LANE_GAP, (lens.flows.length + 1) * 6 + 8);
}
/** Only lane-skipping flows need a horizontal corridor above all boxes. */
export function skipLaneFlowIds(lens: VisualLens): string[] {
  const column = new Map(lens.lanes.map((lane, index) => [lane.role, index]));
  const boxColumn = new Map(lens.boxes.map((box) => [box.id, column.get(box.lane) ?? 0]));
  return lens.flows
    .filter((flow) => Math.abs((boxColumn.get(flow.from) ?? 0) - (boxColumn.get(flow.to) ?? 0)) > 1)
    .map((flow) => flow.id);
}
export const BOX_GAP = 16;
/** A box's own header (title) band, above its member rows. */
export const BOX_HEADER_HEIGHT = 32;
export const BOX_MEMBER_ROW_HEIGHT = 28;
export const BOX_PADDING = 12;
export const BOX_MIN_HEIGHT = BOX_HEADER_HEIGHT + BOX_PADDING * 2;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LaidOutLane {
  lane: VisualLane;
  rect: Rect;
}

export interface LaidOutBox {
  box: VisualBox;
  rect: Rect;
}

export interface VisualLayout {
  lanes: LaidOutLane[];
  boxes: LaidOutBox[];
  /** The bounding box of everything, for the transition's up-front camera fit. */
  bounds: Rect;
}

/** A single-member box whose one member's title IS the box's own title (`capability-box-node.tsx`'s
 * `soleMember`) never renders its member-list row — the header already names and icons that one
 * member — so it must not reserve a row of height for it either. */
function isSoleMemberBox(box: VisualBox): boolean {
  return !box.aside && box.members.length === 1 && box.members[0]?.title === box.title;
}

function boxHeight(box: VisualBox): number {
  const rows = isSoleMemberBox(box) ? 0 : Math.max(1, box.members.length);
  return Math.max(
    BOX_MIN_HEIGHT,
    BOX_HEADER_HEIGHT +
      rows * BOX_MEMBER_ROW_HEIGHT +
      BOX_PADDING * 2 +
      (box.owner === "unowned" ? 24 : 0),
  );
}

/**
 * Lanes as fixed-order columns, boxes stacked top-to-bottom inside their lane, each box sized
 * by its member count — the same result for the same lens every time (no measurement, no
 * layout engine, no randomness).
 */
export function layoutVisualLens(lens: VisualLens): VisualLayout {
  const lanes: LaidOutLane[] = [];
  const boxes: LaidOutBox[] = [];
  const gap = laneGap(lens);
  let x = 0;
  let maxLaneHeight = 0;
  for (const lane of lens.lanes) {
    const members = lens.boxes.filter((b) => b.lane === lane.role);
    let y = LANE_HEADER_HEIGHT + LANE_PADDING + skipLaneFlowIds(lens).length * 8;
    for (const box of members) {
      const height = boxHeight(box);
      boxes.push({
        box,
        rect: { x: x + LANE_PADDING, y, width: LANE_WIDTH - LANE_PADDING * 2, height },
      });
      y += height + BOX_GAP;
    }
    const laneHeight = Math.max(y - BOX_GAP + LANE_PADDING, LANE_HEADER_HEIGHT + LANE_PADDING * 2);
    lanes.push({ lane, rect: { x, y: 0, width: LANE_WIDTH, height: laneHeight } });
    maxLaneHeight = Math.max(maxLaneHeight, laneHeight);
    x += LANE_WIDTH + gap;
  }
  // Every lane panel spans the tallest lane's height (a level page, not a jagged one).
  for (const lane of lanes) lane.rect.height = maxLaneHeight;
  // The final lane reserves the same right routing gutter as the gaps between lanes.
  const last = lanes.at(-1);
  if (last) last.rect.width += gap;
  const bounds: Rect = { x: 0, y: 0, width: Math.max(0, x), height: maxLaneHeight };
  return { lanes, boxes, bounds };
}
