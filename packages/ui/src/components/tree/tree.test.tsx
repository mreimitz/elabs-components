/**
 * Tree component unit tests.
 *
 * Environment notes (jsdom):
 * - jsdom has zero layout: offsetHeight / getBoundingClientRect always return 0.
 *   `useVirtualizer` therefore computes zero total-size and renders 0 virtual rows
 *   unless we stub layout APIs. We apply a minimal stub (offsetHeight + getBCR) on
 *   the scroll container so the virtualizer sees a non-zero viewport and renders
 *   at least the overscan window.
 * - The "only a small window is mounted" assertion is best-effort under jsdom: we
 *   verify that fewer than all 5 000 treeitems are in the DOM.
 * - Interaction (ArrowDown scrolls virtualizer) and a11y (axe) are verified via
 *   the Storybook `run-story-tests` gate on the real browser surface.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tree, type TreeNode } from "./tree";

// ---------------------------------------------------------------------------
// jsdom layout stubs for @tanstack/react-virtual
// ---------------------------------------------------------------------------

const VIEWPORT_HEIGHT = 400;
const ROW_HEIGHT = 32;

/**
 * Stub `offsetHeight` and `getBoundingClientRect` on any element that has the
 * data-virtual-scroll attribute, so the virtualizer computes a non-zero
 * viewport and renders rows. We patch at the Element prototype level so every
 * scroll container benefits.
 */
let originalGetBCR: () => DOMRect;

beforeAll(() => {
  originalGetBCR = Element.prototype.getBoundingClientRect;

  // Give every element a height. The virtualizer uses this for its scroll container.
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return VIEWPORT_HEIGHT;
    },
  });

  Element.prototype.getBoundingClientRect = function () {
    return {
      width: 300,
      height: VIEWPORT_HEIGHT,
      top: 0,
      left: 0,
      bottom: VIEWPORT_HEIGHT,
      right: 300,
      x: 0,
      y: 0,
      toJSON() {
        return this;
      },
    };
  };
});

afterAll(() => {
  Element.prototype.getBoundingClientRect = originalGetBCR;
  // Remove the accessor we installed by redefining with a plain value descriptor.
  // We cannot mix accessor (get/set) and data (value/writable) in one call —
  // so delete the property first, then reinstall as a data property (jsdom default).
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return 0;
    },
  });
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const nodes: TreeNode[] = [
  {
    id: "fruits",
    label: "Fruits",
    children: [
      { id: "apple", label: "Apple" },
      { id: "banana", label: "Banana" },
    ],
  },
  {
    id: "veggies",
    label: "Vegetables",
    children: [{ id: "carrot", label: "Carrot" }],
  },
];

// ---------------------------------------------------------------------------
// scrollToId / scrollSelectionIntoView — reveal a programmatically-selected node
// ---------------------------------------------------------------------------

