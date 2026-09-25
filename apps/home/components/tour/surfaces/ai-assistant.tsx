"use client";

/**
 * AI assistant tour surface (RM-098, concept §4.2 "ambient agent presence" / §5). A fixed
 * transcript from `content/fixtures/conversation.ts` (RM-095) — reasoning, a tool call, two
 * citations and a chart artifact — rendered through the real `@elabs-ai/components-ai`
 * composition. Per D5 (`decisions.md`) this never calls a model: the `PromptInput` below is
 * inert (`disabled` field + submit, a no-op `onSubmit`), exactly the scope line the concept
 * asks every agent surface to carry.
 *
 * On first mount, with motion on, the final assistant text part streams in over ~1.2s — a local
 * `requestAnimationFrame` scheduler, no network, same gating shape as the hero's own stream-in
 * (`components/hero/use-hero-stream.ts`): reduced motion, or a repeat mount this session
 * (`sessionStorage`), renders the full text immediately.
 */
import { useEffect, useRef, useState } from "react";
import {
  Artifact,
  ArtifactContent,
  ArtifactHeader,
  ArtifactTitle,
  ChatShell,
  Conversation,
  ConversationContent,
  Message,
  MessageContent,
  MessageResponse,
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@elabs-ai/components-ai";
import { AutoChart } from "@elabs-ai/components-charts";
import type { ChartSpec } from "@elabs-ai/components-charts";
import { isMotionAtFloor, readMotionFactor } from "@elabs-ai/components-ui";
import { CONVERSATION } from "../../../content/fixtures/conversation";
import { tourSurfaceCopy } from "../../../content/copy";

type Part = (typeof CONVERSATION)[number]["parts"][number];
type TextPart = Extract<Part, { type: "text" }>;
type ReasoningPart = Extract<Part, { type: "reasoning" }>;
type ToolPart = Extract<Part, { type: `tool-${string}` }>;
type SourcePart = Extract<Part, { type: "source-url" }>;
/**
 * The AI SDK's generic `DataUIPart<DATA_TYPES>` types `type` as the WIDE pattern
 * `data-${string}` (not the literal `"data-chart"`), so `Extract<Part, { type: "data-chart" }>`
 * resolves to `never` — a narrower literal can never be a subtype of that wider pattern. Declared
 * by hand instead, matching exactly the shape `content/fixtures/conversation.ts` constructs.
 */
interface ChartPart {
  type: "data-chart";
  id: string;
  data: ChartSpec;
}

const textOf = (parts: readonly Part[]): string =>
  parts
    .filter((p): p is TextPart => p.type === "text")
    .map((p) => p.text)
    .join("\n");

const [userMessage, assistantMessage] = CONVERSATION;
if (!userMessage || !assistantMessage) {
  throw new Error("ai-assistant surface: CONVERSATION needs a user turn and an assistant turn.");
}

const reasoningPart = assistantMessage.parts.find(
  (p): p is ReasoningPart => p.type === "reasoning",
);
const toolPart = assistantMessage.parts.find((p): p is ToolPart => p.type.startsWith("tool-"));
const sourceParts = assistantMessage.parts.filter((p): p is SourcePart => p.type === "source-url");
const chartPart = assistantMessage.parts.find((p): p is ChartPart => p.type === "data-chart");
const finalText = textOf(assistantMessage.parts);

if (!toolPart || !chartPart || !finalText) {
  throw new Error("ai-assistant surface: CONVERSATION is missing a tool call, chart or text part.");
}
// Rebound so the non-null type survives into the component closure below (TS forgets a
// control-flow narrowing of an outer `const` once it is read inside a nested function).
const TOOL_PART: ToolPart = toolPart;
const CHART_PART: ChartPart = chartPart;

const USER_TEXT = textOf(userMessage.parts);
const STREAM_SESSION_KEY = "brand-ui-tour-ai-streamed";
const STREAM_MS = 1200;

/**
 * Streams `fullText` in once per session (`ref` must land on a mounted node before paint).
 * `isStreaming` mirrors the tick loop's own `progress < 1` so callers can thread it into
 * `Conversation`'s `isStreaming` prop (`packages/ai/src/conversation.tsx`) — otherwise its
 * `role="log"` live region stays `aria-live="polite"` for the whole reveal instead of
 * suppressing itself while text is still arriving.
 */
function useStreamedText(fullText: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(fullText);
  const [isStreaming, setIsStreaming] = useState(false);
  useEffect(() => {
    let alreadyStreamed = false;
    try {
      alreadyStreamed = window.sessionStorage.getItem(STREAM_SESSION_KEY) === "1";
    } catch {
      // Storage blocked (private mode): the stream simply plays again next time.
    }
    const factor = readMotionFactor(ref.current);
    if (alreadyStreamed || isMotionAtFloor(factor)) {
      setText(fullText);
      setIsStreaming(false);
      return;
    }
    try {
      window.sessionStorage.setItem(STREAM_SESSION_KEY, "1");
    } catch {
      // Ignore: harmless, the stream just plays again.
    }
    setText("");
    setIsStreaming(true);
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const elapsed = (now - start) / factor;
      const progress = Math.min(1, elapsed / STREAM_MS);
      setText(fullText.slice(0, Math.round(fullText.length * progress)));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setIsStreaming(false);
      }
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only stream; fullText is fixture-stable
  }, []);
  return { ref, text, isStreaming };
}

