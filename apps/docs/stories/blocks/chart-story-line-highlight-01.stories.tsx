import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryLineHighlight } from "@/components/chart-story-line-highlight-01/chart-story-line-highlight";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryLineHighlight,
  title: "Patterns/Blocks/Editorial Charts/Highlighted Lines",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Which few stand out from the many?",
      description: {
        component:
          "A whole published figure: three named, coloured lines in front of a field of thin grey ones, names at the line ends, a note in the series colour, hover that lifts one line, method note, byline, linked source and Get the data.\n\nCopy-own it: `npx shadcn add chart-story-line-highlight-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryLineHighlight>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
