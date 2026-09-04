/**
 * The `arc` layout (RM-036) — bipartite ownership: two columns of nodes joined
 * by hairline béziers.
 *
 * Closes lieflat L12 (Type Colonnade). Pure geometry — no measurement, no
 * React, no randomness.
 */

import type {
  NetworkLinkDatum,
  NetworkNodeDatum,
  NetworkPoint,
  NetworkSide,
} from "../network-types";

export interface ArcLayoutOptions {
  width: number;
  height: number;
  /** Distance kept between a column and the chart edge, in px. */
  padding: number;
}

/**
 * Which column each node belongs to, as `sides[i]` for `nodes[i]`.
 *
 * Three rules, tried in order — the first that yields two NON-EMPTY columns wins:
 *
 * 1. **Two declared groups.** Exactly two distinct `group` values → the group
 *    that appears first is the left column. The caller said what the two sides
 *    are, so nothing is inferred.
 * 2. **Link direction.** A node that is only ever a link `source` is a left
 *    column entry; everything else (a target, or a node that is both) is a
 *    right column entry. This is the "ownership" reading: owners on the left,
 *    the things owned on the right, and a node that is both is an owned thing
 *    that also owns.
 * 3. **Halve the input order.** The fallback for a graph that is not bipartite
 *    at all. Deterministic, and visibly wrong in a way that reads as "this is
 *    not a bipartite graph" rather than as a broken chart.
 */
export function partitionBipartite(
  nodes: readonly NetworkNodeDatum[],
  links: readonly NetworkLinkDatum[],
): NetworkSide[] {
  if (nodes.length === 0) return [];

  // 1 — two declared groups.
  const groupOrder: string[] = [];
  for (const node of nodes) {
    if (node.group !== undefined && !groupOrder.includes(node.group)) groupOrder.push(node.group);
  }
  if (groupOrder.length === 2 && nodes.every((n) => n.group !== undefined)) {
    return nodes.map((n) => (n.group === groupOrder[0] ? "left" : "right"));
  }

  // 2 — link direction.
  const isTarget = new Set(links.map((l) => l.target));
  const isSource = new Set(links.map((l) => l.source));
  const byRole: NetworkSide[] = nodes.map((n) =>
    isSource.has(n.id) && !isTarget.has(n.id) ? "left" : "right",
  );
  if (byRole.includes("left") && byRole.includes("right")) return byRole;

  // 3 — halve the input order.
  const half = Math.ceil(nodes.length / 2);
  return nodes.map((_, i) => (i < half ? "left" : "right"));
}

/**
 * Column positions for a pre-computed side assignment.
 *
 * Within a column, nodes keep their INPUT order and are spread evenly over the
 * usable height — the same rule for both columns, so a reader can compare
 * vertical position across the gap.
 */
export function arcPositions(
  sides: readonly NetworkSide[],
  { width, height, padding }: ArcLayoutOptions,
): NetworkPoint[] {
  const leftX = padding;
  const rightX = Math.max(leftX, width - padding);
  const counts = { left: 0, right: 0 };
  for (const side of sides) counts[side] += 1;
  const seen = { left: 0, right: 0 };
  const usable = Math.max(0, height - 2 * padding);

  return sides.map((side) => {
    const total = counts[side];
    const slot = seen[side];
    seen[side] += 1;
    const y = total <= 1 ? height / 2 : padding + ((slot + 0.5) * usable) / total;
    return { x: side === "left" ? leftX : rightX, y };
  });
}

/**
 * A hairline cubic from `a` to `b` with both control points on the midline —
 * the S-curve that keeps a dense colonnade readable, because every arc leaves
 * and arrives horizontally and so never crosses its own column.
 */
export function arcLinkPath(a: NetworkPoint, b: NetworkPoint): string {
  const mx = (a.x + b.x) / 2;
  return `M${round(a.x)},${round(a.y)}C${round(mx)},${round(a.y)} ${round(mx)},${round(b.y)} ${round(b.x)},${round(b.y)}`;
}

/** 2dp — see `circular.ts`. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
