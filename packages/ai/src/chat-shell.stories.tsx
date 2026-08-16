import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { cn } from "@elabs/components-ui";
import { ChatShell } from "./chat-shell";
import { Conversation, ConversationContent, ConversationScrollButton } from "./conversation";
import { Message, MessageContent, MessageResponse } from "./message";
import { Composer } from "./composer";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "./reasoning";
import { Source, Sources, SourcesContent, SourcesTrigger } from "./sources";
import { ContextPanelRail } from "./_chat-shell-rail";

interface Msg {
  id: string;
  role: "user" | "assistant";
  text: string;
  reasoning?: string;
}

const initial: Msg[] = [
  { id: "1", role: "user", text: "What changed in last week's deploys?" },
  {
    id: "2",
    role: "assistant",
    text: "Three services shipped this week. **Billing** is currently degraded — elevated p95 latency after the last rollout.",
    reasoning:
      "Queried CI for the last 7 days, grouped by service, then flagged regressions from the rollback log.",
  },
];

function ChatShellExample({ variant = "card" }: { variant?: "card" | "bare" }) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [status, setStatus] = useState<"ready" | "submitted">("ready");

  const send = (text: string) => {
    setMessages((m) => [...m, { id: String(m.length + 1), role: "user", text }]);
    setStatus("submitted");
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: String(m.length + 1),
          role: "assistant",
          text: "Three services shipped; billing is degraded.",
        },
      ]);
      setStatus("ready");
    }, 600);
  };

  return (
    // For `bare`, the wrapper is the bounded pane the immersive shell fills —
    // exactly how a workspace `SidebarInset` already frames the region.
    <div
      className={cn(
        "mx-auto h-[640px] max-w-4xl",
        variant === "bare" && "overflow-hidden rounded-xl border bg-background",
      )}
    >
      <ChatShell
        variant={variant}
        header={<span className="text-body font-semibold">Ops Assistant</span>}
        aside={<ContextPanelRail />}
        composer={
          <Composer
            placeholder="Ask about deploys…"
            status={status === "submitted" ? "Generating…" : "Awaiting your input"}
            sendStatus={status}
            onSubmit={(message) => {
              const text = message.text?.trim();
              if (text) send(text);
            }}
          />
        }
      >
        <Conversation className="flex-1">
          <ConversationContent>
            {messages.map((m) => (
              <Message from={m.role} key={m.id}>
                <MessageContent>
                  {m.reasoning ? (
                    <Reasoning>
                      <ReasoningTrigger />
                      <ReasoningContent>{m.reasoning}</ReasoningContent>
                    </Reasoning>
                  ) : null}
                  <MessageResponse>{m.text}</MessageResponse>
                  {m.role === "assistant" ? (
                    <Sources>
                      <SourcesTrigger count={2} />
                      <SourcesContent>
                        <Source href="https://example.com" title="Deploy log — wk 23" />
                        <Source href="https://example.com" title="Billing runbook" />
                      </SourcesContent>
                    </Sources>
                  ) : null}
                </MessageContent>
              </Message>
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </ChatShell>
    </div>
  );
}

const meta = {
  title: "AI/ChatShell",
  component: ChatShellExample,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ChatShellExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/**
 * Frameless immersive layout: no card border, the transcript fades under the
 * header and above the composer, and the composer floats on the pane ground.
 * Use inside an already-bounded region (an AppShell pane, a full-page
 * workspace) so the shell doesn't draw a redundant second frame.
 */
export const Bare: Story = { args: { variant: "bare" } };
