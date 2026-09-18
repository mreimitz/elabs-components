"use client";
/**
 * AgentLoop (RM-099) — the "Ask your agent" demo, website-only (maintainer decision
 * 2026-09-19). Left: `AgentLoopPrompt`. Right: `AgentLoopTrace` (one ai `Tool` card per MCP
 * call) and the render slot, with the honesty line (D5) directly under it. The transport is
 * injected; `mcp-client.ts` is the only code that fetches. No model is called: the prompt →
 * calls → block picking is the curated map in `content/agent-loop.json`.
 *
 * Keyboard: Enter in the prompt runs; focus moves to the first trace card's toggle when the
 * run starts, then to the rendered block's heading when it lands; Reset returns focus to the
 * prompt.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@elabs-ai/components-ui";
import { agentLoopCopy as copy } from "../../content/copy";
import { AgentLoopPrompt } from "./agent-loop-prompt";
import { AgentLoopTrace } from "./agent-loop-trace";
import { createMcpClient, type AgentLoopTransport } from "./mcp-client";
import { PROMPTS, type AgentLoopPromptEntry } from "./prompt-map";
import { BLOCK_RENDERS, SURFACE_RENDERS } from "./renders";
import { runLoop, type TraceStep } from "./run-loop";

export type AgentLoopProps = {
  prompts?: AgentLoopPromptEntry[];
  transport?: AgentLoopTransport;
  /** Server-rendered under the render slot, always visible (concept §8.4). */
  honestyLine: ReactNode;
  onRun?: (promptId: string) => void;
};

type Phase = "idle" | "running" | "done";

export function AgentLoop({ prompts = PROMPTS, transport, honestyLine, onRun }: AgentLoopProps) {
  const client = useMemo(() => transport ?? createMcpClient(), [transport]);
  const [selectedId, setSelectedId] = useState(prompts[0]!.id);
  const [phase, setPhase] = useState<Phase>("idle");
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [rendered, setRendered] = useState<AgentLoopPromptEntry | null>(null);
  const [runCount, setRunCount] = useState(0);
  const runToken = useRef(0);
  const traceRef = useRef<HTMLOListElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const focusTarget = useRef<"trace" | "heading" | "prompt" | null>(null);

  useEffect(() => {
    if (focusTarget.current === "trace" && trace.length > 0) {
      traceRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      focusTarget.current = null;
    } else if (focusTarget.current === "heading" && rendered) {
      headingRef.current?.focus();
      focusTarget.current = null;
    } else if (focusTarget.current === "prompt" && phase === "idle") {
      textareaRef.current?.focus();
      focusTarget.current = null;
    }
  }, [trace, rendered, phase]);

  useEffect(() => () => void (runToken.current += 1), []);

  async function run() {
    const prompt = prompts.find((p) => p.id === selectedId) ?? prompts[0]!;
    const token = ++runToken.current;
    setRunCount((n) => n + 1);
    setPhase("running");
    setRendered(null);
    setTrace([]);
    focusTarget.current = "trace";
    onRun?.(prompt.id);
    const result = await runLoop(prompt.calls, client, {
      onTrace: (next) => token === runToken.current && setTrace(next),
      isCancelled: () => token !== runToken.current,
    });
    if (!result || token !== runToken.current) return;
    focusTarget.current = "heading";
    setRendered(prompt);
    setPhase("done");
  }

  function reset() {
    runToken.current += 1;
    setTrace([]);
    setRendered(null);
    setPhase("idle");
    focusTarget.current = "prompt";
  }

  const title = rendered
    ? rendered.surface
      ? (copy.surfaceTitles[rendered.surface] ?? rendered.surface)
      : rendered.blocks.join(" + ")
    : "";
  const Surface = rendered?.surface ? SURFACE_RENDERS[rendered.surface] : null;
  const statusText =
    phase === "running"
      ? copy.running(prompts.find((p) => p.id === selectedId)?.text ?? "")
      : phase === "done"
        ? copy.done
        : "";

  return (
    <div
      data-slot="agent-loop"
      data-phase={phase}
      className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <AgentLoopPrompt
          prompts={prompts}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRun={() => void run()}
          running={phase === "running"}
          runCount={runCount}
          labels={copy}
          textareaRef={textareaRef}
        />
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={reset} disabled={phase === "idle"}>
            {copy.reset}
          </Button>
          <p
            role="status"
            aria-live="polite"
            className="min-w-0 truncate text-meta text-muted-foreground"
          >
            {statusText}
          </p>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <section aria-label={copy.traceHeading} className="flex min-w-0 flex-col gap-2">
          <h3 className="text-eyebrow text-muted-foreground">{copy.traceHeading}</h3>
          {trace.length === 0 ? (
            <p className="text-caption text-muted-foreground">{copy.traceIdle}</p>
          ) : (
            <AgentLoopTrace ref={traceRef} steps={trace} labels={copy} />
          )}
        </section>
        <Card data-slot="agent-loop-render" className="min-w-0">
          {rendered ? (
            <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-97 motion-safe:duration-slow motion-safe:ease-entrance">
              <CardHeader>
                <CardTitle ref={headingRef} tabIndex={-1} className="focus-ring rounded-sm">
                  {copy.renderHeading(title)}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {Surface ? (
                  <Surface label={copy.regionMapLabel} />
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {rendered.blocks.map((id) => {
                      const Block = BLOCK_RENDERS[id];
                      return Block ? <Block key={id} /> : null;
                    })}
                  </div>
                )}
              </CardContent>
            </div>
          ) : (
            <CardContent className="py-6">
              <p className="text-caption text-muted-foreground">{copy.renderIdle}</p>
            </CardContent>
          )}
        </Card>
        {honestyLine}
      </div>
    </div>
  );
}
