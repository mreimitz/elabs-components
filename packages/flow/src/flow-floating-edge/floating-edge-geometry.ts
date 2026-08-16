import { Position } from "@xyflow/react";

/**
 * The minimal live node geometry `getEdgeParams` needs. A React Flow
 * `InternalNode` satisfies this structurally (`internals.positionAbsolute` +
 * `measured`), so you can pass one directly; tests can pass a plain fake.
 */
export interface FloatingNodeGeometry {
  internals: { positionAbsolute: { x: number; y: number } };
  measured: { width?: number; height?: number };
}

interface Point {
  x: number;
  y: number;
}

/**
 * The point where the line from `intersectionNode`'s center to `targetNode`'s
 * center crosses `intersectionNode`'s rectangle border. Standard React Flow
 * floating-edge math (ellipse-normalized).
 */
function getNodeIntersection(
  intersectionNode: FloatingNodeGeometry,
  targetNode: FloatingNodeGeometry,
): Point {
  const w = (intersectionNode.measured.width ?? 0) / 2;
  const h = (intersectionNode.measured.height ?? 0) / 2;
  const pos = intersectionNode.internals.positionAbsolute;
  const targetPos = targetNode.internals.positionAbsolute;

  const x2 = pos.x + w;
  const y2 = pos.y + h;
  const x1 = targetPos.x + (targetNode.measured.width ?? 0) / 2;
  const y1 = targetPos.y + (targetNode.measured.height ?? 0) / 2;

  // A not-yet-measured node has w/h = 0; guard the divisions so we return the
  // node's position (finite) instead of NaN (which would break the edge path and
  // make the line appear to end at a random spot until measurement lands).
  const safeW = w || 1;
  const safeH = h || 1;

  const xx1 = (x1 - x2) / (2 * safeW) - (y1 - y2) / (2 * safeH);
  const yy1 = (x1 - x2) / (2 * safeW) + (y1 - y2) / (2 * safeH);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  const x = safeW * (xx3 + yy3) + x2;
  const y = safeH * (-xx3 + yy3) + y2;

  return { x, y };
}

/**
 * Snap `point` exactly onto `node`'s nearest border side. The intersection math
 * already lands on the border for a measured node; this guarantees it (removing
 * any sub-pixel drift that would leave the anchor a hair inside the node) and
 * gives a sensible on-border fallback if a point ever lands inside. Returns the
 * point unchanged when the node has no measured size yet.
 */
function clampToBorder(point: Point, node: FloatingNodeGeometry): Point {
  const x0 = node.internals.positionAbsolute.x;
  const y0 = node.internals.positionAbsolute.y;
  const w = node.measured.width ?? 0;
  const h = node.measured.height ?? 0;
  if (w <= 0 || h <= 0) return point;

  const cx = Math.min(Math.max(point.x, x0), x0 + w);
  const cy = Math.min(Math.max(point.y, y0), y0 + h);
  // Distance from the (clamped-inside) point to each side; snap to the nearest.
  const dLeft = cx - x0;
  const dRight = x0 + w - cx;
  const dTop = cy - y0;
  const dBottom = y0 + h - cy;
  const nearest = Math.min(dLeft, dRight, dTop, dBottom);
  if (nearest === dLeft) return { x: x0, y: cy };
  if (nearest === dRight) return { x: x0 + w, y: cy };
  if (nearest === dTop) return { x: cx, y: y0 };
  return { x: cx, y: y0 + h };
}

/** Which border of `node` the intersection `point` sits on. */
function getEdgeBorderPosition(node: FloatingNodeGeometry, point: Point): Position {
  const nx = Math.round(node.internals.positionAbsolute.x);
  const ny = Math.round(node.internals.positionAbsolute.y);
  const px = Math.round(point.x);
  const py = Math.round(point.y);
  const w = node.measured.width ?? 0;
  const h = node.measured.height ?? 0;

  if (px <= nx + 1) return Position.Left;
  if (px >= nx + w - 1) return Position.Right;
  if (py <= ny + 1) return Position.Top;
  if (py >= ny + h - 1) return Position.Bottom;
  return Position.Top;
}

/** Border anchor points + `Position`s for a floating edge between two nodes. */
export interface EdgeParams {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  sourcePos: Position;
  targetPos: Position;
}

/**
 * Computes where a floating edge attaches to each node's border — the
 * intersection of the center-to-center line with each rectangle — plus the
 * border `Position`. Recompute per render so anchors track dragging nodes.
 */
export function getEdgeParams(
  source: FloatingNodeGeometry,
  target: FloatingNodeGeometry,
): EdgeParams {
  const sourceIntersection = clampToBorder(getNodeIntersection(source, target), source);
  const targetIntersection = clampToBorder(getNodeIntersection(target, source), target);

  return {
    sx: sourceIntersection.x,
    sy: sourceIntersection.y,
    tx: targetIntersection.x,
    ty: targetIntersection.y,
    sourcePos: getEdgeBorderPosition(source, sourceIntersection),
    targetPos: getEdgeBorderPosition(target, targetIntersection),
  };
}
