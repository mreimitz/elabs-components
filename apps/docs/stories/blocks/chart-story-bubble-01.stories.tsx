import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryBubble } from "@/components/chart-story-bubble-01/chart-story-bubble";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryBubble,
  title: "Patterns/Blocks/Editorial Charts/Bubble chart",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How do I relate two measures across many items, and name only the outliers?",
      description: {
        component:
          "A bubble scatter on a log axis: size by head count, colour by region with a key, a dashed trend, selective point labels and a text annotation.\n\nCopy-own it: `npx shadcn add chart-story-bubble-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryBubble>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
