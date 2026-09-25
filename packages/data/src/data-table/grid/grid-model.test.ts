import { describe, expect, it } from "vitest";
import {
  cellCount,
  collapsedAt,
  directionOf,
  edgesOf,
  rangeStats,
  resolveBounds,
  selectionToTsv,
  step,
  tsvField,
  withFocus,
  type GridCellSelection,
} from "./grid-model";

const rowIds = ["r0", "r1", "r2", "r3"];
const colIds = ["a", "b", "c"];
const ri = (id: string) => rowIds.indexOf(id);
const ci = (id: string) => colIds.indexOf(id);

describe("grid-model — ranges", () => {
  it("resolves a range regardless of drag direction", () => {
    const sel: GridCellSelection = [
      { anchorRowId: "r2", anchorColumnId: "c", focusRowId: "r0", focusColumnId: "a" },
    ];
    expect(resolveBounds(sel, ri, ci)).toEqual([{ minRow: 0, maxRow: 2, minCol: 0, maxCol: 2 }]);
  });

  it("subtracts an exclusion, splitting the rectangle (Ctrl+click inside a range)", () => {
    const sel: GridCellSelection = [
      { anchorRowId: "r0", anchorColumnId: "a", focusRowId: "r2", focusColumnId: "c" },
      {
        anchorRowId: "r1",
        anchorColumnId: "b",
        focusRowId: "r1",
        focusColumnId: "b",
        operation: "exclude",
      },
    ];
    const bounds = resolveBounds(sel, ri, ci);
    expect(cellCount(bounds)).toBe(8);
    expect(edgesOf(bounds, 1, 1)).toBeNull();
  });

  it("keeps overlapping inclusions disjoint (no double counting)", () => {
    const sel: GridCellSelection = [
      { anchorRowId: "r0", anchorColumnId: "a", focusRowId: "r1", focusColumnId: "b" },
      { anchorRowId: "r1", anchorColumnId: "b", focusRowId: "r2", focusColumnId: "c" },
    ];
    expect(cellCount(resolveBounds(sel, ri, ci))).toBe(7);
  });

  it("skips a range whose corner no longer resolves (filtered out)", () => {
    const sel: GridCellSelection = [
      { anchorRowId: "gone", anchorColumnId: "a", focusRowId: "r1", focusColumnId: "b" },
    ];
    expect(resolveBounds(sel, ri, ci)).toEqual([]);
  });

  it("outlines only the outer edges of a range", () => {
    const bounds = resolveBounds(
      [{ anchorRowId: "r0", anchorColumnId: "a", focusRowId: "r1", focusColumnId: "b" }],
      ri,
      ci,
    );
    expect(edgesOf(bounds, 0, 0)).toEqual({ top: true, bottom: false, left: true, right: false });
    expect(edgesOf(bounds, 1, 1)).toEqual({ top: false, bottom: true, left: false, right: true });
  });

  it("extends the ACTIVE range's focus corner and keeps its anchor", () => {
    const sel = withFocus(collapsedAt("r0", "a"), "r2", "b");
    expect(sel).toEqual([
      { anchorRowId: "r0", anchorColumnId: "a", focusRowId: "r2", focusColumnId: "b" },
    ]);
  });
});

describe("grid-model — navigation", () => {
  it("clamps steps and jumps to edges", () => {
    expect(step(0, -1, 5)).toBe(0);
    expect(step(4, 1, 5)).toBe(4);
    expect(step(2, 1, 5, true)).toBe(4);
    expect(step(2, -1, 5, true)).toBe(0);
  });

  it("mirrors horizontal arrows under RTL", () => {
    expect(directionOf("ArrowLeft", "ltr")).toBe("left");
    expect(directionOf("ArrowLeft", "rtl")).toBe("right");
    expect(directionOf("ArrowDown", "rtl")).toBe("down");
    expect(directionOf("x", "ltr")).toBeNull();
  });
});

describe("grid-model — clipboard and stats", () => {
  it("quotes TSV fields that hold tabs, newlines or quotes", () => {
    expect(tsvField("plain")).toBe("plain");
    expect(tsvField('say "hi"')).toBe('"say ""hi"""');
    expect(tsvField("a\tb")).toBe('"a\tb"');
  });

  it("stacks multiple ranges top to bottom, with optional headers", () => {
    const bounds = [
      { minRow: 2, maxRow: 2, minCol: 0, maxCol: 0 },
      { minRow: 0, maxRow: 1, minCol: 1, maxCol: 2 },
    ];
    const text = selectionToTsv(
      bounds,
      (r, c) => `${r}${c}`,
      (c) => `H${c}`,
    );
    expect(text).toBe("H1\tH2\n01\t02\n11\t12\nH0\n20");
  });

  it("summarises only finite numbers but counts every cell", () => {
    const values = [
      [1, "x"],
      [3, Number.NaN],
    ];
    const stats = rangeStats(
      [{ minRow: 0, maxRow: 1, minCol: 0, maxCol: 1 }],
      (r, c) => values[r]![c],
    );
    expect(stats).toEqual({ count: 4, numericCount: 2, sum: 4, min: 1, max: 3, avg: 2 });
  });
});
