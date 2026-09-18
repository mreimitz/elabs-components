/**
 * label-layout — the pixel-space label collision solver (RM-110).
 *
 * One pure, deterministic pass over label boxes: each box keeps its preferred
 * position when it can, is NUDGED along its free axis (at most `maxNudge` px)
 * when it collides with a box already placed or with an obstacle, and is
 * DROPPED when no nudge clears it. Boxes are visited highest `priority` first
 * (ties: input order), so when two labels compete for one spot the one with
 * the higher priority survives — at 380 px that is what decides which labels
 * a narrow chart keeps.
 *
 * The free axis follows `anchorSide` — the side of the box that faces the
 * point it labels:
 * - `"left"` / `"right"`: the label sits beside its anchor (a line end label,
 *   a scatter label to the right of its bubble) → nudged vertically.
 * - `"top"` / `"bottom"`: the label sits above or below its anchor (a peak
 *   value label, a bar value) → nudged horizontally.
 *
 * Stable signature: RM-111 (annotations) places its numbered markers through
 * this same function. Change it only additively.
 */

/** Side of a label box that faces the point it labels; decides its free axis. */
export type LabelAnchorSide = "left" | "right" | "top" | "bottom";

/** An axis-aligned rectangle in the caller's pixel space (top-left origin). */
export interface LabelRect {
  /** Left edge, px. */
  x: number;
  /** Top edge, px. */
  y: number;
  /** Width, px. */
  width: number;
  /** Height, px. */
  height: number;
}

/** One label to place: its box at the PREFERRED position, plus how it may move. */
export interface LabelBox extends LabelRect {
  /** Stable identity — returned untouched so the caller can match results. */
  id: string;
  /** Higher survives a collision. Default `0`. */
  priority?: number;
  /** Side of the box facing its anchor. Default `"left"` (label right of its anchor). */
  anchorSide?: LabelAnchorSide;
}

export interface LabelLayoutOptions {
  /** Largest move along the free axis, px. Default {@link DEFAULT_LABEL_MAX_NUDGE}. */
  maxNudge?: number;
  /** Clear gap kept between two boxes (and a box and an obstacle), px. Default {@link DEFAULT_LABEL_PADDING}. */
  padding?: number;
  /** Area every placed box must stay inside. Default: unbounded. */
  bounds?: LabelRect;
  /** Fixed rectangles no label may cover (markers, a legend, a reference line band). */
  obstacles?: readonly LabelRect[];
}

/** `placed`: at its preferred position; `nudged`: moved along its free axis; `dropped`: not painted. */
export type LabelPlacementStatus = "placed" | "nudged" | "dropped";

export interface LabelPlacement<T extends LabelBox = LabelBox> {
  id: string;
  /** The input box, untouched. */
  label: T;
  status: LabelPlacementStatus;
  /** Final left edge, px (the preferred one for a dropped label). */
  x: number;
  /** Final top edge, px (the preferred one for a dropped label). */
  y: number;
  /** Horizontal move applied, px. */
  dx: number;
  /** Vertical move applied, px. */
  dy: number;
}

export interface LabelLayoutResult<T extends LabelBox = LabelBox> {
  /** One placement per input label, in INPUT order. */
  placements: LabelPlacement<T>[];
  /** Placed or nudged labels, in input order — the ones to paint. */
  placed: LabelPlacement<T>[];
  /** Dropped labels, in input order — restate these `sr-only`. */
  dropped: T[];
}

/** Default {@link LabelLayoutOptions.maxNudge}: a little over one label line. */
export const DEFAULT_LABEL_MAX_NUDGE = 16;
/** Default {@link LabelLayoutOptions.padding}. */
export const DEFAULT_LABEL_PADDING = 2;

/** Numeric slack so boxes that merely touch (floating-point) never count as overlapping. */
const EPSILON = 1e-6;

function overlaps(a: LabelRect, b: LabelRect, padding: number): boolean {
  return (
    a.x < b.x + b.width + padding - EPSILON &&
    b.x < a.x + a.width + padding - EPSILON &&
    a.y < b.y + b.height + padding - EPSILON &&
    b.y < a.y + a.height + padding - EPSILON
  );
}

function freeAxisOf(side: LabelAnchorSide | undefined): "x" | "y" {
  return side === "top" || side === "bottom" ? "x" : "y";
}

