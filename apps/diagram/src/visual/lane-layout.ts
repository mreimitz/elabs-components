/** Deterministic composition for the visual pane and geometry checks. */
import type { VisualBox, VisualLane, VisualLens } from "./visual-model";

export const LANE_HEADER_HEIGHT = 44;
export const LANE_PADDING = 16;
export const LANE_WIDTH = 320;
export const LANE_GAP = 64;
export const BOX_GAP = 16;
export const ROUTE_ROW_HEIGHT = 24;
export const BOX_HEADER_HEIGHT = 32;
export const BOX_MEMBER_ROW_HEIGHT = 28;
export const BOX_PADDING = 12;
export const BOX_MIN_HEIGHT = BOX_HEADER_HEIGHT + BOX_PADDING * 2;

/** Deterministic text estimate, shared by layout and route label budgets. */
export function visualTextWidth(text: string): number {
  return [...text].reduce(
    (width, char) => width + (/[MW@]/.test(char) ? 10 : /[il .,:]/.test(char) ? 4 : 7),
    0,
  );
}
export function flowGutter(label?: string, process?: string): number {
  return Math.max(
    LANE_GAP,
    Math.min(192, visualTextWidth([process, label].filter(Boolean).join(": "))) + 32,
  );
}
/** Compatibility helper: maximum needed corridor; placement uses local gutters. */
export function laneGap(lens: VisualLens): number {
  return Math.max(LANE_GAP, ...lens.flows.map((flow) => flowGutter(flow.label, flow.process)));
}
export function controlPlaneGap(lens: VisualLens): number {
  if (lens.composition === "process") return 0;
  const controls = new Set(lens.boxes.filter((box) => box.controlPlane).map((box) => box.id));
  const count = lens.flows.filter(
    (flow) => controls.has(flow.from) || controls.has(flow.to),
  ).length;
  return Math.max(LANE_GAP, (count + 1) * 28 + 16);
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
    .map((flow) => flow.id)
    .sort();
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
  /** Free corridor after each data lane, independent of unrelated labels. */
  gutters: Record<string, number>;
}
export function boxHeight(box: VisualBox): number {
  const sole = !box.aside && box.members.length === 1 && box.members[0]?.title === box.title;
  const rows = box.summary || sole ? 0 : Math.max(1, box.members.length);
  return Math.max(
    BOX_MIN_HEIGHT,
    BOX_HEADER_HEIGHT +
      rows * BOX_MEMBER_ROW_HEIGHT +
      BOX_PADDING * 2 +
      (box.owner === "unowned" ? 24 : 0),
  );
}
const pillClearance = (box: VisualBox) =>
  box.processes?.length ? box.processes.length * 24 + 8 : 0;
const snap = (value: number) => Math.ceil(value / 8) * 8;
export function boxWidth(box: VisualBox, process = false): number {
  const labels = box.summary
    ? [box.title]
    : [box.title, ...box.members.map((member) => member.title)];
  return snap(
    Math.max(process ? 168 : 192, Math.min(288, Math.max(...labels.map(visualTextWidth)) + 56)),
  );
}

/** Physical corridors are shared by adjacent, skipping, same-lane and control routes.
 * A lane-pair index is insufficient: several different pairs can use the same corridor. */
export function visualGutterTracks(lens: VisualLens) {
  const controls = new Set(
    lens.boxes
      .filter((box) => box.controlPlane && lens.composition !== "process")
      .map((box) => box.id),
  );
  const dataLanes = lens.lanes.filter((lane) =>
    lens.boxes.some((box) => box.lane === lane.id && !controls.has(box.id)),
  );
  const columns = new Map(dataLanes.map((lane, index) => [lane.id, index]));
  const boxes = new Map(lens.boxes.map((box) => [box.id, box]));
  const uses = new Map<
    string,
    { source?: string; target?: string; control?: string; approachLeft: boolean }
  >();
  const tracks = new Map<string, string[]>();
  for (const flow of lens.flows) {
    const from = boxes.get(flow.from),
      to = boxes.get(flow.to);
    if (!from || !to) continue;
    const a = columns.get(from.lane),
      b = columns.get(to.lane);
    const fromControl = controls.has(from.id),
      toControl = controls.has(to.id);
    let use: { source?: string; target?: string; control?: string; approachLeft: boolean } = {
      approachLeft: false,
    };
    if (fromControl !== toControl) {
      const index = (fromControl ? b : a) ?? 0;
      use = { control: dataLanes[index > 0 ? index - 1 : index]?.id, approachLeft: index > 0 };
    } else if (!fromControl && a !== undefined && b !== undefined) {
      use = {
        source: dataLanes[a <= b ? a : a - 1]?.id,
        target: dataLanes[a < b ? b - 1 : b]?.id,
        approachLeft: false,
      };
    }
    uses.set(flow.id, use);
    for (const corridor of new Set(
      [use.source, use.target, use.control].filter((id): id is string => id !== undefined),
    ))
      tracks.set(corridor, [...(tracks.get(corridor) ?? []), flow.id]);
  }
  for (const ids of tracks.values()) ids.sort();
  return { dataLanes, uses, tracks };
}

