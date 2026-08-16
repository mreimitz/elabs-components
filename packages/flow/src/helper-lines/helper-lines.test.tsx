import { describe, expect, it } from "vitest";
import { getHelperLines, type HelperLineRect } from "./get-helper-lines";

// A fixed 100×40 box; the "other" node the dragged node aligns against.
const other: HelperLineRect = { x: 100, y: 100, width: 100, height: 40 };

describe("getHelperLines", () => {
  it("snaps X when left edges are within threshold (left-to-left)", () => {
    // dragged left at 103, other left at 100 → within 5px.
    const dragged: HelperLineRect = { x: 103, y: 300, width: 100, height: 40 };
    const { snapX, vertical } = getHelperLines(dragged, [other]);
    expect(vertical).toBe(100);
    expect(snapX).toBe(100); // left aligns → top-left x == other.x
  });

  it("snaps X when horizontal centers align (center-to-center)", () => {
    // Narrower box so only its center — not its edges — lands near another anchor.
    // other centerX = 150; dragged (width 60) center at 150 (x=120), edges far.
    const dragged: HelperLineRect = { x: 120, y: 300, width: 60, height: 40 };
    const { snapX, vertical } = getHelperLines(dragged, [other]);
    expect(vertical).toBe(150);
    expect(snapX).toBe(120); // centerX 150 → x = 150 - width/2 = 120
  });

  it("snaps Y when top edges align (top-to-top)", () => {
    // dragged top at 102, other top at 100 → within 5px.
    const dragged: HelperLineRect = { x: 400, y: 102, width: 100, height: 40 };
    const { snapY, horizontal } = getHelperLines(dragged, [other]);
    expect(horizontal).toBe(100);
    expect(snapY).toBe(100);
  });

  it("snaps X to the right edge (right-to-right)", () => {
    // Wider box (120) at x=80 → right=200 matches other.right=200; left/center far.
    const dragged: HelperLineRect = { x: 80, y: 300, width: 120, height: 40 };
    const { snapX, vertical } = getHelperLines(dragged, [other], 5);
    expect(vertical).toBe(200); // guide at other's right edge
    expect(snapX).toBe(80); // right 200 → x = 200 - width = 80
    expect((snapX ?? 0) + 120).toBe(vertical); // dragged right lands on the guide
  });

  it("does not snap when no anchor is within threshold", () => {
    const dragged: HelperLineRect = { x: 500, y: 500, width: 100, height: 40 };
    const result = getHelperLines(dragged, [other]);
    expect(result.snapX).toBeUndefined();
    expect(result.snapY).toBeUndefined();
    expect(result.vertical).toBeUndefined();
    expect(result.horizontal).toBeUndefined();
  });

  it("treats the threshold as a strict boundary (distance == threshold does not match)", () => {
    // dragged left exactly 5px from other left with threshold 5 → no match.
    const dragged: HelperLineRect = { x: 105, y: 500, width: 100, height: 40 };
    const result = getHelperLines(dragged, [other], 5);
    expect(result.vertical).toBeUndefined();
    expect(result.snapX).toBeUndefined();

    // One pixel closer (distance 4 < 5) → matches.
    const closer: HelperLineRect = { x: 104, y: 500, width: 100, height: 40 };
    const matched = getHelperLines(closer, [other], 5);
    expect(matched.vertical).toBe(100);
    expect(matched.snapX).toBe(100);
  });

  it("picks the closest node when several are near", () => {
    const near: HelperLineRect = { x: 101, y: 300, width: 100, height: 40 }; // dist 1
    const far: HelperLineRect = { x: 96, y: 300, width: 100, height: 40 }; // dist 4
    const dragged: HelperLineRect = { x: 100, y: 300, width: 100, height: 40 };
    const { vertical, snapX } = getHelperLines(dragged, [far, near]);
    expect(vertical).toBe(101); // the closer node's left wins
    expect(snapX).toBe(101);
  });

  it("returns nothing when there are no other nodes", () => {
    const dragged: HelperLineRect = { x: 100, y: 100, width: 100, height: 40 };
    expect(getHelperLines(dragged, [])).toEqual({});
  });
});
