import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryBarRange } from "@/components/chart-story-bar-range-01/chart-story-bar-range";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryBarRange,
  title: "Patterns/Blocks/Editorial Charts/Range Bars",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How wide is the spread, and where is the typical case?",
      description: {
        component:
          "A whole published figure: a range plot drawn with bar overlays — fastest to slowest, the middle half and a median tick per row on one shared axis, with its key above the plot, method note, byline, linked source and Get the data.\n\nCopy-own it: `npx shadcn add chart-story-bar-range-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryBarRange>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
