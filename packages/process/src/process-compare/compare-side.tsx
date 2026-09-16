"use client";

/**
 * CompareSide — one labeled `ProcessMap` panel inside `ProcessCompare`'s side-by-side mode
 * (RM-064). Owns nothing beyond a heading and the map itself — `ProcessCompare` lifts
 * abstraction, metric and table-view state so both sides stay in lockstep, the same
 * "lift state into the provider" convention a compound component follows, applied to a
 * fixed pair rather than an open set of children.
 */
import { forwardRef, type HTMLAttributes } from "react";
import { Heading } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { ProcessMap, type ProcessMapProps } from "../process-map/process-map";

export interface CompareSideProps extends HTMLAttributes<HTMLDivElement> {
  /** The host-supplied name for this side ("Before", "Q1", the log's own file name, …). */
  label: string;
  /** Forwarded to `ProcessMap` verbatim — everything this side's canvas needs. */
  map: Omit<ProcessMapProps, "className">;
}

/** One heading + one `ProcessMap`, stacked to fill its panel. */
export const CompareSide = forwardRef<HTMLDivElement, CompareSideProps>(function CompareSide(
  { label, map, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="compare-side"
      className={cn("flex min-h-0 flex-col gap-2", className)}
      {...props}
    >
      <Heading level={3} size="subtitle" data-slot="compare-side-label">
        {label}
      </Heading>
      <div className="min-h-96 flex-1">
        <ProcessMap {...map} className="size-full" />
      </div>
    </div>
  );
});
