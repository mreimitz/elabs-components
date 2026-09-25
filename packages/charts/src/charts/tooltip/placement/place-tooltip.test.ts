import { describe, expect, it } from "vitest";
import {
  type ChartTooltipPlacementMemory,
  type ChartTooltipPointer,
  CURSOR_KEEP_OUT,
  FOCUS_RING_KEEP_OUT,
  type PlaceTooltipInput,
  placeTooltip,
  TOUCH_KEEP_OUT,
  VIEWPORT_MARGIN,
} from "./place-tooltip";
import {
  type ChartTooltipRect,
  containsRect,
  inflateRect,
  rectBottom,
  rectRight,
  rectsOverlap,
} from "./rect";

const VIEWPORT: ChartTooltipRect = { x: 0, y: 0, width: 1280, height: 800 };

function boxRect(input: PlaceTooltipInput, placement: { x: number; y: number }): ChartTooltipRect {
  return { x: placement.x, y: placement.y, width: input.box.width, height: input.box.height };
}

/** The pointer's own keep-out, recomputed independently of the engine. */
function pointerKeepOut(input: PlaceTooltipInput): ChartTooltipRect | null {
  const { pointer, anchor } = input;
  const mouse = (x: number, y: number) => ({
    x: x - CURSOR_KEEP_OUT.left,
    y: y - CURSOR_KEEP_OUT.top,
    width: CURSOR_KEEP_OUT.left + CURSOR_KEEP_OUT.right,
    height: CURSOR_KEEP_OUT.top + CURSOR_KEEP_OUT.bottom,
  });
  if (!pointer) {
    return mouse(anchor.x, anchor.y);
  }
  if (pointer.kind === "touch") {
    return pointer.down
      ? {
          x: pointer.x - TOUCH_KEEP_OUT,
          y: pointer.y - TOUCH_KEEP_OUT,
          width: TOUCH_KEEP_OUT * 2,
          height: TOUCH_KEEP_OUT * 2,
        }
      : null;
  }
  if (pointer.kind === "keyboard" && pointer.focus) {
    return inflateRect(pointer.focus, FOCUS_RING_KEEP_OUT);
  }
  return mouse(pointer.x, pointer.y);
}

function mouse(x: number, y: number): ChartTooltipPointer {
  return { x, y, kind: "mouse" };
}

