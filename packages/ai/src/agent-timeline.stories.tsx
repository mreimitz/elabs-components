import type { Meta, StoryObj } from "@storybook/react-vite";
import { Calculator, Database, PencilLine, Search } from "lucide-react";
import { AgentStep, AgentTimeline } from "./agent-timeline";
import { ToolDetails, ToolInput, ToolOutput } from "./tool";

const meta = {
  title: "AI/AgentTimeline",
  component: AgentTimeline,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The agent EXECUTION trace on the canonical rail. A generic ordered-steps rail is `Core/Timeline`, and git history is `Data/RevisionTimeline` — see [Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). `AgentTimeline` is the convergence compound: sequenced, status-bearing steps on ONE spine (the `@elabs-ai/components-ui` Timeline rail) speaking ONE vocabulary (the closed seven-state `Status` enum). `AI/Task` and `AI/AgentEvent` compose it rather than hand-rolling rails.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AgentTimeline>;
export default meta;
type Story = StoryObj<typeof meta>;

// The execution-trace grammar (#192, research 10 §B.3): one rail, one status
// vocabulary, business summaries — not JSON — as the readable line.
export const Default: Story = {
  render: () => (
    <AgentTimeline className="max-w-prose">
      <AgentStep
        icon={Search}
        status="complete"
        name="Searched financial filings"
        summary="3 documents · Q3 10-Q, earnings deck, board pack"
      />
      <AgentStep
        icon={Database}
        status="complete"
        name="Queried finance.revenue"
        summary="8 rows reconciled · 0 variances"
      />
      <AgentStep icon={Calculator} status="running" name="Computing QoQ deltas" />
      <AgentStep icon={PencilLine} status="pending" name="Draft the board note" />
    </AgentTimeline>
  ),
};

// An inspect-only tool call rides the rail as a step; its JSON stays one
// expand away behind the default-collapsed ToolDetails (research 10 §B.5).
export const InspectOnlyToolStep: Story = {
  name: "Inspect-only Tool as a step",
  render: () => (
    <AgentTimeline className="max-w-prose">
      <AgentStep
        icon={Database}
        status="complete"
        name="Queried finance.revenue"
        summary="8 rows reconciled · 0 variances"
      >
        <ToolDetails>
          <ToolInput
            input={{
              sql: "select quarter, region, sum(amount) from finance.revenue group by 1,2",
            }}
          />
          <ToolOutput
            output={{ rows: 8, q3_total: 48200000, qoq_growth: 0.124 }}
            errorText={undefined}
          />
        </ToolDetails>
      </AgentStep>
      <AgentStep icon={Calculator} status="failed" name="Computing QoQ deltas" />
      <AgentStep icon={PencilLine} status="skipped" name="Draft the board note" />
    </AgentTimeline>
  ),
};
