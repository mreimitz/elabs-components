import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryHeatTable } from "@/components/chart-story-heat-table-01/chart-story-heat-table";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryHeatTable,
  title: "Patterns/Blocks/Editorial Charts/Heat table",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How do I show every number and still let the pattern show first?",
      description: {
        component:
          "A heat table: a depot by weekday matrix with printed values, five sequential steps, a key that states each range and the maximum ringed.\n\nCopy-own it: `npx shadcn add chart-story-heat-table-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryHeatTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
