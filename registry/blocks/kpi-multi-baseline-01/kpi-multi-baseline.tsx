"use client";

import { Badge, Card, CardContent, Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  AS_OF_DATE,
  DATA_SOURCE,
  QUARTER_LABEL,
  nps,
  revenue,
  type KpiMetric,
} from "@/components/kpi-card-parts/data/acme-quarter";
import { KpiAsOf } from "@/components/kpi-card-parts/kpi-as-of";
import { KpiComparisonRow } from "@/components/kpi-card-parts/kpi-comparison-row";
import { formatKpiValue } from "@/components/kpi-card-parts/format";

export interface KpiMultiBaselineProps {
  /** Defaults to revenue and NPS — the shared Acme Logistics Q3 dataset. */
  metrics?: KpiMetric[];
  locale?: string;
  /** Renders layout-shaped skeleton cards instead of the real values. Default false. */
  loading?: boolean;
  className?: string;
}

/**
 * "Compared to what?" — one wide card per KPI, three named baselines (target,
 * last year, budget) stacked so a reader compares the SAME number against
 * every reference at once, on one shared scale stated in the card itself.
 */
export function KpiMultiBaseline({
  metrics = [revenue, nps],
  locale = "en-US",
  loading = false,
  className,
}: KpiMultiBaselineProps) {
  return (
    <div
      aria-live={loading ? "polite" : undefined}
      className={cn("grid gap-4", className)}
      data-slot="kpi-multi-baseline"
      role={loading ? "status" : undefined}
    >
      {loading ? <span className="sr-only">Loading KPI cards…</span> : null}
      {loading
        ? metrics.map((metric) => <KpiMultiBaselineCardSkeleton key={metric.id} />)
        : metrics.map((metric) => (
            <KpiMultiBaselineCard key={metric.id} locale={locale} metric={metric} />
          ))}
    </div>
  );
}

function KpiMultiBaselineCardSkeleton() {
  return (
    <Card aria-hidden="true" data-slot="kpi-multi-baseline-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

function KpiMultiBaselineCard({ metric, locale }: { metric: KpiMetric; locale: string }) {
  const values = [metric.actual, metric.target, metric.priorYear, metric.budget];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.1 || Math.abs(hi) * 0.1 || 1;
  const domain: [number, number] = [lo - pad, hi + pad];

  return (
    <Card data-slot="kpi-multi-baseline-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body text-muted-foreground">{metric.label}</span>
          <Badge className="shrink-0" variant="secondary">
            {QUARTER_LABEL}
          </Badge>
        </div>
        <div className="text-kpi tabular-nums text-foreground">
          {formatKpiValue(metric.actual, metric.unit, locale, metric.currency)}
        </div>
        <p className="text-caption text-muted-foreground">
          Three baselines, one shared scale:{" "}
          <span className="tabular-nums">
            {formatKpiValue(domain[0], metric.unit, locale, metric.currency)}–
            {formatKpiValue(domain[1], metric.unit, locale, metric.currency)}
          </span>
          .
        </p>
        <div className="space-y-1">
          <KpiComparisonRow
            actual={metric.actual}
            baseline={metric.target}
            baselineLabel="vs target"
            currency={metric.currency}
            higherIsBetter={metric.higherIsBetter}
            locale={locale}
            marker={<ScaleStrip actual={metric.actual} baseline={metric.target} domain={domain} />}
            unit={metric.unit}
          />
          <KpiComparisonRow
            actual={metric.actual}
            baseline={metric.priorYear}
            baselineLabel="vs last year"
            currency={metric.currency}
            higherIsBetter={metric.higherIsBetter}
            locale={locale}
            marker={
              <ScaleStrip actual={metric.actual} baseline={metric.priorYear} domain={domain} />
            }
            unit={metric.unit}
          />
          <KpiComparisonRow
            actual={metric.actual}
            baseline={metric.budget}
            baselineLabel="vs budget"
            currency={metric.currency}
            higherIsBetter={metric.higherIsBetter}
            locale={locale}
            marker={<ScaleStrip actual={metric.actual} baseline={metric.budget} domain={domain} />}
            unit={metric.unit}
          />
        </div>
        <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
      </CardContent>
    </Card>
  );
}

/**
 * A tiny shared-scale dot strip — where THIS row's baseline (ring dot) sits
 * against the actual (filled dot) on the card's one shared domain. Purely
 * decorative reinforcement of the numbers `KpiComparisonRow` already renders
 * as text, so it stays `aria-hidden`.
 */
function ScaleStrip({
  domain,
  actual,
  baseline,
}: {
  domain: [number, number];
  actual: number;
  baseline: number;
}) {
  const pct = (v: number) => {
    const [lo, hi] = domain;
    if (hi === lo) return 50;
    return Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
  };
  return (
    <span
      aria-hidden="true"
      className="relative inline-block h-2 w-[120px] shrink-0 rounded-full bg-muted"
      data-slot="kpi-scale-strip"
    >
      <span
        className="absolute top-1/2 size-2.5 rounded-full border-2 border-border-strong bg-card"
        style={{ insetInlineStart: `${pct(baseline)}%`, transform: "translate(-50%, -50%)" }}
      />
      <span
        className="absolute top-1/2 size-2 rounded-full bg-foreground"
        style={{ insetInlineStart: `${pct(actual)}%`, transform: "translate(-50%, -50%)" }}
      />
    </span>
  );
}
