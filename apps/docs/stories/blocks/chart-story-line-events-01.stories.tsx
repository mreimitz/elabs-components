import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryLineEvents } from "@/components/chart-story-line-events-01/chart-story-line-events";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryLineEvents,
  title: "Patterns/Blocks/Editorial Charts/Line With Events",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "What happened, and what did it cost?",
      description: {
        component:
          "A whole published figure: one long weekly line over shaded peak seasons, dashed and dotted event lines, a target line, an arrowed note on the record low, a notes line that explains the shading, byline, linked source and Get the data.\n\nCopy-own it: `npx shadcn add chart-story-line-events-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryLineEvents>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
