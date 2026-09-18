import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { EscalationBoundary } from "@/components/escalation-boundary-01/escalation-boundary";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: EscalationBoundary,
  title: "Patterns/Blocks/Agent Ops/Where Does Autonomy End (Escalation Boundary)",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The one dial an AI-ops product must put on screen: a stacked distribution bar of every decision by how well it was corroborated, with the evidence threshold drawn as a mark; the evidence ladder; and three “If you move it” scenario cards that state the trade in the reader’s units and move the boundary when clicked.\n\nCopy-own it: `npx shadcn add escalation-boundary-01` (pulls `agent-ops-parts`).",
      },
    },
  },
  args: { onThresholdChange: fn() },
  tags: ["autodocs"],
} satisfies Meta<typeof EscalationBoundary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Starts one rung tighter than the recommendation — the cost of the extra catch is visible at once. */
export const Tightened: Story = { args: { defaultThreshold: 5 } };

export const Narrow: Story = {
  render: (args) => (
    <div className="w-full max-w-md">
      <EscalationBoundary {...args} />
    </div>
  ),
};
