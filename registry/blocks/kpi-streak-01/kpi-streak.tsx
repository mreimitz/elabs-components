"use client";

import { ArrowDown, ArrowUp, Minus, X } from "lucide-react";
import { Badge, Card, CardContent, Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  AS_OF_DATE,
  DATA_SOURCE,
  QUARTER_LABEL,
} from "@/components/kpi-card-parts/data/acme-quarter";
import { KpiAsOf } from "@/components/kpi-card-parts/kpi-as-of";
import {
  deployReliabilityWindow,
  slaComplianceWindow,
  type StreakDay,
  type StreakWindow,
} from "./data/streak-days";

export interface StreakMetricConfig {
  id: string;
  label: string;
  /** Which fact leads the card: a ratio ("27 of 30 days") or a run ("18-day streak"). */
  headline: "ratio" | "streak";
  /** Caption under the headline number. */
  headlineCaption: string;
  /** Adjective for a good day, used mid-sentence: "27 of 30 days on-time". */
  metLabel: string;
  /** Singular/plural noun for a bad day, for the strip's accessible summary. */
  missedLabel: string;
  missedLabelPlural: string;
  window: StreakWindow;
}

export const slaComplianceMetric: StreakMetricConfig = {
  id: "sla-compliance",
  label: "SLA compliance",
  headline: "ratio",
  headlineCaption: "On-time days, last 30",
  metLabel: "on-time",
  missedLabel: "missed day",
  missedLabelPlural: "missed days",
  window: slaComplianceWindow,
};

export const deployReliabilityMetric: StreakMetricConfig = {
  id: "deploy-reliability",
  label: "Deploy reliability",
  headline: "streak",
  headlineCaption: "Consecutive incident-free days",
  metLabel: "incident-free",
  missedLabel: "incident",
  missedLabelPlural: "incidents",
  window: deployReliabilityWindow,
};

function metCount(days: StreakDay[]): number {
  return days.filter((day) => day.met).length;
}

function currentStreak(days: StreakDay[]): number {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    if (!days[i]?.met) break;
    streak += 1;
  }
  return streak;
}

