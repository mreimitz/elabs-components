import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryAreaThreshold } from "@/components/chart-story-area-threshold-01/chart-story-area-threshold";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryAreaThreshold,
  title: "Patterns/Blocks/Editorial Charts/Area Against a Threshold",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Since when are we over the line?",
      description: {
        component:
          "A whole published figure: one line against a labelled threshold, the area between them filled in one colour below and another above, both sides named on the plot, a final-value note, method note, byline, linked source and Get the data.\n\nCopy-own it: `npx shadcn add chart-story-area-threshold-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryAreaThreshold>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
