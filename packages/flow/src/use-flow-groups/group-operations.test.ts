import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import {
  collapseGroup,
  expandGroup,
  groupNodes,
  isFlowGroupProxyEdge,
  toggleGroupCollapsed,
  ungroup,
} from "./group-operations";

/** Three free-standing nodes, sized so `getNodesBounds` has real dimensions. */
function baseNodes(): Node[] {
  return [
    { id: "a", type: "brand", position: { x: 0, y: 0 }, width: 100, height: 40, data: {} },
    { id: "b", type: "brand", position: { x: 200, y: 0 }, width: 100, height: 40, data: {} },
    { id: "c", type: "brand", position: { x: 400, y: 200 }, width: 100, height: 40, data: {} },
  ];
}

describe("groupNodes", () => {
  it("inserts the group parent BEFORE its children in the array", () => {
    const { nodes } = groupNodes(baseNodes(), [], ["a", "b"], { groupId: "g1" });
    const groupIdx = nodes.findIndex((n) => n.id === "g1");
    const aIdx = nodes.findIndex((n) => n.id === "a");
    const bIdx = nodes.findIndex((n) => n.id === "b");

    expect(groupIdx).toBeGreaterThanOrEqual(0);
    expect(groupIdx).toBeLessThan(aIdx);
    expect(groupIdx).toBeLessThan(bIdx);
  });

  it("re-parents children and makes their positions relative to the group origin", () => {
    const { nodes } = groupNodes(baseNodes(), [], ["a", "b"], { groupId: "g1" });
    const group = nodes.find((n) => n.id === "g1")!;
    const a = nodes.find((n) => n.id === "a")!;

    expect(a.parentId).toBe("g1");
    expect(a.extent).toBe("parent");
    // Original absolute position minus the group origin equals the new relative position.
    expect(a.position.x).toBeCloseTo(0 - group.position.x);
    expect(a.position.y).toBeCloseTo(0 - group.position.y);
    // Relative positions must be non-negative (children sit inside the group box).
    expect(a.position.x).toBeGreaterThanOrEqual(0);
    expect(a.position.y).toBeGreaterThanOrEqual(0);
  });

  it("sets a childCount and leaves non-selected nodes untouched", () => {
    const input = baseNodes();
    const { nodes } = groupNodes(input, [], ["a", "b"], { groupId: "g1", title: "My group" });
    const group = nodes.find((n) => n.id === "g1")!;
    const c = nodes.find((n) => n.id === "c")!;

    expect((group.data as { title: string; childCount: number }).title).toBe("My group");
    expect((group.data as { childCount: number }).childCount).toBe(2);
    // `c` was not grouped — same reference, unchanged.
    expect(c).toBe(input[2]);
  });

  it("no-ops when no matching ids are given", () => {
    const input = baseNodes();
    const { nodes } = groupNodes(input, [], ["nope"], { groupId: "g1" });
    expect(nodes).toBe(input);
  });

  it("does not mutate the input arrays", () => {
    const input = baseNodes();
    const snapshot = JSON.parse(JSON.stringify(input));
    groupNodes(input, [], ["a", "b"], { groupId: "g1" });
    expect(input).toEqual(snapshot);
  });
});

describe("ungroup", () => {
  it("restores children to absolute positions and removes the group", () => {
    const original = baseNodes();
    const grouped = groupNodes(original, [], ["a", "b"], { groupId: "g1" });
    const { nodes } = ungroup(grouped.nodes, grouped.edges, "g1");

    expect(nodes.find((n) => n.id === "g1")).toBeUndefined();
    const a = nodes.find((n) => n.id === "a")!;
    expect(a.parentId).toBeUndefined();
    expect(a.extent).toBeUndefined();
    // Back to the original absolute coordinates.
    expect(a.position.x).toBeCloseTo(0);
    expect(a.position.y).toBeCloseTo(0);
  });
});

/**
 * A group `g` containing children `x`, `y`; with an outside node `out`.
 * Edges: out→x (boundary), x→y (fully inside), y→out (boundary).
 */
