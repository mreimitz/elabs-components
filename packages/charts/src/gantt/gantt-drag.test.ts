import { describe, expect, it } from "vitest";
import { applyDragDelta, snapDeltaMs, xToDate } from "./gantt-drag";

const U = 1000; // grid unit (ms) for tests

describe("snapDeltaMs", () => {
  it("returns 0 for no movement", () => {
    expect(snapDeltaMs(0, 1000, 10 * U, U)).toBe(0);
  });

  it("snaps a one-unit pixel delta to exactly one unit", () => {
    // canvasWidth 1000 over a 10-unit domain → 1 unit == 100px
    expect(snapDeltaMs(100, 1000, 10 * U, U)).toBe(U);
  });

  it("rounds to the nearest unit (0.4 → 0, 0.6 → 1)", () => {
    expect(snapDeltaMs(40, 1000, 10 * U, U)).toBe(0);
    expect(snapDeltaMs(60, 1000, 10 * U, U)).toBe(U);
  });

  it("snaps negative deltas symmetrically", () => {
    expect(snapDeltaMs(-100, 1000, 10 * U, U)).toBe(-U);
  });

  it("guards against zero/invalid geometry", () => {
    expect(snapDeltaMs(100, 0, 10 * U, U)).toBe(0);
    expect(snapDeltaMs(100, 1000, 0, U)).toBe(0);
    expect(snapDeltaMs(100, 1000, 10 * U, 0)).toBe(0);
  });
});

describe("applyDragDelta", () => {
  it("move shifts both edges by the delta", () => {
    expect(applyDragDelta("move", 1000, 2000, 500, U)).toEqual({ start: 1500, end: 2500 });
  });

  it("resize-start moves the start, keeps end, clamps to at least one unit", () => {
    expect(applyDragDelta("resize-start", 1000, 5000, 500, U)).toEqual({ start: 1500, end: 5000 });
    // Over-shrink clamps start to end - unit
    expect(applyDragDelta("resize-start", 1000, 5000, 9000, U)).toEqual({ start: 4000, end: 5000 });
  });

  it("resize-end moves the end, keeps start, clamps to at least one unit", () => {
    expect(applyDragDelta("resize-end", 1000, 5000, 500, U)).toEqual({ start: 1000, end: 5500 });
    // Over-shrink clamps end to start + unit
    expect(applyDragDelta("resize-end", 1000, 5000, -9000, U)).toEqual({ start: 1000, end: 2000 });
  });
});

describe("xToDate", () => {
  const start = new Date("2024-01-01T00:00:00Z");
  const end = new Date("2024-01-11T00:00:00Z"); // 10 days

  it("maps x=0 to the domain start and x=width to the domain end", () => {
    expect(xToDate(0, start, end, 1000).getTime()).toBe(start.getTime());
    expect(xToDate(1000, start, end, 1000).getTime()).toBe(end.getTime());
  });

  it("maps the midpoint to the domain midpoint", () => {
    const mid = (start.getTime() + end.getTime()) / 2;
    expect(xToDate(500, start, end, 1000).getTime()).toBe(mid);
  });

  it("guards against zero width", () => {
    expect(xToDate(500, start, end, 0).getTime()).toBe(start.getTime());
  });
});
