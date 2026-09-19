"use client";

import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";
import type { ColorScale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

/**
 * The `<td>` style that paints a heatmap cell: the value's ramp colour (a
 * `var(--chart-seq-*)` / `var(--chart-div-*)` reference from `colorScaleFor`),
 * so a theme flip re-colours it with no re-render. `null` (no data) paints
 * nothing.
 */
export function heatmapCellStyle(color: string | null): CSSProperties | undefined {
  return color ? { backgroundColor: color } : undefined;
}

export interface HeatmapCellProps extends HTMLAttributes<HTMLSpanElement> {
  /** The printed (formatted) value. Always in the accessible tree. */
  label: string;
  /** Hide the value visually; it stays for screen readers, sorting and copy. */
  hideValue?: boolean;
}

/**
 * A heatmap cell's content. The `<td>` carries the colour
 * ({@link heatmapCellStyle}); a visible value sits on a card plate, so its ink
 * reads on every ramp step in every theme without resolving the colour.
 */
export const HeatmapCell = forwardRef<HTMLSpanElement, HeatmapCellProps>(function HeatmapCell(
  { label, hideValue = false, className, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      data-slot="heatmap-cell"
      className={cn(
        hideValue
          ? "sr-only"
          : "inline-block rounded-sm bg-card/85 px-1 text-foreground tabular-nums",
        className,
      )}
      {...props}
    >
      {label}
    </span>
  );
});

export interface HeatmapLegendProps extends HTMLAttributes<HTMLDivElement> {
  scale: ColorScale;
  /** What the colours measure (the column's header). */
  title?: string;
  formatValue: (value: number) => string;
}

/**
 * A heatmap column's colour key: one swatch per class (stepped) or a ramp
 * strip (continuous), with the class bounds printed in the `text-meta` role.
 */
export const HeatmapLegend = forwardRef<HTMLDivElement, HeatmapLegendProps>(function HeatmapLegend(
  { scale, title, formatValue, className, ...props },
  ref,
) {
  const first = scale.steps[0];
  const last = scale.steps[scale.steps.length - 1];
  if (!first || !last) return null;
  const continuous = scale.type === "continuous";
  return (
    <div
      ref={ref}
      role="group"
      aria-label={title}
      data-slot="heatmap-legend"
      data-scale-type={scale.type}
      className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-meta", className)}
      {...props}
    >
      {title && (
        <span aria-hidden="true" className="text-muted-foreground">
          {title}
        </span>
      )}
      {continuous ? (
        <span className="flex min-w-0 items-center gap-1.5 tabular-nums">
          <span>{formatValue(first.from)}</span>
          <span
            aria-hidden="true"
            data-slot="heatmap-legend-ramp"
            className="block h-2.5 w-24 rounded-sm"
            style={{
              backgroundImage: `linear-gradient(to right, ${scale.steps.map((s) => s.color).join(", ")})`,
            }}
          />
          <span>{formatValue(last.to)}</span>
        </span>
      ) : (
        <ul className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
          {scale.steps.map((step) => (
            <li key={`${step.from}-${step.to}`} className="flex items-center gap-1">
              <span
                aria-hidden="true"
                data-slot="heatmap-legend-swatch"
                className="block size-2.5 rounded-full"
                style={{ backgroundColor: step.color }}
              />
              <span>
                {formatValue(step.from)}–{formatValue(step.to)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
