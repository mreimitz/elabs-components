import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryAreaMultiples } from "@/components/chart-story-area-multiples-01/chart-story-area-multiples";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryAreaMultiples,
  title: "Patterns/Blocks/Editorial Charts/Area multiples",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How do I compare the same measure across regions without a spaghetti chart?",
      description: {
        component:
          "Small-multiple area charts on one shared scale: a dotted network average behind every panel, the same shaded event, and the latest value in each panel title.\n\nCopy-own it: `npx shadcn add chart-story-area-multiples-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryAreaMultiples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
