import { describe, expect, it } from "vitest";
import { fitWidths, moveColumn } from "./column-actions";

const table = (ids: string[], hidden: string[] = []) => ({
  getAllLeafColumns: () => ids.map((id) => ({ id, getIsVisible: () => !hidden.includes(id) })),
});
const none = { left: [], right: [] };

describe("moveColumn", () => {
  it("moves an unpinned column one visible step", () => {
    expect(moveColumn(table(["a", "b", "c"]), none, "a", { delta: 1 })).toEqual({
      columnOrder: ["b", "a", "c"],
    });
  });

  it("steps over hidden columns", () => {
    expect(moveColumn(table(["a", "b", "c"], ["b"]), none, "a", { delta: 1 })).toEqual({
      columnOrder: ["b", "c", "a"],
    });
  });

  it("refuses to move past the edge", () => {
    expect(moveColumn(table(["a", "b"]), none, "a", { delta: -1 })).toBeNull();
  });

  it("drops onto a target's side", () => {
    expect(
      moveColumn(table(["a", "b", "c", "d"]), none, "d", { targetId: "b", side: "before" }),
    ).toEqual({ columnOrder: ["a", "d", "b", "c"] });
  });

  it("reorders a pinned column inside its own pinned block", () => {
    const pinning = { left: ["a", "b"], right: [] };
    expect(moveColumn(table(["a", "b", "c"]), pinning, "a", { delta: 1 })).toEqual({
      columnPinning: { left: ["b", "a"], right: [] },
    });
  });

  it("never drops a column into another pinning region", () => {
    const pinning = { left: ["a"], right: [] };
    expect(
      moveColumn(table(["a", "b", "c"]), pinning, "b", { targetId: "a", side: "before" }),
    ).toBeNull();
  });
});

describe("fitWidths", () => {
  it("scales widths to fill the room exactly, honouring min / max", () => {
    const sizes = new Map([
      ["a", { size: 100, min: 20, max: 1000 }],
      ["b", { size: 100, min: 20, max: 150 }],
      ["c", { size: 200, min: 20, max: 1000 }],
    ]);
    const out = fitWidths(sizes, 800);
    expect(out.b).toBe(150);
    expect(out.a).toBe(200);
    expect(Object.values(out).reduce((s, n) => s + n, 0)).toBeGreaterThanOrEqual(750);
  });
});
