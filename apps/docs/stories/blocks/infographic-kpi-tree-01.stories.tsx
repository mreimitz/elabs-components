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
          "Operating profit as a `TreeChart` of the metrics it is built from, each node a card with its latest value, a 12-month sparkline and its month-over-month and year-over-year moves. Every parent is computed from its drivers, so the tree always adds up; the headline splits the year’s change exactly across the measured drivers and names the one that moved it most. Open and close branches with the pill on a card, the arrow keys or the buttons above the tree; select a card to restate it in words below.\n\nCopy-own it: `npx shadcn add infographic-kpi-tree-01` (pulls `kpi-card-parts`).",
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
