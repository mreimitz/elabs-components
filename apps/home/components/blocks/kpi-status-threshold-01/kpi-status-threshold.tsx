// registry: kpi-status-threshold-01 — copied 2026-09-19
"use client";

import { Badge, Card, CardContent, Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  AS_OF_DATE,
  DATA_SOURCE,
  onTimeDelivery,
  QUARTER_LABEL,
  type KpiMetric,
} from "../kpi-card-parts/data/acme-quarter";
import { KpiAsOf } from "../kpi-card-parts/kpi-as-of";
import { KpiComparisonRow } from "../kpi-card-parts/kpi-comparison-row";
import { KpiStatus, type KpiStatusValue } from "../kpi-card-parts/kpi-status";
import { formatKpiValue } from "../kpi-card-parts/format";

export interface KpiStatusThresholdProps {
  /** Defaults to on-time delivery — the shared Acme Logistics Q3 dataset. */
  metric?: KpiMetric;
  locale?: string;
  /** Renders a layout-shaped skeleton card instead of the real values. Default false. */
  loading?: boolean;
  className?: string;
}

/**
 * Same margin-of-target RULE the scorecard uses (`statusForMetric` in
 * `infographic-scorecard-01`) — repeated here, not imported, because a
 * relative import may not cross an item boundary (`.claude/rules/registry.md`
 * § Shared code) and this card additionally reuses it PER WEEK below, which
 * the scorecard's version has no reason to do.
 *
 * A percent-unit metric states its margin in ROUND percentage POINTS (5pp) —
 * a number a real policy would actually be written as ("off track below
 * 90%") — rather than the scorecard's generic 5%-of-target, which for a 95%
 * target computes an arbitrary-looking 90.25%. `higherIsBetter`/`actual`
 * both agree on 91.4% still landing in "at risk" either way (91.4 is within
 * both the 90.25 and the 90 boundary), so this card and the scorecard reach
 * the SAME verdict for the one on-time-delivery figure both draw from
 * (`kpi-card-parts/data/acme-quarter.ts`) — only the boundary this card
 * additionally prints as a literal number is now one nobody would dispute.
 */
function marginFor(target: number, unit: KpiMetric["unit"]): number {
  return unit === "percent" ? 5 : Math.abs(target) * 0.05;
}

/** Which zone a single value falls in, against `target` — used both for
 * TODAY's status and, applied to every trailing weekly point, for how long
 * it has held. */
function statusForValue(
  value: number,
  target: number,
  higherIsBetter: boolean,
  unit: KpiMetric["unit"],
): KpiStatusValue {
  const gap = higherIsBetter ? target - value : value - target;
  if (gap <= 0) return "on-track";
  return gap <= marginFor(target, unit) ? "at-risk" : "off-track";
}

/**
 * How many of the metric's own trailing weekly points, counting back from
 * the most recent, sit in the SAME status as today — "how long has this been
 * true?". Stated in whole WEEKS, the data's own resolution: this dataset has
 * no daily readings to convert to a day count without inventing precision it
 * does not have (`.claude/rules/charts.md` § Honesty).
 */
