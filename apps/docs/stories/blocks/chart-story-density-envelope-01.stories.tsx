import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartStoryDensityEnvelope } from "@/components/chart-story-density-envelope-01/chart-story-density-envelope";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ChartStoryDensityEnvelope,
  title: "Patterns/Blocks/Editorial Charts/Density: Flight-test envelope",
  parameters: {
    layout: "padded",
    docs: {
      subtitle:
        "How do I show every one of 200,000 recorded positions against the flight envelope?",
      description: {
        component:
          "A flight-test envelope with every recorded position drawn: 200,000 fixes coloured by the zone of the operational design domain they fall in, solid where dense and single dots when you zoom in, with range and lasso selection totalled in three tiles.\n\nCopy-own it: `npx shadcn add chart-story-density-envelope-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartStoryDensityEnvelope>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
