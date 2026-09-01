"use client";

import { Button } from "@elabs-ai/components-ui";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@elabs-ai/components-ui";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@elabs-ai/components-ui";
import { StatusBadge, type StatusTone } from "@elabs-ai/components-ui";
import { useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { CheckCircle2, ChevronsUpDownIcon, Clock, PencilLine, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { createContext, useContext, useId, useMemo } from "react";

import { Shimmer } from "./shimmer";

/**
 * The plan's decision status (#108). Additive: a `Plan` rendered with no
 * `status` behaves exactly as before (no ARIA region, no rail, no status
 * line) — every prop below this point is opt-in.
 */
export type PlanStatus = "streaming" | "awaiting" | "approved" | "changes-requested";

interface PlanContextValue {
  isStreaming: boolean;
  /** `undefined` when the plan is rendered via the legacy `isStreaming`-only API. */
  status?: PlanStatus;
  /** Wired to `PlanTitle` so the awaiting region can be labelled by it. */
  titleId?: string;
}

const PlanContext = createContext<PlanContextValue | null>(null);

const usePlan = () => {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error("Plan components must be used within Plan");
  }
  return context;
};

export type PlanProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean;
  /**
   * The plan's decision status. Omit it to keep today's display-only
   * behaviour. When both `status` and `isStreaming` are given, `status`
   * wins (a `status="approved"` plan never shimmers, even if `isStreaming`
   * is still `true`).
   */
  status?: PlanStatus;
};

export const Plan = ({
  className,
  isStreaming = false,
  status,
  role,
  children,
  ...props
}: PlanProps) => {
  const titleId = useId();
  const hasStatus = status !== undefined;
  const resolvedIsStreaming = hasStatus ? status === "streaming" : isStreaming;

  // A pending decision containing focusable controls is a labelled region,
  // NOT an assertive live region; a settled outcome is `role="alert"` — the
  // same convention `Confirmation` already proves (packages/ai/src/confirmation.tsx:100-101).
  const isPending = status === "awaiting";
  const isSettled = status === "approved" || status === "changes-requested";
  const resolvedRole = hasStatus
    ? isPending
      ? "group"
      : isSettled
        ? "alert"
        : undefined
    : undefined;

  // Quiet structural rail per outcome — the outcome itself is always ALSO
  // carried in text + glyph via `PlanStatusLine` (WCAG 1.4.1), the rail is a
  // redundant, hue-independent cue on top of it.
  const railClass = !hasStatus
    ? undefined
    : status === "approved"
      ? "border-s-4 border-s-success"
      : status === "changes-requested"
        ? "border-s-4 border-s-warning"
        : isPending
          ? "border-s-4 border-s-border-strong"
          : undefined;

  const contextValue = useMemo<PlanContextValue>(
    () => ({
      isStreaming: resolvedIsStreaming,
      status: hasStatus ? status : undefined,
      titleId: hasStatus ? titleId : undefined,
    }),
    [resolvedIsStreaming, hasStatus, status, titleId],
  );

  return (
    <PlanContext.Provider value={contextValue}>
      <Collapsible asChild data-slot="plan" {...props}>
        <Card
          role={role ?? resolvedRole}
          aria-labelledby={isPending ? titleId : undefined}
          className={cn("shadow-none", railClass, className)}
        >
          {children}
        </Card>
      </Collapsible>
    </PlanContext.Provider>
  );
};

export type PlanHeaderProps = ComponentProps<typeof CardHeader>;

export const PlanHeader = ({ className, ...props }: PlanHeaderProps) => (
  <CardHeader
    className={cn("flex items-start justify-between", className)}
    data-slot="plan-header"
    {...props}
  />
);

export type PlanTitleProps = Omit<ComponentProps<typeof CardTitle>, "children"> & {
  children: string;
};

export const PlanTitle = ({ id, children, ...props }: PlanTitleProps) => {
  const { isStreaming, titleId } = usePlan();

  return (
    <CardTitle id={id ?? titleId} data-slot="plan-title" {...props}>
      {isStreaming ? <Shimmer>{children}</Shimmer> : children}
    </CardTitle>
  );
};

export type PlanDescriptionProps = Omit<ComponentProps<typeof CardDescription>, "children"> & {
  children: string;
};

export const PlanDescription = ({ className, children, ...props }: PlanDescriptionProps) => {
  const { isStreaming } = usePlan();

  return (
    <CardDescription
      className={cn("text-balance", className)}
      data-slot="plan-description"
      {...props}
    >
      {isStreaming ? <Shimmer>{children}</Shimmer> : children}
    </CardDescription>
  );
};

export type PlanActionProps = ComponentProps<typeof CardAction>;

