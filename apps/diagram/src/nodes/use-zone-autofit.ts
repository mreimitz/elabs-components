import { useEffect, useRef } from "react";
import { getNodesBounds, type Node } from "@xyflow/react";
import {
  ZONE_HEADER_HEIGHT,
  ZONE_MIN_HEIGHT,
  ZONE_MIN_WIDTH,
  ZONE_PADDING,
  isZoneNode,
} from "./zone-data";

/** Sub-pixel noise (ELK floats, measured sizes) is not a change. */
const EPSILON = 0.5;

type Size = { width: number; height: number };

/**
 * A node's box size for fitting. A zone's own `width`/`height` is the truth the moment
 * this pass writes it (its `measured` lags one render behind); a leaf's `measured` is
 * what React Flow actually drew.
 */
function sizeOf(node: Node): Size {
  if (isZoneNode(node)) {
    return {
      width: node.width ?? node.measured?.width ?? 0,
      height: node.height ?? node.measured?.height ?? 0,
    };
  }
  return {
    width: node.measured?.width ?? node.width ?? 0,
    height: node.measured?.height ?? node.height ?? 0,
  };
}

type BoundsLookup = NonNullable<Parameters<typeof getNodesBounds>[1]>["nodeLookup"];

/** Bounds of sibling nodes in their shared parent's coordinates. */
function childBounds(kids: Node[]) {
  // P4: library gap — `getNodesBounds` warns in development unless it is given a
  // `nodeLookup`, even for siblings of one parent, where relative positions are exactly
  // what a fit needs. A lookup of PLAIN nodes (no `internals`) makes it read `position`
  // (parent-relative) and stays quiet. DG-06-zone-primitives.md, "Auto-fit".
  const nodeLookup = new Map(
    kids.map((kid) => [kid.id, { ...kid, measured: sizeOf(kid) }]),
  ) as unknown as BoundsLookup;
  return getNodesBounds(
    kids.map((kid) => kid.id),
    { nodeLookup },
  );
}

function depthOf(node: Node, byId: Map<string, Node>): number {
  let depth = 0;
  const seen = new Set<string>();
  let parentId = node.parentId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    depth += 1;
    parentId = byId.get(parentId)?.parentId;
  }
  return depth;
}

/**
 * Wrap every auto-sized zone around its visible children — a pure transform that returns
 * the SAME array when nothing changes (the loop guard: a no-op `setNodes` bails out).
 *
 * Zones are processed deepest first, so a parent sees its child zones' new sizes. For each
 * zone: `bounds` = its children's box; the zone grows or shrinks so the box sits `padding`
 * in from the right and bottom; if a child crossed the left edge (`bounds.x < padding`) or
 * rose into the header band (`bounds.y < header + padding`), the zone moves by that
 * deficit and every child moves by the opposite amount, so nothing jumps on screen.
 * Skipped: `data.sizing === "manual"`, `data.collapsed`, hidden zones, empty zones.
 */
export function fitZones(
  nodes: Node[],
  padding = ZONE_PADDING,
  header = ZONE_HEADER_HEIGHT,
): Node[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const childIds = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId || node.hidden) continue;
    const list = childIds.get(node.parentId);
    if (list) list.push(node.id);
    else childIds.set(node.parentId, [node.id]);
  }

  const zones = nodes.filter(isZoneNode).sort((a, b) => depthOf(b, byId) - depthOf(a, byId));
  const next = new Map<string, Node>();
  const current = (id: string): Node => next.get(id) ?? byId.get(id)!;

  for (const zoneNode of zones) {
    const zone = current(zoneNode.id);
    if (!isZoneNode(zone) || zone.hidden) continue;
    if (zone.data.collapsed || zone.data.sizing === "manual") continue;
    const kids = (childIds.get(zone.id) ?? []).map(current);
    if (kids.length === 0) continue;

    const bounds = childBounds(kids);
    const dx = Math.min(0, bounds.x - padding);
    const dy = Math.min(0, bounds.y - (header + padding));
    const width = Math.max(ZONE_MIN_WIDTH, bounds.x - dx + bounds.width + padding);
    const height = Math.max(ZONE_MIN_HEIGHT, bounds.y - dy + bounds.height + padding);
    const was = sizeOf(zone);
    const moved = dx < -EPSILON || dy < -EPSILON;
    const resized =
      Math.abs(width - was.width) > EPSILON || Math.abs(height - was.height) > EPSILON;
    if (!moved && !resized) continue;

    next.set(zone.id, {
      ...zone,
      position: moved ? { x: zone.position.x + dx, y: zone.position.y + dy } : zone.position,
      width,
      height,
    });
    if (moved) {
      for (const kid of kids) {
        next.set(kid.id, {
          ...kid,
          position: { x: kid.position.x - dx, y: kid.position.y - dy },
        });
      }
    }
  }

  if (next.size === 0) return nodes;
  return nodes.map((node) => next.get(node.id) ?? node);
}

/** What a fit depends on — selection, data text and z-order changes do not refit. */
function geometryKey(nodes: Node[]): string {
  return nodes
    .map((node) => {
      const { width, height } = sizeOf(node);
      const zone = isZoneNode(node) ? node.data : undefined;
      return [
        node.id,
        node.parentId ?? "",
        Math.round(node.position.x),
        Math.round(node.position.y),
        Math.round(width),
        Math.round(height),
        node.hidden ? 1 : 0,
        zone?.collapsed ? 1 : 0,
        zone?.sizing ?? "",
      ].join(":");
    })
    .join("|");
}

/**
 * DG-06 — keep zones wrapped around their children. Runs after every `nodes` change
 * whose geometry changed (a hash of positions, sizes, parents, collapse and sizing), and
 * holds still while anything is being dragged or resized, so a zone grows on DROP rather
 * than chasing the pointer. Children must not carry `extent: "parent"` — React Flow would
 * clamp the drag at the zone's edge and there would be nothing to grow into.
 *
 * P4: library gap — React Flow never fits a parent to its children (`expandParent` only
 * grows the direct parent, only to the edge, with no header or padding and no shrink);
 * the plan's home for this is `useFlowGroups` (DG-06-zone-primitives.md, "Auto-fit").
 */
export function useZoneAutofit(
  nodes: Node[],
  setNodes: (updater: (nodes: Node[]) => Node[]) => void,
  padding = ZONE_PADDING,
  header = ZONE_HEADER_HEIGHT,
): void {
  const lastKey = useRef("");

  useEffect(() => {
    if (nodes.some((node) => node.dragging || node.resizing)) return;
    const key = geometryKey(nodes);
    if (key === lastKey.current) return;
    lastKey.current = key;

    const fitted = fitZones(nodes, padding, header);
    if (fitted === nodes) return;
    if (process.env.NODE_ENV !== "production") {
      const changed = fitted.filter((node, i) => node !== nodes[i] && isZoneNode(node));
      console.debug(`[DG-06] auto-fit: ${changed.map((node) => node.id).join(", ")}`);
    }
    setNodes((latest) => (latest === nodes ? fitted : fitZones(latest, padding, header)));
  }, [nodes, setNodes, padding, header]);
}
