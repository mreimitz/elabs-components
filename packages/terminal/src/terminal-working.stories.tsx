import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";

import { TerminalSurface } from "./terminal-surface";
import { TerminalTranscriptRow } from "./terminal-transcript-row";
import { TerminalWorking } from "./terminal-working";

const meta = {
  title: "Terminal/TerminalWorking",
  component: TerminalWorking,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Console skin of `AI/TurnStatus` — see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "The in-turn footer line, pinned last in a transcript: while the agent is " +
          "working, the human can see it is alive, how long it has been going, what " +
          "it has spent, and how to stop it. Prop-driven only — it runs no timer of " +
          "its own; `elapsedMs` is a snapshot the caller re-renders with, exactly " +
          "like `TurnStatus` (`@elabs-ai/components-ai`). The spinner glyph swaps " +
          "for a solid diamond once `isStreaming` — content is actively arriving, " +
          "not merely awaited.",
      },
    },
  },
  args: {
    onStop: fn(),
  },
  decorators: [
    (Story) => (
      <TerminalSurface>
        <Story />
      </TerminalSurface>
    ),
  ],
} satisfies Meta<typeof TerminalWorking>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Waiting on the model — the default spinner, elapsed time, and a stop control. */
export const Default: Story = {
  args: { elapsedMs: 8000 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The label is in the DOM TWICE by design — once visibly, and once inside
    // the single `role="status"` live region (see the component docblock).
    // `getByText` throws on that duplicate, so each node is asserted through
    // the seam that identifies it: the visible one by its `data-slot`, the
    // announced one by its role. Asserting both is what actually locks the
    // live-region discipline in place.
    await expect(
      canvasElement.querySelector('[data-slot="terminal-working-label"]'),
    ).toHaveTextContent("Waiting for response…");
    await expect(canvas.getByRole("status")).toHaveTextContent("Waiting for response…");
    await expect(canvas.getByText("8.0s")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Stop" })).toBeInTheDocument();
  },
};

/** A caller-supplied label, token count, and a keyboard-shortcut hint on the stop control. */
export const WithTokensAndShortcut: Story = {
  args: {
    label: "Editing files…",
    elapsedMs: 42000,
    tokens: 15400,
    stopShortcut: "Esc",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Duplicated visible + announced label — see the `Default` story's note.
    await expect(
      canvasElement.querySelector('[data-slot="terminal-working-label"]'),
    ).toHaveTextContent("Editing files…");
    await expect(canvas.getByRole("status")).toHaveTextContent("Editing files…");
    await expect(canvas.getByText("42s")).toBeInTheDocument();
    await expect(canvas.getByText(/⇣\s*15K/)).toBeInTheDocument();
    await expect(canvas.getByText("Esc")).toBeInTheDocument();
  },
};

/**
 * Content is actively arriving — the spinner substitutes for a solid diamond
 * (`◆`), the ground-truth grammar for an actively-streaming tool. The
 * `isStreaming` not-ready signal (`.claude/rules/loading-states.md`).
 */
export const Streaming: Story = {
  args: {
    label: "Writing packages/terminal/src/terminal-working.tsx…",
    elapsedMs: 3000,
    isStreaming: true,
  },
};

/** The scroll-to-bottom affordance, alongside the stop control. */
export const WithScrollToBottom: Story = {
  args: {
    elapsedMs: 15000,
    showScrollToBottom: true,
    onScrollToBottom: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Scroll to bottom" })).toBeInTheDocument();
  },
};

/** No stats yet — only the label and the spinner render. */
export const LabelOnly: Story = {
  args: { onStop: undefined },
};

/** Pinned last in a real transcript, exactly where it lives in practice. */
export const InTranscript: Story = {
  render: (args) => (
    <>
      <TerminalTranscriptRow kind="user">Refactor the parser</TerminalTranscriptRow>
      <TerminalTranscriptRow kind="agent">Reading src/parser.ts</TerminalTranscriptRow>
      <TerminalWorking {...args} />
    </>
  ),
  args: { elapsedMs: 12000, tokens: 3400 },
};
