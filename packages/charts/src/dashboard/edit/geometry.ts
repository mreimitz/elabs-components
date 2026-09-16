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

// silent-clamp fix (RM-078 follow-up 5): a keyboard move/resize step whose accumulated delta
// changed but whose CLAMPED target cells did not (grid edge, or a min/max size limit) used to
// return without announcing anything (`retarget`'s own `if (!moved) return`) — a keyboard user
// holding the same arrow at a boundary got total silence. `stepEdge` turns the sign of the
// step that just landed there into the compass word the announcement quotes ("At the right
// edge…"); it needs no geometry beyond the sign the caller already has (the accumulated delta
// before vs after this call), and arrow steps are always single-axis
// (`cell-coordinate-getter.ts`'s `arrowCellStep`), so this never has to arbitrate a diagonal.
/** The compass edge a step's sign points toward, or `null` for no step (both deltas zero) —
 * used only to word an "at the edge" announcement when a step's target did not move. */
export function stepEdge(stepDx: number, stepDy: number): ResizeHandle | null {
  const west = stepDx < 0;
  const east = stepDx > 0;
  const north = stepDy < 0;
  const south = stepDy > 0;
  if (north && west) return "nw";
  if (north && east) return "ne";
  if (south && west) return "sw";
  if (south && east) return "se";
  if (north) return "n";
  if (south) return "s";
  if (west) return "w";
  if (east) return "e";
  return null;
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