describe("Tree reveal-into-view (scrollToId / scrollSelectionIntoView)", () => {
  it("scrollToId expands a collapsed ancestor so the node is revealed (non-virtual)", async () => {
    const scrollSpy = vi.fn();
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollSpy;
    try {
      const { rerender } = render(<Tree nodes={nodes} />);
      // "Carrot" lives under the collapsed "Vegetables" — not in the DOM yet.
      expect(screen.queryByText("Carrot")).toBeNull();
      rerender(<Tree nodes={nodes} scrollToId="carrot" />);
      await waitFor(() => expect(screen.getByText("Carrot")).toBeInTheDocument());
      await waitFor(() => expect(scrollSpy).toHaveBeenCalled());
    } finally {
      Element.prototype.scrollIntoView = orig;
    }
  });

  it("scrollToId scrolls an already-visible node into view (non-virtual)", async () => {
    const scrollSpy = vi.fn();
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollSpy;
    try {
      const { rerender } = render(<Tree nodes={nodes} defaultExpandedIds={["fruits"]} />);
      rerender(<Tree nodes={nodes} defaultExpandedIds={["fruits"]} scrollToId="apple" />);
      await waitFor(() => expect(scrollSpy).toHaveBeenCalled());
    } finally {
      Element.prototype.scrollIntoView = orig;
    }
  });

  it("scrollSelectionIntoView reveals a newly-selected collapsed node", async () => {
    const scrollSpy = vi.fn();
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollSpy;
    try {
      const { rerender } = render(<Tree nodes={nodes} scrollSelectionIntoView selectedIds={[]} />);
      expect(screen.queryByText("Carrot")).toBeNull();
      rerender(<Tree nodes={nodes} scrollSelectionIntoView selectedIds={["carrot"]} />);
      await waitFor(() => expect(screen.getByText("Carrot")).toBeInTheDocument());
    } finally {
      Element.prototype.scrollIntoView = orig;
    }
  });

  it("scrollToId requests ancestor expansion in virtualize mode (controlled)", async () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <Tree
        nodes={nodes}
        virtualize
        maxHeight="400px"
        estimateRowHeight={ROW_HEIGHT}
        expandedIds={[]}
        onExpandedChange={onExpandedChange}
      />,
    );
    rerender(
      <Tree
        nodes={nodes}
        virtualize
        maxHeight="400px"
        estimateRowHeight={ROW_HEIGHT}
        expandedIds={[]}
        onExpandedChange={onExpandedChange}
        scrollToId="carrot"
      />,
    );
    // Reveal calls setExpandedIds → onExpandedChange (controlled) with the ancestor.
    await waitFor(() => expect(onExpandedChange).toHaveBeenCalled());
    const lastCall = onExpandedChange.mock.calls.at(-1)?.[0] as string[];
    expect([...lastCall]).toContain("veggies");
  });

  it("scrollToId to an unknown id is a graceful no-op", () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(<Tree nodes={nodes} onExpandedChange={onExpandedChange} />);
    expect(() =>
      rerender(
        <Tree nodes={nodes} onExpandedChange={onExpandedChange} scrollToId="does-not-exist" />,
      ),
    ).not.toThrow();
    expect(onExpandedChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Existing non-virtualized tests (must stay green)
// ---------------------------------------------------------------------------

describe("Tree (non-virtualized)", () => {
  it("renders a tree with treeitems", () => {
    render(<Tree nodes={nodes} />);
    expect(screen.getByRole("tree")).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /Fruits/ })).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /Vegetables/ })).toBeInTheDocument();
  });

  it("collapses children by default (descendants are not rendered)", () => {
    render(<Tree nodes={nodes} />);
    expect(screen.queryByRole("treeitem", { name: /Apple/ })).not.toBeInTheDocument();
  });

  it("uses roving tabindex — exactly one treeitem is tabbable", () => {
    render(<Tree nodes={nodes} defaultExpandedIds={["fruits"]} />);
    const items = screen.getAllByRole("treeitem");
    const tabbable = items.filter((el) => el.getAttribute("tabindex") === "0");
    expect(tabbable).toHaveLength(1);
  });

  it("marks expanded parents with aria-expanded and renders their children", () => {
    render(<Tree nodes={nodes} defaultExpandedIds={["fruits"]} />);
    expect(screen.getByRole("treeitem", { name: /Fruits/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("treeitem", { name: /Apple/ })).toBeInTheDocument();
  });

  it("exposes hierarchy semantics (aria-level / setsize / posinset)", () => {
    render(<Tree nodes={nodes} defaultExpandedIds={["fruits"]} />);
    const fruits = screen.getByRole("treeitem", { name: /Fruits/ });
    expect(fruits).toHaveAttribute("aria-level", "1");
    expect(fruits).toHaveAttribute("aria-setsize", "2");
    expect(fruits).toHaveAttribute("aria-posinset", "1");
    const apple = screen.getByRole("treeitem", { name: /Apple/ });
    expect(apple).toHaveAttribute("aria-level", "2");
  });

  it("toggles expansion when a parent row is clicked", async () => {
    const user = userEvent.setup();
    render(<Tree nodes={nodes} selectionMode="none" />);
    const fruits = screen.getByRole("treeitem", { name: /Fruits/ });
    expect(fruits).toHaveAttribute("aria-expanded", "false");
    await user.click(fruits);
    expect(fruits).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("treeitem", { name: /Apple/ })).toBeInTheDocument();
  });

  it("fires onSelectionChange and marks aria-selected on select", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <Tree nodes={nodes} defaultExpandedIds={["fruits"]} onSelectionChange={onSelectionChange} />,
    );
    await user.click(screen.getByRole("treeitem", { name: /Apple/ }));
    expect(onSelectionChange).toHaveBeenCalledWith(["apple"]);
    expect(screen.getByRole("treeitem", { name: /Apple/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("moves the active item with ArrowDown (roving focus)", async () => {
    const user = userEvent.setup();
    render(<Tree nodes={nodes} defaultExpandedIds={["fruits"]} />);
    const fruits = screen.getByRole("treeitem", { name: /Fruits/ });
    fruits.focus();
    expect(fruits).toHaveAttribute("tabindex", "0");
    await user.keyboard("{ArrowDown}");
    const apple = screen.getByRole("treeitem", { name: /Apple/ });
    expect(apple).toHaveAttribute("tabindex", "0");
    expect(fruits).toHaveAttribute("tabindex", "-1");
  });

  it("collapses an expanded parent with ArrowLeft", async () => {
    const user = userEvent.setup();
    render(<Tree nodes={nodes} defaultExpandedIds={["fruits"]} />);
    const fruits = screen.getByRole("treeitem", { name: /Fruits/ });
    fruits.focus();
    await user.keyboard("{ArrowLeft}");
    expect(fruits).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("treeitem", { name: /Apple/ })).not.toBeInTheDocument();
  });

  it("does not select disabled nodes", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const withDisabled: TreeNode[] = [
      { id: "a", label: "Alpha", disabled: true },
      { id: "b", label: "Beta" },
    ];
    render(<Tree nodes={withDisabled} onSelectionChange={onSelectionChange} />);
    await user.click(screen.getByRole("treeitem", { name: /Alpha/ }));
    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Lazy loading tests
// ---------------------------------------------------------------------------

describe("Tree (lazy loading)", () => {
  function makeLazyNodes(): TreeNode[] {
    return [
      { id: "root-a", label: "Category A", hasChildren: true },
      { id: "root-b", label: "Category B" },
    ];
  }

  it("shows the expand affordance for hasChildren nodes even without loaded children", () => {
    render(<Tree nodes={makeLazyNodes()} />);
    const catA = screen.getByRole("treeitem", { name: /Category A/ });
    // aria-expanded should be present (false) because it's expandable
    expect(catA).toHaveAttribute("aria-expanded", "false");
  });

  it("calls loadChildren on first expand and shows loading state (aria-busy)", async () => {
    const user = userEvent.setup();
    let resolveLoad!: (nodes: TreeNode[]) => void;
    const loadChildren = vi.fn(
      () =>
        new Promise<TreeNode[]>((res) => {
          resolveLoad = res;
        }),
    );

    render(<Tree nodes={makeLazyNodes()} loadChildren={loadChildren} />);
    const catA = screen.getByRole("treeitem", { name: /Category A/ });

    await user.click(catA);

    // loadChildren must have been called
    expect(loadChildren).toHaveBeenCalledTimes(1);
    expect(loadChildren).toHaveBeenCalledWith(expect.objectContaining({ id: "root-a" }));

    // While loading, aria-busy is set on the parent treeitem
    await waitFor(() => {
      expect(screen.getByRole("treeitem", { name: /Category A/ })).toHaveAttribute(
        "aria-busy",
        "true",
      );
    });

    // Resolve the promise with children
    await act(async () => {
      resolveLoad([
        { id: "child-1", label: "Child 1" },
        { id: "child-2", label: "Child 2" },
      ]);
    });

    // Children should now be rendered
    await waitFor(() => {
      expect(screen.getByRole("treeitem", { name: /Child 1/ })).toBeInTheDocument();
      expect(screen.getByRole("treeitem", { name: /Child 2/ })).toBeInTheDocument();
    });

    // aria-busy should be cleared
    expect(screen.getByRole("treeitem", { name: /Category A/ })).not.toHaveAttribute("aria-busy");
  });

  it("does not call loadChildren again on re-expand (cached)", async () => {
    const user = userEvent.setup();
    const loadChildren = vi.fn().mockResolvedValue([{ id: "child-1", label: "Child 1" }]);

    render(<Tree nodes={makeLazyNodes()} loadChildren={loadChildren} />);
    const catA = screen.getByRole("treeitem", { name: /Category A/ });

    // First expand — triggers fetch
    await user.click(catA);
    await waitFor(() => {
      expect(screen.getByRole("treeitem", { name: /Child 1/ })).toBeInTheDocument();
    });
    expect(loadChildren).toHaveBeenCalledTimes(1);

    // Collapse
    await user.click(screen.getByRole("treeitem", { name: /Category A/ }));
    await waitFor(() => {
      expect(screen.queryByRole("treeitem", { name: /Child 1/ })).not.toBeInTheDocument();
    });

    // Re-expand — should NOT call loadChildren again
    await user.click(screen.getByRole("treeitem", { name: /Category A/ }));
    await waitFor(() => {
      expect(screen.getByRole("treeitem", { name: /Child 1/ })).toBeInTheDocument();
    });
    expect(loadChildren).toHaveBeenCalledTimes(1);
  });

  it("shows error state and retry button when loadChildren rejects", async () => {
    const user = userEvent.setup();
    const loadChildren = vi.fn().mockRejectedValue(new Error("Network error"));

    render(<Tree nodes={makeLazyNodes()} loadChildren={loadChildren} />);
    const catA = screen.getByRole("treeitem", { name: /Category A/ });

    await user.click(catA);

    // Error state: "Failed to load" text visible, no crash
    await waitFor(() => {
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();

    // aria-busy is NOT set in error state (it's cleared)
    expect(screen.getByRole("treeitem", { name: /Category A/ })).not.toHaveAttribute("aria-busy");
  });

  it("retries successfully after error", async () => {
    const user = userEvent.setup();
    const loadChildren = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue([{ id: "retry-child", label: "Retry Child" }]);

    render(<Tree nodes={makeLazyNodes()} loadChildren={loadChildren} />);
    await user.click(screen.getByRole("treeitem", { name: /Category A/ }));

    await waitFor(() => expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByRole("treeitem", { name: /Retry Child/ })).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// surface prop tests
// ---------------------------------------------------------------------------

describe("Tree (surface prop)", () => {
  const simpleNodes: TreeNode[] = [
    { id: "a", label: "Alpha" },
    { id: "b", label: "Beta" },
  ];

  it("default surface uses bg-accent on the selected row", async () => {
    const user = userEvent.setup();
    render(<Tree nodes={simpleNodes} />);
    await user.click(screen.getByRole("treeitem", { name: /Alpha/ }));
    const selected = screen.getByRole("treeitem", { name: /Alpha/ });
    expect(selected).toHaveAttribute("aria-selected", "true");
    // classList gives exact token membership — avoids false matches from hover:bg-accent
    expect(selected.classList.contains("bg-accent")).toBe(true);
    expect(selected.classList.contains("bg-sidebar-accent")).toBe(false);
  });

  it("surface='default' (explicit) uses bg-accent on the selected row", async () => {
    const user = userEvent.setup();
    render(<Tree nodes={simpleNodes} surface="default" />);
    await user.click(screen.getByRole("treeitem", { name: /Alpha/ }));
    const selected = screen.getByRole("treeitem", { name: /Alpha/ });
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(selected.classList.contains("bg-accent")).toBe(true);
    expect(selected.classList.contains("bg-sidebar-accent")).toBe(false);
  });

  it("surface='sidebar' uses bg-sidebar-accent + text-sidebar-accent-foreground on the selected row", async () => {
    const user = userEvent.setup();
    render(<Tree nodes={simpleNodes} surface="sidebar" />);
    await user.click(screen.getByRole("treeitem", { name: /Alpha/ }));
    const selected = screen.getByRole("treeitem", { name: /Alpha/ });
    expect(selected).toHaveAttribute("aria-selected", "true");
    // classList gives exact token membership — avoids false matches from hover:bg-accent
    expect(selected.classList.contains("bg-sidebar-accent")).toBe(true);
    expect(selected.classList.contains("text-sidebar-accent-foreground")).toBe(true);
    expect(selected.classList.contains("bg-accent")).toBe(false);
  });

  it("surface='sidebar' threads through to nested child rows", async () => {
    const user = userEvent.setup();
    const nestedNodes: TreeNode[] = [
      {
        id: "parent",
        label: "Parent",
        children: [{ id: "child", label: "Child" }],
      },
    ];
    render(<Tree nodes={nestedNodes} surface="sidebar" defaultExpandedIds={["parent"]} />);
    await user.click(screen.getByRole("treeitem", { name: /Child/ }));
    const selected = screen.getByRole("treeitem", { name: /Child/ });
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(selected.classList.contains("bg-sidebar-accent")).toBe(true);
    expect(selected.classList.contains("bg-accent")).toBe(false);
  });

  it("surface='sidebar' works in virtualized mode", async () => {
    const user = userEvent.setup();
    const smallNodes: TreeNode[] = Array.from({ length: 20 }, (_, i) => ({
      id: `n-${i}`,
      label: `Node ${i + 1}`,
    }));
    render(
      <Tree
        nodes={smallNodes}
        surface="sidebar"
        virtualize
        maxHeight="400px"
        estimateRowHeight={32}
      />,
    );
    await user.click(screen.getByRole("treeitem", { name: "Node 1" }));
    const selected = screen.getByRole("treeitem", { name: "Node 1" });
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(selected.classList.contains("bg-sidebar-accent")).toBe(true);
    expect(selected.classList.contains("bg-accent")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Virtualization tests
// ---------------------------------------------------------------------------

describe("Tree (virtualized)", () => {
  function build(count: number): TreeNode[] {
    return Array.from({ length: count }, (_, i) => ({ id: `n-${i}`, label: `Node ${i + 1}` }));
  }

  it("renders a scroll container and the role=tree root when virtualize=true", () => {
    render(
      <Tree nodes={build(5000)} virtualize maxHeight="400px" estimateRowHeight={ROW_HEIGHT} />,
    );
    expect(screen.getByRole("tree")).toBeInTheDocument();
  });

  it("renders far fewer than 5 000 treeitems in the DOM (windowing is active)", () => {
    // Environment note: jsdom layout is stubbed above so the virtualizer can
    // compute a non-zero window. The exact rendered count depends on the stub
    // heights but should always be ≪ 5 000.
    render(
      <Tree nodes={build(5000)} virtualize maxHeight="400px" estimateRowHeight={ROW_HEIGHT} />,
    );
    const items = screen.queryAllByRole("treeitem");
    // Expect far fewer than all 5000 nodes in the DOM.
    // Under the jsdom stub (400px viewport / 32px rows = ~12–26 with overscan).
    expect(items.length).toBeLessThan(100);
    expect(items.length).toBeGreaterThan(0);
  });

  it("carries correct ARIA attributes on virtual rows (level / setsize / posinset)", () => {
    const smallNodes = build(20);
    render(<Tree nodes={smallNodes} virtualize maxHeight="400px" estimateRowHeight={ROW_HEIGHT} />);
    // First rendered item should be node-0 at level 1, setsize 20, posinset 1
    const first = screen.getByRole("treeitem", { name: "Node 1" });
    expect(first).toHaveAttribute("aria-level", "1");
    expect(first).toHaveAttribute("aria-setsize", "20");
    expect(first).toHaveAttribute("aria-posinset", "1");
  });

  it("ArrowDown moves active tabindex in the virtual flat list", async () => {
    const user = userEvent.setup();
    const smallNodes = build(30);
    render(<Tree nodes={smallNodes} virtualize maxHeight="400px" estimateRowHeight={ROW_HEIGHT} />);

    const first = screen.getByRole("treeitem", { name: "Node 1" });
    first.focus();
    expect(first).toHaveAttribute("tabindex", "0");

    await user.keyboard("{ArrowDown}");

    const second = screen.getByRole("treeitem", { name: "Node 2" });
    expect(second).toHaveAttribute("tabindex", "0");
    expect(first).toHaveAttribute("tabindex", "-1");
  });

  it("selects a node on click in virtual mode", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const smallNodes = build(20);
    render(
      <Tree
        nodes={smallNodes}
        virtualize
        maxHeight="400px"
        estimateRowHeight={ROW_HEIGHT}
        onSelectionChange={onSelectionChange}
      />,
    );
    await user.click(screen.getByRole("treeitem", { name: "Node 3" }));
    expect(onSelectionChange).toHaveBeenCalledWith(["n-2"]);
  });
});

// ---------------------------------------------------------------------------
// accessory / trailing slot (#369)
// ---------------------------------------------------------------------------

describe("Tree (accessory / trailing slot, #369)", () => {
  const nodesWithAccessory: TreeNode[] = [
    { id: "a", label: "package.json", accessory: <span>1.2 KB</span> },
    { id: "b", label: "index.ts" },
  ];

  it("renders the accessory content in the row", () => {
    render(<Tree nodes={nodesWithAccessory} />);
    expect(screen.getByText("1.2 KB")).toBeInTheDocument();
  });

  it("the row's accessible name is exactly the node label — the accessory never leaks in", () => {
    render(<Tree nodes={nodesWithAccessory} />);
    expect(screen.getByRole("treeitem", { name: "package.json" })).toBeInTheDocument();
    expect(screen.queryByRole("treeitem", { name: "package.json1.2 KB" })).not.toBeInTheDocument();
  });

  it("clicking the accessory does not select or expand the row (non-virtual path)", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(<Tree nodes={nodesWithAccessory} onSelectionChange={onSelectionChange} />);
    await user.click(screen.getByText("1.2 KB"));
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(screen.getByRole("treeitem", { name: "package.json" })).not.toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("clicking the row itself (not the accessory) still selects it (non-virtual path)", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(<Tree nodes={nodesWithAccessory} onSelectionChange={onSelectionChange} />);
    await user.click(screen.getByRole("treeitem", { name: "package.json" }));
    expect(onSelectionChange).toHaveBeenCalledWith(["a"]);
  });

  it("keyboard select (Enter) is unaffected by the accessory's presence", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(<Tree nodes={nodesWithAccessory} onSelectionChange={onSelectionChange} />);
    const row = screen.getByRole("treeitem", { name: "package.json" });
    row.focus();
    await user.keyboard("{Enter}");
    expect(onSelectionChange).toHaveBeenCalledWith(["a"]);
  });

  it("renders the accessory and guards clicks in virtualized mode too (the duplicated render path)", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <Tree
        nodes={nodesWithAccessory}
        virtualize
        maxHeight="400px"
        estimateRowHeight={ROW_HEIGHT}
        onSelectionChange={onSelectionChange}
      />,
    );
    expect(screen.getByText("1.2 KB")).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: "package.json" })).toBeInTheDocument();
    await user.click(screen.getByText("1.2 KB"));
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  // `TreeNode.label` is a ReactNode, so `aria-label` (string-only) cannot name
  // every row — without `aria-labelledby` the name falls back to the row's
  // CONTENTS and the accessory leaks in. Locks both render paths.
  it.each([
    ["non-virtual", false],
    ["virtualized", true],
  ])("a ReactNode label still excludes the accessory from the name (%s)", (_name, virtualize) => {
    const nodes: TreeNode[] = [
      { id: "a", label: <span>package.json</span>, accessory: <span>1.2 KB</span> },
    ];
    render(
      <Tree
        nodes={nodes}
        virtualize={virtualize}
        maxHeight={virtualize ? "400px" : undefined}
        estimateRowHeight={virtualize ? ROW_HEIGHT : undefined}
      />,
    );
    expect(screen.getByRole("treeitem", { name: "package.json" })).toBeInTheDocument();
    expect(screen.queryByRole("treeitem", { name: /1\.2 KB/ })).not.toBeInTheDocument();
  });

  // The tree's keyboard handler lives on the ROOT and preventDefaults
  // Enter/Space/arrows; the row's onFocus (focusin — it bubbles) re-focuses the
  // row. Both must stop at the accessory or interactive content there is dead.
  it("interactive accessory content is focusable and activates itself, not the row", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const onAccessoryClick = vi.fn();
    const nodes: TreeNode[] = [
      {
        id: "a",
        label: "package.json",
        accessory: (
          <button type="button" onClick={onAccessoryClick}>
            Details
          </button>
        ),
      },
      { id: "b", label: "index.ts" },
    ];
    render(<Tree nodes={nodes} onSelectionChange={onSelectionChange} />);

    const accessoryButton = screen.getByRole("button", { name: "Details" });
    accessoryButton.focus();
    expect(document.activeElement).toBe(accessoryButton);

    await user.keyboard("{Enter}");
    expect(onAccessoryClick).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).not.toHaveBeenCalled();

    // Tree navigation must not steal focus out of the accessory.
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(accessoryButton);
  });
});
