"use client";

import { BulletChart } from "@elabs-ai/components-charts";
import { Badge, Card, CardContent, Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  AS_OF_DATE,
  DATA_SOURCE,
  QUARTER_LABEL,
  costPerShipment,
  onTimeDelivery,
  revenue,
  type KpiMetric,
} from "@/components/kpi-card-parts/data/acme-quarter";
import { KpiAsOf } from "@/components/kpi-card-parts/kpi-as-of";
import { KpiComparisonRow } from "@/components/kpi-card-parts/kpi-comparison-row";
import { formatKpiValue, type KpiUnit } from "@/components/kpi-card-parts/format";
import type { ValueFormat } from "@elabs-ai/components-charts";

/** Currency/count read compact-with-symbol; a 0–100 rate/score/hours reads as a bare number on the bullet's own scale. */
function bulletValueFormat(unit: KpiUnit): ValueFormat {
  return unit === "currency" ? "currency" : "number";
}

export interface KpiTargetBulletProps {
  /** Defaults to revenue, on-time delivery and cost per shipment — the shared Acme Logistics Q3 dataset. */
  metrics?: KpiMetric[];
  locale?: string;
  /** Renders layout-shaped skeleton cards instead of the real values. Default false. */
  loading?: boolean;
  className?: string;
}

/**
 * "Am I on target?" — one bullet chart per KPI: the actual value against its
 * target (tick) and last year (notch), inside 2–3 qualitative bands. A
 * lower-is-better KPI (cost per shipment) gets a one-line note that the SAME
 * ascending bands read best-to-worst in the opposite direction.
 */
export function KpiTargetBullet({
  metrics = [revenue, onTimeDelivery, costPerShipment],
  locale = "en-US",
  loading = false,
  className,
}: KpiTargetBulletProps) {
  return (
    <div
      aria-live={loading ? "polite" : undefined}
      className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
      data-slot="kpi-target-bullet"
      role={loading ? "status" : undefined}
    >
      {loading ? <span className="sr-only">Loading KPI cards…</span> : null}
      {loading
        ? metrics.map((metric) => <KpiTargetBulletCardSkeleton key={metric.id} />)
        : metrics.map((metric) => (
            <KpiTargetBulletCard key={metric.id} locale={locale} metric={metric} />
          ))}
    </div>
  );
}

function KpiTargetBulletCardSkeleton() {
  return (
    <Card aria-hidden="true" data-slot="kpi-target-bullet-card">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-40" />
      </CardContent>
    </Card>
  );
}

function KpiTargetBulletCard({ metric, locale }: { metric: KpiMetric; locale: string }) {
  return (
    <Card data-slot="kpi-target-bullet-card">
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
        <BulletChart
          bands={metric.bullet}
          comparative={metric.priorYear}
          labels={{ value: metric.label, target: "target", comparative: "last year" }}
          size="sm"
          target={metric.target}
          value={metric.actual}
          valueFormat={bulletValueFormat(metric.unit)}
        />
        {!metric.higherIsBetter ? (
          <p className="text-caption text-muted-foreground">
            Lower is better here — the same ascending bands read best-to-worst, left to right.
          </p>
        ) : null}
        <KpiComparisonRow
          actual={metric.actual}
          baseline={metric.target}
          baselineLabel="vs target"
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
