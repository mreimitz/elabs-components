import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryDensityFills } from "@/components/chart-story-density-fills-01/chart-story-density-fills";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryDensityFills,
  title: "Patterns/Blocks/Editorial Charts/Density: Fill latency",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How do I see whether slow fills are a size problem or a venue problem?",
      description: {
        component:
          "Every order fill of a trading day, size against latency, with the SLA bands drawn on the latency axis; a range box over the block-trade tail or a drag along the axis reports the SLA share and mean slippage of that slice.\n\nCopy-own it: `npx shadcn add chart-story-density-fills-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryDensityFills>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
