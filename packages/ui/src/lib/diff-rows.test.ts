import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DiffLine } from "./diff-line";
import { collapseDiffRows, useDiffRows } from "./diff-rows";

function contextLine(index: number): DiffLine {
  return { type: "context", oldNumber: index, newNumber: index, text: `line ${index}` };
}

describe("collapseDiffRows", () => {
  it("renders every line when contextLines is undefined", () => {
    const lines = Array.from({ length: 5 }, (_, i) => contextLine(i));
    const rows = collapseDiffRows(lines, undefined);
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.kind === "line")).toBe(true);
  });

  it("does not collapse a run at or below the threshold", () => {
    const lines = Array.from({ length: 4 }, (_, i) => contextLine(i));
    const rows = collapseDiffRows(lines, 4);
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.kind === "line")).toBe(true);
  });

  it("collapses a run longer than contextLines, keeping top and bottom context", () => {
    const lines = Array.from({ length: 10 }, (_, i) => contextLine(i));
    const rows = collapseDiffRows(lines, 4);
    // top=2, bottom=2, collapsed hiddenCount = 10 - 2 - 2 = 6. `runStart` is the
    // run's OWN start index (0 — the whole 10-line run is one context block),
    // not the index of the first hidden line — it is the key `expand()` takes.
    expect(rows.map((row) => row.kind)).toEqual(["line", "line", "collapsed", "line", "line"]);
    const collapsed = rows.find((row) => row.kind === "collapsed");
    expect(collapsed).toMatchObject({ kind: "collapsed", runStart: 0, hiddenCount: 6 });
  });

  it("renders a run in full when its start index is in `expanded`", () => {
    const lines = Array.from({ length: 10 }, (_, i) => contextLine(i));
    const rows = collapseDiffRows(lines, 4, new Set([0]));
    expect(rows).toHaveLength(10);
    expect(rows.every((row) => row.kind === "line")).toBe(true);
  });

  it("does not collapse non-context lines flanking a run", () => {
    const lines: DiffLine[] = [
      { type: "add", newNumber: 1, text: "added" },
      ...Array.from({ length: 8 }, (_, i) => contextLine(i)),
      { type: "del", oldNumber: 99, text: "removed" },
    ];
    const rows = collapseDiffRows(lines, 4);
    expect(rows[0]).toMatchObject({ kind: "line", index: 0 });
    expect(rows.at(-1)).toMatchObject({ kind: "line", index: 9 });
    expect(rows.some((row) => row.kind === "collapsed")).toBe(true);
  });
});

describe("useDiffRows", () => {
  it("starts with no run expanded", () => {
    const lines = Array.from({ length: 10 }, (_, i) => contextLine(i));
    const { result } = renderHook(() => useDiffRows(lines, 4));
    expect(result.current.rows.some((row) => row.kind === "collapsed")).toBe(true);
  });

  it("expand() reveals the collapsed run's lines", () => {
    const lines = Array.from({ length: 10 }, (_, i) => contextLine(i));
    const { result } = renderHook(() => useDiffRows(lines, 4));

    const collapsed = result.current.rows.find((row) => row.kind === "collapsed");
    expect(collapsed).toBeDefined();
    const runStart = (collapsed as { runStart: number }).runStart;

    act(() => result.current.expand(runStart));

    expect(result.current.rows.every((row) => row.kind === "line")).toBe(true);
    expect(result.current.rows).toHaveLength(10);
  });
});
