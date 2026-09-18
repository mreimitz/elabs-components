// registry: kpi-card-parts — copied 2026-09-19
"use client";

import { cn } from "@elabs-ai/components-ui/lib/cn";
import { formatAsOf } from "./format";

export interface KpiAsOfProps {
  /** When the figures were last refreshed. */
  date: Date;
  /** Where the figures come from, e.g. "ERP". */
  source?: string;
  locale?: string;
  className?: string;
}

/** Freshness/source footnote — "As of 31 Aug, 09:40 · Source: ERP". */
export function KpiAsOf({ date, source, locale = "en-US", className }: KpiAsOfProps) {
  return (
    <p className={cn("text-caption text-muted-foreground", className)} data-slot="kpi-as-of">
      As of {formatAsOf(date, locale)}
      {source ? ` · Source: ${source}` : ""}
    </p>
  );
}
