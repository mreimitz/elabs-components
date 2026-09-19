import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { agentEnvelopes } from "@/components/agent-ops-parts/data/atlas-ops";
import { SpendAgainstLimit } from "@/components/spend-against-limit-01/spend-against-limit";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: SpendAgainstLimit,
  title: "Patterns/Blocks/Agent Ops/Spend Against Limit",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How close is each agent to its ceiling?",
      description: {
        component:
          "Every non-human spender on the card programme, sorted by share of ceiling: monospace agent id, autonomy band as a status badge, a bar with the ceiling drawn as a vertical mark, the literal “$612 of $500”, and Revoke. Over the ceiling paints the destructive rung and says so. Three autonomy-band tiles total the envelopes.\n\nCopy-own it: `npx shadcn add spend-against-limit-01` (pulls `agent-ops-parts`).",
      },
    },
  },
  args: { onRevoke: fn() },
  tags: ["autodocs"],
} satisfies Meta<typeof SpendAgainstLimit>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The list alone — when the bands are summarised elsewhere on the page. */
export const ListOnly: Story = { args: { showBands: false } };

/** Nobody over their ceiling — no destructive ink anywhere. */
export const AllWithinLimit: Story = {
  args: {
    agents: agentEnvelopes.map((a) => (a.spent > a.limit ? { ...a, spent: a.limit * 0.6 } : a)),
  },
};

export const Narrow: Story = {
  render: (args) => (
    <div className="w-full max-w-md">
      <SpendAgainstLimit {...args} />
    </div>
  ),
};
