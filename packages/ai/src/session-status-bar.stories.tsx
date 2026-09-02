import type { Meta, StoryObj } from "@storybook/react-vite";
import { Context, ContextTrigger } from "./context";
import { SessionStatusBar } from "./session-status-bar";

const meta = {
  title: "AI/SessionStatusBar",
  component: SessionStatusBar,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The ambient session row: workspace, branch, model and integration-connection progress (#105). Every segment renders only when its prop is supplied — an all-empty bar renders nothing at all. Docks `Context` via `children` rather than re-implementing token-usage/cost maths.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SessionStatusBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every ambient segment, with `Context` docked at the trailing edge. */
export const Default: Story = {
  render: () => (
    <SessionStatusBar branch="main" model="Claude Opus 4" workspace="brand-ui">
      <Context maxTokens={8000} usedTokens={2400}>
        <ContextTrigger />
      </Context>
    </SessionStatusBar>
  ),
};

/** Only a workspace name — every other segment is independently optional. */
export const WorkspaceOnly: Story = {
  render: () => <SessionStatusBar workspace="brand-ui" />,
};

/** Integrations mid-handshake — a spinner replaces the connection icon. */
export const ConnectingIntegrations: Story = {
  render: () => (
    <SessionStatusBar
      branch="feature/turn-status"
      connections={{ connected: 1, total: 4, connecting: true }}
      workspace="brand-ui"
    />
  ),
};

/** Integrations resolved — a static connected/total count. */
export const IntegrationsConnected: Story = {
  render: () => (
    <SessionStatusBar
      branch="feature/turn-status"
      connections={{ connected: 4, total: 4 }}
      model="Claude Opus 4"
      workspace="brand-ui"
    />
  ),
};

/** No segment supplied — the bar renders nothing at all, not an empty shell. */
export const Empty: Story = {
  render: () => (
    <div className="rounded-md border border-dashed p-4 text-center text-meta text-muted-foreground">
      <SessionStatusBar />
      Nothing rendered above this line.
    </div>
  ),
};