describe("placeTooltip — golden cases", () => {
  // The Small Multiples block (screenshot): a 140×56 panel, a 146×64 box.
  const panel: ChartTooltipRect = { x: 400, y: 200, width: 140, height: 56 };
  const panelInput = (pointer: ChartTooltipPointer, plot = panel): PlaceTooltipInput => ({
    box: { width: 146, height: 64 },
    anchor: { x: pointer.x, y: plot.y + 4 },
    pointer,
    plot,
    viewport: VIEWPORT,
    track: "x",
  });

  it("steps outside a panel too small to hold the box, beside it, top-aligned with the plot", () => {
    const input = panelInput(mouse(470, 230));
    const placement = placeTooltip(input);
    expect(placement.pass).toBe("escape");
    expect(placement.side).toBe("right");
    expect(placement.x).toBe(rectRight(panel) + 16);
    expect(placement.y).toBe(panel.y + 4);
    expect(rectsOverlap(boxRect(input, placement), panel)).toBe(false);
  });

  it("escapes to the left when the panel sits against the viewport's right edge", () => {
    const plot = { ...panel, x: VIEWPORT.width - 150 };
    const input = panelInput(mouse(plot.x + 60, 230), plot);
    const placement = placeTooltip(input);
    expect(placement.pass).toBe("escape");
    expect(placement.side).toBe("left");
    expect(rectRight(boxRect(input, placement))).toBe(plot.x - 16);
  });

  it("keeps the box beside the pointer inside a large chart, as before", () => {
    const plot = { x: 0, y: 0, width: 800, height: 300 };
    const input: PlaceTooltipInput = {
      box: { width: 180, height: 80 },
      anchor: { x: 50, y: 40 },
      pointer: mouse(50, 100),
      plot,
      viewport: VIEWPORT,
      track: "x",
    };
    const placement = placeTooltip(input);
    expect(placement).toMatchObject({ pass: "inside", side: "right", y: 40 });
    expect(placement.x).toBe(50 + CURSOR_KEEP_OUT.right + 16);
  });

  it("#605 — a wide table box in a 380px chart goes above the pointer rather than over it", () => {
    const plot = { x: 0, y: 0, width: 380, height: 300 };
    const input: PlaceTooltipInput = {
      box: { width: 245, height: 100 },
      anchor: { x: 200, y: 20 },
      pointer: mouse(200, 150),
      plot,
      viewport: VIEWPORT,
      track: "x",
    };
    const placement = placeTooltip(input);
    expect(placement.pass).toBe("inside");
    expect(placement.side).toBe("top");
    const rect = boxRect(input, placement);
    expect(rectsOverlap(rect, pointerKeepOut(input) as ChartTooltipRect)).toBe(false);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rectRight(rect)).toBeLessThanOrEqual(380);
  });

  it("places a touch tooltip above the finger", () => {
    const plot = { x: 0, y: 0, width: 800, height: 300 };
    const input: PlaceTooltipInput = {
      box: { width: 180, height: 80 },
      anchor: { x: 400, y: 40 },
      pointer: { x: 400, y: 200, kind: "touch", down: true },
      plot,
      viewport: VIEWPORT,
      track: "x",
    };
    const placement = placeTooltip(input);
    expect(placement.side).toBe("top");
    expect(rectBottom(boxRect(input, placement))).toBeLessThanOrEqual(200 - TOUCH_KEEP_OUT);
  });

  it("keeps clear of a keyboard-focused target and its focus ring", () => {
    const plot = { x: 0, y: 0, width: 600, height: 300 };
    const focus = { x: 290, y: 140, width: 20, height: 20 };
    const input: PlaceTooltipInput = {
      box: { width: 180, height: 80 },
      anchor: { x: 300, y: 150 },
      pointer: { x: 300, y: 150, kind: "keyboard", focus },
      plot,
      viewport: VIEWPORT,
      track: "free",
    };
    const placement = placeTooltip(input);
    expect(placement.pass).toBe("inside");
    expect(rectsOverlap(boxRect(input, placement), inflateRect(focus, FOCUS_RING_KEEP_OUT))).toBe(
      false,
    );
  });

  it("never covers a hovered dot, even when the pointer is left of it", () => {
    const plot = { x: 0, y: 0, width: 800, height: 300 };
    // Pointer in the left half of a column, snapped to the dot on its right.
    const dot = { x: 292, y: 30, width: 16, height: 16 };
    const input: PlaceTooltipInput = {
      box: { width: 180, height: 80 },
      anchor: { x: 300, y: 40 },
      pointer: mouse(270, 60),
      marks: [dot],
      plot,
      viewport: VIEWPORT,
      track: "x",
    };
    const placement = placeTooltip(input);
    const rect = boxRect(input, placement);
    expect(placement.pass).toBe("inside");
    expect(rectsOverlap(rect, dot)).toBe(false);
    expect(rectsOverlap(rect, pointerKeepOut(input) as ChartTooltipRect)).toBe(false);
  });

  it("may cover at most half of a large (soft) hovered mark", () => {
    const plot = { x: 0, y: 0, width: 600, height: 400 };
    const leaf = { x: 0, y: 0, width: 400, height: 300 };
    const input: PlaceTooltipInput = {
      box: { width: 180, height: 80 },
      anchor: { x: 200, y: 150 },
      pointer: mouse(200, 150),
      marks: [leaf],
      plot,
      viewport: VIEWPORT,
      track: "free",
    };
    const placement = placeTooltip(input);
    expect(placement.pass).toBe("inside");
    expect(rectsOverlap(boxRect(input, placement), pointerKeepOut(input) as ChartTooltipRect)).toBe(
      false,
    );
  });

  it("puts a horizontal-bar tooltip above the hovered row, not on it", () => {
    const plot = { x: 0, y: 0, width: 600, height: 400 };
    const row = { x: 40, y: 180, width: 520, height: 24 };
    const input: PlaceTooltipInput = {
      box: { width: 180, height: 80 },
      anchor: { x: 560, y: 192 },
      pointer: mouse(300, 190),
      marks: [row],
      plot,
      viewport: VIEWPORT,
      track: "y",
    };
    const placement = placeTooltip(input);
    const rect = boxRect(input, placement);
    expect(rectsOverlap(rect, row)).toBe(false);
    expect(placement.side).toBe("top");
  });

  it("hides the box when nothing fits without covering the pointer", () => {
    const viewport = { x: 0, y: 0, width: 150, height: 90 };
    const input: PlaceTooltipInput = {
      box: { width: 146, height: 64 },
      anchor: { x: 75, y: 4 },
      pointer: mouse(75, 45),
      plot: { x: 0, y: 0, width: 150, height: 90 },
      viewport,
      track: "x",
    };
    expect(placeTooltip(input).pass).toBe("hidden");
  });

  it("mirrors the side order for right-to-left reading", () => {
    const plot = { x: 0, y: 0, width: 800, height: 300 };
    const input: PlaceTooltipInput = {
      box: { width: 180, height: 80 },
      anchor: { x: 400, y: 40 },
      pointer: mouse(400, 100),
      plot,
      viewport: VIEWPORT,
      track: "x",
      direction: "rtl",
    };
    expect(placeTooltip(input).side).toBe("left");
  });

  it("puts a sparkline readout above the line when asked for above first", () => {
    const plot = { x: 300, y: 300, width: 96, height: 24 };
    const input: PlaceTooltipInput = {
      box: { width: 110, height: 44 },
      anchor: { x: 340, y: 310 },
      pointer: mouse(340, 305),
      plot,
      viewport: VIEWPORT,
      gap: 8,
      sides: ["top", "bottom", "right", "left"],
    };
    const placement = placeTooltip(input);
    expect(placement.side).toBe("top");
    expect(placement.pass).toBe("escape");
    expect(rectBottom(boxRect(input, placement))).toBeLessThanOrEqual(
      305 - CURSOR_KEEP_OUT.top - 8,
    );
  });
});

