import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryWaterfallRunning } from "@/components/chart-story-waterfall-running-01/chart-story-waterfall-running";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryWaterfallRunning,
  title: "Patterns/Blocks/Editorial Charts/Waterfall with subtotals",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How do I show a year of monthly changes with quarterly checkpoints?",
      description: {
        component:
          "A horizontal waterfall: monthly steps, automatic quarterly subtotals, a closing total and a plot zoomed to the differences.\n\nCopy-own it: `npx shadcn add chart-story-waterfall-running-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryWaterfallRunning>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