function groupedFixture(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: "g",
      type: "group",
      position: { x: 0, y: 0 },
      width: 300,
      height: 200,
      data: { title: "G", childCount: 2 },
    },
    {
      id: "x",
      type: "brand",
      parentId: "g",
      extent: "parent",
      position: { x: 20, y: 60 },
      data: {},
    },
    {
      id: "y",
      type: "brand",
      parentId: "g",
      extent: "parent",
      position: { x: 160, y: 60 },
      data: {},
    },
    { id: "out", type: "brand", position: { x: 600, y: 60 }, data: {} },
  ];
  const edges: Edge[] = [
    { id: "e-out-x", source: "out", target: "x" },
    { id: "e-x-y", source: "x", target: "y" },
    { id: "e-y-out", source: "y", target: "out" },
  ];
  return { nodes, edges };
}

describe("collapseGroup", () => {
  it("hides the whole subtree but not the group or outside nodes", () => {
    const { nodes, edges } = groupedFixture();
    const out = collapseGroup(nodes, edges, "g");

    expect(out.nodes.find((n) => n.id === "x")!.hidden).toBe(true);
    expect(out.nodes.find((n) => n.id === "y")!.hidden).toBe(true);
    expect(out.nodes.find((n) => n.id === "g")!.hidden).toBeUndefined();
    expect(out.nodes.find((n) => n.id === "out")!.hidden).toBeUndefined();
    expect((out.nodes.find((n) => n.id === "g")!.data as { collapsed: boolean }).collapsed).toBe(
      true,
    );
  });

  it("creates proxy edges ONLY for boundary-crossing edges (not fully-inside)", () => {
    const { nodes, edges } = groupedFixture();
    const out = collapseGroup(nodes, edges, "g");

    const proxies = out.edges.filter(isFlowGroupProxyEdge);
    // Two boundary edges (out→x, y→out); the inside edge (x→y) gets no proxy.
    expect(proxies).toHaveLength(2);

    const inTargeting = proxies.find((e) => e.source === "out");
    expect(inTargeting!.target).toBe("g"); // x replaced by the group
    const outSourcing = proxies.find((e) => e.target === "out");
    expect(outSourcing!.source).toBe("g"); // y replaced by the group

    // The fully-inside edge is never proxied and is not hidden.
    const inside = out.edges.find((e) => e.id === "e-x-y")!;
    expect(isFlowGroupProxyEdge(inside)).toBe(false);
    expect(inside.hidden).toBeUndefined();

    // Original boundary edges are hidden while collapsed.
    expect(out.edges.find((e) => e.id === "e-out-x")!.hidden).toBe(true);
    expect(out.edges.find((e) => e.id === "e-y-out")!.hidden).toBe(true);
  });

  it("shrinks the group to a fixed overview size", () => {
    const { nodes, edges } = groupedFixture();
    const out = collapseGroup(nodes, edges, "g");
    const g = out.nodes.find((n) => n.id === "g")!;
    expect(g.width).toBeLessThan(300);
    expect(g.height).toBeLessThan(200);
  });

  it("is a no-op when the group is already collapsed", () => {
    const { nodes, edges } = groupedFixture();
    const once = collapseGroup(nodes, edges, "g");
    const twice = collapseGroup(once.nodes, once.edges, "g");
    expect(twice.nodes).toBe(once.nodes);
    expect(twice.edges).toBe(once.edges);
  });

  it("does not mutate the input arrays", () => {
    const { nodes, edges } = groupedFixture();
    const nodeSnap = JSON.parse(JSON.stringify(nodes));
    const edgeSnap = JSON.parse(JSON.stringify(edges));
    collapseGroup(nodes, edges, "g");
    expect(nodes).toEqual(nodeSnap);
    expect(edges).toEqual(edgeSnap);
  });
});

describe("expandGroup — exact inverse of collapseGroup", () => {
  it("round-trips nodes and edges back to the exact original", () => {
    const { nodes, edges } = groupedFixture();
    const collapsed = collapseGroup(nodes, edges, "g");
    const expanded = expandGroup(collapsed.nodes, collapsed.edges, "g");

    expect(expanded.nodes).toEqual(nodes);
    expect(expanded.edges).toEqual(edges);
  });

  it("removes proxy edges and restores the original boundary edges", () => {
    const { nodes, edges } = groupedFixture();
    const collapsed = collapseGroup(nodes, edges, "g");
    const expanded = expandGroup(collapsed.nodes, collapsed.edges, "g");

    expect(expanded.edges.some(isFlowGroupProxyEdge)).toBe(false);
    expect(expanded.edges.find((e) => e.id === "e-out-x")!.hidden).toBeUndefined();
    expect(expanded.edges.map((e) => e.id)).toEqual(["e-out-x", "e-x-y", "e-y-out"]);
  });

  it("toggle collapses then expands back to the original", () => {
    const { nodes, edges } = groupedFixture();
    const collapsed = toggleGroupCollapsed(nodes, edges, "g");
    expect(
      (collapsed.nodes.find((n) => n.id === "g")!.data as { collapsed: boolean }).collapsed,
    ).toBe(true);
    const expanded = toggleGroupCollapsed(collapsed.nodes, collapsed.edges, "g");
    expect(expanded.nodes).toEqual(nodes);
    expect(expanded.edges).toEqual(edges);
  });

  it("no-ops when the group is not collapsed", () => {
    const { nodes, edges } = groupedFixture();
    const out = expandGroup(nodes, edges, "g");
    expect(out.nodes).toBe(nodes);
    expect(out.edges).toBe(edges);
  });
});

