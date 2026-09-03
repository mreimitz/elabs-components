import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { TerminalConsole } from "./terminal-console";
import { TerminalStatusBar } from "./terminal-status-bar";

const meta = {
  title: "Terminal/TerminalStatusBar",
  component: TerminalStatusBar,
  tags: ["autodocs"],
  // Rendered inside a TerminalConsole in every args-driven story (ADR 0033): a
  // status bar is a REGION, not a frame — its `border-t` is the seam under
  // whatever sits above it, and it has no standalone frame of its own to
  // demonstrate. The forbidden shape this replaces was the bar rendered
  // directly on the page, reading as a page footer rather than the bottom of
  // a console. A META-LEVEL `render` (not `decorators`) is deliberate: a
  // story's own `render` fully REPLACES this one, whereas `decorators`
  // compose across levels and cannot be opted out of per story — the `Empty`
  // story below needs exactly that opt-out, since it has no bar content to
  // show as a region and its demo box is toned for the page, not the console
  // ground.
  render: (args) => (
    <TerminalConsole className="max-w-xl">
      <TerminalStatusBar {...args} />
    </TerminalConsole>
  ),
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Console skin of `AI/SessionStatusBar` — see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "The ambient chrome row that answers 'where am I, what am I connected to, " +
          "and how far through this turn am I' without the human asking (#117 T4). " +
          "Mirrors `SessionStatusBar`'s (`@elabs-ai/components-ai`) prop names for the " +
          "same facts — `branch`, `workspace`, `connections` — so swapping the chat " +
          "skin for the console skin renames nothing. Every segment is independently " +
          "optional; an all-empty bar renders nothing at all, not an empty shell. It is " +
          "a REGION of a `TerminalConsole` (ADR 0033), never a standalone card — every " +
          "story here renders it inside a frame.",
      },
    },
  },
} satisfies Meta<typeof TerminalStatusBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every ambient fact at once: branch, working directory, connections, context, turn. */
export const Default: Story = {
  args: {
    branch: "feature/status-bar",
    workspace: "~/projects/console-app",
    connections: { connected: 3, total: 4 },
    context: { limit: "500K", used: "16K" },
    turn: { current: 3, total: 5 },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("feature/status-bar")).toBeInTheDocument();
    await expect(canvas.getByText("3/4")).toBeInTheDocument();
    await expect(canvas.getByText("16K / 500K")).toBeInTheDocument();
    await expect(canvas.getByText("3/5")).toBeInTheDocument();
  },
};

/** Only branch and working directory — every other fact is independently optional. */
export const BranchAndWorkspaceOnly: Story = {
  args: { branch: "main", workspace: "~/projects/console-app" },
};

/** Integrations mid-handshake — a spinner replaces the connection icon. */
export const ConnectingIntegrations: Story = {
  args: {
    branch: "main",
    connections: { connected: 1, total: 4, connecting: true },
  },
};

/**
 * A lost or never-established connection. Recoverable in greyscale AND by a
 * screen reader: a distinct glyph (not the connected icon, recoloured) plus
 * its own VISIBLE text label, replacing the numeric count rather than
 * merely sitting beside it.
 */
export const DisconnectedIntegration: Story = {
  args: {
    branch: "main",
    connections: { connected: 0, total: 4, disconnected: true },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Disconnected")).toBeInTheDocument();
    await expect(canvas.queryByText("0/4")).not.toBeInTheDocument();
  },
};

/** A long working directory truncates in place; the full path stays in `title`. */
export const LongWorkingDirectory: Story = {
  args: {
    branch: "main",
    workspace: "~/projects/very/deeply/nested/console-application/src",
  },
};

/**
 * No segment supplied — the bar renders nothing at all, not an empty shell.
 * There is no bar content here to demonstrate as a region, so this story
 * supplies its own `render`, which replaces (not adds to) the meta-level
 * console wrapper — nesting an app-toned demo box inside the terminal ground
 * would fail contrast for no benefit.
 */
export const Empty: Story = {
  render: () => (
    <div className="rounded-md border border-dashed p-4 text-center text-meta text-muted-foreground">
      <TerminalStatusBar />
      Nothing rendered above this line.
    </div>
  ),
};
