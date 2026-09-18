"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

/**
 * Meter — a word-sized read-only quantity: a confidence, a share of a
 * ceiling, "4 of 5 signals held".
 *
 * NOT a `Progress` (dedupe audit, 2026-09-18): `Progress` is a
 * `role="progressbar"` — assistive tech announces it as a task in flight and
 * it is block-level by design. A meter is the ARIA `meter` role: a scalar
 * within a known range that is not going anywhere. The two share the visual
 * recipe (track, fill, an optional reference tick) so a page that mixes them
 * reads as one system; they differ in semantics, default ink and size.
 *
 * - Default fill is `foreground` ink, not `primary`: a quantity is a fact,
 *   not an action or a status. The status tones exist for the case where the
 *   quantity IS a verdict (over a ceiling → `destructive`), and a non-default
 *   tone must be paired with `aria-valuetext` so the state is never color-only.
 * - `segments` turns the continuous track into a countable strip of discrete
 *   cells ("|||| 4 of 5"): five facts read better as five marks than as 80%.
 * - `marker` draws a reference tick (a ceiling, a target) outside the clipped
 *   track, exactly as `Progress.marker` does; `markerLabel` joins the value
 *   text so AT hears the reference too.
 */
export const meterVariants = cva("relative w-full overflow-hidden rounded-full bg-muted", {
  variants: {
    size: {
      xs: "h-1",
      sm: "h-2",
      md: "h-3",
    },
  },
  defaultVariants: { size: "sm" },
});

export const meterFillVariants = cva("block h-full rounded-full", {
  variants: {
    variant: {
      default: "bg-foreground",
      success: "bg-success",
      warning: "bg-warning",
      destructive: "bg-destructive",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface MeterProps
  extends
    Omit<HTMLAttributes<HTMLDivElement>, "children">,
    VariantProps<typeof meterVariants>,
    VariantProps<typeof meterFillVariants> {
  /** The measured value. Clamped to `[min, max]` for the fill; reported as-is to AT. */
  value: number;
  /** Range floor. Default 0. */
  min?: number;
  /** Range ceiling. Default 100. */
  max?: number;
  /**
   * Draw the track as this many discrete cells instead of one continuous
   * fill; the value fills `round((value − min) / (max − min) × segments)` of
   * them. For "n of m" facts pass `segments={m}` with `max={m}`.
   */
  segments?: number;
  /**
   * Reference point on the same scale as `value` (a ceiling, a target),
   * rendered as a thin vertical tick on the track. Unset renders no tick.
   */
  marker?: number;
  /**
   * What `marker` represents, already localized ("ceiling $500"). Appended to
   * the accessible value text; a caller-supplied `aria-valuetext` always wins.
   */
  markerLabel?: string;
}

export const Meter = forwardRef<HTMLDivElement, MeterProps>(function Meter(
  {
    value,
    min = 0,
    max = 100,
    segments,
    marker,
    markerLabel,
    size,
    variant,
    className,
    "aria-valuetext": ariaValuetext,
    ...props
  },
  ref,
) {
  const span = max - min;
  const fraction = span > 0 ? Math.min(1, Math.max(0, (value - min) / span)) : 0;
  const hasMarker = typeof marker === "number" && Number.isFinite(marker);
  const markerFraction = hasMarker
    ? Math.min(1, Math.max(0, span > 0 ? ((marker as number) - min) / span : 0))
    : 0;
  const resolvedValuetext =
    ariaValuetext ?? (hasMarker && markerLabel ? `${value}, ${markerLabel}` : undefined);
  const cells =
    typeof segments === "number" && segments > 0 ? Math.max(1, Math.floor(segments)) : 0;
  const filledCells = cells ? Math.round(fraction * cells) : 0;

  const track = cells ? (
    <div
      ref={ref}
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={value}
      aria-valuetext={resolvedValuetext}
      className={cn(
        "flex w-full items-stretch gap-px",
        size === "xs" ? "h-1" : size === "md" ? "h-3" : "h-2",
        className,
      )}
      data-slot="meter"
      data-variant={variant ?? "default"}
      role="meter"
      {...props}
    >
      {Array.from({ length: cells }, (_, i) => (
        <span
          className={cn(
            "min-w-0 flex-1 rounded-full",
            i < filledCells ? meterFillVariants({ variant }) : "bg-muted",
          )}
          data-slot="meter-cell"
          key={i}
        />
      ))}
    </div>
  ) : (
    <div
      ref={ref}
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={value}
      aria-valuetext={resolvedValuetext}
      className={cn(meterVariants({ size }), className)}
      data-slot="meter"
      data-variant={variant ?? "default"}
      role="meter"
      {...props}
    >
      <span
        className={meterFillVariants({ variant })}
        data-slot="meter-fill"
        style={{ width: `${fraction * 100}%` }}
      />
    </div>
  );

  if (!hasMarker || cells) return track;

  return (
    // Same construction as `Progress.marker`: the tick is a sibling of the
    // clipped track so it is never cut off, and the wrapper mirrors
    // `className` so the tick's percentage is measured against the same box.
    <div className={cn("relative", className)}>
      {track}
      <span
        aria-hidden={markerLabel ? undefined : "true"}
        className="pointer-events-none absolute -top-0.5 -bottom-0.5 w-0.5 rounded-full bg-foreground"
        data-slot="meter-marker"
        style={{ insetInlineStart: `${markerFraction * 100}%` }}
      />
    </div>
  );
});
