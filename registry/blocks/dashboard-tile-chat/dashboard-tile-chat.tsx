/**
 * `chat` dashboard tile (copy-owned block) — a `DashboardTileKind` wrapping
 * `@elabs-ai/components-ai`'s `ChatShell`/`Conversation`/`Composer`. `dashboard/` itself
 * may only import `charts`/`ui`/`tokens`/`icons` (.claude/rules/dashboard.md), so an `ai`
 * tile is host-registered through the tile-kind registry (D4) — this block IS that
 * registration.
 *
 * `interactions.active` gates the composer: a sheet in a passive/read-only context
 * (`active: false`) disables the textarea and the send button with native `disabled` —
 * the tile is fully inert, not just its empty-submit guard (D5: no tile owns a model
 * call; wire `onSubmit` to your own transport).
 *
 * Messages live in local component state, like the `ai-chat-shell` block's scaffold —
 * a tile never fetches or persists its own content (D5), so `tile.content` carries
 * nothing to read on mount.
 *
 * Depends on installed @elabs-ai/components-ai + @elabs-ai/components-charts (its
 * /dashboard subpath) + @elabs-ai/components-ui.
 */
"use client";

import { useState } from "react";
import {
  ChatShell,
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  Message,
  MessageContent,
  MessageResponse,
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@elabs-ai/components-ai";
import type { DashboardTileKind, DashboardTileProps } from "@elabs-ai/components-charts/dashboard";

/** Content of a `chat` tile. Empty — the transcript is the host's runtime state, never the spec. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- placeholder content: this kind stores nothing in the spec (see module doc)
export interface DashboardTileChatContent {}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

function ChatTile({ tile, interactions }: DashboardTileProps<DashboardTileChatContent>) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const active = interactions.active !== false;

  function send(text: string) {
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", text }]);
    // TODO: call your backend / model here and stream the response (D5: brand-ui never does).
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "assistant", text: "Connect me to your model." },
    ]);
  }

  return (
    <div
      data-slot="dashboard-tile-chat"
      data-tile-kind={tile.kind}
      className="flex size-full min-h-0 flex-col"
    >
      <ChatShell
        variant="bare"
        composer={
          <PromptInput
            onSubmit={(message) => {
              const text = message.text?.trim();
              if (text) send(text);
            }}
          >
            <PromptInputBody>
              <PromptInputTextarea
                disabled={!active}
                placeholder={active ? "Ask about this sheet…" : "Chat is inactive on this sheet"}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools />
              <PromptInputSubmit disabled={!active} status="ready" />
            </PromptInputFooter>
          </PromptInput>
        }
      >
        <Conversation>
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
        </Conversation>
      </ChatShell>
    </div>
  );
}

/** Build a `chat` tile kind. `kind` lets a host register several presets. */
export function createChatTileKind(kind = "chat"): DashboardTileKind<DashboardTileChatContent> {
  return {
    kind,
    label: "Chat",
    component: ChatTile,
    defaultSize: { w: 8, h: 10 },
    minSize: { w: 4, h: 4 },
    capabilities: {},
    configForm: { formName: `${kind}-tile`, fields: [] },
    defaultContent: {},
  };
}

/** `createChatTileKind()` — the default `chat` kind. */
export const chatTileKind = createChatTileKind();
