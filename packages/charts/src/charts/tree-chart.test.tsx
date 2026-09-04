/**
 * tree-chart.test.tsx — the pure layout engine is unit-tested directly
 * (`computeTreeLayout`, no jsdom measurement involved — see the module
 * header for why TreeChart needs no `ResizeObserver`), plus a render smoke
 * test for the React component. A full interaction pass lives in the
 * co-located Storybook story (`tree-chart.stories.tsx`), exercised by
 * `pnpm --filter @elabs-ai/components-docs test-storybook` in CI.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { computeTreeLayout, TreeChart, type TreeNode } from "./tree-chart";

const orgChart: TreeNode = {
  name: "Engineering",
  children: [
    {
      name: "Platform",
      children: [{ name: "CI" }, { name: "Infra" }, { name: "Release" }],
    },
    {
      name: "Product",
      children: [{ name: "Onboarding" }, { name: "Billing" }],
    },
  ],
};

const deepChart: TreeNode = {
  name: "Root",
  children: [
    {
      name: "A",
      children: [
        {
          name: "A1",
          children: [{ name: "A1a" }, { name: "A1b" }, { name: "A1c" }],
        },
      ],
    },
  ],
};

describe("computeTreeLayout", () => {
  it("lays out every node in the source tree", () => {
    const layout = computeTreeLayout(orgChart, {
      orientation: "lr",
      palette: "mono",
      nodeRadius: 3.5,
    });
    // Root + 2 branches + 5 leaves = 8 nodes; 7 links (one per edge).
    expect(layout.nodes).toHaveLength(8);
    expect(layout.links).toHaveLength(7);
    expect(layout.maxDepth).toBe(2);
  });

  it("preserves data order, never sorts siblings (deliberately non-alphabetical fixture)", () => {
    // "Release" < "Infra" < "CI" alphabetically is the OPPOSITE of this data
    // order — a stray `.sort()` on siblings would flip this list and this
    // test would still pass with an alphabetically-ordered fixture, so the
    // fixture itself has to be out of alphabetical order to discriminate.
    const outOfOrderTree: TreeNode = {
      name: "Root",
      children: [
        { name: "Zebra" },
        { name: "Apple" },
        {
          name: "Mango",
          children: [{ name: "Release" }, { name: "Infra" }, { name: "CI" }],
        },
      ],
    };
    const layout = computeTreeLayout(outOfOrderTree, {
      orientation: "lr",
      palette: "mono",
      nodeRadius: 3.5,
    });
    const branches = layout.nodes.filter((n) => n.depth === 1).map((n) => n.name);
    expect(branches).toEqual(["Zebra", "Apple", "Mango"]);
    const mangoLeaves = layout.nodes
      .filter((n) => n.path[1] === "Mango" && n.isLeaf)
      .map((n) => n.name);
    expect(mangoLeaves).toEqual(["Release", "Infra", "CI"]);
  });

  it("swaps the growth/cross axes between lr and tb — lr grows in x, tb grows in y", () => {
    const lr = computeTreeLayout(orgChart, { orientation: "lr", palette: "mono", nodeRadius: 3.5 });
    const tb = computeTreeLayout(orgChart, { orientation: "tb", palette: "mono", nodeRadius: 3.5 });

    const lrRoot = lr.nodes.find((n) => n.depth === 0)!;
    const lrChild = lr.nodes.find((n) => n.depth === 1)!;
    // lr: depth advances along x (growth), not y (cross).
    expect(lrChild.x).toBeGreaterThan(lrRoot.x);

    const tbRoot = tb.nodes.find((n) => n.depth === 0)!;
    const tbChild = tb.nodes.find((n) => n.depth === 1)!;
    // tb: depth advances along y (growth), not x (cross).
    expect(tbChild.y).toBeGreaterThan(tbRoot.y);

    // The overall bounding box rotates with it: lr is wider than tall for a
    // tree with more depth than breadth-per-level, tb is the transpose.
    expect(lr.width).toBe(tb.height);
    expect(lr.height).toBe(tb.width);
  });

  it("never shrinks level spacing — depth-to-depth pixel gap is fixed regardless of tree size", () => {
    const small = computeTreeLayout(
      { name: "Root", children: [{ name: "Leaf" }] },
      { orientation: "lr", palette: "mono", nodeRadius: 3.5 },
    );
    const wide = computeTreeLayout(
      {
        name: "Root",
        children: Array.from({ length: 20 }, (_, i) => ({ name: `Leaf ${i}` })),
      },
      { orientation: "lr", palette: "mono", nodeRadius: 3.5 },
    );
    const smallRoot = small.nodes.find((n) => n.depth === 0)!;
    const smallLeaf = small.nodes.find((n) => n.depth === 1)!;
    const wideRoot = wide.nodes.find((n) => n.depth === 0)!;
    const wideLeaf = wide.nodes.find((n) => n.depth === 1)!;
    // Growth-axis (x, in "lr") gap between adjacent depths is identical
    // whether the tree has 1 leaf or 20 — a wider tree only grows the
    // cross axis, never compresses the level gap.
    expect(wideLeaf.x - wideRoot.x).toBe(smallLeaf.x - smallRoot.x);
    // The wide tree is taller (more siblings), not shorter.
    expect(wide.height).toBeGreaterThan(small.height);
  });

  it("collapseDepth replaces everything past the given depth with one pill carrying the hidden leaf count", () => {
    const layout = computeTreeLayout(orgChart, {
      orientation: "lr",
      palette: "mono",
      nodeRadius: 3.5,
      collapseDepth: 1,
    });
    // Root(0) + 2 branches(1) + 2 pills (one per branch) = 5 nodes.
    expect(layout.nodes).toHaveLength(5);
    const pills = layout.nodes.filter((n) => n.isCollapsed);
    expect(pills).toHaveLength(2);
    const platformPill = pills.find((p) => p.path[1] === "Platform")!;
    expect(platformPill.name).toBe("+3");
    expect(platformPill.collapsedCount).toBe(3);
    const productPill = pills.find((p) => p.path[1] === "Product")!;
    expect(productPill.name).toBe("+2");
    expect(productPill.collapsedCount).toBe(2);
  });

  it("collapseDepth on a deeper tree still collapses only past the given depth, counting all hidden leaves", () => {
    const layout = computeTreeLayout(deepChart, {
      orientation: "lr",
      palette: "mono",
      nodeRadius: 3.5,
      collapseDepth: 1,
    });
    // Root(0) + A(1) + one pill replacing A1 and its 3 leaves.
    expect(layout.nodes).toHaveLength(3);
    const pill = layout.nodes.find((n) => n.isCollapsed)!;
    expect(pill.name).toBe("+3");
  });

  it("draws links as cubic Bézier curves with the right source/target endpoints", () => {
    const layout = computeTreeLayout(orgChart, {
      orientation: "lr",
      palette: "mono",
      nodeRadius: 3.5,
    });
    const root = layout.nodes.find((n) => n.depth === 0)!;
    const platform = layout.nodes.find((n) => n.name === "Platform")!;
    const link = layout.links.find((l) => l.id === "link:Engineering/Platform")!;
    expect(link.d).toContain("C");
    expect(link.d.startsWith(`M${root.x},${root.y}`)).toBe(true);
    expect(link.d.endsWith(`${platform.x},${platform.y}`)).toBe(true);
  });

  it("mono palette shades strictly by depth — every node at a given depth shares one colour", () => {
    const layout = computeTreeLayout(orgChart, {
      orientation: "lr",
      palette: "mono",
      nodeRadius: 3.5,
    });
    const depth1Colors = new Set(layout.nodes.filter((n) => n.depth === 1).map((n) => n.color));
    expect(depth1Colors.size).toBe(1);
    const depth2Colors = new Set(layout.nodes.filter((n) => n.depth === 2).map((n) => n.color));
    expect(depth2Colors.size).toBe(1);
    // Different depths get different shades.
    expect([...depth1Colors][0]).not.toBe([...depth2Colors][0]);
  });

  it("categorical palette shades by top-level branch, with the root left neutral", () => {
    const layout = computeTreeLayout(orgChart, {
      orientation: "lr",
      palette: "categorical",
      nodeRadius: 3.5,
    });
    const root = layout.nodes.find((n) => n.depth === 0)!;
    const platformNodes = layout.nodes.filter((n) => n.path[1] === "Platform");
    const productNodes = layout.nodes.filter((n) => n.path[1] === "Product");
    const platformColors = new Set(platformNodes.map((n) => n.color));
    const productColors = new Set(productNodes.map((n) => n.color));
    // Every node under a branch (the branch node itself + its leaves) shares
    // one colour, and the two branches differ from each other.
    expect(platformColors.size).toBe(1);
    expect(productColors.size).toBe(1);
    expect([...platformColors][0]).not.toBe([...productColors][0]);
    // The root is neutral, not one of the branch hues.
    expect(root.color).not.toBe([...platformColors][0]);
    expect(root.color).not.toBe([...productColors][0]);
  });
});

describe("TreeChart", () => {
  it("renders without throwing, including the accessible label", () => {
    render(<TreeChart accessibleLabel="Org chart" data={orgChart} />);
    expect(screen.getByRole("figure", { name: "Org chart" })).toBeInTheDocument();
  });

  it("activates a node via keyboard when onDatapointClick is set (#349 contract)", async () => {
    const user = userEvent.setup();
    const onDatapointClick = vi.fn();
    render(
      <TreeChart accessibleLabel="Org chart" data={orgChart} onDatapointClick={onDatapointClick} />,
    );

    const group = screen.getByRole("group", { name: /chart data points/i });
    const targets = within(group).getAllByRole("button");
    expect(targets.length).toBeGreaterThan(0);

    targets[0]?.focus();
    await user.keyboard("{Enter}");

    expect(onDatapointClick).toHaveBeenCalledTimes(1);
    expect(onDatapointClick.mock.calls[0]?.[0]?.source).toBe("keyboard");
  });
});
