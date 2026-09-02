import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";
import { Sparkles, Terminal as TerminalIcon } from "lucide-react";

import { TerminalBanner } from "./terminal-banner";
import { TerminalTranscriptRow } from "./terminal-transcript-row";
import { TerminalWorking } from "./terminal-working";

const meta = {
  title: "Terminal/TerminalBanner",
  component: TerminalBanner,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The console-dress launch card above an empty transcript: identity " +
          "(name, model, version, workspace), capabilities, what's new, and " +
          "quick actions with key hints. Every section is independently " +
          "optional. Built on `TerminalSurface`/`TerminalRow` like every other " +
          "component in this family — no `<fieldset>`/`<legend>` border trick, " +
          "and no vendor bitmap logo (`logo` is a caller-supplied slot).",
      },
    },
  },
} satisfies Meta<typeof TerminalBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A one-fact banner still reads as a deliberate card, never a broken one. */
export const Default: Story = {
  args: { title: "brand-ui Agent" },
};

/** Every section filled in — the full anatomy this component supports. */
export const FullAnatomy: Story = {
  args: {
    title: "brand-ui Agent",
    model: "gpt-5.1-codex",
    version: "v2.4.0",
    workspace: "~/Documents/DEV/elabs/elabs-components",
    logo: <TerminalIcon aria-hidden="true" className="size-5 text-terminal-ansi-bright-green" />,
    capabilities: [
      { label: "Read and edit files", description: "Across the whole workspace" },
      { label: "Run commands", description: "In a sandboxed shell", icon: <Sparkles /> },
      { label: "Web search" },
    ],
    whatsNew: [
      { label: "Faster file search", href: "https://example.com/changelog" },
      { label: "Improved diff review" },
    ],
    quickActions: [
      { label: "New chat", keyHint: "⌘N", onSelect: fn() },
      { label: "Continue previous session", keyHint: "⌘⇧P", onSelect: fn() },
      { label: "Open settings", onSelect: fn() },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "brand-ui Agent" })).toBeInTheDocument();
    await expect(canvas.getByText("gpt-5.1-codex · v2.4.0")).toBeInTheDocument();
    await expect(canvas.getByRole("list", { name: "Capabilities" })).toBeInTheDocument();
    await expect(canvas.getByRole("list", { name: "What’s new" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "New chat ⌘N" })).toBeInTheDocument();
  },
};

/** A long workspace path wraps under the content column instead of truncating. */
export const LongWorkspacePath: Story = {
  args: {
    title: "brand-ui Agent",
    workspace:
      "~/Documents/DEV/a-rather-long-monorepo-name/packages/terminal/src/very/nested/workspace/path",
  },
};

/** The `boxed` variant — a framed block per row, reads as frame-drawing output. */
export const BoxedVariant: Story = {
  args: {
    title: "brand-ui Agent",
    model: "gpt-5.1-codex",
    variant: "boxed",
    quickActions: [{ label: "New chat", keyHint: "⌘N", onSelect: fn() }],
  },
};

/** The `rail` variant — a vertical rule down the gutter, glyphs suppressed. */
export const RailVariant: Story = {
  args: {
    title: "brand-ui Agent",
    capabilities: [{ label: "Web search" }, { label: "Run code" }],
    variant: "rail",
  },
};

/** Sits above the transcript exactly where it lives in practice. */
export const AboveATranscript: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <TerminalBanner {...args} />
      <div className="flex flex-col gap-1 rounded-lg border border-terminal-border bg-terminal-background p-3 font-mono text-code text-terminal-foreground">
        <TerminalTranscriptRow kind="user">Refactor the parser</TerminalTranscriptRow>
        <TerminalTranscriptRow kind="agent">Reading src/parser.ts</TerminalTranscriptRow>
        <TerminalWorking elapsedMs={4000} />
      </div>
    </div>
  ),
  args: {
    title: "brand-ui Agent",
    model: "gpt-5.1-codex",
    quickActions: [{ label: "New chat", keyHint: "⌘N", onSelect: fn() }],
  },
};
