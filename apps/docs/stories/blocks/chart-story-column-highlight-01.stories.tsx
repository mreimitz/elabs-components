import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryColumnHighlight } from "@/components/chart-story-column-highlight-01/chart-story-column-highlight";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryColumnHighlight,
  title: "Patterns/Blocks/Editorial Charts/Highlighted Columns",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "What changed, and since when?",
      description: {
        component:
          "A whole published figure: grey context columns, the columns after the event in the accent colour with value labels, an arrowed note naming the event, method note, byline, linked source and Get the data.\n\nCopy-own it: `npx shadcn add chart-story-column-highlight-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryColumnHighlight>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
