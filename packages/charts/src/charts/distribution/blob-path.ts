/**
 * blob-path.ts — quadratic-midpoint smoothing, the "blob" curve (RM-026).
 *
 * Provenance: the closed silhouettes in the lieflat gallery (`G19 Violin`'s
 * mirrored density, and the label blobs a streamgraph will want) are all drawn
 * this way rather than with a cubic spline.
 *
 * ## Why not a Catmull-Rom / basis spline
 *
 * A violin's outline must not OVERSHOOT. Any interpolating cubic through
 * unevenly-spaced density samples can bulge past the samples it connects, and a
 * silhouette that bulges past its own estimate is drawing density that is not
 * there. Quadratic-midpoint smoothing cannot: every curve segment runs between
 * two midpoints with the shared sample as its single control point, so the curve
 * stays inside the control polygon by construction. It is also cheap — one `Q`
 * per sample, no tangent estimation.
 *
 * The cost is honest and worth stating: the curve does NOT pass through the
 * samples (except the first and last), it passes near them. For a shape read as
 * a shape that is the right trade; for a series someone reads values off, it is
 * not — use the chart's own curve types there.
 */

/** A point in the SVG user space the path will be drawn in. */
export interface BlobPoint {
  x: number;
  y: number;
}

/**
 * An SVG path through `points`, smoothed by quadratic midpoints.
 *
 * @param points at least two, in draw order.
 * @param closed append `Z` and smooth the wrap-around seam too — what a violin's
 *   mirrored outline wants, so the two halves meet without a corner.
 * @returns the `d` attribute, or `""` for fewer than two points (an empty `d` is
 *   a valid, invisible path; a malformed one is a console error in every browser).
 */
export function blobPath(points: readonly BlobPoint[], closed = false): string {
  if (points.length < 2) return "";

  const midpoint = (a: BlobPoint, b: BlobPoint): BlobPoint => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const first = points[0] as BlobPoint;
  const last = points.at(-1) as BlobPoint;

  if (closed) {
    // Start at the seam's midpoint so the wrap-around is smoothed like every
    // other joint — starting at a SAMPLE would leave one corner in the outline.
    const seam = midpoint(last, first);
    let d = `M ${seam.x} ${seam.y}`;
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index] as BlobPoint;
      const next = points[(index + 1) % points.length] as BlobPoint;
      const mid = midpoint(current, next);
      d += ` Q ${current.x} ${current.y} ${mid.x} ${mid.y}`;
    }
    return `${d} Z`;
  }

  let d = `M ${first.x} ${first.y}`;
  for (let index = 1; index < points.length - 2; index += 1) {
    const current = points[index] as BlobPoint;
    const next = points[index + 1] as BlobPoint;
    const mid = midpoint(current, next);
    d += ` Q ${current.x} ${current.y} ${mid.x} ${mid.y}`;
  }
  // The final segment ends ON the last sample, so an open curve still starts and
  // ends exactly where the caller put it.
  const penultimate = points.at(-2) as BlobPoint;
  d += ` Q ${penultimate.x} ${penultimate.y} ${last.x} ${last.y}`;
  return d;
}
