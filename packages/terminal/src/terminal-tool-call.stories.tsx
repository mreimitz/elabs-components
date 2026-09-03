import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { TerminalSurface } from "./terminal-surface";
import { TerminalToolCall } from "./terminal-tool-call";

const meta = {
  title: "Terminal/TerminalToolCall",
  component: TerminalToolCall,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Console skin of `AI/Tool` and `AI/ToolResultCard` — see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "A single tool invocation dressed as a CLI line: a status glyph, the tool " +
          "name plus its optional argument in parentheses, a result summary on its own " +
          "`⎿` row, and detail behind a real, keyboard-operable disclosure. The three " +
          "statuses (`success` / `error` / `pending`) are each a distinct glyph plus an " +
          "announced word — never colour alone.",
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
} satisfies Meta<typeof TerminalToolCall>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default status: still running, nothing settled yet. */
export const Default: Story = {
  args: { toolName: "Bash", argument: "pnpm build" },
};

/** A succeeded call — the literal upstream `⏺` glyph, green as a redundant cue. */
export const Success: Story = {
  args: {
    toolName: "Bash",
    argument: "pnpm build",
    status: "success",
    summary: "Build complete in 1.8s",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Succeeded")).toBeInTheDocument();
    await expect(canvas.getByText("Build complete in 1.8s")).toBeInTheDocument();
  },
};

/**
 * A settled, terminal failure. Readable in greyscale: the `✗` glyph (never
 * the success rung's `⏺`, recoloured) plus the "Failed"/"Error" words carry
 * the meaning even with colour turned off.
 */
export const ErrorState: Story = {
  args: {
    toolName: "Bash",
    argument: "rm -rf tmp",
    status: "error",
    summary: "rm: tmp: No such file or directory",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Failed")).toBeInTheDocument();
    await expect(
      canvas.getByText("rm: tmp: No such file or directory").closest("[role='alert']"),
    ).not.toBeNull();
  },
};

/** Still in flight — its own hollow-circle glyph, not the success bullet recoloured. */
export const Pending: Story = {
  args: { toolName: "Bash", argument: "pnpm test", status: "pending" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Running")).toBeInTheDocument();
    // pending never gets role=alert, even with no summary yet to judge.
    await expect(canvas.queryByRole("alert")).toBeNull();
  },
};

/**
 * Detail behind disclosure, collapsed by default. The trigger is a real,
 * localized, focusable control — a keyboard user opens it with Tab then
 * Enter, never a CLI chord.
 */
export const WithDetail: Story = {
  args: {
    toolName: "Read",
    argument: "package.json",
    status: "success",
    summary: "42 lines read",
    detail: '{\n  "name": "@elabs-ai/components-terminal"\n}',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText(/components-terminal/)).not.toBeInTheDocument();

    const trigger = canvas.getByRole("button", { name: /show details/i });
    trigger.focus();
    await expect(trigger).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByText(/components-terminal/)).toBeInTheDocument();
    // Re-collapsible: the trigger stays visible and named once open.
    await expect(canvas.getByRole("button", { name: /show details/i })).toBeVisible();
  },
};

/** A short run of calls, reading top to bottom as one session. */
export const Session: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <TerminalToolCall
        toolName="Read"
        argument="package.json"
        status="success"
        summary="42 lines read"
      />
      <TerminalToolCall toolName="Bash" argument="pnpm test" status="pending" />
      <TerminalToolCall
        toolName="Bash"
        argument="rm -rf tmp"
        status="error"
        summary="rm: tmp: No such file or directory"
        detail="rm: tmp: No such file or directory (errno 2)"
      />
    </div>
  ),
};

/** The `boxed` variant frames each of the call's own rows independently. */
export const Boxed: Story = {
  args: {
    toolName: "Bash",
    argument: "pnpm build",
    status: "success",
    summary: "Build complete in 1.8s",
    detail: "42 modules compiled",
    variant: "boxed",
  },
};