function longestStreak(days: StreakDay[]): number {
  let longest = 0;
  let run = 0;
  for (const day of days) {
    run = day.met ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}

function formatDay(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export interface KpiStreakProps {
  /** Defaults to SLA compliance and deploy reliability — see this file's own dataset. */
  metrics?: StreakMetricConfig[];
  locale?: string;
  /** Renders layout-shaped skeleton cards instead of the real values. Default false. */
  loading?: boolean;
  className?: string;
  /** Merged onto the metric-cards GRID itself — override its `sm:`/`lg:` column counts for a narrow container regardless of viewport. */
  gridClassName?: string;
}

/**
 * "How reliable is it?" — a ratio or a run headline over a 30-day strip of
 * day cells. A missed day differs by SHAPE as well as colour (hollow, with a
 * cross) so the pattern survives greyscale (WCAG 1.4.1), and the strip's 30
 * cells are `aria-hidden`: one composed sentence carries the same counts and
 * the specific missed dates to assistive tech, rather than 30 separately
 * announced cells.
 */
export function KpiStreak({
  metrics = [slaComplianceMetric, deployReliabilityMetric],
  locale = "en-US",
  loading = false,
  className,
  gridClassName,
}: KpiStreakProps) {
  if (loading) {
    return (
      <div
        aria-live="polite"
        className={cn("space-y-3", className)}
        data-slot="kpi-streak"
        role="status"
      >
        <span className="sr-only">Loading KPI cards…</span>
        <div className={cn("grid gap-4 sm:grid-cols-2", gridClassName)}>
          {metrics.map((metric) => (
            <KpiStreakCardSkeleton key={metric.id} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn("grid gap-4 sm:grid-cols-2", gridClassName, className)}
      data-slot="kpi-streak"
    >
      {metrics.map((metric) => (
        <KpiStreakCard key={metric.id} locale={locale} metric={metric} />
      ))}
    </div>
  );
}

function KpiStreakCardSkeleton() {
  return (
    <Card aria-hidden="true" data-slot="kpi-streak-card">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-4 w-40" />
      </CardContent>
    </Card>
  );
}

function KpiStreakCard({ metric, locale }: { metric: StreakMetricConfig; locale: string }) {
  const { days, priorDays } = metric.window;
  const met = metCount(days);
  const current = currentStreak(days);
  const longest = longestStreak(days);
  const priorMet = metCount(priorDays);

  const headlineText =
    metric.headline === "ratio" ? `${met} of ${days.length} days` : `${current}-day streak`;
  const metaText =
    metric.headline === "ratio"
      ? `Current streak: ${current} days · Longest: ${longest} days`
      : `${met} of ${days.length} days ${metric.metLabel} · Longest streak: ${longest} days`;

  return (
    <Card data-slot="kpi-streak-card">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body text-muted-foreground">{metric.label}</span>
          <Badge className="shrink-0" variant="secondary">
            {QUARTER_LABEL}
          </Badge>
        </div>
        <div>
          <div className="text-kpi tabular-nums text-foreground">{headlineText}</div>
          <p className="text-caption text-muted-foreground">{metric.headlineCaption}</p>
        </div>
        <StreakStrip days={days} locale={locale} metric={metric} />
        <p className="text-meta text-muted-foreground">{metaText}</p>
        <CountCompareRow actual={met} baseline={priorMet} singularNoun="day" />
        <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
      </CardContent>
    </Card>
  );
}

/**
 * The 30-day strip. Grouped into weeks (a wider gap between groups than
 * within one) so the eye can count weeks without a drawn rule. Every cell is
 * `aria-hidden` — the composed sentence on the wrapping `role="img"` carries
 * the same counts and the specific missed dates to assistive tech.
 */
function StreakStrip({
  days,
  locale,
  metric,
}: {
  days: StreakDay[];
  locale: string;
  metric: StreakMetricConfig;
}) {
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const missed = days.filter((day) => !day.met);
  const missedNoun = missed.length === 1 ? metric.missedLabel : metric.missedLabelPlural;
  const summary =
    `30-day strip, ${metCount(days)} of ${days.length} days ${metric.metLabel}` +
    (missed.length > 0
      ? `, ${missed.length} ${missedNoun}: ${missed.map((day) => formatDay(day.date, locale)).join(", ")}.`
      : ".");

  const weeks: StreakDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div className="space-y-1" data-slot="kpi-streak-strip">
      <div aria-label={summary} className="flex flex-wrap items-center gap-x-2 gap-y-1" role="img">
        {weeks.map((week, weekIndex) => (
          <div className="flex gap-1" key={week[0]?.date ?? weekIndex}>
            {week.map((day) => (
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-3 shrink-0 items-center justify-center rounded-sm",
                  day.met ? "bg-success" : "border border-destructive bg-transparent",
                )}
                data-slot="kpi-streak-day"
                key={day.date}
              >
                {day.met ? null : <X className="size-2 text-destructive" />}
              </span>
            ))}
          </div>
        ))}
      </div>
      {missed.length > 0 ? (
        <p className="text-caption text-muted-foreground">
          {missedNoun[0]?.toUpperCase()}
          {missedNoun.slice(1)}: {missed.map((day) => formatDay(day.date, locale)).join(", ")}
        </p>
      ) : null}
      <div className="flex items-center justify-between text-caption text-muted-foreground">
        {firstDay ? <span>{formatDay(firstDay.date, locale)}</span> : null}
        {lastDay ? <span>{formatDay(lastDay.date, locale)}</span> : null}
      </div>
    </div>
  );
}

/**
 * A named-baseline comparison for a computed DAY COUNT — `kpi-card-parts`'
 * `KpiComparisonRow` takes a `KpiUnit` value (currency, percent, …), which a
 * bare day count is not, so this mirrors its visual pattern (arrow + sign +
 * tone, never colour alone) with a plain integer instead.
 */
/** `1 day` / `2 days` — the only noun this row ever pluralizes. */
function pluralize(count: number, singularNoun: string): string {
  return Math.abs(count) === 1 ? singularNoun : `${singularNoun}s`;
}

function CountCompareRow({
  actual,
  baseline,
  singularNoun,
}: {
  actual: number;
  baseline: number;
  singularNoun: string;
}) {
  const delta = actual - baseline;
  const isFlat = delta === 0;
  const good = isFlat ? null : delta > 0; // more good days is always the favorable direction here
  const toneClass = isFlat
    ? "text-muted-foreground"
    : good
      ? "text-success-text"
      : "text-destructive-text";
  const Arrow = isFlat ? Minus : delta > 0 ? ArrowUp : ArrowDown;
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  const directionLabel = isFlat ? "unchanged" : delta > 0 ? "up" : "down";
  const polarityLabel = isFlat ? "" : good ? ", favorable" : ", unfavorable";
  const deltaText = `${sign}${Math.abs(delta)} ${pluralize(delta, singularNoun)}`;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1"
      data-slot="kpi-comparison-row"
    >
      <span className="text-body text-muted-foreground">vs previous 30 days</span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-body tabular-nums text-muted-foreground">
          {baseline} {pluralize(baseline, singularNoun)}
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
