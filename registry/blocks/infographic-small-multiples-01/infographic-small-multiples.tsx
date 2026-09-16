"use client";

/**
 * Infographic — "Which depot is the outlier?".
 *
 * Twelve depots, one tiny 13-week line per tile, ALL thirteen weeks drawn on
 * the SAME y-axis (the shared min–max across every depot and every week) —
 * the one thing that makes tile HEIGHT an honest, directly comparable signal
 * instead of twelve independently-autoscaled shapes that would all look
 * equally "busy". One depot is emphasised — a distinct line/ring colour and a
 * bold, ringed last point (`PeakRing`, `@elabs-ai/components-charts`) — with
 * everything else drawn in a single muted neutral. The emphasis colour is
 * never the only channel: the outlier tile also gets a background wash, a
 * bold label and the ring's own dashed SHAPE (WCAG 1.4.1).
 *
 * Built as a bespoke grid of hand-rolled inline-SVG mini charts (never
 * `Sparkline`, which has no seam for an external per-point mark like
 * `PeakRing`) — the same "compose from `marks/`" recipe the
 * `chart-editorial-*` blocks use (`.claude/rules/charts.md` § Marks).
 *
 * Copy-own it: `npx shadcn add infographic-small-multiples-01`.
 */

import { TrendingDown, TrendingUp } from "lucide-react";
import { PeakRing } from "@elabs-ai/components-charts";
import { Badge, Card, CardContent, Skeleton } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  AS_OF_DATE,
  DATA_SOURCE,
  QUARTER_LABEL,
} from "@/components/kpi-card-parts/data/acme-quarter";
import { formatKpiValue } from "@/components/kpi-card-parts/format";
import { KpiAsOf } from "@/components/kpi-card-parts/kpi-as-of";
import {
  onTimeByRegion,
  type RegionSeries,
} from "@/components/infographic-small-multiples-01/data/region-on-time";

export interface InfographicSmallMultiplesProps {
  /** Defaults to the shared Acme Logistics 12-depot on-time delivery network. */
  regions?: RegionSeries[];
  /** Metric label used in the subtitle and method note. Default "On-time delivery". */
  metricLabel?: string;
  locale?: string;
  /** Renders layout-shaped skeleton tiles instead of the real values. Default false. */
  loading?: boolean;
  className?: string;
}

const TILE_WIDTH = 148;
const TILE_HEIGHT = 52;
const TILE_PAD_X = 4;
const TILE_PAD_Y = 4;
const DOMAIN_PAD_RATIO = 0.05;

interface Outlier {
  region: RegionSeries;
  /** "above"/"below" the network median — never the sign of a raw delta, so it reads right for a lower-is-better metric too. */
  direction: "above" | "below";
  deviationPp: number;
  median: number;
}

/** Median-of-latest-readings outlier detector — works for either scenario this block ships. */
function findOutlier(regions: RegionSeries[]): Outlier {
  const lastValues = regions.map((r) => r.weekly[r.weekly.length - 1] ?? 0);
  const sorted = [...lastValues].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
      : (sorted[mid] as number);
  let outlierIndex = 0;
  let maxDeviation = -Infinity;
  lastValues.forEach((value, i) => {
    const deviation = Math.abs(value - median);
    if (deviation > maxDeviation) {
      maxDeviation = deviation;
      outlierIndex = i;
    }
  });
  const value = lastValues[outlierIndex] as number;
  return {
    region: regions[outlierIndex] as RegionSeries,
    direction: value >= median ? "above" : "below",
    deviationPp: Math.round(Math.abs(value - median) * 10) / 10,
    median: Math.round(median * 10) / 10,
  };
}

/** The padded `[min, max]` shared across every region's every week — the ONE scale every tile plots against. */
function sharedDomain(regions: RegionSeries[]): [number, number] {
  const values = regions.flatMap((r) => r.weekly);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * DOMAIN_PAD_RATIO || 1;
  return [min - pad, max + pad];
}

/**
 * InfographicSmallMultiples — a grid of same-scale mini trends with one
 * outlier called out directly, never buried in a legend.
 */
