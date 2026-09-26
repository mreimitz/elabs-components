import { getEdgeParams, type FloatingNodeGeometry } from "@elabs-ai/components-flow";
import type { Position } from "@xyflow/react";

/**
 * Node types that are ZONES (a rectangle other nodes sit in). `arch/zone` is DG-06's
 * zone node; `group` is the built-in `FlowGroupNode`, the stand-in until DG-06 lands.
 */
export const ZONE_NODE_TYPES: readonly string[] = ["arch/zone", "group"];

/** Whether an endpoint node is a zone — its edge end may float on the zone's border. */
export function isZoneNode(node: { type?: string } | undefined | null): boolean {
  return node?.type !== undefined && ZONE_NODE_TYPES.includes(node.type);
}

/** One end of an edge: a point in flow coordinates plus the side it leaves from. */
export interface EdgeEnd {
  x: number;
  y: number;
  position: Position;
}

/** A zero-size geometry at `(x, y)` — lets `getEdgeParams` aim a zone's border at a handle point. */
function pointGeometry(x: number, y: number): FloatingNodeGeometry {
  return { internals: { positionAbsolute: { x, y } }, measured: { width: 0, height: 0 } };
}

/** A node that has been measured — `getEdgeParams` needs a real width and height. */
function isMeasured(node: FloatingNodeGeometry | undefined): node is FloatingNodeGeometry {
  return Boolean(node?.measured.width && node.measured.height);
}

/**
 * Resolves both ends of a flow. A ZONE end, when `floating`, moves onto the zone's
 * rectangle border at the point facing the other end — the rectangle intersection is
 * the library's `getEdgeParams` (`@elabs-ai/components-flow`, `floating-edge-geometry.ts`),
 * not app math. A LEAF end never floats: it stays on its measured handle (React Flow's
 * `sourceX/sourceY`), as `.claude/rules/flow-maps-editor.md` requires. So:
 *
 * - leaf → leaf: both handles, unchanged
 * - leaf → zone: the zone's border point facing the leaf's handle
 * - zone → zone: both border points on the centre-to-centre line
 *
 * The geometry is read from the live internal node, so an endpoint follows the zone when
 * it is resized or collapsed (its measured size changes and the edge re-renders).
 */
export function resolveEdgeEnds(args: {
  floating: boolean;
  source: EdgeEnd;
  target: EdgeEnd;
  sourceNode?: (FloatingNodeGeometry & { type?: string }) | null;
  targetNode?: (FloatingNodeGeometry & { type?: string }) | null;
}): { source: EdgeEnd; target: EdgeEnd } {
  const { floating, source, target } = args;
  const sourceNode = args.sourceNode ?? undefined;
  const targetNode = args.targetNode ?? undefined;
  if (!floating) return { source, target };

  const sourceFloats = isZoneNode(sourceNode) && isMeasured(sourceNode);
  const targetFloats = isZoneNode(targetNode) && isMeasured(targetNode);

  if (sourceFloats && targetFloats) {
    const p = getEdgeParams(sourceNode, targetNode);
    return {
      source: { x: p.sx, y: p.sy, position: p.sourcePos },
      target: { x: p.tx, y: p.ty, position: p.targetPos },
    };
  }
  if (sourceFloats) {
    const p = getEdgeParams(sourceNode, pointGeometry(target.x, target.y));
    return { source: { x: p.sx, y: p.sy, position: p.sourcePos }, target };
  }
  if (targetFloats) {
    // Swapped so the zone is `getEdgeParams`' source: its `s*` fields are the zone side.
    const p = getEdgeParams(targetNode, pointGeometry(source.x, source.y));
    return { source, target: { x: p.sx, y: p.sy, position: p.sourcePos } };
  }
  return { source, target };
}
