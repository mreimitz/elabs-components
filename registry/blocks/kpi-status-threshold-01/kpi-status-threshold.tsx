"use client";

import { Badge, Card, CardContent, Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  AS_OF_DATE,
  DATA_SOURCE,
  onTimeDelivery,
  QUARTER_LABEL,
  type KpiMetric,
} from "@/components/kpi-card-parts/data/acme-quarter";
import { KpiAsOf } from "@/components/kpi-card-parts/kpi-as-of";
import { KpiComparisonRow } from "@/components/kpi-card-parts/kpi-comparison-row";
import { KpiStatus, type KpiStatusValue } from "@/components/kpi-card-parts/kpi-status";
import { formatKpiValue } from "@/components/kpi-card-parts/format";

export interface KpiStatusThresholdProps {
  /** Defaults to on-time delivery — the shared Acme Logistics Q3 dataset. */
  metric?: KpiMetric;
  locale?: string;
  /** Renders a layout-shaped skeleton card instead of the real values. Default false. */
  loading?: boolean;
  className?: string;
}

/** Same margin-of-target rule the scorecard uses (`statusForMetric` in
 * `infographic-scorecard-01`) — repeated here, not imported, because a
 * relative import may not cross an item boundary (`.claude/rules/registry.md`
 * § Shared code) and this card additionally reuses it PER WEEK below, which
 * the scorecard's version has no reason to do. */
function marginFor(target: number): number {
  return Math.abs(target) * 0.05;
}

/** Which zone a single value falls in, against `target` — used both for
 * TODAY's status and, applied to every trailing weekly point, for how long
 * it has held. */
function statusForValue(value: number, target: number, higherIsBetter: boolean): KpiStatusValue {
  const gap = higherIsBetter ? target - value : value - target;
  if (gap <= 0) return "on-track";
  return gap <= marginFor(target) ? "at-risk" : "off-track";
}

/**
 * How many of the metric's own trailing weekly points, counting back from
 * the most recent, sit in the SAME status as today — "how long has this been
 * true?". Stated in whole WEEKS, the data's own resolution: this dataset has
 * no daily readings to convert to a day count without inventing precision it
 * does not have (`.claude/rules/charts.md` § Honesty).
 */
function weeksInCurrentStatus(metric: KpiMetric): number {
  const current = statusForValue(metric.actual, metric.target, metric.higherIsBetter);
  let weeks = 0;
  for (let i = metric.weekly.length - 1; i >= 0; i -= 1) {
    const value = metric.weekly[i];
    if (value === undefined) break;
    if (statusForValue(value, metric.target, metric.higherIsBetter) !== current) break;
    weeks += 1;
  }
  return weeks;
}

function sinceText(weeks: number): string {
  return `for ${weeks} week${weeks === 1 ? "" : "s"}`;
}

/** One threshold zone, already in LEFT→RIGHT visual order. */
interface ThresholdZone {
  tone: KpiStatusValue;
  label: string;
  from: number;
  to: number;
}

function thresholdZones(metric: KpiMetric, scaleMax: number): ThresholdZone[] {
  const { target, higherIsBetter } = metric;
  const margin = marginFor(target);
  return higherIsBetter
    ? [
        { from: 0, label: "Off track", to: Math.max(0, target - margin), tone: "off-track" },
        { from: Math.max(0, target - margin), label: "At risk", to: target, tone: "at-risk" },
        { from: target, label: "On track", to: scaleMax, tone: "on-track" },
      ]
    : [
        { from: 0, label: "On track", to: target, tone: "on-track" },
        { from: target, label: "At risk", to: target + margin, tone: "at-risk" },
        { from: target + margin, label: "Off track", to: scaleMax, tone: "off-track" },
      ];
}

/** Zone-fill wash — a `bg-<tone>/N` region (`.claude/rules/conventions.md` §
 * Surface separation), never a template-interpolated class (Tailwind cannot
 * see through `` `bg-${tone}/15` `` at build time). */
const ZONE_FILL: Record<KpiStatusValue, string> = {
  "at-risk": "bg-warning/15",
  "off-track": "bg-destructive/15",
  "on-track": "bg-success/15",
};

