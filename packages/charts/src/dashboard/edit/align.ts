/**
 * align.ts (RM-081) — pure alignment/distribution maths over `TileLayout[]`. No React, no
 * store: `core/store.ts`'s `alignTiles`/`distributeTiles` actions call these, then commit the
 * result as one history step after checking the result does not overlap (see the store's own
 * `collides`-based check, the same primitive `resolveCollisions`'s `"reject"` strategy uses).
 */
import type { TileLayout } from "../core/spec";

/** Which edge (or centre line) a multi-selection aligns to. */
export type AlignEdge = "left" | "right" | "top" | "bottom" | "center-h" | "center-v";

/** Which axis a multi-selection distributes along. */
export type DistributeAxis = "h" | "v";

function applyTo(
  layout: readonly TileLayout[],
  targets: readonly TileLayout[],
  next: (item: TileLayout) => Partial<TileLayout>,
): TileLayout[] {
  const patch = new Map(targets.map((item) => [item.id, next(item)]));
  return layout.map((item) => (patch.has(item.id) ? { ...item, ...patch.get(item.id) } : item));
}

/**
 * Align every tile in `ids` to a shared edge or centre line. A no-op (returns `layout`
 * unchanged) with fewer than two matching ids — there is nothing to align to.
 */
export function alignTiles(
  layout: readonly TileLayout[],
  ids: readonly string[],
  edge: AlignEdge,
): TileLayout[] {
  const idSet = new Set(ids);
  const targets = layout.filter((item) => idSet.has(item.id));
  if (targets.length < 2) return [...layout];

  switch (edge) {
    case "left": {
      const x = Math.min(...targets.map((item) => item.x));
      return applyTo(layout, targets, () => ({ x }));
    }
    case "right": {
      const right = Math.max(...targets.map((item) => item.x + item.w));
      return applyTo(layout, targets, (item) => ({ x: right - item.w }));
    }
    case "top": {
      const y = Math.min(...targets.map((item) => item.y));
      return applyTo(layout, targets, () => ({ y }));
    }
    case "bottom": {
      const bottom = Math.max(...targets.map((item) => item.y + item.h));
      return applyTo(layout, targets, (item) => ({ y: bottom - item.h }));
    }
    case "center-h": {
      const minX = Math.min(...targets.map((item) => item.x));
      const maxX = Math.max(...targets.map((item) => item.x + item.w));
      const center = (minX + maxX) / 2;
      return applyTo(layout, targets, (item) => ({ x: Math.round(center - item.w / 2) }));
    }
    case "center-v": {
      const minY = Math.min(...targets.map((item) => item.y));
      const maxY = Math.max(...targets.map((item) => item.y + item.h));
      const center = (minY + maxY) / 2;
      return applyTo(layout, targets, (item) => ({ y: Math.round(center - item.h / 2) }));
    }
    default:
      return [...layout];
  }
}

/**
 * Space every tile in `ids` evenly along `axis`, keeping the first and last (by position)
 * fixed. A no-op with fewer than three matching ids — distribution needs a middle to move.
 */
export function distributeTiles(
  layout: readonly TileLayout[],
  ids: readonly string[],
  axis: DistributeAxis,
): TileLayout[] {
  const idSet = new Set(ids);
  const targets = layout.filter((item) => idSet.has(item.id));
  if (targets.length < 3) return [...layout];

  const sorted = [...targets].sort((a, b) => (axis === "h" ? a.x - b.x : a.y - b.y));
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const span = axis === "h" ? last.x + last.w - first.x : last.y + last.h - first.y;
  const totalSize = sorted.reduce((sum, item) => sum + (axis === "h" ? item.w : item.h), 0);
  const gap = (span - totalSize) / (sorted.length - 1);

  let cursor = axis === "h" ? first.x : first.y;
  const patch = new Map<string, Partial<TileLayout>>();
  for (const item of sorted) {
    if (axis === "h") {
      patch.set(item.id, { x: Math.round(cursor) });
      cursor += item.w + gap;
    } else {
      patch.set(item.id, { y: Math.round(cursor) });
      cursor += item.h + gap;
    }
  }
  return layout.map((item) => (patch.has(item.id) ? { ...item, ...patch.get(item.id) } : item));
}
