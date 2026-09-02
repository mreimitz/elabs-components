import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { TurnStatus } from "./turn-status";

const meta = {
  title: "AI/TurnStatus",
  component: TurnStatus,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The in-turn footer: label, elapsed time, token counts, turn progress and a stop affordance in one place (#105). Exactly one role=status live region announces the label and the settled state — the ticking elapsed/tokens/turn stats are plain visible text so they never flood assistive tech.",
      },
    },
  },
  args: {
    elapsedMs: 8000,
    label: "Working…",
    status: "working",
    tokens: { input: 1200, output: 340 },
    turn: 2,
    turnTotal: 5,
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TurnStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A running turn: label, elapsed, tokens, turn progress and a stop button. */
export const Default: Story = {
  args: {
    onStop: () => undefined,
  },
  render: (args) => (
    <div className="max-w-lg rounded-md border bg-card p-2">
      <TurnStatus {...args} />
    </div>
  ),
};

/** No stop control — just the label and live stats. */
export const WithoutStop: Story = {
  render: (args) => (
    <div className="max-w-lg rounded-md border bg-card p-2">
      <TurnStatus {...args} />
    </div>
  ),
};

/** A minimal working state — only a label, no stats yet. */
export const LabelOnly: Story = {
  args: {
    elapsedMs: undefined,
    tokens: undefined,
    turn: undefined,
    turnTotal: undefined,
  },
  render: (args) => (
    <div className="max-w-lg rounded-md border bg-card p-2">
      <TurnStatus {...args} />
    </div>
  ),
};

/** The completed-turn line — stats and the stop control disappear; the live region stops announcing further ticks. */
export const Settled: Story = {
  args: {
    status: "settled",
  },
  render: (args) => (
    <div className="max-w-lg rounded-md border bg-card p-2">
      <TurnStatus {...args} />
    </div>
  ),
};

/** Adds a "scroll to bottom" affordance beside the stop control. */
export const WithScrollToBottom: Story = {
  args: {
    onScrollToBottom: () => undefined,
    onStop: () => undefined,
    showScrollToBottom: true,
  },
  render: (args) => (
    <div className="max-w-lg rounded-md border bg-card p-2">
      <TurnStatus {...args} />
    </div>
  ),
};

/** A live-ticking demo — elapsed time advances every second until Stop settles the turn. */
export const Live: Story = {
  render: () => {
    const LiveDemo = () => {
      const [elapsedMs, setElapsedMs] = useState(0);
      const [status, setStatus] = useState<"working" | "settled">("working");

      useEffect(() => {
        if (status !== "working") return;
        const id = setInterval(() => setElapsedMs((ms) => ms + 1000), 1000);
        return () => clearInterval(id);
      }, [status]);

      return (
        <div className="max-w-lg rounded-md border bg-card p-2">
          <TurnStatus
            elapsedMs={elapsedMs}
            label="Editing files…"
            onStop={() => setStatus("settled")}
            status={status}
            tokens={{ input: 800 + elapsedMs, output: 120 + elapsedMs / 2 }}
            turn={1}
            turnTotal={3}
          />
        </div>
      );
    };
    return <LiveDemo />;
  },
};
