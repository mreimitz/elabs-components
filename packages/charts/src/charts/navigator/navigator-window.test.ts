import { describe, expect, it } from "vitest";
import {
  centreWindowOn,
  clampWindow,
  countRowsInWindow,
  defaultMinSpan,
  fromNumericWindow,
  indexToTime,
  indexWindowToTimeWindow,
  initialWindow,
  medianStep,
  moveWindowEdge,
  pixelsToWindow,
  shiftWindow,
  timeToIndex,
  timeWindowToIndexWindow,
  toNumericWindow,
  windowToPixels,
  zoomWindow,
} from "./navigator-window";

const EXTENT = [0, 100] as const;

describe("clampWindow", () => {
  it("orders a reversed window", () => {
    expect(clampWindow({ start: 60, end: 40 }, EXTENT)).toEqual({ start: 40, end: 60 });
  });
  it("grows a window below minSpan around its centre", () => {
    expect(clampWindow({ start: 49, end: 51 }, EXTENT, 10)).toEqual({ start: 45, end: 55 });
  });
  it("shifts a window back inside the extent, keeping its span", () => {
    expect(clampWindow({ start: -10, end: 20 }, EXTENT)).toEqual({ start: 0, end: 30 });
    expect(clampWindow({ start: 90, end: 120 }, EXTENT)).toEqual({ start: 70, end: 100 });
  });
  it("caps a window wider than the extent to the extent", () => {
    expect(clampWindow({ start: -50, end: 150 }, EXTENT)).toEqual({ start: 0, end: 100 });
  });
  it("never lets minSpan exceed the extent", () => {
    expect(clampWindow({ start: 10, end: 11 }, EXTENT, 500)).toEqual({ start: 0, end: 100 });
  });
});

describe("shiftWindow / zoomWindow / moveWindowEdge / centreWindowOn", () => {
  it("shifts and stops at either end", () => {
    expect(shiftWindow({ start: 10, end: 30 }, 15, EXTENT)).toEqual({ start: 25, end: 45 });
    expect(shiftWindow({ start: 10, end: 30 }, 500, EXTENT)).toEqual({ start: 80, end: 100 });
    expect(shiftWindow({ start: 10, end: 30 }, -500, EXTENT)).toEqual({ start: 0, end: 20 });
  });
  it("zooms around the centre or an anchor, respecting minSpan", () => {
    expect(zoomWindow({ start: 40, end: 60 }, 0.5, EXTENT)).toEqual({ start: 45, end: 55 });
    expect(zoomWindow({ start: 40, end: 60 }, 2, EXTENT, 0, 40)).toEqual({ start: 40, end: 80 });
    expect(zoomWindow({ start: 40, end: 60 }, 0.01, EXTENT, 8)).toEqual({ start: 46, end: 54 });
  });
  it("moves one edge and stops minSpan short of the other", () => {
    expect(moveWindowEdge({ start: 20, end: 40 }, "start", 10, EXTENT, 5)).toEqual({
      start: 10,
      end: 40,
    });
    expect(moveWindowEdge({ start: 20, end: 40 }, "start", 39, EXTENT, 5)).toEqual({
      start: 35,
      end: 40,
    });
    expect(moveWindowEdge({ start: 20, end: 40 }, "end", 200, EXTENT, 5)).toEqual({
      start: 20,
      end: 100,
    });
    expect(moveWindowEdge({ start: 20, end: 40 }, "end", 0, EXTENT, 5)).toEqual({
      start: 20,
      end: 25,
    });
  });
  it("centres a window on a value", () => {
    expect(centreWindowOn({ start: 0, end: 20 }, 50, EXTENT)).toEqual({ start: 40, end: 60 });
    expect(centreWindowOn({ start: 0, end: 20 }, 99, EXTENT)).toEqual({ start: 80, end: 100 });
  });
});

describe("defaults", () => {
  it("medianStep ignores zero / non-finite gaps", () => {
    expect(medianStep([0, 10, 20, 20, 50])).toBe(10);
    expect(medianStep([0, 10, 30, 60])).toBe(20);
    expect(medianStep([5])).toBe(0);
  });
  it("defaultMinSpan: 5× median step for time, 3 rows for index", () => {
    const day = 86_400_000;
    expect(defaultMinSpan("time", [0, day, 2 * day, 3 * day])).toBe(5 * day);
    expect(defaultMinSpan("index")).toBe(3);
  });
  it("initialWindow aligns a span at the start or the end", () => {
    expect(initialWindow("start", EXTENT, 25)).toEqual({ start: 0, end: 25 });
    expect(initialWindow("end", EXTENT, 25)).toEqual({ start: 75, end: 100 });
    expect(initialWindow("end", EXTENT)).toEqual({ start: 0, end: 100 });
  });
});

describe("index ↔ time", () => {
  const times = [100, 200, 300, 400, 500];
  it("maps indexes to times, clamped", () => {
    expect(indexToTime(0, times)).toBe(100);
    expect(indexToTime(4, times)).toBe(500);
    expect(indexToTime(99, times)).toBe(500);
    expect(indexToTime(-3, times)).toBe(100);
  });
  it("maps a time to the first row at or after it", () => {
    expect(timeToIndex(100, times)).toBe(0);
    expect(timeToIndex(250, times)).toBe(2);
    expect(timeToIndex(600, times)).toBe(5);
  });
  it("round-trips windows and counts rows", () => {
    expect(timeWindowToIndexWindow({ start: 200, end: 400 }, times)).toEqual({ start: 1, end: 4 });
    expect(indexWindowToTimeWindow({ start: 1, end: 4 }, times)).toEqual({ start: 200, end: 400 });
    expect(countRowsInWindow({ start: 150, end: 400 }, times)).toBe(3);
  });
  it("converts NavigatorWindow ↔ numbers", () => {
    const w = { kind: "time" as const, start: new Date(1000), end: new Date(5000) };
    expect(toNumericWindow(w)).toEqual({ start: 1000, end: 5000 });
    expect(fromNumericWindow("time", { start: 1000, end: 5000 })).toEqual(w);
    expect(fromNumericWindow("index", { start: 1.4, end: 7.6 })).toEqual({
      kind: "index",
      start: 1,
      end: 8,
    });
  });
});

describe("pixels", () => {
  it("maps a window to pixels and back over an inset range", () => {
    const range = [10, 210] as const;
    expect(windowToPixels({ start: 25, end: 50 }, EXTENT, range)).toEqual({ x0: 60, x1: 110 });
    expect(pixelsToWindow({ x0: 110, x1: 60 }, EXTENT, range)).toEqual({ start: 25, end: 50 });
  });
});
