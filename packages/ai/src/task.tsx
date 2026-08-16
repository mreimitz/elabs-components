"use client";

/**
 * Task — a collapsed "what got done" run summary (#192, research 10 §B.6).
 *
 * The body rides the canonical execution-trace rail (`AgentTimeline` /
 * `AgentStep`, research 10 §B.3) instead of the pre-#192 hand-rolled
 * `border-s-2` content rail. Collapsed by default — in a settled transcript
 * only the focal surfaces (the produced artifact + the final answer) stay
 * open, not every trace.
 */
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { ChevronDownIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { AgentStep, AgentTimeline, type AgentStepProps } from "./agent-timeline";

export type TaskItemFileProps = ComponentProps<"span">;

/**
 * A quiet inline file chip. Unbordered since #192 (the fill is the gesture;
 * a border on a filled chip is the redundant-border anti-pattern). For a
 * navigable list of produced files, prefer the asset-tree idiom (research 09).
 */
export const TaskItemFile = ({ children, className, ...props }: TaskItemFileProps) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-meta text-secondary-foreground",
      className,
    )}
    {...props}
  >
    {children}
  </span>
);

export type TaskItemProps = Omit<AgentStepProps, "name" | "children"> & {
  children?: ReactNode;
};

/**
 * One line of the run summary — an `AgentStep` on the canonical rail.
 * Defaults to `status="complete"` (the task reports finished work) with the
 * badge hidden (the rail node carries the status; a badge per log line would
 * shout).
 */
export const TaskItem = ({
  children,
  status = "complete",
  hideBadge = true,
  ...props
}: TaskItemProps) => <AgentStep hideBadge={hideBadge} name={children} status={status} {...props} />;

export type TaskProps = ComponentProps<typeof Collapsible>;

/** Collapsed by default since #192 (`defaultOpen` flipped `true`→`false`). */
export const Task = ({ className, ...props }: TaskProps) => (
  <Collapsible className={cn(className)} {...props} />
);

export type TaskTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  title: string;
};

export const TaskTrigger = ({ children, className, title, ...props }: TaskTriggerProps) => (
  <CollapsibleTrigger asChild className={cn("group", className)} {...props}>
    {children ?? (
      <div className="flex w-full cursor-pointer items-center gap-2 text-body text-muted-foreground transition-colors hover:text-foreground">
        <p>{title}</p>
        <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
      </div>
    )}
  </CollapsibleTrigger>
);

export type TaskContentProps = ComponentProps<typeof CollapsibleContent>;

export const TaskContent = ({ children, className, ...props }: TaskContentProps) => (
  <CollapsibleContent
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=open]:[--tw-ease:var(--ease-entrance)] data-[state=closed]:[--tw-ease:var(--ease-exit)]",
      className,
    )}
    {...props}
  >
    <AgentTimeline className="mt-4">{children}</AgentTimeline>
  </CollapsibleContent>
);