describe("placeTooltip — hysteresis", () => {
  const plot = { x: 0, y: 0, width: 600, height: 300 };
  const at = (x: number): PlaceTooltipInput => ({
    box: { width: 180, height: 80 },
    anchor: { x, y: 40 },
    pointer: mouse(x, 120),
    plot,
    viewport: VIEWPORT,
    track: "x",
  });

  it("does not flip back and forth while the pointer jitters around the flip point", () => {
    // Right fits while x + 16 + 16 + 180 <= 596, i.e. x <= 384.
    let memory: ChartTooltipPlacementMemory | null = null;
    const sides: string[] = [];
    for (const x of [380, 386, 383, 387, 382, 386, 381]) {
      const placement = placeTooltip(at(x), memory);
      sides.push(placement.side ?? "none");
      if (placement.side && placement.pass !== "hidden") {
        memory = { side: placement.side, pass: placement.pass };
      }
    }
    // Starts right, flips left once at 386, then stays left: returning right
    // needs 25% slack, which the jitter never gives.
    expect(sides).toEqual(["right", "left", "left", "left", "left", "left", "left"]);
  });

  it("switches back once the preferred side has room to spare", () => {
    const memory: ChartTooltipPlacementMemory = { side: "left", pass: "inside" };
    expect(placeTooltip(at(250), memory).side).toBe("right");
  });

  it("stays outside the chart for the rest of a hover session once it escaped", () => {
    // 300×150: at x=212 the box fits inside to the LEFT of the pointer, and
    // the earlier escape to the right is still close enough to stay valid.
    const small = { x: 0, y: 0, width: 300, height: 150 };
    const input: PlaceTooltipInput = { ...at(212), pointer: mouse(212, 75), plot: small };
    expect(placeTooltip(input)).toMatchObject({ pass: "inside", side: "left" });
    const memory: ChartTooltipPlacementMemory = { side: "right", pass: "escape" };
    expect(placeTooltip(input, memory)).toMatchObject({ pass: "escape", side: "right" });
  });

  it("drops a remembered escape that has drifted too far from the pointer", () => {
    const memory: ChartTooltipPlacementMemory = { side: "right", pass: "escape" };
    expect(placeTooltip(at(100), memory).pass).toBe("inside");
  });
});

