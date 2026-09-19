import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { findings } from "@/components/agent-ops-parts/data/atlas-ops";
import { FindingCards } from "@/components/finding-cards-01/finding-cards";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: FindingCards,
  title: "Patterns/Blocks/Agent Ops/Finding Cards",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "What did the copilot find?",
      description: {
        component:
          "Recoverable-spend findings as a row of cards: a status badge naming the kind, a title, the recoverable figure as the only coloured number, a summary and a primary + secondary action — under a header that states the programme and the total.\n\nCopy-own it: `npx shadcn add finding-cards-01` (pulls `agent-ops-parts`).",
      },
    },
  },
  args: { onAction: fn() },
  tags: ["autodocs"],
} satisfies Meta<typeof FindingCards>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A single finding — the row is still a row. */
export const One: Story = { args: { items: findings.slice(0, 1) } };

export const Narrow: Story = {
  render: (args) => (
    <div className="w-full max-w-md">
      <FindingCards {...args} />
    </div>
  ),
};