function insideBounds(rect: LabelRect, bounds: LabelRect | undefined): boolean {
  if (!bounds) return true;
  return (
    rect.x >= bounds.x - EPSILON &&
    rect.y >= bounds.y - EPSILON &&
    rect.x + rect.width <= bounds.x + bounds.width + EPSILON &&
    rect.y + rect.height <= bounds.y + bounds.height + EPSILON
  );
}

function shifted(box: LabelRect, axis: "x" | "y", delta: number): LabelRect {
  return axis === "x"
    ? { x: box.x + delta, y: box.y, width: box.width, height: box.height }
    : { x: box.x, y: box.y + delta, width: box.width, height: box.height };
}

/**
 * Candidate moves along `axis`, smallest first: stay put, clamp into bounds,
 * and sit flush before / after every blocker that shares the fixed axis.
 */
function candidateDeltas(
  box: LabelRect,
  axis: "x" | "y",
  blockers: readonly LabelRect[],
  padding: number,
  bounds: LabelRect | undefined,
): number[] {
  const start = axis === "x" ? box.x : box.y;
  const size = axis === "x" ? box.width : box.height;
  const deltas = new Set<number>([0]);
  if (bounds) {
    const lo = axis === "x" ? bounds.x : bounds.y;
    const hi = lo + (axis === "x" ? bounds.width : bounds.height);
    if (start < lo) deltas.add(lo - start);
    if (start + size > hi) deltas.add(hi - (start + size));
  }
  for (const blocker of blockers) {
    const bStart = axis === "x" ? blocker.x : blocker.y;
    const bSize = axis === "x" ? blocker.width : blocker.height;
    deltas.add(bStart - padding - (start + size));
    deltas.add(bStart + bSize + padding - start);
  }
  // Smallest move first; on a tie, the move toward the axis origin (up / left)
  // first — a fixed rule, so equal inputs always give equal output.
  return [...deltas].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
}

/**
 * Place `labels` without overlap. Pure and deterministic: equal input gives
 * equal output, independent of the input's priority ties beyond input order.
 */
export function layoutLabels<T extends LabelBox>(
  labels: readonly T[],
  options: LabelLayoutOptions = {},
): LabelLayoutResult<T> {
  const maxNudge = Math.max(0, options.maxNudge ?? DEFAULT_LABEL_MAX_NUDGE);
  const padding = Math.max(0, options.padding ?? DEFAULT_LABEL_PADDING);
  const { bounds } = options;
  const obstacles = options.obstacles ?? [];

  const order = labels
    .map((label, index) => ({ label, index }))
    .sort((a, b) => (b.label.priority ?? 0) - (a.label.priority ?? 0) || a.index - b.index);

  const accepted: LabelRect[] = [];
  const byIndex = new Map<number, LabelPlacement<T>>();

  for (const { label, index } of order) {
    const axis = freeAxisOf(label.anchorSide);
    const box: LabelRect = { x: label.x, y: label.y, width: label.width, height: label.height };
    const blockers = [...obstacles, ...accepted];
    let placement: LabelPlacement<T> | null = null;

    const validSize =
      Number.isFinite(box.x) &&
      Number.isFinite(box.y) &&
      Number.isFinite(box.width) &&
      Number.isFinite(box.height) &&
      box.width >= 0 &&
      box.height >= 0;

    if (validSize) {
      for (const delta of candidateDeltas(box, axis, blockers, padding, bounds)) {
        if (Math.abs(delta) > maxNudge + EPSILON) continue;
        const moved = shifted(box, axis, delta);
        if (!insideBounds(moved, bounds)) continue;
        if (blockers.some((blocker) => overlaps(moved, blocker, padding))) continue;
        const dx = axis === "x" ? delta : 0;
        const dy = axis === "y" ? delta : 0;
        placement = {
          id: label.id,
          label,
          status: delta === 0 ? "placed" : "nudged",
          x: moved.x,
          y: moved.y,
          dx,
          dy,
        };
        accepted.push(moved);
        break;
      }
    }

    byIndex.set(
      index,
      placement ?? {
        id: label.id,
        label,
        status: "dropped",
        x: label.x,
        y: label.y,
        dx: 0,
        dy: 0,
      },
    );
  }

  const placements = labels.map((_, index) => byIndex.get(index) as LabelPlacement<T>);
  return {
    placements,
    placed: placements.filter((p) => p.status !== "dropped"),
    dropped: placements.filter((p) => p.status === "dropped").map((p) => p.label),
  };
}
