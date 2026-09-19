// registry: kpi-card-parts — copied 2026-09-19
"use client";

import { cn } from "@elabs-ai/components-ui/lib/cn";
import { formatAsOf } from "./format";
import { agentLoopCopy } from "../../../content/copy";

export interface KpiAsOfProps {
  /** When the figures were last refreshed. */
  date: Date;
  /** Where the figures come from, e.g. "ERP". */
  source?: string;
  locale?: string;
  className?: string;
  /** Site copy (RM-099); defaults from `agentLoopCopy.blocks.asOf`. */
  labels?: { asOf: (when: string, source?: string) => string };
}

/** Freshness/source footnote — "As of 31 Aug, 09:40 · Source: ERP". */
export function KpiAsOf({
  date,
  source,
  locale = "en-US",
  className,
  labels = agentLoopCopy.blocks.asOf,
}: KpiAsOfProps) {
  return (
    <p className={cn("text-caption text-muted-foreground", className)} data-slot="kpi-as-of">
      {labels.asOf(formatAsOf(date, locale), source)}
    </p>
  );
}
