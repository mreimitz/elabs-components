import { describe, expect, it } from "vitest";
import {
  barDomain,
  barGeometry,
  computeColumnScales,
  extentOf,
  heatmapColorScaleSpec,
  seriesValues,
} from "./cell-scales";

const rows = [
  { a: 10, b: -5, cat: "x", s1: 1, s2: 4 },
  { a: 40, b: 20, cat: "y", s1: 2, s2: 8 },
  { a: 20, b: 5, cat: "x", s1: 3, s2: 2 },
].map((original) => ({
  original,
  getValue: (id: string) => (original as Record<string, unknown>)[id],
}));

describe("cell-scales", () => {
  it("extentOf ignores non-finite values", () => {
    expect(extentOf([3, "x", null, Number.NaN, -1, 7])).toEqual({ min: -1, max: 7 });
    expect(extentOf(["x"])).toBeNull();
  });

  it("barDomain always contains zero; a fixed range wins", () => {
    expect(barDomain("column", { min: 10, max: 40 }, null)).toEqual([0, 40]);
    expect(barDomain("column", { min: -5, max: 20 }, null)).toEqual([-5, 20]);
    expect(barDomain("table", { min: 10, max: 40 }, { min: -5, max: 60 })).toEqual([-5, 60]);
    expect(barDomain([0, 100], { min: 10, max: 40 }, null)).toEqual([0, 100]);
  });

  it("barGeometry is proportional to the domain and grows left of zero when negative", () => {
    expect(barGeometry(20, [0, 40])).toMatchObject({ start: 0, size: 50, negative: false });
    expect(barGeometry(40, [0, 40]).size).toBe(100);
    // zero sits at 20% of [-5, 20]; -5 spans 0…20%.
    const neg = barGeometry(-5, [-5, 20]);
    expect(neg).toMatchObject({ start: 0, size: 20, zero: 20, negative: true });
    const pos = barGeometry(10, [-5, 20]);
    expect(pos.start).toBe(20);
    expect(pos.size).toBeCloseTo(40);
    // Never negative, never NaN.
    expect(barGeometry(Number.NaN, [0, 10]).size).toBe(0);
    expect(barGeometry(5, [0, 0]).size).toBe(0);
  });

  it("seriesValues reads keys in order, null where a key holds no number", () => {
    expect(seriesValues({ a: 1, b: "x", c: 3 }, ["c", "b", "a"])).toEqual([3, null, 1]);
  });

  it("heatmapColorScaleSpec maps the table methods onto colorScaleFor", () => {
    expect(heatmapColorScaleSpec({ type: "stepped" })).toMatchObject({
      type: "stepped",
      method: "equidistant",
    });
    expect(heatmapColorScaleSpec({ type: "stepped", method: "jenks", steps: 4 })).toMatchObject({
      type: "stepped",
      method: "jenks",
      steps: 4,
    });
    expect(heatmapColorScaleSpec({ type: "continuous", method: "jenks" })).toMatchObject({
      type: "continuous",
      method: "natural",
    });
    expect(
      heatmapColorScaleSpec({ type: "continuous", method: "quantile", steps: 4 }),
    ).toMatchObject({ type: "continuous", method: "quartiles" });
    expect(
      heatmapColorScaleSpec({ type: "continuous", method: "custom", breaks: [1, 2] }),
    ).toMatchObject({ type: "stepped", method: "custom", breaks: [1, 2] });
  });

  it("computeColumnScales: column + table bar ranges, shared series extent, pooled heatmaps, categories", () => {
    const scale = { type: "stepped" as const, steps: 3 };
    const scales = computeColumnScales(
      [
        { id: "a", meta: { visual: { kind: "bar", range: "table" } } },
        { id: "b", meta: { visual: { kind: "bar", range: "table" } } },
        { id: "s", meta: { visual: { kind: "sparkline", keys: ["s1", "s2"], range: "column" } } },
        { id: "a2", meta: { visual: { kind: "heatmap", scale } } },
        { id: "b2", meta: { visual: { kind: "heatmap", scale } } },
        { id: "cat", meta: { colorBy: { key: "cat", target: "background" } } },
        { id: "plain", meta: { numeric: true } },
      ],
      rows.map((r) => ({
        ...r,
        getValue: (id: string) => r.getValue(id === "a2" ? "a" : id === "b2" ? "b" : id),
      })),
    );
    expect(scales.get("a")?.barDomain).toEqual([-5, 40]);
    expect(scales.get("b")?.barDomain).toEqual([-5, 40]);
    expect(scales.get("s")?.seriesExtent).toEqual({ min: 1, max: 8 });
    // Identical heatmap specs pool their values into ONE shared scale.
    expect(scales.get("a2")?.heatmap).toBe(scales.get("b2")?.heatmap);
    expect(scales.get("a2")?.heatmap?.domain).toEqual([-5, 40]);
    expect(scales.get("a2")?.heatmap?.colorOf(40)).toMatch(/^var\(--chart-seq-\d\)$/);
    expect(scales.get("cat")?.category?.colorOf("x")).toMatch(/^var\(--chart-\d+\)$/);
    expect(scales.get("cat")?.category?.colorOf("x")).not.toBe(
      scales.get("cat")?.category?.colorOf("y"),
    );
    expect(scales.has("plain")).toBe(false);
  });
});
