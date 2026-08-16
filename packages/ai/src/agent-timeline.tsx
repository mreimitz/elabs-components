"use client";

/**
 * AgentTimeline / AgentStep — the agent execution-trace rail (#192,
 * research 10 §B.3).
 *
 * The convergence compound of the execution-trace grammar: sequenced,
 * status-bearing agent steps render on ONE visual spine — the canonical
 * `@elabs/components-ui` Timeline rail (`TimelineRoot`/`TimelineItem`, #190) — speaking
 * ONE status vocabulary — the closed 7-state `Status` enum (`StatusBadge`,
 * #189). `ChainOfThought`'s steps and `Task`'s body compose this instead of
 * hand-rolling rails; an inspect-only `Tool` call renders as an `AgentStep`
 * with its JSON behind a `ToolDetails` disclosure as children.
 *
 * Deliberately NOT converged (different speech-acts, research 10 §B.3):
 * `Plan` (a proposal, not an executed step), `Checkpoint` (a divider/restore
 * point), `Reasoning` (inline thinking prose).
 *
 * The shared rail is motion-free; the gated entrance animation lives here,
 * in the composing consumer (research 10 §B.2).
 */
import { StatusBadge, TimelineItem, TimelineRoot, type Status } from "@elabs/components-ui";
import type { TimelineItemProps, TimelineRootProps } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
import type { LucideIcon } from "lucide-react";
import { forwardRef, memo, type ReactNode } from "react";

export type AgentTimelineProps = TimelineRootProps;

/** The `<ol>` rail an agent run's steps sit on (canonical @elabs/components-ui spine). */
export const AgentTimeline = forwardRef<HTMLOListElement, AgentTimelineProps>(
  function AgentTimeline({ className, ...props }, ref) {
    return <TimelineRoot ref={ref} className={cn("not-prose w-full", className)} {...props} />;
  },
);

export interface AgentStepProps extends Omit<TimelineItemProps, "children" | "description"> {
  /** Optional leading concept glyph on the title row (Lucide). */
  icon?: LucideIcon;
  /** What the agent did — the step's title (`text-body`). */
  name: ReactNode;
  /** The business summary line under the name (`text-meta`), not JSON. */
  summary?: ReactNode;
  /**
   * The canonical execution status (closed 7-state enum). Drives the rail
   * node AND the `StatusBadge`. `skipped` is the agent-step-only state with
   * no SDK source (research 10 §B.1).
   */
  status?: Status;
  /**
   * Drop the inline `StatusBadge` (the rail node still carries the status
   * color). For quiet prose rails — e.g. the `ChainOfThought` alias — where a
   * badge per step would shout.
   */
  hideBadge?: boolean;
  /** Rich detail under the node (e.g. a `ToolDetails` disclosure, results). */
  children?: ReactNode;
}

/**
 * One executed/executing step: icon + name + `StatusBadge` + business
 * summary, with composed children for detail. Memoized for long transcripts
 * (research 10 §G.6).
 */
export const AgentStep = memo(
  forwardRef<HTMLLIElement, AgentStepProps>(function AgentStep(
    {
      icon: Icon,
      name,
      summary,
      status = "pending",
      hideBadge = false,
      className,
      children,
      ...props
    },
    ref,
  ) {
    return (
      <TimelineItem
        ref={ref}
        status={status}
        description={
          summary ? <span className="text-meta text-muted-foreground">{summary}</span> : undefined
        }
        detail={children}
        className={cn(
          "fade-in-0 slide-in-from-top-2 animate-in [--tw-ease:var(--ease-entrance)] motion-reduce:animate-none",
          className,
        )}
        {...props}
      >
        <span className="inline-flex items-center gap-2">
          {Icon ? (
            <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          ) : null}
          {name}
          {hideBadge ? null : <StatusBadge size="sm" status={status} />}
        </span>
      </TimelineItem>
    );
  }),
);

AgentTimeline.displayName = "AgentTimeline";
AgentStep.displayName = "AgentStep";
