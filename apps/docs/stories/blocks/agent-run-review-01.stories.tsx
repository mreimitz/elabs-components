import type { Meta, StoryObj } from "@storybook/react-vite";
import { AgentRunReview } from "@/components/agent-run-review-01/agent-run-review";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: AgentRunReview,
  title: "Patterns/Blocks/AI and Terminal/Agent Run Review",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "What did the agent do, and what is it asking me?",
      description: {
        component:
          "One agent run, reviewable end to end. A `Plan` with its decision contract (approve or request changes), an `AgentTimeline` whose last step follows your answer, a `Tool` call with arguments and result one click away, a `ToolResultCard` hosting the chart the run produced, `TokenUsage` in the header, and an `ApprovalCard` for the one side effect that waits for a human. The block reports the decision through `onDecision` and never performs it.\n\nCopy-own it: `npx shadcn add agent-run-review-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AgentRunReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The plan is already approved: the run view without the first decision. */
export const PlanApproved: Story = { args: { defaultPlanStatus: "approved" } };
