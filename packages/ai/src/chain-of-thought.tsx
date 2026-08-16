"use client";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { Badge, type Status } from "@elabs-ai/components-ui";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { ComponentProps } from "react";
import { createContext, memo, useContext, useMemo } from "react";

import { AgentStep, AgentTimeline, type AgentStepProps } from "./agent-timeline";

interface ChainOfThoughtContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue | null>(null);

const useChainOfThought = () => {
  const context = useContext(ChainOfThoughtContext);
  if (!context) {
    throw new Error("ChainOfThought components must be used within ChainOfThought");
  }
  return context;
};

export type ChainOfThoughtProps = ComponentProps<"div"> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const ChainOfThought = memo(
  ({
    className,
    open,
    defaultOpen = false,
    onOpenChange,
    children,
    ...props
  }: ChainOfThoughtProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      defaultProp: defaultOpen,
      onChange: onOpenChange,
      prop: open,
    });

    const chainOfThoughtContext = useMemo(() => ({ isOpen, setIsOpen }), [isOpen, setIsOpen]);

    return (
      <ChainOfThoughtContext.Provider value={chainOfThoughtContext}>
        <div className={cn("not-prose w-full space-y-4", className)} {...props}>
          {children}
        </div>
      </ChainOfThoughtContext.Provider>
    );
  },
);

export type ChainOfThoughtHeaderProps = ComponentProps<typeof CollapsibleTrigger>;

export const ChainOfThoughtHeader = memo(
  ({ className, children, ...props }: ChainOfThoughtHeaderProps) => {
    const { isOpen, setIsOpen } = useChainOfThought();

    return (
      <Collapsible onOpenChange={setIsOpen} open={isOpen}>
        <CollapsibleTrigger
          className={cn(
            "flex w-full items-center gap-2 text-body text-muted-foreground transition-colors hover:text-foreground",
            className,
          )}
          {...props}
        >
          <BrainIcon className="size-4" />
          <span className="flex-1 text-start">{children ?? "Chain of Thought"}</span>
          <ChevronDownIcon
            className={cn("size-4 transition-transform", isOpen ? "rotate-180" : "rotate-0")}
          />
        </CollapsibleTrigger>
      </Collapsible>
    );
  },
);

export type ChainOfThoughtStepProps = Omit<
  AgentStepProps,
  "name" | "summary" | "status" | "hideBadge"
> & {
  label: ReactNode;
  description?: ReactNode;
  status?: "complete" | "active" | "pending";
};

/**
 * Step status → the canonical 7-state vocabulary (#189, research 10 §B.1):
 * `active` is a running step.
 */
const stepStatusToCanonical: Record<NonNullable<ChainOfThoughtStepProps["status"]>, Status> = {
  active: "running",
  complete: "complete",
  pending: "pending",
};

/**
 * @deprecated Compose `AgentStep` (agent-timeline.tsx) directly. Since #192
 * this is a thin alias mapping the legacy `label`/`description`/3-state
 * `status` props onto the canonical rail (`AgentTimeline` + `AgentStep`); the
 * pre-#192 hand-rolled connector + text-opacity status idiom is gone
 * (research 10 §B.3). The badge stays hidden here — the rail node carries the
 * status — keeping the quiet prose-rail look.
 */
export const ChainOfThoughtStep = memo(
  ({ label, description, status = "complete", ...props }: ChainOfThoughtStepProps) => (
    <AgentStep
      hideBadge
      name={label}
      status={stepStatusToCanonical[status]}
      summary={description}
      {...props}
    />
  ),
);

export type ChainOfThoughtSearchResultsProps = ComponentProps<"div">;

export const ChainOfThoughtSearchResults = memo(
  ({ className, ...props }: ChainOfThoughtSearchResultsProps) => (
    <div className={cn("flex flex-wrap items-center gap-2", className)} {...props} />
  ),
);

export type ChainOfThoughtSearchResultProps = ComponentProps<typeof Badge>;

export const ChainOfThoughtSearchResult = memo(
  ({ className, children, ...props }: ChainOfThoughtSearchResultProps) => (
    <Badge
      className={cn("gap-1 px-2 py-0.5 text-meta font-normal", className)}
      variant="secondary"
      {...props}
    >
      {children}
    </Badge>
  ),
);

export type ChainOfThoughtContentProps = ComponentProps<typeof CollapsibleContent>;

export const ChainOfThoughtContent = memo(
  ({ className, children, ...props }: ChainOfThoughtContentProps) => {
    const { isOpen } = useChainOfThought();

    return (
      <Collapsible open={isOpen}>
        <CollapsibleContent
          className={cn(
            "mt-2 space-y-3",
            "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=open]:[--tw-ease:var(--ease-entrance)] data-[state=closed]:[--tw-ease:var(--ease-exit)]",
            className,
          )}
          {...props}
        >
          <AgentTimeline>{children}</AgentTimeline>
        </CollapsibleContent>
      </Collapsible>
    );
  },
);

export type ChainOfThoughtImageProps = ComponentProps<"div"> & {
  caption?: string;
};

export const ChainOfThoughtImage = memo(
  ({ className, children, caption, ...props }: ChainOfThoughtImageProps) => (
    <div className={cn("mt-2 space-y-2", className)} {...props}>
      <div className="relative flex max-h-[22rem] items-center justify-center overflow-hidden rounded-lg bg-muted p-3">
        {children}
      </div>
      {caption && <p className="text-meta text-muted-foreground">{caption}</p>}
    </div>
  ),
);

ChainOfThought.displayName = "ChainOfThought";
ChainOfThoughtHeader.displayName = "ChainOfThoughtHeader";
ChainOfThoughtStep.displayName = "ChainOfThoughtStep";
ChainOfThoughtSearchResults.displayName = "ChainOfThoughtSearchResults";
ChainOfThoughtSearchResult.displayName = "ChainOfThoughtSearchResult";
ChainOfThoughtContent.displayName = "ChainOfThoughtContent";
ChainOfThoughtImage.displayName = "ChainOfThoughtImage";
