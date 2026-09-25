"use client";

import type { ReactNode } from "react";
import { Bell, Cable, Sparkles, Table2 } from "lucide-react";
import { Badge, SectionHeader, cn } from "@elabs-ai/components-ui";

export interface ProcessStep {
  id: string;
  icon: ReactNode;
  title: string;
  body: string;
  /** A small chip naming what the visitor sees on screen at this step. */
  sees: string;
}

export interface MarketingProcessProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  steps?: ProcessStep[];
  className?: string;
}

const DEFAULT_STEPS: ProcessStep[] = [
  {
    id: "connect",
    icon: <Cable aria-hidden="true" />,
    title: "Connect a source",
    body: "Point Tessera at a warehouse, a database or a spreadsheet. Read-only credentials, nothing copied out of your account.",
    sees: "A list of your tables",
  },
  {
    id: "model",
    icon: <Table2 aria-hidden="true" />,
    title: "Name what matters",
    body: "Pick the tables that count and give the columns plain names. Tessera proposes the joins and the metrics it can see.",
    sees: "A model with 12 metrics",
  },
  {
    id: "ask",
    icon: <Sparkles aria-hidden="true" />,
    title: "Ask in a sentence",
    body: "“Revenue by region, last quarter, against plan.” The answer comes back as a chart with the query it ran shown underneath.",
    sees: "A chart and its SQL",
  },
  {
    id: "watch",
    icon: <Bell aria-hidden="true" />,
    title: "Get told when it moves",
    body: "Pin the answer to a board or set a threshold. When the number crosses it, the right people hear, with the why attached.",
    sees: "An alert in Slack",
  },
];

/**
 * How it works, in four numbered steps along a rail that fades out at both ends. Each
 * step carries a glyph, a title, a sentence or two and a chip naming what the visitor
 * will see on screen. A row when the container is wide, a column when it is not.
 */
export function MarketingProcess({
  eyebrow = "How it works",
  title = "From a database to an answer, in an afternoon",
  description = "No pipeline to build and no dashboard to design first. Four steps, each of them visible.",
  steps = DEFAULT_STEPS,
  className,
}: MarketingProcessProps) {
  return (
    <section
      className={cn(
        "@container mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-16",
        className,
      )}
      data-slot="marketing-process"
    >
      <SectionHeader as="h2" description={description} eyebrow={eyebrow} size="lg" title={title} />
      <ol
        className={cn(
          "relative grid grid-cols-1 gap-10 @4xl:grid-cols-4 @4xl:gap-8",
          // The rail: a hairline behind the step numbers, masked so it fades at both ends.
          // Vertical down the numbers' centre when stacked, horizontal across them in a row.
          "before:pointer-events-none before:absolute before:bg-border-strong before:content-['']",
          "before:inset-y-0 before:start-5 before:w-px before:mask-y-from-90% before:mask-y-to-100%",
          "@4xl:before:inset-x-0 @4xl:before:top-5 @4xl:before:h-px @4xl:before:w-auto @4xl:before:mask-x-from-90% @4xl:before:mask-x-to-100% @4xl:before:mask-y-from-100%",
        )}
        data-slot="marketing-process-steps"
      >
        {steps.map((step, index) => (
          <li
            className="relative flex gap-5 @4xl:flex-col @4xl:gap-4"
            data-slot="marketing-process-step"
            key={step.id}
          >
            <span
              aria-hidden="true"
              className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-border-strong bg-background text-body font-semibold tabular-nums shadow-xs"
            >
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-3 pt-1.5 @4xl:pt-0">
              <div className="flex items-center gap-2 text-primary [&>svg]:size-5">
                {step.icon}
                <h3 className="text-subtitle font-semibold text-foreground">
                  <span className="sr-only">Step {index + 1}: </span>
                  {step.title}
                </h3>
              </div>
              <p className="text-body text-muted-foreground text-pretty">{step.body}</p>
              <div className="flex items-center gap-2 text-meta text-muted-foreground">
                <span>You see</span>
                <Badge variant="outline">{step.sees}</Badge>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
