import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryColumnPanels } from "@/components/chart-story-column-panels-01/chart-story-column-panels";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryColumnPanels,
  title: "Patterns/Blocks/Editorial Charts/Column panels with ranges",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How do I compare two distributions on a rating scale?",
      description: {
        component:
          "Two column panels on one shared axis, with the promoter and detractor ranges of the scale shaded and named, and a computed share in each panel title.\n\nCopy-own it: `npx shadcn add chart-story-column-panels-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryColumnPanels>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