/**
 * Nested fixture: outer group `G` contains child `p` and subgroup `H`; `H`
 * contains `q`. An outside node `out`. Edges cross several boundaries.
 */
function nestedFixture(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: "G",
      type: "group",
      position: { x: 0, y: 0 },
      width: 500,
      height: 300,
      data: { title: "G", childCount: 2 },
    },
    {
      id: "p",
      type: "brand",
      parentId: "G",
      extent: "parent",
      position: { x: 20, y: 60 },
      data: {},
    },
    {
      id: "H",
      type: "group",
      parentId: "G",
      extent: "parent",
      position: { x: 200, y: 60 },
      width: 240,
      height: 180,
      data: { title: "H", childCount: 1 },
    },
    {
      id: "q",
      type: "brand",
      parentId: "H",
      extent: "parent",
      position: { x: 20, y: 60 },
      data: {},
    },
    { id: "out", type: "brand", position: { x: 900, y: 60 }, data: {} },
  ];
  const edges: Edge[] = [
    { id: "e-out-q", source: "out", target: "q" }, // out → deep inside
    { id: "e-p-q", source: "p", target: "q" }, // inside G, crosses H boundary
    { id: "e-q-out", source: "q", target: "out" }, // deep inside → out
  ];
  return { nodes, edges };
}

describe("nested groups", () => {
  it("collapsing the inner group then the outer keeps the inner collapsed on outer-expand (no double-unhide)", () => {
    const { nodes, edges } = nestedFixture();

    // Collapse inner H first.
    const hCollapsed = collapseGroup(nodes, edges, "H");
    expect(hCollapsed.nodes.find((n) => n.id === "q")!.hidden).toBe(true);

    // Then collapse outer G.
    const gCollapsed = collapseGroup(hCollapsed.nodes, hCollapsed.edges, "G");
    expect(gCollapsed.nodes.find((n) => n.id === "p")!.hidden).toBe(true);
    expect(gCollapsed.nodes.find((n) => n.id === "H")!.hidden).toBe(true);
    expect(gCollapsed.nodes.find((n) => n.id === "q")!.hidden).toBe(true);

    // Expand only G — must restore to the post-H-collapse state exactly:
    // H visible + still collapsed, q still hidden (H owns it).
    const gExpanded = expandGroup(gCollapsed.nodes, gCollapsed.edges, "G");
    expect(gExpanded.nodes).toEqual(hCollapsed.nodes);
    expect(gExpanded.edges).toEqual(hCollapsed.edges);
    expect(gExpanded.nodes.find((n) => n.id === "H")!.hidden).toBeUndefined();
    expect(
      (gExpanded.nodes.find((n) => n.id === "H")!.data as { collapsed: boolean }).collapsed,
    ).toBe(true);
    expect(gExpanded.nodes.find((n) => n.id === "q")!.hidden).toBe(true);
  });

  it("full nested round-trip: collapse H, collapse G, expand G, expand H returns the original", () => {
    const { nodes, edges } = nestedFixture();
    const hCollapsed = collapseGroup(nodes, edges, "H");
    const gCollapsed = collapseGroup(hCollapsed.nodes, hCollapsed.edges, "G");
    const gExpanded = expandGroup(gCollapsed.nodes, gCollapsed.edges, "G");
    const hExpanded = expandGroup(gExpanded.nodes, gExpanded.edges, "H");

    expect(hExpanded.nodes).toEqual(nodes);
    expect(hExpanded.edges).toEqual(edges);
  });
});
