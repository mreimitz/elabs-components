import { describe, expect, it } from "vitest";

import type { MarkRanges } from "../../core/highlight-marks";
import { blockMark, blockMarkAttributes } from "./markdown-marks";

const at = (start: number, end: number) => ({
  position: { start: { offset: start }, end: { offset: end } },
});
const marks = (ranges: [number, number][], activeIndex = -1): MarkRanges => ({
  ranges,
  activeIndex,
});

describe("blockMark", () => {
  it("marks a block a range falls inside", () => {
    expect(blockMark(marks([[12, 20]]), at(10, 30))).toEqual({ marked: true, active: false });
  });

  it("marks a block a range only overlaps", () => {
    // A citation running across a block break belongs to BOTH blocks — that is
    // what keeps one passage reading as one passage.
    expect(blockMark(marks([[5, 15]]), at(10, 30)).marked).toBe(true);
    expect(blockMark(marks([[25, 40]]), at(10, 30)).marked).toBe(true);
  });

  it("leaves the neighbours alone when a range abuts a boundary", () => {
    expect(blockMark(marks([[0, 10]]), at(10, 30)).marked).toBe(false);
    expect(blockMark(marks([[30, 40]]), at(10, 30)).marked).toBe(false);
  });

  it("reports the active range separately from the rest", () => {
    const two = marks(
      [
        [12, 14],
        [50, 55],
      ],
      1,
    );
    expect(blockMark(two, at(10, 30))).toEqual({ marked: true, active: false });
    expect(blockMark(two, at(45, 60))).toEqual({ marked: true, active: true });
  });

  it("marks nothing for a node with no source position", () => {
    // rehype-raw and generated nodes have none; a plate guessed from a missing
    // position would land on an arbitrary block.
    expect(blockMark(marks([[0, 100]]), {})).toEqual({ marked: false, active: false });
    expect(blockMark(marks([[0, 100]]), undefined)).toEqual({ marked: false, active: false });
    expect(blockMark(marks([[0, 100]]), at(10, 10))).toEqual({ marked: false, active: false });
  });
});

describe("blockMarkAttributes", () => {
  it("adds nothing to an unmarked block but its own class", () => {
    expect(blockMarkAttributes({ marked: false, active: false })).toEqual({});
    expect(blockMarkAttributes({ marked: false, active: false }, "prose")).toEqual({
      className: "prose",
    });
  });

  it("gives a marked block the shared slot, and the active one a name for AT", () => {
    const marked = blockMarkAttributes({ marked: true, active: false });
    expect(marked["data-slot"]).toBe("highlight-block");
    expect(marked["data-active"]).toBeUndefined();
    expect(marked["aria-current"]).toBeUndefined();

    const active = blockMarkAttributes({ marked: true, active: true });
    // Presence form, not `"true"`: one selector finds the current highlight
    // whichever painter drew it.
    expect(active["data-active"]).toBe("");
    expect(active["aria-current"]).toBe("true");
  });

  it("distinguishes the current plate by more than its colour", () => {
    // WCAG 1.4.1: the rail doubles in width as well as changing hue, so the
    // current passage survives greyscale.
    expect(blockMarkAttributes({ marked: true, active: false }).className).toContain("border-s-2");
    expect(blockMarkAttributes({ marked: true, active: true }).className).toContain("border-s-4");
  });

  it("keeps the block's own classes alongside the plate's", () => {
    expect(blockMarkAttributes({ marked: true, active: false }, "font-mono").className).toContain(
      "font-mono",
    );
  });
});
