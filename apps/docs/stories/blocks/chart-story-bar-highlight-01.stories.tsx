import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryBarHighlight } from "@/components/chart-story-bar-highlight-01/chart-story-bar-highlight";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryBarHighlight,
  title: "Patterns/Blocks/Editorial Charts/Ranked Bars",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Who is at the top, and who is at the bottom?",
      description: {
        component:
          "A whole published figure: ranked horizontal bars on a track to 100 %, the three lowest and the three highest rows in colour, the rest grey context. The colour key sits above the plot, values are printed inside the bars, and the card closes with a method note, byline, linked source and Get the data.\n\nCopy-own it: `npx shadcn add chart-story-bar-highlight-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryBarHighlight>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
