import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { InfographicKpiTree } from "@/components/infographic-kpi-tree-01/infographic-kpi-tree";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: InfographicKpiTree,
  title: "Patterns/Blocks/Infographics/KPI Tree",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "What drives the number?",
      description: {
        component:
          "Operating profit as a `TreeChart` of the metrics it is built from. Every node is the library’s own `MetricCard` — latest value, a `Sparkline` of the last 12 months, and the month-over-month and year-over-year moves as its `comparisons` row; the lines are the chart’s own links, and on each one sits the operator the driver enters its parent with (`renderLink`): **+** adds to it, **−** (dashed) takes away from it, **×** multiplies into it, so Revenue + and Operating costs − visibly make Operating profit. Every parent is computed from its drivers, so the tree always adds up; the headline splits the year’s change exactly across the measured drivers and names the one that moved it most. Open and close branches with the pill on a card, the arrow keys or the buttons above the tree; select a card to restate it in words below. The tree is a canvas like a flow diagram: zoom with the wheel or the corner controls, drag to pan, and jump with the minimap (`zoomable` + `minimap` on `TreeChart`).\n\nCopy-own it: `npx shadcn add infographic-kpi-tree-01` (pulls `kpi-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
  render: (args) => (
    <div className="w-full max-w-6xl">
      <InfographicKpiTree {...args} />
    </div>
  ),
} satisfies Meta<typeof InfographicKpiTree>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Top down: operating profit first, its drivers below. Revenue starts open, so three levels fit the box; the other branches start closed and show how many drivers they hold. */
export const Default: Story = {};

/**
 * The arithmetic is on the lines, not only in the detail text: Revenue’s link carries **+**,
 * Operating costs’ link **−** (dashed, so it reads in greyscale), and the two customer drivers
 * under Revenue carry **×**. The same fact is spoken in each tree item’s name (“adds to operating
 * profit”, “subtracts from operating profit”, “multiplies into revenue”), so a screen-reader user
 * hears how the number is built as they arrow through it.
 */
export const OperatorsOnTheLines: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tree = await canvas.findByRole("tree", { name: "Operating profit driver tree" });
    await expect(
      within(tree).getByRole("treeitem", { name: /^Revenue, .*adds to operating profit/ }),
    ).toBeInTheDocument();
    await expect(
      within(tree).getByRole("treeitem", {
        name: /^Operating costs, .*subtracts from operating profit/,
      }),
    ).toBeInTheDocument();
    await expect(
      within(tree).getByRole("treeitem", { name: /^Customers, .*multiplies into revenue/ }),
    ).toBeInTheDocument();

    const opOf = (op: string) =>
      Array.from(
        canvasElement.querySelectorAll<HTMLElement>(
          `[data-slot="infographic-kpi-tree-operator"][data-op="${op}"]`,
        ),
      );
    await waitFor(() => expect(opOf("+")).toHaveLength(1));
    await expect(opOf("−")).toHaveLength(1);
    await expect(opOf("×")).toHaveLength(2);
    // The minus is the one that also differs in shape.
    await expect(opOf("−")[0]).toHaveClass("border-dashed");
    // Every node is the library's KPI tile, not a hand-rolled card.
    await expect(
      canvasElement.querySelectorAll(
        '[data-slot="infographic-kpi-tree-card"] [data-slot="metric-card-comparison"]',
      ).length,
    ).toBe(10);
  },
};

/**
 * The tree is a canvas, as a flow diagram is: zoom in / out / fit controls and a minimap in the
 * corner, the wheel zooms around the pointer, dragging pans (from the empty canvas or from a
 * card, even when the whole tree fits), and clicking the minimap moves the view. The keyboard tree and the expand/collapse pills keep working at any
 * zoom.
 */
