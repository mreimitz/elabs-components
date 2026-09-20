import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryTableScorecard } from "@/components/chart-story-table-scorecard-01/chart-story-table-scorecard";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryTableScorecard,
  title: "Patterns/Blocks/Editorial Charts/Table with bars and sparklines",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How do I make a table readable at a glance?",
      description: {
        component:
          "A scorecard table: bar cells, a shaded heat column, category dots, sparklines with the last point emphasised and signed, coloured change.\n\nCopy-own it: `npx shadcn add chart-story-table-scorecard-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryTableScorecard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
