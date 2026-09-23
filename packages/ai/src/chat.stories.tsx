import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { placeholderChartDataUrl, silentWavDataUrl } from "./_media-fixtures";
import { Attachment, AttachmentPreview, Attachments, type AttachmentData } from "./attachments";
import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioPlayerDurationDisplay,
  AudioPlayerElement,
  AudioPlayerMuteButton,
  AudioPlayerPlayButton,
  AudioPlayerTimeDisplay,
  AudioPlayerTimeRange,
} from "./audio-player";
import { ChatShell } from "./chat-shell";
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
  /** Files the person attached — rendered through `Attachments` (images via ui `Image`). */
  attachments?: AttachmentData[];
  /** A spoken rendition of the reply (text-to-speech output), played inline. */
  audioSrc?: string;
}

/** The screenshot the person pastes — an SVG data URL, so the story needs no network origin. */
const SCREENSHOT: AttachmentData = {
  id: "shot",
  type: "file",
  mediaType: "image/svg+xml",
  filename: "staging-latency.svg",
  url: placeholderChartDataUrl("p95 latency — staging, last 7 days"),
};

/** A 12 s silent clip stands in for the spoken reply. */
const SPOKEN_REPLY = silentWavDataUrl(12);

const initial: Msg[] = [
  {
    id: "1",
    role: "user",
    text: "Here’s the latency panel from staging — what changed in last week’s deploys?",
    attachments: [SCREENSHOT],
  },
  {
    id: "2",
    role: "assistant",
    text: "Three services shipped this week. **Billing** is currently degraded — elevated p95 latency after the last rollout.",
    reasoning:
      "Queried CI for the last 7 days, grouped by service, then cross-referenced the rollback log to flag regressions.",
    audioSrc: SPOKEN_REPLY,
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
    <div className="mx-auto h-[640px] max-w-4xl overflow-hidden rounded-xl border bg-background">
      <ChatShell
        variant="bare"
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
                  {m.attachments?.length ? (
                    <Attachments variant="grid">
                      {m.attachments.map((attachment) => (
                        <Attachment key={attachment.id} data={attachment}>
                          <AttachmentPreview />
                        </Attachment>
                      ))}
                    </Attachments>
                  ) : null}
                  {m.reasoning ? (
                    <Reasoning>
                      <ReasoningTrigger />
                      <ReasoningContent>{m.reasoning}</ReasoningContent>
                    </Reasoning>
                  ) : null}
                  <MessageResponse>{m.text}</MessageResponse>
                  {m.audioSrc ? (
                    // The spoken version of the reply: ai's `AudioPlayer*` presets over the
                    // ui `MediaPlayer*` parts, in a compact bar that fits the bubble.
                    <AudioPlayer className="block w-full max-w-md rounded-md border">
                      <AudioPlayerElement src={m.audioSrc} preload="metadata" />
                      <AudioPlayerControlBar>
                        <AudioPlayerPlayButton />
                        <AudioPlayerTimeDisplay />
                        <AudioPlayerTimeRange />
                        <AudioPlayerDurationDisplay />
                        <AudioPlayerMuteButton />
                      </AudioPlayerControlBar>
                    </AudioPlayer>
                  ) : null}
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
  title: "Patterns/Scenarios/Chat",
  component: ChatExample,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A demo SCENARIO, not an importable component — the smallest end-to-end chat " +
          "composed from the @elabs-ai/components-ai grammar: a scrolling " +
          "[Conversation](?path=/story/ai-conversation--default) of " +
          "[Messages](?path=/story/ai-message--presets) with reasoning and sources, plus a " +
          "[Composer](?path=/story/ai-composer--default), laid out by " +
          "[ChatShell](?path=/story/ai-chatshell--default): the transcript scrolls behind the " +
          "floating composer and both sit in centred reading columns. The person’s message " +
          "carries a screenshot as an [Attachment](?path=/story/ai-attachments--default) and " +
          "the reply ships a spoken version through the " +
          "[AudioPlayer](?path=/story/ai-audioplayer--default) presets — both render through " +
          "the ui media primitives.",
      },
    },
  },
} satisfies Meta<typeof ChatExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The pasted screenshot renders through ui `Image`, named by its filename.
    await expect(canvas.getByRole("img", { name: "staging-latency.svg" })).toBeVisible();
    // The spoken reply is a real player: a named region with real buttons and a scrubber.
    const player = canvas.getByRole("region", { name: "Audio player" });
    await expect(within(player).getByRole("button", { name: "Play" })).toBeVisible();
    await expect(within(player).getByRole("slider", { name: "Seek" })).toBeInTheDocument();
  },
};
