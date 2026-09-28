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
import { fitZones } from "../nodes/use-zone-autofit";
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

// ── Bounded growth (wave-3 review F7) ───────────────────────────────────────
// A zone wraps its children (DG-06 auto-fit, view-only), so a node dropped low in a zone, or
// on its chip (`slotBelow`), grew the zone over the zone below it: Lakehouse LR, okta dropped
// at Snowflake's bottom edge → 13 px into Databricks' header; on the chip → 68 px, okta itself
// on that header. Pushing the neighbour would move it on the canvas but not in the text (or
// write more than the one dropped node). So the drop is bounded instead: when the zone, grown
// round the node, would cover a node or zone it did not already cover, the node goes to the
// nearest spot (from where it was dropped) where the grown zone — and every zone around it —
// covers nothing new, clear of the zone's own children where there is room. Still one
// `position:` plus `parent:`.

/** Clearance kept between a grown zone and its neighbours, and between siblings, in flow px. */
const CLEARANCE = ZONE_PADDING;
/** The search grid, in flow px. */
const STEP = 8;

const overlaps = (a: Box, b: Box, gap: number) =>
  a.x < b.x + b.width + gap &&
  b.x < a.x + a.width + gap &&
  a.y < b.y + b.height + gap &&
  b.y < a.y + a.height + gap;

/** Every visible node's absolute box. */
function boxesOf(nodes: readonly Node[]): Map<string, Box> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const out = new Map<string, Box>();
  for (const node of nodes) {
    if (node.hidden) continue;
    let { x, y } = node.position;
    for (let p = node.parentId; p !== undefined; p = byId.get(p)?.parentId) {
      x += byId.get(p)?.position.x ?? 0;
      y += byId.get(p)?.position.y ?? 0;
    }
    out.set(node.id, { x, y, ...sizeOf(node) });
  }
  return out;
}

/**
 * What the zones around `zone` (it and its ancestors) cover once fitted, for each node or zone
 * outside a zone's own family (itself, an ancestor, a descendant): "near zone|other" when the
 * fitted box comes within `CLEARANCE` of it, "over zone|other" when it overlaps it. Two keys,
 * so a zone that already sat close to a neighbour may still not grow INTO it.
 */
function coverage(nodes: readonly Node[], zone: string): Set<string> {
  const fitted = fitZones([...nodes]);
  const byId = new Map(fitted.map((node) => [node.id, node]));
  const boxes = boxesOf(fitted);
  const chainOf = (id: string) => {
    const out = [id];
    for (let p = byId.get(id)?.parentId; p !== undefined; p = byId.get(p)?.parentId) out.push(p);
    return out;
  };
  const out = new Set<string>();
  for (const z of chainOf(zone)) {
    const box = boxes.get(z);
    if (!box) continue;
    for (const [other, otherBox] of boxes) {
      const family = other === z || chainOf(other).includes(z) || chainOf(z).includes(other);
      if (family) continue;
      if (overlaps(box, otherBox, CLEARANCE)) out.add(`near ${z}|${other}`);
      if (overlaps(box, otherBox, 0)) out.add(`over ${z}|${other}`);
    }
  }
  return out;
}

/**
 * `nodes` as they look with `zone` open: a zone collapsed on the canvas comes back at its
 * snapshot place with its children, so check the drop against its expanded size (flow's
 * `expandGroup` shows every descendant not inside a zone that is itself collapsed).
 */
function opened(nodes: readonly Node[], zone: string): Node[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const target = byId.get(zone);
  if (!target || !isZoneNode(target) || !target.data.collapsed) return [...nodes];
  const shows = (node: Node) => {
    for (let p = node.parentId; p !== undefined; p = byId.get(p)?.parentId) {
      if (p === zone) return true;
      const parent = byId.get(p);
      if (parent && isZoneNode(parent) && parent.data.collapsed) return false;
    }
    return false;
  };
  return nodes.map((node) =>
    node.id === zone && isZoneNode(node)
      ? { ...node, data: { ...node.data, collapsed: false } }
      : node.hidden && shows(node)
        ? { ...node, hidden: false }
        : node,
  );
}

