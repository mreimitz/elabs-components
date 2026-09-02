"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  APPROVAL_SCOPE_DESCRIPTION_KEYS,
  Kbd,
  Label,
  RadioGroup,
  RadioGroupItem,
  StatusBadge,
  Textarea,
  useLocale,
  type ApprovalOption,
} from "@elabs-ai/components-ui";
import { Button } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { ToolUIPart } from "ai";
import type { ComponentProps, ReactNode } from "react";
import { createContext, forwardRef, useContext, useId, useMemo, useState } from "react";

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
  /**
   * Shared draft reason text (#103) — written by `ApprovalCardReason`, read by
   * `ApprovalCardOptions` at the moment a decision commits, so a typed
   * explanation reaches `onConfirm`'s second argument without threading a
   * prop between two sibling compound parts. Unused by the pre-existing
   * binary `Confirmation*` parts, so their rendered output is unaffected.
   */
  reason: string;
  setReason: (reason: string) => void;
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
  const [reason, setReason] = useState("");
  const contextValue = useMemo(
    () => ({ approval, state, titleId, reason, setReason }),
    [approval, state, titleId, reason],
  );

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
  // rails are hue-independent enough to stay legible at high decoration / high-contrast.
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
 *
 * The `Confirmation*` family below is CLOSED — frozen at exactly the ten
 * names aliased here. New parts (#103 and beyond) are declared as real
 * `ApprovalCard*` implementations, never added to this alias block. See
 * `docs/decisions/2026-09-01-brainless-adoption-architecture.md` § 4 and the
 * `FROZEN_CONFIRMATION_EXPORTS` lock in `confirmation.test.tsx`.
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

/*
 * ---------------------------------------------------------------------------
 * N-option, scoped approval (#103)
 * ---------------------------------------------------------------------------
 * Real coding-agent permission prompts are rarely a plain yes/no — they ask
 * an N-option question whose options encode SCOPE: "Yes", "Yes, and don't ask
 * again this session", "No, and tell the agent what to do instead". The
 * binary `Confirmation`/`ApprovalCard` pair above cannot express the middle
 * option; these three parts extend it additively, composed as CHILDREN of the
 * existing card (`ApprovalCard` / `ApprovalCardRequest`), never as a
 * replacement for it. Every new export here is a real `ApprovalCard*`
 * implementation — see the closed-family note above the alias block.
 *
 * Vocabulary note: this is the PER-CALL decision surface ("may I run this
 * command?"). `PermissionModeSelect` (#104) is the separate, standing POLICY
 * surface ("how much may you do without asking?") — the two compose rather
 * than merge into one boolean-flagged component, per
 * `.claude/rules/component-api.md` ("Avoid boolean-prop proliferation").
 */

/**
 * `ApprovalScope`, `ApprovalOption` and `APPROVAL_SCOPE_DESCRIPTION_KEYS`
 * moved to `@elabs-ai/components-ui` (`lib/approval-option.ts`) — the
 * terminal CLI look-alike family's own permission row (issue #117) reuses
 * the same model, and `@elabs-ai/components-ai`/`@elabs-ai/components-terminal`
 * are layer-2 DAG siblings that may not import each other (T0; see
 * docs/decisions/2026-09-01-brainless-adoption-architecture.md § 4). Imported
 * above.
 */

export interface ApprovalCardOptionsProps extends ComponentProps<"div"> {
  options: ApprovalOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /**
   * Fires when an option is selected — by click, or by ANY keyboard move
   * within the radio group (Home/End/arrow keys select immediately, per the
   * native/ARIA radiogroup pattern Radix implements; there is no separate
   * "highlight vs commit" step). Reports the full resolved `ApprovalOption`
   * plus whatever reason text is currently held by a sibling
   * `ApprovalCardReason` — type a reason BEFORE choosing an option to have it
   * included in this call.
   */
  onConfirm?: (option: ApprovalOption, reason?: string) => void;
}

/**
 * ApprovalCardOptions — the N-option, scoped decision (#103). Renders through
 * `@elabs-ai/components-ui`'s `RadioGroup` (Radix) for roving focus, arrow-key
 * wrap, Home/End and announcement — never a hand-rolled
 * `parentElement.children[i]` focus walk. Composed inside `ApprovalCardRequest`,
 * alongside the existing `ApprovalCardTitle`/`ApprovalCardDescription`.
 */
export const ApprovalCardOptions = forwardRef<HTMLDivElement, ApprovalCardOptionsProps>(
  function ApprovalCardOptions(
    {
      options,
      value,
      defaultValue,
      onValueChange,
      onConfirm,
      className,
      dir,
      "aria-labelledby": ariaLabelledBy,
      ...props
    },
    ref,
  ) {
    const { t } = useLocale();
    const { titleId, reason } = useConfirmation();
    const baseId = useId();

    // Controlled/uncontrolled mirrors the platform (and `PermissionModeSelect`,
    // #104): `value`/`onValueChange` for a controlled caller, `defaultValue`
    // for an uncontrolled starting point — Radix's own `RadioGroup` already
    // implements both correctly. Hand-rolling a parallel `internalValue`
    // state here and always passing a (possibly `undefined`) `value` down
    // makes Radix's controllable-state hook see a spurious
    // uncontrolled-to-controlled transition the first time a selection is
    // made, which is exactly the warning this avoids.
    const handleValueChange = (id: string) => {
      onValueChange?.(id);
      const option = options.find((candidate) => candidate.id === id);
      if (option) onConfirm?.(option, reason.trim() ? reason : undefined);
    };

    return (
      <RadioGroup
        ref={ref}
        // `dir` on a plain <div> is a free-form HTML string; Radix's
        // RadioGroup narrows it to "ltr" | "rtl". Cast at this single call
        // site, matching `PermissionModeSelect` (#104), rather than widening
        // (and so weakening) the public prop type.
        dir={dir as "ltr" | "rtl" | undefined}
        defaultValue={defaultValue}
        value={value}
        onValueChange={handleValueChange}
        aria-labelledby={ariaLabelledBy ?? titleId}
        data-slot="approval-card-options"
        className={cn("grid gap-2", className)}
        {...props}
      >
        {options.map((option) => {
          const itemId = `${baseId}-${option.id}`;
          const descriptionId = `${itemId}-description`;
          const description =
            option.description ?? t(APPROVAL_SCOPE_DESCRIPTION_KEYS[option.scope]);

          return (
            <div
              key={option.id}
              data-slot="approval-card-option"
              data-scope={option.scope}
              className={cn(
                "flex items-start gap-3 rounded-lg border border-border bg-card p-3",
                "has-[[data-state=checked]]:border-primary",
              )}
            >
              <RadioGroupItem
                aria-describedby={descriptionId}
                className="mt-1"
                data-slot="approval-card-option-input"
                id={itemId}
                value={option.id}
              />
              <div className="grid flex-1 gap-1">
                <div className="flex items-center justify-between gap-2">
                  <Label
                    className="text-body flex items-center gap-2 font-medium"
                    data-slot="approval-card-option-label"
                    htmlFor={itemId}
                  >
                    {option.label}
                  </Label>
                  {option.keyHint ? (
                    <Kbd data-slot="approval-card-option-key-hint">{option.keyHint}</Kbd>
                  ) : null}
                </div>
                <p
                  className="text-meta text-muted-foreground"
                  data-slot="approval-card-option-description"
                  id={descriptionId}
                >
                  {description}
                </p>
              </div>
            </div>
          );
        })}
      </RadioGroup>
    );
  },
);

ApprovalCardOptions.displayName = "ApprovalCardOptions";

export type ApprovalCardTargetProps = ComponentProps<"div">;

/**
 * ApprovalCardTarget — the preview slot for WHAT is being approved: a
 * command, a path, or a richer node such as a `DiffView` (#102). Accepts
 * arbitrary children — this file never imports `DiffView`, the composition
 * happens entirely in the consumer's tree. Ungated by state (unlike
 * `ApprovalCardRequest`/`Accepted`/`Rejected`): the subject of a decision
 * stays visible after it resolves, not only while pending.
 */
export const ApprovalCardTarget = forwardRef<HTMLDivElement, ApprovalCardTargetProps>(
  function ApprovalCardTarget({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="approval-card-target"
        className={cn("text-body rounded-md bg-muted/50 p-3", className)}
        {...props}
      />
    );
  },
);

ApprovalCardTarget.displayName = "ApprovalCardTarget";

export type ApprovalCardReasonProps = Omit<
  ComponentProps<typeof Textarea>,
  "value" | "defaultValue" | "onChange"
>;

/**
 * ApprovalCardReason — the deny-with-reason input, wired to the `reason`
 * field that already exists on `ToolUIPartApproval` and was previously
 * unreachable from the UI. Shares its value with `ApprovalCardOptions`
 * through `Confirmation`'s own context (not a prop threaded between the two
 * sibling parts) — type here BEFORE choosing an option to have the text
 * included in that option's `onConfirm` call.
 */
export const ApprovalCardReason = forwardRef<HTMLTextAreaElement, ApprovalCardReasonProps>(
  function ApprovalCardReason({ className, id, placeholder, ...props }, ref) {
    const { t } = useLocale();
    const { reason, setReason } = useConfirmation();
    const generatedId = useId();
    const textareaId = id ?? generatedId;

    return (
      <div className="grid gap-1.5" data-slot="approval-card-reason">
        <Label
          className="text-meta text-muted-foreground"
          data-slot="approval-card-reason-label"
          htmlFor={textareaId}
        >
          {t("ai.approvalCard.reasonLabel")}
        </Label>
        <Textarea
          ref={ref}
          id={textareaId}
          placeholder={placeholder ?? t("ai.approvalCard.reasonPlaceholder")}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          data-slot="approval-card-reason-input"
          className={cn("min-h-16 text-body", className)}
          {...props}
        />
      </div>
    );
  },
);

ApprovalCardReason.displayName = "ApprovalCardReason";
