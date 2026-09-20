import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryRangePlot } from "@/components/chart-story-range-plot-01/chart-story-range-plot";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryRangePlot,
  title: "Patterns/Blocks/Editorial Charts/Range plot with deltas",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How do I show before and after per row, and how much it moved?",
      description: {
        component:
          "A grouped range plot: hollow before, filled after, a signed delta per row, group headers and a top value axis.\n\nCopy-own it: `npx shadcn add chart-story-range-plot-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryRangePlot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
