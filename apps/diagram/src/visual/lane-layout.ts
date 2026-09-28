/** Deterministic grid placement shared by the visual pane and its morph. */
import type { VisualBox, VisualLane, VisualLens } from "./visual-model";

export const LANE_HEADER_HEIGHT = 44;
export const LANE_PADDING = 16;
export const LANE_WIDTH = 320;
export const LANE_GAP = 64;
export const BOX_GAP = 16;
export const BOX_HEADER_HEIGHT = 32;
export const BOX_MEMBER_ROW_HEIGHT = 28;
export const BOX_PADDING = 12;
export const BOX_MIN_HEIGHT = BOX_HEADER_HEIGHT + BOX_PADDING * 2;

/** Each routed flow keeps its own gutter, including reverse and lane-skipping flows. */
export function laneGap(lens: VisualLens): number {
  return Math.max(
    lens.flows.some((flow) => flow.label || flow.process) ? 224 : LANE_GAP,
    (lens.flows.length + 1) * 6 + 8,
  );
}
export function skipLaneFlowIds(lens: VisualLens): string[] {
  const columns = new Map(lens.lanes.map((lane, index) => [lane.id, index]));
  const boxes = new Map(lens.boxes.map((box) => [box.id, box]));
  return lens.flows
    .filter((flow) => {
      const from = boxes.get(flow.from);
      const to = boxes.get(flow.to);
      return (
        !from?.controlPlane &&
        !to?.controlPlane &&
        Math.abs((columns.get(from?.lane ?? "") ?? 0) - (columns.get(to?.lane ?? "") ?? 0)) > 1
      );
    })
    .map((flow) => flow.id);
}
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
  bounds: Rect;
  /** The data-plane corridor begins after an optional control-plane band. */
  dataTop: number;
}
export function boxHeight(box: VisualBox): number {
  const sole = !box.aside && box.members.length === 1 && box.members[0]?.title === box.title;
  const rows = sole ? 0 : Math.max(1, box.members.length);
  const pills = box.processes?.length ? Math.ceil(box.processes.length / 2) * 24 + 8 : 0;
  return Math.max(
    BOX_MIN_HEIGHT,
    BOX_HEADER_HEIGHT +
      rows * BOX_MEMBER_ROW_HEIGHT +
      BOX_PADDING * 2 +
      pills +
      (box.owner === "unowned" ? 24 : 0),
  );
}

export function layoutVisualLens(lens: VisualLens): VisualLayout {
  const lanes: LaidOutLane[] = [];
  const boxes: LaidOutBox[] = [];
  const gap = laneGap(lens);
  const heightOf = (box: VisualBox) => {
    const incident = lens.flows.filter((flow) => flow.from === box.id || flow.to === box.id);
    // Each labeled route needs an independent row, including opposite parallel flows.
    return Math.max(
      boxHeight(box),
      incident.some((flow) => flow.label || flow.process) ? 24 + (incident.length + 1) * 32 : 0,
    );
  };
  const controls = lens.boxes.filter((box) => box.controlPlane);
  const dataLanes = lens.lanes.filter((lane) =>
    lens.boxes.some((box) => box.lane === lane.id && !box.controlPlane),
  );
  const controlHeight = controls.length
    ? LANE_HEADER_HEIGHT + LANE_PADDING * 2 + Math.max(...controls.map(heightOf))
    : 0;
  const dataTop = controlHeight ? controlHeight + gap : 0;
  let x = 0;
  let maxLaneHeight = 0;
  for (const lane of dataLanes) {
    let y = dataTop + LANE_HEADER_HEIGHT + LANE_PADDING + skipLaneFlowIds(lens).length * 8;
    for (const box of lens.boxes.filter((box) => box.lane === lane.id && !box.controlPlane)) {
      const height = heightOf(box);
      boxes.push({
        box,
        rect: { x: x + LANE_PADDING, y, width: LANE_WIDTH - LANE_PADDING * 2, height },
      });
      y += height + BOX_GAP;
    }
    const height = Math.max(
      y - dataTop - BOX_GAP + LANE_PADDING,
      LANE_HEADER_HEIGHT + LANE_PADDING * 2,
    );
    lanes.push({ lane, rect: { x, y: dataTop, width: LANE_WIDTH, height } });
    maxLaneHeight = Math.max(maxLaneHeight, height);
    x += LANE_WIDTH + gap;
  }
  for (const lane of lanes) lane.rect.height = maxLaneHeight;
  const last = lanes.at(-1);
  if (last) last.rect.width += gap;
  const controlWidth = controls.length * (LANE_WIDTH + gap);
  const width = Math.max(x, controlWidth);
  if (controls.length) {
    const titles = [
      ...new Set(
        controls
          .map((box) => lens.lanes.find((lane) => lane.id === box.lane)?.title)
          .filter(Boolean),
      ),
    ];
    lanes.unshift({
      lane: {
        id: "@control-plane",
        role: "vendor-cloud",
        title: titles.length === 1 ? titles[0]! : "Control plane",
      },
      rect: { x: 0, y: 0, width, height: controlHeight },
    });
    controls.forEach((box, index) =>
      boxes.push({
        box,
        rect: {
          x: LANE_PADDING + index * (LANE_WIDTH + gap),
          y: LANE_HEADER_HEIGHT + LANE_PADDING,
          width: LANE_WIDTH - LANE_PADDING * 2,
          height: heightOf(box),
        },
      }),
    );
  }
  return {
    lanes,
    boxes,
    bounds: { x: 0, y: 0, width, height: dataTop + maxLaneHeight || controlHeight },
    dataTop,
  };
}
