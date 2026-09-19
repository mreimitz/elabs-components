"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { barGeometry } from "../cell-scales";

/** A positive bar's fill: the first series colour. */
export const BAR_CELL_POSITIVE_COLOR = "var(--chart-1)";
/** A negative bar's fill: the diverging ramp's negative end. */
export const BAR_CELL_NEGATIVE_COLOR = "var(--chart-div-neg-2)";

export interface BarCellProps extends HTMLAttributes<HTMLDivElement> {
  /** The number the bar draws; `null` draws no bar. */
  value: number | null;
  /** The printed (formatted) value. Always in the accessible tree. */
  label: string;
  /** `[lo, hi]` of the track; always contains zero (see `barDomain`). */
  domain: readonly [number, number];
  /** `"regular"` (default): bar beside the value; `"slim"`: a thin bar under it. */
  variant?: "regular" | "slim";
  /** Paint the grey remainder of the track. */
  track?: boolean;
  /** A category colour (`var(--chart-N)`) that replaces the positive fill. */
  fillColor?: string | null;
  /** Paint a negative value in the negative token. Default `true`. */
  negativeColor?: boolean;
}

/**
 * An in-cell bar (CSS only). The bar grows from zero — toward inline-end for a
 * positive value, toward inline-start for a negative one — inside a track that
 * spans the column's shared domain. The value stays printed beside it.
 */
export const BarCell = forwardRef<HTMLDivElement, BarCellProps>(function BarCell(
  {
    value,
    label,
    domain,
    variant = "regular",
    track = false,
    fillColor,
    negativeColor = true,
    className,
    ...props
  },
  ref,
) {
  const geometry = barGeometry(value ?? Number.NaN, domain);
  const fill =
    geometry.negative && negativeColor
      ? BAR_CELL_NEGATIVE_COLOR
      : (fillColor ?? BAR_CELL_POSITIVE_COLOR);
  const straddlesZero = domain[0] < 0 && domain[1] > 0;
  const slim = variant === "slim";
  return (
    <div
      ref={ref}
      data-slot="bar-cell"
      data-variant={variant}
      data-negative={geometry.negative || undefined}
      className={cn(
        "flex min-w-0",
        slim ? "flex-col items-stretch gap-1" : "items-center gap-2",
        className,
      )}
      {...props}
    >
      <span data-slot="bar-cell-value" className="shrink-0 tabular-nums">
        {label}
      </span>
      <span
        aria-hidden="true"
        data-slot="bar-cell-track"
        className={cn(
          "relative block min-w-8 flex-1 rounded-sm",
          slim ? "h-1" : "h-3",
          track && "bg-muted",
        )}
      >
        {straddlesZero && (
          <span
            data-slot="bar-cell-zero"
            className="absolute -inset-y-0.5 w-px bg-border-strong"
            style={{ insetInlineStart: `${geometry.zero}%` }}
          />
        )}
        <span
          data-slot="bar-cell-bar"
          className="absolute inset-y-0 rounded-sm"
          style={{
            insetInlineStart: `${geometry.start}%`,
            width: `${geometry.size}%`,
            backgroundColor: fill,
          }}
        />
      </span>
    </div>
  );
});
