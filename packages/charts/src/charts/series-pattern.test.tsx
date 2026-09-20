import { describe, expect, it } from "vitest";
import { isValidElement } from "react";
import {
  indexPaletteFills,
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

  // #255 — PieChart and SankeyNode render this helper from a `.map()`, and both
  // call sites forgot a list identity. The identity lives in the helper, keyed
  // by the collision-free pattern id, so no call site has to remember it.
  it("carries its pattern id as the React list identity", () => {
    const a = makeSeriesPattern(0, "bp-series-x-0", "var(--chart-1)");
    const b = makeSeriesPattern(1, "bp-series-x-1", "var(--chart-2)");
    expect(a.key).toBe("bp-series-x-0");
    expect(b.key).toBe("bp-series-x-1");
    expect(a.key).not.toBe(b.key);
  });

  it("uses the dots geometry (circle) for index 1", () => {
    const el = makeSeriesPattern(1, "id1", "var(--chart-1)");
    const children = (el.props as { children: { type: string }[] }).children;
    expect(children[1]?.type).toBe("circle");
  });
});

describe("indexPaletteFills — per-datum palette fills (#257)", () => {
  it("numbers distinct palette fills in first-seen order and skips author fills", () => {
    const indices = indexPaletteFills([
      "var(--chart-2)",
      "var(--chart-1)",
      "var(--chart-2)",
      "url(#author)",
      undefined,
      "var(--chart-seq-3)",
    ]);
    expect([...indices]).toEqual([
      ["var(--chart-2)", 0],
      ["var(--chart-1)", 1],
      ["var(--chart-seq-3)", 2],
    ]);
  });
});

describe("makeSeriesPattern options — ink-only and scaled tiles (a-8)", () => {
  it("ground: false drops the colour ground, so the mark underneath shows through", () => {
    const withGround = makeSeriesPattern(2, "g", "var(--chart-1)");
    const inkOnly = makeSeriesPattern(2, "i", "var(--chart-1)", { ground: false });
    const childrenOf = (el: ReturnType<typeof makeSeriesPattern>) =>
      (el.props as { children: unknown[] }).children;
    expect(childrenOf(withGround)[0]).not.toBeNull();
    expect(childrenOf(inkOnly)[0]).toBeNull();
    // The INK is the same shape either way — only the ground differs.
    expect((childrenOf(inkOnly)[1] as { type: string }).type).toBe(
      (childrenOf(withGround)[1] as { type: string }).type,
    );
  });

  it("scale shrinks the tile, the stroke and the dot radius together", () => {
    const full = makeSeriesPattern(1, "f", "var(--chart-1)");
    const half = makeSeriesPattern(1, "h", "var(--chart-1)", { scale: 0.5 });
    const sizeOf = (el: ReturnType<typeof makeSeriesPattern>) =>
      (el.props as { width: number }).width;
    expect(sizeOf(half)).toBe(sizeOf(full) / 2);
    const radiusOf = (el: ReturnType<typeof makeSeriesPattern>) =>
      (el.props as { children: { props: { r: number } }[] }).children[1]!.props.r;
    expect(radiusOf(half)).toBe(radiusOf(full) / 2);
  });
});
