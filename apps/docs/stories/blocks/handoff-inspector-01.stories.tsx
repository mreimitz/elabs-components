import type { Meta, StoryObj } from "@storybook/react-vite";
import { handoff } from "@/components/agent-ops-parts/data/atlas-ops";
import { HandoffInspector } from "@/components/handoff-inspector-01/handoff-inspector";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: HandoffInspector,
  title: "Patterns/Blocks/Agent Ops/Handoff Inspector",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Where was the context dropped?",
      description: {
        component:
          "One edge of a multi-agent run: sender → a metric pill on the arrow → receiver; a context-comparison table that shows the required field that was not sent; payload size against the workflow baseline as a meter with a marker; and the edge’s 24-hour health.\n\nCopy-own it: `npx shadcn add handoff-inspector-01` (pulls `agent-ops-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof HandoffInspector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <HandoffInspector /> };

/** The same edge on a healthy run — every required field present, the arrow green. */
export const HealthyRun: Story = {
  render: () => (
    <HandoffInspector
      data={{
        ...handoff,
        traceId: "tr_84926",
        contextKb: 9.1,
        fields: handoff.fields.map((f) => ({ ...f, sent: true })),
        analysis:
          "authorization_scope was forwarded — the exact field missing in tr_84921. Same contract, healthy run.",
      }}
    />
  ),
};

export const Narrow: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <HandoffInspector />
    </div>
  ),
};
