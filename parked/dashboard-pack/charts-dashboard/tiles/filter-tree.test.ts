import { describe, expect, it } from "vitest";

import {
  buildLevelTree,
  buildParentChildTree,
  descendantsOf,
  expandedToLevel,
  filterTree,
  flattenTree,
} from "./filter-tree";

const GEO = [
  { Country: "Germany", Region: "Bavaria", City: "Munich", count: 3 },
  { Country: "Germany", Region: "Bavaria", City: "Nuremberg" },
  { Country: "Germany", Region: "Hesse", City: "Frankfurt" },
  { Country: "Austria", Region: "Vienna", City: "Vienna" },
  { Country: "", Region: "Unknown", City: "Nowhere" },
];

const LEVELS = [{ field: "Country" }, { field: "Region" }, { field: "City" }];

describe("buildLevelTree", () => {
  it("nests one node per distinct value path, in first-seen order", () => {
    const tree = buildLevelTree(LEVELS, GEO);
    expect(tree.map((n) => n.label)).toEqual(["Germany", "Austria"]);
    const germany = tree[0]!;
    expect(germany.children.map((n) => n.label)).toEqual(["Bavaria", "Hesse"]);
    expect(germany.children[0]!.children.map((n) => n.label)).toEqual(["Munich", "Nuremberg"]);
  });

  it("ids are the field=value path and each node selects in its own level's field", () => {
    const [germany] = buildLevelTree(LEVELS, GEO);
    const munich = germany!.children[0]!.children[0]!;
    expect(munich.id).toBe("Country=Germany/Region=Bavaria/City=Munich");
    expect(munich.field).toBe("City");
    expect(munich.value).toBe("Munich");
    expect(munich.depth).toBe(2);
  });

  it("rolls `count` up (rows without one count 1) and drops rows with an empty level", () => {
    const [germany] = buildLevelTree(LEVELS, GEO);
    expect(germany!.count).toBe(5); // 3 + 1 + 1
    expect(germany!.children[0]!.count).toBe(4);
    expect(flattenTree(buildLevelTree(LEVELS, GEO)).some((n) => n.label === "Unknown")).toBe(false);
  });
});

describe("buildParentChildTree", () => {
  const ORG = [
    { manager: "", id: "ceo", name: "Alice" },
    { manager: "ceo", id: "vp-eng", name: "Bob" },
    { manager: "vp-eng", id: "lead", name: "Charlie" },
    { manager: "ceo", id: "vp-sales", name: "Diana" },
    { manager: "ghost", id: "orphan", name: "Eve" },
  ];
  const SPEC = { parentField: "manager", childField: "id", labelField: "name" };

  it("builds the tree from a self-referential table; unknown parents become roots", () => {
    const tree = buildParentChildTree(SPEC, ORG);
    expect(tree.map((n) => n.label)).toEqual(["Alice", "Eve"]);
    const alice = tree[0]!;
    expect(alice.children.map((n) => n.label)).toEqual(["Bob", "Diana"]);
    expect(alice.children[0]!.children[0]!.label).toBe("Charlie");
    expect(alice.children[0]!.children[0]!.depth).toBe(2);
  });

  it("selects in the child field, labels from the label field, counts roll up", () => {
    const [alice] = buildParentChildTree(SPEC, ORG);
    expect(alice!.field).toBe("id");
    expect(alice!.value).toBe("ceo");
    expect(alice!.count).toBe(4);
  });

  it("survives a cycle", () => {
    const tree = buildParentChildTree({ parentField: "p", childField: "c" }, [
      { p: "b", c: "a" },
      { p: "a", c: "b" },
    ]);
    // Neither row is a root by "empty parent", so the cycle is unreachable and drops out —
    // but nothing loops forever.
    expect(flattenTree(tree).length).toBeLessThanOrEqual(2);
  });
});

describe("expandedToLevel / filterTree / descendantsOf", () => {
  const tree = buildLevelTree(LEVELS, GEO);

  it("expandedToLevel lists the branches above the given depth; -1 is every branch", () => {
    expect(expandedToLevel(tree, 0)).toEqual([]);
    expect(expandedToLevel(tree, 1)).toEqual(["Country=Germany", "Country=Austria"]);
    expect(expandedToLevel(tree, -1)).toHaveLength(5);
  });

  it("filterTree keeps matches with their ancestors, case-insensitively", () => {
    const hit = filterTree(tree, "NUREM");
    expect(hit.map((n) => n.label)).toEqual(["Germany"]);
    expect(hit[0]!.children.map((n) => n.label)).toEqual(["Bavaria"]);
    expect(hit[0]!.children[0]!.children.map((n) => n.label)).toEqual(["Nuremberg"]);
    // A matching branch keeps all its children.
    expect(filterTree(tree, "bavaria")[0]!.children[0]!.children).toHaveLength(2);
    expect(filterTree(tree, "  ")).toHaveLength(2);
  });

  it("descendantsOf excludes the node itself", () => {
    expect(descendantsOf(tree[0]!).map((n) => n.label)).toEqual([
      "Bavaria",
      "Munich",
      "Nuremberg",
      "Hesse",
      "Frankfurt",
    ]);
  });
});