export const ZoomAndMinimap: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("tree", { name: "Operating profit driver tree" });
    const chart = canvasElement.querySelector<HTMLElement>('[data-slot="tree-chart"]')!;
    const minimap = canvasElement.querySelector<SVGElement>('[data-slot="tree-chart-minimap"]');
    await expect(minimap).not.toBeNull();
    await expect(minimap!.querySelectorAll("rect").length).toBeGreaterThan(5);

    await expect(chart).toHaveAttribute("data-zoom", "1.00");
    await userEvent.click(canvas.getByRole("button", { name: "Zoom in" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-zoom", "1.20"));
    const canvasEl = canvasElement.querySelector<HTMLElement>('[data-slot="tree-chart-canvas"]')!;
    await expect(canvasEl.style.transform).toBe("scale(1.2)");

    await userEvent.click(canvas.getByRole("button", { name: "Zoom out" }));
    await userEvent.click(canvas.getByRole("button", { name: "Zoom out" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-zoom", "0.83"));

    // Fit view: the whole tree is in view.
    await userEvent.click(canvas.getByRole("button", { name: "Fit view" }));
    await waitFor(() => {
      const box = chart.getBoundingClientRect();
      const drawn = canvasEl.getBoundingClientRect();
      expect(drawn.left).toBeGreaterThanOrEqual(box.left - 1);
      expect(drawn.right).toBeLessThanOrEqual(box.right + 1);
      expect(drawn.top).toBeGreaterThanOrEqual(box.top - 1);
      expect(drawn.bottom).toBeLessThanOrEqual(box.bottom + 1);
    });

    // Still a keyboard tree at this zoom.
    const tree = canvas.getByRole("tree", { name: "Operating profit driver tree" });
    const customers = within(tree).getByRole("treeitem", { name: /^Customers,/ });
    customers.focus();
    await userEvent.keyboard(" ");
    await waitFor(() => expect(customers).toHaveAttribute("aria-expanded", "true"));
  },
};

/** The same tree growing left to right, for a wide screen. */
export const Horizontal: Story = { args: { defaultOrientation: "horizontal" } };

/** Keyboard only: arrow down to Customers, then arrow right opens it and shows its two drivers. */
export const ExpandWithKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tree = await canvas.findByRole("tree", { name: "Operating profit driver tree" });
    const [root] = within(tree).getAllByRole("treeitem");
    (root as HTMLElement).focus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");

    const customers = within(tree).getByRole("treeitem", { name: /^Customers,/ });
    await waitFor(() => expect(customers).toHaveFocus());
    await expect(customers).toHaveAttribute("aria-expanded", "false");
    await expect(
      within(tree).queryByRole("treeitem", { name: /^Self-serve customers,/ }),
    ).not.toBeInTheDocument();

    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(customers).toHaveAttribute("aria-expanded", "true"));
    await expect(
      await within(tree).findByRole("treeitem", { name: /^Self-serve customers,/ }),
    ).toBeInTheDocument();
  },
};

/** “Expand all” opens every branch and keeps focus, so a keyboard user can go straight on to “Collapse”. With nothing left to open it says so (`aria-disabled`) instead of dropping focus. */
export const ExpandAll: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tree = await canvas.findByRole("tree", { name: "Operating profit driver tree" });
    const expandAll = canvas.getByRole("button", { name: "Expand all" });
    expandAll.focus();
    await userEvent.keyboard("{Enter}");
    await expect(
      await within(tree).findByRole("treeitem", { name: /^Hosting,/ }),
    ).toBeInTheDocument();
    await expect(expandAll).toHaveFocus();
    await expect(expandAll).toHaveAttribute("aria-disabled", "true");

    // Nothing left to open: pressing it again changes nothing and keeps focus.
    await userEvent.keyboard("{Enter}");
    await expect(expandAll).toHaveFocus();

    await userEvent.keyboard("{Tab}");
    const collapse = canvas.getByRole("button", { name: "Collapse" });
    await expect(collapse).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(within(tree).queryByRole("treeitem", { name: /^Hosting,/ })).not.toBeInTheDocument(),
    );
    await expect(collapse).toHaveFocus();
    await expect(collapse).toHaveAttribute("aria-disabled", "true");
  },
};

/** Select a card and the line under the tree restates it: its formula, its moves and its share of the year’s change. */
export const SelectADriver: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tree = await canvas.findByRole("tree", { name: "Operating profit driver tree" });
    await userEvent.click(within(tree).getByRole("treeitem", { name: /^ARPU,/ }));

    const detail = canvasElement.querySelector<HTMLElement>(
      '[data-slot="infographic-kpi-tree-detail"]',
    );
    await waitFor(() => expect(detail).toHaveTextContent(/^ARPU, measured directly/));
    await expect(detail).toHaveTextContent("of operating profit’s");
    await expect(
      within(tree).getByRole("treeitem", { name: /^ARPU,.*, selected$/ }),
    ).toBeInTheDocument();
  },
};
