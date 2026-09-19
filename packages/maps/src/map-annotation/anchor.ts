/**
 * The eight label anchors a map label or annotation can sit at, relative to
 * its point. Compass-style and PHYSICAL on purpose: east of Toronto is east in
 * every writing direction, so a map label never mirrors in RTL.
 */
export type MapLabelAnchor =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

/** Every anchor, clockwise from `top` (for stories and validation). */
export const MAP_LABEL_ANCHORS: readonly MapLabelAnchor[] = [
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
  "top-left",
];

/**
 * Where a label box sits for `anchor`, `distance` px away from its point:
 * `dx` / `dy` is the attach point (the box's nearest edge or corner) relative
 * to the point, and `fx` / `fy` the box's own offset as a fraction of its
 * width / height (`0`, `-0.5` or `-1`), so the box grows away from the point.
 */
export interface MapAnchorGeometry {
  dx: number;
  dy: number;
  fx: number;
  fy: number;
}

const DIAGONAL = Math.SQRT1_2;

export function mapAnchorGeometry(anchor: MapLabelAnchor, distance: number): MapAnchorGeometry {
  const d = Math.max(0, distance);
  const k = d * DIAGONAL;
  switch (anchor) {
    case "top":
      return { dx: 0, dy: -d, fx: -0.5, fy: -1 };
    case "bottom":
      return { dx: 0, dy: d, fx: -0.5, fy: 0 };
    case "left":
      return { dx: -d, dy: 0, fx: -1, fy: -0.5 };
    case "right":
      return { dx: d, dy: 0, fx: 0, fy: -0.5 };
    case "top-left":
      return { dx: -k, dy: -k, fx: -1, fy: -1 };
    case "top-right":
      return { dx: k, dy: -k, fx: 0, fy: -1 };
    case "bottom-left":
      return { dx: -k, dy: k, fx: -1, fy: 0 };
    case "bottom-right":
      return { dx: k, dy: k, fx: 0, fy: 0 };
  }
}

/** The CSS transform that puts a label box at `anchor`, `distance` px from its point. */
export function mapAnchorTransform(anchor: MapLabelAnchor, distance: number): string {
  const { dx, dy, fx, fy } = mapAnchorGeometry(anchor, distance);
  return `translate(calc(${fx * 100}% + ${dx}px), calc(${fy * 100}% + ${dy}px))`;
}

/**
 * The shift that keeps a `width` × `height` box whose top-left corner would
 * land at (`left`, `top`) inside a `boundsWidth` × `boundsHeight` container,
 * `pad` px from every edge. A box larger than the container pins to the
 * start / top edge.
 */
export function clampShift(
  left: number,
  top: number,
  width: number,
  height: number,
  boundsWidth: number,
  boundsHeight: number,
  pad = 4,
): { sx: number; sy: number } {
  const maxLeft = Math.max(pad, boundsWidth - width - pad);
  const maxTop = Math.max(pad, boundsHeight - height - pad);
  const clampedLeft = Math.min(maxLeft, Math.max(pad, left));
  const clampedTop = Math.min(maxTop, Math.max(pad, top));
  return { sx: clampedLeft - left, sy: clampedTop - top };
}
