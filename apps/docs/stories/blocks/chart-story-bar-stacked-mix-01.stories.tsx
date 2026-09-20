import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryBarStackedMix } from "@/components/chart-story-bar-stacked-mix-01/chart-story-bar-stacked-mix";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryBarStackedMix,
  title: "Patterns/Blocks/Editorial Charts/Stacked Among Plain Bars",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How big is it next to everything else, and what is it made of?",
      description: {
        component:
          "A whole published figure: one ranked list where the comparison rows are plain grey bars and the rows the story is about are stacked by component, with totals, a colour key, method note, byline, linked source and Get the data.\n\nCopy-own it: `npx shadcn add chart-story-bar-stacked-mix-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryBarStackedMix>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
