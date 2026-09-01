import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type ReactNode,
} from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import type { buttonVariants } from "../button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip";

/** The icon-only size axis (a deliberate subset of `buttonVariants`' `size`). */
export type IconButtonSize = "icon" | "icon-sm" | "icon-lg";

export interface IconButtonProps
  extends
    Omit<
      ButtonHTMLAttributes<HTMLButtonElement>,
      "title" | "children" | "aria-label" | "aria-describedby"
    >,
    Pick<VariantProps<typeof buttonVariants>, "variant"> {
  /**
   * Accessible name AND tooltip text — a single source of truth, so the two
   * can never drift out of sync (the failure this component exists to close:
   * `aria-label` and a tooltip's children set independently, most call sites
   * only setting one).
   */
  label: string;
  /** The glyph (typically a `lucide-react` element). */
  icon: ReactNode;
  /** Icon-only size axis. Default `"icon"`. */
  size?: IconButtonSize;
  /**
   * Shown appended to the tooltip text, and — independently — exposed via
   * `aria-describedby` through an `sr-only` node that is present whenever this
   * prop is (i.e. it does NOT depend on the tooltip being open, and it is not
   * rendered at all when there is no reason — so it can never be read as stray
   * text), so assistive tech gets the reason even while the button is disabled
   * (a disabled
   * `<button>` still exposes its ARIA attributes; it just isn't
   * focusable/hoverable itself, which is why the tooltip trigger wraps a
   * focusable `<span>` instead — see the render below).
   */
  disabledReason?: string;
  /** Tooltip placement. Default `"top"`. */
  side?: ComponentProps<typeof TooltipContent>["side"];
}

/**
 * A single affordance for an icon-only control: `label` becomes both the
 * `aria-label` and the tooltip text, so they cannot diverge. Composes
 * `Button` + `Tooltip` — it does not reimplement either.
 *
 * Deliberately has **no `asChild`**: accepting one would dissolve the button
 * into a Radix `Slot` and break the tooltip-trigger wrapper below. A
 * link-styled icon button should compose `Button asChild` + `Tooltip`
 * directly instead.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    label,
    icon,
    variant = "ghost",
    size = "icon",
    disabled,
    disabledReason,
    side = "top",
    className,
    ...props
  },
  ref,
) {
  const reasonId = useId();
  // The visible tooltip text always LEADS with `label` verbatim (never only
  // the reason), so it can never contradict the accessible name (WCAG 2.5.3
  // Label in Name) — the reason is appended context, not a replacement name.
  const tooltipText = disabledReason ? `${label} — ${disabledReason}` : label;

  return (
    // Self-provided so this works anywhere — a consumer shouldn't have to
    // remember to mount a global TooltipProvider for one icon button.
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {/*
           * A disabled `Button` carries `pointer-events-none`, so hover never
           * reaches it and the tooltip would never open. Wrap the trigger
           * around a plain <span> instead of the <button> itself: it stays
           * hoverable always, and gains `tabIndex={0}` only while the inner
           * control is disabled (and therefore removed from the tab order),
           * so keyboard users can still reach the tooltip without a doubled
           * stop when the button is enabled.
           */}
          <span
            data-slot="icon-button"
            tabIndex={disabled ? 0 : undefined}
            className={cn(
              "inline-flex rounded-md",
              // While disabled this span IS the focus target (the button is out
              // of the tab order), so it must carry the system's focus ring —
              // without this it falls back to the UA default outline, which is
              // a hardcoded browser blue identical in every theme.
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              disabled && "cursor-not-allowed",
            )}
          >
            <Button
              ref={ref}
              variant={variant}
              size={size}
              disabled={disabled}
              {...props}
              // Computed AFTER the spread so a stray `aria-label`/`aria-describedby`
              // in `...props` can never win over the derived, single-source-of-truth
              // values (the type above already excludes both, this is defense in
              // depth for untyped/JS callers).
              aria-label={label}
              aria-describedby={disabledReason ? reasonId : undefined}
              data-slot="icon-button-control"
              className={className}
            >
              {icon}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side={side} data-slot="icon-button-tooltip">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
      {disabledReason ? (
        <span id={reasonId} data-slot="icon-button-description" className="sr-only">
          {disabledReason}
        </span>
      ) : null}
    </TooltipProvider>
  );
});
