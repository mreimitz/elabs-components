import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Conversation, ConversationContent, ConversationScrollButton } from "./conversation";
import { Message, MessageContent, MessageResponse } from "./message";
import { Composer } from "./composer";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "./reasoning";
import { Source, Sources, SourcesContent, SourcesTrigger } from "./sources";

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
      "Queried CI for the last 7 days, grouped by service, then cross-referenced the rollback log to flag regressions.",
  },
];

function ChatExample() {
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
    <div className="mx-auto flex h-[640px] max-w-2xl flex-col overflow-hidden rounded-xl border">
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

      <Composer
        className="m-3 mt-0"
        placeholder="Ask about deploys…"
        status={status === "submitted" ? "Generating…" : "Awaiting your input"}
        sendStatus={status}
        onSubmit={(message) => {
          const text = message.text?.trim();
          if (text) send(text);
        }}
      />
    </div>
  );
}

const meta = {
  title: "AI/Chat",
  component: ChatExample,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ChatExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
