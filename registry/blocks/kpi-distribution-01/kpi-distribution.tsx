"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { DistributionChart, quantileSorted } from "@elabs-ai/components-charts";
import { Badge, Card, CardContent, Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  AS_OF_DATE,
  DATA_SOURCE,
  QUARTER_LABEL,
} from "@/components/kpi-card-parts/data/acme-quarter";
import { KpiAsOf } from "@/components/kpi-card-parts/kpi-as-of";
import { KpiStatus, type KpiStatusValue } from "@/components/kpi-card-parts/kpi-status";
import {
  deliveryHoursSamples,
  deliveryHoursSamplesPriorQuarter,
  pickTimeMinutesSamples,
  pickTimeMinutesSamplesPriorQuarter,
} from "./data/distribution-samples";

/** The two units this block's cards read in — a local, narrower vocabulary than `kpi-card-parts`' `KpiUnit`, which has no "minutes". */
export type DistributionUnit = "hours" | "minutes";

function formatDistributionValue(value: number, unit: DistributionUnit, locale: string): string {
  const digits = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  return unit === "hours" ? `${digits} h` : `${digits} min`;
}

export interface DistributionMetricConfig {
  id: string;
  /** e.g. "Delivery time". */
  label: string;
  unit: DistributionUnit;
  /** Record-level samples — one number per observation, not pre-aggregated. */
  samples: number[];
  /** Same statistic (p90), last quarter — what the comparison row reads against. */
  p90PriorQuarter: number;
  /** The SLA/spec limit drawn as a reference line, in the same unit as `samples`. */
  slaThreshold: number;
  /** Already-composed SLA sentence, e.g. "SLA: 90% within 48 h". */
  slaLabel: string;
  /** Plural noun for the "N% of ___ over the SLA" sentence, e.g. "deliveries". */
  recordNounPlural: string;
}

/** Exported so a consumer/story can override just one field via `{ ...deliveryTimeMetric, … }`. */
export const deliveryTimeMetric: DistributionMetricConfig = {
  id: "delivery-time",
  label: "Delivery time",
  unit: "hours",
  samples: deliveryHoursSamples,
  p90PriorQuarter: quantileSorted(
    deliveryHoursSamplesPriorQuarter.slice().sort((a, b) => a - b),
    0.9,
  ),
  slaThreshold: 48,
  slaLabel: "SLA: 90% within 48 h",
  recordNounPlural: "deliveries",
};

/** Exported so a consumer/story can override just one field via `{ ...pickTimeMetric, … }`. */
export const pickTimeMetric: DistributionMetricConfig = {
  id: "pick-time",
  label: "Warehouse pick time",
  unit: "minutes",
  samples: pickTimeMinutesSamples,
  p90PriorQuarter: quantileSorted(
    pickTimeMinutesSamplesPriorQuarter.slice().sort((a, b) => a - b),
    0.9,
  ),
  slaThreshold: 20,
  slaLabel: "SLA: 95% within 20 min",
  recordNounPlural: "picks",
};

/**
 * A BREACHED SLA is always off-track, however small the overrun — "13.8% of
 * deliveries over 48 h" is a miss, not a caution. At-risk is reserved for the
 * OTHER side of the line: still within the SLA, but p90 sits close enough to
 * the limit (within 10%) that the next bad week tips it over.
 */
function statusFromP90(p90: number, sla: number): KpiStatusValue {
  if (p90 > sla) return "off-track";
  if (p90 >= sla * 0.9) return "at-risk";
  return "on-track";
}

function shareOverThreshold(samples: number[], threshold: number): number {
  if (samples.length === 0) return 0;
  return (samples.filter((value) => value > threshold).length / samples.length) * 100;
}

export interface KpiDistributionProps {
  /** Defaults to delivery time and warehouse pick time — see this file's own dataset. */
  metrics?: DistributionMetricConfig[];
  locale?: string;
  /** Renders layout-shaped skeleton cards instead of the real values. Default false. */
  loading?: boolean;
  className?: string;
  /** Merged onto the metric-cards GRID itself — override its `sm:`/`lg:` column counts for a narrow container regardless of viewport. */
  gridClassName?: string;
}

/**
 * "Is it consistent?" — a median headline (what most records look like) next
 * to a p90/p95 read against a named SLA threshold, backed by the actual
 * distribution so the tail the mean hides is drawn, not asserted. The
 * reference line is a fact, not only ink: its label is folded into the
 * chart's own accessible description (`DistributionChart`'s `referenceLines`).
 */
