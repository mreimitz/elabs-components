"use client";

/**
 * Infographic — "Which depot is the outlier?".
 *
 * Twelve depots, one tiny 13-week line per panel, ALL of them drawn on the
 * SAME y-axis — the one thing that makes panel HEIGHT an honest, directly
 * comparable signal instead of twelve independently-autoscaled shapes that
 * would all look equally "busy".
 *
 * The grid is `ChartMultiples` (`@elabs-ai/components-charts`), not a bespoke
 * inline-SVG grid: the shared domain, the responsive column packing, the
 * synced hover and the per-panel value-in-title all come from the real
 * engine, so a copy-owner tunes props instead of maintaining scale maths.
 * Each panel title carries the depot's latest reading, replaced by the
 * hovered week's reading while any panel is hovered — one hover reads the
 * same week across all twelve depots at once.
 *
 * One depot is emphasised, and never by colour alone (WCAG 1.4.1): a thicker
 * line in the status ink, the dashed SHAPE of `PeakRing` around its last
 * point, a trend glyph and a bold label in its title, and the deviation
 * stated in words in the "how to read" line underneath.
 *
 * Copy-own it: `npx shadcn add infographic-small-multiples-01`.
 */

import { TrendingDown, TrendingUp } from "lucide-react";
import {
  type ChartAnalytic,
  ChartMultiples,
  type ChartMultiplesHover,
  type ChartMultiplesPanel,
  ChartTooltip,
  Line,
  LineChart,
  PeakRing,
  useChart,
} from "@elabs-ai/components-charts";
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

/** Panel plot height in px — a sparkline rung, not the `ChartMultiples` 200 px default. */
const PANEL_HEIGHT = 56;
/** Narrowest panel the `"auto"` packing will make, in px. */
const MIN_PANEL_WIDTH = 132;

/** One panel's rows: the week's label in the trailing window, and that week's reading. */
interface WeekRow extends Record<string, unknown> {
  /** "Week 1"…"Week 13" — an ordinal x (never a date) and the tooltip's title. */
  week: string;
  value: number;
}

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

/** The `[min, max]` across every region's every week — the ONE scale every panel plots against. */
function sharedExtent(regions: RegionSeries[]): [number, number] {
  const values = regions.flatMap((r) => r.weekly);
  return [Math.min(...values), Math.max(...values)];
}

/** The network-wide mean across every region's every week — the ONE rule every panel is measured against. */
function networkMean(regions: RegionSeries[]): number {
  const values = regions.flatMap((r) => r.weekly);
  return values.reduce((total, v) => total + v, 0) / Math.max(values.length, 1);
}

/** Every panel gets the SAME dashed reference: the network mean, unlabelled (named once in the lead copy). */
function panelAnalytics(mean: number): ChartAnalytic[] {
  return [{ kind: "line", value: mean, label: "none", id: "network-mean" }];
}

/** `ChartMultiples` panels, one per depot, in the network's own order. */
function regionPanels(regions: RegionSeries[]) {
  return regions.map((region) => ({
    data: region.weekly.map((value, i): WeekRow => ({ value, week: `Week ${i + 1}` })),
    key: region.id,
    title: region.label,
  }));
}

/** The dashed ring around the outlier's latest reading — the non-colour channel, drawn on the real scales. */
function LastPointRing({ row, stroke }: { row: WeekRow; stroke: string }) {
  const { xAccessor, xScale, yScale } = useChart();
  return (
    <PeakRing
      cx={Number(xScale(xAccessor(row)))}
      cy={Number(yScale(row.value))}
      r={5}
      stroke={stroke}
    />
  );
}

