import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryDotPlot } from "@/components/chart-story-dot-plot-01/chart-story-dot-plot";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryDotPlot,
  title: "Patterns/Blocks/Editorial Charts/Dot plot with range",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How do I compare three values per row on one axis?",
      description: {
        component:
          "A dot plot: three dots per row joined by their range, a colour key, a top value axis and rows sorted by the headline value.\n\nCopy-own it: `npx shadcn add chart-story-dot-plot-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryDotPlot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