/** Current-value marker — the solid MARK rung, ≥3:1 (unlike the zone wash it sits on). */
const MARKER_FILL: Record<KpiStatusValue, string> = {
  "at-risk": "bg-warning",
  "off-track": "bg-destructive",
  "on-track": "bg-success",
};

function ThresholdScale({ metric, locale }: { metric: KpiMetric; locale: string }) {
  const { actual, target } = metric;
  const margin = marginFor(target);
  const scaleMax = Math.max(actual, target + margin) * 1.15;
  const pct = (value: number) => `${Math.min(100, Math.max(0, (value / scaleMax) * 100))}%`;
  const zones = thresholdZones(metric, scaleMax);
  const currentStatus = statusForValue(actual, target, metric.higherIsBetter);

  return (
    <div className="space-y-1.5" data-slot="kpi-status-threshold-scale">
      {/* Decorative — every fact it draws (value, target, status) is already
          stated in words by `KpiComparisonRow`/`KpiStatus` below
          (`.claude/rules/conventions.md` § Accessibility: don't over-ARIA). */}
      <div aria-hidden="true" className="relative flex h-3 w-full overflow-hidden rounded-full">
        {zones.map((zone) => (
          <div
            className={cn("h-full", ZONE_FILL[zone.tone])}
            key={zone.label}
            style={{ width: `${((zone.to - zone.from) / scaleMax) * 100}%` }}
          />
        ))}
        <div
          className="absolute top-0 h-full w-0.5 bg-foreground"
          style={{ insetInlineStart: pct(target) }}
        />
        <div
          className={cn(
            "absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full",
            MARKER_FILL[currentStatus],
          )}
          style={{ insetInlineStart: pct(actual) }}
        />
      </div>
      <div className="flex justify-between text-caption text-muted-foreground">
        {zones.map((zone) => (
          <span key={zone.label}>{zone.label}</span>
        ))}
      </div>
      <p className="text-caption text-muted-foreground">
        Target {formatKpiValue(target, metric.unit, locale, metric.currency)} · marker is today’s
        value.
      </p>
    </div>
  );
}

function KpiStatusThresholdSkeleton({ className }: { className?: string }) {
  return (
    <Card aria-live="polite" className={className} data-slot="kpi-status-threshold" role="status">
      <CardContent className="space-y-3 p-5">
        <span className="sr-only">Loading the KPI card…</span>
        <div aria-hidden="true" className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton aria-hidden="true" className="h-8 w-40" />
        <Skeleton aria-hidden="true" className="h-3 w-full rounded-full" />
        <Skeleton aria-hidden="true" className="h-3 w-56" />
        <Skeleton aria-hidden="true" className="h-5 w-full" />
        <Skeleton aria-hidden="true" className="h-5 w-32" />
      </CardContent>
    </Card>
  );
}

/**
 * "Should I act?" — a status (icon + text, never colour alone) against a
 * visible ok/at-risk/off-track threshold scale with today's value marked,
 * plus how long the current status has held.
 */
export function KpiStatusThreshold({
  metric = onTimeDelivery,
  locale = "en-US",
  loading = false,
  className,
}: KpiStatusThresholdProps) {
  if (loading) {
    return <KpiStatusThresholdSkeleton className={className} />;
  }

  const status = statusForValue(metric.actual, metric.target, metric.higherIsBetter);
  const weeks = weeksInCurrentStatus(metric);

  return (
    <Card className={className} data-slot="kpi-status-threshold">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body text-muted-foreground">{metric.label}</span>
          <Badge className="shrink-0" variant="secondary">
            {QUARTER_LABEL}
          </Badge>
        </div>
        <div className="text-kpi tabular-nums text-foreground">
          {formatKpiValue(metric.actual, metric.unit, locale, metric.currency)}
        </div>
        <ThresholdScale locale={locale} metric={metric} />
        <KpiComparisonRow
          actual={metric.actual}
          baseline={metric.target}
          baselineLabel="vs target"
          currency={metric.currency}
          higherIsBetter={metric.higherIsBetter}
          locale={locale}
          unit={metric.unit}
        />
        <KpiStatus since={sinceText(weeks)} status={status} />
        <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
      </CardContent>
    </Card>
  );
}
