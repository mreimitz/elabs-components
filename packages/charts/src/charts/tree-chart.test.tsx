/**
 * tree-chart.test.tsx — the pure layout engine is unit-tested directly
 * (`computeTreeLayout`, no jsdom measurement involved — see the module
 * header for why the LAYOUT needs no `ResizeObserver`), plus the component:
 * the APG tree, expand/collapse by pointer and keyboard, controlled and
 * uncontrolled state, custom nodes, and the animation driver (with
 * `animate` mocked — jsdom never runs a real tween). The expand/collapse
 * motion itself is pure maths, tested in `tree-transition.test.ts`.
 */
import type { ReactNode } from "react";
import type * as MotionReact from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import { ChartConfigProvider } from "./chart-config-context";
import { computeTreeLayout, resolveTree, TreeChart, type TreeNode } from "./tree-chart";
import { estimateTextWidth } from "./use-text-measurer";

interface AnimateCall {
  from: number;
  to: number;
  options: {
    duration?: number;
    ease?: unknown;
    onUpdate?: (v: number) => void;
    onComplete?: () => void;
  };
  stop: ReturnType<typeof vi.fn>;
}

// jsdom never runs a real tween: `animate` is captured so a test can drive a
// flight to its end (or interrupt it) by hand.
const animateCalls: AnimateCall[] = [];
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof MotionReact>();
  return {
    ...actual,
    animate: vi.fn((from: number, to: number, options: AnimateCall["options"]) => {
      const stop = vi.fn();
      animateCalls.push({ from, to, options, stop });
      return { stop };
    }),
  };
});

beforeEach(() => {
  animateCalls.length = 0;
});

/** The in-app "reduce motion" preference: layout changes snap, no flight. */
function Reduced({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultMotionPreference="reduced" storageKey={null}>
      {children}
    </ThemeProvider>
  );
}

