"use client";

import { Gauge } from "@elabs-ai/components-charts";
import { Badge, Card, CardContent, Progress, Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  AS_OF_DATE,
  DATA_SOURCE,
  EXPECTED_PACE_FRACTION,
  QUARTER_DAY_TODAY,
  QUARTER_LABEL,
  QUARTER_TOTAL_DAYS,
  onTimeDelivery,
  ordersQtd,
  revenueQtd,
  type KpiMetric,
  type QtdProgress,
} from "@/components/kpi-card-parts/data/acme-quarter";
import { KpiAsOf } from "@/components/kpi-card-parts/kpi-as-of";
import { KpiComparisonRow } from "@/components/kpi-card-parts/kpi-comparison-row";
import { KpiStatus, type KpiStatusValue } from "@/components/kpi-card-parts/kpi-status";
import { formatKpiDelta, formatKpiValue } from "@/components/kpi-card-parts/format";

/** Positive = behind the expected pace, in days; negative = ahead. */
function computePaceDays(actual: number, targetFullQuarter: number): number {
  const dayEquivalent = (actual / targetFullQuarter) * QUARTER_TOTAL_DAYS;
  return QUARTER_DAY_TODAY - dayEquivalent;
}

function paceStatus(paceDays: number): KpiStatusValue {
  if (paceDays <= 0) return "on-track";
  if (paceDays <= 5) return "at-risk";
  return "off-track";
}

function paceSinceText(paceDays: number): string {
  const days = Math.round(Math.abs(paceDays));
  if (days === 0) return "exactly on pace";
  const noun = days === 1 ? "day" : "days";
  return paceDays > 0 ? `${days} ${noun} behind pace` : `${days} ${noun} ahead of pace`;
}

/** A rate KPI (not cumulative) is "at risk" once it is within `margin` of target, "off track" past it. */
function rateStatus(
  actual: number,
  target: number,
  higherIsBetter: boolean,
  margin = 5,
): KpiStatusValue {
  const gap = higherIsBetter ? target - actual : actual - target;
  if (gap <= 0) return "on-track";
  if (gap <= margin) return "at-risk";
  return "off-track";
}

export interface KpiPaceProps {
  /** Defaults to the shared Acme Logistics Q3 dataset. */
  revenueProgress?: QtdProgress;
  ordersProgress?: QtdProgress;
  gaugeMetric?: KpiMetric;
  locale?: string;
  /** Renders layout-shaped skeleton cards instead of the real values. Default false. */
  loading?: boolean;
  className?: string;
}

/**
 * "Will I make it by period end?" — two quarter-to-date progress bars (each
 * with a marker for where the pace SHOULD be today) plus a rate KPI read as a
 * gauge against its own target.
 */
export function KpiPace({
  revenueProgress = revenueQtd,
  ordersProgress = ordersQtd,
  gaugeMetric = onTimeDelivery,
  locale = "en-US",
  loading = false,
  className,
}: KpiPaceProps) {
  if (loading) {
    return (
      <div
        aria-live="polite"
        className={cn("grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
        data-slot="kpi-pace"
        role="status"
      >
        <span className="sr-only">Loading KPI cards…</span>
        <KpiPaceProgressCardSkeleton />
        <KpiPaceProgressCardSkeleton />
        <KpiPaceGaugeCardSkeleton />
      </div>
    );
  }
  return (
    <div
      className={cn("grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
      data-slot="kpi-pace"
    >
      <KpiPaceProgressCard locale={locale} progress={revenueProgress} />
      <KpiPaceProgressCard locale={locale} progress={ordersProgress} />
      <KpiPaceGaugeCard locale={locale} metric={gaugeMetric} />
    </div>
  );
}

function KpiPaceProgressCardSkeleton() {
  return (
    <Card aria-hidden="true" data-slot="kpi-pace-card">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-5 w-32" />
      </CardContent>
    </Card>
  );
}

function KpiPaceGaugeCardSkeleton() {
  return (
    <Card aria-hidden="true" data-slot="kpi-pace-gauge-card">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="mx-auto aspect-square w-full max-w-[200px] rounded-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-5 w-32" />
      </CardContent>
    </Card>
  );
}

function KpiPaceProgressCard({ progress, locale }: { progress: QtdProgress; locale: string }) {
  const pctOfTarget = (progress.actual / progress.targetFullQuarter) * 100;
  const expectedPct = EXPECTED_PACE_FRACTION * 100;
  const expectedValue = progress.targetFullQuarter * EXPECTED_PACE_FRACTION;
  const paceDays = computePaceDays(progress.actual, progress.targetFullQuarter);
  const status = paceStatus(paceDays);
  const since = paceSinceText(paceDays);
  const variant =
    status === "off-track" ? "destructive" : status === "at-risk" ? "warning" : "success";

  return (
    <Card data-slot="kpi-pace-card">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body text-muted-foreground">{progress.label}</span>
          <Badge className="shrink-0" variant="secondary">
            {QUARTER_LABEL}
          </Badge>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-kpi tabular-nums text-foreground">
            {formatKpiValue(progress.actual, progress.unit, locale, progress.currency)}
          </span>
          <span className="text-body text-muted-foreground">
            of{" "}
            {formatKpiValue(progress.targetFullQuarter, progress.unit, locale, progress.currency)}{" "}
            target
          </span>
        </div>
        <Progress
          aria-label={progress.label}
          marker={expectedPct}
          markerLabel={`expected ${Math.round(expectedPct)}% by today`}
          value={Math.min(100, pctOfTarget)}
          variant={variant}
        />
        <p className="text-caption text-muted-foreground">
          Expected{" "}
          <span className="tabular-nums">
            {formatKpiValue(expectedValue, progress.unit, locale, progress.currency)}
          </span>{" "}
          by today — day {QUARTER_DAY_TODAY} of {QUARTER_TOTAL_DAYS}.
        </p>
        <KpiStatus since={since} status={status} />
        <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
      </CardContent>
    </Card>
  );
}

function KpiPaceGaugeCard({ metric, locale }: { metric: KpiMetric; locale: string }) {
  const status = rateStatus(metric.actual, metric.target, metric.higherIsBetter);
  const since = `${formatKpiDelta(metric.actual - metric.target, metric.unit, locale, metric.currency)} vs target`;

  return (
    <Card data-slot="kpi-pace-gauge-card">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body text-muted-foreground">{metric.label}</span>
          <Badge className="shrink-0" variant="secondary">
            {QUARTER_LABEL}
          </Badge>
        </div>
        <Gauge
          centerValue={metric.actual}
          defaultLabel={metric.label}
          minWidth={200}
          suffix="%"
          target={metric.target}
          thresholds={[
            { value: 85, label: "Watch" },
            { value: metric.target, label: "Target" },
          ]}
          value={metric.actual}
        />
        <KpiComparisonRow
          actual={metric.actual}
          baseline={metric.target}
          baselineLabel="vs target"
          currency={metric.currency}
          higherIsBetter={metric.higherIsBetter}
          locale={locale}
          unit={metric.unit}
        />
        <KpiStatus since={since} status={status} />
        <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
      </CardContent>
    </Card>
  );
}
