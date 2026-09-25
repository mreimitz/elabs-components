/**
 * Where a chart's floating tooltip box goes — a pure, synchronous placement
 * engine. No DOM access: every rect is in viewport (client) pixels, the caller
 * measures and converts.
 *
 * The one guarantee: the box never covers the pointer (or the keyboard-focused
 * mark) and never covers a hovered mark small enough to step around. A
 * candidate is always placed wholly BEYOND those keep-outs along its main axis
 * and is never clamped back across them — a candidate that does not fit simply
 * fails and the next one is tried. The old flip-then-clamp maths broke exactly
 * this: on a chart narrower than about twice the box, the clamp dragged the box
 * onto the cursor and over the whole chart.
 *
 * Passes, first valid wins:
 * 1. `inside`  — beside the pointer, inside the chart. Skipped for a chart too
 *    small to hold the box beside the pointer ("tiny").
 * 2. `escape`  — outside the chart, next to it, anywhere in the viewport.
 * 3. `overlap` — beside the pointer, over the chart if need be, never over a
 *    keep-out.
 * 4. `hidden`  — nothing fits; the box is not shown rather than cover the
 *    pointer (the value is still in the frame title, table flip or live region).
 */

import {
  type ChartTooltipRect,
  containsRect,
  inflateRect,
  intersectRects,
  overlapArea,
  rectArea,
  rectBottom,
  rectRight,
  rectsOverlap,
  unionRects,
} from "./rect";

export type ChartTooltipSide =
  | "right"
  | "left"
  | "top"
  | "bottom"
  | "top-right"
  | "top-left"
  | "bottom-right"
  | "bottom-left";

export type ChartTooltipPlacementPass = "inside" | "escape" | "overlap" | "hidden";

/** What is driving the hover: a mouse or pen, a finger, or keyboard focus. */
export type ChartTooltipPointerKind = "mouse" | "touch" | "keyboard";

/**
 * How the anchor moves while the user explores:
 * - `"x"` — a crosshair scrubbing along x (line/area/vertical bars). Side
 *   placements keep the box's top at the anchor's y (the plot top).
 * - `"y"` — rows (horizontal bars). Side placements centre on the anchor's y.
 * - `"free"` — a mark anywhere in 2-D (heatmap cell, node, leaf).
 */
export type ChartTooltipTrack = "x" | "y" | "free";

export interface ChartTooltipPointer {
  x: number;
  y: number;
  kind: ChartTooltipPointerKind;
  /** Touch only: whether the finger is still on the screen. */
  down?: boolean;
  /** Keyboard only: the focused target's rect (its focus ring is added). */
  focus?: ChartTooltipRect | null;
}

export interface PlaceTooltipInput {
  /** The box's own measured size. */
  box: { width: number; height: number };
  /** The consumer's anchor (crosshair top, mark centre…) — the fallback cursor. */
  anchor: { x: number; y: number };
  /** The real pointer, or `null` when none is known inside this chart. */
  pointer: ChartTooltipPointer | null;
  /** Hovered marks to keep clear of. */
  marks?: readonly ChartTooltipRect[];
  /** The chart's own box. */
  plot: ChartTooltipRect;
  /** The visible viewport. */
  viewport: ChartTooltipRect;
  track?: ChartTooltipTrack;
  /** Space between the box and what it avoids. Default 16. */
  gap?: number;
  /** Reading direction — the first side tried is the inline END. Default `"ltr"`. */
  direction?: "ltr" | "rtl";
  /**
   * The sides to try, in order, in every pass — replaces the default order
   * (a sparkline's readout prefers above/below its line). Taken literally,
   * never mirrored for `direction`.
   */
  sides?: readonly ChartTooltipSide[];
}

/** The previous placement of the same hover session, for hysteresis. */
export interface ChartTooltipPlacementMemory {
  side: ChartTooltipSide;
  pass: Exclude<ChartTooltipPlacementPass, "hidden">;
}

