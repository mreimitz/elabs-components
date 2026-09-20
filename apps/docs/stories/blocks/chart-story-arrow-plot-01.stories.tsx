import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryArrowPlot } from "@/components/chart-story-arrow-plot-01/chart-story-arrow-plot";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryArrowPlot,
  title: "Patterns/Blocks/Editorial Charts/Arrow plot with target band",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How do I show which rows improved and which got worse?",
      description: {
        component:
          "An arrow plot: one arrow per row coloured by direction, percent deltas, a shaded target band and a computed headline.\n\nCopy-own it: `npx shadcn add chart-story-arrow-plot-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryArrowPlot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
