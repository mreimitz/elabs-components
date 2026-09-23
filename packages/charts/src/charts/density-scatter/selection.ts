/**
 * density-scatter/selection.ts — the intersection selection, resolved once.
 *
 * Framework-free. Four independent constraints — an x range, a y range, a
 * lasso polygon and a zone set — combine by AND: a point is selected only
 * when it passes every constraint that is set. The result is one byte per
 * point (255 selected / 0 not), recomputed on a selection change, never per
 * frame; the renderer only reads it.
 */

import { DENSITY_OUTSIDE_ID, type DensityPoints, type DensityScatterSelection } from "./types";

type Vertex = readonly [number, number];

/** Ray-casting point-in-polygon. `poly` is implicitly closed. */
export function pointInPolygon(poly: ReadonlyArray<Vertex>, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]![0];
    const yi = poly[i]![1];
    const xj = poly[j]![0];
    const yj = poly[j]![1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Whether any constraint is set. */
export function hasSelection(selection: DensityScatterSelection | undefined): boolean {
  if (!selection) return false;
  return Boolean(
    selection.x ||
    selection.y ||
    (selection.lasso && selection.lasso.length >= 3) ||
    selection.zones?.length,
  );
}

/** The set of class indexes a `zones` constraint allows. */
function allowedClasses(
  zoneIds: readonly string[],
  zoneOrder: readonly string[],
): Set<number> | null {
  const allowed = new Set<number>();
  for (const id of zoneIds) {
    if (id === DENSITY_OUTSIDE_ID) allowed.add(zoneOrder.length);
    else {
      const k = zoneOrder.indexOf(id);
      if (k >= 0) allowed.add(k);
    }
  }
  return allowed.size ? allowed : null;
}

/**
 * Resolves `selection` against the points into `out` (255 / 0). Returns
 * `false` when no constraint is set (every byte is 255 then).
 */
export function resolveSelection(
  points: DensityPoints,
  cls: Uint8Array,
  zoneOrder: readonly string[],
  selection: DensityScatterSelection | undefined,
  out: Uint8Array,
): boolean {
  if (!hasSelection(selection)) {
    out.fill(255);
    return false;
  }
  const s = selection!;
  const xr = s.x ? [Math.min(s.x[0], s.x[1]), Math.max(s.x[0], s.x[1])] : null;
  const yr = s.y ? [Math.min(s.y[0], s.y[1]), Math.max(s.y[0], s.y[1])] : null;
  const lasso = s.lasso && s.lasso.length >= 3 ? s.lasso : null;
  const allowed = s.zones?.length ? allowedClasses(s.zones, zoneOrder) : null;
  let bx0 = -Infinity;
  let bx1 = Infinity;
  let by0 = -Infinity;
  let by1 = Infinity;
  if (lasso) {
    bx0 = Infinity;
    bx1 = -Infinity;
    by0 = Infinity;
    by1 = -Infinity;
    for (const [vx, vy] of lasso) {
      if (vx < bx0) bx0 = vx;
      if (vx > bx1) bx1 = vx;
      if (vy < by0) by0 = vy;
      if (vy > by1) by1 = vy;
    }
  }
  const { x, y, n } = points;
  for (let i = 0; i < n; i++) {
    const px = x[i]!;
    const py = y[i]!;
    let ok = true;
    if (allowed && !allowed.has(cls[i]!)) ok = false;
    else if (xr && (px < xr[0]! || px > xr[1]!)) ok = false;
    else if (yr && (py < yr[0]! || py > yr[1]!)) ok = false;
    else if (
      lasso &&
      (px < bx0 || px > bx1 || py < by0 || py > by1 || !pointInPolygon(lasso, px, py))
    )
      ok = false;
    out[i] = ok ? 255 : 0;
  }
  return true;
}

/** Selected count over the whole dataset (not just the window). */
export function countSelected(selected: Uint8Array): number {
  let c = 0;
  for (let i = 0; i < selected.length; i++) if (selected[i]) c++;
  return c;
}

/** Immutable helpers the container uses to edit one constraint. */
export function withConstraint(
  selection: DensityScatterSelection | undefined,
  patch: Partial<DensityScatterSelection>,
): DensityScatterSelection {
  const next: DensityScatterSelection = { ...selection, ...patch };
  for (const key of Object.keys(next) as (keyof DensityScatterSelection)[]) {
    const v: unknown = next[key];
    if (v === undefined || (Array.isArray(v) && v.length === 0)) delete next[key];
  }
  return next;
}

export function toggleZoneConstraint(
  selection: DensityScatterSelection | undefined,
  zoneId: string,
): DensityScatterSelection {
  const current = selection?.zones ?? [];
  const zones = current.includes(zoneId)
    ? current.filter((id) => id !== zoneId)
    : [...current, zoneId];
  return withConstraint(selection, { zones });
}
