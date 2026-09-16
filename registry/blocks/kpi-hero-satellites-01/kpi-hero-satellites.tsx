"use client";

import { Sparkline } from "@elabs-ai/components-charts";
import { Badge, Card, CardContent, Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  AS_OF_DATE,
  DATA_SOURCE,
  QUARTER_LABEL,
  nps,
  onTimeDelivery,
  ordersShipped,
  revenue,
  type KpiMetric,
} from "@/components/kpi-card-parts/data/acme-quarter";
import { KpiAsOf } from "@/components/kpi-card-parts/kpi-as-of";
import { KpiComparisonRow } from "@/components/kpi-card-parts/kpi-comparison-row";
import { formatKpiValue } from "@/components/kpi-card-parts/format";

export interface KpiHeroSatellitesProps {
  /** The headline KPI. Defaults to revenue — the shared Acme Logistics Q3 dataset. */
  heroMetric?: KpiMetric;
  /** Defaults to orders shipped, on-time delivery and NPS. */
  satelliteMetrics?: KpiMetric[];
  locale?: string;
  /** Renders layout-shaped skeleton content instead of the real values. Default false. */
  loading?: boolean;
  className?: string;
}

/**
 * "What's the headline?" — one hero KPI (a big value, a named comparison vs
 * target and a 13-week trend against last year) with three satellite KPIs
 * beside it, each a compact value + signed delta + tiny trend. One card, one
 * separation gesture (a divider rail between the hero and the satellite
 * column, row dividers between satellites) — never four unrelated cards.
 */
export function KpiHeroSatellites({
  heroMetric = revenue,
  satelliteMetrics = [ordersShipped, onTimeDelivery, nps],
  locale = "en-US",
  loading = false,
  className,
}: KpiHeroSatellitesProps) {
  // `@container`/`@xl:` (not `sm:`): this card is as likely to sit in a
  // narrow sidebar/panel on an otherwise-wide page as to span it, and a
  // VIEWPORT breakpoint fires regardless of how much width this component
  // actually got — see `Compact` (~280px on a full-width page) and
  // `console-overview.tsx`'s `@container` note for the same bug.
  if (loading) {
    return (
      <Card
        aria-live="polite"
        className={cn("@container", className)}
        data-slot="kpi-hero-satellites"
        role="status"
      >
        <CardContent className="grid grid-cols-1 gap-4 p-5 @xl:grid-cols-3">
          <span className="sr-only">Loading KPI cards…</span>
          <div className="space-y-3 @xl:col-span-2 @xl:border-e @xl:border-border @xl:pe-4">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="divide-y divide-border @xl:col-span-1">
            {satelliteMetrics.map((metric) => (
              <div className="space-y-2 py-2 first:pt-0 last:pb-0" key={metric.id}>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("@container", className)} data-slot="kpi-hero-satellites">
      <CardContent className="grid grid-cols-1 gap-4 p-5 @xl:grid-cols-3">
        <HeroColumn locale={locale} metric={heroMetric} />
        <div className="divide-y divide-border @xl:col-span-1">
          {satelliteMetrics.map((metric) => (
            <SatelliteRow key={metric.id} locale={locale} metric={metric} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function HeroColumn({ metric, locale }: { metric: KpiMetric; locale: string }) {
  return (
    <div
      className="space-y-3 @xl:col-span-2 @xl:border-e @xl:border-border @xl:pe-4"
      data-slot="kpi-hero"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-body text-muted-foreground">{metric.label}</span>
        <Badge className="shrink-0" variant="secondary">
          {QUARTER_LABEL}
        </Badge>
      </div>
      <div className="text-kpi tabular-nums text-foreground">
        {formatKpiValue(metric.actual, metric.unit, locale, metric.currency)}
      </div>
      <KpiComparisonRow
        actual={metric.actual}
        baseline={metric.target}
        baselineLabel="vs target"
        currency={metric.currency}
        higherIsBetter={metric.higherIsBetter}
        locale={locale}
        unit={metric.unit}
      />
      <div className="space-y-1">
        <Sparkline
          baseline={metric.weeklyPriorYear}
          className="w-full text-muted-foreground"
          fit="fill"
          formatValue={(value) => formatKpiValue(value, metric.unit, locale, metric.currency)}
          height={44}
          labels={{ baseline: "last year" }}
          showLastValue
          values={metric.weekly}
          variant="line"
          width={280}
        />
        <p className="text-caption text-muted-foreground">13-week trend vs last year</p>
      </div>
      <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
    </div>
  );
}

function SatelliteRow({ metric, locale }: { metric: KpiMetric; locale: string }) {
  return (
    <div className="space-y-1.5 py-2 first:pt-0 last:pb-0" data-slot="kpi-hero-satellite">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-caption text-muted-foreground">{metric.label}</span>
        <span className="text-subtitle tabular-nums text-foreground">
          {formatKpiValue(metric.actual, metric.unit, locale, metric.currency)}
        </span>
      </div>
      <KpiComparisonRow
        actual={metric.actual}
        baseline={metric.target}
        baselineLabel="vs target"
        currency={metric.currency}
        higherIsBetter={metric.higherIsBetter}
        locale={locale}
        marker={
          <Sparkline
            aria-hidden="true"
            className="text-muted-foreground"
            height={16}
            values={metric.weekly}
            variant="line"
            width={40}
          />
        }
        unit={metric.unit}
      />
    </div>
  );
}
