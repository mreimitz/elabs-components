import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCATTER_SIZE_RANGE,
  resolveColorBy,
  resolveScatterSizeRadius,
  resolveShapeBy,
  scatterSizeDomainMax,
} from "./scatter-encodings";

describe("scatterSizeDomainMax", () => {
  it("returns the largest finite non-negative value", () => {
    expect(scatterSizeDomainMax([{ v: 3 }, { v: 12 }, { v: 7 }], "v")).toBe(12);
  });

  it("ignores non-numeric / negative rows and returns 0 when nothing is usable", () => {
    expect(scatterSizeDomainMax([{ v: "x" }, { v: -5 }], "v")).toBe(0);
    expect(scatterSizeDomainMax([], "v")).toBe(0);
  });
});

describe("resolveScatterSizeRadius", () => {
  it("scales radius by sqrt(value / max) — a 4x value draws at 2x radius", () => {
    // domainMax equals the larger value so it draws at exactly sizeRange[1],
    // and sizeRange[0] is 0 so the floor never touches either bubble.
    const sizeRange: [number, number] = [0, 20];
    const small = resolveScatterSizeRadius(25, 100, sizeRange);
    const large = resolveScatterSizeRadius(100, 100, sizeRange);
    expect(large).toBeCloseTo(20, 10);
    expect(large / small).toBeCloseTo(2, 10);
  });

  it("floors at sizeRange[0] for a missing/non-numeric value", () => {
    expect(resolveScatterSizeRadius(undefined, 100, [4, 20])).toBe(4);
    expect(resolveScatterSizeRadius("nope", 100, [4, 20])).toBe(4);
  });

  it("floors at sizeRange[0] when there is no usable domain", () => {
    expect(resolveScatterSizeRadius(10, 0, [4, 20])).toBe(4);
  });

  it("uses DEFAULT_SCATTER_SIZE_RANGE when sizeRange is omitted", () => {
    expect(resolveScatterSizeRadius(0, 100)).toBe(DEFAULT_SCATTER_SIZE_RANGE[0]);
  });
});

describe("resolveColorBy", () => {
  it("returns no-op resolution when colorBy is undefined", () => {
    const { colorOf, legend } = resolveColorBy([{ k: "a" }], undefined);
    expect(legend).toEqual([]);
    expect(colorOf({ k: "a" })).toBeUndefined();
  });

  it("pins a category to a colour and leaves the rest on the palette", () => {
    const data = [{ region: "EU" }, { region: "US" }];
    const { colorOf, legend } = resolveColorBy(data, {
      key: "region",
      colors: { US: "var(--chart-mono-2)" },
    });
    expect(colorOf({ region: "US" })).toBe("var(--chart-mono-2)");
    expect(legend[1]?.color).toBe("var(--chart-mono-2)");
    expect(colorOf({ region: "EU" })).not.toBe("var(--chart-mono-2)");
  });

  it("assigns one categorical colour per distinct value, in first-seen order", () => {
    const data = [{ region: "EU" }, { region: "US" }, { region: "EU" }, { region: "APAC" }];
    const { colorOf, legend } = resolveColorBy(data, { key: "region" });
    expect(legend.map((l) => l.label)).toEqual(["EU", "US", "APAC"]);
    expect(new Set(legend.map((l) => l.color)).size).toBe(3);
    expect(colorOf({ region: "EU" })).toBe(legend[0]?.color);
    expect(colorOf({ region: "US" })).toBe(legend[1]?.color);
  });

  it("falls back to the mono ladder past the 6-category soft cap", () => {
    const data = Array.from({ length: 7 }, (_, i) => ({ region: `r${i}` }));
    const { legend } = resolveColorBy(data, { key: "region" });
    expect(legend).toHaveLength(7);
    // Every colour is a mono-ladder token, never a categorical one.
    expect(legend.every((l) => (l.color ?? "").includes("--chart-mono-"))).toBe(true);
  });

  it("buckets a sequential numeric column into `steps` stops", () => {
    const data = [{ v: 0 }, { v: 25 }, { v: 50 }, { v: 75 }, { v: 100 }];
    const { colorOf, legend } = resolveColorBy(data, {
      key: "v",
      scale: "sequential",
      steps: 4,
    });
    expect(legend).toHaveLength(4);
    // Low and high ends land in different buckets.
    expect(colorOf({ v: 0 })).not.toBe(colorOf({ v: 100 }));
  });

  it("resolves an unusable numeric column to an empty legend", () => {
    const { colorOf, legend } = resolveColorBy([{ v: "n/a" }], {
      key: "v",
      scale: "sequential",
    });
    expect(legend).toEqual([]);
    expect(colorOf({ v: "n/a" })).toBeUndefined();
  });
});

describe("resolveShapeBy", () => {
  it("returns no-op resolution when shapeBy is undefined", () => {
    const { shapeOf, legend } = resolveShapeBy([{ k: "a" }], undefined);
    expect(legend).toEqual([]);
    expect(shapeOf({ k: "a" })).toBeUndefined();
  });

  it("cycles through distinct values, capped at 6 shapes", () => {
    const data = Array.from({ length: 8 }, (_, i) => ({ kind: `k${i}` }));
    const { shapeOf, legend } = resolveShapeBy(data, { key: "kind" });
    expect(legend).toHaveLength(8);
    const shapes = legend.map((l) => l.shape);
    expect(new Set(shapes).size).toBeLessThanOrEqual(6);
    // The 7th and 8th distinct categories collapse onto the last shape.
    expect(shapeOf({ kind: "k6" })).toBe(shapeOf({ kind: "k5" }));
    expect(shapeOf({ kind: "k7" })).toBe(shapeOf({ kind: "k5" }));
  });

  it("honours an explicit shape ramp", () => {
    const data = [{ kind: "a" }, { kind: "b" }];
    const { shapeOf, legend } = resolveShapeBy(data, {
      key: "kind",
      shapes: ["star", "hexagon"],
    });
    expect(legend.map((l) => l.shape)).toEqual(["star", "hexagon"]);
    expect(shapeOf({ kind: "a" })).toBe("star");
    expect(shapeOf({ kind: "b" })).toBe("hexagon");
  });
});