export function layoutVisualLens(lens: VisualLens): VisualLayout {
  const lanes: LaidOutLane[] = [];
  const boxes: LaidOutBox[] = [];
  const process = lens.composition === "process";
  const controls = lens.boxes.filter((box) => box.controlPlane && !process);
  const isData = (box: VisualBox) => !controls.includes(box);
  const dataLanes = lens.lanes.filter((lane) =>
    lens.boxes.some((box) => box.lane === lane.id && isData(box)),
  );
  const { tracks } = visualGutterTracks(lens);
  const flowById = new Map(lens.flows.map((flow) => [flow.id, flow]));
  const gutters = Object.fromEntries(
    dataLanes.map((lane) => {
      const ids = tracks.get(lane.id) ?? [];
      const labelRoom = Math.max(
        LANE_GAP,
        ...ids.map((id) => {
          const flow = flowById.get(id)!;
          return flowGutter(flow.label, flow.process);
        }),
      );
      return [lane.id, labelRoom + ids.length * 8];
    }),
  );
  const heights = new Map(
    lens.boxes.map((box) => {
      const incident = lens.flows.filter((flow) => flow.from === box.id || flow.to === box.id);
      return [
        box.id,
        Math.max(
          boxHeight(box),
          !controls.includes(box) && incident.some((flow) => flow.label || flow.process)
            ? 24 + (incident.length + 1) * 32
            : 0,
        ),
      ];
    }),
  );
  // Comparable authored slots align across lanes and retain their position when labels/vendors change.
  const rowHeights = new Map<number, number>();
  for (const box of lens.boxes)
    if (box.slot !== undefined && isData(box))
      rowHeights.set(
        box.slot,
        Math.max(rowHeights.get(box.slot) ?? 0, heights.get(box.id)! + pillClearance(box)),
      );
  const controlsHeight = controls.length
    ? Math.max(...controls.map((box) => heights.get(box.id)! + pillClearance(box)))
    : 0;
  const controlHeight = controls.length
    ? LANE_HEADER_HEIGHT + LANE_PADDING * 2 + controlsHeight
    : 0;
  const controlGap = controls.length ? controlPlaneGap(lens) : 0;
  const dataTop = controlHeight ? controlHeight + controlGap : 0;
  const channelClearance = skipLaneFlowIds(lens).length * ROUTE_ROW_HEIGHT;
  let x = 0,
    maxLaneHeight = 0;
  for (const lane of dataLanes) {
    const members = lens.boxes.filter((box) => box.lane === lane.id && isData(box));
    const width =
      Math.max(visualTextWidth(lane.title) + 32, ...members.map((box) => boxWidth(box, process))) +
      LANE_PADDING * 2;
    const baseY = dataTop + LANE_HEADER_HEIGHT + LANE_PADDING + channelClearance;
    let y = baseY;
    for (const box of [...members].sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))) {
      if (box.slot !== undefined)
        y = Math.max(
          y,
          baseY +
            [...rowHeights]
              .filter(([slot]) => slot < box.slot!)
              .reduce((offset, [, height]) => offset + height + BOX_GAP, 0),
        );
      y += pillClearance(box);
      const height =
        box.slot !== undefined
          ? Math.max(heights.get(box.id)!, (rowHeights.get(box.slot) ?? 0) - pillClearance(box))
          : heights.get(box.id)!;
      boxes.push({
        box,
        rect: { x: x + LANE_PADDING, y, width: width - LANE_PADDING * 2, height },
      });
      y += height + BOX_GAP;
    }
    const height = Math.max(
      y - dataTop - BOX_GAP + LANE_PADDING,
      LANE_HEADER_HEIGHT + LANE_PADDING * 2,
    );
    lanes.push({ lane, rect: { x, y: dataTop, width, height } });
    maxLaneHeight = Math.max(maxLaneHeight, height);
    x += width + gutters[lane.id]!;
  }
  for (const lane of lanes) lane.rect.height = maxLaneHeight;
  const last = lanes.at(-1);
  // Only reserve a terminal corridor when a same-lane/control route actually uses it.
  const lastNeedsGutter = last && (tracks.get(last.lane.id)?.length ?? 0) > 0;
  let width = last
    ? last.rect.x + last.rect.width + (lastNeedsGutter ? gutters[last.lane.id]! : 0)
    : 0;
  if (controls.length) {
    let controlX = LANE_PADDING;
    const titles = [
      ...new Set(
        controls
          .map((box) => lens.lanes.find((lane) => lane.id === box.lane)?.title)
          .filter(Boolean),
      ),
    ];
    for (const box of controls) {
      const boxW = boxWidth(box);
      boxes.push({
        box,
        rect: {
          x: controlX,
          y: LANE_HEADER_HEIGHT + LANE_PADDING + pillClearance(box),
          width: boxW,
          height: heights.get(box.id)!,
        },
      });
      controlX += boxW + LANE_GAP;
    }
    width = Math.max(width, controlX - LANE_GAP + LANE_PADDING);
    lanes.unshift({
      lane: {
        id: "@control-plane",
        role: "vendor-cloud",
        title: titles.length === 1 ? titles[0]! : "Control plane",
      },
      rect: { x: 0, y: 0, width, height: controlHeight },
    });
  }
  return {
    lanes,
    boxes,
    bounds: { x: 0, y: 0, width, height: dataTop + maxLaneHeight || controlHeight },
    dataTop,
    gutters,
  };
}