export function KpiDistribution({
  metrics = [deliveryTimeMetric, pickTimeMetric],
  locale = "en-US",
  loading = false,
  className,
  gridClassName,
}: KpiDistributionProps) {
  if (loading) {
    return (
      <div
        aria-live="polite"
        className={cn("space-y-3", className)}
        data-slot="kpi-distribution"
        role="status"
      >
        <span className="sr-only">Loading KPI cards…</span>
        <div className={cn("grid gap-4 sm:grid-cols-2", gridClassName)}>
          {metrics.map((metric) => (
            <KpiDistributionCardSkeleton key={metric.id} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn("grid gap-4 sm:grid-cols-2", gridClassName, className)}
      data-slot="kpi-distribution"
    >
      {metrics.map((metric) => (
        <KpiDistributionCard key={metric.id} locale={locale} metric={metric} />
      ))}
    </div>
  );
}

function KpiDistributionCardSkeleton() {
  return (
    <Card aria-hidden="true" data-slot="kpi-distribution-card">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-4 w-40" />
      </CardContent>
    </Card>
  );
}

function KpiDistributionCard({
  metric,
  locale,
}: {
  metric: DistributionMetricConfig;
  locale: string;
}) {
  const sorted = metric.samples.slice().sort((a, b) => a - b);
  const median = quantileSorted(sorted, 0.5);
  const p90 = quantileSorted(sorted, 0.9);
  const p95 = quantileSorted(sorted, 0.95);
  const status = statusFromP90(p90, metric.slaThreshold);
  const overSharePct = shareOverThreshold(metric.samples, metric.slaThreshold);
  const fmt = (value: number) => formatDistributionValue(value, metric.unit, locale);
  // The chart's category axis falls back to the value key when the group is
  // omitted (`DistributionChart`'s documented single-group behaviour) — key
  // the records by the metric's own UNIT rather than the generic field name
  // "value" (meaningless) or the metric's full label (already shown as the
  // card's title, and long enough to crowd the axis margin).
  const sampleKey = metric.unit === "hours" ? "Hours" : "Minutes";

  return (
    <Card data-slot="kpi-distribution-card">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body text-muted-foreground">{metric.label}</span>
          <Badge className="shrink-0" variant="secondary">
            {QUARTER_LABEL}
          </Badge>
        </div>
        <div>
          <div className="text-kpi tabular-nums text-foreground">{fmt(median)}</div>
          <p className="text-caption text-muted-foreground">
            Median, {metric.samples.length} {metric.recordNounPlural}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-body tabular-nums text-muted-foreground">
            p90 {fmt(p90)} · p95 {fmt(p95)}
          </span>
          <KpiStatus status={status} />
        </div>
        <div className="h-24 w-full">
          <DistributionChart
            accessibleLabel={`${metric.label} distribution`}
            data={metric.samples.map((value) => ({ [sampleKey]: value }))}
            kind="box"
            referenceLines={[{ label: metric.slaLabel, value: metric.slaThreshold }]}
            valueFormat="number"
            valueKey={sampleKey}
          />
        </div>
        <p className="text-body text-muted-foreground">
          {new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(overSharePct)}% of{" "}
          {metric.recordNounPlural} over {fmt(metric.slaThreshold)} — {metric.slaLabel}
        </p>
        <DistributionCompareRow actual={p90} baseline={metric.p90PriorQuarter} formatValue={fmt} />
        <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
      </CardContent>
    </Card>
  );
}

/**
 * A named-baseline comparison for a computed STATISTIC (p90) rather than a
 * `KpiMetric`'s own `actual` — `kpi-card-parts`' `KpiComparisonRow` takes a
 * `KpiUnit`, which has no "minutes", so this mirrors its visual pattern
 * (arrow + sign + tone, never colour alone) with a caller-supplied formatter
 * instead.
 */
function DistributionCompareRow({
  actual,
  baseline,
  formatValue,
}: {
  actual: number;
  baseline: number;
  formatValue: (value: number) => string;
}) {
  const delta = actual - baseline;
  const isFlat = delta === 0;
  // Lower is better for both time-based metrics on this card.
  const good = isFlat ? null : delta < 0;
  const toneClass = isFlat
    ? "text-muted-foreground"
    : good
      ? "text-success-text"
      : "text-destructive-text";
  const Arrow = isFlat ? Minus : delta > 0 ? ArrowUp : ArrowDown;
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  const directionLabel = isFlat ? "unchanged" : delta > 0 ? "up" : "down";
  const polarityLabel = isFlat ? "" : good ? ", favorable" : ", unfavorable";
  const deltaText = `${sign}${formatValue(Math.abs(delta))}`;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1"
      data-slot="kpi-comparison-row"
    >
      <span className="text-body text-muted-foreground">p90 vs last quarter</span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-body tabular-nums text-muted-foreground">
          {formatValue(baseline)}
        </span>
        <span
          aria-label={`${directionLabel} ${deltaText}${polarityLabel}`}
          className={cn(
            "flex items-center gap-1 whitespace-nowrap text-meta tabular-nums",
            toneClass,
          )}
          data-slot="kpi-comparison-row-delta"
        >
          <Arrow aria-hidden="true" className="size-3" />
          {deltaText}
        </span>
      </div>
    </div>
  );
}
