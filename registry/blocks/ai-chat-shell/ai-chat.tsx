/**
 * AI chat scaffold (copy-owned block). Wire `send` to your model/runtime.
 * Built on @qlik-coe-emea/qlabs-components-ai (AI Elements) — render the AI SDK `UIMessage` model;
 * the app owns the model calls (swap `send` for a `useChat` transport).
 * Depends on installed @qlik-coe-emea/qlabs-components-ai + @qlik-coe-emea/qlabs-components-ui.
 */
"use client";

import { useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
  Message,
  MessageContent,
  MessageResponse,
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@qlik-coe-emea/qlabs-components-ai";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export function AiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<"ready" | "submitted">("ready");

  async function send(text: string) {
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", text }]);
    setStatus("submitted");
    // TODO: call your backend / model here and stream the response.
    const reply = "This is a placeholder response. Connect me to your model.";
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: reply }]);
    setStatus("ready");
  }

  return (
    <div className="flex h-full flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Start the conversation"
              description="Ask anything to begin."
            />
          ) : (
            messages.map((m) => (
              <Message from={m.role} key={m.id}>
                <MessageContent>
                  <MessageResponse>{m.text}</MessageResponse>
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput
        onSubmit={(message) => {
          const text = message.text?.trim();
          if (text) {
            void send(text);
          }
        }}
      >
        <PromptInputBody>
          <PromptInputTextarea placeholder="Send a message…" />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools />
          <PromptInputSubmit status={status} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
