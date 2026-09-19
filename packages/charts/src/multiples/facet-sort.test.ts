import { describe, expect, it } from "vitest";

import { resolveFacetColumns, splitFacetRows } from "./facet-layout";
import { facetPanelStats, sortFacetPanels } from "./facet-sort";

const panel = (title: string, values: number[]) => ({
  key: title,
  title,
  stats: facetPanelStats(
    values.map((v) => ({ v })),
    "v",
  ),
});

describe("facetPanelStats", () => {
  it("reads start, end, delta, % change and range", () => {
    expect(facetPanelStats([{ v: 4 }, { v: null }, { v: 2 }, { v: 6 }], "v")).toEqual({
      start: 4,
      end: 6,
      delta: 2,
      deltaPercent: 50,
      min: 2,
      max: 6,
      range: 4,
    });
    expect(facetPanelStats([{ v: 0 }, { v: 3 }], "v").deltaPercent).toBeNull();
  });
});

describe("sortFacetPanels", () => {
  const panels = [panel("DRAM", [2, 8]), panel("NAND", [5, 6]), panel("HDD", [10, 13])];

  it("sorts by % change, largest first", () => {
    expect(sortFacetPanels(panels, "deltaPercent").map((p) => p.title)).toEqual([
      "DRAM",
      "HDD",
      "NAND",
    ]);
  });

  it("reverses, sorts titles alphabetically and keeps data order", () => {
    expect(sortFacetPanels(panels, "deltaPercent", true).map((p) => p.title)).toEqual([
      "NAND",
      "HDD",
      "DRAM",
    ]);
    expect(sortFacetPanels(panels, "title").map((p) => p.title)).toEqual(["DRAM", "HDD", "NAND"]);
    expect(sortFacetPanels(panels, "data").map((p) => p.title)).toEqual(["DRAM", "NAND", "HDD"]);
  });

  it("sorts a panel without a figure last", () => {
    const empty = { key: "none", title: "None", stats: facetPanelStats([], "v") };
    expect(sortFacetPanels([empty, ...panels], "end").map((p) => p.title)).toEqual([
      "HDD",
      "DRAM",
      "NAND",
      "None",
    ]);
  });
});

describe("facet layout", () => {
  it("splits rows by the facet column in first-appearance order", () => {
    const groups = splitFacetRows([{ k: "b" }, { k: "a" }, { k: "b" }, { k: null }], "k");
    expect(groups.map((g) => [g.key, g.rows.length])).toEqual([
      ["b", 2],
      ["a", 1],
    ]);
  });

  it("packs auto columns by minimum panel width, never more than panels", () => {
    expect(resolveFacetColumns("auto", 868, 4, 240, 16)).toBe(3);
    expect(resolveFacetColumns("auto", 348, 4, 240, 16)).toBe(1);
    expect(resolveFacetColumns(3, 900, 2)).toBe(2);
  });
});
