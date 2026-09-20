import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryPareto } from "@/components/chart-story-pareto-01/chart-story-pareto";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryPareto,
  title: "Patterns/Blocks/Editorial Charts/Pareto",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Which few causes make up most of the problem?",
      description: {
        component:
          "A Pareto chart: sorted columns on the left axis and the labelled cumulative share on the right, with a computed headline.\n\nCopy-own it: `npx shadcn add chart-story-pareto-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryPareto>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
