/**
 * DG-15 — where a dropped node lands. React Flow has no re-parenting (research §3: it is
 * DIY), so this is the rule, as a pure function over boxes in flow coordinates: the
 * deepest zone that holds the node's centre. A centre rule (not an overlap share) lets a
 * node land on a zone collapsed to its 220 × 48 chip, which is shorter than most nodes.
 * React-free.
 * P4: library gap — flow has no drop-target helper for groups
 * (docs/findings/DG-15-manual-layout.md §3).
 */
import type { Node } from "@elabs-ai/components-flow";
import { ZONE_HEADER_HEIGHT, ZONE_PADDING, isZoneNode } from "../nodes/zone-data";
import type { Move, Point } from "./layout-edits";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ZoneBox extends Box {
  id: string;
  /** Nesting depth: a top-level zone is 0. The deepest holder wins. */
  depth: number;
}

const holds = (zone: Box, x: number, y: number) =>
  x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height;

/** The zone `node` is dropped into; `null` = the top level. */
export function dropTarget(node: Box, zones: readonly ZoneBox[]): string | null {
  const x = node.x + node.width / 2;
  const y = node.y + node.height / 2;
  let best: ZoneBox | null = null;
  for (const zone of zones) {
    if (holds(zone, x, y) && (!best || zone.depth > best.depth)) best = zone;
  }
  return best?.id ?? null;
}

/**
 * Where a node dropped on a COLLAPSED zone goes, relative to that zone: below the zone's
 * (hidden) children, at the left padding, so it shows up clear of them on expand.
 */
export function slotBelow(
  children: readonly Box[],
  padding: number,
  header: number,
): { x: number; y: number } {
  const bottom = children.reduce((max, kid) => Math.max(max, kid.y + kid.height), header);
  return { x: padding, y: Math.round(bottom + padding) };
}

// ── After a gesture ──────────────────────────────────────────────────────────
// The text is written from the canvas as it was BEFORE the gesture plus the gesture itself,
// never from the canvas after the drop: the zone auto-fit has by then grown the zone a
// node was dragged out of (DG-06 `useZoneAutofit` runs on drop, before the text is written).

/** A node before the gesture, with its absolute position. */
export interface Placed {
  node: Node;
  abs: Point;
}

export type Snapshot = ReadonlyMap<string, Placed>;

const sizeOf = (node: Node) => ({
  width: node.width ?? node.measured?.width ?? 0,
  height: node.height ?? node.measured?.height ?? 0,
});

/**
 * The drops of a gesture: each dragged node (not a zone, not a note) whose box now sits in
 * another zone than its parent, at its place in that zone. Zones are taken from `start`.
 */
export function dropsOf(start: Snapshot, dragged: ReadonlyMap<string, Point>): Move[] {
  const depth = (node: Node) => {
    let d = 0;
    for (let p = node.parentId; p; p = start.get(p)?.node.parentId) d += 1;
    return d;
  };
  const zones: ZoneBox[] = [];
  for (const { node, abs } of start.values()) {
    if (isZoneNode(node) && !node.hidden) {
      zones.push({ id: node.id, depth: depth(node), ...abs, ...sizeOf(node) });
    }
  }
  const out: Move[] = [];
  for (const [id, abs] of dragged) {
    const node = start.get(id)?.node;
    if (!node || isZoneNode(node) || id.startsWith("note:")) continue;
    const into = dropTarget({ ...abs, ...sizeOf(node) }, zones);
    if (into === (node.parentId ?? null)) continue;
    const target = into === null ? undefined : start.get(into);
    let position: Point = target ? { x: abs.x - target.abs.x, y: abs.y - target.abs.y } : abs;
    if (target && isZoneNode(target.node) && target.node.data.collapsed) {
      const kids = [...start.values()]
        .filter(({ node: kid }) => kid.parentId === into)
        .map(({ node: kid }) => ({ ...kid.position, ...sizeOf(kid) }));
      position = slotBelow(kids, ZONE_PADDING, ZONE_HEADER_HEIGHT);
    }
    out.push({ id, into, position });
  }
  return out;
}

/** The nodes as the text will hold them after the gesture (before the zone auto-fit). */
export function afterGesture(
  start: Snapshot,
  dragged: ReadonlyMap<string, Point>,
  moves: readonly Move[],
): Node[] {
  const dropped = new Map(moves.map((move) => [move.id, move]));
  return [...start.values()].map(({ node }) => {
    const move = dropped.get(node.id);
    if (move) return { ...node, parentId: move.into ?? undefined, position: move.position };
    const abs = dragged.get(node.id);
    if (!abs) return node;
    const parent = node.parentId === undefined ? undefined : start.get(node.parentId);
    const origin = parent?.abs ?? { x: 0, y: 0 };
    return { ...node, position: { x: abs.x - origin.x, y: abs.y - origin.y } };
  });
}
