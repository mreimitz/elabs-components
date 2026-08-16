"use client";

/**
 * MessageFeedback — thumbs up / down for a single assistant message.
 *
 * Presentational only: it emits `onSubmit({ type })` and reflects the chosen
 * state; it does NOT persist anything (the host owns storage). After a choice
 * the buttons auto-disable (feedback is submit-once) and the root carries
 * `data-submitted` + `data-feedback`. Controlled (`value`) or uncontrolled.
 */

import { forwardRef, useState, type HTMLAttributes } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { Button } from "@qlik-coe-emea/qlabs-components-ui";
import { cn } from "@qlik-coe-emea/qlabs-components-ui/lib/cn";
import { useLocale } from "@qlik-coe-emea/qlabs-components-ui";

export type FeedbackType = "positive" | "negative";

export const messageFeedbackVariants = cva("inline-flex items-center", {
  variants: {
    compact: { true: "gap-0.5", false: "gap-1" },
  },
  defaultVariants: { compact: false },
});

export interface MessageFeedbackProps
  extends
    Omit<HTMLAttributes<HTMLDivElement>, "onSubmit" | "defaultValue">,
    VariantProps<typeof messageFeedbackVariants> {
  /** Controlled selected feedback. When set, `onSubmit` is the only updater. */
  value?: FeedbackType | null;
  /** Uncontrolled initial selection. @default null */
  defaultValue?: FeedbackType | null;
  /** Called once with the chosen feedback. No persistence — host-owned. */
  onSubmit?: (feedback: { type: FeedbackType }) => void;
  /** Force-disable both controls (e.g. while the message is still streaming). */
  disabled?: boolean;
  /** aria-label for the positive control. @default "Good response" */
  positiveLabel?: string;
  /** aria-label for the negative control. @default "Bad response" */
  negativeLabel?: string;
}

/**
 * Two icon buttons. The chosen one stays prominent after submit; the other
 * recedes. `compact` tightens spacing/size for message toolbars.
 */
export const MessageFeedback = forwardRef<HTMLDivElement, MessageFeedbackProps>(
  function MessageFeedback(
    {
      value: valueProp,
      defaultValue = null,
      onSubmit,
      disabled = false,
      compact = false,
      positiveLabel = "Good response",
      negativeLabel = "Bad response",
      className,
      ...props
    },
    ref,
  ) {
    const { t } = useLocale();
    const isControlled = valueProp !== undefined;
    const [internal, setInternal] = useState<FeedbackType | null>(defaultValue);
    const selected = isControlled ? (valueProp as FeedbackType | null) : internal;
    const submitted = selected != null;

    const choose = (type: FeedbackType) => {
      if (submitted || disabled) return;
      if (!isControlled) setInternal(type);
      onSubmit?.({ type });
    };

    const compactBtn = compact ? "size-7 [&_svg]:size-3.5" : undefined;

    const renderButton = (type: FeedbackType, label: string, Icon: typeof ThumbsUp) => {
      const active = selected === type;
      return (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={active}
          // After submit both are inert; keep the chosen one at full opacity.
          disabled={disabled || submitted}
          onClick={() => choose(type)}
          className={cn(
            "text-muted-foreground hover:text-foreground",
            active && "text-primary disabled:opacity-100 [&_svg]:fill-current",
            compactBtn,
          )}
        >
          <Icon aria-hidden="true" />
        </Button>
      );
    };

    return (
      <div
        ref={ref}
        role="group"
        aria-label={t("ai.message.feedback")}
        data-submitted={submitted || undefined}
        data-feedback={selected ?? undefined}
        className={cn(messageFeedbackVariants({ compact }), className)}
        {...props}
      >
        {renderButton("positive", positiveLabel, ThumbsUp)}
        {renderButton("negative", negativeLabel, ThumbsDown)}
      </div>
    );
  },
);
