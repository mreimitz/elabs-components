"use client";

import { Sparkline } from "@elabs-ai/components-charts";
import { Badge, Card, CardContent, Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  AS_OF_DATE,
  DATA_SOURCE,
  EXPECTED_PACE_FRACTION,
  QUARTER_LABEL,
  avgDeliveryHours,
  nps,
  ordersShipped,
  type KpiMetric,
} from "@/components/kpi-card-parts/data/acme-quarter";
import { KpiAsOf } from "@/components/kpi-card-parts/kpi-as-of";
import { KpiComparisonRow } from "@/components/kpi-card-parts/kpi-comparison-row";
import { formatKpiValue } from "@/components/kpi-card-parts/format";

/**
 * A cumulative (QTD) KPI's `target` is already prorated to the snapshot day —
 * a WEEKLY trend needs a per-week pace instead, so this recovers the
 * full-quarter target and spreads it over 13 weeks. A rate KPI's `target` is
 * already on the weekly series' own scale and passes through unchanged.
 */
function weeklyEquivalentTarget(metric: KpiMetric): number {
  const isCumulative = metric.id === "revenue" || metric.id === "ordersShipped";
  if (!isCumulative) return metric.target;
  return metric.target / EXPECTED_PACE_FRACTION / 13;
}

export interface KpiTrendReferenceProps {
  /** Defaults to orders shipped, avg delivery time and NPS — the shared Acme Logistics Q3 dataset. */
  metrics?: KpiMetric[];
  locale?: string;
  /** Renders layout-shaped skeleton cards instead of the real values. Default false. */
  loading?: boolean;
  className?: string;
}

/**
 * "Better or worse than normal?" — a 13-week trend read against three
 * references at once: a target pace, last year's same week, and a normal
 * operating range. The legend spells out the line styles in words, so the
 * distinction never rides on colour alone (WCAG 1.4.1).
 */
export function KpiTrendReference({
  metrics = [ordersShipped, avgDeliveryHours, nps],
  locale = "en-US",
  loading = false,
  className,
}: KpiTrendReferenceProps) {
  if (loading) {
    return (
      <div
        aria-live="polite"
        className={cn("space-y-3", className)}
        data-slot="kpi-trend-reference"
        role="status"
      >
        <span className="sr-only">Loading KPI cards…</span>
        <Skeleton className="h-4 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => (
            <KpiTrendReferenceCardSkeleton key={metric.id} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className={cn("space-y-3", className)} data-slot="kpi-trend-reference">
      <TrendLegend />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <KpiTrendReferenceCard key={metric.id} locale={locale} metric={metric} />
        ))}
      </div>
    </div>
  );
}

function KpiTrendReferenceCardSkeleton() {
  return (
    <Card aria-hidden="true" data-slot="kpi-trend-reference-card">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-full" />
      </CardContent>
    </Card>
  );
}

function TrendLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-4 text-caption text-muted-foreground"
      data-slot="kpi-trend-legend"
    >
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-block h-0.5 w-4 rounded-full bg-foreground" />
        This year (solid line)
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-px w-4 rounded-full bg-muted-foreground"
        />
        Last year (faint line)
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-2.5 w-4 rounded-sm bg-chart-ring-background"
        />
        Normal range (shaded)
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-0.5 w-4 rounded-full border-t border-dashed border-foreground"
        />
        Target pace (dashed)
      </span>
    </div>
  );
}

function KpiTrendReferenceCard({ metric, locale }: { metric: KpiMetric; locale: string }) {
  const target = weeklyEquivalentTarget(metric);
  const lastWeek = metric.weekly[metric.weekly.length - 1] as number;
  const lastWeekPriorYear = metric.weeklyPriorYear[metric.weeklyPriorYear.length - 1] as number;

  return (
    <Card data-slot="kpi-trend-reference-card">
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
        <Sparkline
          band={metric.normalBand}
          baseline={metric.weeklyPriorYear}
          className="w-full text-muted-foreground"
          formatValue={(value) => formatKpiValue(value, metric.unit, locale, metric.currency)}
          height={40}
          labels={{ baseline: "last year", band: "normal range", target: "target pace" }}
          showLastValue
          target={target}
          values={metric.weekly}
          variant="line"
          width={240}
        />
        <KpiComparisonRow
          actual={lastWeek}
          baseline={lastWeekPriorYear}
          baselineLabel="this week vs last year"
          currency={metric.currency}
          higherIsBetter={metric.higherIsBetter}
          locale={locale}
          unit={metric.unit}
        />
        <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
      </CardContent>
    </Card>
  );
}
