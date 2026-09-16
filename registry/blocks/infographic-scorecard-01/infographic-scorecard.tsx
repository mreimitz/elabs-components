"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { BulletChart, Sparkline } from "@elabs-ai/components-charts";
import {
  Skeleton,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  AS_OF_DATE,
  DATA_SOURCE,
  acmeKpis,
  type KpiMetric,
} from "@/components/kpi-card-parts/data/acme-quarter";
import { KpiAsOf } from "@/components/kpi-card-parts/kpi-as-of";
import { KpiStatus, type KpiStatusValue } from "@/components/kpi-card-parts/kpi-status";
import { formatKpiDelta, formatKpiValue } from "@/components/kpi-card-parts/format";

/** Same margin-of-target idea as the other KPI blocks, generalized to any unit via a 5%-of-target band. */
function statusForMetric(metric: KpiMetric): KpiStatusValue {
  const gap = metric.higherIsBetter ? metric.target - metric.actual : metric.actual - metric.target;
  if (gap <= 0) return "on-track";
  const margin = Math.abs(metric.target) * 0.05;
  return gap <= margin ? "at-risk" : "off-track";
}

export interface InfographicScorecardProps {
  /** Defaults to all six Acme Logistics Q3 KPIs. */
  metrics?: KpiMetric[];
  locale?: string;
  /** Renders layout-shaped skeleton rows instead of the real values. Default false. */
  loading?: boolean;
  className?: string;
}

/**
 * The Power BI-style scorecard, done with an honest baseline on every number:
 * one row per KPI — actual, target, a signed delta, progress-to-target as a
 * bullet, a 13-week trend against last year, and a named status.
 */
export function InfographicScorecard({
  metrics = acmeKpis,
  locale = "en-US",
  loading = false,
  className,
}: InfographicScorecardProps) {
  return (
    <div
      aria-live={loading ? "polite" : undefined}
      className={cn("w-full", className)}
      data-slot="infographic-scorecard"
      role={loading ? "status" : undefined}
    >
      {loading ? <span className="sr-only">Loading the scorecard…</span> : null}
      <Table>
        <TableCaption>
          <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>KPI</TableHead>
            <TableHead className="text-end">Actual</TableHead>
            <TableHead className="text-end">Target</TableHead>
            <TableHead className="text-end">Δ vs target</TableHead>
            <TableHead className="text-center">Progress to target</TableHead>
            <TableHead className="text-center">13-week trend</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? metrics.map((metric) => <ScorecardRowSkeleton key={metric.id} />)
            : metrics.map((metric) => (
                <ScorecardRow key={metric.id} locale={locale} metric={metric} />
              ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ScorecardRowSkeleton() {
  return (
    <TableRow aria-hidden="true">
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell className="text-end">
        <Skeleton className="ms-auto h-4 w-16" />
      </TableCell>
      <TableCell className="text-end">
        <Skeleton className="ms-auto h-4 w-16" />
      </TableCell>
      <TableCell className="text-end">
        <Skeleton className="ms-auto h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="mx-auto h-3 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="mx-auto h-6 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-20 rounded-full" />
      </TableCell>
    </TableRow>
  );
}

function ScorecardRow({ metric, locale }: { metric: KpiMetric; locale: string }) {
  const delta = metric.actual - metric.target;
  const isFlat = delta === 0;
  const good = isFlat ? null : metric.higherIsBetter ? delta > 0 : delta < 0;
  const toneClass = isFlat
    ? "text-muted-foreground"
    : good
      ? "text-success-text"
      : "text-destructive-text";
  const Arrow = isFlat ? Minus : delta > 0 ? ArrowUp : ArrowDown;
  const directionLabel = isFlat ? "unchanged" : delta > 0 ? "up" : "down";
  const status = statusForMetric(metric);

  return (
    <TableRow>
      <TableCell className="min-w-0 max-w-40 truncate font-medium">{metric.label}</TableCell>
      <TableCell className="text-end tabular-nums">
        {formatKpiValue(metric.actual, metric.unit, locale, metric.currency)}
      </TableCell>
      <TableCell className="text-end tabular-nums text-muted-foreground">
        {formatKpiValue(metric.target, metric.unit, locale, metric.currency)}
      </TableCell>
      <TableCell className="text-end tabular-nums">
        <span
          aria-label={`${directionLabel} ${formatKpiDelta(delta, metric.unit, locale, metric.currency)}`}
          className={cn("inline-flex items-center gap-1", toneClass)}
        >
          <Arrow aria-hidden="true" className="size-3" />
          {formatKpiDelta(delta, metric.unit, locale, metric.currency)}
        </span>
      </TableCell>
      <TableCell>
        <div className="mx-auto w-24">
          <BulletChart
            bands={metric.bullet}
            labels={{ value: metric.label, target: "target" }}
            size="sm"
            target={metric.target}
            value={metric.actual}
            valueFormat="number"
          />
        </div>
      </TableCell>
      <TableCell>
        <div className="mx-auto w-24">
          <Sparkline
            baseline={metric.weeklyPriorYear}
            className="text-muted-foreground"
            formatValue={(value) => formatKpiValue(value, metric.unit, locale, metric.currency)}
            height={24}
            labels={{ baseline: "last year" }}
            values={metric.weekly}
            variant="line"
            width={96}
          />
        </div>
      </TableCell>
      <TableCell>
        <KpiStatus status={status} />
      </TableCell>
    </TableRow>
  );
}
