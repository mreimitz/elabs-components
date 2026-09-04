/**
 * treemap-layout.test.ts — the pure layout engine, unit-tested directly
 * (never through the React component — see the module header for why: a
 * `ResizeObserver`-measured container reports 0×0 under jsdom).
 */
import { describe, expect, it } from "vitest";
import {
  computeTreemapLayout,
  TREEMAP_BAND_COLOR,
  TREEMAP_MAX_LEAVES,
  TREEMAP_MONO_LEAF_COLOR,
  TREEMAP_TITLE_BAND_HEIGHT,
  type TreemapNode,
  validateTreemapData,
} from "./treemap-layout";

// "Where the work went" (F13) — the lieflat example: two groups, several leaves.
const whereTheWorkWent: TreemapNode = {
  name: "Work",
  children: [
    {
      name: "Platform",
      children: [
        { name: "CI", value: 40 },
        { name: "Infra", value: 30 },
        { name: "Release", value: 10 },
      ],
    },
    {
      name: "Product",
      children: [
        { name: "Onboarding", value: 25 },
        { name: "Billing", value: 15 },
        { name: "Search", value: 5 },
      ],
    },
  ],
};

function area(rect: { x0: number; y0: number; x1: number; y1: number }): number {
  return Math.max(0, rect.x1 - rect.x0) * Math.max(0, rect.y1 - rect.y0);
}