export function AiAssistantSurface() {
  const { ref, text: streamedText, isStreaming } = useStreamedText(finalText);
  const copy = tourSurfaceCopy.aiAssistant;

  return (
    <div ref={ref} className="h-full">
      <ChatShell
        variant="bare"
        className="h-full"
        composer={
          <PromptInput onSubmit={(_message, event) => event.preventDefault()}>
            <PromptInputBody>
              <PromptInputTextarea disabled placeholder={copy.composerPlaceholder} />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools />
              <PromptInputSubmit disabled aria-label={copy.composerSubmitLabel} />
            </PromptInputFooter>
          </PromptInput>
        }
      >
        <Conversation className="flex-1" isStreaming={isStreaming}>
          <ConversationContent>
            <Message from="user">
              <MessageContent>
                <MessageResponse>{USER_TEXT}</MessageResponse>
              </MessageContent>
            </Message>
            <Message from="assistant">
              <MessageContent>
                {reasoningPart ? (
                  <Reasoning defaultOpen={false}>
                    <ReasoningTrigger />
                    <ReasoningContent>{reasoningPart.text}</ReasoningContent>
                  </Reasoning>
                ) : null}
                <Tool defaultOpen={false}>
                  <ToolHeader
                    type={TOOL_PART.type}
                    state={TOOL_PART.state}
                    summary={copy.toolSummary}
                  />
                  <ToolContent>
                    <ToolInput input={TOOL_PART.input} />
                    <ToolOutput output={TOOL_PART.output} errorText={undefined} />
                  </ToolContent>
                </Tool>
                {sourceParts.length > 0 ? (
                  <Sources>
                    <SourcesTrigger count={sourceParts.length} />
                    <SourcesContent>
                      {sourceParts.map((source) => (
                        <Source key={source.sourceId} href={source.url} title={source.title} />
                      ))}
                    </SourcesContent>
                  </Sources>
                ) : null}
                <Artifact>
                  <ArtifactHeader>
                    <ArtifactTitle>{CHART_PART.data.title}</ArtifactTitle>
                  </ArtifactHeader>
                  <ArtifactContent>
                    <AutoChart spec={CHART_PART.data} height={200} />
                  </ArtifactContent>
                </Artifact>
                <MessageResponse>{streamedText}</MessageResponse>
              </MessageContent>
            </Message>
          </ConversationContent>
        </Conversation>
      </ChatShell>
    </div>
  );
}
