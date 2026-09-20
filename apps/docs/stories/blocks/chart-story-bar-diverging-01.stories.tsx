import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryBarDiverging } from "@/components/chart-story-bar-diverging-01/chart-story-bar-diverging";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryBarDiverging,
  title: "Patterns/Blocks/Editorial Charts/Diverging Bars",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Who is ahead, who is behind, and by how much?",
      description: {
        component:
          "A whole published figure: signed horizontal bars from a shared zero line, gains and losses in two colours keyed inside the description, signed value labels, a row note beside the outlier, method note, byline, linked source and Get the data.\n\nCopy-own it: `npx shadcn add chart-story-bar-diverging-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryBarDiverging>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
