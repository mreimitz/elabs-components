import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryWaterfallBridge } from "@/components/chart-story-waterfall-bridge-01/chart-story-waterfall-bridge";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryWaterfallBridge,
  title: "Patterns/Blocks/Editorial Charts/Waterfall bridge",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How did one total become another?",
      description: {
        component:
          "A revenue bridge: coloured increases and decreases between two totals, thin connectors, matched-colour labels and a callout on the step that matters.\n\nCopy-own it: `npx shadcn add chart-story-waterfall-bridge-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryWaterfallBridge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
