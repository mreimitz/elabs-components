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
    VariantProps<typeof progressIndicatorVariants> {
  /**
   * Reference point (0–100, same scale as `value`) — e.g. an "expected by
   * today" pace or a target — rendered as a thin vertical tick on the track.
   * Unset (default) renders no tick and leaves the DOM/layout byte-identical
   * to a marker-less `Progress`.
   */
  marker?: number;
  /**
   * What `marker` represents (already localized by the caller — e.g.
   * `"expected 70% by today"`). When set, it is appended to the progress
   * bar's accessible value text so assistive tech hears the reference point
   * alongside the value; a caller-supplied `aria-valuetext` always wins over
   * this composition. When `marker` is set but `markerLabel` is not, the
   * tick is purely decorative and `aria-valuetext` is left untouched — this
   * component never invents its own English copy (i18n-strings).
   */
  markerLabel?: string;
}

/**
 * Color must not be the only signal a guardrail tripped: set `aria-valuetext`
 * (e.g. `"Exceeded — 120 of 100"`) alongside a non-`default` `variant` — it
 * passes straight through to the underlying `role="progressbar"` element via
 * `...props` (Radix's `ProgressPrimitive.Root` already supports it).
 */
export const Progress = forwardRef<ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  function Progress(
    { className, value, variant, marker, markerLabel, "aria-valuetext": ariaValuetext, ...props },
    ref,
  ) {
    const hasMarker = typeof marker === "number" && Number.isFinite(marker);
    const clampedMarker = hasMarker ? Math.min(100, Math.max(0, marker as number)) : undefined;
    // No invented English glue words (i18n-strings) — just the numeric value
    // plus the caller's own, already-localized `markerLabel`. A caller's own
    // `aria-valuetext` always wins and is never overwritten.
    const resolvedValuetext =
      ariaValuetext ??
      (hasMarker && markerLabel && typeof value === "number"
        ? `${Math.round(value)}%, ${markerLabel}`
        : undefined);

    const root = (
      <ProgressPrimitive.Root
        ref={ref}
        data-slot="progress"
        value={value}
        aria-valuetext={resolvedValuetext}
        className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
        {...props}
      >
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className={progressIndicatorVariants({ variant })}
          style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
      </ProgressPrimitive.Root>
    );

    if (!hasMarker) {
      return root;
    }

    return (
      // Root keeps `overflow-hidden` (clips the indicator fill, unchanged
      // above); the tick lives OUTSIDE it as a sibling so it is never
      // clipped. The wrapper mirrors `className` so it matches the track's
      // own box exactly (width/height/flex sizing), which is what the
      // tick's `insetInlineStart` percentage is measured against.
      <div className={cn("relative", className)}>
        {root}
        <span
          aria-hidden={markerLabel ? undefined : "true"}
          className="pointer-events-none absolute -top-0.5 -bottom-0.5 w-0.5 bg-foreground"
          data-slot="progress-marker"
          style={{ insetInlineStart: `${clampedMarker}%` }}
        />
      </div>
    );
  },
);
