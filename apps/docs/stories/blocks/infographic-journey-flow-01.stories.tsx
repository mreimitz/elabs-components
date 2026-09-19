import type { Meta, StoryObj } from "@storybook/react-vite";
import { InfographicJourneyFlow } from "@/components/infographic-journey-flow-01/infographic-journey-flow";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: InfographicJourneyFlow,
  title: "Patterns/Blocks/Infographics/Journey Flow",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Where do they drop off?",
      description: {
        component:
          "Every request followed end to end: a `SankeyChart` runs from the channel a request came in on, through what happened to its quote, to how it ended, and a `FunnelChart` beside it puts a number on each step. The headline is computed — it names the channel that loses the largest share of its own requests.\n\nCopy-own it: `npx shadcn add infographic-journey-flow-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof InfographicJourneyFlow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** In a narrow column the funnel moves under the flow. */
export const Narrow: Story = {
  render: (args) => (
    <div className="w-full max-w-xl">
      <InfographicJourneyFlow {...args} />
    </div>
  ),
};