/** The header's layout slot (e.g. a menu trigger) — unrelated to the decision actions below. */
export const PlanAction = (props: PlanActionProps) => (
  <CardAction data-slot="plan-action" {...props} />
);

export type PlanContentProps = ComponentProps<typeof CardContent>;

export const PlanContent = ({ className, ...props }: PlanContentProps) => (
  <CollapsibleContent asChild>
    <CardContent
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2 data-[state=closed]:fade-out-0 data-[state=open]:[--tw-ease:var(--ease-entrance)] data-[state=closed]:[--tw-ease:var(--ease-exit)] outline-none",
        className,
      )}
      data-slot="plan-content"
      {...props}
    />
  </CollapsibleContent>
);

export type PlanFooterProps = ComponentProps<"div">;

export const PlanFooter = (props: PlanFooterProps) => (
  <CardFooter data-slot="plan-footer" {...props} />
);

export type PlanTriggerProps = ComponentProps<typeof CollapsibleTrigger>;

export const PlanTrigger = ({ className, ...props }: PlanTriggerProps) => {
  const { t } = useLocale();
  return (
    <CollapsibleTrigger asChild>
      <Button
        className={cn("size-8", className)}
        data-slot="plan-trigger"
        size="icon"
        variant="ghost"
        {...props}
      >
        <ChevronsUpDownIcon className="size-4" />
        <span className="sr-only">{t("ai.plan.togglePlan")}</span>
      </Button>
    </CollapsibleTrigger>
  );
};

type PlanOutcomeStatus = Exclude<PlanStatus, "streaming">;

/**
 * Default label/tone/glyph per non-streaming status (#108). Every entry is a
 * CALM tone (the `StatusBadge` out-of-vocabulary escape hatch, #363) — the
 * decision is carried in text + glyph, never by rail colour alone (WCAG 1.4.1).
 */
const PLAN_STATUS_CONTENT: Record<
  PlanOutcomeStatus,
  { label: string; tone: StatusTone; icon: LucideIcon }
> = {
  awaiting: { label: "Waiting on plan approval", tone: "warning", icon: Clock },
  approved: { label: "Approved", tone: "success", icon: CheckCircle2 },
  "changes-requested": { label: "Changes requested", tone: "warning", icon: PencilLine },
};

export type PlanStatusLineProps = Omit<ComponentProps<typeof StatusBadge>, "status"> & {
  children?: ReactNode;
};

/**
 * The decision status line (#108) — text + glyph, never rail colour alone.
 * Renders nothing while `status` is unset or `"streaming"` (nothing has been
 * decided yet); shows the outcome once the plan is awaiting a decision or
 * settled.
 */
export const PlanStatusLine = ({ className, children, ...props }: PlanStatusLineProps) => {
  const { status } = usePlan();

  if (!status || status === "streaming") {
    return null;
  }

  const { label, tone, icon } = PLAN_STATUS_CONTENT[status];

  return (
    <StatusBadge
      data-slot="plan-status-line"
      className={cn("self-start", className)}
      status={{ label, tone, icon }}
      {...props}
    >
      {children}
    </StatusBadge>
  );
};

export type PlanDecisionActionProps = ComponentProps<typeof Button>;

/**
 * Shared decision-button primitive. Renders only while `status === "awaiting"`
 * — mirrors the gating `ConfirmationActions` uses (packages/ai/src/confirmation.tsx)
 * — so a settled or still-streaming plan never shows stale controls.
 */
const PlanDecisionAction = ({ className, ...props }: PlanDecisionActionProps) => {
  const { status } = usePlan();

  if (status !== "awaiting") {
    return null;
  }

  return <Button className={cn("h-8 px-3 text-body", className)} type="button" {...props} />;
};

export type PlanApproveProps = PlanDecisionActionProps;

/**
 * The proceed action — presets the filled primary variant so the primary path
 * can't drift to a quieter variant (same reasoning as `ConfirmationApprove`).
 */
export const PlanApprove = (props: PlanApproveProps) => (
  <PlanDecisionAction data-slot="plan-approve" variant="default" {...props} />
);

export type PlanRequestChangesProps = PlanDecisionActionProps;

/** Sends the plan back for revision — a quieter, non-primary action. */
export const PlanRequestChanges = (props: PlanRequestChangesProps) => (
  <PlanDecisionAction data-slot="plan-request-changes" variant="outline" {...props} />
);

export type PlanCommentProps = PlanDecisionActionProps;

/** Leaves feedback without settling the decision — the quietest action. */
export const PlanComment = (props: PlanCommentProps) => (
  <PlanDecisionAction data-slot="plan-comment" variant="ghost" {...props} />
);
