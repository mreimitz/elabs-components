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

/** Maps a React Flow `Position` back to the handle side it names. */
export const positionToSide: Record<Position, FlowHandleSide> = {
  [Position.Top]: "top",
  [Position.Right]: "right",
  [Position.Bottom]: "bottom",
  [Position.Left]: "left",
};

/**
 * One candidate connection point: the **measured centre of a rendered handle
 * dot**, in absolute flow coordinates, plus the side it sits on.
 *
 * This is the unit `FlowSmartEdge` routes between. Anchoring on a measured
 * handle — rather than on a point derived from the node's rectangle — is what
 * guarantees the drawn path terminates exactly on the dot the user sees,
 * whatever the handle's size, offset or CSS. See {@link pickClosestAnchors}.
 */
export interface HandleAnchor {
  /** The handle's `id`, when it has one (`FlowNode` uses the side name). */
  id: string | null;
  /** Absolute x of the handle dot's centre. */
  x: number;
  /** Absolute y of the handle dot's centre. */
  y: number;
  /** The node side the handle sits on — the bezier's control direction. */
  side: FlowHandleSide;
}

/** The chosen source/target anchor pair. */
export interface ClosestAnchors {
  source: HandleAnchor;
  target: HandleAnchor;
}

/**
 * Picks the source/target pair of **rendered handles** with the shortest
 * straight-line distance between them.
 *
 * Returns `undefined` when either side has no candidates, so the caller can
 * fall back to rectangle geometry for a node whose handles have not been
 * measured yet (React Flow populates `handleBounds` on its first measurement
 * pass; before that there is nothing to anchor to).
 */
export function pickClosestAnchors(
  sources: HandleAnchor[],
  targets: HandleAnchor[],
): ClosestAnchors | undefined {
  if (!sources.length || !targets.length) return undefined;

  let best: ClosestAnchors | undefined;
  let bestDist = Infinity;

  for (const source of sources) {
    for (const target of targets) {
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = { source, target };
      }
    }
  }

  return best;
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

/** The side pair picked by {@link pickClosestHandles}, with both anchor points. */
export interface ClosestHandles {
  sourceSide: FlowHandleSide;
  targetSide: FlowHandleSide;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

/**
 * Rectangle-only fallback: picks the closest pair of **side midpoints** from the
 * candidate sides of each node.
 *
 * `FlowSmartEdge` prefers {@link pickClosestAnchors} (measured handle centres)
 * and only reaches for this before React Flow has measured the nodes. Pass the
 * sides each node genuinely renders a handle on — passing sides that carry no
 * handle produces an anchor floating on a bare border, which is the defect this
 * module exists to avoid.
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