function renderReduced(ui: ReactNode) {
  return render(ui, { wrapper: Reduced });
}

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

    // The cross extent rotates with it exactly. The growth extent does not:
    // tb trims the empty margin above the root and sizes the bottom margin to
    // its vertical leaf labels, so it is only ever shorter than lr's width.
    expect(lr.height).toBe(tb.width);
    expect(tb.height).toBeLessThanOrEqual(lr.width);
  });

  it("tb leaf labels run down from the leaf and the layout reserves room for the longest", () => {
    const longName = "A very long leaf label name";
    const tb = computeTreeLayout(
      { name: "Root", children: [{ name: "Short" }, { name: longName }] },
      { orientation: "tb", palette: "mono", nodeRadius: 3.5 },
    );
    const leaf = tb.nodes.find((n) => n.name === longName)!;
    // Room below the deepest leaf covers the label's estimated run.
    expect(tb.height - leaf.y).toBeGreaterThan(estimateTextWidth(longName, 12));
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
    const pills = layout.nodes.filter((n) => n.isPill);
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
    const pill = layout.nodes.find((n) => n.isPill)!;
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
    // A link is named by its child's stable id; Platform is the root's first child.
    const link = layout.links.find((l) => l.id === "link:0.0")!;
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

describe("resolveTree — stable identity", () => {
  it("names nodes by their sibling-index path when they carry no id", () => {
    const { preorder } = resolveTree(orgChart);
    expect(preorder.map((n) => n.id)).toEqual([
      "0",
      "0.0",
      "0.0.0",
      "0.0.1",
      "0.0.2",
      "0.1",
      "0.1.0",
      "0.1.1",
    ]);
  });

  it("keeps an explicit id, and restates direct children and leaves", () => {
    const { byId } = resolveTree({
      name: "Root",
      id: "root",
      children: [{ name: "A", id: "a", children: [{ name: "A1" }, { name: "A2" }] }],
    });
    expect(byId.get("a")).toMatchObject({
      childCount: 2,
      descendantLeafCount: 2,
      parentId: "root",
    });
    expect(byId.get("0.0.1")?.name).toBe("A2");
  });

  it("warns once about a duplicate id and falls back to the path for the repeat", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { preorder } = resolveTree({
      name: "Root",
      children: [
        { name: "A", id: "dup" },
        { name: "B", id: "dup" },
      ],
    });
    expect(preorder.map((n) => n.id)).toEqual(["0", "dup", "0.1"]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("computeTreeLayout — expand/collapse", () => {
  it("lays out only the open branches; a closed branch shows its direct-child count", () => {
    const layout = computeTreeLayout(orgChart, {
      orientation: "lr",
      palette: "mono",
      nodeRadius: 3.5,
      expandedIds: new Set(["0", "0.1"]),
    });
    const platform = layout.nodes.find((n) => n.name === "Platform")!;
    expect(platform).toMatchObject({
      label: "Platform (3)",
      isExpandable: true,
      isExpanded: false,
      rendersAsLeaf: true,
      labelPlacement: "leaf",
      childCount: 3,
    });
    expect(layout.nodes.some((n) => n.name === "CI")).toBe(false);
    expect(layout.nodes.find((n) => n.name === "Product")?.label).toBe("Product");
  });

  it("a collapsed root in lr keeps its label after the dot, with room reserved for it", () => {
    const layout = computeTreeLayout(orgChart, {
      orientation: "lr",
      palette: "mono",
      nodeRadius: 3.5,
      expandedIds: new Set(),
    });
    expect(layout.nodes).toHaveLength(1);
    const root = layout.nodes[0]!;
    expect(root.labelPlacement).toBe("branch");
    expect(layout.width - root.x).toBeGreaterThan(estimateTextWidth("Engineering (2)", 12));
  });

  it("tb reserves room below a collapsed branch for its suffixed label", () => {
    const layout = computeTreeLayout(
      { name: "Root", children: [{ name: "A very long branch name", children: [{ name: "x" }] }] },
      { orientation: "tb", palette: "mono", nodeRadius: 3.5, expandedIds: new Set(["0"]) },
    );
    const branch = layout.nodes.find((n) => n.depth === 1)!;
    expect(layout.height - branch.y).toBeGreaterThan(
      estimateTextWidth("A very long branch name (1)", 12),
    );
  });

  it("hit boxes are at least 24px and a parent's never reaches its child's", () => {
    for (const orientation of ["lr", "tb"] as const) {
      const layout = computeTreeLayout(orgChart, { orientation, palette: "mono", nodeRadius: 3.5 });
      for (const n of layout.nodes) {
        expect(n.hit.width).toBeGreaterThanOrEqual(24);
        expect(n.hit.height).toBeGreaterThanOrEqual(24);
      }
      const byId = new Map(layout.nodes.map((n) => [n.id, n]));
      for (const child of layout.nodes) {
        const parent = child.parentId ? byId.get(child.parentId) : undefined;
        if (!parent) continue;
        if (orientation === "lr") {
          expect(parent.hit.x + parent.hit.width).toBeLessThanOrEqual(child.hit.x);
        } else {
          expect(parent.hit.y + parent.hit.height).toBeLessThanOrEqual(child.hit.y);
        }
      }
    }
  });

  it("custom boxes space by the box and put the toggle pill on the growth-side edge", () => {
    const box = { width: 160, height: 72 };
    const lr = computeTreeLayout(orgChart, {
      orientation: "lr",
      palette: "mono",
      nodeRadius: 3.5,
      nodeBox: box,
      expandedIds: new Set(["0"]),
    });
    const root = lr.nodes.find((n) => n.depth === 0)!;
    const platform = lr.nodes.find((n) => n.name === "Platform")!;
    const product = lr.nodes.find((n) => n.name === "Product")!;
    expect(platform.x - root.x).toBe(160 + 72);
    expect(product.y - platform.y).toBe(72 + 24);
    expect(platform.hit).toEqual({ x: platform.x - 80, y: platform.y - 36, ...box });
    // Collapsed pill: centred on the right edge, wide enough for the chevron and "(3)".
    const toggle = platform.toggle!;
    expect(toggle.x + toggle.width / 2).toBeCloseTo(platform.x + 80);
    expect(toggle.y + toggle.height / 2).toBeCloseTo(platform.y);
    expect(toggle.height).toBe(24);
    expect(toggle.width).toBeGreaterThan(24);
    // Expanded root: a round 24px chevron-only pill.
    expect(root.toggle).toMatchObject({ width: 24, height: 24 });
    // Links run edge to edge.
    const link = lr.links.find((l) => l.targetId === platform.id)!;
    expect(link.source).toEqual([root.x + 80, root.y]);
    expect(link.target).toEqual([platform.x - 80, platform.y]);

    const tb = computeTreeLayout(orgChart, {
      orientation: "tb",
      palette: "mono",
      nodeRadius: 3.5,
      nodeBox: box,
    });
    const tbRoot = tb.nodes.find((n) => n.depth === 0)!;
    const tbPlatform = tb.nodes.find((n) => n.name === "Platform")!;
    expect(tbPlatform.y - tbRoot.y).toBe(72 + 72);
    expect(tbRoot.toggle!.y + 12).toBeCloseTo(tbRoot.y + 36);
    // The whole canvas holds every box.
    for (const n of tb.nodes) {
      expect(n.hit.x).toBeGreaterThanOrEqual(0);
      expect(n.hit.x + n.hit.width).toBeLessThanOrEqual(tb.width);
      expect(n.hit.y + n.hit.height).toBeLessThanOrEqual(tb.height);
    }
  });
});

// ── The component ────────────────────────────────────────────────────────────

function itemNamed(name: string): HTMLElement {
  return screen.getByRole("treeitem", { name });
}

function labels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-slot="tree-node-label"]')).map(
    (el) => el.textContent ?? "",
  );
}

describe("TreeChart — tree semantics", () => {
  it("renders without throwing, including the accessible label", () => {
    render(<TreeChart accessibleLabel="Org chart" data={orgChart} />);
    expect(screen.getByRole("figure", { name: "Org chart" })).toBeInTheDocument();
  });

  it("is an APG tree of visible nodes in depth-first order, one tab stop", () => {
    render(<TreeChart accessibleLabel="Org chart" data={orgChart} />);
    const tree = screen.getByRole("tree", { name: "Org chart" });
    const items = within(tree).getAllByRole("treeitem");
    expect(items).toHaveLength(8);
    expect(items.filter((el) => el.tabIndex === 0)).toHaveLength(1);
    expect(items[0]).toHaveAttribute("tabindex", "0");

    const platform = itemNamed("Platform, in Engineering, 3 children");
    expect(platform).toHaveAttribute("aria-level", "2");
    expect(platform).toHaveAttribute("aria-posinset", "1");
    expect(platform).toHaveAttribute("aria-setsize", "2");
    expect(platform).toHaveAttribute("aria-expanded", "true");
    const ci = itemNamed("CI, in Engineering › Platform");
    expect(ci).toHaveAttribute("aria-level", "3");
    expect(ci).not.toHaveAttribute("aria-expanded");
  });

  it("names each node with its place and its visible count (exact strings)", () => {
    render(<TreeChart accessibleLabel="Org chart" data={orgChart} />);
    expect(screen.getByRole("treeitem", { name: /^Engineering/ })).toHaveAccessibleName(
      "Engineering, 2 children, 5 members",
    );
    expect(screen.getByRole("treeitem", { name: /^Platform/ })).toHaveAccessibleName(
      "Platform, in Engineering, 3 children",
    );
    expect(screen.getByRole("treeitem", { name: /^CI/ })).toHaveAccessibleName(
      "CI, in Engineering › Platform",
    );
  });

  it("falls back to the localised layer name when the chart has no label", () => {
    render(<TreeChart data={orgChart} />);
    expect(screen.getByRole("tree", { name: "Chart data points" })).toBeInTheDocument();
  });

  it("a consumer-supplied datapointLabel still wins over the default", () => {
    render(
      <TreeChart
        accessibleLabel="Org chart"
        data={orgChart}
        datapointLabel={(point) => `custom:${String(point.category)}`}
      />,
    );
    expect(screen.getByRole("treeitem", { name: "custom:Engineering" })).toBeInTheDocument();
  });

  it("interactions.active = false renders nothing focusable and no tree", () => {
    const { container } = render(
      <ChartConfigProvider value={{ interactions: { active: false } }}>
        <TreeChart data={orgChart} defaultExpandedDepth={1} onDatapointClick={() => {}} />
      </ChartConfigProvider>,
    );
    expect(screen.queryByRole("tree")).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(container.querySelectorAll('[data-slot="tree-chart-toggle"]')).toHaveLength(0);
    expect(container.querySelectorAll("[tabindex]")).toHaveLength(0);
    // The current state still draws.
    expect(labels(container)).toContain("Platform (3)");
  });
});

describe("TreeChart — expand and collapse", () => {
  it("a click on a branch closes it: count in brackets, ring, children gone", () => {
    const { container } = renderReduced(<TreeChart accessibleLabel="Org" data={orgChart} />);
    fireEvent.click(itemNamed("Platform, in Engineering, 3 children"));
    const platform = itemNamed("Platform, in Engineering, 3 children");
    expect(platform).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("treeitem", { name: /^CI/ })).toBeNull();
    expect(labels(container)).toContain("Platform (3)");
    const ring = container.querySelector('[data-tree-node-id="0.0"] [data-slot="tree-node-ring"]');
    expect(ring).not.toBeNull();
    fireEvent.click(platform);
    expect(screen.getByRole("treeitem", { name: /^CI/ })).toBeInTheDocument();
    expect(container.querySelector('[data-slot="tree-node-ring"]')).toBeNull();
  });

  it("a click on a leaf does nothing and reaches a surrounding card", () => {
    const onCardClick = vi.fn();
    renderReduced(
      <div onClick={onCardClick}>
        <TreeChart accessibleLabel="Org" data={orgChart} />
      </div>,
    );
    fireEvent.click(itemNamed("CI, in Engineering › Platform"));
    expect(onCardClick).toHaveBeenCalledTimes(1);
    fireEvent.click(itemNamed("Platform, in Engineering, 3 children"));
    expect(onCardClick).toHaveBeenCalledTimes(1);
  });

  it("keyboard: arrows move and open/close, Space and Enter toggle without a handler", async () => {
    const user = userEvent.setup();
    renderReduced(<TreeChart accessibleLabel="Org" data={orgChart} />);
    const root = screen.getByRole("treeitem", { name: /^Engineering/ });
    act(() => root.focus());
    await user.keyboard("{ArrowDown}");
    const platform = screen.getByRole("treeitem", { name: /^Platform/ });
    expect(platform).toHaveFocus();
    expect(platform).toHaveAttribute("tabindex", "0");
    expect(root).toHaveAttribute("tabindex", "-1");

    await user.keyboard("{ArrowLeft}");
    expect(platform).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{ArrowRight}");
    expect(platform).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("treeitem", { name: /^CI/ })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(platform).toHaveFocus();

    await user.keyboard(" ");
    expect(platform).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{Enter}");
    expect(platform).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{End}");
    expect(screen.getByRole("treeitem", { name: /^Billing/ })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(root).toHaveFocus();
  });

  it("* opens every sibling of the focused node", async () => {
    const user = userEvent.setup();
    renderReduced(<TreeChart accessibleLabel="Org" data={orgChart} defaultExpandedDepth={1} />);
    act(() => screen.getByRole("treeitem", { name: /^Platform/ }).focus());
    await user.keyboard("*");
    expect(screen.getByRole("treeitem", { name: /^Platform/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("treeitem", { name: /^Product/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("with onDatapointClick, Enter and a body click drill in; the toggle still toggles", async () => {
    const user = userEvent.setup();
    const onDatapointClick = vi.fn();
    renderReduced(
      <TreeChart accessibleLabel="Org" data={orgChart} onDatapointClick={onDatapointClick} />,
    );
    const platform = screen.getByRole("treeitem", { name: /^Platform/ });
    act(() => platform.focus());
    await user.keyboard("{Enter}");
    expect(onDatapointClick).toHaveBeenCalledTimes(1);
    const [point] = onDatapointClick.mock.calls[0]!;
    expect(point).toMatchObject({ category: "Platform", source: "keyboard", value: undefined });
    expect(point.datum).toMatchObject({ id: "0.0", childCount: 3, isExpanded: true });
    expect(platform).toHaveAttribute("aria-expanded", "true");

    // A real mouse click carries `detail >= 1`; a screen reader's synthesized click is 0.
    fireEvent.click(platform, { detail: 1 });
    expect(onDatapointClick).toHaveBeenCalledTimes(2);
    expect(onDatapointClick.mock.calls[1]![0].source).toBe("pointer");

    const toggle = within(platform).getByRole("button", { name: "Hide children of Platform" });
    expect(toggle).toHaveAttribute("tabindex", "-1");
    fireEvent.click(toggle);
    expect(onDatapointClick).toHaveBeenCalledTimes(2);
    expect(platform).toHaveAttribute("aria-expanded", "false");
    expect(
      within(platform).getByRole("button", { name: "Show 3 children of Platform" }),
    ).toBeInTheDocument();
    // Space still toggles when Enter drills in.
    await user.keyboard(" ");
    expect(platform).toHaveAttribute("aria-expanded", "true");
  });

  it("without a handler the toggle zone is pointer-only and hidden from AT", () => {
    const { container } = renderReduced(<TreeChart accessibleLabel="Org" data={orgChart} />);
    const zones = container.querySelectorAll('[data-slot="tree-chart-toggle"]');
    expect(zones).toHaveLength(3);
    for (const zone of zones) {
      expect(zone.tagName).toBe("SPAN");
      expect(zone).toHaveAttribute("aria-hidden", "true");
      expect(zone).not.toHaveAttribute("tabindex");
    }
    fireEvent.click(zones[1]!);
    expect(screen.getByRole("treeitem", { name: /^Platform/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("keeps focus in the tree when a click closes the focused node's ancestor", () => {
    renderReduced(<TreeChart accessibleLabel="Org" data={orgChart} />);
    const ci = screen.getByRole("treeitem", { name: /^CI/ });
    act(() => ci.focus());
    const zone = screen
      .getByRole("treeitem", { name: /^Platform/ })
      .querySelector('[data-slot="tree-chart-toggle"]')!;
    fireEvent.click(zone);
    expect(screen.queryByRole("treeitem", { name: /^CI/ })).toBeNull();
    expect(screen.getByRole("treeitem", { name: /^Platform/ })).toHaveFocus();
    expect(screen.getByRole("treeitem", { name: /^Platform/ })).toHaveAttribute("tabindex", "0");
  });

  it("uncontrolled: defaultExpandedDepth seeds the state and onExpandedChange reports every change", () => {
    const onExpandedChange = vi.fn();
    const { container } = renderReduced(
      <TreeChart
        accessibleLabel="Org"
        data={orgChart}
        defaultExpandedDepth={1}
        onExpandedChange={onExpandedChange}
      />,
    );
    expect(labels(container)).toEqual(["Engineering", "Platform (3)", "Product (2)"]);
    fireEvent.click(screen.getByRole("treeitem", { name: /^Product/ }));
    expect(onExpandedChange).toHaveBeenLastCalledWith(["0", "0.1"]);
    expect(labels(container)).toContain("Billing");
  });

  it("uncontrolled: defaultExpandedIds wins over the depth rule", () => {
    const { container } = renderReduced(
      <TreeChart
        accessibleLabel="Org"
        data={orgChart}
        defaultExpandedDepth={1}
        defaultExpandedIds={["0", "0.0"]}
      />,
    );
    expect(labels(container)).toContain("CI");
    expect(labels(container)).toContain("Product (2)");
  });

  it("uncontrolled: branches that arrive with new data follow the depth rule", () => {
    const { container, rerender } = renderReduced(
      <TreeChart accessibleLabel="Org" data={orgChart} defaultExpandedDepth={2} />,
    );
    const grown: TreeNode = {
      ...orgChart,
      children: [
        ...(orgChart.children ?? []),
        { name: "Design", children: [{ name: "Brand", children: [{ name: "Logo" }] }] },
      ],
    };
    rerender(<TreeChart accessibleLabel="Org" data={grown} defaultExpandedDepth={2} />);
    expect(labels(container)).toContain("Design");
    expect(labels(container)).toContain("Brand (1)");
  });

  it("controlled: expandedIds is the whole truth; clicks only report", () => {
    const onExpandedChange = vi.fn();
    const { container, rerender } = renderReduced(
      <TreeChart
        accessibleLabel="Org"
        data={orgChart}
        expandedIds={["0"]}
        onExpandedChange={onExpandedChange}
      />,
    );
    expect(labels(container)).toEqual(["Engineering", "Platform (3)", "Product (2)"]);
    fireEvent.click(screen.getByRole("treeitem", { name: /^Platform/ }));
    expect(onExpandedChange).toHaveBeenCalledWith(["0", "0.0"]);
    expect(labels(container)).toEqual(["Engineering", "Platform (3)", "Product (2)"]);
    rerender(
      <TreeChart
        accessibleLabel="Org"
        data={orgChart}
        expandedIds={["0", "0.0"]}
        onExpandedChange={onExpandedChange}
      />,
    );
    expect(labels(container)).toContain("CI");
  });

  it("collapseDepth is an alias for defaultExpandedDepth while collapsible", () => {
    const { container } = renderReduced(
      <TreeChart accessibleLabel="Org" collapseDepth={1} data={orgChart} />,
    );
    expect(labels(container)).toEqual(["Engineering", "Platform (3)", "Product (2)"]);
    expect(container.querySelector('[data-slot="tree-collapsed"]')).toBeNull();
    expect(screen.getByRole("tree")).toBeInTheDocument();
  });

  it("collapsible={false} keeps the static chart: the '+k' pill and no tree", () => {
    const { container } = render(
      <TreeChart accessibleLabel="Org" collapseDepth={1} collapsible={false} data={orgChart} />,
    );
    const pills = Array.from(container.querySelectorAll('[data-slot="tree-collapsed-label"]')).map(
      (el) => el.textContent,
    );
    expect(pills).toEqual(["+3", "+2"]);
    expect(screen.queryByRole("tree")).toBeNull();
    expect(container.querySelector('[data-slot="tree-chart-toggle"]')).toBeNull();
  });

  it("collapsible={false} with a handler keeps the shared data-point buttons and old names", async () => {
    const user = userEvent.setup();
    const onDatapointClick = vi.fn();
    render(
      <TreeChart
        accessibleLabel="Org"
        collapsible={false}
        data={orgChart}
        onDatapointClick={onDatapointClick}
      />,
    );
    const group = screen.getByRole("group", { name: /chart data points/i });
    const targets = within(group).getAllByRole("button");
    expect(targets[0]).toHaveAccessibleName("Engineering, 5 members");
    act(() => targets[0]!.focus());
    await user.keyboard("{Enter}");
    expect(onDatapointClick).toHaveBeenCalledTimes(1);
    expect(onDatapointClick.mock.calls[0]?.[0]?.source).toBe("keyboard");
  });

  it("align='center' centres the canvas with auto margins", () => {
    const { container } = render(<TreeChart align="center" data={orgChart} />);
    expect(container.querySelector('[data-slot="tree-chart"]')).toHaveClass("flex");
    // The stage (the canvas's scaled footprint) is what centres; the canvas
    // inside it is what scales.
    expect(container.querySelector('[data-slot="tree-chart-stage"]')).toHaveClass(
      "m-auto",
      "shrink-0",
    );
  });

  it("zoomable: the corner controls scale the canvas inside the range and fit brings it back", () => {
    const { container } = render(
      <TreeChart accessibleLabel="Org" data={orgChart} minimap zoomRange={[0.5, 1.5]} zoomable />,
    );
    const chart = container.querySelector<HTMLElement>('[data-slot="tree-chart"]')!;
    const canvas = container.querySelector<HTMLElement>('[data-slot="tree-chart-canvas"]')!;
    expect(chart).toHaveAttribute("data-zoom", "1.00");
    expect(canvas.style.transform).toBe("");
    expect(container.querySelector('[data-slot="tree-chart-frame"]')).not.toBeNull();
    expect(screen.getByRole("img", { name: /Overview of the tree/ })).toBeInTheDocument();

    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    fireEvent.click(zoomIn);
    expect(chart).toHaveAttribute("data-zoom", "1.20");
    expect(canvas.style.transform).toBe("scale(1.2)");
    fireEvent.click(zoomIn);
    fireEvent.click(zoomIn);
    // Clamped at the range's ceiling, and the button says so.
    expect(chart).toHaveAttribute("data-zoom", "1.50");
    expect(zoomIn).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(zoomIn);
    expect(chart).toHaveAttribute("data-zoom", "1.50");

    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(chart).toHaveAttribute("data-zoom", "1.25");
    // A wheel on the box zooms too (a trackpad pinch arrives the same way).
    fireEvent.wheel(chart, { deltaY: 500, clientX: 10, clientY: 10 });
    expect(parseFloat(chart.dataset.zoom!)).toBeLessThan(1.25);
  });

  it("without zoomable or minimap nothing changes: no frame, no controls, no scale", () => {
    const { container } = render(<TreeChart data={orgChart} />);
    expect(container.querySelector('[data-slot="tree-chart-frame"]')).toBeNull();
    expect(container.querySelector('[data-slot="tree-chart-viewport"]')).toBeNull();
    expect(container.querySelector('[data-slot="tree-chart"]')).not.toHaveAttribute("data-zoom");
  });

  it("shows the tooltip on focus and clears it on Escape", async () => {
    const user = userEvent.setup();
    renderReduced(<TreeChart accessibleLabel="Org" data={orgChart} />);
    act(() => screen.getByRole("treeitem", { name: /^Platform/ }).focus());
    expect(await screen.findByText("Members")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Members")).toBeNull();
  });
});

describe("TreeChart — custom nodes", () => {
  for (const orientation of ["lr", "tb"] as const) {
    it(`renders renderNode output in fixed boxes that still expand and collapse (${orientation})`, () => {
      const { container } = renderReduced(
        <TreeChart
          accessibleLabel="Org"
          data={orgChart}
          defaultExpandedDepth={1}
          nodeHeight={60}
          nodeWidth={140}
          orientation={orientation}
          renderNode={(node) => (
            <span data-testid={`card-${node.id}`}>
              {`${node.name}|${node.childCount}|${String(node.isExpanded)}|${node.orientation}`}
            </span>
          )}
        />,
      );
      const content = container.querySelectorAll('[data-slot="tree-chart-node-content"]');
      expect(content).toHaveLength(3);
      for (const el of content) expect(el).toHaveAttribute("aria-hidden", "true");
      expect(screen.getByTestId("card-0.0")).toHaveTextContent(`Platform|3|false|${orientation}`);
      const card = container.querySelector<HTMLElement>(
        '[data-slot="tree-chart-node"][data-node-id="0.0"]',
      )!;
      expect(card.style.width).toBe("140px");
      expect(card.style.height).toBe("60px");
      const pill = card.querySelector('[data-slot="tree-chart-node-toggle"]')!;
      expect(pill).toHaveTextContent("(3)");
      // No default dots or labels with custom nodes.
      expect(container.querySelector('[data-slot="tree-node"]')).toBeNull();

      const item = screen.getByRole("treeitem", { name: "Platform, in Engineering, 3 children" });
      fireEvent.click(item);
      expect(item).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByTestId("card-0.0")).toHaveTextContent(`Platform|3|true|${orientation}`);
      expect(screen.getByTestId("card-0.0.0")).toBeInTheDocument();
      expect(
        container.querySelector('[data-node-id="0.0"] [data-slot="tree-chart-node-toggle"]'),
      ).not.toHaveTextContent("(3)");
    });
  }

  it("renderLink draws at every link's midpoint, with the child's place among its siblings", () => {
    const { container } = renderReduced(
      <TreeChart
        accessibleLabel="Org"
        data={orgChart}
        defaultExpandedDepth={1}
        renderLink={(link) => (
          <span data-testid={`op-${link.targetId}`}>
            {`${link.source.name}>${link.target.name}|${link.index}/${link.siblingCount}|${link.depth}|${link.orientation}`}
          </span>
        )}
        renderNode={(node) => <span>{node.name}</span>}
      />,
    );
    const layer = container.querySelector('[data-slot="tree-chart-links"]')!;
    expect(layer).toHaveAttribute("aria-hidden", "true");
    // Two links are drawn (root → Platform, root → Product); the closed branches' links are not.
    const decorations = container.querySelectorAll('[data-slot="tree-chart-link-decoration"]');
    expect(decorations).toHaveLength(2);
    expect(screen.getByTestId("op-0.0")).toHaveTextContent("Engineering>Platform|0/2|1|lr");
    expect(screen.getByTestId("op-0.1")).toHaveTextContent("Engineering>Product|1/2|1|lr");
    // Centred on the link: the box sits at the midpoint of the link's drawn endpoints.
    const path = container.querySelector<SVGPathElement>('[data-slot="tree-link"]')!;
    const [sx, sy, ex, ey] = path
      .getAttribute("d")!
      .match(/^M([\d.-]+),([\d.-]+)C.*?([\d.-]+),([\d.-]+)$/)!
      .slice(1)
      .map(Number) as [number, number, number, number];
    const box = decorations[0] as HTMLElement;
    expect(parseFloat(box.style.left)).toBeCloseTo((sx + ex) / 2, 3);
    expect(parseFloat(box.style.top)).toBeCloseTo((sy + ey) / 2, 3);

    // Opening a branch adds its links' decorations.
    fireEvent.click(screen.getByRole("treeitem", { name: /^Platform/ }));
    expect(container.querySelectorAll('[data-slot="tree-chart-link-decoration"]')).toHaveLength(5);
    expect(screen.getByTestId("op-0.0.2")).toHaveTextContent("Platform>Release|2/3|2|lr");
  });

  it("tells renderNode which node holds the tab stop", () => {
    renderReduced(
      <TreeChart
        accessibleLabel="Org"
        data={orgChart}
        renderNode={(node) => <span data-testid={`card-${node.id}`}>{String(node.isActive)}</span>}
      />,
    );
    expect(screen.getByTestId("card-0")).toHaveTextContent("true");
    act(() => screen.getByRole("treeitem", { name: /^Platform/ }).focus());
    expect(screen.getByTestId("card-0")).toHaveTextContent("false");
    expect(screen.getByTestId("card-0.0")).toHaveTextContent("true");
  });
});

describe("TreeChart — animation", () => {
  afterEach(() => {
    animateCalls.length = 0;
  });

  it("first paint never animates", () => {
    render(<TreeChart data={orgChart} />);
    expect(animateCalls).toHaveLength(0);
  });

  it("reduced motion snaps: no flight, no leaving copies", () => {
    const { container } = renderReduced(<TreeChart data={orgChart} />);
    fireEvent.click(screen.getByRole("treeitem", { name: /^Platform/ }));
    expect(animateCalls).toHaveLength(0);
    expect(container.querySelector('[data-tree-node-id="0.0.0"]')).toBeNull();
    const canvas = container.querySelector<HTMLElement>('[data-slot="tree-chart-canvas"]')!;
    expect(canvas.style.width).toMatch(/px$/);
  });

  it("a toggle flies on the slow motion token and lands on the new layout", () => {
    const { container } = render(<TreeChart data={orgChart} />);
    fireEvent.click(screen.getByRole("treeitem", { name: /^Platform/ }));
    expect(animateCalls).toHaveLength(1);
    const call = animateCalls[0]!;
    expect(call.from).toBe(0);
    expect(call.to).toBe(1);
    expect(call.options.duration).toBeCloseTo(0.38);
    expect(call.options.ease).toEqual([0.2, 0, 0, 1]);

    // In flight: the tree already has the new state; the leaving node is
    // still drawn, but can take no pointer.
    expect(screen.queryByRole("treeitem", { name: /^CI/ })).toBeNull();
    const leaving = container.querySelector('[data-tree-node-id="0.0.0"]');
    expect(leaving).not.toBeNull();
    expect(leaving).toHaveClass("pointer-events-none");

    act(() => {
      call.options.onUpdate?.(1);
      call.options.onComplete?.();
    });
    expect(container.querySelector('[data-tree-node-id="0.0.0"]')).toBeNull();
    expect(labels(container)).toContain("Platform (3)");
  });

  it("a change mid-flight stops the old tween and starts a new one", () => {
    const { container } = render(<TreeChart data={orgChart} />);
    const platform = screen.getByRole("treeitem", { name: /^Platform/ });
    fireEvent.click(platform);
    const first = animateCalls[0]!;
    act(() => first.options.onUpdate?.(0.5));
    fireEvent.click(platform);
    expect(first.stop).toHaveBeenCalled();
    expect(animateCalls).toHaveLength(2);
    const second = animateCalls[1]!;
    act(() => {
      second.options.onUpdate?.(1);
      second.options.onComplete?.();
    });
    // The stale first tween's completion must not end the new flight early.
    act(() => first.options.onComplete?.());
    expect(labels(container)).toContain("CI");
    expect(container.querySelector('[data-tree-node-id="0.0.0"]')).not.toBeNull();
  });

  it("an orientation switch animates too", () => {
    const { rerender } = render(<TreeChart data={orgChart} />);
    rerender(<TreeChart data={orgChart} orientation="tb" />);
    expect(animateCalls).toHaveLength(1);
  });
});

// ── #278: scroll-edge fade ───────────────────────────────────────────────────

/** The root scroll/tab-stop element, addressed by its stable selector. */
function treeRootOf(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-slot="tree-chart"]');
  if (!el) throw new Error("no [data-slot=tree-chart] in the rendered output");
  return el;
}

/**
 * jsdom reports 0 for every layout metric, so overflow has to be simulated —
 * same technique as `DataTable`'s `#330` scroll-fade affordance
 * (`data-table.test.tsx`). Re-measurement is driven through the component's
 * own `onScroll` handler, the same path a real scroll takes.
 */
function simulateScrollMetrics(
  el: HTMLElement,
  {
    scrollWidth,
    clientWidth,
    scrollLeft = 0,
    scrollHeight,
    clientHeight,
    scrollTop = 0,
  }: {
    scrollWidth: number;
    clientWidth: number;
    scrollLeft?: number;
    scrollHeight: number;
    clientHeight: number;
    scrollTop?: number;
  },
) {
  Object.defineProperty(el, "scrollWidth", { configurable: true, value: scrollWidth });
  Object.defineProperty(el, "clientWidth", { configurable: true, value: clientWidth });
  Object.defineProperty(el, "scrollLeft", {
    configurable: true,
    writable: true,
    value: scrollLeft,
  });
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: scrollHeight });
  Object.defineProperty(el, "clientHeight", { configurable: true, value: clientHeight });
  Object.defineProperty(el, "scrollTop", { configurable: true, writable: true, value: scrollTop });
  fireEvent.scroll(el);
}

describe("TreeChart — scroll-edge fade affordance (#278)", () => {
  it("shows no fade when the tree fits its container — visual no-op", () => {
    const { container } = render(<TreeChart accessibleLabel="Org chart" data={orgChart} />);
    const root = treeRootOf(container);
    simulateScrollMetrics(root, {
      scrollWidth: 400,
      clientWidth: 400,
      scrollHeight: 300,
      clientHeight: 300,
    });
    expect(root).not.toHaveAttribute("data-scroll-overflow");
    expect(root.style.maskImage).toBe("");
  });

  it("fades only the bottom edge at rest, before scrolling an overflowing tree", () => {
    const { container } = render(<TreeChart accessibleLabel="Org chart" data={orgChart} />);
    const root = treeRootOf(container);
    simulateScrollMetrics(root, {
      scrollWidth: 400,
      clientWidth: 400,
      scrollHeight: 900,
      clientHeight: 300,
      scrollTop: 0,
    });
    expect(root).toHaveAttribute("data-scroll-overflow", "bottom");
    expect(root.style.maskImage).not.toBe("");
  });

  it("fades only the top edge once scrolled to the end", () => {
    const { container } = render(<TreeChart accessibleLabel="Org chart" data={orgChart} />);
    const root = treeRootOf(container);
    simulateScrollMetrics(root, {
      scrollWidth: 400,
      clientWidth: 400,
      scrollHeight: 900,
      clientHeight: 300,
      scrollTop: 600,
    });
    expect(root).toHaveAttribute("data-scroll-overflow", "top");
  });

  it("fades both edges of an axis when scrolled to the middle", () => {
    const { container } = render(<TreeChart accessibleLabel="Org chart" data={orgChart} />);
    const root = treeRootOf(container);
    simulateScrollMetrics(root, {
      scrollWidth: 400,
      clientWidth: 400,
      scrollHeight: 900,
      clientHeight: 300,
      scrollTop: 300,
    });
    expect(root.getAttribute("data-scroll-overflow")).toBe("top bottom");
  });

  it("fades an overflowing horizontal axis independently of the vertical one", () => {
    const { container } = render(<TreeChart accessibleLabel="Org chart" data={orgChart} />);
    const root = treeRootOf(container);
    simulateScrollMetrics(root, {
      scrollWidth: 900,
      clientWidth: 400,
      scrollLeft: 0,
      scrollHeight: 300,
      clientHeight: 300,
    });
    expect(root).toHaveAttribute("data-scroll-overflow", "right");
  });
});

// ── Review regressions ───────────────────────────────────────────────────────

/** Gives the scroller a measured viewport and a scroll position the component can move. */
function measuredScroller(container: HTMLElement, width: number, height: number) {
  const el = treeRootOf(container);
  let left = 0;
  let top = 0;
  Object.defineProperty(el, "clientWidth", { configurable: true, value: width });
  Object.defineProperty(el, "clientHeight", { configurable: true, value: height });
  Object.defineProperty(el, "scrollLeft", {
    configurable: true,
    get: () => left,
    set: (v: number) => {
      left = v;
    },
  });
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    get: () => top,
    set: (v: number) => {
      top = v;
    },
  });
  return () => ({ left, top });
}

/** An item's box (its hit rect), read back from the tree layer's inline style. */
function itemBox(item: HTMLElement) {
  const left = parseFloat(item.style.left);
  const top = parseFloat(item.style.top);
  return {
    left,
    top,
    right: left + parseFloat(item.style.width),
    bottom: top + parseFloat(item.style.height),
  };
}

function finishFlight(call: AnimateCall) {
  act(() => {
    call.options.onUpdate?.(1);
    call.options.onComplete?.();
  });
}

const wideNames: TreeNode = {
  name: "Company",
  children: [
    { name: "Engineering department", children: [{ name: "Platform" }, { name: "Web" }] },
    { name: "Customer Success", children: [{ name: "EMEA" }] },
    { name: "Marketing and brand", children: [{ name: "Brand" }] },
  ],
};

describe("computeTreeLayout — review regressions", () => {
  it("no node's dot or toggle lies under another node's hit box, in either orientation", () => {
    const strictlyInside = (
      [x, y]: [number, number],
      r: { x: number; y: number; width: number; height: number },
    ) => x > r.x && x < r.x + r.width && y > r.y && y < r.y + r.height;
    for (const orientation of ["lr", "tb"] as const) {
      for (const expandedIds of [undefined, new Set(["0"]), new Set(["0", "0.0"])]) {
        const layout = computeTreeLayout(wideNames, {
          orientation,
          palette: "mono",
          nodeRadius: 3.5,
          expandedIds,
        });
        for (const a of layout.nodes) {
          const points: [number, number][] = [[a.x, a.y]];
          if (a.toggle) {
            points.push([a.toggle.x + a.toggle.width / 2, a.toggle.y + a.toggle.height / 2]);
          }
          for (const b of layout.nodes) {
            if (b === a) continue;
            for (const p of points) expect(strictlyInside(p, b.hit)).toBe(false);
          }
          expect(a.hit.x).toBeGreaterThanOrEqual(0);
          expect(a.hit.x + a.hit.width).toBeLessThanOrEqual(layout.width);
        }
      }
    }
  });

  it("tb: an open branch's label keeps clear of a closed neighbour and inside the canvas", () => {
    for (const expandedIds of [new Set(["0", "0.0"]), new Set(["0", "0.2"])]) {
      const layout = computeTreeLayout(wideNames, {
        orientation: "tb",
        palette: "mono",
        nodeRadius: 3.5,
        expandedIds,
      });
      const half = (n: (typeof layout.nodes)[number]) =>
        n.labelPlacement === "branch" ? estimateTextWidth(n.label, 12) / 2 : 0;
      const row = layout.nodes.filter((n) => n.depth === 1);
      for (const a of row) {
        for (const b of row) {
          if (a === b || (half(a) === 0 && half(b) === 0)) continue;
          // A horizontal branch label never reaches a neighbour's dot or label.
          expect(Math.abs(a.x - b.x)).toBeGreaterThan(half(a) + half(b));
        }
      }
      for (const n of layout.nodes.filter((m) => m.labelPlacement === "branch")) {
        expect(n.x - half(n)).toBeGreaterThanOrEqual(0);
        expect(n.x + half(n)).toBeLessThanOrEqual(layout.width);
      }
    }
  });

  it("mono: a node keeps its shade when a deep branch closes", () => {
    const open = computeTreeLayout(deepChart, {
      orientation: "lr",
      palette: "mono",
      nodeRadius: 3.5,
    });
    const shut = computeTreeLayout(deepChart, {
      orientation: "lr",
      palette: "mono",
      nodeRadius: 3.5,
      expandedIds: new Set(["0", "0.0"]),
    });
    for (const n of shut.nodes) {
      expect(n.color).toBe(open.nodes.find((m) => m.id === n.id)!.color);
    }
  });

  it("tb: a closed branch on the deepest row reserves exactly what a same-label leaf does", () => {
    const long = "Infrastructure and operations";
    const leafTree: TreeNode = {
      name: "R",
      children: [{ name: "A", children: [{ name: `${long} (2)` }] }],
    };
    const branchTree: TreeNode = {
      name: "R",
      children: [
        { name: "A", children: [{ name: long, children: [{ name: "x" }, { name: "y" }] }] },
      ],
    };
    const leaf = computeTreeLayout(leafTree, {
      orientation: "tb",
      palette: "mono",
      nodeRadius: 3.5,
    });
    const branch = computeTreeLayout(branchTree, {
      orientation: "tb",
      palette: "mono",
      nodeRadius: 3.5,
      expandedIds: new Set(["0", "0.0"]),
    });
    const deepLeaf = leaf.nodes.at(-1)!;
    const deepBranch = branch.nodes.at(-1)!;
    expect(deepBranch.label).toBe(deepLeaf.label);
    expect(branch.height - deepBranch.y).toBeCloseTo(leaf.height - deepLeaf.y);
  });

  it("tb: only a collapsible chart widens its side margins for a long branch label", () => {
    const tree = (name: string): TreeNode => ({
      name,
      children: [{ name: "A", children: [{ name: "x" }] }, { name: "B" }],
    });
    const at = (name: string, expandedIds?: ReadonlySet<string>) =>
      computeTreeLayout(tree(name), {
        orientation: "tb",
        palette: "mono",
        nodeRadius: 3.5,
        expandedIds,
      });
    const long = "Engineering and infrastructure";
    // `collapsible={false}` keeps the size it always had: labels never widen it.
    expect(at(long).width).toBe(at("R").width);
    // The collapsible chart makes room so the root's centred label stays in the canvas.
    const open = at(long, new Set(["0"]));
    const root = open.nodes[0]!;
    expect(root.x - estimateTextWidth(long, 12) / 2).toBeGreaterThanOrEqual(0);
    expect(open.width).toBeGreaterThan(at("R", new Set(["0"])).width);
  });
});

describe("TreeChart — review regressions", () => {
  it("a node that was a leaf and gains children later follows the default rule", () => {
    const steps: TreeNode[] = [
      { name: "Plan", id: "plan" },
      { name: "Plan", id: "plan", children: [{ name: "Research", id: "r" }] },
      {
        name: "Plan",
        id: "plan",
        children: [{ name: "Research", id: "r", children: [{ name: "Sources", id: "s" }] }],
      },
    ];
    const streamed = renderReduced(<TreeChart data={steps[0]!} />);
    for (const step of steps.slice(1)) streamed.rerender(<TreeChart data={step} />);
    const fresh = renderReduced(<TreeChart data={steps.at(-1)!} />);
    expect(labels(streamed.container)).toEqual(labels(fresh.container));
    expect(labels(streamed.container)).toEqual(["Plan", "Research", "Sources"]);
  });

  it("adding a drill-in handler later keeps the open branches (no remount)", () => {
    const { container, rerender } = renderReduced(<TreeChart data={orgChart} />);
    fireEvent.click(screen.getByRole("treeitem", { name: /^Platform/ }));
    expect(labels(container)).toContain("Platform (3)");
    rerender(<TreeChart data={orgChart} onDatapointClick={() => {}} />);
    expect(labels(container)).toContain("Platform (3)");
    expect(
      within(screen.getByRole("treeitem", { name: /^Platform/ })).getByRole("button"),
    ).toBeInTheDocument();
  });

  it("a click the controlled parent ignored never steers a later change's scroll", () => {
    const ids = ["0", "0.0", "0.1"];
    const { container, rerender } = render(
      <TreeChart data={orgChart} expandedIds={ids} onExpandedChange={() => {}} />,
    );
    const scroll = measuredScroller(container, 60, 60);
    fireEvent.click(screen.getByRole("treeitem", { name: /^Product/ }));
    expect(animateCalls).toHaveLength(0);
    rerender(
      <TreeChart data={orgChart} expandedIds={ids} onExpandedChange={() => {}} orientation="tb" />,
    );
    expect(animateCalls).toHaveLength(1);
    act(() => animateCalls[0]!.options.onUpdate?.(1));
    expect(scroll()).toEqual({ left: 0, top: 0 });
  });

  it("reduced motion: an ignored click never jumps the scroll on a later change", () => {
    const ids = ["0", "0.0", "0.1"];
    const { container, rerender } = renderReduced(
      <TreeChart data={orgChart} expandedIds={ids} onExpandedChange={() => {}} />,
    );
    const scroll = measuredScroller(container, 60, 60);
    fireEvent.click(screen.getByRole("treeitem", { name: /^Product/ }));
    rerender(
      <TreeChart data={orgChart} expandedIds={ids} onExpandedChange={() => {}} orientation="tb" />,
    );
    expect(scroll()).toEqual({ left: 0, top: 0 });
  });

  it("an equal re-render mid-flight keeps the flight running instead of restarting it", () => {
    const ids = ["0", "0.0", "0.1"];
    const { rerender } = render(
      <TreeChart data={orgChart} expandedIds={ids} onExpandedChange={() => {}} />,
    );
    rerender(
      <TreeChart data={orgChart} expandedIds={ids} onExpandedChange={() => {}} orientation="tb" />,
    );
    expect(animateCalls).toHaveLength(1);
    act(() => animateCalls[0]!.options.onUpdate?.(0.7));
    fireEvent.click(screen.getByRole("treeitem", { name: /^Product/ }));
    rerender(
      <TreeChart
        data={orgChart}
        expandedIds={[...ids]}
        onExpandedChange={() => {}}
        orientation="tb"
      />,
    );
    expect(animateCalls).toHaveLength(1);
    expect(animateCalls[0]!.stop).not.toHaveBeenCalled();
  });

  it("in flight the tweened canvas paints the surface, never the union-sized svg", () => {
    const { container } = render(<TreeChart accessibleLabel="Org" data={orgChart} />);
    const canvas = () => container.querySelector('[data-slot="tree-chart-canvas"]')!;
    const surface = () => container.querySelector('rect[fill="var(--chart-background)"]');
    expect(surface()).not.toBeNull();
    expect(canvas()).not.toHaveClass("bg-chart-background");

    fireEvent.click(screen.getByRole("treeitem", { name: /^Platform/ }));
    expect(animateCalls).toHaveLength(1);
    expect(surface()).toBeNull();
    expect(canvas()).toHaveClass("bg-chart-background");

    finishFlight(animateCalls[0]!);
    expect(surface()).not.toBeNull();
    expect(canvas()).not.toHaveClass("bg-chart-background");
  });

  it("opening a branch scrolls its new children into view", () => {
    const { container } = render(
      <TreeChart accessibleLabel="Org" data={orgChart} defaultExpandedDepth={1} />,
    );
    const view = { width: 200, height: 200 };
    const scroll = measuredScroller(container, view.width, view.height);
    fireEvent.click(screen.getByRole("treeitem", { name: /^Platform/ }));
    finishFlight(animateCalls[0]!);
    const { left, top } = scroll();
    for (const name of [/^CI/, /^Infra/, /^Release/]) {
      const box = itemBox(screen.getByRole("treeitem", { name }));
      // At least the child's 24px dot square is on screen.
      expect(box.left).toBeGreaterThanOrEqual(left);
      expect(box.left + 24).toBeLessThanOrEqual(left + view.width);
      expect(box.top).toBeGreaterThanOrEqual(top);
      expect(box.bottom).toBeLessThanOrEqual(top + view.height);
    }
  });

  it("align='center' opens centred on the root when the tree overflows", () => {
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    const height = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(60);
    let top = 0;
    const setTop = vi.spyOn(HTMLElement.prototype, "scrollTop", "set").mockImplementation(function (
      this: HTMLElement,
      v: number,
    ) {
      if (this.dataset.slot === "tree-chart") top = v;
    });
    try {
      render(<TreeChart align="center" data={orgChart} />);
      const layout = computeTreeLayout(orgChart, {
        orientation: "lr",
        palette: "mono",
        nodeRadius: 3.5,
        expandedIds: new Set(["0", "0.0", "0.1"]),
      });
      const root = layout.nodes[0]!;
      expect(top).toBeCloseTo(Math.min(layout.height - 60, Math.max(0, root.y - 30)));
      expect(top).toBeGreaterThan(0);
    } finally {
      width.mockRestore();
      height.mockRestore();
      setTop.mockRestore();
    }
  });

  it("a pointer click on a toggle focuses its item without a keyboard focus ring", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    try {
      renderReduced(
        <TreeChart accessibleLabel="Org" data={orgChart} onDatapointClick={() => {}} />,
      );
      const platform = screen.getByRole("treeitem", { name: /^Platform/ });
      const toggle = within(platform).getByRole("button", { name: "Hide children of Platform" });
      fireEvent.click(toggle, { detail: 1 });
      expect(platform).toHaveAttribute("aria-expanded", "false");
      expect(platform).toHaveFocus();
      expect(focus).toHaveBeenCalledWith({ preventScroll: true, focusVisible: false });
    } finally {
      focus.mockRestore();
    }
  });

  it("toggle zones sit above neighbouring items, so the dot always wins the click", () => {
    const { container } = renderReduced(<TreeChart data={wideNames} orientation="tb" />);
    for (const zone of container.querySelectorAll('[data-slot="tree-chart-toggle"]')) {
      expect(zone).toHaveClass("z-10");
    }
  });

  it("the closed-branch ring is neutral ink, not the node's hue", () => {
    const { container } = renderReduced(
      <TreeChart data={orgChart} defaultExpandedDepth={1} palette="categorical" />,
    );
    const rings = container.querySelectorAll('[data-slot="tree-node-ring"]');
    expect(rings).toHaveLength(2);
    for (const ring of rings) {
      expect(ring).toHaveAttribute("stroke", "var(--chart-foreground-muted)");
    }
  });

  it("an orientation switch fades each label across; at rest one label per node", () => {
    const { container, rerender } = render(<TreeChart data={orgChart} />);
    rerender(<TreeChart data={orgChart} orientation="tb" />);
    const platform = container.querySelector('[data-tree-node-id="0.0"]')!;
    // In flight: the old label (HaloText's own slot) and the new one.
    expect(platform.querySelectorAll("text")).toHaveLength(2);
    expect(platform.querySelectorAll('[data-slot="tree-node-label"]')).toHaveLength(1);
    expect(labels(container)).toHaveLength(8);
    finishFlight(animateCalls[0]!);
    expect(
      container.querySelector('[data-tree-node-id="0.0"]')!.querySelectorAll("text"),
    ).toHaveLength(1);
  });

  it("custom nodes: an orientation switch fades the pill to its new edge", () => {
    const { container, rerender } = render(
      <TreeChart data={orgChart} renderNode={(node) => <span>{node.name}</span>} />,
    );
    const pills = () =>
      container.querySelectorAll('[data-node-id="0.0"] [data-slot="tree-chart-node-toggle"]');
    expect(pills()).toHaveLength(1);
    rerender(
      <TreeChart
        data={orgChart}
        orientation="tb"
        renderNode={(node) => <span>{node.name}</span>}
      />,
    );
    expect(pills()).toHaveLength(2);
    finishFlight(animateCalls[0]!);
    expect(pills()).toHaveLength(1);
  });

  describe("collapsible={false}", () => {
    it("keeps the payload it always had: `index` is the node's depth", () => {
      const onDatapointClick = vi.fn();
      render(
        <TreeChart
          accessibleLabel="Org"
          collapsible={false}
          data={orgChart}
          onDatapointClick={onDatapointClick}
        />,
      );
      const group = screen.getByRole("group", { name: /chart data points/i });
      fireEvent.click(within(group).getByRole("button", { name: /^CI,/ }));
      expect(onDatapointClick).toHaveBeenCalledTimes(1);
      const [point] = onDatapointClick.mock.calls[0]!;
      expect(point).toMatchObject({ category: "CI", index: 2 });
      expect(point.datum.id).toBeUndefined();
    });

    it("ignores renderNode (with a warning) and draws the default dots", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const { container } = render(
          <TreeChart
            collapsible={false}
            data={orgChart}
            renderNode={(node) => <span data-testid="card">{node.name}</span>}
          />,
        );
        expect(screen.queryByTestId("card")).toBeNull();
        expect(container.querySelectorAll('[data-slot="tree-node"]')).toHaveLength(8);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("renderNode"));
      } finally {
        warn.mockRestore();
      }
    });
  });
});
