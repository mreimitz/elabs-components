import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryPiePair } from "@/components/chart-story-pie-pair-01/chart-story-pie-pair";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryPiePair,
  title: "Patterns/Blocks/Editorial Charts/Donuts then and now",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How do I compare the same split at two points in time?",
      description: {
        component:
          "Two donuts under one shared colour key: the year in the hole, shares inside the slices, the same slice order in both.\n\nCopy-own it: `npx shadcn add chart-story-pie-pair-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryPiePair>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
