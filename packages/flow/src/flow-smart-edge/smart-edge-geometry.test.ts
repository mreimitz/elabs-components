import { describe, expect, it, vi } from "vitest";

// smart-edge-geometry imports the `Position` enum (a value) from @xyflow/react.
// Mock it to the Position constants so the pure picker runs in jsdom.
vi.mock("@xyflow/react", () => ({
  Position: { Left: "left", Top: "top", Right: "right", Bottom: "bottom" },
}));

import {
  handlePoint,
  pickClosestAnchors,
  pickClosestHandles,
  positionToSide,
  sideToPosition,
  HANDLE_SIDES,
  type HandleAnchor,
  type NodeRect,
} from "./smart-edge-geometry";

const rect = (x: number, y: number, width = 100, height = 60): NodeRect => ({
  x,
  y,
  width,
  height,
});

const anchor = (
  id: HandleAnchor["id"],
  x: number,
  y: number,
  side: HandleAnchor["side"],
): HandleAnchor => ({ id, x, y, side });

describe("handlePoint", () => {
  it("returns the midpoint of each side", () => {
    const r = rect(0, 0, 100, 60);
    expect(handlePoint(r, "top")).toEqual({ x: 50, y: 0 });
    expect(handlePoint(r, "bottom")).toEqual({ x: 50, y: 60 });
    expect(handlePoint(r, "left")).toEqual({ x: 0, y: 30 });
    expect(handlePoint(r, "right")).toEqual({ x: 100, y: 30 });
  });
});

describe("sideToPosition / positionToSide", () => {
  it("maps every side to the matching Position value", () => {
    expect(sideToPosition.top).toBe("top");
    expect(sideToPosition.right).toBe("right");
    expect(sideToPosition.bottom).toBe("bottom");
    expect(sideToPosition.left).toBe("left");
  });

  it("round-trips every side", () => {
    for (const side of HANDLE_SIDES) {
      expect(positionToSide[sideToPosition[side]]).toBe(side);
    }
  });
});

describe("pickClosestAnchors", () => {
  // A node at (0,0,100,60) with all-side handles, and one 300px to its right.
  const leftNode: HandleAnchor[] = [
    anchor("top", 50, 0, "top"),
    anchor("right", 100, 30, "right"),
    anchor("bottom", 50, 60, "bottom"),
    anchor("left", 0, 30, "left"),
  ];
  const rightNode: HandleAnchor[] = [
    anchor("top", 350, 0, "top"),
    anchor("right", 400, 30, "right"),
    anchor("bottom", 350, 60, "bottom"),
    anchor("left", 300, 30, "left"),
  ];

  it("returns the closest facing pair", () => {
    const picked = pickClosestAnchors(leftNode, rightNode);
    expect(picked?.source.id).toBe("right");
    expect(picked?.target.id).toBe("left");
  });

  it("returns the anchor coordinates VERBATIM — never a derived point", () => {
    // This is the whole contract: the edge terminates exactly where the dot was
    // measured, so no arithmetic may sit between the two.
    const picked = pickClosestAnchors(leftNode, rightNode);
    expect(picked?.source).toEqual(anchor("right", 100, 30, "right"));
    expect(picked?.target).toEqual(anchor("left", 300, 30, "left"));
  });

  it("picks a stacked pair when the other node is below", () => {
    const below = rightNode.map((a) => ({ ...a, x: a.x - 300, y: a.y + 300 }));
    const picked = pickClosestAnchors(leftNode, below);
    expect(picked?.source.id).toBe("bottom");
    expect(picked?.target.id).toBe("top");
  });

  it("uses the only handle a node has, whatever side it faces", () => {
    // A default FlowNode: one bottom source, one top target. It must never be
    // routed to a left/right anchor it does not render.
    const picked = pickClosestAnchors(
      [anchor(null, 50, 60, "bottom")],
      [anchor(null, 350, 0, "top")],
    );
    expect(picked?.source.side).toBe("bottom");
    expect(picked?.target.side).toBe("top");
    expect(picked?.source).toEqual({ id: null, x: 50, y: 60, side: "bottom" });
  });

  it("returns undefined when either end has no measured handle", () => {
    expect(pickClosestAnchors([], rightNode)).toBeUndefined();
    expect(pickClosestAnchors(leftNode, [])).toBeUndefined();
  });
});

describe("pickClosestHandles (pre-measurement fallback)", () => {
  it("target to the right → source uses its right handle, target its left", () => {
    const picked = pickClosestHandles(rect(0, 0), ["right", "left"], rect(300, 0), [
      "left",
      "right",
    ]);

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

  it("honours a single declared side instead of widening to all four", () => {
    // A default FlowNode declares bottom-out / top-in only. Even with the other
    // node straight to the right, the anchor stays on a side that has a handle.
    const picked = pickClosestHandles(rect(0, 0), ["bottom"], rect(300, 0), ["top"]);
    expect(picked.sourceSide).toBe("bottom");
    expect(picked.targetSide).toBe("top");
  });

  it("falls back to all four sides when a side list is empty", () => {
    const picked = pickClosestHandles(rect(0, 0), [], rect(300, 0), []);
    expect(picked.sourceSide).toBe("right");
    expect(picked.targetSide).toBe("left");
  });

  it("anchors on side midpoints, never a slid point", () => {
    const picked = pickClosestHandles(rect(0, 0), ["right"], rect(300, -500), ["left"]);
    // The target is far above; the anchor stays on the side's midpoint.
    expect(picked.sy).toBe(30);
  });
});
