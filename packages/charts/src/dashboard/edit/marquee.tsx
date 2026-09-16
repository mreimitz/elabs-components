"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@elabs-ai/components-ui";

import { CHART_HAIRLINE_WIDTH } from "../../chart-hairline";
import type { CellRect } from "../core/layout";

export interface DashboardMarqueeProps extends HTMLAttributes<HTMLDivElement> {
  /** The dragged selection rectangle in sheet pixels. */
  rect: Pick<CellRect, "x" | "y" | "width" | "height">;
}

/**
 * Stub for RM-081's marquee multi-select: draws the selection rectangle in the edit-chrome
 * language (a dashed `--ring` hairline, no fill). Not mounted by the edit layer yet.
 */
export const DashboardMarquee = forwardRef<HTMLDivElement, DashboardMarqueeProps>(
  function DashboardMarquee({ rect, className, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        data-slot="dashboard-marquee"
        className={cn(
          "pointer-events-none absolute start-0 top-0 border-dashed border-ring",
          className,
        )}
        style={{
          width: rect.width,
          height: rect.height,
          borderWidth: CHART_HAIRLINE_WIDTH,
          transform: `translate(${rect.x}px, ${rect.y}px)`,
          ...style,
        }}
        {...props}
      />
    );
  },
);
