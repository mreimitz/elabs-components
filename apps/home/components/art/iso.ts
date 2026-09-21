/**
 * The isometric projection the site's drawings share (`hero/hero-anatomy.tsx`,
 * `art/category-art.tsx`): `a` runs right-and-up, `b` runs left-and-up, `z` is height. Pure
 * geometry — every function returns SVG attribute values, no colour, no state.
 */
const C = 0.866;
const S = 0.5;
export type P3 = readonly [a: number, b: number, z: number];
export const px = ([a, b]: P3) => (a - b) * C;
export const py = ([a, b, z]: P3) => -(a + b) * S - z;
export const pt = (p: P3) => `${px(p).toFixed(1)},${py(p).toFixed(1)}`;

/** A flat plate: the rectangle a0..a1 × b0..b1 at height z, as polygon points. */
export function plate(a0: number, a1: number, b0: number, b1: number, z: number) {
  const corners: P3[] = [
    [a0, b0, z],
    [a1, b0, z],
    [a1, b1, z],
    [a0, b1, z],
  ];
  return corners.map(pt).join(" ");
}
/** The visible thickness of a plate: its two front edges dropped by `t`. */
export function edge(a0: number, a1: number, b0: number, b1: number, z: number, t: number) {
  const corners: P3[] = [
    [a0, b1, z],
    [a0, b0, z],
    [a1, b0, z],
    [a1, b0, z - t],
    [a0, b0, z - t],
    [a0, b1, z - t],
  ];
  return corners.map(pt).join(" ");
}
/** A bar standing on a plate: a flat upright quad in the plane b = const. */
export function bar(a: number, w: number, b: number, z: number, h: number) {
  const corners: P3[] = [
    [a, b, z],
    [a + w, b, z],
    [a + w, b, z + h],
    [a, b, z + h],
  ];
  return corners.map(pt).join(" ");
}
export const line = (p: P3, q: P3) => ({ x1: px(p), y1: py(p), x2: px(q), y2: py(q) });
/** A polyline through 3D points, as a `points` string. */
export const path3 = (points: readonly P3[]) => points.map(pt).join(" ");
