/**
 * Axis-aligned rectangle maths for tooltip placement. Framework-free and
 * DOM-free: every value is plain pixels in one coordinate space (the
 * placement engine works in viewport/client pixels).
 */

/** A rectangle by its top-left corner and size, in pixels. */
export interface ChartTooltipRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function rectRight(rect: ChartTooltipRect): number {
  return rect.x + rect.width;
}

export function rectBottom(rect: ChartTooltipRect): number {
  return rect.y + rect.height;
}

export function rectArea(rect: ChartTooltipRect): number {
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

/** The overlapping part of two rects, or `null` when they only touch or are apart. */
export function intersectRects(a: ChartTooltipRect, b: ChartTooltipRect): ChartTooltipRect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(rectRight(a), rectRight(b));
  const bottom = Math.min(rectBottom(a), rectBottom(b));
  if (right <= x || bottom <= y) {
    return null;
  }
  return { x, y, width: right - x, height: bottom - y };
}

/** Whether two rects share any area (touching edges do not count). */
export function rectsOverlap(a: ChartTooltipRect, b: ChartTooltipRect): boolean {
  return intersectRects(a, b) !== null;
}

export function overlapArea(a: ChartTooltipRect, b: ChartTooltipRect): number {
  const overlap = intersectRects(a, b);
  return overlap ? rectArea(overlap) : 0;
}

/** The smallest rect holding every input rect. */
export function unionRects(rects: readonly ChartTooltipRect[]): ChartTooltipRect | null {
  let result: ChartTooltipRect | null = null;
  for (const rect of rects) {
    if (!result) {
      result = { ...rect };
      continue;
    }
    const x = Math.min(result.x, rect.x);
    const y = Math.min(result.y, rect.y);
    result = {
      x,
      y,
      width: Math.max(rectRight(result), rectRight(rect)) - x,
      height: Math.max(rectBottom(result), rectBottom(rect)) - y,
    };
  }
  return result;
}

/** Grows a rect by `amount` on every side (a negative amount shrinks it). */
export function inflateRect(rect: ChartTooltipRect, amount: number): ChartTooltipRect {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: Math.max(0, rect.width + amount * 2),
    height: Math.max(0, rect.height + amount * 2),
  };
}

/** Whether `inner` lies wholly inside `outer`, edges included. */
export function containsRect(outer: ChartTooltipRect, inner: ChartTooltipRect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    rectRight(inner) <= rectRight(outer) &&
    rectBottom(inner) <= rectBottom(outer)
  );
}
