// registry: workspace-shell — copied 2026-09-19
/**
 * Workspace assistant — what the template docks hold: a short briefing about the screen,
 * a few questions worth asking, and a conversation. The answers here are canned data so the
 * block renders and behaves before a model is wired in; replace `answer` with your own
 * transport (an AI SDK `useChat`, say). brand-ui never makes the model call.
 */
"use client";

import { useState, type ReactNode } from "react";
import {
  Composer,
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  Message,
  MessageContent,
  MessageResponse,
  Suggestion,
  Suggestions,
} from "@elabs-ai/components-ai";

export interface AssistantBriefItem {
  title: string;
  body: ReactNode;
}

export interface AssistantPrompt {
  prompt: string;
  /** What the assistant replies. Markdown. */
  answer: string;
}

export interface WorkspaceAssistantProps {
  /** Two or three things worth knowing about what is on screen. */
  brief: AssistantBriefItem[];
  prompts: AssistantPrompt[];
  /** Reply to anything typed that is not one of `prompts`. */
  fallbackAnswer?: string;
  placeholder?: string;
}

interface Turn {
  id: number;
  role: "user" | "assistant";
  text: string;
}

export function WorkspaceAssistant({
  brief,
  prompts,
  fallbackAnswer = "This assistant is not connected to a model yet. Wire `onSubmit` to your own transport and it will answer from your data.",
  placeholder = "Ask about this screen…",
}: WorkspaceAssistantProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const ask = (text: string) => {
    const known = prompts.find((item) => item.prompt === text);
    setTurns((prev) => [
      ...prev,
      { id: prev.length, role: "user", text },
      { id: prev.length + 1, role: "assistant", text: known?.answer ?? fallbackAnswer },
    ]);
  };
  const open = prompts.filter((item) => !turns.some((turn) => turn.text === item.prompt));

  return (
    <div className="flex h-full min-h-0 flex-col gap-4" data-slot="workspace-assistant">
      <ul className="flex flex-col gap-3">
        {brief.map((item) => (
          <li className="flex flex-col gap-0.5 border-s-2 border-primary ps-3" key={item.title}>
            <span className="text-body font-medium text-foreground">{item.title}</span>
            <span className="text-meta text-muted-foreground">{item.body}</span>
          </li>
        ))}
      </ul>

      {turns.length > 0 ? (
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="px-0">
            {turns.map((turn) => (
              <Message from={turn.role} key={turn.id}>
                <MessageContent>
                  <MessageResponse>{turn.text}</MessageResponse>
                </MessageContent>
              </Message>
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      ) : (
        <div className="flex-1" />
      )}

      {open.length > 0 ? (
        <Suggestions>
          {open.map((item) => (
            <Suggestion key={item.prompt} onClick={ask} suggestion={item.prompt} />
          ))}
        </Suggestions>
      ) : null}

      <Composer
        onSubmit={(message) => {
          const text = message.text?.trim();
          if (text) ask(text);
        }}
        placeholder={placeholder}
        sendStatus="ready"
        showAttach={false}
        showVoice={false}
        status="Answers come from the data on this screen"
      />
    </div>
  );
}
