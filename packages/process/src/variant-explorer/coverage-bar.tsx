"use client";

/**
 * A variant's share of cases as a bar plus its printed percentage (RM-054).
 *
 * Composes `@elabs-ai/components-ui`'s `Progress` rather than drawing a bar. The bar is
 * `aria-hidden`: the same number is printed beside it and is part of the row's accessible
 * name, so a progressbar per row would only add 2 000 redundant announcements.
 */
import { forwardRef, type HTMLAttributes } from "react";
import { Progress } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export interface VariantCoverageBarProps extends HTMLAttributes<HTMLDivElement> {
  /** `0..1`. */
  share: number;
  /** The share, already formatted for display. */
  valueLabel: string;
}

export const VariantCoverageBar = forwardRef<HTMLDivElement, VariantCoverageBarProps>(
  function VariantCoverageBar({ share, valueLabel, className, ...props }, ref) {
    const percent = Math.min(100, Math.max(0, share * 100));
    return (
      <div
        ref={ref}
        data-slot="variant-explorer-coverage"
        className={cn("flex min-w-0 items-center gap-2", className)}
        {...props}
      >
        <Progress aria-hidden="true" value={percent} className="h-1.5 min-w-8 flex-1" />
        <span className="w-12 shrink-0 text-end text-meta tabular-nums">{valueLabel}</span>
      </div>
    );
  },
);
