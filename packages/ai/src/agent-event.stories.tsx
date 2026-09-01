import type { Meta, StoryObj } from "@storybook/react-vite";
import { AgentEvent } from "./agent-event";
import { AgentStep, AgentTimeline } from "./agent-timeline";

const meta = {
  title: "AI/AgentEvent",
  component: AgentEvent,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof AgentEvent>;
export default meta;
type Story = StoryObj<typeof meta>;

// A lifecycle event with no gated action — an AgentStep variant on the SAME
// rail, distinguished from an ordinary step by glyph + label only (#109).
export const Default: Story = {
  render: () => (
    <AgentTimeline className="max-w-prose">
      <AgentEvent label="user_prompt_submit" phase="lifecycle" outcome="ok" />
    </AgentTimeline>
  ),
};

// One hook firing before a tool call and one firing after — the event-level
// `phase` ("before" | "after" | "lifecycle") is a separate, wider prop than
// any individual check's own `phase`.
export const BeforeAndAfterHooks: Story = {
  render: () => (
    <AgentTimeline className="max-w-prose">
      <AgentEvent label="pre_tool_use" phase="before" outcome="ok" durationMs={42} />
      <AgentEvent label="post_tool_use" phase="after" outcome="ok" durationMs={128} />
    </AgentTimeline>
  ),
};

// checks as a count summary — "passed/ran" rendered as plain text.
export const CheckSummaryCount: Story = {
  render: () => (
    <AgentTimeline className="max-w-prose">
      <AgentEvent
        label="pre_tool_use"
        phase="before"
        outcome="ok"
        durationMs={210}
        checks={{ ran: 4, passed: 4 }}
      />
    </AgentTimeline>
  ),
};

// checks as individual verdicts — a blocked event whose gate had a failing
// check. Pass/fail never rides colour alone: each row pairs a distinct icon
// with visible "Passed"/"Failed" text (see accessibility.md's greyscale test).
export const BlockedWithFailingCheck: Story = {
  render: () => (
    <AgentTimeline className="max-w-prose">
      <AgentEvent
        label="pre_tool_use"
        phase="before"
        outcome="blocked"
        durationMs={340}
        checks={[
          { label: "policy: no secrets", ok: true, durationMs: 12 },
          { label: "policy: write scope", ok: false, detail: "path escapes workspace root" },
        ]}
      />
    </AgentTimeline>
  ),
};

// A failed hook alongside ordinary AgentStep entries, proving AgentEvent
// rides the same <ol> rail as any other step — no second spine (#109 AC1).
export const WithinAgentTimeline: Story = {
  name: "Alongside AgentStep on one rail",
  render: () => (
    <AgentTimeline className="max-w-prose">
      <AgentEvent label="user_prompt_submit" phase="lifecycle" outcome="ok" />
      <AgentStep status="complete" name="Searched financial filings" summary="3 documents" />
      <AgentEvent
        label="post_tool_use"
        phase="after"
        outcome="failed"
        durationMs={95}
        checks={[{ label: "output schema", ok: false, detail: "missing required field: total" }]}
      />
      <AgentEvent label="stop" phase="lifecycle" outcome="ok" durationMs={64200} />
    </AgentTimeline>
  ),
};