describe("placeTooltip — invariant sweep", () => {
  // Deterministic grid (no randomness — charts-honesty): every plot size ×
  // box size × pointer kind × pointer position on a grid.
  const plots: ChartTooltipRect[] = [
    { x: 300, y: 200, width: 140, height: 56 },
    { x: 300, y: 200, width: 240, height: 120 },
    { x: 100, y: 100, width: 380, height: 200 },
    { x: 20, y: 20, width: 800, height: 300 },
    // Against the viewport's right and bottom edges.
    { x: 1280 - 200, y: 800 - 120, width: 200, height: 120 },
  ];
  const boxes = [
    { width: 146, height: 64 },
    { width: 180, height: 80 },
    { width: 245, height: 120 },
  ];
  const kinds = ["mouse", "touch", "keyboard"] as const;

  it("never covers the pointer or a hovered dot, and stays in the viewport", () => {
    let checked = 0;
    for (const plot of plots) {
      const step = Math.max(4, Math.round(plot.width / 48));
      for (const box of boxes) {
        for (const kind of kinds) {
          let memory: ChartTooltipPlacementMemory | null = null;
          for (let py = plot.y; py <= rectBottom(plot); py += step) {
            for (let px = plot.x; px <= rectRight(plot); px += step) {
              const pointer: ChartTooltipPointer =
                kind === "touch"
                  ? { x: px, y: py, kind, down: true }
                  : kind === "keyboard"
                    ? { x: px, y: py, kind, focus: { x: px - 6, y: py - 6, width: 12, height: 12 } }
                    : { x: px, y: py, kind };
              const dot = { x: px - 8, y: plot.y + plot.height / 3 - 8, width: 16, height: 16 };
              const input: PlaceTooltipInput = {
                box,
                anchor: { x: px, y: plot.y + 4 },
                pointer,
                marks: [dot],
                plot,
                viewport: VIEWPORT,
                track: "x",
              };
              const placement = placeTooltip(input, memory);
              checked += 1;
              if (placement.pass === "hidden" || !placement.side) {
                memory = null;
                continue;
              }
              memory = { side: placement.side, pass: placement.pass };
              const rect = boxRect(input, placement);
              const keep = pointerKeepOut(input);
              if (keep && rectsOverlap(rect, keep)) {
                throw new Error(
                  `covers the ${kind} pointer at ${px},${py} (plot ${plot.width}×${plot.height}, box ${box.width}×${box.height}, ${placement.pass}/${placement.side})`,
                );
              }
              if (rectsOverlap(rect, dot)) {
                throw new Error(
                  `covers the hovered dot at ${px},${py} (${placement.pass}/${placement.side})`,
                );
              }
              expect(containsRect(inflateRect(VIEWPORT, -VIEWPORT_MARGIN + 0.001), rect)).toBe(
                true,
              );
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(10_000);
  });

  it("never lays the box over a chart too small to hold it", () => {
    const plot = plots[0] as ChartTooltipRect;
    for (let px = plot.x; px <= rectRight(plot); px += 4) {
      for (let py = plot.y; py <= rectBottom(plot); py += 4) {
        const input: PlaceTooltipInput = {
          box: { width: 146, height: 64 },
          anchor: { x: px, y: plot.y + 4 },
          pointer: mouse(px, py),
          plot,
          viewport: VIEWPORT,
          track: "x",
        };
        const placement = placeTooltip(input);
        expect(placement.pass).toBe("escape");
        expect(rectsOverlap(boxRect(input, placement), plot)).toBe(false);
      }
    }
  });
});
