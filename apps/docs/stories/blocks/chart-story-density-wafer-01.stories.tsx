import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryDensityWafer } from "@/components/chart-story-density-wafer-01/chart-story-density-wafer";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryDensityWafer,
  title: "Patterns/Blocks/Editorial Charts/Density: Wafer map",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How do I show where on the wafer the failing dies are, not just how many?",
      description: {
        component:
          "A wafer map of 150,000 probed dies coloured by test bin — a scratch and a hot spot become visible that the yield number hides — with lasso selection reporting the fail share and mean threshold voltage of the dies you circle.\n\nCopy-own it: `npx shadcn add chart-story-density-wafer-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryDensityWafer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
