import type { Meta, StoryObj } from "@storybook/react-vite";
import { A2uiDecision } from "@/components/a2ui-decision-01/a2ui-decision";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: A2uiDecision,
  title: "Patterns/Blocks/Generative UI/Agent asks for a decision",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "How does an agent ask a human to decide, without owning the outcome?",
      description: {
        component:
          "An agent-designed approval screen (facts, the policy exception, a note, three ways out) rendered from A2UI data. Buttons name host actions; the app answers each one with the agent's next surface, and logs what it received.\n\nCopy-own it: `npx shadcn add a2ui-decision-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof A2uiDecision>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
