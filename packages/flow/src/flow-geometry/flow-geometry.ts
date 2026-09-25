import { Position } from "@xyflow/react";

/** A node side that can carry a handle. Doubles as the handle's stable id on `FlowNode`. */
export type FlowHandleSide = "top" | "right" | "bottom" | "left";

/** All four candidate handle sides, in a stable order. */
export const HANDLE_SIDES: FlowHandleSide[] = ["top", "right", "bottom", "left"];

/** Maps a handle side to the React Flow `Position` it is drawn at. */
export const sideToPosition: Record<FlowHandleSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

/** Maps a React Flow `Position` back to the handle side it names. */
export const positionToSide: Record<Position, FlowHandleSide> = {
  [Position.Top]: "top",
  [Position.Right]: "right",
  [Position.Bottom]: "bottom",
  [Position.Left]: "left",
};

/** Axis-aligned node rectangle in absolute flow coordinates. */
export interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A node's box size, in px. */
export interface NodeSize {
  width: number;
  height: number;
}

/**
 * React Flow's own default node box. The layout engines assume it for a node that has
 * not been measured yet and carries no explicit `width`/`height`.
 */
export const FLOW_DEFAULT_NODE_SIZE: Readonly<NodeSize> = { width: 172, height: 40 };

/** The size fields a node carries — `measured` (set by React Flow) wins over `width`/`height`. */
export interface SizedNode {
  measured?: { width?: number; height?: number };
  width?: number;
  height?: number;
}

/**
 * A node's size: its `measured` box, else its explicit `width`/`height`, else
 * `fallback` — `FLOW_DEFAULT_NODE_SIZE` for a layout engine, `{ width: 0, height: 0 }`
 * for geometry that must not invent a box it has not seen.
 */
export function flowNodeSize(
  node: SizedNode,
  fallback: Readonly<NodeSize> = FLOW_DEFAULT_NODE_SIZE,
): NodeSize {
  return {
    width: node.measured?.width ?? node.width ?? fallback.width,
    height: node.measured?.height ?? node.height ?? fallback.height,
  };
}
