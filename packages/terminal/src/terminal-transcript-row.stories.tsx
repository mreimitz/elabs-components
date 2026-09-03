import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { TerminalSurface } from "./terminal-surface";
import { TerminalTranscriptRow } from "./terminal-transcript-row";

const meta = {
  title: "Terminal/TerminalTranscriptRow",
  component: TerminalTranscriptRow,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Console skin of `AI/Message` — see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "One line of an agent transcript, built on `TerminalRow`. The `kind` axis " +
          "(`user` / `agent` / `output` / `error`) carries who spoke and whether " +
          "something failed as a glyph, a colour, AND an accessible label — never " +
          'colour alone. `error` is the state-grid\'s turn-error rung: `role="alert"`, ' +
          "for a settled, terminal failure only.",
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
} satisfies Meta<typeof TerminalTranscriptRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default kind: what the human typed. */
export const Default: Story = {
  args: { children: "pnpm build" },
};

/** What the human typed — a prompt glyph in the gutter. */
export const User: Story = {
  args: { kind: "user", children: "pnpm build" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Prompt")).toBeInTheDocument();
  },
};

/** What the agent said — the status-marker glyph. */
export const Agent: Story = {
  args: { kind: "agent", children: "Compiling 42 modules" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Agent")).toBeInTheDocument();
  },
};

/** Plain program output — the continuation-branch glyph, dimmer ink. */
export const Output: Story = {
  args: { kind: "output", children: "Build complete in 1.8s", exitCode: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Output")).toBeInTheDocument();
    await expect(canvas.getByText("Exit 0")).toBeInTheDocument();
  },
};

/**
 * A settled, terminal failure. Readable in greyscale: a distinct glyph plus
 * the "Error" label carry the meaning even with `text-terminal-ansi-red`
 * turned off.
 */
export const ErrorState: Story = {
  args: { kind: "error", children: "Command failed with exit code 1", exitCode: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Error")).toBeInTheDocument();
    await expect(canvas.getByText("Exit 1")).toBeInTheDocument();
    await expect(
      canvas.getByText("Command failed with exit code 1").closest("[role='alert']"),
    ).not.toBeNull();
  },
};

/** A full transcript, reading top to bottom as one session. */
export const Transcript: Story = {
  render: () => (
    <>
      <TerminalTranscriptRow kind="user">pnpm build</TerminalTranscriptRow>
      <TerminalTranscriptRow kind="agent">Building the workspace</TerminalTranscriptRow>
      <TerminalTranscriptRow kind="output">Compiling 42 modules</TerminalTranscriptRow>
      <TerminalTranscriptRow kind="error" exitCode={1}>
        Type error in src/index.ts — cannot find name “foo”
      </TerminalTranscriptRow>
    </>
  ),
};

/** Long output wraps under the content column rather than truncating. */
export const LongContent: Story = {
  args: {
    kind: "output",
    children:
      "A long, unbroken line of program output wraps under the content column instead of pushing the row out of the surface: packages/terminal/src/very/long/path/that/keeps/going.tsx",
  },
};
