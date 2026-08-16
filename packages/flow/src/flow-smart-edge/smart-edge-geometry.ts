import { Position } from "@xyflow/react";
import type { FlowHandleSide } from "../flow-node";

/** Axis-aligned node rectangle in absolute flow coordinates. */
export interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** All four candidate handle sides, in a stable order. */
export const HANDLE_SIDES: FlowHandleSide[] = ["top", "right", "bottom", "left"];

/** Maps a handle side to the React Flow `Position` used for bezier control. */
export const sideToPosition: Record<FlowHandleSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

/** Center point of a node rectangle. */
export function rectCenter(rect: NodeRect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/**
 * The connection point on `side` of `rect`, slid along that side toward
 * `toward` and clamped `inset` px from the corners. This is what stops two
 * edges that both leave the same side (e.g. both targets sit to the right)
 * from piling onto the side's midpoint: each edge's anchor slides toward its
 * own target, so an up-going edge exits the upper part of the side and a
 * down-going edge the lower part — each visibly meeting the node on the side
 * that faces its target instead of stacking in the middle.
 */
export function slideAnchor(
  rect: NodeRect,
  side: FlowHandleSide,
  toward: { x: number; y: number },
  inset = 12,
): { x: number; y: number } {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  // Never let the inset invert the usable range on a small node.
  const ix = Math.min(inset, rect.width / 2);
  const iy = Math.min(inset, rect.height / 2);
  switch (side) {
    case "top":
      return { x: clamp(toward.x, rect.x + ix, rect.x + rect.width - ix), y: rect.y };
    case "bottom":
      return { x: clamp(toward.x, rect.x + ix, rect.x + rect.width - ix), y: rect.y + rect.height };
    case "left":
      return { x: rect.x, y: clamp(toward.y, rect.y + iy, rect.y + rect.height - iy) };
    case "right":
      return { x: rect.x + rect.width, y: clamp(toward.y, rect.y + iy, rect.y + rect.height - iy) };
  }
}

/** Absolute coordinate of a handle on the given side (the side's midpoint). */
export function handlePoint(rect: NodeRect, side: FlowHandleSide): { x: number; y: number } {
  switch (side) {
    case "top":
      return { x: rect.x + rect.width / 2, y: rect.y };
    case "bottom":
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
    case "left":
      return { x: rect.x, y: rect.y + rect.height / 2 };
    case "right":
      return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
  }
}

/** The chosen source/target handle pair plus their absolute anchor points. */
export interface ClosestHandles {
  sourceSide: FlowHandleSide;
  targetSide: FlowHandleSide;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

/**
 * Picks the source/target handle pair (one handle per node) with the shortest
 * straight-line distance between their anchor points. Empty side lists fall
 * back to all four sides so an edge always resolves to a pair.
 */
export function pickClosestHandles(
  source: NodeRect,
  sourceSides: FlowHandleSide[],
  target: NodeRect,
  targetSides: FlowHandleSide[],
): ClosestHandles {
  const srcSides = sourceSides.length ? sourceSides : HANDLE_SIDES;
  const tgtSides = targetSides.length ? targetSides : HANDLE_SIDES;

  let best: ClosestHandles | undefined;
  let bestDist = Infinity;

  for (const s of srcSides) {
    const sp = handlePoint(source, s);
    for (const t of tgtSides) {
      const tp = handlePoint(target, t);
      const dx = tp.x - sp.x;
      const dy = tp.y - sp.y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = { sourceSide: s, targetSide: t, sx: sp.x, sy: sp.y, tx: tp.x, ty: tp.y };
      }
    }
  }

  // srcSides/tgtSides are non-empty (fallback above), so best is always set.
  return best as ClosestHandles;
}
