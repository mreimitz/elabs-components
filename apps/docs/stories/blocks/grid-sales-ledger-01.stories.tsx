import type { Meta, StoryObj } from "@storybook/react-vite";
import { SalesLedger } from "@/components/grid-sales-ledger-01/sales-ledger";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Data Grids/Sales Ledger",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Group, total, pivot and chart without leaving the grid.",
      description: {
        component:
          "720 order lines grouped by region with group sums and a totals row; switch to a region × quarter pivot built with `pivotData`. Select any block of cells and choose Chart selection from the right-click menu — the grid hands the raw range to `onChartRange` and the block draws it with `AutoChart`.\n\nCopy-own it: `npx shadcn add grid-sales-ledger-01` (pulls `grid-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SalesLedger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <SalesLedger /> };

/** Two grouping levels: region, then rep. */
export const ByRegionAndRep: Story = {
  render: () => <SalesLedger defaultGrouping={["region", "rep"]} />,
};
