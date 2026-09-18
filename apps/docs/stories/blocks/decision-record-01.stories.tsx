import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { DecisionRecord } from "@/components/decision-record-01/decision-record";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: DecisionRecord,
  title: "Patterns/Blocks/Agent Ops/Why Did The AI Do That (Decision Record)",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Every AI action expanded into the reason it happened: what it did, what it looked at, what rule applied, how confident (or an honest “not applicable”), and how to reverse it — then the check list and what the copilot proposes, nothing actioned until a person approves.\n\nCopy-own it: `npx shadcn add decision-record-01` (pulls `agent-ops-parts`).",
      },
    },
  },
  args: { onDecide: fn() },
  tags: ["autodocs"],
} satisfies Meta<typeof DecisionRecord>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Narrow: Story = {
  render: (args) => (
    <div className="w-full max-w-md">
      <DecisionRecord {...args} />
    </div>
  ),
};
