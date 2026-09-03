import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import {
  Copy as CopyIcon,
  Pencil as PencilIcon,
  Pin as PinIcon,
  RotateCcw as RotateCcwIcon,
} from "lucide-react";
import {
  AgentMessage,
  Message,
  MessageAction,
  MessageActions,
  MessageAvatar,
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageContent,
  MessageHeader,
  MessageResponse,
  UserMessage,
} from "./message";
import { SourceList } from "./sources";
const meta = {
  title: "AI/Message",
  component: Message,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "One turn of a CHAT transcript; one line of a CONSOLE transcript is `Terminal/TerminalTranscriptRow` — see [Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). `UserMessage` and `AgentMessage` are named presets over this same component and keep its `message` slot, so one consumer selector matches every entry point.",
      },
    },
  },
} satisfies Meta<typeof Message>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Conversation_: Story = {
  name: "User + Assistant",
  render: () => (
    <div className="space-y-4">
      <Message from="user">
        <MessageContent>Summarize last week's deploys.</MessageContent>
      </Message>
      <Message from="assistant">
        <MessageContent>Three services shipped; billing is degraded.</MessageContent>
      </Message>
    </div>
  ),
};
// The named preset wrappers (#191, research 11 §B.2): UserMessage / AgentMessage
// with the MessageHeader identity slot.
export const Presets: Story = {
  name: "UserMessage + AgentMessage",
  render: () => (
    <div className="space-y-4">
      <UserMessage>
        <MessageContent>How did churn develop this quarter?</MessageContent>
      </UserMessage>
      <AgentMessage>
        <MessageHeader>
          <MessageAvatar name="Atlas" role="agent" />
          <span>Atlas</span>
        </MessageHeader>
        <MessageContent>Pulling the retention cohorts now…</MessageContent>
      </AgentMessage>
    </div>
  ),
};
// emphasis="answer" = the green left rail on the wrapper; prose + grounding
// footer are COMPOSED children, not baked-in layout.
export const FinalAnswer: Story = {
  name: "AgentMessage emphasis=answer",
  render: () => (
    <AgentMessage emphasis="answer">
      <MessageHeader>
        <MessageAvatar name="Atlas" role="agent" />
        <span>Atlas</span>
      </MessageHeader>
      <MessageContent>
        <MessageResponse>{`## Churn improved this quarter

Enterprise churn fell **0.4pp** to 1.8%, driven by the renewal-desk rollout:

- 12 at-risk accounts recovered
- \`auto-renew\` adoption up 9pp`}</MessageResponse>
        <SourceList
          sources={[
            { href: "https://warehouse.acme.com/q3-retention", title: "Q3 retention cohort" },
            { href: "https://crm.acme.com/renewals", title: "Renewal desk log" },
          ]}
        />
      </MessageContent>
    </AgentMessage>
  ),
};
// LOADING — no tokens have arrived yet (loading-states.md `loading`).
// `MessageResponse` renders skeleton lines at the body line-height instead of
// `<Streamdown>`, so the bubble reserves its space before the first token.
export const Loading: Story = {
  name: "MessageResponse loading",
  render: () => (
    <AgentMessage>
      <MessageHeader>
        <MessageAvatar name="Atlas" role="agent" />
        <span>Atlas</span>
      </MessageHeader>
      <MessageContent>
        <MessageResponse loading />
      </MessageContent>
    </AgentMessage>
  ),
};
// Controlled MessageBranch (#361) — an external control ("Jump to reply N")
// drives the SAME `branch` state that the in-component Previous/Next controls
// mutate via `onBranchChange`, proving the host can own branch selection
// (e.g. restore it from a URL param) without remounting the subtree.
export const BranchControlled: Story = {
  name: "MessageBranch — controlled",
  render: function Render() {
    const [branch, setBranch] = useState(0);
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <button
            className="rounded-md border px-2 py-1 text-caption"
            onClick={() => setBranch(0)}
            type="button"
          >
            Jump to reply 1
          </button>
          <button
            className="rounded-md border px-2 py-1 text-caption"
            onClick={() => setBranch(2)}
            type="button"
          >
            Jump to reply 3
          </button>
        </div>
        <MessageBranch branch={branch} onBranchChange={setBranch}>
          <MessageBranchContent>
            <AgentMessage key="concise">
              <MessageContent>Here's a concise answer.</MessageContent>
            </AgentMessage>
            <AgentMessage key="detailed">
              <MessageContent>Here's a longer answer, with more context.</MessageContent>
            </AgentMessage>
            <AgentMessage key="alternate">
              <MessageContent>Here's a third, differently-phrased answer.</MessageContent>
            </AgentMessage>
          </MessageBranchContent>
          <MessageBranchSelector>
            <MessageBranchPrevious />
            <MessageBranchPage />
            <MessageBranchNext />
          </MessageBranchSelector>
        </MessageBranch>
      </div>
    );
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("1 of 3")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Jump to reply 3" }));
    await expect(canvas.getByText("3 of 3")).toBeInTheDocument();

    // The component's own Previous control still drives the SAME external
    // state — it doesn't fall back to internal tracking in controlled mode.
    await userEvent.click(canvas.getByRole("button", { name: "Previous branch" }));
    await expect(canvas.getByText("2 of 3")).toBeInTheDocument();
  },
};
// ACTIONS, always visible (`appearance="plain" reveal="always"` — the defaults,
// set explicitly here so both default values are exercised in a RENDERED
// position, not only in the controls panel).
export const ActionsPlain: Story = {
  name: "MessageActions — inline",
  render: () => (
    <AgentMessage>
      <MessageContent>Three services shipped; billing is degraded.</MessageContent>
      <MessageActions appearance="plain" reveal="always">
        <MessageAction onClick={() => {}} tooltip="Copy">
          <CopyIcon aria-hidden="true" size={14} />
        </MessageAction>
        <MessageAction onClick={() => {}} tooltip="Pin">
          <PinIcon aria-hidden="true" size={14} />
        </MessageAction>
      </MessageActions>
    </AgentMessage>
  ),
};
// ACTIONS, hover-revealed floating pill — the chat-client shape. The row is
// `opacity-0` at rest on a FINE pointer only and fades in from the parent
// `Message`'s hover; on a coarse (touch) pointer it never hides, since nothing
// there could reveal it.
//
// The controls stay in the tab order the whole time — `focus-within` is what
// brings the pill back for a keyboard user, which is why the row is NOT
// `hidden`/`invisible`/unmounted at rest.
export const ActionsHoverBar: Story = {
  name: "MessageActions — hover pill",
  render: function Render() {
    const [pinned, setPinned] = useState(false);
    return (
      <div className="space-y-4">
        <AgentMessage>
          <MessageHeader>
            <MessageAvatar name="Atlas" role="agent" />
            <span>Atlas</span>
          </MessageHeader>
          <MessageContent>
            Retention held at 94% — the dip you saw was a reporting lag, not churn.
          </MessageContent>
          <MessageActions appearance="bar" reveal="hover">
            <MessageAction onClick={() => {}} tooltip="Copy">
              <CopyIcon aria-hidden="true" size={14} />
            </MessageAction>
            {/* Pin is a TOGGLE the host owns — the component ships no pin state.
                `aria-pressed` + the filled glyph are the two channels (a11y.md:
                colour is never the only one). */}
            <MessageAction
              aria-pressed={pinned}
              onClick={() => setPinned((v) => !v)}
              tooltip={pinned ? "Unpin" : "Pin"}
            >
              <PinIcon
                aria-hidden="true"
                className={pinned ? "fill-current" : undefined}
                size={14}
              />
            </MessageAction>
            <MessageAction onClick={() => {}} tooltip="Retry">
              <RotateCcwIcon aria-hidden="true" size={14} />
            </MessageAction>
          </MessageActions>
        </AgentMessage>
        <UserMessage>
          <MessageContent>Can you break that down by region?</MessageContent>
          <MessageActions appearance="bar" reveal="hover">
            <MessageAction onClick={() => {}} tooltip="Copy">
              <CopyIcon aria-hidden="true" size={14} />
            </MessageAction>
            <MessageAction onClick={() => {}} tooltip="Edit">
              <PencilIcon aria-hidden="true" size={14} />
            </MessageAction>
          </MessageActions>
        </UserMessage>
      </div>
    );
  },
  play: async ({ canvas }) => {
    // Hover-revealed ≠ removed: the controls are real, named, reachable buttons
    // at rest, which is the whole reason the row fades rather than unmounts.
    const groups = canvas.getAllByRole("group", { name: "Message actions" });
    await expect(groups).toHaveLength(2);

    const pin = canvas.getByRole("button", { name: "Pin" });
    await expect(pin).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(pin);
    await expect(canvas.getByRole("button", { name: "Unpin" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  },
};
