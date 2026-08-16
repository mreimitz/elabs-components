"use client";

import { Alert, AlertDescription, AlertTitle, StatusBadge } from "@elabs/components-ui";
import { Button } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
import type { ToolUIPart } from "ai";
import type { ComponentProps, ReactNode } from "react";
import { createContext, useContext, useId, useMemo } from "react";

type ToolUIPartApproval =
  | {
      id: string;
      approved?: never;
      reason?: never;
    }
  | {
      id: string;
      approved: boolean;
      reason?: string;
    }
  | {
      id: string;
      approved: true;
      reason?: string;
    }
  | {
      id: string;
      approved: false;
      reason?: string;
    }
  | undefined;

interface ConfirmationContextValue {
  approval: ToolUIPartApproval;
  state: ToolUIPart["state"];
  /** Default id wired from the card's `aria-labelledby` to `ConfirmationTitle`. */
  titleId: string;
}

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null);

const useConfirmation = () => {
  const context = useContext(ConfirmationContext);

  if (!context) {
    throw new Error("Confirmation components must be used within Confirmation");
  }

  return context;
};

export type ConfirmationProps = ComponentProps<typeof Alert> & {
  approval?: ToolUIPartApproval;
  state: ToolUIPart["state"];
};

export const Confirmation = ({
  className,
  approval,
  state,
  variant,
  role,
  children,
  ...props
}: ConfirmationProps) => {
  const titleId = useId();
  const contextValue = useMemo(() => ({ approval, state, titleId }), [approval, state, titleId]);

  if (!approval || state === "input-streaming" || state === "input-available") {
    return null;
  }

  const isResolved =
    state === "approval-responded" || state === "output-denied" || state === "output-available";
  const isPending = state === "approval-requested";
  const approved = isResolved ? approval.approved : undefined;

  // QUIET-RAIL treatment (supersedes research-11's warning/status WASH — a
  // deliberate design-authority decision to drop the filled "AI card" look):
  // a neutral card ground (Alert variant="default") + ONE accent rail encoding
  // the outcome, plus the StatusBadge (icon + label, never color alone). The
  // rails are hue-independent enough to stay legible in blueprint / high-contrast.
  // A caller-supplied `variant` still wins (escape hatch).
  const railClass =
    approved === true
      ? "border-s-success"
      : approved === false
        ? "border-s-destructive"
        : isPending
          ? "border-s-border-strong"
          : "border-s-border";

  return (
    <ConfirmationContext.Provider value={contextValue}>
      <Alert
        variant={variant ?? "default"}
        // A pending decision containing focusable controls is a labelled
        // region, NOT an assertive live region (research 11 §B.3): pending =
        // role="group" + aria-labelledby; resolved keeps role="alert".
        role={role ?? (isPending ? "group" : "alert")}
        aria-labelledby={isPending ? titleId : undefined}
        className={cn(
          "flex flex-col gap-2 border-s-4 transition-colors duration-fast",
          railClass,
          isPending && "shadow-sm",
          className,
        )}
        {...props}
      >
        {/* The status line is the canonical StatusBadge (#189, research 10 §B.1). */}
        {approved === true ? (
          <StatusBadge
            className="animate-in fade-in-0 self-start duration-base ease-entrance"
            status="complete"
          >
            Approved
          </StatusBadge>
        ) : null}
        {approved === false ? (
          <StatusBadge
            className="animate-in fade-in-0 self-start duration-base ease-entrance"
            status="denied"
          >
            Denied
          </StatusBadge>
        ) : null}
        {children}
      </Alert>
    </ConfirmationContext.Provider>
  );
};

export type ConfirmationTitleProps = ComponentProps<typeof AlertTitle>;

/**
 * The question zone (research 11 §B.3 APPROVE-3) — out-ranks the surrounding
 * `text-body` and names the pending region via the card's `aria-labelledby`.
 */
export const ConfirmationTitle = ({ className, id, ...props }: ConfirmationTitleProps) => {
  const { titleId } = useConfirmation();
  return <AlertTitle id={id ?? titleId} className={cn("text-subtitle", className)} {...props} />;
};

export type ConfirmationDescriptionProps = ComponentProps<typeof AlertDescription>;

