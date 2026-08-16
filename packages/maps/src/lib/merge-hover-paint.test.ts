import { describe, expect, it } from "vitest";

import { mergeHoverPaint } from "./merge-hover-paint";

describe("mergeHoverPaint", () => {
  it("returns the base paint untouched without hover paint", () => {
    const paint = { "line-color": "#111111", "line-width": 2 };
    expect(mergeHoverPaint(paint, undefined)).toBe(paint);
  });

  it("wraps overlapping keys in a hover feature-state case expression", () => {
    const merged = mergeHoverPaint({ "line-color": "#111111" }, { "line-color": "#222222" });
    expect(merged["line-color"]).toEqual([
      "case",
      ["boolean", ["feature-state", "hover"], false],
      "#222222",
      "#111111",
    ]);
  });

  it("passes through hover-only keys directly", () => {
    const merged = mergeHoverPaint<Record<string, unknown>>(
      { "line-color": "#111111" },
      { "line-width": 4 },
    );
    expect(merged["line-width"]).toBe(4);
    expect(merged["line-color"]).toBe("#111111");
  });

  it("skips undefined hover values", () => {
    const merged = mergeHoverPaint({ "line-color": "#111111" }, {
      "line-color": undefined,
    } as Record<string, unknown>);
    expect(merged["line-color"]).toBe("#111111");
  });
});
