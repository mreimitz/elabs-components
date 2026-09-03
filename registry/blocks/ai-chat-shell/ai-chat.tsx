/**
 * AI chat scaffold (copy-owned block). Wire `send` to your model/runtime.
 * Built on @elabs-ai/components-ai (AI Elements) — render the AI SDK `UIMessage` model;
 * the app owns the model calls (swap `send` for a `useChat` transport).
 * Depends on installed @elabs-ai/components-ai + @elabs-ai/components-ui.
 *
 * The input is `<Composer>`, the canonical brand-ui chat input — not a
 * hand-assembled `PromptInput` footer. Every control the `PromptInput` family
 * ships is reachable from a `Composer` prop (`modelPicker`, `mode`, `effort`,
 * `slashCommands`, `tools`), so a scaffold has no reason to drop a rung; reach
 * for `PromptInput` directly only when you are building a bespoke shell.
 */
"use client";

import { useState } from "react";
import {
  Composer,
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
  Message,
  MessageContent,
  MessageResponse,
} from "@elabs-ai/components-ai";

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

      <Composer
        onSubmit={(message) => {
          const text = message.text?.trim();
          if (text) {
            void send(text);
          }
        }}
        placeholder="Send a message…"
        // The status strip is display-only; drive it from whatever your runtime
        // knows. Pass `null` to hide the strip entirely.
        status={status === "submitted" ? "Thinking…" : "Awaiting your input"}
        sendStatus={status}
        // This scaffold wires neither attachments nor dictation, so it does not
        // show affordances that would do nothing. Drop these two props (they
        // default to `true`) once you have wired the handlers, or pass your own
        // controls through `tools`.
        showAttach={false}
        showVoice={false}
      />
    </div>
  );
}
