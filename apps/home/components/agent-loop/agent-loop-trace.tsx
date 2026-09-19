"use client";
/**
 * AgentLoopTrace (RM-099) — one ai `Tool` card per MCP call. Name, arguments and the raw JSON
 * result sit in the card's collapsible body (`ToolInput`/`ToolOutput`); the elapsed ms and the
 * "recorded" badge are composed by the site into `ToolHeader`'s `summary` slot, so no ai part
 * is edited. The body composes the ai `CodeBlock` with `wrap` (rather than `ToolInput`/`ToolOutput`,
 * which render it unwrapped): long MCP text would otherwise overflow into a horizontal scroll
 * container that is not keyboard-focusable (axe `scrollable-region-focusable`). Cards enter with a short slide under `motion-safe` only — reduced motion shows
 * them in place (the 350 ms step floor is readability, and stays).
 */
import { forwardRef } from "react";
import { CodeBlock, Tool, ToolContent, ToolHeader } from "@elabs-ai/components-ai";
import { Badge } from "@elabs-ai/components-ui";
import type { TraceStep } from "./run-loop";

export type AgentLoopTraceLabels = {
  recorded: string;
  recordedHint: string;
  pending: string;
  elapsed: (ms: number) => string;
  arguments: string;
  result: string;
};

export type AgentLoopTraceProps = { steps: TraceStep[]; labels: AgentLoopTraceLabels };

export const AgentLoopTrace = forwardRef<HTMLOListElement, AgentLoopTraceProps>(
  function AgentLoopTrace({ steps, labels }, ref) {
    return (
      <ol ref={ref} data-slot="agent-loop-trace" className="flex w-full flex-col gap-2">
        {steps.map((step, index) => (
          <li
            key={`${step.tool}-${index}`}
            data-slot="agent-loop-trace-step"
            data-status={step.status}
            data-recorded={step.recorded ? "true" : undefined}
            className="w-full motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-base motion-safe:ease-entrance"
          >
            <Tool defaultOpen={false} className="mb-0 bg-card">
              <ToolHeader
                type="dynamic-tool"
                toolName={step.tool}
                title={step.tool}
                state={step.status === "pending" ? "input-available" : "output-available"}
                summary={
                  step.status === "pending" ? (
                    labels.pending
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <span className="tabular-nums" data-slot="agent-loop-trace-elapsed">
                        {labels.elapsed(step.elapsedMs ?? 0)}
                      </span>
                      {step.recorded ? (
                        <Badge variant="outline" title={labels.recordedHint}>
                          {labels.recorded}
                        </Badge>
                      ) : null}
                    </span>
                  )
                }
              />
              <ToolContent>
                <TracePayload label={labels.arguments} value={step.args} />
                {step.status === "done" ? (
                  <TracePayload label={labels.result} value={step.result} />
                ) : null}
              </ToolContent>
            </Tool>
          </li>
        ))}
      </ol>
    );
  },
);

function TracePayload({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="space-y-2">
      <h4 className="text-meta uppercase text-muted-foreground">{label}</h4>
      <div className="rounded-md bg-muted/50">
        <CodeBlock code={JSON.stringify(value, null, 2) ?? ""} language="json" wrap />
      </div>
    </div>
  );
}
