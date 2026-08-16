import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

/**
 * Tone vocabulary reused from `StatusBadge`/`Alert` (success/warning/destructive
 * on semantic tokens, #358) rather than reinvented. `default` keeps the fill
 * byte-identical (`bg-primary`) when `variant` is unset.
 */
export const progressIndicatorVariants = cva("size-full flex-1 transition-transform", {
  variants: {
    variant: {
      default: "bg-primary",
      success: "bg-success",
      warning: "bg-warning",
      destructive: "bg-destructive",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface ProgressProps
  extends
    ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressIndicatorVariants> {}

/**
 * Color must not be the only signal a guardrail tripped: set `aria-valuetext`
 * (e.g. `"Exceeded — 120 of 100"`) alongside a non-`default` `variant` — it
 * passes straight through to the underlying `role="progressbar"` element via
 * `...props` (Radix's `ProgressPrimitive.Root` already supports it).
 */
export const Progress = forwardRef<ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  function Progress({ className, value, variant, ...props }, ref) {
    return (
      <ProgressPrimitive.Root
        ref={ref}
        value={value}
        className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={progressIndicatorVariants({ variant })}
          style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
      </ProgressPrimitive.Root>
    );
  },
);
