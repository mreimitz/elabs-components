import type { Meta, StoryObj } from "@storybook/react-vite";
import { CostTree } from "@/components/grid-cost-tree-01/cost-tree";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Data Grids/Cost Centre Tree",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Budget vs actual, re-forecast by the team that owns it.",
      description: {
        component:
          "Tree data (`getSubRows`): teams nest under departments, which carry the roll-up. Only leaf forecasts are editable (`meta.editable` as a row predicate); an edit re-rolls every ancestor, so variance bars and totals move together. Variance prints its sign as well as its colour.\n\nCopy-own it: `npx shadcn add grid-cost-tree-01` (pulls `grid-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CostTree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <CostTree /> };