export interface ChartTooltipPlacement {
  /** The box's top-left corner, viewport px. */
  x: number;
  y: number;
  side: ChartTooltipSide | null;
  pass: ChartTooltipPlacementPass;
  /** Union of the hard keep-outs (pointer + small marks) the box stays clear of. */
  keepOut: ChartTooltipRect;
  /** The hard keep-outs one by one — a moving box checks these, not their union. */
  keepOuts: ChartTooltipRect[];
}

/** Mouse/pen keep-out around the hotspot: the arrow (or crosshair) cursor's own ink. */
export const CURSOR_KEEP_OUT = { left: 12, top: 12, right: 16, bottom: 20 } as const;
/** Touch keep-out radius around the contact point; it also runs down to the viewport bottom (the hand). */
export const TOUCH_KEEP_OUT = 32;
/** Added around a keyboard-focused target: its focus ring. */
export const FOCUS_RING_KEEP_OUT = 4;
/** Minimum distance from the viewport edge. */
export const VIEWPORT_MARGIN = 8;
/** Minimum distance from the chart edge for an `inside` placement. */
export const PLOT_INSET = 4;
/** An `inside` box never covers more than this share of the chart. */
export const MAX_PLOT_COVER = 1 / 3;
/** An `inside` box never covers more than this share of a large ("soft") mark. */
export const MAX_SOFT_MARK_COVER = 0.5;
/** An `escape` box on a non-tiny chart stays within this distance of the keep-outs (or its own size). */
export const ESCAPE_DISTANCE_CAP = 160;
/** Hysteresis slack: the minimum, and the share of the box's main-axis size. */
export const HYSTERESIS_MIN = 24;
export const HYSTERESIS_RATIO = 0.25;

const PASS_ORDER: ChartTooltipPlacementPass[] = ["inside", "escape", "overlap"];

type Placed = { rect: ChartTooltipRect; side: ChartTooltipSide; pass: ChartTooltipPlacementPass };

function pointRect(x: number, y: number): ChartTooltipRect {
  return { x, y, width: 0, height: 0 };
}

function cursorKeepOut(input: PlaceTooltipInput): ChartTooltipRect | null {
  const { pointer, anchor, viewport } = input;
  const mouseBox = (x: number, y: number): ChartTooltipRect => ({
    x: x - CURSOR_KEEP_OUT.left,
    y: y - CURSOR_KEEP_OUT.top,
    width: CURSOR_KEEP_OUT.left + CURSOR_KEEP_OUT.right,
    height: CURSOR_KEEP_OUT.top + CURSOR_KEEP_OUT.bottom,
  });
  if (!pointer) {
    return mouseBox(anchor.x, anchor.y);
  }
  if (pointer.kind === "touch") {
    if (!pointer.down) {
      return null;
    }
    const top = pointer.y - TOUCH_KEEP_OUT;
    return {
      x: pointer.x - TOUCH_KEEP_OUT,
      y: top,
      width: TOUCH_KEEP_OUT * 2,
      height: Math.max(TOUCH_KEEP_OUT * 2, rectBottom(viewport) - top),
    };
  }
  if (pointer.kind === "keyboard") {
    return inflateRect(pointer.focus ?? pointRect(pointer.x, pointer.y), FOCUS_RING_KEEP_OUT);
  }
  return mouseBox(pointer.x, pointer.y);
}

/** A mark the box can step around inside the chart (small, or thin on one axis). */
function isHardMark(mark: ChartTooltipRect, plot: ChartTooltipRect): boolean {
  const plotArea = rectArea(plot);
  if (plotArea === 0) {
    return true;
  }
  return (
    rectArea(mark) <= plotArea / 4 &&
    (mark.width <= plot.width / 2 || mark.height <= plot.height / 2)
  );
}

