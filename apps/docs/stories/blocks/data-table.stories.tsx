import type { Meta, StoryObj } from "@storybook/react-vite";
import { DataTableBlock } from "@/components/data-table/data-table-block";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: DataTableBlock,
  title: "Patterns/Blocks/Data Surfaces/Data Table",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A filterable, sortable, paginated data table with its toolbar — the starting point for any list screen.\n\nCopy-own it: `npx shadcn add data-table`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DataTableBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The table with its sample rows: sort a column, filter from the toolbar, page through. */
export const Default: Story = {};