/** The consequence zone — what approving will actually do (research 11 §B.3). */
export const ConfirmationDescription = ({ className, ...props }: ConfirmationDescriptionProps) => (
  <AlertDescription className={cn("text-body text-muted-foreground", className)} {...props} />
);

export interface ConfirmationRequestProps {
  children?: ReactNode;
}

export const ConfirmationRequest = ({ children }: ConfirmationRequestProps) => {
  const { state } = useConfirmation();

  // Only show when approval is requested
  if (state !== "approval-requested") {
    return null;
  }

  return children;
};

export interface ConfirmationAcceptedProps {
  children?: ReactNode;
}

export const ConfirmationAccepted = ({ children }: ConfirmationAcceptedProps) => {
  const { approval, state } = useConfirmation();

  // Only show when approved and in response states
  if (
    !approval?.approved ||
    (state !== "approval-responded" && state !== "output-denied" && state !== "output-available")
  ) {
    return null;
  }

  return children;
};

export interface ConfirmationRejectedProps {
  children?: ReactNode;
}

export const ConfirmationRejected = ({ children }: ConfirmationRejectedProps) => {
  const { approval, state } = useConfirmation();

  // Only show when rejected and in response states
  if (
    approval?.approved !== false ||
    (state !== "approval-responded" && state !== "output-denied" && state !== "output-available")
  ) {
    return null;
  }

  return children;
};

export type ConfirmationActionsProps = ComponentProps<"div">;

export const ConfirmationActions = ({ className, ...props }: ConfirmationActionsProps) => {
  const { state } = useConfirmation();

  // Only show when approval is requested
  if (state !== "approval-requested") {
    return null;
  }

  return (
    <div
      className={cn(
        // The action band (research 11 §B.3 APPROVE-3): the divider is the SOLE
        // cue between consequence and buttons, so `border-strong` is correct.
        "flex w-full items-center justify-end gap-2 border-t border-border-strong pt-3",
        className,
      )}
      {...props}
    />
  );
};

export type ConfirmationActionProps = ComponentProps<typeof Button>;

export const ConfirmationAction = ({ className, ...props }: ConfirmationActionProps) => (
  <Button className={cn("h-8 px-3 text-sm", className)} type="button" {...props} />
);

export type ConfirmationApproveProps = ConfirmationActionProps;

/**
 * The proceed action — presets the filled primary variant (research 11 §B.3
 * APPROVE-2). Role-named so the primary path cannot drift to `outline`.
 */
export const ConfirmationApprove = (props: ConfirmationApproveProps) => (
  <ConfirmationAction variant="default" {...props} />
);

export type ConfirmationDenyProps = ConfirmationActionProps;

/** The decline action — presets the quiet `ghost` variant, never `outline`. */
export const ConfirmationDeny = (props: ConfirmationDenyProps) => (
  <ConfirmationAction variant="ghost" {...props} />
);

/*
 * ApprovalCard — the promoted, semantically-named front door for the approval
 * interaction (research 11 §B.3). Same components, clearer name; the
 * `Confirmation*` exports stay for the AI-Elements-shaped API (non-breaking).
 * New code reaches for `ApprovalCard`.
 */
export const ApprovalCard = Confirmation;
export type ApprovalCardProps = ConfirmationProps;
export const ApprovalCardTitle = ConfirmationTitle;
export type ApprovalCardTitleProps = ConfirmationTitleProps;
export const ApprovalCardDescription = ConfirmationDescription;
export type ApprovalCardDescriptionProps = ConfirmationDescriptionProps;
export const ApprovalCardRequest = ConfirmationRequest;
export type ApprovalCardRequestProps = ConfirmationRequestProps;
export const ApprovalCardAccepted = ConfirmationAccepted;
export type ApprovalCardAcceptedProps = ConfirmationAcceptedProps;
export const ApprovalCardRejected = ConfirmationRejected;
export type ApprovalCardRejectedProps = ConfirmationRejectedProps;
export const ApprovalCardActions = ConfirmationActions;
export type ApprovalCardActionsProps = ConfirmationActionsProps;
export const ApprovalCardAction = ConfirmationAction;
export type ApprovalCardActionProps = ConfirmationActionProps;
export const ApprovalCardApprove = ConfirmationApprove;
export type ApprovalCardApproveProps = ConfirmationApproveProps;
export const ApprovalCardDeny = ConfirmationDeny;
export type ApprovalCardDenyProps = ConfirmationDenyProps;
