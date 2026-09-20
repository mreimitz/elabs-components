import type { Meta, StoryObj } from "@storybook/react-vite";
import AgentOpsCenterPage from "@/components/agent-ops-center-page/agent-ops-center-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: AgentOpsCenterPage,
  title: "Patterns/Templates/AI Products/Agent Operations Center",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For teams running AI agents in production",
      description: {
        component:
          "The control room for a fleet of agents — the agent-ops block family working as one product. Overview: what changed while you were away, spend against each agent's ceiling, and where autonomy ends. Runs: the trace waterfall and the handoff that dropped a field. Review: a run waiting on its side effect and a decision record. Audit: who did what. Every callback the blocks expose is wired, and what you settle in Review updates the count in the navigation, the tab and the header.\n\nCopy-own it: `npx shadcn add agent-ops-center-page`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AgentOpsCenterPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Opened on the review queue — the two things that wait for a human. */
export const ReviewQueue: Story = { args: { defaultTab: "review" } };

/** Opened on a failed run: the waterfall and the handoff that dropped a field. */
export const FailedRun: Story = { args: { defaultTab: "runs" } };
