"use client";

import { STATUS_TONE_ICONS, StatusBadge, type StatusTone } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export type KpiStatusValue = "on-track" | "at-risk" | "off-track";

const KPI_STATUS_TONE: Record<KpiStatusValue, StatusTone> = {
  "on-track": "success",
  "at-risk": "warning",
  "off-track": "destructive",
};

const KPI_STATUS_LABEL: Record<KpiStatusValue, string> = {
  "on-track": "On track",
  "at-risk": "At risk",
  "off-track": "Off track",
};

export interface KpiStatusProps {
  status: KpiStatusValue;
  /** Already-localized short context, e.g. "since week 6". */
  since?: string;
  className?: string;
}

/**
 * On-track / at-risk / off-track — an icon + text pairing (`StatusBadge`'s
 * out-of-vocabulary tone hatch, `.claude/rules/conventions.md` §Accessibility),
 * never colour alone.
 */
export function KpiStatus({ status, since, className }: KpiStatusProps) {
  const tone = KPI_STATUS_TONE[status];
  return (
    <div className={cn("flex items-center gap-2", className)} data-slot="kpi-status">
      <StatusBadge
        status={{ label: KPI_STATUS_LABEL[status], tone, icon: STATUS_TONE_ICONS[tone] }}
      />
      {since ? <span className="text-meta text-muted-foreground">{since}</span> : null}
    </div>
  );
}
