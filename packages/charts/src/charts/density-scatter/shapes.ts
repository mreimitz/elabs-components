/**
 * density-scatter/shapes.ts — a categorical column → one glyph byte per point.
 *
 * Framework-free. Resolved once per data identity / `shapeBy`: the renderer
 * then reads the byte per point (`aShp` in the shader, the stamp index in the
 * Canvas-2D fallback) and never looks at a label again.
 */

import {
  DENSITY_SHAPE_CYCLE,
  DENSITY_SHAPES,
  type DensityPointShape,
  type DensityPoints,
  type DensityShapeBy,
  type DensityShapeEntry,
} from "./types";

export interface ResolvedShapeClasses {
  /** `shapes[i]` — the glyph byte of point i (an index into `DENSITY_SHAPES`). */
  shapes: Uint8Array;
  /** One entry per distinct value of the column, in its code order. */
  entries: DensityShapeEntry[];
}

/** The byte of a shape name (`circle` → 0); unknown names fall back to the circle. */
export function shapeIndex(shape: DensityPointShape | undefined): number {
  const k = shape ? DENSITY_SHAPES.indexOf(shape) : -1;
  return k < 0 ? 0 : k;
}

/**
 * Deals a glyph to every value of `shapeBy.key`: the one `shapes` names, else
 * the next of `cycle` in first-seen (code) order — values the map names do not
 * consume a cycle slot. `null` when the column is missing.
 */
export function resolveShapeClasses(
  points: DensityPoints,
  shapeBy: DensityShapeBy | undefined,
): ResolvedShapeClasses | null {
  if (!shapeBy) return null;
  const cat = points.categories[shapeBy.key];
  if (!cat) return null;
  const entries = dealShapes(cat.labels, shapeBy);
  const byCode = new Uint8Array(Math.max(1, entries.length));
  entries.forEach((e, code) => {
    byCode[code] = shapeIndex(e.shape);
  });
  const shapes = new Uint8Array(points.n);
  for (let i = 0; i < points.n; i++) shapes[i] = byCode[cat.codes[i]!] ?? 0;
  return { shapes, entries };
}

/**
 * The glyph of every value, in `labels` order: the one `shapeBy.shapes` names,
 * else the next of the cycle. A host draws its own shape key from this.
 */
export function dealShapes(
  labels: readonly string[],
  shapeBy: Pick<DensityShapeBy, "shapes" | "cycle">,
): DensityShapeEntry[] {
  const cycle = shapeBy.cycle?.length ? shapeBy.cycle : DENSITY_SHAPE_CYCLE;
  const named = shapeBy.shapes ?? {};
  let next = 0;
  return labels.map((label) => {
    let shape = named[label];
    if (!shape || !DENSITY_SHAPES.includes(shape)) {
      shape = cycle[next % cycle.length] ?? "circle";
      next++;
    }
    return { label, shape };
  });
}
