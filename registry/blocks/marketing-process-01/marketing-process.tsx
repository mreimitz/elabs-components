"use client";

import type { ReactNode } from "react";
import { Bell, Cable, Sparkles, Table2 } from "lucide-react";
import { Badge, SectionHeader, TimelineItem, TimelineRoot, cn } from "@elabs-ai/components-ui";

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
 * How it works, in four numbered steps on a `Timeline` (`nodeSize="badge"`,
 * `orientation="responsive"`): a row when the container is wide, a column when it is
 * not. Each step carries a glyph, a title, a sentence or two and a chip naming what the
 * visitor will see on screen.
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
      <TimelineRoot
        aria-label={typeof title === "string" ? title : undefined}
        className="gap-x-8"
        data-slot="marketing-process-steps"
        nodeSize="badge"
        orientation="responsive"
        variant="plain"
      >
        {steps.map((step, index) => (
          <TimelineItem
            className="pb-10 @3xl:pb-0"
            data-slot="marketing-process-step"
            detail={
              <>
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
              </>
            }
            key={step.id}
            node={index + 1}
          />
        ))}
      </TimelineRoot>
    </section>
  );
}
