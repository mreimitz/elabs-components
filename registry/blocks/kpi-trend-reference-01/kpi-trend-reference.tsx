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
  /** Merged onto the metric-cards GRID itself (not the outer legend+grid wrapper `className` reaches) — override its `sm:`/`lg:` column counts for a narrow container regardless of viewport. */
  gridClassName?: string;
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
  gridClassName,
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
        <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", gridClassName)}>
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
      <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", gridClassName)}>
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
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-4 w-full" />
      </CardContent>
    </Card>
  );
}

function TrendLegend() {
  return (
    // Style word FIRST, reference name second ("Solid: this year" not "This
    // year (solid line)") — shorter per item so more fit on one row before
    // wrapping; at a narrow card width this stays a short 2-line block
    // instead of one legend item per line (#…).
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-muted-foreground"
      data-slot="kpi-trend-legend"
    >
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-block h-0.5 w-4 rounded-full bg-foreground" />
        Solid: this year
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-px w-4 rounded-full bg-muted-foreground"
        />
        Faint: last year
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-2.5 w-4 rounded-sm bg-chart-ring-background"
        />
        Shaded: normal range
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-0.5 w-4 rounded-full border-t border-dashed border-foreground"
        />
        Dashed: target pace
      </span>
    </div>
  );
}

function KpiTrendReferenceCard({ metric, locale }: { metric: KpiMetric; locale: string }) {
  const target = weeklyEquivalentTarget(metric);
  const lastWeek = metric.weekly[metric.weekly.length - 1] as number;
  const lastWeekPriorYear = metric.weeklyPriorYear[metric.weeklyPriorYear.length - 1] as number;
  // Same cumulative check `weeklyEquivalentTarget` makes — a cumulative KPI's
  // headline is a QUARTER TOTAL, on a different scale than the sparkline's
  // per-week points, so it gets one extra word saying so (#…).
  const isCumulative = metric.id === "revenue" || metric.id === "ordersShipped";

  return (
    <Card data-slot="kpi-trend-reference-card">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body text-muted-foreground">{metric.label}</span>
          <Badge className="shrink-0" variant="secondary">
            {QUARTER_LABEL}
          </Badge>
        </div>
        <div>
          <div className="text-kpi tabular-nums text-foreground">
            {formatKpiValue(metric.actual, metric.unit, locale, metric.currency)}
          </div>
          {isCumulative ? (
            <p className="text-caption text-muted-foreground">Quarter-to-date total</p>
          ) : null}
        </div>
        <div className="space-y-1">
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
          <p className="text-caption text-muted-foreground">Weekly, last 13 weeks</p>
        </div>
        <KpiComparisonRow
          actual={lastWeek}
          baseline={lastWeekPriorYear}
          baselineLabel="vs same week last year"
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
