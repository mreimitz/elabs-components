import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryDualAxis } from "@/components/chart-story-dual-axis-01/chart-story-dual-axis";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryDualAxis,
  title: "Patterns/Blocks/Editorial Charts/Dual axis columns and line",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How do I show volume and unit cost in one figure?",
      description: {
        component:
          "Columns on the left axis and a line on the right: axes coloured like their series, ticks aligned on shared gridlines, a shaded range, and a table tooltip.\n\nCopy-own it: `npx shadcn add chart-story-dual-axis-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryDualAxis>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
