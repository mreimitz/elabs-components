"use client";

/**
 * ChartFallback — shared placeholder panel for "there's nothing usable to chart".
 *
 * Originally private to `auto-chart.tsx` (bad/missing `ChartSpec` data or an
 * unsupported chart type). Promoted to its own module (#352) so the cartesian
 * time-series shell (`TimeSeriesChartCore`, used by both `LineChart` and
 * `AreaChart`) can reach it too, for the identical "nothing usable to render"
 * case — every x value fails to parse as a Date, so there is no scale to draw
 * with — WITHOUT creating a `charts/ -> auto-chart/ -> charts/` import cycle
 * (`auto-chart` imports FROM `charts`, never the reverse). `auto-chart.tsx`
 * re-exports this component so `ChartFallback` keeps its existing place in the
 * public `@elabs/components-charts` surface.
 */

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@elabs/components-ui";

interface ChartFallbackProps extends HTMLAttributes<HTMLDivElement> {
  message: string;
}

export const ChartFallback = forwardRef<HTMLDivElement, ChartFallbackProps>(function ChartFallback(
  { message, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        // border-border keeps the placeholder boundary visible even in themes
        // where --surface-muted is close to --background (e.g. blueprint).
        "flex items-center justify-center rounded-md border border-border bg-surface-muted text-muted-foreground text-body",
        className,
      )}
      role="status"
      aria-live="polite"
      {...props}
    >
      {message}
    </div>
  );
});
