import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryDonut } from "@/components/chart-story-donut-01/chart-story-donut";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryDonut,
  title: "Patterns/Blocks/Editorial Charts/Donut with total",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How do I show what one number is made of?",
      description: {
        component:
          "A donut with the total in the hole, outside labels on leaders stating name and share, and small slices folded into Other.\n\nCopy-own it: `npx shadcn add chart-story-donut-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryDonut>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