describe("computeTreemapLayout", () => {
  it("returns an empty layout for a non-positive box", () => {
    expect(
      computeTreemapLayout(whereTheWorkWent, {
        width: 0,
        height: 400,
        depth: 2,
        gap: 2,
        palette: "mono",
        otherThreshold: 0,
      }),
    ).toEqual({ leaves: [], groups: [], total: 0 });
  });

  it("areas are proportional to value within 0.5% (RM-025 acceptance)", () => {
    const width = 800;
    const height = 500;
    const result = computeTreemapLayout(whereTheWorkWent, {
      width,
      height,
      depth: 2,
      gap: 0, // isolate the proportionality claim from gap-eaten area
      palette: "mono",
      otherThreshold: 0,
    });

    const total = result.total;
    expect(total).toBe(125);

    // Total leaf area should account for the whole canvas minus the reserved
    // title bands (gap is 0 here).
    const bandArea = result.groups.reduce(
      (acc, g) => acc + (g.x1 - g.x0) * TREEMAP_TITLE_BAND_HEIGHT,
      0,
    );
    const canvasArea = width * height;
    const expectedLeafArea = canvasArea - bandArea;
    const actualLeafArea = result.leaves.reduce((acc, leaf) => acc + area(leaf), 0);
    expect(Math.abs(actualLeafArea - expectedLeafArea) / expectedLeafArea).toBeLessThan(0.005);

    // Each leaf's OWN area share should track its value share within 0.5%.
    for (const leaf of result.leaves) {
      const areaShare = area(leaf) / expectedLeafArea;
      const valueShare = leaf.value / total;
      expect(Math.abs(areaShare - valueShare)).toBeLessThan(0.005);
    }
  });

  it("groups' rectangles are the union of their leaves' rectangles", () => {
    const result = computeTreemapLayout(whereTheWorkWent, {
      width: 640,
      height: 400,
      depth: 2,
      gap: 2,
      palette: "mono",
      otherThreshold: 0,
    });
    for (const group of result.groups) {
      const leaves = result.leaves.filter((l) => l.groupName === group.name);
      expect(leaves.length).toBeGreaterThan(0);
      const minX = Math.min(...leaves.map((l) => l.x0));
      const maxX = Math.max(...leaves.map((l) => l.x1));
      expect(minX).toBeCloseTo(group.x0, 5);
      expect(maxX).toBeCloseTo(group.x1, 5);
    }
  });

  it("depth: 1 flattens straight to the root's children, aggregating deeper levels", () => {
    const result = computeTreemapLayout(whereTheWorkWent, {
      width: 640,
      height: 400,
      depth: 1,
      gap: 2,
      palette: "mono",
      otherThreshold: 0,
    });
    expect(result.groups).toEqual([]);
    expect(result.leaves).toHaveLength(2);
    const names = result.leaves.map((l) => l.name).sort();
    expect(names).toEqual(["Platform", "Product"]);
    const platform = result.leaves.find((l) => l.name === "Platform");
    expect(platform?.value).toBe(80); // 40 + 30 + 10
    expect(platform?.groupName).toBeNull();
  });

  it("mono palette: every leaf shares one shade; the band is a different, neutral shade", () => {
    const result = computeTreemapLayout(whereTheWorkWent, {
      width: 640,
      height: 400,
      depth: 2,
      gap: 2,
      palette: "mono",
      otherThreshold: 0,
    });
    expect(new Set(result.leaves.map((l) => l.color))).toEqual(new Set([TREEMAP_MONO_LEAF_COLOR]));
    expect(new Set(result.groups.map((g) => g.color))).toEqual(new Set([TREEMAP_BAND_COLOR]));
    expect(TREEMAP_MONO_LEAF_COLOR).not.toBe(TREEMAP_BAND_COLOR);
  });

  it("categorical palette hues each of up to 4 groups distinctly, leaves inherit their group's hue", () => {
    const result = computeTreemapLayout(whereTheWorkWent, {
      width: 640,
      height: 400,
      depth: 2,
      gap: 2,
      palette: "categorical",
      otherThreshold: 0,
    });
    const groupColors = result.groups.map((g) => g.color);
    expect(new Set(groupColors).size).toBe(groupColors.length); // distinct
    for (const group of result.groups) {
      const leaves = result.leaves.filter((l) => l.groupName === group.name);
      expect(new Set(leaves.map((l) => l.color))).toEqual(new Set([group.color]));
    }
    // Band strip stays neutral even under the categorical palette — grouping
    // is a structural (band + gap) cue, not a colour one.
    expect(new Set(result.groups.map((g) => g.color))).not.toContain(TREEMAP_BAND_COLOR);
  });

  it("categorical falls back to mono past the 4-group cap", () => {
    const fiveGroups: TreemapNode = {
      name: "root",
      children: Array.from({ length: 5 }, (_, i) => ({
        name: `Group ${i}`,
        children: [{ name: "Leaf", value: 10 }],
      })),
    };
    const result = computeTreemapLayout(fiveGroups, {
      width: 640,
      height: 400,
      depth: 2,
      gap: 2,
      palette: "categorical",
      otherThreshold: 0,
    });
    expect(new Set(result.leaves.map((l) => l.color))).toEqual(new Set([TREEMAP_MONO_LEAF_COLOR]));
  });

  it("categorical falls back to mono at depth: 1 (no groups to hue)", () => {
    const result = computeTreemapLayout(whereTheWorkWent, {
      width: 640,
      height: 400,
      depth: 1,
      gap: 2,
      palette: "categorical",
      otherThreshold: 0,
    });
    expect(new Set(result.leaves.map((l) => l.color))).toEqual(new Set([TREEMAP_MONO_LEAF_COLOR]));
  });

  it("sequential palette buckets leaf shade by the leaf's own value", () => {
    const result = computeTreemapLayout(whereTheWorkWent, {
      width: 640,
      height: 400,
      depth: 2,
      gap: 2,
      palette: "sequential",
      otherThreshold: 0,
    });
    const ci = result.leaves.find((l) => l.name === "CI"); // 40 — the max leaf
    const search = result.leaves.find((l) => l.name === "Search"); // 5 — the min leaf
    expect(ci).toBeDefined();
    expect(search).toBeDefined();
    expect(ci?.color).not.toBe(search?.color);
    // The biggest leaf gets the ramp's most intense step.
    expect(ci?.color).toBe("var(--chart-seq-7)");
  });

  it("otherThreshold merges a qualifying long tail into a single 'Other' leaf per group", () => {
    const data: TreemapNode = {
      name: "root",
      children: [
        {
          name: "Group",
          children: [
            { name: "Big", value: 90 },
            { name: "Tiny A", value: 1 },
            { name: "Tiny B", value: 1 },
            { name: "Tiny C", value: 1 },
          ],
        },
      ],
    };
    const result = computeTreemapLayout(data, {
      width: 640,
      height: 400,
      depth: 2,
      gap: 2,
      palette: "mono",
      otherThreshold: 0.05, // 5% of the group's own total (93)
    });
    const names = result.leaves.map((l) => l.name).sort();
    expect(names).toEqual(["Big", "Other"]);
    const other = result.leaves.find((l) => l.name === "Other");
    expect(other?.value).toBe(3);
    expect(other?.isOther).toBe(true);
  });

  it("otherThreshold: off (0) does not merge, even with small leaves", () => {
    const data: TreemapNode = {
      name: "root",
      children: [
        {
          name: "Group",
          children: [
            { name: "Big", value: 90 },
            { name: "Tiny", value: 1 },
          ],
        },
      ],
    };
    const result = computeTreemapLayout(data, {
      width: 640,
      height: 400,
      depth: 2,
      gap: 2,
      palette: "mono",
      otherThreshold: 0,
    });
    expect(result.leaves.map((l) => l.name).sort()).toEqual(["Big", "Tiny"]);
  });

  it("merges past TREEMAP_MAX_LEAVES unconditionally, keeping the biggest", () => {
    const leaves = Array.from({ length: TREEMAP_MAX_LEAVES + 10 }, (_, i) => ({
      name: `Leaf ${i}`,
      value: TREEMAP_MAX_LEAVES + 10 - i, // descending, all distinct
    }));
    const data: TreemapNode = { name: "root", children: [{ name: "Group", children: leaves }] };
    const result = computeTreemapLayout(data, {
      width: 640,
      height: 400,
      depth: 2,
      gap: 2,
      palette: "mono",
      otherThreshold: 0,
    });
    expect(result.leaves).toHaveLength(TREEMAP_MAX_LEAVES);
    expect(result.leaves.some((l) => l.name === "Other")).toBe(true);
    expect(result.leaves.some((l) => l.name === "Leaf 0")).toBe(true); // the biggest survives
  });
});

describe("validateTreemapData", () => {
  it("does not throw on a valid tree whose parent value matches the sum of children", () => {
    expect(() =>
      validateTreemapData({
        name: "root",
        value: 30,
        children: [
          { name: "a", value: 10 },
          { name: "b", value: 20 },
        ],
      }),
    ).not.toThrow();
  });

  it("throws when a parent's explicit value does not equal the sum of its children", () => {
    expect(() =>
      validateTreemapData({
        name: "root",
        value: 99,
        children: [
          { name: "a", value: 10 },
          { name: "b", value: 20 },
        ],
      }),
    ).toThrow(/value 99, but its children sum to 30/);
  });

  it("throws on a negative value", () => {
    expect(() => validateTreemapData({ name: "leaf", value: -1 })).toThrow(/non-negative/);
  });

  it("throws on a leaf with neither value nor children", () => {
    expect(() => validateTreemapData({ name: "root", children: [{ name: "empty" }] })).toThrow(
      /neither a "value" nor "children"/,
    );
  });

  it("is a no-op in production", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      expect(() =>
        validateTreemapData({ name: "root", value: 99, children: [{ name: "a", value: 1 }] }),
      ).not.toThrow();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
