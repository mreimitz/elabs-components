import { describe, expect, it } from "vitest";
import { isValidElement } from "react";
import {
  isPaletteFill,
  makeSeriesPattern,
  seriesDashArray,
  seriesMarkerShape,
  seriesPattern,
  seriesPatternId,
} from "./series-pattern";

describe("series-pattern — deterministic series→pattern ramp (#164)", () => {
  it("seriesPattern is deterministic per index", () => {
    expect(seriesPattern(0)).toEqual(seriesPattern(0));
    expect(seriesPattern(3)).toEqual(seriesPattern(3));
  });

  it("seriesPattern wraps past the ramp length", () => {
    expect(seriesPattern(8)).toEqual(seriesPattern(0));
    expect(seriesPattern(9)).toEqual(seriesPattern(1));
  });

  it("the first 8 patterns are mutually distinct", () => {
    const sigs = Array.from({ length: 8 }, (_, i) => JSON.stringify(seriesPattern(i)));
    expect(new Set(sigs).size).toBe(8);
  });

  it("the first 8 dash arrays are mutually distinct", () => {
    const dashes = Array.from({ length: 8 }, (_, i) => String(seriesDashArray(i)));
    expect(new Set(dashes).size).toBe(8);
  });

  it("the first 8 marker shapes are mutually distinct", () => {
    const shapes = Array.from({ length: 8 }, (_, i) => seriesMarkerShape(i));
    expect(new Set(shapes).size).toBe(8);
  });

  it("seriesPatternId is stable, scoped, and unique per index", () => {
    expect(seriesPatternId(0, "abc")).toBe(seriesPatternId(0, "abc"));
    expect(seriesPatternId(0, "abc")).not.toBe(seriesPatternId(1, "abc"));
    expect(seriesPatternId(0, "abc")).not.toBe(seriesPatternId(0, "xyz"));
  });
});

describe("isPaletteFill — only brand series tokens auto-pattern (#164)", () => {
  it("accepts palette tokens (default sentinel + --chart-*)", () => {
    expect(isPaletteFill("var(--chart-line-primary)")).toBe(true);
    expect(isPaletteFill("var(--chart-line-secondary)")).toBe(true);
    expect(isPaletteFill("var(--chart-1)")).toBe(true);
    expect(isPaletteFill("var(--chart-5)")).toBe(true);
    expect(isPaletteFill("var(  --chart-3 )")).toBe(true);
  });

  it("rejects author literals, non-chart vars, urls, and empties", () => {
    expect(isPaletteFill("#abc123")).toBe(false);
    expect(isPaletteFill("rgb(0,0,0)")).toBe(false);
    expect(isPaletteFill("var(--brand-accent)")).toBe(false);
    expect(isPaletteFill("url(#something)")).toBe(false);
    expect(isPaletteFill("")).toBe(false);
    expect(isPaletteFill(null)).toBe(false);
    expect(isPaletteFill(undefined)).toBe(false);
  });
});

describe("makeSeriesPattern — raw <pattern> for a series (#164)", () => {
  it("returns a <pattern> element with the given id and a ground + ink", () => {
    const el = makeSeriesPattern(0, "bp-series-x-0", "var(--chart-1)");
    expect(isValidElement(el)).toBe(true);
    expect(el.type).toBe("pattern");
    expect((el.props as { id: string }).id).toBe("bp-series-x-0");
    const children = (el.props as { children: unknown[] }).children;
    expect(Array.isArray(children)).toBe(true);
    expect(children.length).toBe(2); // faint ground rect + ink shape
  });

  it("uses the dots geometry (circle) for index 1", () => {
    const el = makeSeriesPattern(1, "id1", "var(--chart-1)");
    const children = (el.props as { children: { type: string }[] }).children;
    expect(children[1]?.type).toBe("circle");
  });
});
