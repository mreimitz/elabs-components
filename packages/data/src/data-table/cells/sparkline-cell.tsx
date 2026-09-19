"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { NumericExtent } from "../cell-scales";

/** The line's stroke width (px, unscaled by the viewBox). */
export const SPARKLINE_CELL_STROKE_WIDTH = 1.5;
const VIEW_WIDTH = 100;
const PAD = 2;

export interface SparklineCellProps extends HTMLAttributes<HTMLDivElement> {
  values: readonly (number | null)[];
  /** The y domain: this row's own extent (`range: "cell"`) or the column's. */
  domain: NumericExtent | null;
  /** Every value as text, for screen readers, sorting and copy. */
  label: string;
  /** Printed first / last values (with `labels: "ends"`). */
  ends?: readonly [first: string, last: string];
  /**
   * Room reserved for those two labels, in `ch` (`labelBoxCh` over the whole
   * column). The drawing takes what they leave over, so one reservation per
   * column keeps every row's line on the same x scale.
   */
  endsWidth?: readonly [first: number, last: number];
  fill?: boolean;
  /** Drawing height in px. Default 24. */
  height?: number;
}

/** `M`/`L` path through the finite points; a `null` breaks the line. */
function sparkPath(values: readonly (number | null)[], domain: NumericExtent, height: number) {
  const span = domain.max - domain.min;
  const step = values.length > 1 ? VIEW_WIDTH / (values.length - 1) : 0;
  const y = (v: number) =>
    span > 0 ? PAD + (1 - (v - domain.min) / span) * Math.max(0, height - 2 * PAD) : height / 2;
  let d = "";
  let open = false;
  values.forEach((v, i) => {
    if (v === null) return void (open = false);
    d += `${open ? "L" : "M"}${(i * step).toFixed(2)} ${y(v).toFixed(2)}`;
    open = true;
  });
  return d;
}

/** An in-cell sparkline: a ≤ 40-line inline SVG on a shared or own y domain. */
export const SparklineCell = forwardRef<HTMLDivElement, SparklineCellProps>(function SparklineCell(
  { values, domain, label, ends, endsWidth, fill = false, height = 24, className, ...props },
  ref,
) {
  const h = Math.max(0, height);
  const d = domain ? sparkPath(values, domain, h) : "";
  const area = fill && d ? `${d}L${VIEW_WIDTH} ${h}L0 ${h}Z` : "";
  return (
    <div
      ref={ref}
      data-slot="sparkline-cell"
      className={cn("flex min-w-0 items-center gap-1.5", className)}
      {...props}
    >
      <span className="sr-only">{label}</span>
      {/*
        Both end labels are column-wide reservations (`endsWidth`), never this
        row's own text width, so every row's drawing gets the same width and the
        lines share one x scale as well as the y scale.
      */}
      {ends && (
        <span
          aria-hidden="true"
          className="shrink-0 whitespace-nowrap text-end text-meta text-muted-foreground tabular-nums"
          style={endsWidth?.[0] ? { width: `${endsWidth[0]}ch` } : undefined}
        >
          {ends[0]}
        </span>
      )}
      <svg
        aria-hidden="true"
        data-slot="sparkline-cell-svg"
        data-y-min={domain?.min}
        data-y-max={domain?.max}
        viewBox={`0 0 ${VIEW_WIDTH} ${h}`}
        preserveAspectRatio="none"
        className="block min-w-8 flex-1 overflow-visible"
        style={{ height: h }}
      >
        {area && <path d={area} fill="var(--chart-1)" fillOpacity={0.2} stroke="none" />}
        <path
          data-slot="sparkline-cell-line"
          d={d}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth={SPARKLINE_CELL_STROKE_WIDTH}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {ends && (
        <span
          aria-hidden="true"
          className="shrink-0 whitespace-nowrap text-start text-meta text-foreground tabular-nums"
          style={endsWidth?.[1] ? { width: `${endsWidth[1]}ch` } : undefined}
        >
          {ends[1]}
        </span>
      )}
    </div>
  );
});
