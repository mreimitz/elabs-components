import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { TerminalSurface } from "./terminal-surface";
import { TerminalEventLine } from "./terminal-event-line";

const meta = {
  title: "Terminal/TerminalEventLine",
  component: TerminalEventLine,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Console skin of `AI/AgentEvent` — see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "The CLI dress of an agent lifecycle/hook event line — a fixed `◆` marker, " +
          "a label, and an optional phase, hook count and duration. Shares its " +
          "outcome/hook-count model with the chat-skin sibling `AgentEvent` " +
          "(`@elabs-ai/components-ai`) via `@elabs-ai/components-ui`, so the two " +
          "never structurally drift. The outcome — succeeded, blocked, failed — " +
          "and a partial hook failure (e.g. `[hooks: 3/1]`) are both a distinct " +
          "glyph plus an announced word, never colour alone.",
      },
    },
  },
  decorators: [
    (Story) => (
      <TerminalSurface>
        <Story />
      </TerminalSurface>
    ),
  ],
} satisfies Meta<typeof TerminalEventLine>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Real captured line (Grok CLI v0.2.93, 2026-09-01): a hook count with a partial failure. */
export const Default: Story = {
  args: { label: "user_prompt_submit", hooks: { ran: 3, passed: 1 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("[hooks: 3/1]")).toBeInTheDocument();
  },
};

/** A bare hook total, when per-check verdicts are not known. */
export const HooksTotalOnly: Story = {
  args: { label: "List .", hooks: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("[hooks: 3]")).toBeInTheDocument();
  },
};

/** All three hooks pass — the bracket renders plainly, no failure marker. */
export const HooksAllPassed: Story = {
  args: { label: "stop", hooks: { ran: 3, passed: 3 } },
};

/** When this event fired relative to the action it gates. */
export const WithPhase: Story = {
  args: { label: "user_prompt_submit", phase: "lifecycle" },
};

/** A duration, formatted with the shared `formatElapsed`. */
export const WithDuration: Story = {
  args: { label: "Thought", durationMs: 200 },
};

/** A runtime hook refused the action — a distinct glyph and an announced "Blocked". */
export const Blocked: Story = {
  args: { label: "pre_tool_use", outcome: "blocked", phase: "before" },
};

/**
 * The event itself failed. Readable in greyscale: the outcome glyph's SHAPE
 * changes (not only its colour), and the sr-only word differs from every
 * other outcome.
 */
export const Failed: Story = {
  args: { label: "post_tool_use", outcome: "failed", phase: "after", hooks: { ran: 2, passed: 0 } },
};

/** `rail`/`boxed` pass through to the underlying `TerminalRow` like any other row. */
export const Rail: Story = {
  args: { label: "stop", hooks: { ran: 3, passed: 1 }, variant: "rail" },
};

export const Boxed: Story = {
  args: { label: "stop", hooks: { ran: 3, passed: 1 }, variant: "boxed" },
};

/** The four real captured lines, together, reading top to bottom as one session. */
export const Transcript: Story = {
  render: () => (
    <>
      <TerminalEventLine label="Thought" durationMs={200} />
      <TerminalEventLine label="user_prompt_submit" hooks={{ ran: 3, passed: 1 }} />
      <TerminalEventLine label="stop" hooks={{ ran: 3, passed: 1 }} />
      <TerminalEventLine label="List ." hooks={3} />
    </>
  ),
};
