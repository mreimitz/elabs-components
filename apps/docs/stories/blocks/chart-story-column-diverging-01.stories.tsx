import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryColumnDiverging } from "@/components/chart-story-column-diverging-01/chart-story-column-diverging";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryColumnDiverging,
  title: "Patterns/Blocks/Editorial Charts/Diverging Columns",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "When did it turn, and when did it turn back?",
      description: {
        component:
          "A whole published figure: columns above and below zero in two colours whose key is written into the description, a note on the low point, signed axis, method note, byline, linked source and Get the data.\n\nCopy-own it: `npx shadcn add chart-story-column-diverging-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryColumnDiverging>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