/** The hover box's value, in the same shape as the panel title's reading ("91.7%"). */
const TOOLTIP_VALUE_FORMAT = { abbreviate: false, decimals: 1, suffix: "%" } as const;

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

  const [domainMin, domainMax] = sharedExtent(regions);
  const mean = networkMean(regions);
  const analytics = panelAnalytics(mean);
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
  const tone = isGood ? "success" : "destructive";
  const TrendIcon = isGood ? TrendingUp : TrendingDown;
  // Written out, never `text-${tone}-text`: Tailwind only ships a class it can see in the source.
  const outlierInkClass = isGood ? "text-success-text" : "text-destructive-text";
  const headline = isGood
    ? `${outlier.region.label} is pulling far ahead of its regional peers`
    : `${outlier.region.label} is falling behind its regional peers`;

  const panelTitle = (
    panel: ChartMultiplesPanel<WeekRow>,
    hovered?: ChartMultiplesHover<WeekRow>,
  ) => {
    const isOutlier = panel.key === outlier.region.id;
    const reading = hovered?.value ?? panel.stats.end;
    return (
      <div className="flex min-w-0 items-center justify-between gap-1">
        <span
          className={cn(
            "flex min-w-0 items-center gap-1 text-caption",
            isOutlier ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {isOutlier ? <TrendIcon aria-hidden="true" className="size-3 shrink-0" /> : null}
          <span className="min-w-0 truncate">{panel.title}</span>
        </span>
        <span
          className={cn(
            "shrink-0 text-meta tabular-nums",
            isOutlier ? outlierInkClass : "text-muted-foreground",
          )}
          data-slot="infographic-small-multiples-value"
        >
          {reading == null ? "—" : formatKpiValue(reading, "percent", locale)}
        </span>
      </div>
    );
  };

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

        <ChartMultiples<WeekRow>
          // Two columns on a phone, not `ChartMultiples`' own one-column
          // narrow default: these panels are sparkline-sized, so a single
          // column would make a twelve-screen card of a twelve-tile grid.
          columns={{ base: "auto", narrow: 2 }}
          dataKeys={["value"]}
          data-slot="infographic-small-multiples-grid"
          minPanelWidth={MIN_PANEL_WIDTH}
          panelHeight={PANEL_HEIGHT}
          panelTitle={panelTitle}
          panels={regionPanels(regions)}
          scales={{ y: "shared", yDomain: [domainMin, domainMax] }}
          xDataKey="week"
        >
          {(panel) => {
            const isOutlier = panel.key === outlier.region.id;
            const stroke = isOutlier ? `var(--${tone})` : "var(--chart-foreground-muted)";
            const last = panel.data[panel.data.length - 1];
            return (
              <LineChart
                accessibleLabel={`${panel.title} — ${metricLabel}, 13 weeks`}
                analytics={analytics}
                data={panel.data}
                margin={{ bottom: 4, left: 4, right: 6, top: 4 }}
                // The weeks are ordinal labels, not dates.
                xDataKey="week"
                xScale="band"
              >
                <Line
                  dataKey="value"
                  name={panel.title}
                  stroke={stroke}
                  strokeWidth={isOutlier ? 2 : 1.25}
                />
                {isOutlier && last ? <LastPointRing row={last} stroke={stroke} /> : null}
                <ChartTooltip valueFormat={TOOLTIP_VALUE_FORMAT} />
              </LineChart>
            );
          }}
        </ChartMultiples>

        <p className="text-caption text-muted-foreground">
          How to read: every panel plots the same 13 weeks on the same{" "}
          <span className="tabular-nums">
            {formatDomainBound(domainMin)}–{formatDomainBound(domainMax)}
          </span>{" "}
          axis, so panel height compares directly; hovering one panel reads the same week in all
          twelve. The dashed rule on every panel is the network-wide mean,{" "}
          <span className="tabular-nums">{formatKpiValue(mean, "percent", locale)}</span>. The
          ringed point is {outlier.region.label}’s latest reading,{" "}
          <span className="tabular-nums">{outlier.deviationPp}pp</span> {outlier.direction} the
          network median of{" "}
          <span className="tabular-nums">{formatKpiValue(outlier.median, "percent", locale)}</span>.
        </p>
        <KpiAsOf date={AS_OF_DATE} locale={locale} source={DATA_SOURCE} />
      </CardContent>
    </Card>
  );
}
