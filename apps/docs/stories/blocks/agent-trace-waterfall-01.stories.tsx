import type { Meta, StoryObj } from "@storybook/react-vite";
import { trace } from "@/components/agent-ops-parts/data/atlas-ops";
import { AgentTraceWaterfall } from "@/components/agent-trace-waterfall-01/agent-trace-waterfall";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Agent Ops/Trace Waterfall",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Where did the run fail?",
      description: {
        component:
          "An execution waterfall for one multi-agent run: a stat strip where every number carries its comparison, the charts package’s Gantt at sub-second granularity with one row per agent span, and a context-flow chain that shows the hop where a required field was dropped.\n\nCopy-own it: `npx shadcn add agent-trace-waterfall-01` (pulls `agent-ops-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AgentTraceWaterfall>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <AgentTraceWaterfall /> };

/** The same workflow on a healthy run — no failure tile, no retry rows, every hop complete. */
export const HealthyRun: Story = {
  render: () => (
    <AgentTraceWaterfall
      run={{
        ...trace,
        id: "tr_84926",
        durationMs: 3_280,
        retries: 0,
        tokensIn: 8_120,
        tokensOut: 2_924,
        costUsd: 0.14,
        spans: trace.spans
          .filter((s) => s.state !== "retry")
          .map((s) => ({
            ...s,
            state: "ok" as const,
            fieldsPresent: s.fieldsExpected,
            contextKb: s.contextKb || 9.1,
            tokens: s.tokens || 900,
            startMs: Math.round(s.startMs * 0.68),
            endMs: Math.round(s.endMs * 0.68),
          })),
      }}
    />
  ),
};
