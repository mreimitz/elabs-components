import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { ChatGreeting } from "./chat-greeting";
import { SessionHeader } from "./session-header";

const CAPABILITIES = [
  { label: "Web search", description: "Look things up while we talk." },
  { label: "Code execution", description: "Run and inspect snippets in a sandbox." },
  { label: "File access", description: "Read files in the current workspace." },
];

const WHATS_NEW = [
  { label: "Faster file search", href: "#" },
  { label: "Improved reasoning traces" },
];

const QUICK_ACTIONS = [
  { label: "New chat", keyHint: "⌘N", onSelect: fn() },
  { label: "Open workspace", keyHint: "⌘O", onSelect: fn() },
  { label: "Settings", onSelect: fn() },
];

const meta = {
  title: "AI/SessionHeader",
  component: SessionHeader,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The launch card for an empty agent session — model, workspace, version, capabilities, what's new, and quick actions with key hints. Every section is independently optional: with only `title` supplied it renders the identity row alone, with no empty section scaffolding and no stray separators. Pair it above `ChatGreeting` for the standard first-run agent session state; distinct from `ChatGreeting`, which is the centered display-scale greeting for a general assistant chat.",
      },
    },
  },
  args: {
    title: "Codex",
    model: "gpt-5.1-codex",
    workspace: "~/dev/acme/api-gateway",
    version: "v2.4.0",
    capabilities: CAPABILITIES,
    whatsNew: WHATS_NEW,
    quickActions: QUICK_ACTIONS,
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SessionHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The fully-populated launch card. */
export const Default: Story = {
  render: (args) => (
    <div className="mx-auto max-w-md bg-background">
      <SessionHeader {...args} />
    </div>
  ),
};

/**
 * `title` is the only prop supplied — every other section (meta, workspace,
 * capabilities, what's new, quick actions) is absent. Renders the identity
 * row alone with no empty scaffolding and no stray separators.
 */
export const TitleOnly: Story = {
  args: {
    title: "Codex",
    model: undefined,
    workspace: undefined,
    version: undefined,
    capabilities: undefined,
    whatsNew: undefined,
    quickActions: undefined,
  },
  render: (args) => (
    <div className="mx-auto max-w-md bg-background">
      <SessionHeader {...args} />
    </div>
  ),
};

/** Every section populated — the full launch-card anatomy. */
export const FullyPopulated: Story = {
  render: (args) => (
    <div className="mx-auto max-w-md bg-background">
      <SessionHeader {...args} />
    </div>
  ),
};

/** A long workspace path truncates instead of overflowing its container. */
export const LongWorkspacePath: Story = {
  args: {
    workspace: "~/dev/acme/monorepo/services/platform/billing/api-gateway/src/handlers/webhooks",
  },
  render: (args) => (
    <div className="mx-auto max-w-md bg-background">
      <SessionHeader {...args} />
    </div>
  ),
};

/** A route that already owns the page's `<h1>` — pass `level={3}` to keep a single, hierarchical outline. */
export const HeadingLevel3: Story = {
  args: { level: 3 },
  render: (args) => (
    <div className="mx-auto max-w-md bg-background">
      <h1 className="sr-only">Assistant</h1>
      <h2 className="sr-only">Session</h2>
      <SessionHeader {...args} />
    </div>
  ),
};

/** SessionHeader above ChatGreeting — the standard empty first-run agent session. */
export const WithChatGreeting: Story = {
  parameters: { layout: "fullscreen" },
  render: (args) => (
    <div className="grid min-h-[32rem] place-items-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md space-y-8">
        <SessionHeader {...args} />
        <ChatGreeting title="Ready when you are" orb={false} level={3} />
      </div>
    </div>
  ),
};