function sideOrder(
  pass: ChartTooltipPlacementPass,
  input: PlaceTooltipInput,
): readonly ChartTooltipSide[] {
  if (input.sides) {
    return input.sides;
  }
  const rtl = input.direction === "rtl";
  const end = rtl ? "left" : "right";
  const start = rtl ? "right" : "left";
  const topEnd = `top-${end}` as ChartTooltipSide;
  const topStart = `top-${start}` as ChartTooltipSide;
  const bottomEnd = `bottom-${end}` as ChartTooltipSide;
  const bottomStart = `bottom-${start}` as ChartTooltipSide;
  // A finger (and the hand below it) hides everything under the contact
  // point: above first, beside next, below never (the keep-out forbids it).
  if (input.pointer?.kind === "touch" && input.pointer.down) {
    return pass === "escape" ? ["top", end, start] : ["top", topEnd, topStart, end, start];
  }
  if (pass === "escape") {
    return [end, start, "top", "bottom"];
  }
  if (input.track === "y") {
    return [end, "top", "bottom", start, topEnd, bottomEnd, topStart, bottomStart];
  }
  if (input.track === "x") {
    return [end, start, topEnd, topStart, bottomEnd, bottomStart, "top", "bottom"];
  }
  return [end, start, topEnd, bottomEnd, topStart, bottomStart, "top", "bottom"];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * The candidate box for `side` around reference rect `ref`. The MAIN axis is
 * fixed beyond `ref` (never clamped); only the cross axis slides into `bounds`.
 */
function candidateRect(
  side: ChartTooltipSide,
  ref: ChartTooltipRect,
  bounds: ChartTooltipRect,
  input: PlaceTooltipInput,
  gap: number,
): ChartTooltipRect {
  const { width, height } = input.box;
  const alignY = input.track === "x" ? input.anchor.y : input.anchor.y - height / 2;
  const alignX = input.anchor.x - width / 2;
  const crossY = clamp(alignY, bounds.y, rectBottom(bounds) - height);
  const crossX = clamp(alignX, bounds.x, rectRight(bounds) - width);
  const rightX = rectRight(ref) + gap;
  const leftX = ref.x - gap - width;
  const topY = ref.y - gap - height;
  const bottomY = rectBottom(ref) + gap;
  switch (side) {
    case "right":
      return { x: rightX, y: crossY, width, height };
    case "left":
      return { x: leftX, y: crossY, width, height };
    case "top":
      return { x: crossX, y: topY, width, height };
    case "bottom":
      return { x: crossX, y: bottomY, width, height };
    case "top-right":
      return { x: rightX, y: topY, width, height };
    case "top-left":
      return { x: leftX, y: topY, width, height };
    case "bottom-right":
      return { x: rightX, y: bottomY, width, height };
    case "bottom-left":
      return { x: leftX, y: bottomY, width, height };
  }
}

/** How far a candidate sits from `ref` along its main axis. */
function mainAxisGap(
  side: ChartTooltipSide,
  rect: ChartTooltipRect,
  ref: ChartTooltipRect,
): number {
  const horizontal = side.includes("right")
    ? rect.x - rectRight(ref)
    : side.includes("left")
      ? ref.x - rectRight(rect)
      : 0;
  const vertical = side.startsWith("top")
    ? ref.y - rectBottom(rect)
    : side.startsWith("bottom")
      ? rect.y - rectBottom(ref)
      : 0;
  return Math.max(horizontal, vertical);
}

/** Grows a candidate AWAY from what it avoids — the hysteresis slack. */
function growAway(side: ChartTooltipSide, rect: ChartTooltipRect): ChartTooltipRect {
  const horizontal = side.includes("right") || side.includes("left");
  const mainSize = horizontal ? rect.width : rect.height;
  const slack = Math.max(HYSTERESIS_MIN, mainSize * HYSTERESIS_RATIO);
  let { x, y, width, height } = rect;
  if (side.includes("right")) {
    width += slack;
  }
  if (side.includes("left")) {
    x -= slack;
    width += slack;
  }
  if (side.startsWith("top")) {
    y -= slack;
    height += slack;
  }
  if (side.startsWith("bottom")) {
    height += slack;
  }
  return { x, y, width, height };
}

export function placeTooltip(
  input: PlaceTooltipInput,
  memory: ChartTooltipPlacementMemory | null = null,
): ChartTooltipPlacement {
  const gap = input.gap ?? 16;
  const { box, plot, viewport, anchor } = input;

  const cursor = cursorKeepOut(input);
  const marks = input.marks ?? [];
  const hardMarks = marks.filter((mark) => isHardMark(mark, plot));
  const softMarks = marks.filter((mark) => !isHardMark(mark, plot));
  const hard = cursor ? [cursor, ...hardMarks] : hardMarks;
  const keepOut = unionRects(hard) ?? pointRect(anchor.x, anchor.y);
  const escapeRef = unionRects([keepOut, plot]) ?? plot;

  const plotArea = rectArea(plot);
  const boxArea = box.width * box.height;
  const tiny =
    plot.width < box.width + gap * 2 + 32 ||
    plot.height < box.height + 8 ||
    boxArea > plotArea * MAX_PLOT_COVER;

  const visiblePlot = intersectRects(plot, viewport);
  const viewportBounds = inflateRect(viewport, -VIEWPORT_MARGIN);
  const boundsFor = (pass: ChartTooltipPlacementPass): ChartTooltipRect | null =>
    pass === "inside" ? visiblePlot && inflateRect(visiblePlot, -PLOT_INSET) : viewportBounds;
  // Tight first (just beside the pointer), then clear of every hard keep-out.
  const refsFor = (pass: ChartTooltipPlacementPass): ChartTooltipRect[] =>
    pass === "escape"
      ? [escapeRef]
      : cursor && hardMarks.length > 0
        ? [cursor, keepOut]
        : [keepOut];
  const passes = PASS_ORDER.filter((pass) => !(tiny && pass === "inside"));

  const isValid = (
    pass: ChartTooltipPlacementPass,
    side: ChartTooltipSide,
    rect: ChartTooltipRect,
  ) => {
    const bounds = boundsFor(pass);
    if (!bounds || !containsRect(bounds, rect)) {
      return false;
    }
    if (hard.some((keep) => rectsOverlap(rect, keep))) {
      return false;
    }
    if (pass === "inside") {
      if (overlapArea(rect, plot) > plotArea * MAX_PLOT_COVER) {
        return false;
      }
      if (
        softMarks.some((mark) => overlapArea(rect, mark) > rectArea(mark) * MAX_SOFT_MARK_COVER)
      ) {
        return false;
      }
    }
    if (pass === "escape" && !tiny) {
      const mainSize = side.includes("right") || side.includes("left") ? box.width : box.height;
      if (mainAxisGap(side, rect, keepOut) > Math.max(ESCAPE_DISTANCE_CAP, mainSize)) {
        return false;
      }
    }
    return true;
  };

  const tryPlace = (pass: ChartTooltipPlacementPass, side: ChartTooltipSide): Placed | null => {
    const bounds = boundsFor(pass);
    if (!bounds) {
      return null;
    }
    for (const ref of refsFor(pass)) {
      const rect = candidateRect(side, ref, bounds, input, gap);
      if (isValid(pass, side, rect)) {
        return { rect, side, pass };
      }
    }
    return null;
  };

  let preferred: Placed | null = null;
  for (const pass of passes) {
    for (const side of sideOrder(pass, input)) {
      preferred = tryPlace(pass, side);
      if (preferred) {
        break;
      }
    }
    if (preferred) {
      break;
    }
  }

  const remembered =
    memory && passes.includes(memory.pass) ? tryPlace(memory.pass, memory.side) : null;

  let chosen = preferred;
  if (preferred && remembered) {
    const same = preferred.pass === remembered.pass && preferred.side === remembered.side;
    // Once a hover session has stepped outside a chart it stays outside:
    // flipping back in while the user scrubs would slide the box across it.
    const stickyEscape = remembered.pass === "escape" && preferred.pass === "inside";
    const worthSwitching = isValid(
      preferred.pass,
      preferred.side,
      growAway(preferred.side, preferred.rect),
    );
    if (same || stickyEscape || !worthSwitching) {
      chosen = remembered;
    }
  }

  if (!chosen) {
    return { x: anchor.x, y: anchor.y, side: null, pass: "hidden", keepOut, keepOuts: hard };
  }
  return {
    x: chosen.rect.x,
    y: chosen.rect.y,
    side: chosen.side,
    pass: chosen.pass,
    keepOut,
    keepOuts: hard,
  };
}
