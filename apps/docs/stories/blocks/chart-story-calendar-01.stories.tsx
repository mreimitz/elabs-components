import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryCalendar } from "@/components/chart-story-calendar-01/chart-story-calendar";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryCalendar,
  title: "Patterns/Blocks/Editorial Charts/Calendar heatmap",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How do I show a daily number for a whole year?",
      description: {
        component:
          "A calendar heatmap: weeks as columns, weekdays as rows, six sequential steps and a key that states each range.\n\nCopy-own it: `npx shadcn add chart-story-calendar-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
