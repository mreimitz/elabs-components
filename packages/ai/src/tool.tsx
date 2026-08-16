"use client";

import { Skeleton, StatusBadge, useLocale, type Status } from "@elabs/components-ui";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { ChevronDownIcon, WrenchIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";

import { CodeBlock } from "./code-block";

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn("group not-prose mb-4 w-full rounded-md border", className)}
    {...props}
  />
);

export type ToolPart = ToolUIPart | DynamicToolUIPart;

export type ToolHeaderProps = {
  title?: string;
  /**
   * The business summary line ("3 documents found", "8 rows reconciled"),
   * shown beside the name + StatusBadge (#192, research 10 §B.5). Falls back
   * to nothing — the derived tool name still labels the row.
   */
  summary?: ReactNode;
  className?: string;
} & (
  | { type: ToolUIPart["type"]; state: ToolUIPart["state"]; toolName?: never }
  | {
      type: DynamicToolUIPart["type"];
      state: DynamicToolUIPart["state"];
      toolName: string;
    }
);

/**
 * Map the AI-SDK `ToolUIPart` 7-state machine onto the canonical `Status`
 * enum (#189, research 10 §B.1 mapping a). Lives here — not in `@elabs/components-ui` —
 * because it is typed against the SDK union; the `ai` import stays TYPES-ONLY
 * (D6, gate-enforced by `pnpm ai:types-only`).
 */
export const statusFromToolState = (state: ToolPart["state"]): Status => {
  switch (state) {
    case "input-streaming":
      return "pending";
    case "input-available":
      return "running";
    case "approval-requested":
      return "awaiting-approval";
    case "approval-responded":
      return "running";
    case "output-available":
      return "complete";
    case "output-denied":
      return "denied";
    case "output-error":
      return "failed";
  }
};

/** Same signature as before #189; renders the canonical StatusBadge. */
export const getStatusBadge = (status: ToolPart["state"]) => (
  <StatusBadge status={statusFromToolState(status)} />
);

export const ToolHeader = ({
  className,
  title,
  summary,
  type,
  state,
  toolName,
  ...props
}: ToolHeaderProps) => {
  const derivedName = type === "dynamic-tool" ? toolName : type.split("-").slice(1).join("-");

  return (
    <CollapsibleTrigger
      className={cn("flex w-full items-center justify-between gap-4 p-3", className)}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2">
        <WrenchIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="shrink-0 text-body font-medium">{title ?? derivedName}</span>
        {getStatusBadge(state)}
        {summary ? (
          <span className="truncate text-meta text-muted-foreground">{summary}</span>
        ) : null}
      </div>
      <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 space-y-4 p-4 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=open]:[--tw-ease:var(--ease-entrance)] data-[state=closed]:[--tw-ease:var(--ease-exit)]",
      className,
    )}
    {...props}
  />
);

export type ToolDetailsProps = ComponentProps<typeof Collapsible> & {
  /** The disclosure label. */
  label?: ReactNode;
};

/**
 * The technical view, behind disclosure — the PACKAGE DEFAULT for tool JSON
 * (#192, research 10 §B.5): a nested collapsible, COLLAPSED by default,
 * holding `ToolInput`/`ToolOutput`. The header carries the business `summary`;
 * the raw payload is one expand away, never the headline.
 */
export const ToolDetails = ({
  className,
  label = "Show technical details",
  defaultOpen = false,
  children,
  ...props
}: ToolDetailsProps) => (
  <Collapsible
    className={cn("group/tool-details not-prose", className)}
    defaultOpen={defaultOpen}
    {...props}
  >
    <CollapsibleTrigger className="flex items-center gap-1 rounded-sm text-meta text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <ChevronDownIcon className="size-3.5 transition-transform group-data-[state=open]/tool-details:rotate-180" />
      {label}
    </CollapsibleTrigger>
    <CollapsibleContent className="mt-3 space-y-4">{children}</CollapsibleContent>
  </Collapsible>
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  <div className={cn("space-y-2 overflow-hidden", className)} {...props}>
    <h4 className="text-meta uppercase text-muted-foreground">Parameters</h4>
    <div className="rounded-md bg-muted/50">
      <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
    </div>
  </div>
);

export type ToolOutputProps = ComponentProps<"div"> & {
  /**
   * The tool result. Objects/strings render as JSON inside the technical view.
   *
   * @deprecated Passing a pre-rendered **React element** here (the "rich
   * output under a muted Result heading" path) is deprecated since #192
   * (research 10 §B.5): a produced artifact is the HEADLINE, not a technical
   * detail — host it in a `<ToolResultCard>` and keep `ToolOutput` for the
   * JSON payload behind `<ToolDetails>`. The element path still renders for
   * existing consumers (e.g. the copy-owned `ai-chart` registry block) but
   * will be removed in a future release.
   */
  output: ToolPart["output"];
  errorText: ToolPart["errorText"];
  /**
   * The call has not produced output yet (loading-states.md `isStreaming`) —
   * derive it from the existing `statusFromToolState(state)` mapping
   * (`"input-streaming"`/`"input-available"` → not yet `"complete"`/`"failed"`)
   * rather than a second source of truth. While true and no `output`/
   * `errorText` has arrived, renders a layout-shaped skeleton in the Result
   * slot instead of `null`, so the technical view reserves its space. A
   * still-running call is never a terminal failure — the error branch is
   * suppressed while `isStreaming` per the loading-states.md error rule, even
   * if a stale `errorText` is still set from a previous render.
   * @default false
   */
  isStreaming?: boolean;
};

export const ToolOutput = ({
  className,
  output,
  errorText,
  isStreaming = false,
  ...props
}: ToolOutputProps) => {
  const { t } = useLocale();

  if (!(output || errorText || isStreaming)) {
    return null;
  }

  const showError = !isStreaming && Boolean(errorText);
  const pending = isStreaming && !output && !errorText;

  let Output = <div>{output as ReactNode}</div>;

  if (typeof output === "object" && !isValidElement(output)) {
    Output = <CodeBlock code={JSON.stringify(output, null, 2)} language="json" />;
  } else if (typeof output === "string") {
    Output = <CodeBlock code={output} language="json" />;
  }

  return (
    <div className={cn("space-y-2", className)} {...props}>
      <h4 className="text-meta uppercase text-muted-foreground">
        {showError ? "Error" : "Result"}
      </h4>
      {pending ? (
        <div className="space-y-2 rounded-md bg-muted/50 p-3" role="status" aria-live="polite">
          <span className="sr-only">{t("loading")}</span>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : (
        <div
          className={cn(
            "overflow-x-auto rounded-md text-caption [&_table]:w-full",
            showError ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-foreground",
          )}
        >
          {showError && <div>{errorText}</div>}
          {Output}
        </div>
      )}
    </div>
  );
};
