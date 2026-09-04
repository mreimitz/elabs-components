"use client";

import { useCallback, useState, type HTMLAttributes, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { Badge } from "../badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../collapsible";
import { useLocale } from "../locale-provider";

export interface AdvancedGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** The disclosure's label. Defaults to "Advanced". */
  title?: ReactNode;
  /**
   * What is hidden inside, shown ONLY while collapsed — so a reader can tell
   * whether the group holds defaults or edits without opening it.
   */
  summary?: ReactNode;
  /** Shorthand summary: renders "N changed" when `summary` is not given. */
  changedCount?: number;
  /** Uncontrolled initial state. Collapsed by default — that is the point. */
  defaultOpen?: boolean;
  /** Controlled open state. */
  open?: boolean;
  /** Fires on every open/close, controlled or not. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * A collapsed-by-default group of secondary settings (#341).
 *
 * Long dialogs go wrong in one of two ways: everything is visible (so nothing
 * reads as primary), or the extras are hidden with no hint that they were
 * touched. `AdvancedGroup` takes the third option — hidden, but SUMMARISED:
 * while collapsed it shows what is inside ("3 changed"), and the summary
 * disappears once the group is open and the values speak for themselves.
 *
 * A preset over `Collapsible`, not a new disclosure primitive: Radix keeps the
 * trigger/content wiring, `aria-expanded`, and keyboard operation.
 *
 * ```tsx
 * <AdvancedGroup changedCount={3}>
 *   <Field … />
 * </AdvancedGroup>
 * ```
 */
export function AdvancedGroup({
  className,
  title,
  summary,
  changedCount,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  children,
  ...props
}: AdvancedGroupProps) {
  const { t } = useLocale();
  // Mirror the platform: the mode is fixed at mount by whether `open` was
  // passed, and never flips (`.claude/rules/component-api.md`).
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = isControlled ? openProp : uncontrolledOpen;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const summaryContent =
    summary ??
    (changedCount !== undefined && changedCount > 0 ? (
      <Badge variant="secondary">{t("ui.advancedGroup.changed", { count: changedCount })}</Badge>
    ) : null);

  return (
    <Collapsible
      data-slot="advanced-group"
      open={open}
      onOpenChange={handleOpenChange}
      className={cn("flex flex-col", className)}
      {...props}
    >
      <CollapsibleTrigger
        data-slot="advanced-group-trigger"
        className="group -mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-body font-medium hover:bg-accent hover:text-accent-foreground focus-ring"
      >
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-base ease-standard motion-reduce:transition-none group-data-[state=closed]:-rotate-90"
        />
        {title ?? t("ui.advancedGroup.title")}
        {/* The summary is a COLLAPSED-state affordance: once the group is open
            the real values are on screen and repeating "3 changed" is noise. */}
        {!open && summaryContent ? (
          <span
            data-slot="advanced-group-summary"
            className="ms-auto text-caption font-normal text-muted-foreground"
          >
            {summaryContent}
          </span>
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent data-slot="advanced-group-content">
        <div className="flex flex-col gap-4 pt-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