function weeksInCurrentStatus(metric: KpiMetric): number {
  const current = statusForValue(metric.actual, metric.target, metric.higherIsBetter, metric.unit);
  let weeks = 0;
  for (let i = metric.weekly.length - 1; i >= 0; i -= 1) {
    const value = metric.weekly[i];
    if (value === undefined) break;
    if (statusForValue(value, metric.target, metric.higherIsBetter, metric.unit) !== current) break;
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

/**
 * The DECISION range, not the full 0-to-max range a bar chart would use: a
 * threshold scale exists to show whether today's value is close to the
 * boundary, so the boundary and the margin around it get most of the width.
 * Three margin-widths on the "bad" side of `target`, one on the "good" side
 * — padded just enough to keep `actual` from ever sitting on the scale's own
 * edge. This is a zoomed READING window, not a bar's value axis, so it does
 * not start at zero (`.claude/rules/charts.md` § Honesty scopes the
 * zero-based rule to length/bar marks, not a bounded threshold track).
 */
function scaleDomain(metric: KpiMetric): { min: number; max: number } {
  const { target, actual, higherIsBetter, unit } = metric;
  const margin = marginFor(target, unit);
  const rawMin = higherIsBetter ? target - margin * 3 : target - margin;
  const rawMax = higherIsBetter ? target + margin : target + margin * 3;
  const pad = margin * 0.5;
  return {
    max: Math.max(rawMax, actual + pad),
    min: Math.max(0, Math.min(rawMin, actual - pad)),
  };
}

function thresholdZones(metric: KpiMetric, domain: { min: number; max: number }): ThresholdZone[] {
  const { target, higherIsBetter, unit } = metric;
  const margin = marginFor(target, unit);
  const zones = higherIsBetter
    ? [
        { from: domain.min, label: "Off track", to: target - margin, tone: "off-track" as const },
        { from: target - margin, label: "At risk", to: target, tone: "at-risk" as const },
        { from: target, label: "On track", to: domain.max, tone: "on-track" as const },
      ]
    : [
        { from: domain.min, label: "On track", to: target, tone: "on-track" as const },
        { from: target, label: "At risk", to: target + margin, tone: "at-risk" as const },
        { from: target + margin, label: "Off track", to: domain.max, tone: "off-track" as const },
      ];
  // A zone entirely outside the zoomed domain (or inverted) has nothing to
  // paint — skip it rather than draw a zero-or-negative-width sliver.
  return zones
    .map((zone) => ({
      ...zone,
      from: Math.max(zone.from, domain.min),
      to: Math.min(zone.to, domain.max),
    }))
    .filter((zone) => zone.to > zone.from);
}

/** Zone-fill wash — a `bg-<tone>/N` region (`.claude/rules/conventions.md` §
 * Surface separation), never a template-interpolated class (Tailwind cannot
 * see through `` `bg-${tone}/15` `` at build time). Neighbouring zones are
 * told apart by a dedicated hairline tick at each boundary (below), never by
 * the wash's own contrast alone — the wash reads faint by design in a dark
 * theme, since the zone NAME and boundary VALUE labels, not the fill, carry
 * the meaning (`.claude/rules/conventions.md` § Accessibility: colour is
 * never the only channel). */
const ZONE_FILL: Record<KpiStatusValue, string> = {
  "at-risk": "bg-warning/25",
  "off-track": "bg-destructive/25",
  "on-track": "bg-success/25",
};

/** Current-value marker fill — the solid MARK rung, ≥3:1 (unlike the zone wash it sits on). */
const MARKER_FILL: Record<KpiStatusValue, string> = {
  "at-risk": "bg-warning",
  "off-track": "bg-destructive",
  "on-track": "bg-success",
};

function ThresholdScale({ metric, locale }: { metric: KpiMetric; locale: string }) {
  const { actual, target, higherIsBetter, unit } = metric;
  const margin = marginFor(target, unit);
  const domain = scaleDomain(metric);
  const span = domain.max - domain.min;
  const pct = (value: number) =>
    `${Math.min(100, Math.max(0, ((value - domain.min) / span) * 100))}%`;
  const zones = thresholdZones(metric, domain);
  const currentStatus = statusForValue(actual, target, higherIsBetter, unit);
  const marginBoundary = higherIsBetter ? target - margin : target + margin;
  const marginBoundaryFmt = formatKpiValue(marginBoundary, metric.unit, locale, metric.currency);
  const targetFmt = formatKpiValue(target, metric.unit, locale, metric.currency);
  const actualFmt = formatKpiValue(actual, metric.unit, locale, metric.currency);

  return (
    <div className="space-y-1" data-slot="kpi-status-threshold-scale">
      {/* Mostly decorative — every fact it draws (value, target, status) is
          also stated in words by `KpiComparisonRow`/`KpiStatus` below
          (`.claude/rules/conventions.md` § Accessibility: don't over-ARIA) —
          but see the visible value/target labels drawn as real text, not
          hidden, so a sighted user never needs the caption to read them. */}
      <div aria-hidden="true" className="relative mt-6">
        {/* The value marker: bigger than the target tick and carrying its
            own value label, so it never reads as one of two similar dots
            (`.claude/rules/conventions.md` § Accessibility: a second channel
            besides colour — position AND a label, not tone alone). */}
        <div
          className="absolute bottom-full flex -translate-x-1/2 flex-col items-center pb-0.5"
          style={{ insetInlineStart: pct(actual) }}
        >
          <span className="text-meta font-semibold tabular-nums text-foreground">{actualFmt}</span>
          <span className={cn("size-2.5 rotate-45 rounded-[2px]", MARKER_FILL[currentStatus])} />
        </div>
        <div className="relative flex h-3 w-full overflow-hidden rounded-full">
          {zones.map((zone) => (
            <div
              className={cn("h-full", ZONE_FILL[zone.tone])}
              key={zone.label}
              style={{ width: `${((zone.to - zone.from) / span) * 100}%` }}
            />
          ))}
        </div>
        {/* Boundary ticks: a dedicated hairline at each zone edge, confined
            to the bar's own height, so neighbouring zones are told apart
            even where the wash contrast is faint. */}
        <div
          className="absolute top-0 h-3 w-px bg-border-strong"
          style={{ insetInlineStart: pct(marginBoundary) }}
        />
        <div
          className="absolute top-0 h-3 w-0.5 bg-foreground"
          style={{ insetInlineStart: pct(target) }}
        />
      </div>
      {/* Boundary VALUE labels — a row of its own, never sharing a
          positioning box with the zone-name row below: two absolutely
          positioned rows stacked on the SAME box collide the moment either
          line of text is taller than its own padding reserve. NOT
          `aria-hidden`: the at-risk boundary value is real information no
          other text on this card states (`target`/`actual` already are, via
          `KpiComparisonRow` below). */}
      <div className="relative h-4 text-meta">
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap text-muted-foreground"
          style={{ insetInlineStart: pct(marginBoundary) }}
        >
          {marginBoundaryFmt}
        </span>
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap font-medium text-foreground"
          style={{ insetInlineStart: pct(target) }}
        >
          {targetFmt} target
        </span>
      </div>
      <div className="relative h-4 text-caption text-muted-foreground">
        {zones.map((zone) => (
          <span
            className="absolute -translate-x-1/2 text-center"
            key={zone.label}
            style={{
              insetInlineStart: pct((zone.from + zone.to) / 2),
              width: `${((zone.to - zone.from) / span) * 100}%`,
            }}
          >
            {zone.label}
          </span>
        ))}
      </div>
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

  const status = statusForValue(metric.actual, metric.target, metric.higherIsBetter, metric.unit);
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