export function InfographicSmallMultiples({
  regions = onTimeByRegion,
  metricLabel = "On-time delivery",
  locale = "en-US",
  loading = false,
  className,
}: InfographicSmallMultiplesProps) {
  if (loading) {
    return (
      <Card
        aria-live="polite"
        className={cn("w-full", className)}
        data-slot="infographic-small-multiples"
        role="status"
      >
        <CardContent className="space-y-4 p-5">
          <span className="sr-only">Loading the regional breakdown…</span>
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="@container">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 @sm:grid-cols-3 @lg:grid-cols-4 @3xl:grid-cols-6">
              {regions.map((region) => (
                <div className="space-y-1.5" key={region.id}>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-40" />
        </CardContent>
      </Card>
    );
  }

  const domain = sharedDomain(regions);
  const outlier = findOutlier(regions);
  // `formatKpiValue` never pads a whole number ("98"), so it can sit beside a
  // decimal reading ("83.1%") at a different precision in the SAME range —
  // one number, two implied precisions. The domain bound is a single fixed-
  // precision scale, not a KPI reading, so it gets its own one-decimal
  // formatter here rather than a change to the shared KPI formatter.
  const formatDomainBound = (value: number) =>
    `${new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value)}%`;
  const isGood = outlier.direction === "above";
  const headline = isGood
    ? `${outlier.region.label} is pulling far ahead of its regional peers`
    : `${outlier.region.label} is falling behind its regional peers`;

  return (
    <Card className={cn("w-full", className)} data-slot="infographic-small-multiples">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body text-muted-foreground">
            Which depot is the outlier?
          </span>
          <Badge className="shrink-0" variant="secondary">
            {QUARTER_LABEL}
          </Badge>
        </div>
        <div className="space-y-1">
          <p className="text-title text-foreground">{headline}</p>
          <p className="text-caption text-muted-foreground">
            {metricLabel}, 13 weeks, by depot — network median{" "}
            <span className="tabular-nums">
              {formatKpiValue(outlier.median, "percent", locale)}
            </span>
          </p>
        </div>

        {/* `@container` on this wrapper, `@sm:`/`@lg:`/`@3xl:` on the grid
            inside — a viewport breakpoint fires from the BROWSER width, which
            would still force a wide grid onto a narrow sidebar card; see
            `kpi-forecast-01`'s identical note. */}
        <div className="@container" data-slot="infographic-small-multiples-grid-wrap">
          <div
            className="grid grid-cols-2 gap-x-3 gap-y-2 @sm:grid-cols-3 @lg:grid-cols-4 @3xl:grid-cols-6"
            data-slot="infographic-small-multiples-grid"
          >
            {regions.map((region) => (
              <RegionTile
                domain={domain}
                isOutlier={region.id === outlier.region.id}
                key={region.id}
                locale={locale}
                region={region}
                tone={isGood ? "success" : "destructive"}
              />
            ))}
          </div>
        </div>

        <p className="text-caption text-muted-foreground">
          How to read: every tile plots the same 13 weeks on the same{" "}
          <span className="tabular-nums">
            {formatDomainBound(domain[0])}–{formatDomainBound(domain[1])}
          </span>{" "}
          axis, so tile height compares directly. The ringed point is {outlier.region.label}’s
          latest reading, <span className="tabular-nums">{outlier.deviationPp}pp</span>{" "}
          {outlier.direction} the network median of{" "}
          <span className="tabular-nums">{formatKpiValue(outlier.median, "percent", locale)}</span>.
        </p>
        <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
      </CardContent>
    </Card>
  );
}

function RegionTile({
  region,
  isOutlier,
  tone,
  domain,
  locale,
}: {
  region: RegionSeries;
  isOutlier: boolean;
  tone: "success" | "destructive";
  domain: [number, number];
  locale: string;
}) {
  const values = region.weekly;
  const last = values[values.length - 1] ?? 0;
  // Plain linear interpolation onto the shared [min, max] domain — no chart
  // library needed for a single, fixed-range axis, and it keeps this
  // registry item free of a third-party runtime dependency it would
  // otherwise have to declare via `extraDependencies` (`.claude/rules/registry.md`).
  const [domainMin, domainMax] = domain;
  const domainSpan = domainMax - domainMin || 1;
  const yTop = TILE_PAD_Y;
  const yBottom = TILE_HEIGHT - TILE_PAD_Y;
  const yScale = (value: number) => yBottom - ((value - domainMin) / domainSpan) * (yBottom - yTop);
  const innerWidth = TILE_WIDTH - TILE_PAD_X * 2;
  const stepX = values.length > 1 ? innerWidth / (values.length - 1) : 0;
  const points = values.map((value, i) => `${TILE_PAD_X + i * stepX},${yScale(value)}`).join(" ");
  const lastX = TILE_PAD_X + (values.length - 1) * stepX;
  const lastY = yScale(last);
  const lineColor = isOutlier ? `var(--${tone})` : "var(--chart-foreground-muted)";
  const TrendIcon = tone === "success" ? TrendingUp : TrendingDown;

  return (
    <div
      className={cn(
        "min-w-0 space-y-1 rounded-md p-1.5",
        isOutlier && (tone === "success" ? "bg-success/10" : "bg-destructive/10"),
      )}
      data-slot="infographic-small-multiples-tile"
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={cn(
            "flex min-w-0 items-center gap-1 text-caption",
            isOutlier ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {isOutlier ? <TrendIcon aria-hidden="true" className="size-3 shrink-0" /> : null}
          <span className="min-w-0 truncate">{region.label}</span>
        </span>
        <span
          className={cn(
            "shrink-0 text-meta tabular-nums",
            isOutlier
              ? tone === "success"
                ? "text-success-text"
                : "text-destructive-text"
              : "text-muted-foreground",
          )}
        >
          {formatKpiValue(last, "percent", locale)}
        </span>
      </div>
      <svg
        aria-hidden="true"
        className="block w-full"
        role="presentation"
        style={{ height: TILE_HEIGHT }}
        viewBox={`0 0 ${TILE_WIDTH} ${TILE_HEIGHT}`}
      >
        <polyline
          fill="none"
          points={points}
          stroke={lineColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={isOutlier ? 2 : 1.25}
        />
        <circle cx={lastX} cy={lastY} fill={lineColor} r={2} />
        {isOutlier ? <PeakRing cx={lastX} cy={lastY} r={5.5} stroke={lineColor} /> : null}
      </svg>
    </div>
  );
}
