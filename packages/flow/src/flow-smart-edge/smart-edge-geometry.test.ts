import { describe, expect, it, vi } from "vitest";

// smart-edge-geometry imports the `Position` enum (a value) from @xyflow/react.
// Mock it to the Position constants so the pure picker runs in jsdom.
vi.mock("@xyflow/react", () => ({
  Position: { Left: "left", Top: "top", Right: "right", Bottom: "bottom" },
}));

import {
  handlePoint,
  pickClosestHandles,
  rectCenter,
  sideToPosition,
  slideAnchor,
  HANDLE_SIDES,
  type NodeRect,
} from "./smart-edge-geometry";

const rect = (x: number, y: number, width = 100, height = 60): NodeRect => ({
  x,
  y,
  width,
  height,
});

describe("handlePoint", () => {
  it("returns the midpoint of each side", () => {
    const r = rect(0, 0, 100, 60);
    expect(handlePoint(r, "top")).toEqual({ x: 50, y: 0 });
    expect(handlePoint(r, "bottom")).toEqual({ x: 50, y: 60 });
    expect(handlePoint(r, "left")).toEqual({ x: 0, y: 30 });
    expect(handlePoint(r, "right")).toEqual({ x: 100, y: 30 });
  });
});

describe("sideToPosition", () => {
  it("maps every side to the matching Position value", () => {
    expect(sideToPosition.top).toBe("top");
    expect(sideToPosition.right).toBe("right");
    expect(sideToPosition.bottom).toBe("bottom");
    expect(sideToPosition.left).toBe("left");
  });
});

describe("pickClosestHandles", () => {
  it("target to the right → source uses its right handle, target its left", () => {
    const source = rect(0, 0);
    const target = rect(300, 0);
    const picked = pickClosestHandles(source, ["right", "left"], target, ["left", "right"]);

    expect(picked.sourceSide).toBe("right");
    expect(picked.targetSide).toBe("left");
    expect(picked.sx).toBeCloseTo(100);
    expect(picked.tx).toBeCloseTo(300);
  });

  it("target below → source uses bottom, target uses top", () => {
    const picked = pickClosestHandles(rect(0, 0), ["top", "bottom"], rect(0, 300), [
      "top",
      "bottom",
    ]);
    expect(picked.sourceSide).toBe("bottom");
    expect(picked.targetSide).toBe("top");
  });

  it("target up-and-to-the-left flips to the near corner sides", () => {
    // Target sits above-left of the source.
    const picked = pickClosestHandles(rect(300, 300), HANDLE_SIDES, rect(0, 0), HANDLE_SIDES);
    expect(["top", "left"]).toContain(picked.sourceSide);
    expect(["bottom", "right"]).toContain(picked.targetSide);
  });

  it("falls back to all four sides when a side list is empty", () => {
    const picked = pickClosestHandles(rect(0, 0), [], rect(300, 0), []);
    expect(picked.sourceSide).toBe("right");
    expect(picked.targetSide).toBe("left");
  });
});

describe("rectCenter", () => {
  it("returns the node's centre", () => {
    expect(rectCenter(rect(0, 0, 100, 60))).toEqual({ x: 50, y: 30 });
  });
});

describe("slideAnchor", () => {
  const r = rect(0, 0, 100, 60); // usable right/left span [12, 48], top/bottom span [12, 88]

  it("stays on the chosen side's axis", () => {
    expect(slideAnchor(r, "right", { x: 999, y: 30 }).x).toBe(100);
    expect(slideAnchor(r, "left", { x: -999, y: 30 }).x).toBe(0);
    expect(slideAnchor(r, "top", { x: 30, y: -999 }).y).toBe(0);
    expect(slideAnchor(r, "bottom", { x: 30, y: 999 }).y).toBe(60);
  });

  it("slides toward the target and clamps within the inset", () => {
    // Target far above → clamp to the top of the usable range (inset 12).
    expect(slideAnchor(r, "right", { x: 100, y: -500 }).y).toBe(12);
    // Target far below → clamp to the bottom of the usable range.
    expect(slideAnchor(r, "right", { x: 100, y: 500 }).y).toBe(48);
    // Target within range → follows it.
    expect(slideAnchor(r, "right", { x: 100, y: 30 }).y).toBe(30);
  });

  it("fans two edges on the same side to distinct anchors", () => {
    // The Ingest→Transform (up) vs Ingest→Publish (down) case, both leaving right.
    const up = slideAnchor(r, "right", { x: 400, y: -200 });
    const down = slideAnchor(r, "right", { x: 400, y: 200 });
    expect(up.y).toBeLessThan(down.y);
    expect(up.y).not.toBe(down.y);
  });

  it("never inverts the range on a tiny node", () => {
    const tiny = rect(0, 0, 10, 10); // inset (12) capped to width/2 = 5
    const p = slideAnchor(tiny, "right", { x: 100, y: -100 });
    expect(p.x).toBe(10);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThanOrEqual(10);
  });
});
