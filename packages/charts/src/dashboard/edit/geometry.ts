/**
 * Pure edit-layer geometry (RM-078): turns a sensor's pixel delta into target cells and a
 * would-be layout. Every placement goes through the RM-070 engine (`resolveCollisions`,
 * `compact`, `snapSize`); nothing here is a second layout algorithm.
 */
import {
  collides,
  compact,
  resolveCollisions,
  snapSize,
  type CollisionStrategy,
} from "../core/layout";
import type { DashboardSpec, GridSpec, TileLayout } from "../core/spec";
import type { ResizeHandle } from "./announcer";
import type { CellPitch } from "./cell-coordinate-getter";

/** `fit` rejects overlaps (colliders stay put); `flow` pushes colliders down, then compacts. */
export function editStrategy(grid: GridSpec): CollisionStrategy {
  return grid.mode === "flow" ? "push" : "reject";
}

/** Whole cells covered by a pixel delta (nearest cell). */
export function cellDelta(delta: { x: number; y: number }, pitch: CellPitch) {
  return {
    dx: pitch.width > 0 ? Math.round(delta.x / pitch.width) : 0,
    dy: pitch.height > 0 ? Math.round(delta.y / pitch.height) : 0,
  };
}

/** Top-level tiles and containers competing for space (the store's scope for a top-level tile). */
export function topLevelLayout(spec: DashboardSpec): TileLayout[] {
  return [
    ...spec.tiles.filter((t) => !t.container).map((t) => ({ ...t.layout, id: t.id })),
    ...(spec.containers ?? []).map((c) => ({ ...c.layout, id: c.id })),
  ];
}

/** `origin` resized from `handle` by whole cells, honouring the tile's min/max/aspect. */
export function resizeFrom(
  origin: TileLayout,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  grid: GridSpec,
): TileLayout {
  const west = handle.includes("w");
  const east = handle.includes("e");
  const north = handle.startsWith("n");
  const south = handle.startsWith("s");
  const wanted = {
    w: origin.w + (east ? dx : west ? -dx : 0),
    h: origin.h + (south ? dy : north ? -dy : 0),
  };
  // Growing west/north stops at the grid's left/top edge; east stops at the last column.
  if (west) wanted.w = Math.min(wanted.w, origin.x + origin.w);
  if (north) wanted.h = Math.min(wanted.h, origin.y + origin.h);
  if (east) wanted.w = Math.min(wanted.w, Math.max(1, grid.columns - origin.x));
  const size = snapSize(wanted, origin);
  return {
    ...origin,
    ...size,
    x: west ? origin.x + origin.w - size.w : origin.x,
    y: north ? origin.y + origin.h - size.h : origin.y,
  };
}

/** The layout the sheet would have with `moved` placed, and whether that placement is allowed. */
export function previewPlacement(
  spec: DashboardSpec,
  moved: TileLayout,
): { layout: TileLayout[]; ok: boolean } {
  const scope = topLevelLayout(spec);
  const { layout, ok } = resolveCollisions(scope, moved, spec.grid, editStrategy(spec.grid));
  if (!ok) return { layout: scope, ok };
  const out = spec.grid.mode === "flow" ? compact(layout, spec.grid) : layout;
  const overlaps = out.some((a, i) => out.slice(i + 1).some((b) => collides(a, b)));
  return { layout: out, ok: !overlaps };
}

/** `spec` with each top-level tile's and container's cells taken from `layout`. */
export function applyLayout(spec: DashboardSpec, layout: readonly TileLayout[]): DashboardSpec {
  const byId = new Map(layout.map((item) => [item.id, item]));
  const cells = (id: string, current: Omit<TileLayout, "id">) => {
    const next = byId.get(id);
    return next ? { ...current, x: next.x, y: next.y, w: next.w, h: next.h } : current;
  };
  const out: DashboardSpec = {
    ...spec,
    tiles: spec.tiles.map((t) => (t.container ? t : { ...t, layout: cells(t.id, t.layout) })),
  };
  if (spec.containers)
    out.containers = spec.containers.map((c) => ({ ...c, layout: cells(c.id, c.layout) }));
  return out;
}