/**
 * Where `id` goes in `zone` (relative to it): `wanted` when the zone, grown round it, covers
 * nothing new. Otherwise the nearest spot to `wanted` on an 8 px grid — below the header and
 * right of the padding (so the zone itself never moves), out to the drop or one column/row past
 * the children — taking the first kind that exists: clear of the zone's children with nothing
 * new within `CLEARANCE`; clear of the children and over nothing new; over nothing new. None
 * (nothing fits anywhere): `wanted`, as before.
 */
export function boundedDrop(
  nodes: readonly Node[],
  id: string,
  zone: string,
  wanted: Point,
): Point {
  const base = opened(nodes, zone);
  const node = base.find((candidate) => candidate.id === id);
  if (!node) return wanted;
  const before = coverage(base, zone);
  const place = (at: Point) =>
    base.map((other) => (other.id === id ? { ...other, parentId: zone, position: at } : other));
  const hits = new Map<Point, string[]>();
  const fresh = (at: Point) => {
    let out = hits.get(at);
    if (!out) {
      out = [...coverage(place(at), zone)].filter((hit) => !before.has(hit));
      hits.set(at, out);
    }
    return out;
  };
  const growsInto = (at: Point) => fresh(at).some((hit) => hit.startsWith("over "));
  if (fresh(wanted).length === 0) return wanted;

  const { width, height } = sizeOf(node);
  const kids = base
    .filter((kid) => kid.parentId === zone && kid.id !== id && !kid.hidden)
    .map((kid) => ({ ...kid.position, ...sizeOf(kid) }));
  const wrap = kids.reduce(
    (box, kid) => ({
      width: Math.max(box.width, kid.x + kid.width + ZONE_PADDING),
      height: Math.max(box.height, kid.y + kid.height + ZONE_PADDING),
    }),
    { width: 0, height: 0 },
  );
  const x0 = ZONE_PADDING;
  const y0 = ZONE_HEADER_HEIGHT + ZONE_PADDING;
  // As far as the drop, or just past the children (a new column or row), whichever is further.
  const x1 = Math.max(wanted.x, wrap.width - ZONE_PADDING + CLEARANCE);
  const y1 = Math.max(wanted.y, wrap.height - ZONE_PADDING + CLEARANCE);
  const grid = (from: number, to: number) => {
    const out: number[] = [];
    for (let v = from; v < to; v += STEP) out.push(v);
    return [...out, to];
  };
  const spots = grid(x0, x1).flatMap((x) => grid(y0, y1).map((y) => ({ x, y })));
  spots.sort(
    (a, b) =>
      Math.hypot(a.x - wanted.x, a.y - wanted.y) - Math.hypot(b.x - wanted.x, b.y - wanted.y),
  );
  const clear = (at: Point) =>
    !kids.some((kid) => overlaps({ ...at, width, height }, kid, CLEARANCE));
  return (
    // Clear of its siblings, nothing new within reach of the grown zones…
    spots.find((at) => clear(at) && fresh(at).length === 0) ??
    // …or closer than the clearance, but over nothing…
    spots.find((at) => clear(at) && !growsInto(at)) ??
    // …or, in a zone boxed in on every side, over one of its new siblings rather than the
    // zone over a neighbour (it can be moved in the zone; the neighbour's header stays whole).
    spots.find((at) => !growsInto(at)) ??
    wanted
  );
}

/**
 * The drops of a gesture: each dragged node (not a zone, not a note) whose box now sits in
 * another zone than its parent, at its place in that zone. Zones are taken from `start`.
 * The place is bounded (`boundedDrop`) so the zone's growth covers no neighbour.
 */
export function dropsOf(start: Snapshot, dragged: ReadonlyMap<string, Point>): Move[] {
  const depth = (node: Node) => {
    let d = 0;
    for (let p = node.parentId; p; p = start.get(p)?.node.parentId) d += 1;
    return d;
  };
  const zones: ZoneBox[] = [];
  for (const { node, abs } of start.values()) {
    if (
      isZoneNode(node) &&
      !node.hidden &&
      node.data.component === undefined &&
      node.data.inner !== true
    ) {
      zones.push({ id: node.id, depth: depth(node), ...abs, ...sizeOf(node) });
    }
  }
  const out: Move[] = [];
  for (const [id, abs] of dragged) {
    const node = start.get(id)?.node;
    if (!node || isZoneNode(node) || node.data.inner === true || id.startsWith("note:")) continue;
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
    if (into !== null) {
      const nodes = [...start.values()].map(({ node: n }) => n);
      position = boundedDrop(nodes, id, into, position);
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
